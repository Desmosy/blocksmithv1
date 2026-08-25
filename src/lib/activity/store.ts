import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
} from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

/**
 * Component activity ledger.
 *
 * A shared, append-only log of who worked on which component, with the prompt
 * and a short summary. This is the missing memory: when person Z opens the
 * primary button, the IDE agent can surface that person Y already fixed it 7
 * days ago — and what they asked for. Persisted as JSONL so it is cheap to
 * append and survives across the wiki and every connected IDE.
 */

const ROOT = join(process.cwd(), ".blocksmith", "activity");

export type ActivityAction = "prompt" | "fix" | "change" | "note";

export type ActivitySource = "mcp" | "git";

export type ActivityEntry = {
  id: string;
  ts: string;
  docRef: string;
  componentId: string;
  componentTitle?: string;
  author: string;
  action: ActivityAction;
  prompt?: string;
  summary: string;
  files?: string[];
  contentHash?: string;
  /** Short git HEAD at log time — anchors the entry to the repo. */
  commit?: string;
  /** Where this entry was recorded — MCP agent or git post-commit hook. */
  source?: ActivitySource;
};

function safeDocKey(docRef: string): string {
  return docRef.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function logPath(docRef: string): string {
  return join(ROOT, safeDocKey(docRef), "activity.jsonl");
}

export type NewActivity = Omit<ActivityEntry, "id" | "ts">;

export function appendActivity(
  entry: NewActivity,
  opts?: { ts?: string },
): ActivityEntry {
  const full: ActivityEntry = {
    ...entry,
    id: randomUUID().slice(0, 8),
    ts: opts?.ts ?? new Date().toISOString(),
  };
  try {
    mkdirSync(join(ROOT, safeDocKey(entry.docRef)), { recursive: true });
    appendFileSync(logPath(entry.docRef), `${JSON.stringify(full)}\n`, "utf-8");
  } catch {
    /* activity logging is best-effort — never block the caller */
  }
  return full;
}

export function listActivity(
  docRef: string,
  opts?: { componentId?: string; limit?: number },
): ActivityEntry[] {
  const path = logPath(docRef);
  if (!existsSync(path)) return [];

  let entries: ActivityEntry[];
  try {
    entries = readFileSync(path, "utf-8")
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as ActivityEntry);
  } catch {
    return [];
  }

  let filtered = entries;
  if (opts?.componentId) {
    filtered = filtered.filter((e) => e.componentId === opts.componentId);
  }
  // Newest first.
  filtered.reverse();
  return opts?.limit ? filtered.slice(0, opts.limit) : filtered;
}

/** Distinct component ids that have any logged activity, newest touch first. */
export function listTouchedComponents(docRef: string): {
  componentId: string;
  componentTitle?: string;
  lastTs: string;
  count: number;
}[] {
  const entries = listActivity(docRef);
  const map = new Map<
    string,
    { componentId: string; componentTitle?: string; lastTs: string; count: number }
  >();
  for (const e of entries) {
    const existing = map.get(e.componentId);
    if (existing) {
      existing.count += 1;
      if (e.ts > existing.lastTs) existing.lastTs = e.ts;
    } else {
      map.set(e.componentId, {
        componentId: e.componentId,
        componentTitle: e.componentTitle,
        lastTs: e.ts,
        count: 1,
      });
    }
  }
  return [...map.values()].sort((a, b) => (a.lastTs < b.lastTs ? 1 : -1));
}
