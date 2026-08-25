import { parseCssVarTable } from "@/lib/scan/tokens";
import type { ScannedCssVar } from "@/lib/scan/types";
import { normalizeHex, rgbToHex } from "./normalize";
import type { TokenDriftReport, TokenDriftRow } from "./types";

/** Loose value equality: hex-insensitive, px/number-insensitive, else string. */
export function valuesEqual(a: string, b: string): boolean {
  const ha = normalizeHex(a) ?? rgbToHex(a);
  const hb = normalizeHex(b) ?? rgbToHex(b);
  if (ha && hb) return ha === hb;

  const na = parseFloat(a);
  const nb = parseFloat(b);
  const aIsNum = /^-?\d/.test(a.trim());
  const bIsNum = /^-?\d/.test(b.trim());
  if (aIsNum && bIsNum && !Number.isNaN(na) && !Number.isNaN(nb)) {
    return na === nb;
  }
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Reconcile Figma tokens against code tokens, matched by CSS-variable name.
 * This is the wedge: it surfaces "Figma says X, shipped code says Y" rather
 * than treating the import as a one-way overwrite.
 */
export function computeTokenDrift(
  figmaVars: ScannedCssVar[],
  codeVars: ScannedCssVar[],
): TokenDriftReport {
  const codeByName = new Map(codeVars.map((v) => [v.name, v]));
  const figmaNames = new Set(figmaVars.map((v) => v.name));
  const rows: TokenDriftRow[] = [];
  let matched = 0;
  let mismatched = 0;
  let figmaOnly = 0;
  let codeOnly = 0;

  for (const fv of figmaVars) {
    const cv = codeByName.get(fv.name);
    if (!cv) {
      figmaOnly += 1;
      rows.push({ cssVar: fv.name, status: "figma-only", figmaValue: fv.value });
      continue;
    }
    if (valuesEqual(fv.value, cv.value)) {
      matched += 1;
      rows.push({
        cssVar: fv.name,
        status: "match",
        figmaValue: fv.value,
        codeValue: cv.value,
        codeSource: cv.source,
      });
    } else {
      mismatched += 1;
      rows.push({
        cssVar: fv.name,
        status: "mismatch",
        figmaValue: fv.value,
        codeValue: cv.value,
        codeSource: cv.source,
      });
    }
  }

  for (const cv of codeVars) {
    if (figmaNames.has(cv.name)) continue;
    codeOnly += 1;
    rows.push({
      cssVar: cv.name,
      status: "code-only",
      codeValue: cv.value,
      codeSource: cv.source,
    });
  }

  return {
    rows,
    matched,
    mismatched,
    figmaOnly,
    codeOnly,
    inSync: mismatched === 0 && figmaOnly === 0 && codeOnly === 0,
  };
}

/** Pull code-side CSS vars out of an existing workspace-scan markdown. */
export function codeVarsFromScanMarkdown(scanMarkdown: string): ScannedCssVar[] {
  return parseCssVarTable(scanMarkdown).map((v) => ({
    name: v.name,
    value: v.value,
    source: v.source,
  }));
}

/** Drift Figma tokens directly against a code scan's markdown. */
export function driftFigmaAgainstScan(
  figmaVars: ScannedCssVar[],
  scanMarkdown: string,
): TokenDriftReport {
  return computeTokenDrift(figmaVars, codeVarsFromScanMarkdown(scanMarkdown));
}

const STATUS_LABEL: Record<TokenDriftRow["status"], string> = {
  match: "✓ in sync",
  mismatch: "✗ differs",
  "figma-only": "→ Figma only",
  "code-only": "← code only",
};

/** Render a drift report as a markdown section for the wiki or CLI output. */
export function renderDriftMarkdown(report: TokenDriftReport): string {
  const lines: string[] = [
    "## Figma ↔ code token drift",
    "",
    `> ${report.inSync ? "**In sync** — Figma and code agree on every shared token." : `**${report.mismatched}** differ · **${report.figmaOnly}** Figma-only · **${report.codeOnly}** code-only · **${report.matched}** in sync.`}`,
    "",
    "| Token | Status | Figma | Code | Code source |",
    "|-------|--------|-------|------|-------------|",
  ];
  const order: TokenDriftRow["status"][] = [
    "mismatch",
    "figma-only",
    "code-only",
    "match",
  ];
  const sorted = [...report.rows].sort(
    (a, b) => order.indexOf(a.status) - order.indexOf(b.status),
  );
  for (const r of sorted) {
    lines.push(
      `| \`${r.cssVar}\` | ${STATUS_LABEL[r.status]} | ${r.figmaValue ?? "—"} | ${r.codeValue ?? "—"} | ${r.codeSource ? `\`${r.codeSource}\`` : "—"} |`,
    );
  }
  return lines.join("\n");
}
