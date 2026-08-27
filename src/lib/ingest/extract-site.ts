/**
 * Extract a design system's raw material from a live page.
 *
 * Deliberately static rather than vision-based: colours, fonts, radii and
 * spacing are *stated* in CSS, so reading them is exact where a screenshot
 * would be an estimate. What this cannot see — hierarchy, composition, the
 * reasons behind the choices — is left for a human, and the result enters as a
 * draft rather than anything governable.
 *
 * Everything returned here is third-party content. Callers must treat it as
 * data, never as instructions, and any tool exposing it must carry
 * `untrustedContentHint`.
 */

import { renderSiteDesign, type RenderedComponent, type Rendered } from "./render-site";

const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 1_500_000;
// Sites split CSS across many bundles and the fonts are rarely in the first
// one — linear.app loads 51 sheets and declares its typeface around the 20th.
const MAX_STYLESHEETS = 16;

export type Extracted = {
  url: string;
  title: string | null;
  colors: { value: string; count: number }[];
  fonts: CapturedFont[];
  radii: number[];
  spacing: number[];
  fontSizes: number[];
  /** Elevation, most-used first. Raw box-shadow values. */
  shadows: string[];
  /** Responsive breakpoints in px, ascending. */
  breakpoints: number[];
  /** Container max-widths in px, ascending. */
  containers: number[];
  /** Font weights the page actually asks for. */
  weights: number[];
  /** Line heights, most-used first — ratios where unitless. */
  lineHeights: string[];
  /** Letter spacing values, most-used first. */
  letterSpacings: string[];
  /** Border widths in px, ascending. */
  borderWidths: number[];
  /** Transition durations, most-used first. */
  durations: string[];
  /** Easing curves, most-used first. */
  easings: string[];
  /** Gradients the page defines — for some brands this *is* the imagery. */
  gradients: string[];
  /** Components read off the rendered page. Empty when no browser was available. */
  components: RenderedComponent[];
  /**
   * Which pass produced this. Reports what actually happened rather than what
   * was configured: a remote browser that fails to answer still falls back to
   * text, and saying "rendered" then would be a lie in the one place a reader
   * is deciding how much to trust the result.
   */
  readFrom: "rendered" | "css";
  /** Where the time went, in ms, so a slow capture can be diagnosed from its response. */
  timings?: { text: number; render: number; renderTimedOut: boolean };
};

/** Values ordered by how often the page uses them, capped. */
function byFrequency(
  css: string,
  re: RegExp,
  cap: number,
  clean: (v: string) => string | null = (v) => v.trim() || null,
): string[] {
  const seen = new Map<string, number>();
  for (const m of css.matchAll(re)) {
    const value = clean(m[1] ?? m[0]);
    if (!value) continue;
    seen.set(value, (seen.get(value) ?? 0) + 1);
  }
  return [...seen.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, cap)
    .map(([v]) => v);
}

/**
 * The px values a page uses most, returned ascending.
 *
 * Ranking by frequency and *then* sorting matters: taking the smallest N
 * instead keeps incidental component widths and throws away the real ones —
 * stripe.com reported a 264px "content width" because its true 939px container
 * lost to a handful of tiny max-widths that happened to sort first.
 */
function pxScale(
  css: string,
  re: RegExp,
  cap: number,
  max = 4000,
  min = 1,
): number[] {
  const seen = new Map<number, number>();
  for (const m of css.matchAll(re)) {
    const n = Number(String(m[1]).replace(/px$/i, ""));
    if (!Number.isFinite(n) || n < min || n > max) continue;
    seen.set(n, (seen.get(n) ?? 0) + 1);
  }
  return [...seen.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, cap)
    .map(([n]) => n)
    .sort((a, b) => a - b);
}

export class CaptureError extends Error {}

/**
 * Reject anything that isn't a public http(s) origin.
 *
 * Without this the tool is an SSRF primitive: an agent could be talked into
 * pointing it at localhost or cloud metadata and reading the response back.
 */
function assertPublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new CaptureError("That is not a valid URL. Include https://.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new CaptureError("Only http and https URLs can be captured.");
  }

  const host = url.hostname.toLowerCase();
  const blocked =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".local") ||
    // IPv4 private and loopback ranges, plus link-local (cloud metadata).
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    // IPv6 loopback / unique-local.
    host === "::1" ||
    host.startsWith("[::1") ||
    /^\[?f[cd]/i.test(host);

  if (blocked) {
    throw new CaptureError(
      "That address is not publicly reachable. Capture only works on public sites.",
    );
  }
  return url;
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // Identify honestly rather than impersonating a browser.
        "user-agent": "BlockSmith-Capture/1.0 (+design-system extraction)",
        accept: "text/html,text/css,*/*",
        // Without this, geo-localised sites return whichever language the
        // server guesses, and the same URL captures differently each run.
        "accept-language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) {
      throw new CaptureError(`The site returned ${res.status}.`);
    }
    const body = await res.text();
    return body.slice(0, MAX_BYTES);
  } catch (err) {
    if (err instanceof CaptureError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new CaptureError("The site took too long to respond.");
    }
    throw new CaptureError("Could not reach that site.");
  } finally {
    clearTimeout(timer);
  }
}

/** Decode the handful of entities that actually turn up in <title>. */
function decodeEntities(text: string): string {
  const named: Record<string, string> = {
    nbsp: " ",
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    "#39": "'",
  };
  return text
    .replace(/&(#\d+|[a-z]+);/gi, (whole, key: string) => {
      const lower = key.toLowerCase();
      if (named[lower] !== undefined) return named[lower];
      const num = lower.match(/^#(\d+)$/);
      if (num) {
        const code = Number(num[1]);
        return code > 0 && code < 0x10ffff ? String.fromCodePoint(code) : whole;
      }
      return whole;
    })
    .replace(/\s+/g, " ")
    .trim();
}

/** #abc and #aabbcc → #aabbcc. Anything else → null. */
function normalizeHex(raw: string): string | null {
  let h = raw.trim().toLowerCase().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return /^[0-9a-f]{6}$/.test(h) ? `#${h}` : null;
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function collectColors(css: string): Map<string, number> {
  const counts = new Map<string, number>();
  const bump = (hex: string | null) => {
    if (!hex) return;
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  };

  for (const m of css.matchAll(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g)) {
    bump(normalizeHex(m[0]));
  }
  for (const m of css.matchAll(
    /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/g,
  )) {
    bump(rgbToHex(Number(m[1]), Number(m[2]), Number(m[3])));
  }
  return counts;
}

function collectNumbers(css: string, props: string[]): number[] {
  const seen = new Map<number, number>();
  for (const prop of props) {
    const re = new RegExp(`${prop}\\s*:\\s*([^;{}]+)`, "gi");
    for (const m of css.matchAll(re)) {
      for (const token of m[1].split(/\s+/)) {
        const px = token.match(/^(\d+(?:\.\d+)?)px$/);
        if (!px) continue;
        const n = Number(px[1]);
        if (!Number.isFinite(n) || n > 400) continue;
        seen.set(n, (seen.get(n) ?? 0) + 1);
      }
    }
  }
  return [...seen.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([n]) => n);
}

/**
 * Map a real typeface to something a reader can actually load.
 *
 * A captured system is a starting point, not a forgery: the goal is for the
 * result to *read* like the site, not to relicense its fonts. Where a brand
 * face has an obvious free counterpart, this names it; where it does not, the
 * original is kept and the substitute falls back to a generic.
 */
const FONT_SUBSTITUTES: { match: RegExp; substitute: string }[] = [
  // Anything monospaced resolves to a monospace, whatever brand it belongs to.
  // This has to precede the family rules: "Geist Mono" matching the Geist rule
  // first would substitute a sans for a mono, which is worse than nothing.
  { match: /mono|code|courier/i, substitute: "JetBrains Mono" },
  { match: /^inter/i, substitute: "Inter" },
  { match: /^roboto/i, substitute: "Roboto" },
  { match: /^(sf pro|apple system|blinkmac|helvetica|arial|sohne|graphik|gt america|founders|neue haas)/i, substitute: "Inter" },
  { match: /^(circular|geist|general sans|satoshi|aeonik)/i, substitute: "Manrope" },
  { match: /^(poppins|montserrat|nunito|raleway|work sans|dm sans|open sans|lato|source sans)/i, substitute: "" },
  { match: /^(georgia|times|charter|tiempos|freight|publico|lyon|sentinel|chronicle)/i, substitute: "Source Serif 4" },
  { match: /^(playfair|canela|ogg|editorial)/i, substitute: "Playfair Display" },
];

export type CapturedFont = { name: string; substitute: string };

/** The typeface's own name, cleaned of weight and variable suffixes. */
function cleanFamily(raw: string): string {
  return raw
    .trim()
    .replace(/^["']|["']$/g, "")
    // "GeistSans Fallback", "Inter Variable", "sohne-var" all name one face.
    .replace(/[\s-]+(fallback|variable|var|vf)$/i, "")
    .replace(/\s+(display|text|web)$/i, "")
    .trim();
}

/** Diacritic- and separator-insensitive, so "Söhne" and "sohne-var" agree. */
function normaliseForMatch(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim();
}

function substituteFor(name: string): string {
  const probe = normaliseForMatch(name);
  for (const { match, substitute } of FONT_SUBSTITUTES) {
    if (match.test(probe)) return substitute || name;
  }
  // Unknown brand face: keep the name, let the reader pick.
  return name;
}

const GENERIC_FAMILY =
  /^(inherit|initial|unset|revert|none|auto|sans-serif|serif|monospace|system-ui|ui-[\w-]+|cursive|fantasy|emoji|math|fangsong)$/i;

/**
 * Faces that are never part of a design system: emoji fallbacks, icon fonts,
 * and the platform stacks a page lists after its real typeface. Reporting
 * "Apple Color Emoji" as a captured typeface is noise that makes the whole
 * capture look careless.
 */
const NOT_A_TYPEFACE =
  /(emoji|icon|symbol|glyph|webdings|wingdings|noto color|segoe ui symbol|material)/i;

/**
 * OpenType feature tags and patch faces that ride along in the same
 * declarations as real families — "cv01", "ss03", "Noto Sans Backtick Fix".
 * They are real strings in the CSS but nobody would call them the site's
 * typeface.
 */
const FEATURE_TAG = /^(cv|ss|liga|calt|tnum|onum|salt|zero|case|frac)\d*$/i;
const PATCH_FACE = /\b(fix|patch|fallback|subset|backtick)\b/i;

/**
 * Every typeface the page names, from three places: plain `font-family`
 * declarations, `@font-face` blocks, and CSS custom properties that hold a font
 * stack. Reading only the first misses any site that sets its font through a
 * variable — which is most well-built ones.
 */
function collectFonts(css: string): CapturedFont[] {
  const found = new Map<string, CapturedFont & { uses: number }>();

  const add = (raw: string, weight = 1) => {
    const value = String(raw);
    // `font-variation-settings: "opsz" auto` and friends sit in the same
    // declarations and are settings, not families.
    if (/\b(opsz|wght|slnt|wdth|ital|GRAD)\b/.test(value)) return;
    const first = cleanFamily(value.split(",")[0] ?? "");
    if (!first || first.startsWith("var(") || first.startsWith("--")) return;
    if (GENERIC_FAMILY.test(first) || NOT_A_TYPEFACE.test(first)) return;
    if (first.length < 3 || FEATURE_TAG.test(first) || PATCH_FACE.test(first)) return;
    const key = first.toLowerCase();
    const existing = found.get(key);
    if (existing) {
      existing.uses += weight;
      return;
    }
    if (found.size >= 12) return;
    found.set(key, {
      name: first,
      substitute: substituteFor(first),
      uses: weight,
    });
  };

  // @font-face first: it names the real typeface even when everything else
  // reaches it through a variable.
  for (const block of css.matchAll(/@font-face\s*\{([^}]*)\}/gi)) {
    const family = block[1].match(/font-family\s*:\s*([^;]+)/i)?.[1];
    if (family) add(family);
  }
  // Every `font-family` use counts toward the ranking: the face a page asks
  // for most is the one it is actually set in, which is rarely the first
  // @font-face block it happens to declare.
  for (const m of css.matchAll(/font-family\s*:\s*([^;{}]+)/gi)) add(m[1]);
  // Custom properties holding a stack: --font-body: "Inter", sans-serif
  for (const m of css.matchAll(/--([\w-]*font[\w-]*)\s*:\s*([^;{}]+)/gi)) {
    const prop = m[1].toLowerCase();
    const value = m[2].trim();
    // --font-size-*, --font-weight-*, --font-letter-spacing hold measurements,
    // not families. Their values look like ".6875rem" and "-0.01em".
    if (/size|weight|spacing|height|leading|tracking/.test(prop)) continue;
    if (/^[\d.\-+]/.test(value) || value.startsWith("var(")) continue;
    if (/\d\s*(px|rem|em|%|pt)\b/i.test(value)) continue;
    add(value);
  }

  return [...found.values()]
    .sort((a, b) => b.uses - a.uses)
    .slice(0, 5)
    .map(({ name, substitute }) => ({ name, substitute }));
}

/**
 * The page's own stylesheets, deduplicated and ordered by how likely each is
 * to carry the design system.
 *
 * Taking the first N in document order does not work on a code-split site:
 * linear.app loads 51 sheets, lists some twice, and declares its typeface in
 * the 40th. Bundles named index/main/app/global are where `@font-face` and
 * token definitions actually live, and the biggest sheets carry the most, so
 * those go first and the cap applies after.
 */
function stylesheetUrls(html: string, base: URL): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/rel\s*=\s*["']?stylesheet/i.test(tag)) continue;
    const href = tag.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    try {
      const abs = new URL(href, base);
      if (abs.protocol !== "http:" && abs.protocol !== "https:") continue;
      if (seen.has(abs.href)) continue;
      seen.add(abs.href);
      urls.push(abs.href);
    } catch {
      /* skip unparseable href */
    }
  }

  const priority = (u: string): number => {
    const name = u.split("/").pop()?.toLowerCase() ?? "";
    if (/\b(font|typography|type)\b/.test(name)) return 0;
    if (/^(index|main|app|global|root|style|styles|theme|tokens)\b/.test(name)) return 1;
    if (/(index|main|app|global)/.test(name)) return 2;
    return 3;
  };

  return urls
    .map((u, i) => ({ u, i, p: priority(u) }))
    .sort((a, b) => a.p - b.p || a.i - b.i)
    .slice(0, MAX_STYLESHEETS)
    .map((x) => x.u);
}

/**
 * Merge what the page renders into what its CSS says.
 *
 * Rendering is the better source wherever the two disagree: it knows which
 * colour covers the screen and which font actually applied, where the text pass
 * only knows what was mentioned. On monad.com the text pass surfaced an orange
 * that appears nowhere on screen, while rendering found the #f6f3f1 parchment
 * covering 98% of it. The text pass still contributes what rendering cannot
 * see cheaply — breakpoints, the full spacing scale, gradients.
 */
function mergeRendered(text: Extracted, rendered: Rendered): Extracted {
  // Rendered colours lead, weighted by painted area; text-only finds follow.
  const seen = new Set(rendered.colors.map((c) => c.value));
  const colors = [
    ...rendered.colors.map((c, i) => ({
      value: c.value,
      count: Math.round(c.weight * 10_000) + (rendered.colors.length - i),
    })),
    ...text.colors.filter((c) => !seen.has(c.value)).slice(0, 4),
  ].slice(0, 14);

  const renderedFonts = rendered.fonts
    .map((name) => text.fonts.find((f) => f.name.toLowerCase() === name.toLowerCase()) ?? {
      name,
      substitute: name,
    })
    .filter((f) => !/^(ui-|system-|-apple)/i.test(f.name));

  return {
    ...text,
    colors,
    fonts: renderedFonts.length ? renderedFonts.slice(0, 5) : text.fonts,
    components: rendered.components,
    readFrom: "rendered",
  };
}

export type ExtractOptions = {
  /** Wall-clock budget for the browser render, in ms. See RenderOptions. */
  renderBudgetMs?: number;
};

async function extractSiteDesignInner(rawUrl: string, opts: ExtractOptions, timings: NonNullable<Extracted["timings"]>): Promise<Extracted> {
  const t0 = Date.now();
  const url = assertPublicUrl(rawUrl);
  const html = await fetchText(url.href);

  const rawTitle = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1];
  const title = rawTitle ? decodeEntities(rawTitle).slice(0, 120) || null : null;

  // Inline <style> blocks plus the page's own stylesheets. A stylesheet that
  // fails to load is skipped rather than failing the capture — partial truth
  // beats none.
  let css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((m) => m[1])
    .join("\n");
  css += [...html.matchAll(/style\s*=\s*["']([^"']+)["']/gi)]
    .map((m) => m[1])
    .join(";\n");

  const sheets = await Promise.all(
    stylesheetUrls(html, url).map((href) =>
      fetchText(href).catch(() => ""),
    ),
  );
  css += "\n" + sheets.join("\n");

  timings.text = Date.now() - t0;
  // The render sizes its phases to the budget, but a remote browser that
  // stalls on connect or navigation can still overrun it. Racing here means
  // an overrun degrades to the CSS-only reading rather than to no reading.
  const t1 = Date.now();
  const renderBudget = opts.renderBudgetMs ?? 40_000;
  const rendered = await Promise.race<Rendered | null>([
    renderSiteDesign(url.href, { budgetMs: renderBudget }),
    new Promise<null>((resolve) => setTimeout(() => { timings.renderTimedOut = true; resolve(null); }, renderBudget + 4_000)),
  ]);
  timings.render = Date.now() - t1;
  const colorCounts = collectColors(css);
  const colors = [...colorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14)
    .map(([value, count]) => ({ value, count }));

  const textPass: Extracted = {
    url: url.href,
    title,
    colors,
    fonts: collectFonts(css),
    radii: collectNumbers(css, ["border-radius"]).slice(0, 8),
    spacing: collectNumbers(css, ["padding", "margin", "gap"]).slice(0, 10),
    fontSizes: collectNumbers(css, ["font-size"]).slice(0, 10),

    // A design system is more than colour and size. Everything below is stated
    // in the page's own CSS — none of it is inferred.
    shadows: byFrequency(
      css,
      /box-shadow\s*:\s*([^;{}]+)/gi,
      5,
      (v) => {
        const t = v.trim();
        // "none" and variable indirection say nothing about elevation.
        if (!t || /^(none|inherit|initial|unset)$/i.test(t) || t.startsWith("var(")) return null;
        return t.length > 90 ? null : t;
      },
    ),
    breakpoints: pxScale(css, /@media[^{]*?\(min-width:\s*([\d.]+)px\)/gi, 5, 2560, 320),
    // Below ~480px a max-width is a component, not a container.
    containers: pxScale(css, /max-width\s*:\s*([\d.]+)px/gi, 5, 2000, 480),
    weights: [
      ...new Set(
        [...css.matchAll(/font-weight\s*:\s*([1-9]00)\b/gi)].map((m) => Number(m[1])),
      ),
    ].sort((a, b) => a - b),
    lineHeights: byFrequency(css, /line-height\s*:\s*([\d.]+(?:px|rem|em)?)\b/gi, 6, (v) => {
      const t = v.trim();
      return t === "0" ? null : t;
    }),
    letterSpacings: byFrequency(
      css,
      /letter-spacing\s*:\s*(-?[\d.]+(?:em|px|rem))/gi,
      5,
      (v) => (parseFloat(v) === 0 ? null : v.trim()),
    ),
    borderWidths: pxScale(css, /border(?:-[a-z]+)?-?width\s*:\s*([\d.]+)px/gi, 4, 24),
    // Match only the duration itself. An alternation with two groups fell
    // back to the whole declaration, so the doc listed
    // "transition:background-color .3s" as a duration.
    durations: byFrequency(
      css,
      /transition[^;{}]{0,60}?(?<![\w.])(\d*\.?\d+m?s)\b/gi,
      4,
      (v) => {
        const ms = /ms$/i.test(v) ? parseFloat(v) : parseFloat(v) * 1000;
        // Sub-frame and multi-second values are not interface motion.
        return ms >= 40 && ms <= 1200 ? v.trim() : null;
      },
    ),
    easings: byFrequency(css, /(cubic-bezier\([^)]{1,40}\))/gi, 3),
    gradients: byFrequency(
      css,
      /(linear-gradient\([^;{}]{10,120}\))/gi,
      3,
      (v) => (v.includes("var(") ? null : v.trim()),
    ),
    components: [],
    readFrom: "css",
  };

  return rendered ? mergeRendered(textPass, rendered) : textPass;
}


export async function extractSiteDesign(rawUrl: string, opts: ExtractOptions = {}): Promise<Extracted> {
  const timings = { text: 0, render: 0, renderTimedOut: false };
  const out = await extractSiteDesignInner(rawUrl, opts, timings);
  return { ...out, timings };
}
