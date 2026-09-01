/**
 * Scale linting — spacing, type size, and radius drift.
 *
 * Color linting catches the most *visible* design failure, but not the most
 * common one. A generated component with correct tokens and `padding: 48`,
 * `fontSize: 42`, `borderRadius: 12` still reads as off, because the rhythm is
 * wrong. This finds those.
 *
 * Deliberately conservative: it only inspects properties whose values are
 * unambiguously scale values, and only flags bare numbers and `px`. Relative
 * units, percentages, unitless line heights, and calc() are left alone rather
 * than producing false positives an agent would then "fix" incorrectly.
 */

import type { DesignSystem } from "@/lib/blocks/types";

export type ScaleKind = "spacing" | "fontSize" | "radius";

export type ScaleViolation = {
  kind: ScaleKind;
  /** The CSS or JSX property that carried the value, e.g. "padding". */
  property: string;
  /** The offending value in px — signed, so `-48` is reported as written. */
  value: number;
  line: number;
  snippet: string;
  /** Nearest allowed value on the scale, when one is close. */
  nearest: number | null;
  /** Set when the value is negative — a different failure than drift. */
  negative?: boolean;
};

/** The scales a design system permits, in px. */
export type Scales = {
  spacing: number[];
  fontSize: number[];
  radius: number[];
};

const SPACING_PROPS = [
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "paddingInline",
  "paddingBlock",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "gap",
  "rowGap",
  "columnGap",
];

const FONT_SIZE_PROPS = ["fontSize"];

const RADIUS_PROPS = [
  "borderRadius",
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomLeftRadius",
  "borderBottomRightRadius",
];

/** kebab-case a camelCase property so both CSS and JSX spellings match. */
function kebab(prop: string): string {
  return prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

/**
 * Parse "16px" / "16" / " 16 " to a number; null for anything else.
 *
 * Signed on purpose. This used to return the absolute value, which made
 * `gap: -48px` read as an on-scale 48 — so a page whose every gap was
 * negative (invalid CSS, silently dropped by the browser) and whose margins
 * pulled each block over its neighbour passed governance with zero
 * violations, and shipped looking shredded.
 */
function px(raw: string): number | null {
  const m = raw.trim().match(/^(-?\d+(?:\.\d+)?)(px)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/** Pull the px values a design system considers legal. */
export function scalesFromSystem(system: DesignSystem): Scales {
  const spacing = system.spacing
    .map((s) => px(s.value))
    .filter((n): n is number => n !== null);

  const fontSize = system.typeScale
    .map((t) => px(t.size))
    .filter((n): n is number => n !== null);

  const radius = system.borderRadius
    .map((r) => px(r.value))
    .filter((n): n is number => n !== null);

  return {
    // 0 is always legal — removing space is not drift.
    spacing: unique([0, ...spacing]),
    fontSize: unique(fontSize),
    // 0 and fully-round are always legal.
    radius: unique([0, 999, 9999, ...radius]),
  };
}

function unique(ns: number[]): number[] {
  return [...new Set(ns)].sort((a, b) => a - b);
}

function nearest(value: number, allowed: number[]): number | null {
  if (!allowed.length) return null;
  return allowed.reduce((best, n) =>
    Math.abs(n - value) < Math.abs(best - value) ? n : best,
  );
}

/**
 * Build one regex per property covering both `padding: 16px` (CSS) and
 * `padding: 16` / `padding: "16px"` (JSX style objects).
 */
function matcher(prop: string): RegExp {
  const names = `(?:${prop}|${kebab(prop)})`;
  return new RegExp(`\\b${names}\\s*:\\s*["']?([^;,"'}\\n]+)["']?`, "g");
}

function scanGroup(
  code: string,
  props: string[],
  kind: ScaleKind,
  allowed: number[],
): ScaleViolation[] {
  if (!allowed.length) return [];
  const out: ScaleViolation[] = [];
  const lines = code.split("\n");

  lines.forEach((line, i) => {
    for (const prop of props) {
      const re = matcher(prop);
      let m: RegExpExecArray | null;
      while ((m = re.exec(line))) {
        // A shorthand can carry several values: `padding: 8px 16px`.
        const parts = m[1].trim().split(/\s+/);
        for (const part of parts) {
          const value = px(part);
          if (value === null) continue;
          if (value < 0) {
            // The one legitimate negative: a small horizontal pull for an
            // overlapping stack (avatars, badges). Everything else negative
            // is either invalid CSS (gap, padding — the browser drops it)
            // or content pulled over its neighbour.
            const overlapIdiom =
              kind === "spacing" &&
              /^margin(Left|Right|Inline)$/.test(prop) &&
              value >= -12;
            if (overlapIdiom) continue;
            out.push({
              kind,
              property: prop,
              value,
              line: i + 1,
              snippet: line.trim().slice(0, 100),
              nearest: nearest(Math.abs(value), allowed),
              negative: true,
            });
            continue;
          }
          if (allowed.includes(value)) continue;
          out.push({
            kind,
            property: prop,
            value,
            line: i + 1,
            snippet: line.trim().slice(0, 100),
            nearest: nearest(value, allowed),
          });
        }
      }
    }
  });

  return out;
}

/** Every spacing, type-size, and radius value that isn't on the system's scale. */
export function findScaleViolations(
  code: string,
  system: DesignSystem,
): ScaleViolation[] {
  const scales = scalesFromSystem(system);
  return [
    ...scanGroup(code, SPACING_PROPS, "spacing", scales.spacing),
    ...scanGroup(code, FONT_SIZE_PROPS, "fontSize", scales.fontSize),
    ...scanGroup(code, RADIUS_PROPS, "radius", scales.radius),
  ].sort((a, b) => a.line - b.line);
}

/** One-line explanation an agent can act on directly. */
export function describeScaleViolation(v: ScaleViolation): string {
  if (v.negative) {
    const why =
      /^(gap|rowGap|columnGap|padding)/i.test(v.property)
        ? "is invalid CSS — the browser drops the declaration and the spacing collapses to 0"
        : "pulls content over its neighbour";
    const fix = v.nearest !== null ? ` Use ${v.nearest}px, or 0.` : " Use a positive scale value, or 0.";
    return `\`${v.property}: ${v.value}px\` is negative, which ${why}.${fix}`;
  }
  const label =
    v.kind === "fontSize"
      ? "not on the type scale"
      : v.kind === "radius"
        ? "not a defined radius"
        : "not on the spacing scale";
  const fix = v.nearest !== null ? ` Use ${v.nearest}px instead.` : "";
  return `\`${v.property}: ${v.value}px\` is ${label}.${fix}`;
}
