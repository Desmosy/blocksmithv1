/**
 * Load design doc for AI Lab CLI/scripts (no server-only / registry).
 */
import { readFileSync } from "fs";
import { join, basename, normalize, relative } from "path";
import { parseApolloMarkdown } from "@/lib/parser/apollo";
import {
  isApolloStructuredMarkdown,
  isComprehensiveWikiMarkdown,
  parseGenericMarkdown,
} from "@/lib/parser/generic";
import type { DesignSystem } from "@/lib/blocks/types";

export type AiLabLoadedSystem = DesignSystem & {
  mode: "apollo" | "generic";
  contentHash?: string;
};
import {
  isUploadDocRef,
  uploadFileNameFromRef,
  resolveUploadPath,
} from "@/lib/uploads/store";

const DESIGNS_ROOT = join(process.cwd(), "docs/designs.md");

function safeResolveRepoDoc(fileName: string): string {
  const normalized = normalize(fileName).replace(/^(\.\.(\/|\\|$))+/, "");
  if (normalized.includes("..")) throw new Error("Invalid document name");
  const full = join(DESIGNS_ROOT, normalized);
  const rel = relative(DESIGNS_ROOT, full);
  if (rel.startsWith("..")) throw new Error("Path escapes designs directory");
  return full;
}

export function resolveDocMarkdownPath(docRef: string): string {
  if (isUploadDocRef(docRef)) {
    return resolveUploadPath(uploadFileNameFromRef(docRef));
  }
  return safeResolveRepoDoc(basename(docRef));
}

export function loadDocForAiLab(docRef: string): {
  system: AiLabLoadedSystem;
  markdown: string;
} {
  const path = resolveDocMarkdownPath(docRef);
  const markdown = readFileSync(path, "utf-8");
  const displayName = isUploadDocRef(docRef)
    ? uploadFileNameFromRef(docRef)
    : basename(docRef);

  const useApollo =
    !isComprehensiveWikiMarkdown(markdown) &&
    (isApolloStructuredMarkdown(markdown) ||
      basename(displayName).toLowerCase() === "apollo.md");

  const system = (
    useApollo
      ? parseApolloMarkdown(markdown, path)
      : parseGenericMarkdown(markdown, path, displayName)
  ) as DesignSystem;

  return {
    system: {
      ...system,
      mode: useApollo ? "apollo" : "generic",
      contentHash: "cli",
      updatedAt: new Date().toISOString(),
    },
    markdown,
  };
}
