import type { ColorToken, DesignSystem, TypographyFamily } from "@/lib/blocks/types";
import { pageBackground } from "@/lib/design-tokens/resolve";
import { fontStackFromFamily } from "@/lib/fonts/font-stack";

export function buildApolloCssVars(colors: ColorToken[]): string {
  return colors
    .filter((c) => c.value.startsWith("#"))
    .map((c) => {
      const varName = c.cssVar.startsWith("--") ? c.cssVar : `--color-${c.cssVar}`;
      return `${varName}: ${c.value};`;
    })
    .join("\n  ");
}

export function getApolloCanvasColor(system: DesignSystem): string {
  return pageBackground(system.colors);
}

export function isLightColor(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length < 6) return true;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.85;
}

/** Per-family stacks for --font-* tokens from the design doc */
export function buildTypographyFontProperties(
  typography: TypographyFamily[],
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const font of typography) {
    if (!font.cssVar) continue;
    const key = font.cssVar.startsWith("--")
      ? font.cssVar
      : `--font-${font.cssVar}`;
    const kind = font.name.toLowerCase().includes("mono")
      ? "mono"
      : font.role.toLowerCase().includes("display") ||
          font.role.toLowerCase().includes("headline") ||
          font.role.toLowerCase().includes("editorial")
        ? "serif"
        : "sans";
    vars[key] = fontStackFromFamily(font, kind);
  }
  return vars;
}
