/**
 * Storybook ingest adapter — the protocol's external-neutrality proof
 * (PROJECT-PROTOCOL.md P5).
 *
 * Reads a static Storybook build (index.json v4/v5 or stories.json v3) and
 * compiles component blocks INTO blocksmith.blocks.v1. Per the adapter
 * contract it only writes IR: never the wiki, never Pulse.
 *
 * Conflict rule: if the registry already holds the same block id from a
 * DIFFERENT ingest source with different content, the incoming block lands
 * as status "conflict" — a human resolves in the wiki/Pipeline.
 */
import type { StoredBlock } from "@/lib/blocks/content";
import { blockContentHash, graphHash } from "@/lib/ir/hash";
import { getBlockHistory } from "@/lib/ir/registry";
import type { BlocksmithBlockV1, BlocksmithGraphV1 } from "@/lib/ir/types";

interface StorybookEntry {
  id: string;
  title: string;
  name: string;
  importPath?: string;
  type?: string;
  tags?: string[];
}

interface StorybookIndex {
  v?: number;
  /** v4/v5 static index */
  entries?: Record<string, StorybookEntry>;
  /** v3 stories.json */
  stories?: Record<string, StorybookEntry>;
}

export interface StorybookComponent {
  blockId: string;
  title: string;
  importPath: string;
  stories: string[];
}

function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Group story entries by component title → one component block each. */
export function componentsFromStorybookIndex(
  index: StorybookIndex,
): StorybookComponent[] {
  const entries = Object.values(index.entries ?? index.stories ?? {});
  const byTitle = new Map<string, StorybookComponent>();
  for (const e of entries) {
    if (!e?.title || (e.type && e.type !== "story")) continue;
    const leaf = e.title.split("/").pop() ?? e.title;
    const blockId = `component:${slug(leaf)}`;
    const existing = byTitle.get(e.title) ?? {
      blockId,
      title: leaf,
      importPath: e.importPath ?? "",
      stories: [],
    };
    if (e.name) existing.stories.push(e.name);
    byTitle.set(e.title, existing);
  }
  return [...byTitle.values()].sort((a, b) => a.blockId.localeCompare(b.blockId));
}

function blockContent(c: StorybookComponent): Record<string, unknown> {
  return {
    role: `Storybook component — ${c.stories.length} variant${c.stories.length === 1 ? "" : "s"}`,
    importPath: c.importPath,
    stories: c.stories,
    summary: `${c.title}: ${c.stories.join(", ")}`,
    agentHint: `${c.title} has documented variants: ${c.stories.join(", ")}. Use an existing variant before inventing one.`,
  };
}

/** Compile to StoredBlocks for recordIngest(), applying the conflict rule. */
export function storedBlocksFromStorybook(
  index: StorybookIndex,
  docRef: string,
): StoredBlock[] {
  const now = new Date().toISOString();
  return componentsFromStorybookIndex(index).map((c) => {
    const content = blockContent(c);
    const incomingHash = blockContentHash(c.blockId, "component", content);

    // Conflict rule: same id, different source family, different content.
    let status: StoredBlock["status"] = "finalized";
    const history = getBlockHistory(docRef, c.blockId);
    const latest = history?.versions[history.versions.length - 1];
    if (
      latest &&
      latest.source.ingest !== "storybook" &&
      latest.contentHash !== incomingHash &&
      latest.status !== "conflict"
    ) {
      status = "conflict";
    }

    return {
      id: c.blockId,
      type: "component",
      title: c.title,
      source: { file: c.importPath || "storybook-static", ingest: "storybook" },
      updatedAt: now,
      contentHash: incomingHash,
      status,
      docRef,
      content,
    } as StoredBlock;
  });
}

/** Compile straight to a standalone blocksmith.blocks.v1 graph document. */
export function graphFromStorybook(
  index: StorybookIndex,
  docRef: string,
  systemId: string,
): BlocksmithGraphV1 {
  const now = new Date().toISOString();
  const blocks: BlocksmithBlockV1[] = componentsFromStorybookIndex(index).map(
    (c) => {
      const content = blockContent(c);
      return {
        id: c.blockId,
        type: "component",
        title: c.title,
        version: 1,
        status: "finalized",
        source: {
          file: c.importPath || "storybook-static",
          ingest: "storybook",
        },
        content,
        updatedAt: now,
        contentHash: blockContentHash(c.blockId, "component", content),
        editedBy: "ingest",
      };
    },
  );
  return {
    schema: "blocksmith.blocks.v1",
    docRef,
    systemId,
    contentHash: graphHash(blocks),
    blocks,
  };
}
