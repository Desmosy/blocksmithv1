import "server-only";

import { supabaseStorageEnabled } from "@/lib/supabase/env";
import { supabaseDownloadBlob, supabaseUploadBlob } from "@/lib/supabase/storage";

/**
 * The place an agent's work waits for the human it is working with.
 *
 * The two are usually not in the same browser: ChatGPT's in-app browser runs
 * on OpenAI's machines, so a proposal held in one process's memory lands
 * somewhere the human's own browser never reaches. Process memory is also
 * per-instance on a serverless host — the write and the read can land on
 * different lambdas, and the handoff silently disappears.
 *
 * So each handoff is written twice: to memory, which answers instantly and
 * works with no Supabase configured, and to object storage, which survives a
 * cold start, a scale-out, and the gap between two different browsers. Reads
 * prefer whichever is newer. Storage is best effort throughout — if it is not
 * configured or a call fails, this behaves exactly as the in-memory version
 * did, which is the behaviour every existing caller was written against.
 *
 * Nothing here is a record. Everything expires.
 */

export type HandoffKind = "proposal" | "change";

type Entry<T> = { value: T; at: number };

const memory = new Map<string, Entry<unknown>>();

/** A handoff older than this is stale conversation, not current work. */
const TTL_MS = 30 * 60 * 1000;
const MAX_KEYS = 40;
/** Storage must never hold a page render open. */
const STORAGE_TIMEOUT_MS = 2500;

function key(kind: HandoffKind, doc: string): string {
  return `${kind}:${doc}`;
}

/** Object name for a handoff. Slashes and colons are not path separators here. */
function objectName(kind: HandoffKind, doc: string): string {
  return `webmcp-handoff/${kind}--${doc.replace(/[^a-zA-Z0-9._-]/g, "_")}.json`;
}

function prune(): void {
  const cutoff = Date.now() - TTL_MS;
  for (const [k, entry] of memory) {
    if (entry.at < cutoff) memory.delete(k);
  }
  if (memory.size > MAX_KEYS) {
    const byAge = [...memory.entries()].sort((a, b) => a[1].at - b[1].at);
    for (const [k] of byAge.slice(0, memory.size - MAX_KEYS)) memory.delete(k);
  }
}

/** Run a storage call under a deadline; a slow bucket must not stall a request. */
async function withDeadline<T>(work: Promise<T>): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), STORAGE_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Record a handoff. Resolves once it is in memory; the durable copy is written
 * in the background so the agent's tool call is not waiting on a bucket.
 */
export function writeHandoff<T>(kind: HandoffKind, doc: string, value: T): void {
  prune();
  const entry: Entry<T> = { value, at: Date.now() };
  memory.set(key(kind, doc), entry);

  if (!supabaseStorageEnabled()) return;
  void withDeadline(
    supabaseUploadBlob(objectName(kind, doc), JSON.stringify(entry), "application/json"),
  ).catch(() => {
    /* memory already has it; durability is the bonus */
  });
}

/** Forget a handoff — the human dismissed it, or it was acted on. */
export function clearHandoff(kind: HandoffKind, doc: string): boolean {
  const existed = memory.delete(key(kind, doc));
  if (supabaseStorageEnabled()) {
    // An empty entry, rather than a delete: a stale copy on another instance
    // must not resurrect work the human has already dismissed.
    void withDeadline(
      supabaseUploadBlob(
        objectName(kind, doc),
        JSON.stringify({ value: null, at: Date.now() }),
        "application/json",
      ),
    ).catch(() => {});
  }
  return existed;
}

/**
 * Read a handoff, preferring whichever copy is newer.
 *
 * Storage is consulted only when this process has nothing fresh, so the common
 * case — the human's browser polling the instance the agent just wrote to —
 * costs nothing.
 */
export async function readHandoff<T>(
  kind: HandoffKind,
  doc: string,
): Promise<T | null> {
  prune();
  const local = memory.get(key(kind, doc)) as Entry<T> | undefined;
  if (local) return local.value;
  if (!supabaseStorageEnabled()) return null;

  const raw = await withDeadline(supabaseDownloadBlob(objectName(kind, doc)));
  if (!raw) return null;
  try {
    const entry = JSON.parse(raw) as Entry<T>;
    if (!entry || typeof entry.at !== "number") return null;
    if (Date.now() - entry.at > TTL_MS) return null;
    if (entry.value === null || entry.value === undefined) return null;
    // Warm this instance so the next poll does not pay for storage again.
    memory.set(key(kind, doc), entry as Entry<unknown>);
    return entry.value;
  } catch {
    return null;
  }
}
