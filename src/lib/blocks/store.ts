import "server-only";

import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  rmSync,
} from "fs";
import { join } from "path";
import type { LoadedDesignSystem } from "@/lib/clients/registry";
import { recordIngest } from "@/lib/ir/registry";
import { blocksmithWritableRoot } from "@/lib/runtime/writable-root";
import { getDocLifecycle } from "@/lib/wiki/doc-lifecycle";
import type { BlockStoreIndex, DocBlockIndex, StoredBlock } from "./content";
import { blocksFromDesignSystem } from "./extract";

function blocksRoot(): string {
  return join(blocksmithWritableRoot(), "blocks");
}

function indexPath(): string {
  return join(blocksmithWritableRoot(), "index.json");
}

function safeDocKey(docRef: string): string {
  return docRef.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function docBlocksDir(docRef: string): string {
  return join(blocksRoot(), safeDocKey(docRef));
}

function ensureDirs(): void {
  mkdirSync(blocksRoot(), { recursive: true });
}

function readIndex(): BlockStoreIndex {
  const path = indexPath();
  if (!existsSync(path)) {
    return { version: 1, lastSyncAt: "", docs: {} };
  }
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as BlockStoreIndex;
  } catch {
    return { version: 1, lastSyncAt: "", docs: {} };
  }
}

function writeIndex(index: BlockStoreIndex): void {
  ensureDirs();
  writeFileSync(indexPath(), JSON.stringify(index, null, 2), "utf-8");
}

/**
 * Writes all blocks for a doc to `.blocksmith/blocks/<docKey>/<id>.json`.
 * Same graph the wiki renders — MCP reads this store.
 */
export function persistBlocksForDoc(
  docRef: string,
  system: LoadedDesignSystem,
  editedBy: "web" | "ide" | "mcp" | "ingest" = "ingest",
): DocBlockIndex {
  // Step 1 honesty: a preview doc (paste / upload / bundled sample) has no repo
  // behind it. Skip the version registry + auto-promote entirely so it never
  // shows fake "production" versions. The wiki still renders from the parsed
  // markdown (loadDesignSystem), which does not depend on this store.
  if (getDocLifecycle({ mode: system.mode }) === "preview") {
    return {
      docRef,
      systemId: system.id,
      systemName: system.name,
      contentHash: system.contentHash ?? "",
      updatedAt: system.updatedAt,
      blockIds: [],
      blockCount: 0,
    };
  }

  ensureDirs();
  const dir = docBlocksDir(docRef);

  if (existsSync(dir)) {
    for (const f of readdirSync(dir)) {
      if (f.endsWith(".json")) rmSync(join(dir, f));
    }
  } else {
    mkdirSync(dir, { recursive: true });
  }

  const blocks = blocksFromDesignSystem(system, docRef);
  const blockIds: string[] = [];

  // Design CI/CD INGEST stage: every persist passes through the version
  // registry, which assigns monotonic versions, stages governance drafts,
  // auto-promotes scan facts, and marks vanished blocks stale.
  const ingestStart = Date.now();
  const ingest = recordIngest(docRef, system.id, blocks, editedBy);
  const ingestDurationMs = Date.now() - ingestStart;

  // Pipeline run log: record ingests that changed the graph (audit lane).
  if (ingest.created.length || ingest.bumped.length || ingest.staled.length) {
    const touched = [...ingest.created, ...ingest.bumped];
    void Promise.all([
      import("@/lib/ir/pipeline-runs"),
      import("@/lib/ir/pipeline-stages"),
    ])
      .then(([runs, stages]) => {
        // Console output for the ingest run — what changed and why, per block.
        const log = runs.createRunLog();
        log.info(`Ingest (${editedBy}): ${blocks.length} blocks parsed in ${ingestDurationMs}ms`);
        const listSome = (ids: string[], cap = 15) =>
          ids.slice(0, cap).join(", ") + (ids.length > cap ? ` +${ids.length - cap} more` : "");
        if (ingest.created.length)
          log.info(`Created v1: ${listSome(ingest.created)}`);
        if (ingest.bumped.length)
          log.info(`Version bumped (content changed): ${listSome(ingest.bumped)}`);
        if (ingest.staled.length)
          log.warn(`Vanished from source, marked stale (not deleted): ${listSome(ingest.staled)}`);
        if (ingest.conflicts.length)
          log.error(`Conflicting sources — resolve before promote: ${listSome(ingest.conflicts)}`);
        log.info(`${ingest.unchanged.length} unchanged · ${Object.keys(ingest.official).length} in production`);

        return runs.appendRun({
          docRef,
          actor: "ingest",
          action: "ingest",
          status: "success",
          summary: `Scan: ${ingest.created.length} new · ${ingest.bumped.length} updated · ${ingest.staled.length} stale`,
          blocks: touched.map((id) => ({
            id,
            version: ingest.versions[id],
          })),
          durationMs: ingestDurationMs,
          stages: stages.buildIngestStages(touched.length, ingestDurationMs),
          log: log.lines,
        });
      })
      .catch(() => {});
  }

  for (const b of blocks) {
    b.version = ingest.versions[b.id];
    const official = ingest.official[b.id];
    if (official != null && official !== b.version) {
      // Newer draft exists; the stored copy mirrors staging, registry holds truth.
      b.status = "draft";
    }
    const fileName = `${b.id.replace(/:/g, "__")}.json`;
    writeFileSync(join(dir, fileName), JSON.stringify(b, null, 2), "utf-8");
    blockIds.push(b.id);
  }

  const entry: DocBlockIndex = {
    docRef,
    systemId: system.id,
    systemName: system.name,
    contentHash: system.contentHash ?? "",
    updatedAt: system.updatedAt,
    blockIds,
    blockCount: blocks.length,
  };

  const index = readIndex();
  index.docs[docRef] = entry;
  index.lastSyncAt = new Date().toISOString();
  writeIndex(index);

  return entry;
}

export function readStoredBlock(
  docRef: string,
  blockId: string,
): StoredBlock | null {
  const fileName = `${blockId.replace(/:/g, "__")}.json`;
  const path = join(docBlocksDir(docRef), fileName);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as StoredBlock;
  } catch {
    return null;
  }
}

export function listStoredBlocks(docRef: string): StoredBlock[] {
  const dir = docBlocksDir(docRef);
  if (!existsSync(dir)) return [];
  const blocks: StoredBlock[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    try {
      blocks.push(
        JSON.parse(readFileSync(join(dir, f), "utf-8")) as StoredBlock,
      );
    } catch {
      /* skip corrupt */
    }
  }
  return blocks;
}

export function getBlockStoreIndex(): BlockStoreIndex {
  return readIndex();
}

export interface BlockStoreStatus {
  index: BlockStoreIndex;
  blocksRoot: string;
}

export function getBlockStoreStatus(): BlockStoreStatus {
  const root = blocksmithWritableRoot();
  return {
    index: readIndex(),
    blocksRoot: root,
  };
}
