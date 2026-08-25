/**
 * Lock enforcement — the DEPLOY/GATE half of Design CI/CD.
 *
 * Agents never read drafts. Every MCP read resolves through the registry's
 * official pointers and is annotated with the pinned version, so a long-running
 * agent session can detect that its truth went stale mid-task.
 */
import type { StoredBlock } from "@/lib/blocks/content";
import { ensureDocBlocks } from "@/lib/blocks/refresh";
import { listStoredBlocks } from "@/lib/blocks/store";
import {
  readReferenceLockForDoc,
  referenceLockPath,
  verifyLock,
} from "./lock";
import { getOfficialBlocks, readManifest } from "./registry";
import type { BlocksmithBlockV1 } from "./types";

export interface GovernedBlock extends StoredBlock {
  version: number;
  finalizedAt?: string;
}

export interface LockStatus {
  present: boolean;
  path: string;
  docRef?: string;
  contentHash?: string;
  generatedAt?: string;
  pinnedBlocks?: number;
  fresh?: boolean;
  drift?: {
    versionMismatches: { id: string; locked: number; official: number }[];
    missingInLock: string[];
    missingInRegistry: string[];
  };
}

/**
 * Blocks an agent is allowed to execute against: official versions only.
 * Draft, conflict, and never-promoted blocks are filtered out — that is the
 * enforcement boundary (research doc §4.6 row 4).
 */
export function listGovernedBlocks(docRef: string): GovernedBlock[] {
  ensureDocBlocks(docRef);
  const official = getOfficialBlocks(docRef);
  const officialById = new Map<string, BlocksmithBlockV1>(
    official.map((b) => [b.id, b]),
  );

  // Stored blocks carry the freshest formatting metadata; the registry decides
  // WHICH version is real. Serve registry content, keep store docRef shape.
  const stored = new Map(listStoredBlocks(docRef).map((b) => [b.id, b]));
  const out: GovernedBlock[] = [];
  for (const b of official) {
    if (b.status === "conflict" || b.status === "draft") continue;
    const base = stored.get(b.id);
    out.push({
      id: b.id,
      type: b.type,
      title: b.title,
      source: b.source,
      updatedAt: b.updatedAt,
      contentHash: b.contentHash,
      status: b.status,
      docRef: base?.docRef ?? docRef,
      content: b.content as StoredBlock["content"],
      version: b.version,
      finalizedAt: b.finalizedAt,
    });
  }
  return out;
}

/** Blocks excluded from agent reads, with the reason — surfaced in sync status. */
export function listExcludedBlocks(
  docRef: string,
): { id: string; reason: "draft" | "conflict" | "stale" | "unpromoted" }[] {
  ensureDocBlocks(docRef);
  const officialIds = new Set(getOfficialBlocks(docRef).map((b) => b.id));
  const out: { id: string; reason: "draft" | "conflict" | "stale" | "unpromoted" }[] =
    [];
  for (const b of listStoredBlocks(docRef)) {
    if (officialIds.has(b.id)) continue;
    const reason =
      b.status === "conflict"
        ? "conflict"
        : b.status === "stale"
          ? "stale"
          : b.status === "draft"
            ? "draft"
            : "unpromoted";
    out.push({ id: b.id, reason });
  }
  return out;
}

/** Lock freshness for sync status + validate_ui: is the pinned truth current? */
export function getLockStatus(docRef: string): LockStatus {
  const found = readReferenceLockForDoc(docRef);
  if (!found) {
    return { present: false, path: referenceLockPath(docRef) };
  }
  const { lock, path } = found;
  const v = verifyLock(docRef, lock);
  return {
    present: true,
    path,
    docRef: lock.docRef,
    contentHash: lock.contentHash,
    generatedAt: lock.generatedAt,
    pinnedBlocks: Object.keys(lock.blocks).length,
    fresh: v.ok,
    drift: v.ok
      ? undefined
      : {
          versionMismatches: v.versionMismatches,
          missingInLock: v.missingInLock,
          missingInRegistry: v.missingInRegistry,
        },
  };
}

export function getRegistrySummary(docRef: string) {
  return readManifest(docRef);
}
