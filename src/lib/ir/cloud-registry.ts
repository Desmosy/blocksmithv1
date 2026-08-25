/**
 * Cloud registry mirror — makes the IR registry durable on serverless.
 *
 * The disk registry (src/lib/ir/registry.ts) stays the synchronous source the
 * control plane reads. This module mirrors writes to Supabase (fire-and-forget)
 * and hydrates a cold disk from the cloud before reads — same pattern as
 * lib/cloud/documents.ts. Everything is env-gated and best-effort: without
 * Supabase configured, BlockSmith behaves exactly as before.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import type {
  BlockRegistryEntry,
  BlocksmithLockV1,
  RegistryManifest,
} from "./types";
import { blocksmithWritableRoot } from "@/lib/runtime/writable-root";

function regDir(docRef: string): string {
  const key = docRef.replace(/[^a-zA-Z0-9._-]/g, "_");
  return join(blocksmithWritableRoot(), "registry", key);
}

async function db() {
  const { saasDbEnabled } = await import("@/lib/cloud/saas");
  if (!saasDbEnabled()) return null;
  const { getSupabaseAdmin } = await import("@/lib/supabase/server");
  return getSupabaseAdmin();
}

function entryRow(docRef: string, entry: BlockRegistryEntry, now: string) {
  return {
    doc_ref: docRef,
    block_id: entry.id,
    versions: entry.versions,
    official: entry.official ?? null,
    updated_at: now,
  };
}

/** Supabase caps request payloads; 200 entries per upsert is comfortably safe. */
const UPSERT_CHUNK = 200;

// ── Micro-batched fire-and-forget mirror ─────────────────────────────────────
// Ingest calls mirrorEntry once per block; without coalescing, a 200-block scan
// fires 200 concurrent upserts at Supabase. Pending entries are queued per doc
// and flushed as one batched upsert on the next tick (latest write per block
// wins, matching upsert semantics).
const pendingEntries = new Map<string, Map<string, BlockRegistryEntry>>();
let flushScheduled = false;

async function flushPendingEntries(): Promise<void> {
  flushScheduled = false;
  const batches = [...pendingEntries.entries()];
  pendingEntries.clear();
  const sb = await db();
  if (!sb) return;
  const now = new Date().toISOString();
  for (const [docRef, entries] of batches) {
    const rows = [...entries.values()].map((e) => entryRow(docRef, e, now));
    for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
      await sb
        .from("blocksmith_block_registry_entries")
        .upsert(rows.slice(i, i + UPSERT_CHUNK), {
          onConflict: "doc_ref,block_id",
        });
    }
  }
}

/** Fire-and-forget mirror of one registry entry (coalesced per doc). */
export function mirrorEntry(docRef: string, entry: BlockRegistryEntry): void {
  let docQueue = pendingEntries.get(docRef);
  if (!docQueue) {
    docQueue = new Map();
    pendingEntries.set(docRef, docQueue);
  }
  docQueue.set(entry.id, entry);
  if (!flushScheduled) {
    flushScheduled = true;
    setTimeout(() => {
      void flushPendingEntries().catch(() => {});
    }, 25);
  }
}

/** Fire-and-forget mirror of the per-doc manifest. */
export function mirrorManifest(manifest: RegistryManifest): void {
  void (async () => {
    const sb = await db();
    if (!sb) return;
    await sb.from("blocksmith_registry_manifest").upsert(
      {
        doc_ref: manifest.docRef,
        system_id: manifest.systemId,
        official_graph_hash: manifest.officialGraphHash,
        block_count: manifest.blockCount,
        promoted_count: manifest.promotedCount,
        draft_count: manifest.draftCount,
        stale_count: manifest.staleCount,
        last_ingest_at: manifest.lastIngestAt,
      },
      { onConflict: "doc_ref" },
    );
  })().catch(() => {});
}

/** Awaited flush — use after finalize/scan so the next cold start sees staging. */
export async function syncRegistryToCloud(docRef: string): Promise<void> {
  const sb = await db();
  if (!sb) return;

  const { listRegistryEntries, readManifest } = await import("./registry");
  const entries = listRegistryEntries(docRef);
  if (!entries.length) return;

  // One batched upsert (chunked) instead of one round trip per block — a
  // 40-block doc used to cost 40 sequential Supabase calls on this path.
  const now = new Date().toISOString();
  const rows = entries.map((e) => entryRow(docRef, e, now));
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const { error } = await sb
      .from("blocksmith_block_registry_entries")
      .upsert(rows.slice(i, i + UPSERT_CHUNK), {
        onConflict: "doc_ref,block_id",
      });
    if (error) {
      throw new Error(`Registry sync failed: ${error.message}`);
    }
  }

  const manifest = readManifest(docRef);
  if (manifest) {
    const { error } = await sb.from("blocksmith_registry_manifest").upsert(
      {
        doc_ref: manifest.docRef,
        system_id: manifest.systemId,
        official_graph_hash: manifest.officialGraphHash,
        block_count: manifest.blockCount,
        promoted_count: manifest.promotedCount,
        draft_count: manifest.draftCount,
        stale_count: manifest.staleCount,
        last_ingest_at: manifest.lastIngestAt,
      },
      { onConflict: "doc_ref" },
    );
    if (error) {
      throw new Error(`Registry manifest sync failed: ${error.message}`);
    }
  }
}

