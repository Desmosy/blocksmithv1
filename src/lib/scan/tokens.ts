import type {
  ColorToken,
  SpacingToken,
  SurfaceRow,
} from "@/lib/blocks/types";
import type { ScannedCssVar } from "./types";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeHex(raw: string): string | null {
  const m = raw.match(/#([0-9a-fA-F]{3,8})\b/);
  if (!m) return null;
  let h = m[1].toLowerCase();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 8) h = h.slice(0, 6);
  return h.length === 6 ? `#${h}` : null;
}

function humanTokenName(cssVar: string): string {
  return cssVar
    .replace(/^--/, "")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function colorGroup(cssVar: string): string {
  if (/--wiki-/i.test(cssVar)) return "Wiki chrome";
  if (/--color-/i.test(cssVar)) return "Palette";
  if (/--surface/i.test(cssVar)) return "Surfaces";
  if (/--text/i.test(cssVar)) return "Text";
  if (/--bg/i.test(cssVar)) return "Backgrounds";
  return "Design tokens";
}

/** CSS variable definitions that resolve to colors — the designer-facing palette. */
export function designerColorTokens(cssVars: ScannedCssVar[]): ColorToken[] {
  const seen = new Set<string>();
  const out: ColorToken[] = [];

  for (const v of cssVars) {
    const hex = normalizeHex(v.value);
    if (!hex) continue;
    if (seen.has(v.name)) continue;
    seen.add(v.name);
    out.push({
      name: humanTokenName(v.name),
      value: hex,
      cssVar: v.name,
      role: `Defined in \`${v.source}\``,
      group: colorGroup(v.name),
    });
  }

  return out.sort((a, b) => a.cssVar.localeCompare(b.cssVar));
}

export function designerSurfaces(cssVars: ScannedCssVar[]): SurfaceRow[] {
  const byName = new Map(cssVars.map((v) => [v.name, v]));
  const pick = (name: string, label: string, purpose: string, level: string) => {
    const row = byName.get(name);
    const hex = row ? normalizeHex(row.value) : null;
    if (!hex) return null;
    return { level, name: label, value: hex, purpose };
  };

  const rows = [
    pick("--wiki-bg", "Background", "Page canvas", "0"),
    pick("--wiki-sidebar", "Sidebar", "Panels and elevated areas", "1"),
    pick("--wiki-active", "Active", "Hover and selected states", "2"),
    pick("--wiki-border", "Border", "Dividers and outlines", "border"),
    pick("--wiki-text", "Text", "Primary content", "text"),
    pick("--wiki-muted", "Muted", "Secondary labels", "muted"),
    pick("--wiki-accent", "Accent", "CTAs and emphasis", "accent"),
  ].filter((r): r is SurfaceRow => !!r);

  return rows;
}

export function designerSpacing(cssVars: ScannedCssVar[]): SpacingToken[] {
  const out: SpacingToken[] = [];
  for (const v of cssVars) {
    if (!/--(?:wiki-|spacing|radius|gap|padding|margin)/i.test(v.name)) continue;
    if (!/\d/.test(v.value)) continue;
    out.push({
      name: humanTokenName(v.name),
      value: v.value.trim(),
      token: v.name,
    });
  }
  return out.sort((a, b) => a.token.localeCompare(b.token));
}

export function designerBorderRadius(
  cssVars: ScannedCssVar[],
): { element: string; value: string }[] {
  return cssVars
    .filter((v) => /radius/i.test(v.name))
    .map((v) => ({
      element: humanTokenName(v.name),
      value: v.value.trim(),
    }));
}

export type ParsedScanCssVar = {
  name: string;
  value: string;
  source: string;
};

export function parseCssVarTable(md: string): ParsedScanCssVar[] {
  const section = md.match(
    /### [\d.]+\s*CSS variables[^\n]*\n([\s\S]*?)(?=\n### |\n## |\n---|$)/i,
  );
  if (!section) return [];

  const vars: ParsedScanCssVar[] = [];
  for (const line of section[1].split("\n")) {
    if (!line.startsWith("|") || line.includes("---")) continue;
    const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length < 3 || /^token$/i.test(cells[0])) continue;
    vars.push({
      name: cells[0].replace(/`/g, ""),
      value: cells[1],
      source: cells[2].replace(/`/g, ""),
    });
  }
  return vars;
}
