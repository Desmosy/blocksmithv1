import type {
  ColorToken,
  SpacingToken,
  TypographyFamily,
  TypeScaleRow,
} from "@/lib/blocks/types";
import { parseHexColor } from "@/lib/parser/normalize";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Comprehensive wiki docs embed tokens in pipe tables — extract for IR/visualize. */
export function extractWikiTokens(md: string): {
  colors: ColorToken[];
  spacing: SpacingToken[];
  borderRadius: { element: string; value: string }[];
  typography: TypographyFamily[];
  typeScale: TypeScaleRow[];
} {
  const colors: ColorToken[] = [];
  const spacing: SpacingToken[] = [];
  const borderRadius: { element: string; value: string }[] = [];
  const typography: TypographyFamily[] = [];
  const typeScale: TypeScaleRow[] = [];
  const seenColor = new Set<string>();

  for (const line of md.split("\n")) {
    if (!line.startsWith("|") || line.includes("---")) continue;
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length < 2) continue;

    const lower = cells.map((c) => c.toLowerCase()).join(" ");
    const name = cells[0].replace(/`/g, "").trim();
    if (/^(name|token|role|element|size|hex|value|usage|context)$/i.test(name)) {
      continue;
    }

    const hexCell = cells.find((c) => /#[0-9a-fA-F]{3,8}/.test(c));
    const hex = hexCell ? parseHexColor(hexCell.replace(/`/g, "")) : null;
    if (hex && !seenColor.has(hex)) {
      seenColor.add(hex);
      const cssVar = name.startsWith("--")
        ? name
        : `--color-${slugify(name)}`;
      colors.push({
        name,
        value: hex,
        cssVar,
        role: cells[cells.length - 1] ?? "",
        group: "WIKI",
      });
    }

    const valueCell = cells.find((c) => /px|rem|em/.test(c)) ?? cells[1];
    const pxMatch = valueCell?.match(/(\d+(?:\.\d+)?)\s*px/);
    if (pxMatch && /spacing/i.test(name + lower)) {
      spacing.push({
        name,
        value: `${pxMatch[1]}px`,
        token: name.startsWith("spacing") ? name : `spacing-${slugify(name)}`,
      });
    }

    if (pxMatch && /radius/i.test(name + lower)) {
      borderRadius.push({
        element: name,
        value: `${pxMatch[1]}px`,
      });
    }

    if (
      cells.length >= 3 &&
      (lower.includes("token") || lower.includes("name")) &&
      lower.includes("value")
    ) {
      // handled above via hex/name scan
    }

    if (cells.length >= 4 && /role.*size|size.*line height/i.test(lower)) {
      const role = cells[0];
      if (/^role$/i.test(role)) continue;
      typeScale.push({
        role,
        size: cells[1]?.match(/\d+/)?.[0] ? cells[1] : cells[1] ?? "",
        lineHeight: cells[2] ?? "",
        letterSpacing: cells[3] ?? "",
        token: cells[4]?.replace(/`/g, "") ?? slugify(role),
      });
    }
  }

  const fontHeading = md.match(
    /###\s+([^\n]+)\s+—\s+[^·\n]+·\s*`(--font-[^`]+)`/,
  );
  if (fontHeading) {
    typography.push({
      name: fontHeading[1].trim(),
      cssVar: fontHeading[2],
      substitute: "Inter, ui-sans-serif, system-ui, sans-serif",
      weights: "400, 500, 600, 700",
      sizes: "12px–48px",
      lineHeight: "1.5",
      letterSpacing: "normal",
      role: "display",
    });
  }

  return { colors, spacing, borderRadius, typography, typeScale };
}
