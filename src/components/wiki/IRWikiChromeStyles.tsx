import type { DesignIR } from "@/lib/design-ir/schema";

/**
 * Token vars for in-page previews only (swatches, specimens).
 * Full wiki chrome (--wiki-*) is applied only when Visualize is on.
 */
export function IRWikiChromeStyles({ ir }: { ir: DesignIR }) {
  const colorLines = Object.entries(ir.colorVariables)
    .filter(([, v]) => v?.trim())
    .map(([key, value]) => `  ${key}: ${value};`)
    .join("\n");

  const fontLines = Object.entries(ir.fontStacks)
    .filter(([, v]) => v?.trim())
    .map(([key, value]) => `  ${key}: ${value};`)
    .join("\n");

  if (!colorLines && !fontLines) return null;

  return (
    <style
      id="blocksmith-ir-tokens"
      dangerouslySetInnerHTML={{
        __html: `.design-preview,\n.apollo-preview {\n${[colorLines, fontLines].filter(Boolean).join("\n")}\n}`,
      }}
    />
  );
}
