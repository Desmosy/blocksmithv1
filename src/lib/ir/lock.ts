/**
 * blocksmith.lock — the deploy artifact of Design CI/CD.
 *
 * Same role as package-lock.json: agents and CI resolve against pinned
 * versions, never "latest markdown". Deterministic serialization (sorted ids)
 * so two builds of the same official graph produce byte-identical locks.
 *
 * Research doc §6.3. Schema: public/schema/blocksmith.lock.v1.json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { blocksmithWritableRoot } from "@/lib/runtime/writable-root";
import { graphHash } from "./hash";
import {
  getOfficialBlocks,
  officialGraphHash,
  readManifest,
} from "./registry";
import type { BlocksmithLockV1, LockVerification } from "./types";
import { LOCK_SCHEMA } from "./types";

function legacyReferenceLockPath(): string {
  return join(blocksmithWritableRoot(), "blocksmith.lock");
}

/** Per-doc reference locks — promoting doc A must never clobber doc B's pin. */
function docLockPath(docRef: string): string {
  const key = docRef.replace(/[^a-zA-Z0-9._-]/g, "_");
  return join(blocksmithWritableRoot(), "locks", `${key}.lock`);
}

/** Build a lock from the registry's official (promoted) graph. */
export function buildLock(
  docRef: string,
  options?: { packageName?: string; pulseBuild?: string },
): BlocksmithLockV1 {
  const blocks = getOfficialBlocks(docRef);
  const pinned: BlocksmithLockV1["blocks"] = {};
  for (const b of [...blocks].sort((x, y) => x.id.localeCompare(y.id))) {
    pinned[b.id] = { version: b.version, contentHash: b.contentHash };
  }
  return {
    schema: LOCK_SCHEMA,
    docRef,
    systemId: readManifest(docRef)?.systemId ?? "",
    contentHash: graphHash(blocks),
    generatedAt: new Date().toISOString(),
    blocks: pinned,
    ...(options?.packageName
      ? {
          package: {
            name: options.packageName,
            ...(options.pulseBuild ? { pulseBuild: options.pulseBuild } : {}),
          },
        }
      : {}),
  };
}

/** Deterministic body (generatedAt excluded from comparisons, included in file). */
export function serializeLock(lock: BlocksmithLockV1): string {
  return `${JSON.stringify(lock, null, 2)}\n`;
}

/**
 * Write the reference lock for a doc. Writes the per-doc lock (authoritative)
 * and mirrors to the legacy single path for older tooling.
 */
export function writeReferenceLock(
  docRef: string,
  options?: { packageName?: string; pulseBuild?: string },
): { path: string; lock: BlocksmithLockV1 } {
  const lock = buildLock(docRef, options);
  const body = serializeLock(lock);
  const perDoc = docLockPath(docRef);
  mkdirSync(dirname(perDoc), { recursive: true });
  writeFileSync(perDoc, body, "utf-8");
  try {
    const legacy = legacyReferenceLockPath();
    mkdirSync(dirname(legacy), { recursive: true });
    writeFileSync(legacy, body, "utf-8");
  } catch {
    /* legacy mirror is best-effort */
  }
  void import("./cloud-registry")
    .then((m) => m.mirrorLock(docRef, lock))
    .catch(() => {});
  return { path: perDoc, lock };
}

export function readLock(path?: string): BlocksmithLockV1 | null {
  const p = path ?? legacyReferenceLockPath();
  if (!existsSync(p)) return null;
  try {
    const parsed = JSON.parse(readFileSync(p, "utf-8")) as BlocksmithLockV1;
    if (parsed.schema !== LOCK_SCHEMA) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Read the reference lock for a doc: per-doc file first, legacy fallback. */
export function readReferenceLockForDoc(
  docRef: string,
): { lock: BlocksmithLockV1; path: string } | null {
  const perDoc = docLockPath(docRef);
  const fromPerDoc = readLock(perDoc);
  if (fromPerDoc && fromPerDoc.docRef === docRef) {
    return { lock: fromPerDoc, path: perDoc };
  }
  const legacy = readLock();
  if (legacy && legacy.docRef === docRef) {
    return { lock: legacy, path: legacyReferenceLockPath() };
  }
  return null;
}

export function referenceLockPath(docRef?: string): string {
  return docRef ? docLockPath(docRef) : legacyReferenceLockPath();
}

/**
 * Verify a lock against the live registry. Detects:
 *  - stale lock (graph hash drift — someone promoted after lock was written)
 *  - version pins that no longer match the official pointer
 *  - blocks promoted but missing from the lock, and vice versa
 *  - contentHash forgery/corruption
 */
export function verifyLock(
  docRef: string,
  lock: BlocksmithLockV1,
): LockVerification {
  const official = getOfficialBlocks(docRef);
  const officialById = new Map(official.map((b) => [b.id, b]));
  const registryHash = officialGraphHash(docRef);

  const missingInLock: string[] = [];
  const missingInRegistry: string[] = [];
  const versionMismatches: LockVerification["versionMismatches"] = [];
  const hashMismatches: string[] = [];

  for (const b of official) {
    const pin = lock.blocks[b.id];
    if (!pin) {
      missingInLock.push(b.id);
      continue;
    }
    if (pin.version !== b.version) {
      versionMismatches.push({
        id: b.id,
        locked: pin.version,
        official: b.version,
      });
    } else if (pin.contentHash !== b.contentHash) {
      hashMismatches.push(b.id);
    }
  }
  for (const id of Object.keys(lock.blocks)) {
    if (!officialById.has(id)) missingInRegistry.push(id);
  }

  const stale = lock.contentHash !== registryHash;
  return {
    ok:
      !stale &&
      missingInLock.length === 0 &&
      missingInRegistry.length === 0 &&
      versionMismatches.length === 0 &&
      hashMismatches.length === 0,
    stale,
    missingInLock,
    missingInRegistry,
    versionMismatches,
    hashMismatches,
    lockHash: lock.contentHash,
    registryHash,
  };
}
