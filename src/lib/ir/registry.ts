/**
 * Block version registry — the artifact store of Design CI/CD.
 *
 * Append-only version records per block id, plus an `official` release
 * pointer. Promote moves the pointer forward; rollback moves it back to a
 * previously finalized version (npm-style: history is immutable, the tag moves).
 *
 * Lifecycle (research doc §6.1):
 *   INGEST  → recordIngest()      new/changed content becomes a new version
 *   STAGING → status "draft"      visible in wiki preview, never in the lock
 *   PROMOTE → promoteBlock()      human Finalize; pointer advances
 *   LOCK    → lock.ts             pins { id → official version, contentHash }
 *   ROLLBACK→ rollbackBlock()     pointer returns to version N-1
 *
 * Truth precedence (§4.6): scan-derived facts auto-promote on ingest (code is
 * authoritative until re-scan); governance prose stages as draft until a human
 * promotes. Cross-source disagreement lands as status "conflict".
 *
 * Storage: .blocksmith/registry/<docKey>/<blockId>.json + manifest.json
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import type { StoredBlock } from "@/lib/blocks/content";
import { blocksmithWritableRoot } from "@/lib/runtime/writable-root";
import { blockContentHash, canonicalJson, graphHash, sha256Hex } from "./hash";
import type {
  BlockRegistryEntry,
  BlocksmithBlockV1,
  BlocksmithGraphV1,
  BlockVersionRecord,
  EditOrigin,
  IngestSource,
  RegistryManifest,
} from "./types";
import { BLOCKS_SCHEMA } from "./types";

function registryRoot(): string {
  return join(blocksmithWritableRoot(), "registry");
}

/** Block types whose ingest source (the repo) is authoritative — auto-promote. */
const SCAN_FACT_TYPES = new Set(["token", "component"]);

function normalizeSource(source: StoredBlock["source"]): BlockVersionRecord["source"] {
  const ingest = source.ingest;
  const allowed: IngestSource[] = [
    "scan",
    "markdown",
    "governance",
    "figma",
    "paste",
    "storybook",
    "agent-template",
  ];
  return {
    file: source.file,
    line: source.line,
    ingest: allowed.includes(ingest as IngestSource)
      ? (ingest as IngestSource)
      : undefined,
  };
}

function safeKey(ref: string): string {
  return ref.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function docDir(docRef: string): string {
  return join(registryRoot(), safeKey(docRef));
}

function entryPath(docRef: string, blockId: string): string {
  return join(docDir(docRef), `${safeKey(blockId)}.json`);
}

function manifestPath(docRef: string): string {
  return join(docDir(docRef), "manifest.json");
}

function readEntry(docRef: string, blockId: string): BlockRegistryEntry | null {
  const p = entryPath(docRef, blockId);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as BlockRegistryEntry;
  } catch {
    return null;
  }
}

function writeEntry(docRef: string, entry: BlockRegistryEntry): void {
  mkdirSync(docDir(docRef), { recursive: true });
  writeFileSync(
    entryPath(docRef, entry.id),
    JSON.stringify(entry, null, 2),
    "utf-8",
  );
  // Durable mirror (env-gated, fire-and-forget) — see cloud-registry.ts.
  void import("./cloud-registry")
    .then((m) => m.mirrorEntry(docRef, entry))
    .catch(() => {});
}

function latest(entry: BlockRegistryEntry): BlockVersionRecord | null {
  return entry.versions[entry.versions.length - 1] ?? null;
}

function officialRecord(
  entry: BlockRegistryEntry,
): BlockVersionRecord | null {
  if (entry.official == null) return null;
  return entry.versions.find((v) => v.version === entry.official) ?? null;
}

export function listRegistryEntries(docRef: string): BlockRegistryEntry[] {
  const dir = docDir(docRef);
  if (!existsSync(dir)) return [];
  const entries: BlockRegistryEntry[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json") || f === "manifest.json") continue;
    try {
      entries.push(
        JSON.parse(readFileSync(join(dir, f), "utf-8")) as BlockRegistryEntry,
      );
    } catch {
      /* skip corrupt */
    }
  }
  return entries.sort((a, b) => a.id.localeCompare(b.id));
}

export function getRegistryEntry(
  docRef: string,
  blockId: string,
): BlockRegistryEntry | null {
  return readEntry(docRef, blockId);
}

export interface IngestReport {
  docRef: string;
  created: string[];
  bumped: string[];
  unchanged: string[];
  staled: string[];
  conflicts: string[];
  /** blockId → version now current (latest, not necessarily official). */
  versions: Record<string, number>;
  /** blockId → official version after ingest (lock-eligible). */
  official: Record<string, number>;
}

/**
 * Record an ingest pass into the registry.
 *
 * - New id                          → version 1
 * - Same id, same contentHash      → no-op
 * - Same id, changed contentHash   → version N+1
 * - Id present in registry, absent from ingest → latest marked "stale"
 *
 * Auto-promotion: scan-fact types (token/component) promote on ingest —
 * the repository is authoritative for code facts. Governance/page/rule
 * blocks stage as draft and wait for human Finalize, unless this is the
 * very first version and the adapter already declared it finalized.
 */
