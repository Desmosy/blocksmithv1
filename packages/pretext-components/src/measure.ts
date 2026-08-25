import { layout, prepare, type LayoutResult } from "@chenglou/pretext";

export type MeasureInput = {
  text: string;
  fontFamily: string;
  fontSize: string;
  fontWeight?: string;
  lineHeight: string;
  letterSpacing?: string;
  maxWidth: number;
};

/** CSS font shorthand for Pretext — avoid system-ui (macOS width drift). */
export function pretextFontString(input: MeasureInput): string {
  const weight = input.fontWeight?.replace(/[^\d]/g, "") || "400";
  const size = input.fontSize.trim();
  const family = input.fontFamily.trim() || "Inter";
  return `${weight} ${size} ${family}`;
}

export function lineHeightPx(fontSize: string, lineHeight: string): number {
  const size = parseFloat(fontSize);
  if (!Number.isFinite(size)) return 24;
  const lh = lineHeight.trim();
  if (lh.endsWith("px")) return parseFloat(lh) || size * 1.5;
  const ratio = parseFloat(lh);
  return Number.isFinite(ratio) ? size * ratio : size * 1.5;
}

export function measureText(input: MeasureInput): LayoutResult {
  const font = pretextFontString(input);
  const letterSpacing = input.letterSpacing
    ? parseFloat(input.letterSpacing.replace(/em$/, "")) *
        parseFloat(input.fontSize)
    : undefined;

  const prepared = prepare(input.text, font, {
    letterSpacing: Number.isFinite(letterSpacing) ? letterSpacing : undefined,
  });

  return layout(
    prepared,
    Math.max(40, input.maxWidth),
    lineHeightPx(input.fontSize, input.lineHeight),
  );
}
