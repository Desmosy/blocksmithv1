import type { LoadedDesignSystem } from "@/lib/clients/registry";
import type { FontResolutionMap } from "@/lib/fonts/font-resolve";
import { compileFontStacksWithResolutions } from "@/lib/fonts/font-resolve";
import {
  DESIGN_IR_COMPILER_REV,
  DESIGN_IR_VERSION,
  type DesignIR,
  tokensFromSystem,
} from "@/lib/design-ir/schema";
import {
  compileSemanticWikiChrome,
  semanticPreviewFromChrome,
} from "@/lib/design-ir/semantic-resolve";

export { compileSemanticWikiChrome as compileWikiChrome };

export function compilePreviewTokens(
  wikiChrome: Record<string, string>,
  system: LoadedDesignSystem,
): DesignIR["preview"] {
  return semanticPreviewFromChrome(wikiChrome, system);
}

export function compileColorVariables(
  system: LoadedDesignSystem,
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const color of system.colors) {
    const key = color.cssVar.startsWith("--")
      ? color.cssVar
      : `--color-${color.cssVar}`;
    vars[key] = color.value;
  }
  return vars;
}

export function compileFontStacks(
  system: LoadedDesignSystem,
  fontResolutions?: FontResolutionMap,
): Record<string, string> {
  return compileFontStacksWithResolutions(
    system.typography,
    fontResolutions,
  );
}

/**
 * Compile Design IR from parsed markdown only — no brand-specific rules.
 * Wiki chrome semantics come from tables + roles; AI refines on visualize (validated).
 */
export function compileDesignIR(
  docRef: string,
  system: LoadedDesignSystem,
): DesignIR {
  const wikiChrome = compileSemanticWikiChrome(system);
  const colorVariables = compileColorVariables(system);
  const fontStacks = compileFontStacks(system);

  return {
    version: DESIGN_IR_VERSION,
    compilerRev: DESIGN_IR_COMPILER_REV,
    docRef,
    systemId: system.id,
    systemName: system.name,
    contentHash: system.contentHash ?? "",
    updatedAt: system.updatedAt,
    sourcePath: system.sourcePath,
    mode: system.mode,
    theme: system.theme,
    tokens: tokensFromSystem(system),
    wikiChrome: { cssVariables: wikiChrome },
    preview: compilePreviewTokens(wikiChrome, system),
    fontStacks,
    colorVariables,
  };
}

export { flattenIRToCssProperties } from "@/lib/design-ir/flatten";
