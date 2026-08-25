/**
 * blocksmith.blocks.v1 protocol types — self-contained, zero dependencies.
 *
 * These mirror the published JSON Schemas in ../schemas/ exactly. The
 * BlockSmith app keeps an identical copy in src/lib/ir/types.ts; the
 * conformance suite's drift gate fails CI if the two ever diverge in
 * behavior (see conformance/drift.ts).
 */

export const BLOCKS_SCHEMA = "blocksmith.blocks.v1" as const;
export const LOCK_SCHEMA = "blocksmith.lock.v1" as const;
export const REGISTRY_SCHEMA = "blocksmith.registry.v1" as const;
export const COMPILE_TARGETS_SCHEMA = "blocksmith.compile-targets.v1" as const;

export type BlockStatus = "draft" | "finalized" | "stale" | "conflict";

export type BlockType =
  | "component"
  | "token"
  | "guideline"
  | "agent-rule"
  | "page";

export type IngestSource =
  | "scan"
  | "markdown"
  | "governance"
  | "figma"
  | "paste"
  | "storybook"
  | "agent-template";

export type EditOrigin = "web" | "ide" | "mcp" | "ingest";

export interface BlockSource {
  file: string;
  line?: number;
  ingest?: IngestSource;
}

/** Atomic unit of design truth — the packet on the wire. */
export interface BlocksmithBlockV1 {
  id: string;
  type: BlockType;
  title: string;
  /** Monotonic per id; promoted (made official) by a human gate. */
  version: number;
  status: BlockStatus;
  source: BlockSource;
  content: Record<string, unknown>;
  updatedAt: string;
  /** sha256 over canonical (id, type, content) — see hash.ts. */
  contentHash: string;
  finalizedAt?: string;
  editedBy?: EditOrigin;
}

/** Graph container — what adapters emit and compile targets read. */
export interface BlocksmithGraphV1 {
  schema: typeof BLOCKS_SCHEMA;
  docRef: string;
  systemId: string;
  /** Order-independent hash over (id, version, contentHash). */
  contentHash: string;
  blocks: BlocksmithBlockV1[];
}

/** blocksmith.lock — lives in the consumer repo, pins agent/CI truth. */
export interface BlocksmithLockV1 {
  schema: typeof LOCK_SCHEMA;
  docRef: string;
  systemId?: string;
  contentHash: string;
  generatedAt: string;
  blocks: Record<string, { version: number; contentHash: string }>;
  package?: { name: string; pulseBuild?: string };
}

/** One immutable version record in the registry (append-only). */
export interface BlockVersionRecord {
  version: number;
  status: BlockStatus;
  title: string;
  type: BlockType;
  content: Record<string, unknown>;
  contentHash: string;
  source: BlockSource;
  updatedAt: string;
  createdAt: string;
  finalizedAt?: string;
  editedBy?: EditOrigin;
}

/** Per-block registry entry: versions + the official release pointer. */
export interface BlockRegistryEntry {
  id: string;
  /** Production pointer; absent = never promoted (not lock-eligible). */
  official?: number;
  versions: BlockVersionRecord[];
}

/** Per-doc registry manifest. */
export interface RegistryManifestV1 {
  schema: typeof REGISTRY_SCHEMA;
  docRef: string;
  systemId: string;
  lastIngestAt: string;
  officialGraphHash: string;
  blockCount: number;
  promotedCount: number;
  draftCount: number;
  staleCount: number;
}

/** Compile target registry entry. */
export interface CompileTargetV1 {
  id: string;
  input: typeof BLOCKS_SCHEMA;
  officialOnly: boolean;
  output: string;
  reference?: string;
  status?: "reference" | "stable" | "experimental" | "stub";
  description?: string;
}

export interface CompileTargetsManifestV1 {
  schema: typeof COMPILE_TARGETS_SCHEMA;
  targets: CompileTargetV1[];
}
