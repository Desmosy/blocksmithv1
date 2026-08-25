import type { ScannedInventoryFile } from "./types";

/** Build the full codebase inventory section (deterministic — never LLM-edited). */
export function buildInventoryMarkdown(
  inventory: ScannedInventoryFile[],
  sectionNum: number,
): string {
  const lines: string[] = [
    `## ${sectionNum}. Codebase inventory`,
    "",
    `_**${inventory.length}** React files in scanned paths — complete coverage. Featured in Component Library: ${inventory.filter((f) => f.featured).length}._`,
    "",
    "| File | Exports | Featured | Category |",
    "|------|---------|----------|----------|",
  ];

  for (const f of inventory) {
    const exports =
      f.exports.length > 0
        ? f.exports.map((e) => `\`${e}\``).join(", ")
        : "—";
    const featured = f.featured ? "yes" : "no";
    const cat = f.category.replace(/\|/g, "\\|");
    lines.push(`| \`${f.filePath}\` | ${exports} | ${featured} | ${cat} |`);
  }

  lines.push("");
  return lines.join("\n");
}

/** Ensure published .md ends with the exact deterministic inventory from scan facts. */
export function mergeInventoryIntoMarkdown(
  curatedMd: string,
  inventory: ScannedInventoryFile[],
): string {
  if (!inventory.length) return curatedMd;

  const stripped = curatedMd
    .replace(/## [\d.]+\. Codebase inventory[\s\S]*$/im, "")
    .trimEnd();

  const sectionNum = (stripped.match(/^## \d+\./gm) ?? []).length + 1;
  return `${stripped}\n\n${buildInventoryMarkdown(inventory, sectionNum)}`;
}
