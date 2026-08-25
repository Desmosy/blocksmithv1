import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { SystemSnapshot } from "./snapshot";

const ROOT = join(process.cwd(), ".blocksmith", "governance");
const MAX_HISTORY = 24;

function safeDocKey(docRef: string): string {
  return docRef.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function historyPath(docRef: string): string {
  return join(ROOT, safeDocKey(docRef), "history.json");
}

export function loadSnapshotHistory(docRef: string): SystemSnapshot[] {
  const path = historyPath(docRef);
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8"));
    return Array.isArray(parsed) ? (parsed as SystemSnapshot[]) : [];
  } catch {
    return [];
  }
}

/** Append a snapshot when the content hash is new; returns the saved history. */
export function recordSnapshot(
  docRef: string,
  snapshot: SystemSnapshot,
): SystemSnapshot[] {
  const history = loadSnapshotHistory(docRef);
  const last = history[history.length - 1];
  if (last && last.contentHash === snapshot.contentHash) return history;

  const next = [...history, snapshot].slice(-MAX_HISTORY);
  try {
    mkdirSync(join(ROOT, safeDocKey(docRef)), { recursive: true });
    writeFileSync(historyPath(docRef), JSON.stringify(next, null, 2), "utf-8");
  } catch {
    /* governance history is best-effort */
  }
  return next;
}

/** The most recent snapshot from a *different* version than `currentHash`. */
export function loadPreviousSnapshot(
  docRef: string,
  currentHash: string,
): SystemSnapshot | null {
  const history = loadSnapshotHistory(docRef);
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].contentHash !== currentHash) return history[i];
  }
  return null;
}
