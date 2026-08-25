import type { ColorToken, ComponentDoc, DesignSystem, TypographyFamily } from "@/lib/blocks/types";
import type { DesignIR } from "@/lib/design-ir/schema";

export type PreviewTokens = DesignIR["preview"];

export type ComponentPreviewContext = {
  preview: PreviewTokens;
  colors: ColorToken[];
  colorVariables: Record<string, string>;
  fontStacks: Record<string, string>;
  borderRadius: { element: string; value: string }[];
  typography: TypographyFamily[];
};

export function buildPreviewContextFromIR(ir: DesignIR): ComponentPreviewContext {
  return {
    preview: ir.preview,
    colors: ir.tokens.colors,
    colorVariables: ir.colorVariables,
    fontStacks: ir.fontStacks,
    borderRadius: ir.tokens.borderRadius,
    typography: ir.tokens.typography,
  };
}

/** Fallback when IR provider is unavailable (e.g. tests). */
export function buildPreviewContextFromSystem(system: DesignSystem): ComponentPreviewContext {
  return {
    preview: {
      accent: "var(--wiki-accent, #1a1a1a)",
      pageBackground: "var(--wiki-bg, #ffffff)",
      cardBackground: "var(--wiki-sidebar, #fafafa)",
      border: "var(--wiki-border, #e5e7eb)",
      text: "var(--wiki-text, #1a1a1a)",
      buttonRadius: "var(--wiki-radius, 8px)",
      cardRadius: "var(--wiki-radius-card, 8px)",
    },
    colors: system.colors,
    colorVariables: Object.fromEntries(
      system.colors.map((c) => [
        c.cssVar.startsWith("--") ? c.cssVar : `--color-${c.cssVar}`,
        c.value,
      ]),
    ),
    fontStacks: {},
    borderRadius: system.borderRadius ?? [],
    typography: system.typography,
  };
}

export function componentCorpus(component: ComponentDoc): string {
  return `${component.title}\n${component.role}\n${component.description}`;
}
