import type { AiLayoutResponse } from "@/lib/ai/layout-schema";
import type { DesignIR } from "@/lib/design-ir/schema";
import { enforceChromeLegibility } from "@/lib/design-ir/color-utils";

const WIKI_KEYS = new Set([
  "--wiki-bg",
  "--wiki-sidebar",
  "--wiki-border",
  "--wiki-text",
  "--wiki-muted",
  "--wiki-active",
  "--wiki-accent",
  "--wiki-font",
  "--wiki-display-font",
  "--wiki-label-font",
  "--wiki-content-max",
  "--wiki-radius",
  "--wiki-radius-card",
  "--wiki-nav-bg",
  "--wiki-nav-text",
  "--wiki-nav-muted",
  "--wiki-nav-radius",
  "--wiki-cta-on-accent",
  "--wiki-sidebar-width",
  "--wiki-card-shadow",
  "--wiki-card-border",
  "--wiki-cta-fill",
  "--wiki-cta-border",
  "--wiki-heading-tracking",
  "--wiki-body-tracking",
  "--wiki-font-features",
  "--wiki-nav-divider",
  "--wiki-elevated-shadow",
]);

function paletteValues(ir: DesignIR): Set<string> {
  const values = new Set<string>();
  for (const v of Object.values(ir.colorVariables)) {
    if (v.startsWith("#")) values.add(v.toLowerCase());
  }
  for (const c of ir.tokens.colors) {
    if (c.value.startsWith("#")) values.add(c.value.toLowerCase());
  }
  for (const v of Object.values(ir.wikiChrome.cssVariables)) {
    if (v.startsWith("#")) values.add(v.toLowerCase());
  }
  return values;
}

/**
 * Merge AI chrome only when values match the parsed token graph (no invented hex).
 */
export function mergeValidatedAiChrome(
  ir: DesignIR,
  ai?: AiLayoutResponse | null,
): Record<string, string> {
  const base = {
    ...ir.wikiChrome.cssVariables,
    ...ir.colorVariables,
    ...ir.fontStacks,
  };
  if (!ai?.cssVariables) return base;

  const allowed = paletteValues(ir);

  for (const [key, value] of Object.entries(ai.cssVariables)) {
    if (!value?.trim()) continue;

    if (key.startsWith("--color-")) {
      const canonical = ir.colorVariables[key];
      if (canonical && canonical.toLowerCase() === value.toLowerCase()) {
        base[key] = canonical;
      }
      continue;
    }

    if (!WIKI_KEYS.has(key) && !key.startsWith("--font-")) continue;

    if (key.includes("font") || key.includes("radius") || key.includes("max")) {
      base[key] = value;
      continue;
    }

    if (value.startsWith("#") && allowed.has(value.toLowerCase())) {
      base[key] = value;
    }
  }

  if (ai.layout?.contentMaxWidth) {
    base["--wiki-content-max"] = ai.layout.contentMaxWidth;
  }
  if (ai.layout?.borderRadius) {
    base["--wiki-radius"] = ai.layout.borderRadius;
  }

  // The AI may legally re-assign a palette color to a text/surface role; keep
  // every pairing legible so a model swap can never produce an unreadable theme.
  return enforceChromeLegibility(base);
}
