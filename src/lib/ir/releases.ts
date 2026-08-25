/**
 * Release table — the data model behind the wiki's Releases screen.
 *
 * Joins the version registry (what exists, what's official) with the lock
 * (what agents are pinned to) into rows a human can act on: promote,
 * rollback, resolve. This is the control-plane read model; the registry
 * remains the only writer of truth.
 */
import { ensureDocBlocks } from "@/lib/blocks/refresh";
import type { BlockStatus, BlockType } from "@/lib/blocks/types";
import { getLockStatus, type LockStatus } from "./enforce";
import { buildLock, serializeLock } from "./lock";
import { listRegistryEntries, readManifest } from "./registry";
import type { BlockVersionRecord } from "./types";

export interface ReleaseHistoryEntry {
  version: number;
  status: BlockStatus;
  createdAt: string;
  finalizedAt?: string;
  editedBy?: string;
  contentHash: string;
}

export interface ReleaseRow {
  id: string;
  type: BlockType;
  title: string;
  /** Promoted (production) version — what the lock pins. */
  official?: number;
  officialHash?: string;
  lastPromotedAt?: string;
  /** Newest recorded version (may be a waiting draft). */
  latest: number;
  latestStatus: BlockStatus;
  latestEditedBy?: string;
  latestCreatedAt: string;
  /** A newer draft is staged and waiting for promote. */
  draftPending: boolean;
  conflict: boolean;
  stale: boolean;
  canPromote: boolean;
  canRollback: boolean;
  history: ReleaseHistoryEntry[];
}

export interface ReleaseTable {
  docRef: string;
  packageName: string;
  graphHash: string;
  lock: LockStatus;
  lockBody: string;
  generatedAt: string;
  counts: {
    total: number;
    live: number;
    draftsWaiting: number;
    stale: number;
    conflicts: number;
    neverPromoted: number;
  };
  rows: ReleaseRow[];
}

/** `upload:scan-acme-mobile-app.md` → `@blocksmith/acme-mobile-app` */
export function packageNameForDoc(docRef: string): string {
  const slug = docRef
    .replace(/^upload:/, "")
    .replace(/^scan-/, "")
    .replace(/\.md$/i, "")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `@blocksmith/${slug || "design-system"}`;
}

function historyEntry(v: BlockVersionRecord): ReleaseHistoryEntry {
  return {
    version: v.version,
    status: v.status,
    createdAt: v.createdAt,
    finalizedAt: v.finalizedAt,
    editedBy: v.editedBy,
    contentHash: v.contentHash,
  };
}

/** Sort: conflicts → drafts waiting → stale → live; alphabetical within. */
function rowOrder(r: ReleaseRow): number {
  if (r.conflict) return 0;
  if (r.draftPending || r.official == null) return 1;
  if (r.stale) return 2;
  return 3;
}

export function buildReleaseTable(docRef: string): ReleaseTable {
  // Best-effort hydration: the registry is readable even when the source
  // markdown isn't on this filesystem (hosted doc, cold serverless instance).
  try {
    ensureDocBlocks(docRef);
  } catch {
    /* registry is the read model; render what it has */
  }
  const entries = listRegistryEntries(docRef);
  const manifest = readManifest(docRef);

  const rows: ReleaseRow[] = [];
  for (const e of entries) {
    const latest = e.versions[e.versions.length - 1];
    if (!latest) continue;
    const officialRec =
      e.official != null
        ? e.versions.find((v) => v.version === e.official)
        : undefined;

    const conflict = latest.status === "conflict";
    const stale = latest.status === "stale";
    const draftPending =
      latest.status === "draft" &&
      (e.official == null || latest.version > e.official);
    const canRollback =
      e.official != null &&
      e.versions.some((v) => v.version < e.official! && Boolean(v.finalizedAt));

    rows.push({
      id: e.id,
      type: latest.type,
      title: latest.title,
      official: e.official,
      officialHash: officialRec?.contentHash,
      lastPromotedAt: officialRec?.finalizedAt,
      latest: latest.version,
      latestStatus: latest.status,
      latestEditedBy: latest.editedBy,
      latestCreatedAt: latest.createdAt,
      draftPending,
      conflict,
      stale,
      canPromote: draftPending || conflict,
      canRollback,
      history: [...e.versions].reverse().map(historyEntry),
    });
  }

  rows.sort((a, b) => rowOrder(a) - rowOrder(b) || a.id.localeCompare(b.id));

  const lock = getLockStatus(docRef);
  const lockArtifact = buildLock(docRef);

  return {
    docRef,
    packageName: packageNameForDoc(docRef),
    graphHash: manifest?.officialGraphHash ?? lockArtifact.contentHash,
    lock,
    lockBody: serializeLock(lockArtifact),
    generatedAt: new Date().toISOString(),
    counts: {
      total: rows.length,
      live: rows.filter((r) => r.official != null && !r.draftPending && !r.conflict && !r.stale).length,
      draftsWaiting: rows.filter((r) => r.draftPending).length,
      stale: rows.filter((r) => r.stale).length,
      conflicts: rows.filter((r) => r.conflict).length,
      neverPromoted: rows.filter((r) => r.official == null).length,
    },
    rows,
  };
}

/** Release info for a single block id (badges on block pages). */
export function getBlockRelease(
  docRef: string,
  blockId: string,
): ReleaseRow | null {
  const table = buildReleaseTable(docRef);
  return table.rows.find((r) => r.id === blockId) ?? null;
}
