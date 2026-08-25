import "server-only";
import { randomBytes } from "crypto";
import { workspaceScanToMarkdown } from "@/lib/scan/to-markdown";
import { persistUploadMarkdown } from "@/lib/uploads/persist";
import type {
  ScannedColor,
  ScannedCssVar,
  WorkspaceScanResult,
} from "@/lib/scan/types";

/**
 * Create a new, empty-ish design system project from a name/prompt and open it
 * in the wiki (which is editable). Reuses the generic workspace-scan markdown
 * emitter so the scaffold is guaranteed to parse and render across every wiki
 * page. AI generation from the prompt is a future layer on top of this.
 */

const SOURCE = "starter";

/** A neutral, no-slop starter palette + scale — matches the app's own tokens. */
const STARTER_CSS_VARS: ScannedCssVar[] = [
  { name: "--color-brand", value: "#1d1c20", source: SOURCE },
  { name: "--color-surface", value: "#ffffff", source: SOURCE },
  { name: "--color-surface-subtle", value: "#f8fafc", source: SOURCE },
  { name: "--color-border", value: "#e2e9f3", source: SOURCE },
  { name: "--color-text", value: "#1d1c20", source: SOURCE },
  { name: "--color-text-muted", value: "#686562", source: SOURCE },
  { name: "--radius-sm", value: "4px", source: SOURCE },
  { name: "--radius-md", value: "8px", source: SOURCE },
  { name: "--spacing-sm", value: "8px", source: SOURCE },
  { name: "--spacing-md", value: "16px", source: SOURCE },
  { name: "--spacing-lg", value: "24px", source: SOURCE },
];

const STARTER_COLORS: ScannedColor[] = STARTER_CSS_VARS.filter((v) =>
  v.value.startsWith("#"),
).map((v) => ({ token: v.name, hex: v.value, source: SOURCE }));

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "project"
  );
}

export type CreatedProject = {
  docRef: string;
  fileName: string;
  wikiPath: string;
  name: string;
};

/**
 * Build + persist a design system project from tokens/components and open it in
 * the editable wiki. Shared by the blank starter and AI generation, so both
 * produce a guaranteed-valid, wiki-renderable design.md.
 */
export async function persistDesignProject(
  rawName: string,
  parts: {
    cssVars: ScannedCssVar[];
    colors: ScannedColor[];
    components?: import("@/lib/scan/types").ScannedComponent[];
  },
): Promise<CreatedProject> {
  const name = rawName.trim().slice(0, 80) || "Untitled Project";
  const key = `${slugify(name)}-${randomBytes(3).toString("hex")}`;
  const components = parts.components ?? [];

  const result: WorkspaceScanResult = {
    workspaceRoot: `project://${key}`,
    workspaceId: `project-${key}`,
    workspaceIdExplicit: true,
    projectName: name,
    scannedAt: new Date().toISOString(),
    gitCommit: null,
    colors: parts.colors,
    cssVars: parts.cssVars,
    cssRules: [],
    utilityClasses: [],
    components,
    excludedComponents: [],
    inventory: components.map((c) => ({
      filePath: c.filePath,
      title: c.title,
      exports: c.exports,
      featured: true,
      category: c.catalog.category,
    })),
    designDocs: [],
    scannedFiles: components.length,
    coverage: {
      scannedPaths: [`project://${key}`],
      totalFiles: components.length,
      reactFiles: components.length,
      featuredComponents: components.length,
      cssVarCount: parts.cssVars.length,
      colorCount: parts.colors.length,
      cssRuleCount: 0,
      utilityClassCount: 0,
    },
  };

  const { markdown, fileName } = workspaceScanToMarkdown(result);
  await persistUploadMarkdown(fileName, markdown);
  const docRef = `upload:${fileName}`;

  return {
    docRef,
    fileName,
    wikiPath: `/wiki?doc=${encodeURIComponent(docRef)}`,
    name,
  };
}

export async function createStarterProject(
  rawName: string,
): Promise<CreatedProject> {
  return persistDesignProject(rawName, {
    cssVars: STARTER_CSS_VARS,
    colors: STARTER_COLORS,
  });
}
