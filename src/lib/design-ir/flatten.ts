import type { DesignIR } from "@/lib/design-ir/schema";

/** Flat CSS map for document.documentElement (chrome + colors + fonts). Client-safe. */
export function flattenIRToCssProperties(ir: DesignIR): Record<string, string> {
  return {
    ...ir.wikiChrome.cssVariables,
    ...ir.colorVariables,
    ...ir.fontStacks,
  };
}
