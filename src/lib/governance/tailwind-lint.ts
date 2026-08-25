/**
 * Tailwind scale linting — spacing, type size, radius, and color drift
 * expressed as utility classes.
 *
 * `scale-lint.ts` catches `padding: 20px`. It does not catch `p-5`, which is
 * the same mistake written the way most AI-generated UI code actually writes
 * it. Governance that only reads CSS properties passes a whole Tailwind
 * codebase unchecked, which is worse than not checking at all: the engine
 * reports clean while every value is off the scale.
 *
 * Deliberately conservative, in the same spirit as its sibling:
 *
 * - Only classes inside a plausible class context are considered — a
 *   `className`/`class` attribute, or a `clsx`/`cn`/`cva`-style call. Prose
 *   containing a hyphenated word is never scanned.
 * - Only utilities whose px value is *unambiguous* are resolved. Anything
 *   unrecognised (custom theme keys like `p-gutter`, project colors like
 *   `bg-brand-500`, fractions, `auto`, `full`) is left alone.
 * - Where Tailwind v3 and v4 disagree on a value (`rounded-sm`), the class is
 *   flagged only if *every* candidate reading is off-scale.
 *
 * A false "fix" an agent then applies is worse than a miss.
 */

import type { DesignSystem } from "@/lib/blocks/types";
import { scalesFromSystem, type Scales } from "./scale-lint";
import { nearestToken, normalizeHex, paletteFromColors } from "./color-lint";

export type TailwindKind = "spacing" | "fontSize" | "radius" | "color";

export type TailwindViolation = {
  kind: TailwindKind;
  /** The utility exactly as written, variants included, e.g. "md:p-5". */
  className: string;
  /** The base utility with variants and `!` stripped, e.g. "p-5". */
  utility: string;
  /** Resolved value in px. Null for color violations. */
  value: number | null;
  /** Resolved color for color violations, normalized hex. Null when unknown. */
  hex: string | null;
  line: number;
  snippet: string;
  /** Nearest allowed px value on the scale, when one exists. */
  nearest: number | null;
  /** A replacement class that lands on the scale, when one can be written. */
  suggestion: string | null;
};

/* ------------------------------------------------------------------ *
 * Tailwind's default scales, in px.
 *
 * Verified against `node_modules/tailwindcss/theme.css` (v4):
 *   --spacing: 0.25rem            → p-4  = 4 * 4px  = 16px
 *   --text-sm: 0.875rem           → text-sm  = 14px
 *   --radius-lg: 0.5rem           → rounded-lg = 8px
 *   --radius: 0.25rem (deprecated)→ bare `rounded` = 4px
 * Values below are the rem figures from that file × 16.
 * ------------------------------------------------------------------ */

/** One spacing step. `--spacing: 0.25rem` → 4px, so `p-4` is 16px. */
const SPACING_UNIT_PX = 4;

/** `text-*` sizes. Identical in v3 and v4. */
const TEXT_PX: Record<string, number> = {
  xs: 12, // 0.75rem
  sm: 14, // 0.875rem
  base: 16, // 1rem
  lg: 18, // 1.125rem
  xl: 20, // 1.25rem
  "2xl": 24, // 1.5rem
  "3xl": 30, // 1.875rem
  "4xl": 36, // 2.25rem
  "5xl": 48, // 3rem
  "6xl": 60, // 3.75rem
  "7xl": 72, // 4.5rem
  "8xl": 96, // 6rem
  "9xl": 128, // 8rem
};

/**
 * `rounded-*` sizes. v4 renumbered the small end: v3 had `rounded-sm` at
 * 0.125rem, v4 has `rounded-xs` there and moved `rounded-sm` to 0.25rem.
 * Everything from `md` up is stable across both.
 */
const RADIUS_PX: Record<string, number> = {
  none: 0,
  xs: 2, // 0.125rem (v4 only)
  sm: 4, // 0.25rem  (v4; see RADIUS_AMBIGUOUS_PX)
  md: 6, // 0.375rem
  lg: 8, // 0.5rem
  xl: 12, // 0.75rem
  "2xl": 16, // 1rem
  "3xl": 24, // 1.5rem
  "4xl": 32, // 2rem
  full: 9999,
};

/** Bare `rounded` — `--radius: 0.25rem` in both major versions. */
const RADIUS_DEFAULT_PX = 4;

/** Keys whose px value depends on the Tailwind major. Flag only if all miss. */
const RADIUS_AMBIGUOUS_PX: Record<string, number[]> = {
  sm: [4, 2], // v4: 0.25rem, v3: 0.125rem
};