/**
 * Awaited lock push — pipeline write routes (promote/pin-lock/rollback) call
 * this so the pinned lock survives a lambda freeze and cold restart.
 */
export async function syncLockToCloud(
  docRef: string,
  lock: BlocksmithLockV1,
): Promise<void> {
  const sb = await db();
  if (!sb) return;
  const { error } = await sb.from("blocksmith_block_locks").upsert(
    {
      doc_ref: docRef,
      lock,
      content_hash: lock.contentHash,
      generated_at: lock.generatedAt,
    },
    { onConflict: "doc_ref" },
  );
  if (error) {
    throw new Error(`Lock sync failed: ${error.message}`);
  }
}

/** Fire-and-forget mirror of the reference lock. */
export function mirrorLock(docRef: string, lock: BlocksmithLockV1): void {
  void syncLockToCloud(docRef, lock).catch(() => {});
}

/**
 * Pull the reference lock from Supabase when the local disk is cold.
 * Without this, a pinned lock silently reads as "No lock" on a fresh lambda.
 */
export async function hydrateLockFromCloud(docRef: string): Promise<void> {
  try {
    const key = docRef.replace(/[^a-zA-Z0-9._-]/g, "_");
    const perDoc = join(blocksmithWritableRoot(), "locks", `${key}.lock`);
    if (existsSync(perDoc)) return; // disk already warm

    const sb = await db();
    if (!sb) return;
    const { data } = await sb
      .from("blocksmith_block_locks")
      .select("lock")
      .eq("doc_ref", docRef)
      .maybeSingle();
    if (!data?.lock) return;

    mkdirSync(join(perDoc, ".."), { recursive: true });
    writeFileSync(perDoc, `${JSON.stringify(data.lock, null, 2)}\n`, "utf-8");
  } catch {
    /* hydration is best-effort; lock reads fall back to disk state */
  }
}

/**
 * Hydrate a cold disk registry from Supabase. Await this in async API routes
 * before synchronous registry reads (serverless cold start).
 */
export async function hydrateRegistryFromCloud(docRef: string): Promise<void> {
  // Lock has its own warm check — the registry dir can be warm while the
  // pinned lock is still missing on this instance.
  await hydrateLockFromCloud(docRef);
  try {
    const dir = regDir(docRef);
    const warm =
      existsSync(dir) &&
      readdirSync(dir).some((f) => f.endsWith(".json") && f !== "manifest.json");
    if (warm) return;

    const sb = await db();
    if (!sb) return;

    const { data: entries } = await sb
      .from("blocksmith_block_registry_entries")
      .select("block_id, versions, official")
      .eq("doc_ref", docRef);
    if (!entries?.length) return;

    mkdirSync(dir, { recursive: true });
    for (const row of entries) {
      const entry: BlockRegistryEntry = {
        id: row.block_id,
        official: row.official ?? undefined,
        versions: row.versions ?? [],
      };
      const safe = row.block_id.replace(/[^a-zA-Z0-9._-]/g, "_");
      writeFileSync(
        join(dir, `${safe}.json`),
        JSON.stringify(entry, null, 2),
        "utf-8",
      );
    }

    const { data: manifest } = await sb
      .from("blocksmith_registry_manifest")
      .select("*")
      .eq("doc_ref", docRef)
      .maybeSingle();
    if (manifest) {
      const m: RegistryManifest = {
        schema: "blocksmith.registry.v1",
        docRef,
        systemId: manifest.system_id ?? "",
        lastIngestAt: manifest.last_ingest_at ?? new Date().toISOString(),
        officialGraphHash: manifest.official_graph_hash ?? "",
        blockCount: manifest.block_count ?? 0,
        promotedCount: manifest.promoted_count ?? 0,
        draftCount: manifest.draft_count ?? 0,
        staleCount: manifest.stale_count ?? 0,
      };
      writeFileSync(
        join(dir, "manifest.json"),
        JSON.stringify(m, null, 2),
        "utf-8",
      );
    }
  } catch {
    /* hydration is best-effort; disk/registry fallback continues */
  }
}
