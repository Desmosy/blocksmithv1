/**
 * Categorical rule linting — the "Don't" list, executed.
 *
 * Every design system ships a Don't list, and today it is decorative: it is
 * rendered for humans and pasted into agent prompts, but nothing checks it.
 * Several of those rules are mechanically decidable — no gradients, no drop
 * shadows, no pure black or white, no undeclared font families — and this runs
 * exactly those.
 *
 * Two properties matter more than coverage:
 *
 * 1. Nothing is hardcoded. A check only runs if the system's own `donts`
 *    express that intent, so a system that permits shadows is never told off
 *    for using one.
 * 2. Every violation carries the verbatim Don't line it broke. An agent that is
 *    told `"Do not add drop shadows to cards or buttons. Separation comes from
 *    the Rule (#e2e4ea) hairline and from space, not elevation."` learns the
 *    system; one told "shadow not allowed" only learns to delete a class.
 *
 * Deliberately conservative: false positives are worse than misses here,
 * because an agent will "fix" a bad flag and make the code wrong. Comments are
 * blanked before scanning, `shadow-none` is fine, and pure white is only a
 * violation when the palette does not itself contain `#ffffff`.
 */

import type { DesignSystem } from "@/lib/blocks/types";

export type RuleKind =
  | "gradient"
  | "shadow"
  | "pureColor"
  | "fontFamily"
  | "gridMesh"
  | "attribution";

export type RuleViolation = {
  kind: RuleKind;
  line: number;
  snippet: string;
  /** The exact text in the code that tripped the rule, e.g. "shadow-lg". */
  matched: string;
  /** The verbatim Don't line from the design system that this breaks. */
  rule: string;
};

/**
 * Which checks this system actually asks for, each carrying the Don't line that
 * asked for it. `null` means the system never expressed the rule — stay quiet.
 */
export type RuleChecks = {
  gradient: string | null;
  shadow: string | null;
  pureBlack: string | null;
  pureWhite: string | null;
  fontFamily: string | null;
  /** "No graph-paper grids" — the ruled-squares backdrop behind SVGs. */
  gridMesh: string | null;
  /** "Credit CC BY assets" — attribution-required art must carry its line. */
  attribution: string | null;
  /** Normalized names of every font family the system declares. */
  fonts: string[];
};

/* ------------------------------------------------------------------ *
 * Intent detection — which rules does this system's Don't list state?
 * ------------------------------------------------------------------ */

/**
 * A Don't entry is already a prohibition, but the phrasing can invert it
 * ("do not remove the shadow"). Those flip the meaning, so skip them.
 */
const INVERTED = /\b(remov\w*|omit\w*|skip\w*|strip\w*|delet\w*|forget\w*)\b/;

const GRADIENT_INTENT = /\bgradients?\b/;
const SHADOW_INTENT = /\bshadows?\b/;
const GRID_MESH_INTENT = /\bgraph-?paper\b|\bgrid (?:mesh|of (?:ruled )?squares)\b|\bruled squares\b/;
const ATTRIBUTION_INTENT = /\bcc by\b|\battribution\b|\bcredit line\b|requires attribution/;
const BLACK_INTENT = /\b(?:pure|true|solid|full)\s+black\b|#0{3}(?:0{3})?\b/;
const WHITE_INTENT = /\b(?:pure|true|solid|full)\s+white\b|#f{3}(?:f{3})?\b/;
/** Explicit family talk, or "font" qualified by a novelty/foreign word. */
const FONT_FAMILY_INTENT =
  /\bfont[-\s]?famil(?:y|ies)\b|\btypefaces?\b|\bfont stacks?\b/;
const FONT_NOVELTY =
  /\b(?:new|another|other|additional|different|outside|beyond|undeclared|custom|arbitrary|introduc\w*|substitut\w*|import\w*)\b/;
const FONT_WORD = /\bfonts?\b/;