/** Longest-first so `px-` wins over `p-` and `space-x-` over `space-`. */
const SPACING_RE =
  /^(space-x|space-y|gap-x|gap-y|gap|px|py|pt|pr|pb|pl|ps|pe|p|mx|my|mt|mr|mb|ml|ms|me|m)-(.+)$/;

const TEXT_RE = /^text-(.+)$/;

/** `rounded`, `rounded-lg`, `rounded-t`, `rounded-tl-md`, `rounded-ss-xl`. */
const RADIUS_RE =
  /^rounded(?:-(t|r|b|l|s|e|tl|tr|br|bl|ss|se|es|ee))?(?:-([a-z0-9]+))?$/;

/** Utility prefixes that take a color. Longest-first, same reason. */
const COLOR_PREFIXES = [
  "ring-offset",
  "placeholder",
  "decoration",
  "background",
  "underline",
  "outline",
  "divide",
  "accent",
  "border",
  "shadow",
  "stroke",
  "caret",
  "fill",
  "from",
  "ring",
  "text",
  "via",
  "bg",
  "to",
];

/** Tailwind's stock palette names. Anything else is assumed project-defined. */
const STOCK_COLOR_NAMES = new Set([
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
]);

/** Stock colors whose hex is fixed, so they can be palette-checked properly. */
const LITERAL_COLOR_HEX: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
};

/** Color keywords that are never drift. */
const COLOR_KEYWORDS = new Set([
  "transparent",
  "current",
  "inherit",
  "none",
  "auto",
]);

/* ------------------------------------------------------------------ *
 * Class-context extraction
 * ------------------------------------------------------------------ */

type Region = { text: string; start: number };

/** Attributes and helper calls whose contents are class strings. */
const ATTR_RE = /\b(?:className|class)\s*=\s*/g;
const CALL_RE = /\b(?:clsx|classNames|classnames|cn|cx|twMerge|twJoin|cva|tv)\s*\(/g;
/** Tagged templates — `` tw`p-4 gap-2` ``. Unambiguous, so safe to scan. */
const TAG_RE = /\b(?:tw|clsx|cn|cx|twMerge|twJoin)\s*`/g;

/** Runaway guard for the balanced-delimiter walk. */
const MAX_SPAN = 6000;

/** Index of the closing quote for the string opened at `start`, or -1. */
function skipString(code: string, start: number): number {
  const quote = code[start];
  for (let i = start + 1; i < code.length; i++) {
    if (code[i] === "\\") {
      i++;
      continue;
    }
    if (code[i] === quote) return i;
  }
  return -1;
}

/** Index of the `}`/`)` matching the delimiter at `open`, or -1. */
function matchingIndex(code: string, open: number): number {
  const openCh = code[open];
  const closeCh = openCh === "{" ? "}" : openCh === "(" ? ")" : "";
  if (!closeCh) return -1;
  let depth = 0;
  const limit = Math.min(code.length, open + MAX_SPAN);
  for (let i = open; i < limit; i++) {
    const ch = code[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const end = skipString(code, i);
      if (end < 0) return -1;
      i = end;
      continue;
    }
    if (ch === openCh) depth++;
    else if (ch === closeCh && --depth === 0) return i;
  }
  return -1;
}

/** Blank out `${...}` so interpolated expressions never read as class names. */
function blankInterpolations(text: string): string {
  return text.replace(/\$\{[^}]*\}/g, (m) => " ".repeat(m.length));
}

/** Every string literal between [from, to), with absolute offsets. */
function stringLiterals(
  code: string,
  from: number,
  to: number,
  depth = 0,
): Region[] {
  if (depth > 3) return [];
  const out: Region[] = [];
  for (let i = from; i < to; i++) {
    const ch = code[i];
    if (ch !== '"' && ch !== "'" && ch !== "`") continue;
    const end = skipString(code, i);
    if (end < 0 || end >= to) break;
    const raw = code.slice(i + 1, end);
    if (ch === "`") {
      out.push({ text: blankInterpolations(raw), start: i + 1 });
      // Conditional class names usually live inside the interpolations.
      const re = /\$\{/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(raw))) {
        const brace = i + 1 + m.index + 1;
        const close = matchingIndex(code, brace);
        if (close > brace && close < end) {
          out.push(...stringLiterals(code, brace, close, depth + 1));
        }
      }
    } else {
      out.push({ text: raw, start: i + 1 });
    }
    i = end;
  }
  return out;
}

