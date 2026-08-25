import type { DesignIR } from "@/lib/design-ir/schema";

/** Preview colors — read only from compiled Design IR (P1). */
export function previewFromIR(ir: DesignIR) {
  return ir.preview;
}

export function previewAccentColor(ir: DesignIR): string {
  return ir.preview.accent;
}

export function previewPageBackground(ir: DesignIR): string {
  return ir.preview.pageBackground;
}

export function previewCardBackground(ir: DesignIR): string {
  return ir.preview.cardBackground;
}

export function previewBorderColor(ir: DesignIR): string {
  return ir.preview.border;
}

export function previewTextColor(ir: DesignIR): string {
  return ir.preview.text;
}

export function radiusForElement(ir: DesignIR, elementMatch: RegExp): string {
  const row = ir.tokens.borderRadius.find((r) => elementMatch.test(r.element));
  return row?.value ?? ir.preview.cardRadius;
}

export function spacingBaseUnitLabel(ir: DesignIR): string {
  const four = ir.tokens.spacing.find(
    (s) => s.name === "4" || s.token.includes("spacing-4"),
  );
  if (four?.value === "4px") return "4px";
  return ir.tokens.spacing[0]?.value ?? "4px";
}
