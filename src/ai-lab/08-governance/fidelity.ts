import type { DesignSystem } from "@/lib/blocks/types";
import type { DesignIR } from "@/lib/design-ir/schema";
import { contrastRatio, isHex } from "@/lib/design-ir/color-utils";
import {
  buildPreviewContextFromIR,
  classifyComponentKind,
  parseComponentPreviewSpec,
} from "@/ai-lab/04-component-previews";

/**
 * Phase 4 — fidelity scoring.
 *
 * Because the IR is the governed source of truth, we can grade any rendered
 * surface against it: legibility of every text/surface pairing, whether
 * component colors stay on-token, and how confidently the doc parsed. This is
 * the check no prompt-to-UI generator can offer — it requires a spec.
 */

export type FidelityStatus = "pass" | "warn" | "fail";

export type FidelityCheck = {
  id: string;
  label: string;
  status: FidelityStatus;
  detail: string;
};

export type FidelityReport = {
  score: number;
  checks: FidelityCheck[];
  summary: string;
};

function contrastCheck(
  id: string,
  label: string,
  fg: string,
  bg: string,
  pass: number,
  warn: number,
): FidelityCheck {
  if (!isHex(fg) || !isHex(bg)) {
    return { id, label, status: "warn", detail: "non-hex value, not graded" };
  }
  const ratio = contrastRatio(fg, bg);
  const status: FidelityStatus =
    ratio >= pass ? "pass" : ratio >= warn ? "warn" : "fail";
  return { id, label, status, detail: `${ratio.toFixed(2)}:1 contrast` };
}

const TRACKING_RE = /^(normal|0|-?[\d.]+(em|px|rem|%|ex|ch))$/;

export function scoreFidelity(
  system: DesignSystem,
  ir: DesignIR,
): FidelityReport {
  const chrome = ir.wikiChrome.cssVariables;
  const checks: FidelityCheck[] = [];

  // 1. Tokens present
  checks.push({
    id: "tokens",
    label: "Token coverage",
    status: system.colors.length > 0 && system.typography.length > 0 ? "pass" : "fail",
    detail: `${system.colors.length} colors · ${system.typography.length} fonts`,
  });

  // 2-4. Legibility of core pairings
  checks.push(
    contrastCheck("c-text", "Body text on background", chrome["--wiki-text"], chrome["--wiki-bg"], 4.5, 3),
    contrastCheck("c-muted", "Muted text on background", chrome["--wiki-muted"], chrome["--wiki-bg"], 2.4, 1.8),
    contrastCheck("c-cta", "Label on accent", chrome["--wiki-cta-on-accent"], chrome["--wiki-accent"], 4, 3),
  );

  // 5. Letter-spacing validity
  const trackOk =
    TRACKING_RE.test(chrome["--wiki-heading-tracking"] ?? "normal") &&
    TRACKING_RE.test(chrome["--wiki-body-tracking"] ?? "normal");
  checks.push({
    id: "tracking",
    label: "Valid type tracking",
    status: trackOk ? "pass" : "fail",
    detail: trackOk ? "valid CSS" : "invalid letter-spacing emitted",
  });

  // 6. On-token component colors
  const palette = new Set(
    system.colors.filter((c) => isHex(c.value)).map((c) => c.value.toLowerCase()),
  );
  const ctx = buildPreviewContextFromIR(ir);
  const offToken = new Set<string>();
  let generic = 0;
  for (const c of system.components) {
    if (classifyComponentKind(c) === "generic") generic += 1;
    const spec = parseComponentPreviewSpec(c, ctx);
    for (const v of [spec.backgroundColor, spec.color, spec.borderColor]) {
      if (isHex(v) && !palette.has(v.toLowerCase())) offToken.add(v.toLowerCase());
    }
  }
  checks.push({
    id: "on-token",
    label: "On-token component colors",
    status: offToken.size === 0 ? "pass" : offToken.size <= 2 ? "warn" : "fail",
    detail:
      offToken.size === 0
        ? "all component colors are defined tokens"
        : `${offToken.size} off-token color(s): ${[...offToken].join(", ")}`,
  });

  // 7. Parse confidence (how many components mapped to a real kind)
  const total = system.components.length;
  const classifiedRatio = total === 0 ? 1 : (total - generic) / total;
  checks.push({
    id: "parse",
    label: "Component parse confidence",
    status: total === 0 ? "warn" : classifiedRatio >= 0.7 ? "pass" : "warn",
    detail:
      total === 0
        ? "no components defined"
        : `${Math.round(classifiedRatio * 100)}% mapped to a known kind`,
  });

  const weight = (s: FidelityStatus) => (s === "pass" ? 1 : s === "warn" ? 0.5 : 0);
  const score = Math.round(
    (checks.reduce((sum, c) => sum + weight(c.status), 0) / checks.length) * 100,
  );
  const fails = checks.filter((c) => c.status === "fail").length;
  const warns = checks.filter((c) => c.status === "warn").length;
  const summary =
    fails > 0
      ? `${fails} violation${fails > 1 ? "s" : ""} — the rendered surface diverges from the system.`
      : warns > 0
        ? `On-system with ${warns} thing${warns > 1 ? "s" : ""} to review.`
        : "Fully faithful to the design system.";

  return { score, checks, summary };
}