/**
 * String literals that plausibly hold class names. Anything outside a
 * `className`/`class` attribute or a class-helper call is ignored, so prose
 * with hyphens is never scanned.
 */
function classRegions(code: string): Region[] {
  const spans: [number, number][] = [];

  const collect = (re: RegExp, fromDelimiter: boolean) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code))) {
      const at = fromDelimiter ? re.lastIndex - 1 : re.lastIndex;
      const ch = code[at];
      if (ch === "{" || ch === "(") {
        const close = matchingIndex(code, at);
        if (close > at) spans.push([at, close]);
      } else if (ch === '"' || ch === "'" || ch === "`") {
        const close = skipString(code, at);
        if (close > at) spans.push([at, close + 1]);
      }
    }
  };

  collect(ATTR_RE, false);
  collect(CALL_RE, true);
  collect(TAG_RE, true);

  // A `className={cn("...")}` is found twice; keep one region per literal.
  const seen = new Map<number, Region>();
  for (const [from, to] of spans) {
    for (const region of stringLiterals(code, from, to)) {
      if (!seen.has(region.start)) seen.set(region.start, region);
    }
  }
  return [...seen.values()];
}

/* ------------------------------------------------------------------ *
 * Class parsing
 * ------------------------------------------------------------------ */

/** Split on `:` that sits outside `[...]`, so `data-[a=b]:p-4` survives. */
function stripVariants(token: string): string {
  let depth = 0;
  let last = 0;
  for (let i = 0; i < token.length; i++) {
    const ch = token[i];
    if (ch === "[") depth++;
    else if (ch === "]") depth--;
    else if (ch === ":" && depth === 0) last = i + 1;
  }
  return token.slice(last);
}

/** Drop the `/50` opacity modifier when it sits outside `[...]`. */
function stripOpacity(utility: string): string {
  let depth = 0;
  for (let i = 0; i < utility.length; i++) {
    const ch = utility[i];
    if (ch === "[") depth++;
    else if (ch === "]") depth--;
    else if (ch === "/" && depth === 0) return utility.slice(0, i);
  }
  return utility;
}

/** The base utility: variants, `!` important, and negation removed. */
function baseUtility(token: string): { utility: string; negated: boolean } {
  let u = stripVariants(token);
  if (u.startsWith("!")) u = u.slice(1);
  if (u.endsWith("!")) u = u.slice(0, -1);
  const negated = u.startsWith("-");
  if (negated) u = u.slice(1);
  return { utility: stripOpacity(u), negated };
}