export function recordIngest(
  docRef: string,
  systemId: string,
  blocks: StoredBlock[],
  editedBy: EditOrigin = "ingest",
  options?: {
    /**
     * Partial ingest (e.g. a Storybook/Figma adapter contributing alongside
     * scan): blocks absent from THIS pass are NOT marked stale — only a full
     * source-of-truth scan may stale blocks.
     */
    partial?: boolean;
  },
): IngestReport {
  const now = new Date().toISOString();
  const report: IngestReport = {
    docRef,
    created: [],
    bumped: [],
    unchanged: [],
    staled: [],
    conflicts: [],
    versions: {},
    official: {},
  };
  const seen = new Set<string>();

  for (const b of blocks) {
    seen.add(b.id);
    const contentHash = blockContentHash(b.id, b.type, b.content);
    const entry: BlockRegistryEntry = readEntry(docRef, b.id) ?? {
      id: b.id,
      versions: [],
    };
    const last = latest(entry);

    if (last && last.contentHash === contentHash) {
      // Content identical — clear staleness if a previous pass marked it.
      if (last.status === "stale") {
        last.status = entry.official === last.version ? "finalized" : "draft";
        writeEntry(docRef, entry);
      }
      report.unchanged.push(b.id);
    } else {
      const version = (last?.version ?? 0) + 1;
      // Auto-promote rules (§4.6 truth precedence):
      //  - scan facts (token/component) promote only when CODE changed them
      //    (editedBy "ingest" — re-scan). A human editing the same block in
      //    the wiki STAGES a draft; promote stays a human gate on Pipeline.
      //  - first-ever version of an already-finalized block bootstraps as
      //    official regardless of origin (initial scan of a doc).
      const autoPromote =
        (SCAN_FACT_TYPES.has(b.type) && editedBy === "ingest") ||
        (version === 1 && b.status === "finalized");
      const conflict = b.status === "conflict";

      const record: BlockVersionRecord = {
        version,
        status: conflict ? "conflict" : autoPromote ? "finalized" : "draft",
        title: b.title,
        type: b.type,
        content: b.content as Record<string, unknown>,
        contentHash,
        source: normalizeSource(b.source),
        updatedAt: b.updatedAt || now,
        createdAt: now,
        editedBy,
        ...(autoPromote && !conflict ? { finalizedAt: now } : {}),
      };
      entry.versions.push(record);
      if (autoPromote && !conflict) entry.official = version;
      writeEntry(docRef, entry);

      if (conflict) report.conflicts.push(b.id);
      else if (version === 1) report.created.push(b.id);
      else report.bumped.push(b.id);
    }

    // `entry` is authoritative in memory in every branch — no disk re-read.
    report.versions[b.id] = latest(entry)!.version;
    if (entry.official != null) report.official[b.id] = entry.official;
  }

  // Blocks that vanished from the source are stale, not deleted — the lock
  // may still pin them; a human decides in the wiki. Partial adapter passes
  // never stale blocks owned by other sources.
  if (!options?.partial) {
    for (const entry of listRegistryEntries(docRef)) {
      if (seen.has(entry.id)) continue;
      const last = latest(entry);
      if (last && last.status !== "stale") {
        last.status = "stale";
        writeEntry(docRef, entry);
        report.staled.push(entry.id);
      }
    }
  }

  writeManifest(docRef, systemId);
  return report;
}

export interface PromoteResult {
  ok: boolean;
  id: string;
  version?: number;
  previousOfficial?: number;
  error?: string;
}

export interface PromoteOptions {
  /**
   * Skip the per-call manifest rebuild. Batch callers (promote route) set this
   * and call updateManifest() once at the end — writing the manifest after
   * every block in a 40-block promote is O(N²) directory scans plus N
   * fire-and-forget Supabase manifest upserts.
   */
  deferManifest?: boolean;
}

/** Rebuild and persist the per-doc manifest (for batch promote/rollback). */
export function updateManifest(docRef: string, systemId = ""): void {
  writeManifest(docRef, systemId);
}

/** Human gate: promote the latest version of a block to official. */
export function promoteBlock(
  docRef: string,
  blockId: string,
  systemId = "",
  options?: PromoteOptions,
): PromoteResult {
  const entry = readEntry(docRef, blockId);
  if (!entry) return { ok: false, id: blockId, error: "Unknown block id" };
  const last = latest(entry);
  if (!last) return { ok: false, id: blockId, error: "No versions recorded" };
  if (last.status === "conflict") {
    return {
      ok: false,
      id: blockId,
      error:
        "Block is in conflict — resolve the disagreeing sources before promoting.",
    };
  }
  const previousOfficial = entry.official;
  last.status = "finalized";
  last.finalizedAt = new Date().toISOString();
  entry.official = last.version;
  writeEntry(docRef, entry);
  if (!options?.deferManifest) writeManifest(docRef, systemId);
  return { ok: true, id: blockId, version: last.version, previousOfficial };
}

