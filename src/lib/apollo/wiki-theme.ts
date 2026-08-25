import type { DesignSystem } from "@/lib/blocks/types";
import { compileWikiChrome } from "@/lib/design-ir/compile";

/** @deprecated Prefer ensureDesignIR + ir.wikiChrome — kept for callers without IR */
export function buildWikiThemeStyle(
  system: DesignSystem,
): Record<string, string> {
  return compileWikiChrome(
    system as DesignSystem & { mode: "apollo" | "generic"; theme: string },
  );
}

export const VISUALIZE_STORAGE_KEY = "blocksmith-visualize";

export function visualizeKey(fileName: string): string {
  return `${VISUALIZE_STORAGE_KEY}:${fileName}`;
}
