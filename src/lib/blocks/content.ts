import type { BlockStatus, BlockType } from "./types";

/** Payload stored per block on disk — wiki and MCP read the same shape. */
export interface BlockContent {
  summary?: string;
  role?: string;
  description?: string;
  value?: string;
  cssVar?: string;
  group?: string;
  agentHint?: string;
  items?: string[];
  text?: string;
  /** Introduction page (page:introduction) fields. */
  name?: string;
  tagline?: string;
  overview?: string;
  /** Component compile hints (device-sim, Pulse). */
  radius?: string;
}

export interface StoredBlock {
  id: string;
  type: BlockType;
  title: string;
  source: { file: string; line?: number; ingest?: string };
  updatedAt: string;
  contentHash: string;
  status: BlockStatus;
  docRef: string;
  content: BlockContent;
  /** Monotonic per id — assigned by the IR version registry on ingest. */
  version?: number;
  finalizedAt?: string;
  editedBy?: "web" | "ide" | "mcp" | "ingest";
}

export interface DocBlockIndex {
  docRef: string;
  systemId: string;
  systemName: string;
  contentHash: string;
  updatedAt: string;
  blockIds: string[];
  blockCount: number;
}

export interface BlockStoreIndex {
  version: 1;
  lastSyncAt: string;
  docs: Record<string, DocBlockIndex>;
}
