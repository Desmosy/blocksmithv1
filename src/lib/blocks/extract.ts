import "server-only";

import { createHash } from "crypto";
import type { LoadedDesignSystem } from "@/lib/clients/registry";
import type { BlockContent, StoredBlock } from "./content";

function slugFromCssVar(cssVar: string): string {
  return cssVar.replace(/^--/, "").replace(/^color-/, "");
}

function hashSlice(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

function block(
  partial: Omit<StoredBlock, "updatedAt" | "contentHash" | "status" | "docRef"> & {
    docRef: string;
    systemHash: string;
    updatedAt: string;
    status?: StoredBlock["status"];
  },
): StoredBlock {
  const contentHash = hashSlice(
    `${partial.id}:${partial.type}:${JSON.stringify(partial.content)}`,
  );
  return {
    ...partial,
    status: partial.status ?? "finalized",
    contentHash,
    updatedAt: partial.updatedAt,
    docRef: partial.docRef,
  };
}

/**
 * Derives addressable blocks from a parsed design system.
 * IDs are stable for MCP + wiki (e.g. component:primary-pill-button-filled).
 */
export function blocksFromDesignSystem(
  system: LoadedDesignSystem,
  docRef: string,
): StoredBlock[] {
  const blocks: StoredBlock[] = [];
  const systemHash = system.contentHash ?? hashSlice(docRef);
  const updatedAt = system.updatedAt;
  const sourceFile = system.sourcePath;

  for (const c of system.colors) {
    const slug = slugFromCssVar(c.cssVar);
    blocks.push(
      block({
        id: `token:color:${slug}`,
        type: "token",
        title: c.name,
        source: { file: sourceFile },
        docRef,
        systemHash,
        updatedAt,
        content: {
          summary: c.role,
          value: c.value,
          cssVar: c.cssVar,
          group: c.group,
          agentHint: `Use ${c.name} (${c.cssVar}) ${c.value} for ${c.role}`,
        },
      }),
    );
  }

  for (const t of system.typography) {
    const slug = t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    blocks.push(
      block({
        id: `token:typography:${slug}`,
        type: "token",
        title: t.name,
        source: { file: sourceFile },
        docRef,
        systemHash,
        updatedAt,
        content: {
          summary: t.role,
          cssVar: t.cssVar,
          agentHint: `${t.name}: ${t.substitute} — ${t.role}`,
          description: `Weights: ${t.weights}. Sizes: ${t.sizes}.`,
        },
      }),
    );
  }

  for (const s of system.spacing) {
    blocks.push(
      block({
        id: `token:spacing:${s.token.replace(/^--/, "")}`,
        type: "token",
        title: s.name,
        source: { file: sourceFile },
        docRef,
        systemHash,
        updatedAt,
        content: {
          value: s.value,
          cssVar: s.token,
          agentHint: `Spacing ${s.name}: ${s.value}`,
        },
      }),
    );
  }

  for (const s of system.surfaces) {
    blocks.push(
      block({
        id: `token:surface:${s.level}`,
        type: "token",
        title: s.name,
        source: { file: sourceFile },
        docRef,
        systemHash,
        updatedAt,
        content: {
          summary: s.purpose,
          value: s.value,
          agentHint: `Surface L${s.level} ${s.name}: ${s.value}`,
        },
      }),
    );
  }

  for (const c of system.components) {
    blocks.push(
      block({
        id: `component:${c.id}`,
        type: "component",
        title: c.title,
        source: { file: sourceFile },
        docRef,
        systemHash,
        updatedAt,
        content: {
          role: c.role,
          description: c.description,
          summary: c.role,
          agentHint: c.role || c.title,
        },
      }),
    );
  }

  if (system.dos.length) {
    blocks.push(
      block({
        id: "guideline:dos",
        type: "guideline",
        title: "Do's",
        source: { file: sourceFile },
        docRef,
        systemHash,
        updatedAt,
        content: { items: system.dos, agentHint: "Follow these do's for UI work." },
      }),
    );
  }

  if (system.donts.length) {
    blocks.push(
      block({
        id: "guideline:donts",
        type: "guideline",
        title: "Don'ts",
        source: { file: sourceFile },
        docRef,
        systemHash,
        updatedAt,
        content: {
          items: system.donts,
          agentHint: "Never violate these don'ts.",
        },
      }),
    );
  }

  if (system.agentGuide?.trim()) {
    blocks.push(
      block({
        id: "agent-rule:guide",
        type: "agent-rule",
        title: "Agent Prompt Guide",
        source: { file: sourceFile },
        docRef,
        systemHash,
        updatedAt,
        content: {
          text: system.agentGuide,
          agentHint: system.agentGuide.slice(0, 280),
        },
      }),
    );
  }

  // Introduction is an addressable, editable block on structured/scan docs so
  // the wiki can stage name/tagline/overview edits like any token. Generic mode
  // already emits page:<section.id> blocks below, so skip it there.
  if (
    system.mode !== "generic" &&
    (system.name || system.overview || system.tagline)
  ) {
    blocks.push(
      block({
        id: "page:introduction",
        type: "page",
        title: system.name || "Introduction",
        source: { file: sourceFile },
        docRef,
        systemHash,
        updatedAt,
        status: "draft",
        content: {
          name: system.name,
          tagline: system.tagline,
          overview: system.overview,
          summary: system.tagline || system.name,
          agentHint: `${system.name}: ${system.tagline || system.overview?.slice(0, 120) || ""}`,
        },
      }),
    );
  }

  if (system.mode === "generic" && system.sections?.length) {
    for (const section of system.sections) {
      blocks.push(
        block({
          id: `page:${section.id}`,
          type: "page",
          title: section.title,
          source: { file: sourceFile },
          docRef,
          systemHash,
          updatedAt,
          status: "draft",
          content: {
            text: section.content,
            summary: section.title,
          },
        }),
      );
    }
  }

  return blocks;
}
