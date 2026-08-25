/**
 * Tier-2 prose governance — heuristics compiled from promoted component rules.
 * Warn-tier only; pair with color-lint for block-tier.
 */
import type { ComponentDoc } from "@/lib/blocks/types";
import type { GovernanceFinding, GovernanceTier } from "./types";

export type ProseRule = {
  id: string;
  tier: GovernanceTier;
  label: string;
  citation: string;
  test: (line: string, lineNo: number) => GovernanceFinding | null;
};

const INACTIVE_LINK =
  /href\s*=\s*(?:\{\s*)?["'](#|javascript:void|"")["']|href\s*=\s*#\s*[/>]/i;
const STALE_YEAR = /\b(19\d{2}|20[0-2]\d)\b/;
const STALE_CONTEXT =
  /(?:©|copyright|closed|since|est\.|founded|until|deprecated|legacy|old)/i;
const STALE_ADDRESS =
  /\b(?:old|former|closed|deprecated|legacy|inactive)\b.{0,48}\b(?:road|street|st\.|avenue|ave\.|office|address|building|hq|headquarters)\b/i;

function lineFinding(
  rule: ProseRule,
  line: string,
  lineNo: number,
  file?: string,
): GovernanceFinding | null {
  const hit = rule.test(line, lineNo);
  if (!hit) return null;
  return {
    ...hit,
    ruleId: rule.id,
    tier: rule.tier,
    ruleCitation: rule.citation,
    file: hit.file ?? file,
  };
}

/** Map promoted component prose → executable warn rules (v1 heuristics). */
export function compileProseRules(component: ComponentDoc): ProseRule[] {
  const blob = `${component.role}\n${component.description}`.toLowerCase();
  const citation = component.description.trim() || component.role.trim();
  const rules: ProseRule[] = [];

  if (/inactive link|dead link|href\s*=#/.test(blob) || blob.includes("inactive links")) {
    rules.push({
      id: "inactive-link",
      tier: "warn",
      label: "Inactive link",
      citation,
      test: (line, lineNo) => {
        if (!INACTIVE_LINK.test(line)) return null;
        return {
          ruleId: "inactive-link",
          tier: "warn",
          message: "Possible inactive or placeholder link (href=\"#\" or empty).",
          snippet: line.trim().slice(0, 100),
          line: lineNo,
        };
      },
    });
  }

  if (/old date|stale date|outdated date|old dates/.test(blob)) {
    const currentYear = new Date().getFullYear();
    rules.push({
      id: "stale-date",
      tier: "warn",
      label: "Stale date",
      citation,
      test: (line, lineNo) => {
        if (!STALE_YEAR.test(line)) return null;
        const years = [...line.matchAll(/\b(19\d{2}|20[0-2]\d)\b/g)].map((m) =>
          Number(m[1]),
        );
        const stale = years.some((y) => y < currentYear - 1);
        const contextual = STALE_CONTEXT.test(line) || /closed\s+\d{4}/i.test(line);
        if (!stale && !contextual) return null;
        if (!contextual && years.every((y) => y >= currentYear - 1)) return null;
        return {
          ruleId: "stale-date",
          tier: "warn",
          message: `Possible stale year in copy (rule: no old dates). Found: ${years.join(", ")}`,
          snippet: line.trim().slice(0, 100),
          line: lineNo,
        };
      },
    });
  }

  if (/old address|stale address|inactive address|old addresses/.test(blob)) {
    rules.push({
      id: "stale-address",
      tier: "warn",
      label: "Stale address",
      citation,
      test: (line, lineNo) => {
        if (!STALE_ADDRESS.test(line)) return null;
        return {
          ruleId: "stale-address",
          tier: "warn",
          message: "Possible outdated or closed address in copy.",
          snippet: line.trim().slice(0, 100),
          line: lineNo,
        };
      },
    });
  }

  return rules;
}

export function scanProseViolations(
  code: string,
  rules: ProseRule[],
  opts?: { file?: string },
): GovernanceFinding[] {
  if (!rules.length) return [];
  const out: GovernanceFinding[] = [];
  code.split("\n").forEach((line, i) => {
    const lineNo = i + 1;
    for (const rule of rules) {
      const finding = lineFinding(rule, line, lineNo, opts?.file);
      if (finding) out.push(finding);
    }
  });
  return out;
}