/** `p-4` → 16. `p-px` → 1. `p-1.5` → 6. Null for anything not a step. */
function spacingPx(value: string): number | null {
  if (value === "px") return 1;
  const m = value.match(/^(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n * SPACING_UNIT_PX : null;
}

/** `13px` / `0.5rem` inside `[...]`. Null for calc, vars, %, and bare numbers. */
function arbitraryPx(raw: string): number | null {
  const m = raw.trim().match(/^(-?\d+(?:\.\d+)?)(px|rem)$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return Math.abs(m[2] === "rem" ? n * 16 : n);
}

/** `#3b82f6` inside `[...]`, normalized. Null for var(), oklch(), keywords. */
function arbitraryHex(raw: string): string | null {
  const v = raw.trim().replace(/^color:/, "");
  return /^#[0-9a-fA-F]{3,8}$/.test(v) ? normalizeHex(v) : null;
}

/* ------------------------------------------------------------------ *
 * Suggestions — the class that would produce the nearest legal value
 * ------------------------------------------------------------------ */

/** v3-safe fractional steps. Others become an arbitrary value instead. */
const SAFE_FRACTIONS = new Set([0.5, 1.5, 2.5, 3.5]);

function spacingClass(prefix: string, value: number): string {
  if (value === 1) return `${prefix}-px`;
  const n = value / SPACING_UNIT_PX;
  if (Number.isInteger(n) || SAFE_FRACTIONS.has(n)) return `${prefix}-${n}`;
  return `${prefix}-[${value}px]`;
}

function textClass(value: number): string {
  const key = Object.keys(TEXT_PX).find((k) => TEXT_PX[k] === value);
  return key ? `text-${key}` : `text-[${value}px]`;
}

function radiusClass(side: string, value: number): string {
  const head = side ? `rounded-${side}` : "rounded";
  if (value >= 999) return `${head}-full`;
  if (value === 0) return `${head}-none`;
  // 4px is `rounded` in v4 and v3 alike; 2px is `xs` in v4 but `sm` in v3, so
  // write it as an arbitrary value rather than pick the wrong one.
  if (value === RADIUS_DEFAULT_PX) return head;
  const key = Object.keys(RADIUS_PX).find(
    (k) => RADIUS_PX[k] === value && !RADIUS_AMBIGUOUS_PX[k] && k !== "full",
  );
  return key && value !== 2 ? `${head}-${key}` : `${head}-[${value}px]`;
}

function nearest(value: number, allowed: number[]): number | null {
  if (!allowed.length) return null;
  return allowed.reduce((best, n) =>
    Math.abs(n - value) < Math.abs(best - value) ? n : best,
  );
}

/* ------------------------------------------------------------------ *
 * Per-class evaluation
 * ------------------------------------------------------------------ */

type Ctx = {
  scales: Scales;
  palette: Set<string>;
  colors: DesignSystem["colors"];
};

type Hit = {
  kind: TailwindKind;
  value: number | null;
  hex: string | null;
  nearest: number | null;
  suggestion: string | null;
};

/** Off-scale px value → a hit, or null when the value is legal. */
function pxHit(
  kind: Exclude<TailwindKind, "color">,
  value: number,
  allowed: number[],
  suggest: (target: number) => string,
): Hit | null {
  if (!allowed.length || allowed.includes(value)) return null;
  const near = nearest(value, allowed);
  return {
    kind,
    value,
    hex: null,
    nearest: near,
    suggestion: near === null ? null : suggest(near),
  };
}

function colorHit(hex: string | null, ctx: Ctx, prefix: string): Hit | null {
  if (hex && ctx.palette.has(hex)) return null;
  const token = hex ? nearestToken(hex, ctx.colors) : null;
  return {
    kind: "color",
    value: null,
    hex,
    nearest: null,
    suggestion: token?.cssVar ? `${prefix}-[var(${token.cssVar})]` : null,
  };
}

/** Split a color utility into its prefix and the rest, or null. */
function splitColorPrefix(utility: string): [string, string] | null {
  for (const prefix of COLOR_PREFIXES) {
    if (utility.startsWith(`${prefix}-`)) {
      return [prefix, utility.slice(prefix.length + 1)];
    }
  }
  return null;
}

/**
 * Resolve one utility against the system. Returns null for every class this
 * module cannot map with confidence — which is most of them, by design.
 */
function evaluate(utility: string, ctx: Ctx): Hit | null {
  // 1. Arbitrary values: `p-[13px]`, `text-[42px]`, `bg-[#3b82f6]`.
  const arb = utility.match(/^([a-z-]+)-\[(.+)\]$/);
  if (arb) {
    const [, prefix, raw] = arb;
    const px = arbitraryPx(raw);
    if (px !== null) {
      if (SPACING_RE.test(`${prefix}-0`)) {
        return pxHit("spacing", px, ctx.scales.spacing, (t) =>
          spacingClass(prefix, t),
        );
      }
      if (prefix === "text") {
        return pxHit("fontSize", px, ctx.scales.fontSize, textClass);
      }
      const radius = prefix.match(RADIUS_RE);
      if (radius && !radius[2]) {
        return pxHit("radius", px, ctx.scales.radius, (t) =>
          radiusClass(radius[1] ?? "", t),
        );
      }
      return null;
    }
    const hex = arbitraryHex(raw);
    if (hex && COLOR_PREFIXES.includes(prefix)) return colorHit(hex, ctx, prefix);
    return null;
  }

  // 2. Radius keywords: `rounded`, `rounded-lg`, `rounded-tl-md`.
  const radius = utility.match(RADIUS_RE);
  if (radius) {
    const side = radius[1] ?? "";
    const key = radius[2];
    // `rounded-t` (side only) and bare `rounded` both mean the default radius.
    const candidates = !key
      ? [RADIUS_DEFAULT_PX]
      : (RADIUS_AMBIGUOUS_PX[key] ??
        (key in RADIUS_PX ? [RADIUS_PX[key]] : null));
    if (!candidates) return null; // custom theme key — not ours to judge
    const allowed = ctx.scales.radius;
    if (!allowed.length) return null;
    // Ambiguous across Tailwind majors: legal under any reading is legal.
    if (candidates.some((c) => allowed.includes(c))) return null;
    return pxHit("radius", candidates[0], allowed, (t) => radiusClass(side, t));
  }

  // 3. Font size: `text-2xl`. Also the entry point for `text-red-600`.
  const text = utility.match(TEXT_RE);
  if (text) {
    const key = text[1];
    if (key in TEXT_PX) {
      return pxHit("fontSize", TEXT_PX[key], ctx.scales.fontSize, textClass);
    }
  }

  // 4. Spacing: `p-4`, `-mt-6`, `gap-x-2`, `space-y-3`.
  const spacing = utility.match(SPACING_RE);
  if (spacing) {
    const px = spacingPx(spacing[2]);
    if (px !== null) {
      return pxHit("spacing", px, ctx.scales.spacing, (t) =>
        spacingClass(spacing[1], t),
      );
    }
  }

  // 5. Stock colors: `bg-blue-500`, `text-red-600`, `bg-black`.
  const color = splitColorPrefix(utility);
  if (color) {
    const [prefix, rest] = color;
    if (COLOR_KEYWORDS.has(rest)) return null;
    if (rest in LITERAL_COLOR_HEX) {
      return colorHit(LITERAL_COLOR_HEX[rest], ctx, prefix);
    }
    const shade = rest.match(/^([a-z]+)-\d{2,3}$/);
    // A stock palette name can never be a design token. A project name
    // (`bg-brand-500`) very likely is one, so leave it alone.
    if (shade && STOCK_COLOR_NAMES.has(shade[1])) {
      return colorHit(null, ctx, prefix);
    }
  }

  return null;
}

/* ------------------------------------------------------------------ *
 * Entry points
 * ------------------------------------------------------------------ */

/** Every Tailwind utility in `code` whose value is off the system's scales. */
export function findTailwindViolations(
  code: string,
  system: DesignSystem,
): TailwindViolation[] {
  const ctx: Ctx = {
    scales: scalesFromSystem(system),
    palette: paletteFromColors(system.colors),
    colors: system.colors,
  };

  const lines = code.split("\n");
  // Absolute offset of each line start, for mapping a match back to a line.
  const lineStarts: number[] = [];
  let offset = 0;
  for (const line of lines) {
    lineStarts.push(offset);
    offset += line.length + 1;
  }
  const lineAt = (index: number): number => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= index) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };

  const out: TailwindViolation[] = [];
  const seen = new Set<string>();

  for (const region of classRegions(code)) {
    const tokenRe = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = tokenRe.exec(region.text))) {
      const token = m[0];
      // Interpolation leftovers and expression fragments are not classes.
      if (/[${}()]/.test(token)) continue;
      if (token.length > 80) continue;
      const { utility } = baseUtility(token);
      if (!utility) continue;

      const hit = evaluate(utility, ctx);
      if (!hit) continue;

      const index = region.start + m.index;
      const row = lineAt(index);
      const key = `${row}:${token}:${hit.kind}`;
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({
        kind: hit.kind,
        className: token,
        utility,
        value: hit.value,
        hex: hit.hex,
        line: row + 1,
        snippet: lines[row].trim().slice(0, 100),
        nearest: hit.nearest,
        suggestion: hit.suggestion,
      });
    }
  }

  return out.sort((a, b) => a.line - b.line || a.className.localeCompare(b.className));
}

