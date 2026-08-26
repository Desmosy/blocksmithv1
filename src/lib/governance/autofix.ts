/**
 * Apply the fixes the linters already computed.
 *
 * Every violation class except the categorical rules carries a specific
 * replacement — `p-5` → `p-4`, `#e0e0e0` → the Rule token, `borderRadius: 12`
 * → 10. Those are mechanical and safe to apply.
 *
 * What is deliberately NOT applied: anything where the linter has no confident
 * replacement. Removing a gradient is a composition decision, and snapping an
 * off-system blue to the nearest grey is the substitution the colour matcher
 * already refuses to recommend. Those come back as `skipped` with the reason,
 * so the caller can show the human what still needs a decision.
 */

import type { DesignSystem } from "@/lib/blocks/types";
import {
  findOffTokenColors,
  nearestToken,
  paletteFromColors,
  type TokenColor,
} from "./color-lint";
import { findScaleViolations } from "./scale-lint";
import { findTailwindViolations } from "./tailwind-lint";
import { findRuleViolations } from "./rule-lint";

/** Mirrors the confidence threshold used when suggesting a colour token. */
const CLOSE_ENOUGH = 3 * 24 ** 2;

export type FixApplied = {
  from: string;
  to: string;
  line: number;
};

export type FixSkipped = {
  what: string;
  line: number;
  why: string;
};

export type FixResult = {
  code: string;
  applied: FixApplied[];
  skipped: FixSkipped[];
};

/**
 * Replace one token on one line, leaving every other occurrence alone. Line
 * scoping matters: the same hex can be correct in one place and wrong in
 * another, and a global replace would rewrite both.
 */
function replaceOnLine(
  lines: string[],
  lineNo: number,
  from: string,
  to: string,
): boolean {
  const i = lineNo - 1;
  if (i < 0 || i >= lines.length) return false;
  if (!lines[i].includes(from)) return false;
  lines[i] = lines[i].replace(from, to);
  return true;
}

export function applyFixes(code: string, system: DesignSystem): FixResult {
  const lines = code.split("\n");
  const applied: FixApplied[] = [];
  const skipped: FixSkipped[] = [];

  const colors: TokenColor[] = system.colors
    .filter((c) => c.value.startsWith("#"))
    .map((c) => ({ name: c.name, value: c.value.toLowerCase(), cssVar: c.cssVar }));

  // 1. Off-token colours, where a near neighbour exists.
  for (const v of findOffTokenColors(code, paletteFromColors(system.colors))) {
    const near = nearestToken(v.hex, colors);
    if (!near || near.distance > CLOSE_ENOUGH) {
      skipped.push({
        what: v.hex,
        line: v.line,
        why: "no token is close to this colour — picking one is a design decision",
      });
      continue;
    }
    if (replaceOnLine(lines, v.line, v.hex, near.hex)) {
      applied.push({ from: v.hex, to: `${near.hex} (${near.name})`, line: v.line });
    }
  }

  // 2. Off-scale spacing, type size and radius.
  for (const v of findScaleViolations(lines.join("\n"), system)) {
    if (v.nearest === null) {
      skipped.push({
        what: `${v.property}: ${v.value}px`,
        line: v.line,
        why: "the system defines no scale for this property",
      });
      continue;
    }
    // Match the value as written — with or without a px unit.
    const withUnit = `${v.value}px`;
    const done =
      replaceOnLine(lines, v.line, withUnit, `${v.nearest}px`) ||
      replaceOnLine(lines, v.line, `: ${v.value}`, `: ${v.nearest}`) ||
      replaceOnLine(lines, v.line, ` ${v.value} `, ` ${v.nearest} `);
    if (done) {
      applied.push({
        from: `${v.property}: ${v.value}px`,
        to: `${v.nearest}px`,
        line: v.line,
      });
    }
  }

  // 3. Tailwind utilities that resolve off-scale.
  for (const v of findTailwindViolations(lines.join("\n"), system)) {
    if (!v.suggestion) {
      skipped.push({
        what: v.className,
        line: v.line,
        why:
          v.kind === "color"
            ? "no token matches this colour — pick one from the palette"
            : "no replacement class is on the system's scale",
      });
      continue;
    }
    if (replaceOnLine(lines, v.line, v.utility, v.suggestion)) {
      applied.push({ from: v.className, to: v.suggestion, line: v.line });
    }
  }

  // 4. Categorical rules are never auto-applied — removing a gradient or a
  //    shadow changes the composition, which is the human's call.
  for (const v of findRuleViolations(lines.join("\n"), system)) {
    skipped.push({
      what: v.matched,
      line: v.line,
      why: "removing this changes the design, not just a value",
    });
  }

  return { code: lines.join("\n"), applied, skipped };
}

/** Short human/agent-readable summary of what a fix pass did. */
export function describeFixResult(r: FixResult): string {
  if (!r.applied.length && !r.skipped.length) {
    return "Nothing to fix — the code already matches the design system.";
  }
  const out: string[] = [];
  if (r.applied.length) {
    out.push(`Applied ${r.applied.length} fix(es):`);
    out.push(...r.applied.map((a) => `- Line ${a.line}: ${a.from} → ${a.to}`));
  }
  if (r.skipped.length) {
    if (out.length) out.push("");
    out.push(`${r.skipped.length} need a decision from you:`);
    out.push(...r.skipped.map((s) => `- Line ${s.line}: \`${s.what}\` — ${s.why}`));
  }
  return out.join("\n");
}
