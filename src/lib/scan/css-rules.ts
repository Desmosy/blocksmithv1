import type { ScannedCssRule } from "./types";

const MAX_RULES_PER_FILE = 80;
const MAX_SELECTOR_LEN = 140;
const MAX_DECL_LEN = 220;

/** UI-relevant selectors (classes, elements, pseudo) — skip @keyframes noise when possible. */
function isUsefulSelector(selector: string): boolean {
  const s = selector.trim();
  if (!s || s.startsWith("@")) return false;
  if (/^::?-(webkit|moz|ms)/i.test(s)) return false;
  if (/^(html|body|\*|:root)$/i.test(s)) return true;
  if (/^\.[\w-]/.test(s)) return true;
  if (/^(button|a|h[1-6]|p|nav|header|footer|section|main|input|label)\b/i.test(s)) {
    return true;
  }
  if (/::?(before|after|hover|focus|active)/i.test(s)) return true;
  return /\.(btn|button|nav|hero|card|link|header|footer|section|title|text|font|primary|secondary|cta|chip|badge|menu|modal|dialog)/i.test(
    s,
  );
}

/**
 * Extract class/element rules from CSS/SCSS for Foundation → Styles wiki page.
 */
export function extractCssRules(text: string, source: string): ScannedCssRule[] {
  const cleaned = text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  const rules: ScannedCssRule[] = [];
  const re = /([^{}@/][^{]*)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null && rules.length < MAX_RULES_PER_FILE) {
    const selector = m[1].trim().replace(/\s+/g, " ");
    const declarations = m[2].trim().replace(/\s+/g, " ");
    if (!isUsefulSelector(selector)) continue;
    if (!declarations) continue;
    rules.push({
      selector: selector.slice(0, MAX_SELECTOR_LEN),
      declarations: declarations.slice(0, MAX_DECL_LEN),
      source,
    });
  }
  return rules;
}

export function parseCssRulesTable(
  md: string,
): ScannedCssRule[] {
  const section = md.match(
    /### [\d.]+\s*CSS (?:classes|styles)[^\n]*\n([\s\S]*?)(?=\n### |\n## |\n---|$)/i,
  );
  if (!section) return [];

  const rules: ScannedCssRule[] = [];
  for (const line of section[1].split("\n")) {
    if (!line.startsWith("|") || line.includes("---")) continue;
    const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length < 3 || /^selector$/i.test(cells[0])) continue;
    rules.push({
      selector: cells[0].replace(/`/g, ""),
      declarations: cells[1].replace(/`/g, ""),
      source: cells[2].replace(/`/g, ""),
    });
  }
  return rules;
}