/** One-line explanation an agent can act on directly. */
export function describeTailwindViolation(v: TailwindViolation): string {
  if (v.kind === "color") {
    const fix = v.suggestion ? ` Use \`${v.suggestion}\` instead.` : "";
    return v.hex
      ? `\`${v.className}\` resolves to ${v.hex}, which is not a palette token.${fix}`
      : `\`${v.className}\` is a stock Tailwind color, not a design token.${fix}`;
  }

  const label =
    v.kind === "fontSize"
      ? "not on the type scale"
      : v.kind === "radius"
        ? "not a defined radius"
        : "not on the spacing scale";

  const fix =
    v.suggestion !== null && v.nearest !== null
      ? ` Use \`${v.suggestion}\` (${v.nearest}px) instead.`
      : v.nearest !== null
        ? ` Nearest allowed is ${v.nearest}px.`
        : "";

  return `\`${v.className}\` resolves to ${v.value}px, ${label}.${fix}`;
}

/** Grouped counts, for a one-line governance summary. */
export function tailwindViolationCounts(
  violations: TailwindViolation[],
): Record<TailwindKind, number> {
  const counts: Record<TailwindKind, number> = {
    spacing: 0,
    fontSize: 0,
    radius: 0,
    color: 0,
  };
  for (const v of violations) counts[v.kind]++;
  return counts;
}
