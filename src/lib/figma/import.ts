import { workspaceScanToMarkdown } from "@/lib/scan/to-markdown";
import type {
  ScannedColor,
  ScannedCssVar,
  WorkspaceScanResult,
} from "@/lib/scan/types";
import {
  asColor,
  asDimension,
  figmaNameToCssVar,
  normalizeFigmaVariables,
} from "./normalize";
import {
  figmaComponentsToScanned,
  normalizeFigmaComponents,
} from "./components";
import { figmaDesignContextToTokens } from "./adapter";
import type {
  FigmaImportInput,
  FigmaImportSummary,
  FigmaVariable,
} from "./types";
import type { ScannedComponent } from "@/lib/scan/types";

export type FigmaImportResult = {
  markdown: string;
  fileName: string;
  /** Figma tokens as scan CSS vars — feed straight into drift comparison. */
  cssVars: ScannedCssVar[];
  colors: ScannedColor[];
  components: ScannedComponent[];
  summary: FigmaImportSummary;
};

/** Tokenize Figma variables into the scan's CSS-var + color shapes. */
export function figmaVariablesToTokens(
  vars: FigmaVariable[],
  sourceLabel: string,
): { cssVars: ScannedCssVar[]; colors: ScannedColor[]; skipped: number } {
  const cssVars: ScannedCssVar[] = [];
  const colors: ScannedColor[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (const v of vars) {
    const name = figmaNameToCssVar(v.name);
    if (!name || name === "--" || seen.has(name)) {
      skipped += 1;
      continue;
    }
    const hex = asColor(v);
    const dim = hex ? null : asDimension(v);
    const value = hex ?? dim;
    if (!value) {
      skipped += 1;
      continue;
    }
    seen.add(name);
    cssVars.push({ name, value, source: sourceLabel });
    if (hex) colors.push({ token: name, hex, source: sourceLabel });
  }

  return { cssVars, colors, skipped };
}

function buildFigmaScanResult(
  input: FigmaImportInput,
  cssVars: ScannedCssVar[],
  colors: ScannedColor[],
  components: ScannedComponent[],
): WorkspaceScanResult {
  const fileKey = input.fileKey?.trim() || "file";
  const projectName =
    input.projectName?.trim() ||
    input.fileName?.trim() ||
    "Figma Library";

  return {
    workspaceRoot: `figma://${fileKey}`,
    workspaceId: `figma-${fileKey}`,
    workspaceIdExplicit: true,
    projectName,
    scannedAt: new Date().toISOString(),
    gitCommit: null,
    colors,
    cssVars,
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
      scannedPaths: [`figma://${fileKey}`],
      totalFiles: components.length,
      reactFiles: components.length,
      featuredComponents: components.length,
      cssVarCount: cssVars.length,
      colorCount: colors.length,
      cssRuleCount: 0,
      utilityClassCount: 0,
    },
  };
}

/**
 * Import Figma variables into a design.md. Reuses the workspace-scan markdown
 * emitter so the existing wiki, parser, and governance render it for free —
 * tokens carry `source: figma:<fileKey>` so their origin is traceable.
 */
export function importFigmaVariables(
  input: FigmaImportInput,
): FigmaImportResult {
  const fileKey = input.fileKey?.trim() || "file";
  const sourceLabel = `figma:${fileKey}`;
  // Real variables first so they win the first-wins dedupe over inferred tokens.
  const realVars = normalizeFigmaVariables(input.variables ?? {});
  const inferredVars = input.designContextCode
    ? Object.entries(figmaDesignContextToTokens(input.designContextCode)).map(
        ([name, value]) => ({ name, value }),
      )
    : [];
  const { cssVars, colors, skipped } = figmaVariablesToTokens(
    [...realVars, ...inferredVars],
    sourceLabel,
  );
  const components = input.components
    ? figmaComponentsToScanned(
        normalizeFigmaComponents(input.components),
        sourceLabel,
      )
    : [];

  const result = buildFigmaScanResult(input, cssVars, colors, components);
  const { markdown, fileName } = workspaceScanToMarkdown(result);

  return {
    markdown,
    fileName,
    cssVars,
    colors,
    components,
    summary: {
      projectName: result.projectName,
      fileKey,
      cssVars: cssVars.length,
      colors: colors.length,
      dimensions: cssVars.length - colors.length,
      components: components.length,
      skipped,
    },
  };
}