/** Rollback: move the official pointer to the previous finalized version. */
export function rollbackBlock(
  docRef: string,
  blockId: string,
  systemId = "",
): PromoteResult {
  const entry = readEntry(docRef, blockId);
  if (!entry || entry.official == null) {
    return { ok: false, id: blockId, error: "Block has no official version" };
  }
  const prior = [...entry.versions]
    .filter((v) => v.version < entry.official! && v.finalizedAt)
    .sort((a, b) => b.version - a.version)[0];
  if (!prior) {
    return {
      ok: false,
      id: blockId,
      error: "No earlier finalized version to roll back to",
    };
  }
  const previousOfficial = entry.official;
  entry.official = prior.version;
  writeEntry(docRef, entry);
  writeManifest(docRef, systemId);
  return { ok: true, id: blockId, version: prior.version, previousOfficial };
}

/** Resolve a conflicted block by promoting its latest version as the answer. */
export function resolveConflict(
  docRef: string,
  blockId: string,
  systemId = "",
  options?: PromoteOptions,
): PromoteResult {
  const entry = readEntry(docRef, blockId);
  const last = entry ? latest(entry) : null;
  if (!entry || !last) {
    return { ok: false, id: blockId, error: "Unknown block id" };
  }
  last.status = "finalized";
  last.finalizedAt = new Date().toISOString();
  entry.official = last.version;
  writeEntry(docRef, entry);
  if (!options?.deferManifest) writeManifest(docRef, systemId);
  return { ok: true, id: blockId, version: last.version };
}

/** All officially promoted blocks — the only truth agents may execute against. */
export function getOfficialBlocks(docRef: string): BlocksmithBlockV1[] {
  const out: BlocksmithBlockV1[] = [];
  for (const entry of listRegistryEntries(docRef)) {
    const rec = officialRecord(entry);
    if (!rec) continue;
    out.push(recordToBlock(entry.id, rec));
  }
  return out;
}

/** Full version history for one block id (oldest → newest). */
export function getBlockHistory(
  docRef: string,
  blockId: string,
): { official?: number; versions: BlockVersionRecord[] } | null {
  const entry = readEntry(docRef, blockId);
  if (!entry) return null;
  return { official: entry.official, versions: entry.versions };
}

function recordToBlock(id: string, rec: BlockVersionRecord): BlocksmithBlockV1 {
  return {
    id,
    type: rec.type,
    title: rec.title,
    version: rec.version,
    status: rec.status,
    source: rec.source,
    content: rec.content,
    updatedAt: rec.updatedAt,
    contentHash: rec.contentHash,
    finalizedAt: rec.finalizedAt,
    editedBy: rec.editedBy,
  };
}

/** Materialize the official graph as a blocksmith.blocks.v1 document. */
export function getOfficialGraph(
  docRef: string,
  systemId = "",
): BlocksmithGraphV1 {
  const blocks = getOfficialBlocks(docRef);
  return {
    schema: BLOCKS_SCHEMA,
    docRef,
    systemId: systemId || readManifest(docRef)?.systemId || "",
    contentHash: graphHash(blocks),
    blocks,
  };
}

export function officialGraphHash(docRef: string): string {
  return graphHash(getOfficialBlocks(docRef));
}

function writeManifest(docRef: string, systemId: string): void {
  // Single directory pass: counts AND the official graph hash come from one
  // listRegistryEntries() read (officialGraphHash() would re-scan the dir).
  const entries = listRegistryEntries(docRef);
  let promoted = 0;
  let drafts = 0;
  let stale = 0;
  const officialBlocks: BlocksmithBlockV1[] = [];
  for (const e of entries) {
    if (e.official != null) promoted += 1;
    const last = latest(e);
    if (last?.status === "draft") drafts += 1;
    if (last?.status === "stale") stale += 1;
    const rec = officialRecord(e);
    if (rec) officialBlocks.push(recordToBlock(e.id, rec));
  }
  const prev = readManifest(docRef);
  const manifest: RegistryManifest = {
    schema: "blocksmith.registry.v1",
    docRef,
    systemId: systemId || prev?.systemId || "",
    lastIngestAt: new Date().toISOString(),
    officialGraphHash: graphHash(officialBlocks),
    blockCount: entries.length,
    promotedCount: promoted,
    draftCount: drafts,
    staleCount: stale,
  };
  mkdirSync(docDir(docRef), { recursive: true });
  writeFileSync(manifestPath(docRef), JSON.stringify(manifest, null, 2), "utf-8");
  void import("./cloud-registry")
    .then((m) => m.mirrorManifest(manifest))
    .catch(() => {});
}

export function readManifest(docRef: string): RegistryManifest | null {
  const p = manifestPath(docRef);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as RegistryManifest;
  } catch {
    return null;
  }
}

/** Stable fingerprint for an arbitrary graph payload (export/debug). */
export function fingerprintGraph(graph: BlocksmithGraphV1): string {
  return `sha256:${sha256Hex(canonicalJson(graph)).slice(0, 32)}`;
}