/** First Don't line matching `intent`, ignoring inverted phrasings. */
function findDont(donts: string[], intent: RegExp): string | null {
  for (const raw of donts) {
    const line = raw.trim();
    if (!line) continue;
    const lower = line.toLowerCase();
    if (!intent.test(lower)) continue;
    if (INVERTED.test(lower)) continue;
    return line;
  }
  return null;
}

/** Strip a hex/keyword color down to a comparable form: "#FFF" → "#ffffff". */
function normalizeColor(raw: string): string {
  const v = raw.trim().toLowerCase();
  if (v === "white") return "#ffffff";
  if (v === "black") return "#000000";
  const m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (!m) return v;
  const hex = m[1];
  return hex.length === 3
    ? `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
    : `#${hex}`;
}

/** Every color the system legitimately ships, normalized to 6-digit hex. */
function paletteValues(system: DesignSystem): Set<string> {
  const out = new Set<string>();
  for (const c of system.colors) out.add(normalizeColor(c.value));
  for (const s of system.surfaces) out.add(normalizeColor(s.value));
  return out;
}

/** Fold a family name to a comparable key: "JetBrains Mono" → "jetbrainsmono". */
function normalizeFont(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Names, substitutes, and `--font-*` variable stems the system declares. */
function declaredFonts(system: DesignSystem): string[] {
  const out = new Set<string>();
  for (const f of system.typography) {
    if (f.name) out.add(normalizeFont(f.name));
    if (f.substitute) out.add(normalizeFont(f.substitute));
    // `--font-instrument-serif` also stands for "Instrument Serif".
    if (f.cssVar) out.add(normalizeFont(f.cssVar.replace(/^-+(?:font-)?/, "")));
  }
  out.delete("");
  return [...out];
}

/** Resolve the system's Don't list into the set of checks to run. */
export function checksFromSystem(system: DesignSystem): RuleChecks {
  const donts = system.donts ?? [];
  // "font-family"/"typeface" is explicit; a bare "font" only counts when the
  // line is about bringing in a foreign one ("do not introduce another font").
  const fontFamily =
    findDont(donts, FONT_FAMILY_INTENT) ??
    findDont(
      donts.filter((d) => FONT_NOVELTY.test(d.toLowerCase())),
      FONT_WORD,
    );

  const palette = paletteValues(system);

  return {
    gradient: findDont(donts, GRADIENT_INTENT),
    shadow: findDont(donts, SHADOW_INTENT),
    gridMesh: findDont(donts, GRID_MESH_INTENT),
    attribution: findDont(donts, ATTRIBUTION_INTENT),
    // A rule against pure black is meaningless if the palette ships #000000.
    pureBlack: palette.has("#000000") ? null : findDont(donts, BLACK_INTENT),
    pureWhite: palette.has("#ffffff") ? null : findDont(donts, WHITE_INTENT),
    fontFamily,
    fonts: declaredFonts(system),
  };
}

/* ------------------------------------------------------------------ *
 * Comment blanking
 * ------------------------------------------------------------------ */

/**
 * Replace comment spans with spaces, preserving line count and column offsets
 * so line numbers stay honest. String literals are tracked so that `//` inside
 * `"https://…"` is not mistaken for a comment.
 */
function blankComments(lines: string[]): string[] {
  const out: string[] = [];
  let inBlock: "js" | "html" | null = null;

  for (const raw of lines) {
    let s = "";
    let i = 0;
    let quote: string | null = null;

    while (i < raw.length) {
      if (inBlock === "js") {
        if (raw.startsWith("*/", i)) {
          inBlock = null;
          s += "  ";
          i += 2;
        } else {
          s += " ";
          i += 1;
        }
        continue;
      }
      if (inBlock === "html") {
        if (raw.startsWith("-->", i)) {
          inBlock = null;
          s += "   ";
          i += 3;
        } else {
          s += " ";
          i += 1;
        }
        continue;
      }

      const ch = raw[i];
      if (quote) {
        if (ch === "\\") {
          s += `${ch}${raw[i + 1] ?? ""}`;
          i += 2;
          continue;
        }
        if (ch === quote) quote = null;
        s += ch;
        i += 1;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        quote = ch;
        s += ch;
        i += 1;
        continue;
      }
      if (raw.startsWith("/*", i)) {
        inBlock = "js";
        s += "  ";
        i += 2;
        continue;
      }
      if (raw.startsWith("<!--", i)) {
        inBlock = "html";
        s += "    ";
        i += 4;
        continue;
      }
      if (raw.startsWith("//", i)) {
        s += " ".repeat(raw.length - i);
        break;
      }
      s += ch;
      i += 1;
    }

    out.push(s);
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * Detectors
 * ------------------------------------------------------------------ */

/** Utility classes never start mid-word; ES2017 has no lookbehind, so capture. */
const EDGE = "(?:^|[^\\w$-])";

/** Matches produced by a regex whose group 1 is the real token. */
function tokens(line: string, re: RegExp): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  while ((m = re.exec(line))) {
    out.push(m[1]);
    // Never let a zero-width match spin.
    if (m.index === re.lastIndex) re.lastIndex += 1;
  }
  return out;
}

const GRADIENT_FN =
  /((?:repeating-)?(?:linear|radial|conic)-gradient)\s*\(/gi;
const TW_GRADIENT = new RegExp(
  `${EDGE}(bg-(?:gradient|linear|radial|conic)(?:-[a-z0-9]+)*)(?![\\w-])`,
  "g",
);
const TW_FROM = new RegExp(
  `${EDGE}(from-(?:\\[[^\\]\\s]+\\]|[a-z]+(?:-\\d{2,3})?))(?![\\w-])`,
  "g",
);
const TW_TO = new RegExp(
  `${EDGE}(to-(?:\\[[^\\]\\s]+\\]|[a-z]+(?:-\\d{2,3})?))(?![\\w-])`,
  "g",
);

function scanGradients(line: string): string[] {
  const hits = [...tokens(line, GRADIENT_FN), ...tokens(line, TW_GRADIENT)];
  // `from-*`/`to-*` alone are ambiguous; a pair on one line is a gradient.
  const from = tokens(line, TW_FROM);
  const to = tokens(line, TW_TO);
  if (from.length && to.length) hits.push(`${from[0]} … ${to[0]}`);
  return hits;
}

const BOX_SHADOW_PROP = new RegExp(
  `${EDGE}(box-shadow|boxShadow)\\s*:\\s*([^;\\n}]*)`,
  "g",
);
const TW_SHADOW = new RegExp(
  `${EDGE}((?:drop-)?shadow-(?:\\[[^\\]\\s]+\\]|[a-z0-9]+(?:-[a-z0-9]+)*))(?![\\w-])`,
  "g",
);
const TW_SHADOW_BARE = new RegExp(`${EDGE}(shadow)(?![\\w-])`, "g");
const CLASS_ATTR = /class(?:Name)?\s*=/;

function scanShadows(line: string): string[] {
  const hits: string[] = [];

  let m: RegExpExecArray | null;
  BOX_SHADOW_PROP.lastIndex = 0;
  while ((m = BOX_SHADOW_PROP.exec(line))) {
    const value = m[2].trim().replace(/^["'`]|["'`]$/g, "").trim();
    // `box-shadow: none` is the fix, not the failure.
    if (/^none\b/i.test(value) || value === "") continue;
    hits.push(m[1]);
  }

  for (const t of tokens(line, TW_SHADOW)) {
    if (/^(?:drop-)?shadow-none$/.test(t)) continue;
    hits.push(t);
  }

  // A bare `shadow` is only unambiguous inside a class attribute.
  if (CLASS_ATTR.test(line)) hits.push(...tokens(line, TW_SHADOW_BARE));

  return hits;
}

const HEX_WHITE = /(#f{3}(?:f{3})?)\b/gi;
const HEX_BLACK = /(#0{3}(?:0{3})?)\b/gi;
/** Utility prefixes that make a bare `white`/`black` a color, not a word. */
const TW_COLOR_PREFIX =
  "(?:bg|text|border|ring|fill|stroke|from|via|to|divide|outline|decoration|caret|accent|placeholder|shadow)";
const COLOR_PROPS = [
  "color",
  "backgroundColor",
  "background",
  "borderColor",
  "outlineColor",
  "fill",
  "stroke",
  "caretColor",
  "textDecorationColor",
];

/** kebab-case a camelCase property so both CSS and JSX spellings match. */
function kebab(prop: string): string {
  return prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

function scanPureColor(line: string, word: "white" | "black"): string[] {
  const hits = [
    ...tokens(line, word === "white" ? HEX_WHITE : HEX_BLACK),
    ...tokens(
      line,
      new RegExp(`${EDGE}(${TW_COLOR_PREFIX}-${word})(?![\\w-])`, "g"),
    ),
  ];

  // `color: white` — but not `background: url(white-paper.png)`, so the value
  // has to be the whole token, not a substring of one.
  for (const prop of COLOR_PROPS) {
    const re = new RegExp(
      `${EDGE}(?:${prop}|${kebab(prop)})\\s*:\\s*([^;,\\n}]+)`,
      "g",
    );
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      const parts = m[1]
        .trim()
        .split(/\s+/)
        .map((p) => p.replace(/["'`;]/g, "").toLowerCase());
      if (parts.includes(word)) hits.push(`${prop}: ${word}`);
    }
  }

  return hits;
}

/**
 * The graph-paper backdrop, in its literal forms: an SVG `<pattern>` named
 * for a grid, a fill that references one, or a minified run of `<line>`
 * elements. Grids drawn in a JS loop slip past — conservative by design;
 * the Don't line in the prompt covers what a regex cannot.
 */
const GRID_PATTERN_TAG = /(<pattern\b[^>]*id\s*=\s*["'][^"']*grid[^"']*["'])/gi;
const GRID_PATTERN_REF = /(url\(\s*#[^)]*grid[^)]*\))/gi;
const GRID_LINE_RUN = /((?:<line\b[^>]*>[^<]*){6,})/gi;

function scanGridMesh(line: string): string[] {
  const hits = [
    ...tokens(line, GRID_PATTERN_TAG).map((t) => t.slice(0, 60)),
    ...tokens(line, GRID_PATTERN_REF),
  ];
  if (GRID_LINE_RUN.test(line)) {
    GRID_LINE_RUN.lastIndex = 0;
    hits.push("6+ <line> elements in a row — a ruled grid");
  }
  return hits;
}

const FONT_FAMILY_PROP = new RegExp(
  `${EDGE}(?:font-family|fontFamily)\\s*:\\s*([^;\\n}]+)`,
  "g",
);
/** Generic families and CSS-wide keywords are never "an undeclared font". */
const GENERIC_FAMILIES = new Set([
  "inherit",
  "initial",
  "unset",
  "revert",
  "revertlayer",
  "serif",
  "sansserif",
  "monospace",
  "cursive",
  "fantasy",
  "systemui",
  "uiserif",
  "uisansserif",
  "uimonospace",
  "uirounded",
  "emoji",
  "math",
  "fangsong",
]);

function scanFontFamilies(line: string, allowed: string[]): string[] {
  const hits: string[] = [];
  let m: RegExpExecArray | null;
  FONT_FAMILY_PROP.lastIndex = 0;

  while ((m = FONT_FAMILY_PROP.exec(line))) {
    const raw = m[1].trim();
    // `var(--font-x)`, `inter.style.fontFamily`, `${theme.font}` — the value is
    // a reference, not a literal family. Resolving it is out of scope.
    if (/[({]|\$\{|\.\w/.test(raw)) continue;
    // Only the first family in the stack actually renders.
    const first = raw
      .split(",")[0]
      .replace(/["'`]/g, "")
      .trim();
    if (!first) continue;
    const key = normalizeFont(first);
    if (!key || GENERIC_FAMILIES.has(key)) continue;
    if (allowed.includes(key)) continue;
    hits.push(first);
  }

  return hits;
}

/* ------------------------------------------------------------------ *
 * Entry points
 * ------------------------------------------------------------------ */

/** Every categorical Don't this code breaks, in line order. */
export function findRuleViolations(
  code: string,
  system: DesignSystem,
): RuleViolation[] {
  const checks = checksFromSystem(system);
  const runFonts = checks.fontFamily !== null && checks.fonts.length > 0;
  if (
    !checks.gradient &&
    !checks.shadow &&
    !checks.pureBlack &&
    !checks.pureWhite &&
    !checks.gridMesh &&
    !checks.attribution &&
    !runFonts
  ) {
    return [];
  }

  const lines = code.split("\n");
  const scan = blankComments(lines);
  const out: RuleViolation[] = [];

  const push = (kind: RuleKind, rule: string, i: number, matched: string) => {
    out.push({
      kind,
      rule,
      line: i + 1,
      snippet: lines[i].trim().slice(0, 100),
      matched,
    });
  };

  // Attribution is a whole-document property: an asset from an
  // attribution-required source is fine anywhere on the page as long as its
  // credit exists somewhere on the same page. Checked before the line scan
  // because no single line can answer it.
  if (checks.attribution) {
    const ATTRIBUTION_SOURCE = /thenounproject\.com|noun\s?project|blush\.design/i;
    const hasSource = ATTRIBUTION_SOURCE.test(code);
    const hasCredit = /\bCC BY\b/i.test(code);
    if (hasSource && !hasCredit) {
      const i = lines.findIndex((l) => ATTRIBUTION_SOURCE.test(l));
      push(
        "attribution",
        checks.attribution,
        Math.max(i, 0),
        lines[Math.max(i, 0)].match(ATTRIBUTION_SOURCE)?.[0] ?? "attribution-required asset",
      );
    }
  }

  scan.forEach((line, i) => {
    if (!line.trim()) return;

    if (checks.gradient) {
      for (const hit of scanGradients(line)) {
        push("gradient", checks.gradient, i, hit);
      }
    }
    if (checks.shadow) {
      for (const hit of scanShadows(line)) {
        push("shadow", checks.shadow, i, hit);
      }
    }
    if (checks.gridMesh) {
      for (const hit of scanGridMesh(line)) {
        push("gridMesh", checks.gridMesh, i, hit);
      }
    }
    if (checks.pureWhite) {
      for (const hit of scanPureColor(line, "white")) {
        push("pureColor", checks.pureWhite, i, hit);
      }
    }
    if (checks.pureBlack) {
      for (const hit of scanPureColor(line, "black")) {
        push("pureColor", checks.pureBlack, i, hit);
      }
    }
    if (runFonts && checks.fontFamily) {
      for (const hit of scanFontFamilies(line, checks.fonts)) {
        push("fontFamily", checks.fontFamily, i, hit);
      }
    }
  });

  return out.sort((a, b) => a.line - b.line);
}

/**
 * One-line explanation an agent can act on — and, crucially, the rule text it
 * broke, quoted. The rejection is supposed to teach, not just block.
 */
export function describeRuleViolation(v: RuleViolation): string {
  const lead =
    v.kind === "gradient"
      ? "Gradients are not allowed in this design system"
      : v.kind === "shadow"
        ? "Shadows are not allowed in this design system"
        : v.kind === "pureColor"
          ? "Pure black/white is not allowed in this design system"
          : v.kind === "gridMesh"
            ? "Graph-paper grids are not allowed in this design system — remove the ruled backdrop, keep the diagram"
            : v.kind === "attribution"
              ? 'This asset requires attribution and the page carries no credit — add a visible "<name> by <creator> — CC BY" line to the footer, or use a free icon set instead'
              : "That font family is not declared in this design system";
  return `\`${v.matched}\` — ${lead}. Rule: "${v.rule}"`;
}
