/**
 * blocksmith.blocks.v1 — Design IR protocol types (reference implementation).
 *
 * This file is the TypeScript mirror of the published JSON Schemas:
 *   public/schema/blocksmith.blocks.v1.json
 *   public/schema/blocksmith.lock.v1.json
 *
 * See docs/RESEARCH-INFRA-DESIGN-IR-AND-CICD.md §4–§6.
 */
import type { BlockStatus, BlockType } from "@/lib/blocks/types";

export const BLOCKS_SCHEMA = "blocksmith.blocks.v1" as const;
export const LOCK_SCHEMA = "blocksmith.lock.v1" as const;

export type IngestSource =
  | "scan"
  | "markdown"
  | "governance"
  | "figma"
  | "paste"
  | "storybook"
  | "agent-template";

export type EditOrigin = "web" | "ide" | "mcp" | "ingest";

/** Atomic unit of design truth — the packet on the wire. */
export interface BlocksmithBlockV1 {
  id: string;
  type: BlockType;
  title: string;
  /** Monotonic per id; bumped when content changes, promoted on Finalize. */
  version: number;
  status: BlockStatus;
  source: { file: string; line?: number; ingest?: IngestSource };
  content: Record<string, unknown>;
  updatedAt: string;
  /** sha256 over canonical (id, type, content). */
  contentHash: string;
  finalizedAt?: string;
  editedBy?: EditOrigin;
}

/** Graph container — what ingest adapters emit and compile targets read. */
export interface BlocksmithGraphV1 {
  schema: typeof BLOCKS_SCHEMA;
  docRef: string;
  systemId: string;
  /** Order-independent hash over (id, version, contentHash). */
  contentHash: string;
  blocks: BlocksmithBlockV1[];
}

/** One immutable version record in the registry. */
export interface BlockVersionRecord {
  version: number;
  status: BlockStatus;
  title: string;
  type: BlockType;
  content: Record<string, unknown>;
  contentHash: string;
  source: { file: string; line?: number; ingest?: IngestSource };
  updatedAt: string;
  createdAt: string;
  finalizedAt?: string;
  editedBy?: EditOrigin;
}

/** Per-block registry entry: append-only versions + the official release pointer. */
export interface BlockRegistryEntry {
  id: string;
  /** Version number currently promoted (lock-eligible). Absent = never promoted. */
  official?: number;
  versions: BlockVersionRecord[];
}

export interface RegistryManifest {
  schema: "blocksmith.registry.v1";
  docRef: string;
  systemId: string;
  lastIngestAt: string;
  /** Hash of the official graph at last write — compared against the lock. */
  officialGraphHash: string;
  blockCount: number;
  promotedCount: number;
  draftCount: number;
  staleCount: number;
}

/** blocksmith.lock — lives in the customer repo, pins agent/CI truth. */
export interface BlocksmithLockV1 {
  schema: typeof LOCK_SCHEMA;
  docRef: string;
  systemId: string;
  /** Official graph hash at lock time — staleness sentinel. */
  contentHash: string;
  generatedAt: string;
  blocks: Record<string, { version: number; contentHash: string }>;
  package?: { name: string; pulseBuild?: string };
}

export interface LockVerification {
  ok: boolean;
  stale: boolean;
  missingInLock: string[];
  missingInRegistry: string[];
  versionMismatches: {
    id: string;
    locked: number;
    official: number;
  }[];
  hashMismatches: string[];
  lockHash: string;
  registryHash: string;
}
