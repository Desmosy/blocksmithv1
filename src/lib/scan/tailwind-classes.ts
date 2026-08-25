import type { ScannedUtilityClass } from "./types";

const MAX_CLASSES_PER_FILE = 200;
const MAX_GLOBAL = 300;

const CLASSNAME_PATTERNS = [
  /className\s*=\s*"([^"]+)"/g,
  /className\s*=\s*'([^']+)'/g,
  /className\s*=\s*\{`([^`$]+)`\}/g,
  /className\s*=\s*\{"([^"]+)"\}/g,
  /className\s*=\s*\{'([^']+)'\}/g,
  /class\s*=\s*"([^"]+)"/g,
  /cn\(\s*["'`]([^"'`]+)["'`]/g,
];

function splitClasses(raw: string): string[] {
  return raw
    .split(/\s+/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0 && !c.includes("${") && !/^[\[{]/.test(c));
}

/** Collect Tailwind / utility classes from TSX/JSX className strings. */
export function extractUtilityClassesFromTsx(
  text: string,
  source: string,
  into: Map<string, ScannedUtilityClass>,
): void {
  let added = 0;
  for (const re of CLASSNAME_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null && added < MAX_CLASSES_PER_FILE) {
      for (const cls of splitClasses(m[1])) {
        if (cls.length > 80) continue;
        const hit = into.get(cls);
        if (hit) {
          hit.count += 1;
          if (!hit.sources.includes(source) && hit.sources.length < 4) {
            hit.sources.push(source);
          }
        } else if (into.size < MAX_GLOBAL) {
          into.set(cls, { className: cls, count: 1, sources: [source] });
          added += 1;
        }
      }
    }
  }
}

export function parseUtilityClassesTable(md: string): ScannedUtilityClass[] {
  const section = md.match(
    /### [\d.]+\s*Utility classes[^\n]*\n([\s\S]*?)(?=\n### |\n## |\n---|$)/i,
  );
  if (!section) return [];

  const rows: ScannedUtilityClass[] = [];
  for (const line of section[1].split("\n")) {
    if (!line.startsWith("|") || line.includes("---")) continue;
    const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length < 3 || /^class$/i.test(cells[0])) continue;
    const sources = cells[2]
      .split(",")
      .map((s) => s.replace(/`/g, "").trim())
      .filter(Boolean);
    rows.push({
      className: cells[0].replace(/`/g, ""),
      count: parseInt(cells[1], 10) || 1,
      sources,
    });
  }
  return rows;
}
