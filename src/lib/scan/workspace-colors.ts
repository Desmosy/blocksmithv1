import type { ColorToken } from "@/lib/blocks/types";
import { parseHexColor } from "@/lib/parser/normalize";
import type { ScannedCssVar } from "./types";
import { designerColorTokens } from "./tokens";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Hex table from workspace scan markdown: | Hex | Occurrences | Sources | */
export function parseWorkspaceHexColors(md: string): ColorToken[] {
  const section = md.match(
    /### [\d.]+\s*Colors \(hex found[^\n]*\n([\s\S]*?)(?=\n### |\n## |\n---|$)/i,
  );
  if (!section) return [];

  const out: ColorToken[] = [];
  for (const line of section[1].split("\n")) {
    if (!line.startsWith("|") || line.includes("---")) continue;
    const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length < 2 || /^hex$/i.test(cells[0])) continue;
    const hex = parseHexColor(cells[0]);
    if (!hex) continue;
    const sources = cells[2]?.replace(/`/g, "") ?? "scanned files";
    const slug = slugify(hex.replace("#", ""));
    out.push({
      name: hex,
      value: hex,
      cssVar: `--color-${slug}`,
      role: `Found in ${sources}`,
      group: "SCANNED",
    });
  }
  return out;
}

export function mergeScanColorTokens(
  cssVars: ScannedCssVar[],
  md: string,
): ColorToken[] {
  const fromVars = designerColorTokens(cssVars);
  const fromHex = parseWorkspaceHexColors(md);
  const seen = new Set<string>();
  const merged: ColorToken[] = [];

  for (const c of [...fromVars, ...fromHex]) {
    const key = c.value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(c);
  }
  return merged.sort((a, b) => a.value.localeCompare(b.value));
}
