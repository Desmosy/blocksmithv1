/**
 * Read a design system off a page as it actually renders.
 *
 * Parsing CSS text tells you which values a stylesheet mentions. It cannot tell
 * you what the page *looks* like: which colour covers most of the screen, what
 * a button is actually made of, or that a component exists at all. A designer
 * writing a system by hand reads the rendered page, and so does this.
 *
 * What rendering adds over the text pass:
 *  - colours weighted by the pixels they cover, not by how often a rule mentions them
 *  - real components, clustered from the computed styles of visible elements
 *  - values as resolved, so `var(--brand)` and `1rem` arrive as `#533afd` and `16px`
 *
 * Falls back silently when no browser is available: the text pass still runs,
 * and a thinner capture beats a failed one.
 */

import { existsSync, readdirSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const NAV_TIMEOUT_MS = 20_000;
const SETTLE_MS = 1200;
const VIEWPORT = { width: 1440, height: 900 };

export type RenderedComponent = {
  /** A name a designer would recognise, e.g. "Primary Pill Button". */
  name: string;
  role: string;
  /** Prose spec in the house format: fills, type, radius, padding. */
  spec: string;
  /** How many times this exact treatment appears. */
  count: number;
};

export type Rendered = {
  /** Colours ranked by the screen area they cover. */
  colors: { value: string; weight: number }[];
  components: RenderedComponent[];
  /** Font stacks as actually applied, most-used first. */
  fonts: string[];
};

/**
 * A remote browser to connect to instead of launching one.
 *
 * Serverless hosts have no Chromium and a bundle limit a real one blows past,
 * so on Vercel and friends the browser lives somewhere else and we attach to it
 * over CDP. Any provider works — Browserless, Browserbase, Cloudflare Browser
 * Rendering — because they all speak the same protocol.
 *
 *   BLOCKSMITH_BROWSER_WS=wss://chrome.browserless.io?token=…
 */
function remoteEndpoint(): string | null {
  const ws = process.env.BLOCKSMITH_BROWSER_WS?.trim();
  return ws && /^wss?:\/\//i.test(ws) ? ws : null;
}

/**
 * A Chromium we can drive without downloading one.
 *
 * Prefers Playwright's cached headless shell, then a system Chrome. Deployment
 * targets without either fall back to the text-only capture, unless a remote
 * endpoint is configured.
 */
function findBrowser(): string | null {
  const cache = join(homedir(), "Library", "Caches", "ms-playwright");
  const linuxCache = join(homedir(), ".cache", "ms-playwright");

  for (const root of [cache, linuxCache]) {
    if (!existsSync(root)) continue;
    let dirs: string[];
    try {
      dirs = readdirSync(root);
    } catch {
      continue;
    }
    for (const dir of dirs.filter((d) => d.startsWith("chromium"))) {
      for (const rel of [
        "chrome-headless-shell-mac-arm64/chrome-headless-shell",
        "chrome-headless-shell-mac-x64/chrome-headless-shell",
        "chrome-headless-shell-linux/chrome-headless-shell",
        "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
        "chrome-linux/chrome",
      ]) {
        const candidate = join(root, dir, rel);
        if (existsSync(candidate)) return candidate;
      }
    }
  }

  for (const system of [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    process.env.CHROME_PATH ?? "",
  ]) {
    if (system && existsSync(system)) return system;
  }
  return null;
}

export function canRender(): boolean {
  return Boolean(remoteEndpoint()) || findBrowser() !== null;
}

/** Where rendering would come from, for diagnostics and honest messaging. */
export function renderSource(): "remote" | "local" | "none" {
  if (remoteEndpoint()) return "remote";
  return findBrowser() ? "local" : "none";
}

/**
 * Runs inside the page, passed as source rather than as a function.
 *
 * Playwright serialises a function with `toString()`, and the bundler wraps
 * declarations in a `__name()` helper that does not exist in the page — the
 * evaluate then dies with "__name is not defined". Keeping this as a string
 * puts it beyond anything the bundler rewrites.
 *
 * What it records, and why each field is there:
 *  - geometry (top, left, size) and a parent index, so the post-pass can see
 *    composition — a nav bar, a logo grid, a card grid are parents of
 *    repeated children, and a leaf census can never produce them
 *  - visible text only (innerText), so hidden localised duplicates and
 *    hover-state spans do not turn "Continue" into "ContinueWeiter続行"
 *  - a broad taxonomy classified from semantics first and appearance second:
 *    fields, checks, switches, badges, avatars, tables, code, quotes, progress,
 *    then the appearance-based control / card / visual / divider tests
 *  - one-sided hairline borders counted separately, because a rule drawn as
 *    border-bottom on a section is a token the page uses dozens of times and
 *    is not an element querySelectorAll will ever hand back
 */
const COLLECT_IN_PAGE = `(() => {
  const hex2 = (n) => Math.round(n).toString(16).padStart(2, "0");
  // A translucent colour is what it looks like *over its background*. A
  // border of rgba(0,0,0,.08) on eggshell is the stone hairline a designer
  // names; reading it as #000000 finds a black border nobody can see.
  const rgbToHexOver = (v, base) => {
    const m = v && v.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
    if (!m) return null;
    const a = m[4] === undefined ? 1 : parseFloat(m[4]);
    if (a < 0.05) return null;
    let r = +m[1], g = +m[2], b = +m[3];
    if (a < 1) {
      const bh = base || "#ffffff";
      const br = parseInt(bh.slice(1, 3), 16), bg_ = parseInt(bh.slice(3, 5), 16), bb = parseInt(bh.slice(5, 7), 16);
      r = r * a + br * (1 - a); g = g * a + bg_ * (1 - a); b = b * a + bb * (1 - a);
    }
    return "#" + hex2(r) + hex2(g) + hex2(b);
  };
  const rgbToHex = (v) => rgbToHexOver(v, null);
  const px = (v) => Math.round(parseFloat(v) || 0);
  const vw = window.innerWidth, vh = window.innerHeight;
  const docH = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);

  const area = new Map();
  const fontUse = new Map();
  const hairlines = new Map();
  const candidates = [];
  const containers = [];
  const pushed = new Map();

  const all = Array.prototype.slice.call(document.querySelectorAll("body *"), 0, 6000);
  const index = new Map();
  all.forEach((el, i) => index.set(el, i));

  const SVG_NS = "http://www.w3.org/2000/svg";
  const FIELD_TYPES = { text:1, email:1, search:1, url:1, tel:1, password:1, number:1, date:1 };

  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    const tag = el.tagName.toLowerCase();
    // Shapes inside an <svg> are the icon's drawing, not components.
    if (el.namespaceURI === SVG_NS && tag !== "svg") continue;

    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) < 0.05) continue;

    const size = rect.width * rect.height;
    const parentEl = el.parentElement;
    const parentBgRaw = parentEl ? rgbToHex(getComputedStyle(parentEl).backgroundColor) : null;
    const bg = rgbToHexOver(cs.backgroundColor, parentBgRaw);
    if (bg) area.set(bg, (area.get(bg) || 0) + size);

    let own = false;
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && (n.textContent || "").trim().length > 0) { own = true; break; }
    }
    // innerText respects visibility; textContent does not, and hidden
    // localised copies of a label sit in the DOM on many sites.
    let text = "";
    if (rect.height <= 200) {
      text = (el.innerText || "").replace(/\\s+/g, " ").trim();
      const half = text.slice(0, Math.floor(text.length / 2));
      if (half && text === half + half) text = half;
    }
    if (own && text) {
      const fg = rgbToHex(cs.color);
      const w = Math.min(text.length, 400) * px(cs.fontSize);
      if (fg) area.set(fg, (area.get(fg) || 0) + w);
      const fam = cs.fontFamily.split(",")[0].replace(/["']/g, "").trim();
      if (fam) fontUse.set(fam, (fontUse.get(fam) || 0) + w);
    }

    const role = el.getAttribute("role") || "";
    const type = (el.getAttribute("type") || "").toLowerCase();
    const radius = px(cs.borderTopLeftRadius);
    const bw = [px(cs.borderTopWidth), px(cs.borderRightWidth), px(cs.borderBottomWidth), px(cs.borderLeftWidth)];
    const sidesRaw = bw.filter((w) => w > 0).length;
    const parent = parentEl;
    const grand = parent ? parent.parentElement : null;
    const great = grand ? grand.parentElement : null;
    const pcs = parent ? getComputedStyle(parent) : null;
    const parentBg = parentBgRaw;
    const over = bg || parentBg || "#ffffff";
    // Sites leave a 2px transparent border on buttons as a hover slot.
    // A border you cannot see is not a border: it must have a colour once
    // composited, or the element is unbordered.
    const firstSide = bw.findIndex((w) => w > 0);
    const borderColEarly = firstSide >= 0
      ? rgbToHexOver([cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor][firstSide], over) : null;
    const sides = borderColEarly ? sidesRaw : 0;
    const bordered = sides > 0;
    const bgImage = cs.backgroundImage && cs.backgroundImage !== "none" ? cs.backgroundImage : "";
    // A shadow whose every layer is fully transparent is a shadow in name
    // only; sites leave these in place as a hover slot. Counting it as
    // elevation made a flat white pill "Elevated" and split its cluster.
    const rawShadow = cs.boxShadow && cs.boxShadow !== "none" ? cs.boxShadow : "";
    const shadow = rawShadow && !/^(rgba?\([^)]*,\s*0\)\s*[-\d.px ]+,?\s*)+$/.test(rawShadow) ? rawShadow : "";
    const ringCol = px(cs.outlineWidth) > 0 && cs.outlineStyle !== "none" ? rgbToHexOver(cs.outlineColor, over) : null;
    const ring = ringCol ? px(cs.outlineWidth) + "px " + ringCol : "";
    const hasImgChild = !!el.querySelector(":scope > img, :scope > svg, :scope > picture, :scope > video");
    const children = el.children.length;
    const pointer = cs.cursor === "pointer";

    // Thin borders are a token the page relies on — a rule drawn as
    // border-bottom on a row, a 1px edge on every card. They are counted by
    // colour across every element, because most are not on anything wide
    // enough or bare enough to be collected as a divider of their own.
    if (sides >= 1 && Math.max.apply(null, bw) <= 2 && rect.width >= 60) {
      const sideIdx = bw.findIndex((w) => w > 0);
      const col = rgbToHexOver([cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor][sideIdx], over);
      if (col && col !== bg) {
        const key = col + "|" + Math.max.apply(null, bw) + "px|" + (sides === 1 ? "edge" : "box");
        hairlines.set(key, (hairlines.get(key) || 0) + 1);
      }
    }
    // Rules drawn with ::before/::after never appear in querySelectorAll.
    if (rect.width >= 80 && i < 3000) {
      for (const pseudo of ["::before", "::after"]) {
        const ps = getComputedStyle(el, pseudo);
        if (!ps || ps.content === "none" || ps.content === "normal") continue;
        const ph = px(ps.height), pw = px(ps.width);
        const pbg = rgbToHexOver(ps.backgroundColor, over);
        if (ph >= 1 && ph <= 2 && (pw >= 80 || ps.width === "100%") && pbg) {
          const key = pbg + "|" + ph + "px|pseudo";
          hairlines.set(key, (hairlines.get(key) || 0) + 1);
        }
      }
    }

    const shortLabel = text.length > 0 && text.length <= 40;
    const controlSized = rect.height >= 24 && rect.height <= 90 && rect.width >= 40 && rect.width <= 460;
    const looksClickable = bg !== null || bordered || radius >= 6 || pointer;
    const surface = bg !== null && bg !== parentBg;

    let kind = null;
    if (tag === "input" && (type === "checkbox" || type === "radio")) {
      kind = role === "switch" ? "switch" : type;
    } else if (role === "switch" || role === "checkbox" || role === "radio") {
      kind = role;
    } else if (
      (tag === "input" && (FIELD_TYPES[type] || type === "")) || tag === "textarea" || tag === "select" ||
      role === "textbox" || role === "combobox" || role === "searchbox"
    ) {
      kind = "field";
    } else if (tag === "table" && rect.width >= 200) {
      kind = "table";
    } else if (tag === "pre" && rect.height >= 24) {
      kind = "code";
    } else if (tag === "blockquote") {
      kind = "quote";
    } else if (tag === "progress" || tag === "meter" || role === "progressbar") {
      kind = "progress";
    } else if (
      tag === "button" || role === "button" || (tag === "input" && (type === "submit" || type === "button")) ||
      (tag === "a" && shortLabel && rect.height >= 16 && rect.height <= 90 && rect.width >= 24 && rect.width <= 460) ||
      (shortLabel && controlSized && looksClickable && children <= 4)
    ) {
      if (rect.height <= 90) kind = "control";
    } else if (
      shortLabel && text.length <= 16 && rect.height >= 16 && rect.height <= 32 && rect.width <= 180 &&
      (bg !== null || bordered) && radius >= 3 && px(cs.fontSize) <= 14 && !pointer
    ) {
      kind = "badge";
    } else if (
      (tag === "img" || tag === "svg" || bgImage) &&
      rect.width >= 20 && rect.width <= 96 && Math.abs(rect.width - rect.height) <= 4 &&
      radius >= rect.width / 2 - 1
    ) {
      kind = "avatar";
    } else if (
      ((tag === "img" || tag === "svg" || tag === "canvas" || tag === "video" || bgImage.length > 0) &&
        rect.width >= 48 && rect.height >= 48 && text.length <= 8) ||
      // Wordmarks and partner logos are wide and short. Requiring 48px in
      // both directions threw away the logo and every mark in a trust row.
      ((tag === "img" || tag === "svg") && rect.width >= 40 && rect.height >= 12 && rect.height <= 96 && text.length === 0)
    ) {
      kind = "visual";
    } else if (
      rect.width >= 80 && rect.height <= 4 && text.length === 0 && (tag === "hr" || bg !== null || bordered)
    ) {
      kind = "divider";
    } else if (
      rect.width >= 180 && rect.height >= 90 && rect.height <= vh * 1.5 &&
      !(rect.width >= vw * 0.95 && rect.height >= vh * 0.6) &&
      (children >= 2 || hasImgChild) &&
      (bordered || shadow || surface || ring) &&
      (px(cs.paddingTop) >= 8 || px(cs.paddingLeft) >= 8 || radius >= 8)
    ) {
      kind = "card";
    }

    if (children >= 3 && containers.length < 2000) {
      containers.push({
        idx: i, tag: tag, role: role, label: el.getAttribute("aria-label") || "",
        top: Math.round(rect.top), left: Math.round(rect.left),
        width: Math.round(rect.width), height: Math.round(rect.height),
        display: cs.display, gap: px(cs.columnGap || cs.gap), children: children,
        columns: cs.display === "grid" ? (cs.gridTemplateColumns || "").split(" ").filter(Boolean).length : 0,
        bg: bg,
      });
    }

    if (!kind) continue;
    // A <button> and the <div> inside it that carries its padding both pass
    // the control test with the same box. Counting both doubled every
    // button on the page. The outer one is the component.
    if (parent && pushed.has(parent)) {
      const pc = pushed.get(parent);
      if (pc.kind === kind && Math.abs(pc.width - rect.width) <= 4 && Math.abs(pc.height - rect.height) <= 4) continue;
    }
    const borderCol = borderColEarly;
    const rec = {
      idx: i,
      parent: parent ? (index.get(parent) ?? -1) : -1,
      grand: grand ? (index.get(grand) ?? -1) : -1,
      great: great ? (index.get(great) ?? -1) : -1,
      ring: ring,
      kind: kind, tag: tag, role: role, type: type,
      bg: bg, fg: rgbToHex(cs.color),
      border: bordered ? Math.max.apply(null, bw) + "px " + (borderCol || "") : "",
      sides: sides,
      radius: radius,
      padY: px(cs.paddingTop), padX: px(cs.paddingLeft),
      top: Math.round(rect.top), left: Math.round(rect.left),
      width: Math.round(rect.width), height: Math.round(rect.height),
      fontSize: px(cs.fontSize),
      fontFamily: cs.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
      weight: cs.fontWeight, transform: cs.textTransform,
      shadow: shadow ? shadow.slice(0, 80) : "",
      media: (tag === "img" || tag === "svg" || tag === "canvas" || tag === "video") ? tag : bgImage ? bgImage.slice(0, 400) : "",
      label: text.slice(0, 28),
      children: children,
      hasImg: hasImgChild,
      pointer: pointer,
      parentDisplay: pcs ? pcs.display : "",
    };
    candidates.push(rec);
    pushed.set(el, { kind: kind, width: rect.width, height: rect.height });
    if (candidates.length >= 1500) break;
  }

  const byWeight = (a, b) => b[1] - a[1];
  return {
    colors: Array.from(area.entries()).sort(byWeight).slice(0, 40),
    fonts: Array.from(fontUse.entries()).sort(byWeight).map((e) => e[0]).slice(0, 6),
    candidates: candidates,
    containers: containers,
    hairlines: Array.from(hairlines.entries()).sort(byWeight).slice(0, 10),
    viewport: { w: vw, h: vh, docH: docH },
  };
})()`;

/**
 * Scrolls through the page so lazily mounted sections exist before measuring.
 *
 * Bounded by a step count rather than the page height: on a remote browser
 * every step is a round-trip, and a 9,000px page at 500px a step is what
 * pushed a capture past a serverless function's limit.
 */
const scrollThrough = (maxSteps: number) => `(async () => {
  const step = Math.max(500, window.innerHeight - 100);
  const max = Math.min(document.documentElement.scrollHeight, 30000);
  let n = 0;
  for (let y = 0; y < max && n < ${maxSteps}; y += step, n++) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 120));
  }
  window.scrollTo(0, 0);
  await new Promise((r) => setTimeout(r, 300));
})()`;

type Kind =
  | "control" | "field" | "checkbox" | "radio" | "switch" | "badge" | "avatar"
  | "card" | "visual" | "divider" | "table" | "code" | "quote" | "progress";

type Candidate = {
  idx: number;
  parent: number;
  grand: number;
  great: number;
  ring: string;
  kind: Kind;
  tag: string;
  role: string;
  type: string;
  bg: string | null;
  fg: string | null;
  border: string;
  sides: number;
  radius: number;
  padY: number;
  padX: number;
  top: number;
  left: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  weight: string;
  transform: string;
  shadow: string;
  media: string;
  label: string;
  children: number;
  hasImg: boolean;
  pointer: boolean;
  parentDisplay: string;
};

type Container = {
  idx: number; tag: string; role: string; label: string;
  top: number; left: number; width: number; height: number;
  display: string; gap: number; children: number; columns: number; bg: string | null;
};

type RawPage = {
  colors: [string, number][];
  fonts: string[];
  candidates: Candidate[];
  containers: Container[];
  hairlines: [string, number][];
  viewport: { w: number; h: number; docH: number };
};

type Palette = { accent?: string; ink?: string; ground?: string };

type HoverState = { bg: string | null; fg: string | null; border: string };

type Cluster = {
  kind: Kind;
  rep: Candidate;
  members: Candidate[];
  count: number;
  hover?: HoverState;
};

/* ------------------------------------------------------------------ colour */

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function chroma(hex: string): number {
  const v = rgb(hex);
  return Math.max(...v) - Math.min(...v);
}
/** Perceptual-enough distance for "would a reader call these the same". */
function colourDist(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a || !b) return 999;
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}
const nearlySame = (a: string | null | undefined, b: string | null | undefined) =>
  Boolean(a && b) && colourDist(a as string, b as string) <= 12;

/* -------------------------------------------------------------- clustering */

const radiusBucket = (r: number) => (r >= 40 ? 4 : r >= 12 ? 3 : r >= 6 ? 2 : r >= 2 ? 1 : 0);
const sizeBucket = (n: number) => Math.round(Math.log2(Math.max(8, n)) * 2);

/**
 * Whether two candidates are the same component.
 *
 * Neither exact pixels nor a name is the right unit. Exact values split one
 * nav link into nine because it renders at nine sizes; a name merges an
 * outline button and a tab pill because both are "Text Link". This compares
 * what makes a treatment recognisable — fill, shape, border, elevation and
 * rough size — and lets text properties vary. For a card the text is not
 * even consulted: its identity is the container, never what happens to be
 * written inside it.
 */
function similar(a: Candidate, b: Candidate): boolean {
  if (a.kind !== b.kind) return false;
  const fill = colourDist(a.bg, b.bg) <= 18;
  const border = Boolean(a.border || a.ring) === Boolean(b.border || b.ring);
  const shadow = Boolean(a.shadow) === Boolean(b.shadow);
  const radius = radiusBucket(a.radius) === radiusBucket(b.radius);

  switch (a.kind) {
    case "card":
      return fill && border && shadow && radius &&
        Math.abs(sizeBucket(a.height) - sizeBucket(b.height)) <= 2;
    case "visual": {
      const mediaKind = (c: Candidate) =>
        /gradient/i.test(c.media) ? "gradient" : c.media.startsWith("url(") ? "img" : c.media || "bg";
      const round = (c: Candidate) => c.radius >= c.height / 2 - 1;
      return mediaKind(a) === mediaKind(b) && round(a) === round(b) &&
        Math.abs(sizeBucket(Math.max(a.width, a.height)) - sizeBucket(Math.max(b.width, b.height))) <= 2;
    }
    case "divider":
      return colourDist(a.bg ?? a.border.split(" ")[1] ?? null, b.bg ?? b.border.split(" ")[1] ?? null) <= 12;
    case "field":
      return a.tag === b.tag && (a.type || "text") === (b.type || "text") && fill && border && radius;
    case "badge":
      return fill && border && radius;
    case "table": case "code": case "quote": case "progress":
    case "checkbox": case "radio": case "switch": case "avatar":
      return fill && radius;
    case "control":
    default: {
      const iconOnly = (c: Candidate) => c.label.length === 0 && c.hasImg;
      // A link with no fill and no border is the same link at 14px and 16px;
      // it has nothing else to differ by, so size and text colour are given
      // more room than for a filled button.
      const bare = !a.bg && !a.border && !a.ring;
      // An outline button on a white section and the same button on a pale
      // grey one differ only by the ground showing through. Any two light
      // fills count as the same fill when the treatment is the border.
      const outlined = Boolean(a.border || a.ring) && Boolean(b.border || b.ring);
      const bothLight = (!a.bg || luminance(a.bg) > 0.8) && (!b.bg || luminance(b.bg) > 0.8);
      const fillOk = fill || (outlined && bothLight);
      // A pale hairline, a dark edge and an indigo ring are three buttons, not
      // one bordered button seen three times.
      if (outlined && borderClass(a) !== borderClass(b)) return false;
      // With no fill and no border, a corner radius draws nothing; it must not
      // split one link style into three because of a leftover 4px.
      return fillOk && border && shadow && (bare || radius) &&
        iconOnly(a) === iconOnly(b) &&
        colourDist(a.fg, b.fg) <= (bare ? 90 : 60) &&
        Math.abs(sizeBucket(a.height) - sizeBucket(b.height)) <= (bare ? 2 : 1);
    }
  }
}

/** The visible character of a border: a pale hairline, a dark edge, or brand colour. */
function borderClass(c: Candidate): "none" | "hairline" | "dark" | "accent" {
  const col = (c.border || c.ring).split(" ")[1] ?? "";
  if (!/^#[0-9a-f]{6}$/i.test(col)) return c.border || c.ring ? "dark" : "none";
  if (chroma(col) >= 60) return "accent";
  return luminance(col) > 0.6 ? "hairline" : "dark";
}

function clusterAll(candidates: Candidate[]): Cluster[] {
  const clusters: Cluster[] = [];
  for (const c of candidates) {
    const home = clusters.find((k) => similar(k.rep, c));
    if (home) home.members.push(c);
    else clusters.push({ kind: c.kind, rep: c, members: [c], count: 0 });
  }
  // The representative is the commonest variant, so the spec describes what
  // the page does most rather than whichever instance came first in the DOM.
  for (const k of clusters) {
    const freq = new Map<string, number>();
    for (const m of k.members) {
      const key = `${m.bg}|${m.fontSize}|${m.height}|${m.padX}`;
      freq.set(key, (freq.get(key) ?? 0) + 1);
    }
    let best = k.members[0], bestN = -1;
    for (const m of k.members) {
      const n = freq.get(`${m.bg}|${m.fontSize}|${m.height}|${m.padX}`) ?? 0;
      if (n > bestN) { best = m; bestN = n; }
    }
    k.rep = best;
    k.count = k.members.length;
  }
  return clusters;
}

/* ------------------------------------------------------------------ naming */

function fillClass(c: Candidate, palette: Palette, monochrome: boolean): "none" | "outline" | "surface" | "light" | "dark" | "accent" | "mid" {
  if (!c.bg) return c.border || c.ring ? "outline" : "none";
  // A white pill on an eggshell page has a fill, and the eye reads it as a
  // lifted surface even when the two are a few units apart; with a border it
  // is an outline button. Neither is "no fill".
  if (nearlySame(c.bg, palette.ground)) return c.border || c.ring ? "outline" : "surface";
  const l = luminance(c.bg);
  if (nearlySame(c.bg, palette.accent) || (!monochrome && chroma(c.bg) >= 60 && l < 0.75)) return "accent";
  if (l < 0.25) return "dark";
  if (l > 0.82) return c.border ? "outline" : "light";
  return "mid";
}

function controlName(c: Candidate, palette: Palette, monochrome: boolean): { name: string; role: string } {
  const pill = c.radius >= 40 || c.radius >= c.height / 2 - 1;
  const shape = pill ? "Pill Button" : c.radius >= 2 ? "Button" : "Button";
  const iconOnly = c.label.length === 0 && c.hasImg;
  if (iconOnly) return { name: pill ? "Icon Button" : "Icon Button", role: "A single-purpose action shown as a glyph" };

  switch (fillClass(c, palette, monochrome)) {
    case "none":
      if (pill) return { name: "Ghost Pill Button", role: "Lower-weight action with no fill" };
      return { name: "Text Link", role: "Inline navigation" };
    case "outline":
      return { name: `Outline ${shape}`, role: "Secondary action, bordered on the page ground" };
    case "surface":
      return { name: `Surface ${shape}`, role: "Secondary action on a lifted fill" };
    case "light":
      return { name: `Subtle ${shape}`, role: "Quiet action on a tinted fill" };
    case "accent":
      return { name: `Primary ${shape}`, role: "The primary conversion action" };
    case "dark":
      return monochrome
        ? { name: `Filled ${shape}`, role: "The primary action" }
        : { name: `Secondary ${shape}`, role: "A committing action that is not the primary" };
    default:
      return { name: `Tinted ${shape}`, role: "A filled action" };
  }
}

function cardName(c: Candidate, palette: Palette, vw: number): { name: string; role: string } {
  const large = c.height >= 360 || c.width >= vw * 0.55;
  const onGround = !c.bg || nearlySame(c.bg, palette.ground);
  let base: string;
  let role: string;
  if (c.shadow) { base = "Elevated Card"; role = "Content that sits above the page"; }
  else if (onGround && c.border) { base = "Outlined Card"; role = "Content separated by a border, not a fill"; }
  else if (!onGround && c.bg && luminance(c.bg) < 0.3) { base = "Dark Card"; role = "An inverted panel for emphasis"; }
  else if (!onGround) { base = "Tinted Card"; role = "Content grouped on a tinted surface"; }
  else { base = "Panel"; role = "A padded region on the page ground"; }
  if (c.hasImg && base !== "Panel") base = base.replace("Card", "Media Card");
  return { name: large ? `Feature ${base}` : base, role: large ? `${role} — hero-scale` : role };
}

function visualName(c: Candidate): { name: string; role: string } {
  const gradient = /gradient/i.test(c.media);
  const round = c.radius >= c.height / 2 - 1;
  if (gradient && round) return { name: "Gradient Orb", role: "Decorative product visual" };
  if (gradient) return { name: "Gradient Panel", role: "Decorative surface" };
  if (c.media === "svg") {
    return Math.max(c.width, c.height) <= 64
      ? { name: "Icon", role: "Inline pictogram" }
      : { name: "Illustration", role: "Vector artwork" };
  }
  if (c.media === "canvas") return { name: "Canvas Visual", role: "Programmatic graphic" };
  if (c.media === "video") return { name: "Video", role: "Motion media" };
  return { name: "Image", role: "Photography or illustration" };
}

function baseName(c: Candidate, palette: Palette, monochrome: boolean, vw: number): { name: string; role: string } {
  switch (c.kind) {
    case "control": return controlName(c, palette, monochrome);
    case "card": return cardName(c, palette, vw);
    case "visual": return visualName(c);
    case "divider": return { name: "Hairline Divider", role: "Section separation" };
    case "field":
      if (c.tag === "textarea") return { name: "Textarea", role: "Multi-line entry" };
      if (c.tag === "select") return { name: "Select", role: "Choose one of a fixed set" };
      if (c.type === "search" || c.role === "searchbox") return { name: "Search Field", role: "Query entry" };
      return { name: "Text Input", role: "Single-line entry in forms" };
    case "checkbox": return { name: "Checkbox", role: "Independent on/off choice" };
    case "radio": return { name: "Radio", role: "One of several options" };
    case "switch": return { name: "Toggle Switch", role: "Immediate on/off setting" };
    case "badge":
      return c.border && (!c.bg || nearlySame(c.bg, palette.ground))
        ? { name: "Tag", role: "Category or filter label" }
        : { name: "Badge", role: "Status or count" };
    case "avatar": return { name: "Avatar", role: "A person or entity, pictured" };
    case "table": return { name: "Data Table", role: "Rows of comparable records" };
    case "code": return { name: "Code Block", role: "Preformatted code" };
    case "quote": return { name: "Blockquote", role: "A quoted passage" };
    case "progress": return { name: "Progress Bar", role: "Completion of a task" };
  }
}

/**
 * Names that stay distinct without numbering.
 *
 * When several clusters share a base name, add the attribute that actually
 * separates them, and add it only to the ones still colliding. Each axis is
 * something a reader can see — the border, the text colour, the size, the
 * fill — and a numeral is the last resort for clusters nothing visible tells
 * apart. "Accent-edged Outline Button" tells a reader something;
 * "Outline Button 6" tells them the tool gave up.
 */
function disambiguate(items: { name: string; c: Candidate }[]): string[] {
  const sizeWord = (c: Candidate) => {
    if (c.kind === "visual" || c.kind === "card" || c.kind === "avatar") {
      const m = Math.max(c.width, c.height);
      const size = m < 120 ? "Small" : m < 320 ? "Medium" : m < 640 ? "Large" : "Hero";
      const ratio = c.width / Math.max(1, c.height);
      return `${size}${ratio > 1.6 ? " Wide" : ratio < 0.66 ? " Tall" : ""}`;
    }
    return c.height <= 32 ? "Small" : c.height >= 52 ? "Large" : "Medium";
  };
  const fillWord = (c: Candidate) =>
    !c.bg ? "" : luminance(c.bg) < 0.25 ? "Dark" : luminance(c.bg) > 0.82 ? "Light" : chroma(c.bg) >= 60 ? "Coloured" : "Grey";
  const inkWord = (c: Candidate) =>
    !c.fg ? "" : chroma(c.fg) >= 60 ? "Accent-text" : luminance(c.fg) < 0.12 ? "Ink-text" : luminance(c.fg) < 0.4 ? "Muted-text" : "Light-text";
  const edgeWord = (c: Candidate) =>
    ({ none: "", hairline: "Hairline-edged", dark: "Dark-edged", accent: "Accent-edged" })[borderClass(c)];
  const dimWord = (c: Candidate) => `${c.width}×${c.height}`;

  const pictorial = (c: Candidate) => c.kind === "visual" || c.kind === "card" || c.kind === "avatar";
  // Most telling first, for each family of component.
  const axesFor = (c: Candidate): ((c: Candidate) => string)[] =>
    pictorial(c) ? [sizeWord, dimWord] : c.border || c.ring ? [edgeWord, inkWord, sizeWord, fillWord] : [inkWord, sizeWord, fillWord];

  const labels = items.map((it) => it.name);
  const prefix: string[][] = items.map(() => []);
  const groups = new Map<string, number[]>();
  items.forEach((it, i) => groups.set(it.name, [...(groups.get(it.name) ?? []), i]));

  for (const [, idxs] of groups) {
    if (idxs.length < 2) continue;
    const axes = axesFor(items[idxs[0]].c);
    const render = (i: number) => [...prefix[i], items[i].name].join(" ").replace(/\s+/g, " ").trim();
    for (const axis of axes) {
      const seen = new Map<string, number[]>();
      idxs.forEach((i) => seen.set(render(i), [...(seen.get(render(i)) ?? []), i]));
      const subgroups = [...seen.values()].filter((g) => g.length > 1);
      if (!subgroups.length) break;
      // Decide per subgroup: an axis on which every member of one collision
      // reads the same adds a word and no information to those names, even
      // if it separates a different collision in the same base name.
      for (const g of subgroups) {
        const words = g.map((i) => axis(items[i].c));
        if (new Set(words).size < 2) continue;
        g.forEach((i, n) => {
          const w = words[n];
          if (w && !prefix[i].includes(w)) prefix[i].push(w);
        });
      }
    }
    // Whatever still collides gets a numeral — nothing visible separates it.
    const seen = new Map<string, number>();
    for (const i of idxs) {
      const base = render(i);
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      labels[i] = n ? `${base} ${n + 1}` : base;
    }
  }
  return labels;
}

/* -------------------------------------------------------------------- specs */

function specFor(c: Candidate, hover?: HoverState): string {
  if (c.kind === "divider") {
    const line = c.border || (c.bg ? `${c.bg} rule` : "hairline rule");
    return `${line}, ${c.height}px tall.`;
  }
  if (c.kind === "visual" || c.kind === "avatar") {
    const shape = c.radius >= c.height / 2 - 1 ? "circular" : c.radius > 0 ? `${c.radius}px radius` : "square-cornered";
    const paint = /gradient/i.test(c.media) ? "gradient fill" : c.media === "svg" ? "inline SVG" : c.media === "img" ? "raster image" : c.media === "canvas" ? "canvas" : c.media === "video" ? "video" : c.bg ? `${c.bg} fill` : "image fill";
    let out = `${paint}, ${shape}, ${c.width}×${c.height}px.`;
    if (/gradient/i.test(c.media)) {
      // The gradient as it can be rebuilt: rgb() stops converted to hex so the
      // recipe reads like the rest of the document and lands in a stylesheet
      // as-is. This is the programmable form of the graphic; nothing about it
      // needs an image file.
      const recipe = c.media.replace(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/g, (_m, r, g, b) =>
        "#" + [r, g, b].map((n: string) => Number(n).toString(16).padStart(2, "0")).join(""));
      out += ` Recipe: \`background: ${recipe.length >= 400 ? recipe + "…" : recipe}\`.`;
    } else if (c.media === "img" && c.kind === "visual") {
      out += " Content imagery — photography or a product screenshot, not a system asset; do not recreate it as a raster in new work.";
    }
    return out;
  }
  if (c.kind === "table") return `${c.width}px wide${c.border ? `, ${c.border} border` : ""}${c.bg ? `, ${c.bg} fill` : ""}.`;
  if (c.kind === "progress") return `${c.width}×${c.height}px${c.bg ? `, ${c.bg} track` : ""}, ${c.radius}px radius.`;

  const parts: string[] = [];
  parts.push(c.bg ? `${c.bg} fill` : "Transparent fill");
  if (c.border) parts.push(`${c.border} border`);
  if (c.fg && c.kind !== "card") parts.push(`${c.fg} text`);
  if (c.fontFamily && c.kind !== "card") {
    const t = c.transform && c.transform !== "none" ? ` ${c.transform}` : "";
    parts.push(`${c.fontFamily} at ${c.fontSize}px weight ${c.weight}${t}`);
  }
  parts.push(c.radius >= 999 || c.radius >= c.height / 2 - 1 ? "fully rounded" : `${c.radius}px radius`);
  parts.push(`${c.padY}px ${c.padX}px padding`);
  if (c.kind === "card") parts.push(`${c.width}×${c.height}px`);
  else parts.push(`height ~${c.height}px`);
  if (c.shadow) parts.push(`shadow ${c.shadow}`);
  let out = parts.join(", ") + ".";
  if (hover) {
    const changes: string[] = [];
    if (hover.bg !== c.bg) changes.push(`fill → ${hover.bg ?? "transparent"}`);
    if (hover.fg !== c.fg) changes.push(`text → ${hover.fg ?? "inherit"}`);
    if (hover.border !== c.border) changes.push(`border → ${hover.border || "none"}`);
    if (changes.length) out += ` Hover: ${changes.join(", ")}.`;
  }
  return out;
}

/* ----------------------------------------------------------------- patterns */

type Pattern = { name: string; role: string; spec: string; count: number };

/**
 * Components that exist only as arrangements.
 *
 * A nav bar is not a link; it is a row of links at the top of the page with
 * the logo on the left and an action on the right. A logo grid is not an
 * image; it is nine images of the same size in a row. A person describing a
 * system writes these down, and a census of leaf elements cannot, because the
 * thing being described is the parent.
 */
function findPatterns(
  cands: Candidate[],
  clusters: Cluster[],
  containers: Container[],
  viewport: { w: number; h: number; docH: number },
  names: Map<Cluster, string>,
): Pattern[] {
  const out: Pattern[] = [];
  const clusterOf = new Map<number, Cluster>();
  for (const k of clusters) for (const m of k.members) clusterOf.set(m.idx, k);
  // Each logo in a trust row sits in its own <a>; each card in its own
  // <li>. Grouping by parent alone sees 26 groups of one. Try the parent,
  // then the grandparent, then one more level, and keep the first level at
  // which a run of three or more siblings appears.
  const groupAt = (key: "parent" | "grand" | "great") => {
    const m = new Map<number, Candidate[]>();
    for (const c of cands) m.set(c[key], [...(m.get(c[key]) ?? []), c]);
    return m;
  };
  const byParent = new Map<number, Candidate[]>();
  const claimed = new Set<number>();
  for (const level of ["parent", "grand", "great"] as const) {
    for (const [pid, kids] of groupAt(level)) {
      if (pid < 0) continue;
      const fresh = kids.filter((k) => !claimed.has(k.idx));
      if (fresh.length < 3) continue;
      const kinds = new Set(fresh.map((k) => k.kind));
      if (kinds.size !== 1) continue;
      byParent.set(pid, fresh);
      fresh.forEach((k) => claimed.add(k.idx));
    }
  }
  const containerByIdx = new Map(containers.map((c) => [c.idx, c]));

  const layoutOf = (p?: Container) =>
    !p ? "" : p.display.includes("grid") ? `a ${p.columns || "multi"}-column grid` : "a row";

  // Nav bar: controls in the top band, and the container that holds them.
  const topControls = cands.filter((c) => c.kind === "control" && c.top >= 0 && c.top <= 110);
  if (topControls.length >= 3) {
    const bar = containers
      .filter((p) => p.top <= 12 && p.width >= viewport.w * 0.8 && p.height >= 40 && p.height <= 120)
      .sort((a, b) => b.width - a.width)[0];
    const filled = topControls.filter((c) => c.bg && luminance(c.bg) < 0.3).length;
    const height = bar?.height ?? Math.max(...topControls.map((c) => c.top + c.height));
    out.push({
      name: "Top Nav Bar",
      role: "Primary navigation",
      spec: `${bar?.bg ? `${bar.bg} fill` : "Transparent"} on the page ground, ${height}px tall. ` +
        `${topControls.length} links${filled ? `, ${filled} filled action${filled > 1 ? "s" : ""} at the right` : ""}.`,
      count: 1,
    });
    // The logo is the leftmost visual in that band.
    const logo = cands
      .filter((c) => (c.kind === "visual" || c.kind === "avatar") && c.top <= 110 && c.left >= 0 && c.left <= viewport.w * 0.3)
      .sort((a, b) => a.left - b.left)[0];
    if (logo) {
      out.push({
        name: "Logo",
        role: "Brand identity",
        spec: `${logo.media === "svg" ? "Inline SVG" : logo.media === "img" ? "Raster image" : "Mark"}, ${logo.width}×${logo.height}px, top-left of the nav.`,
        count: 1,
      });
    }
  }

  // Footer: a dense band of links at the bottom of the document.
  const footLinks = cands.filter((c) => c.kind === "control" && !c.bg && c.top >= viewport.docH - 1400);
  if (footLinks.length >= 8) {
    const lefts = [...new Set(footLinks.map((c) => Math.round(c.left / 40)))].length;
    out.push({
      name: "Footer",
      role: "Site-wide navigation and legal",
      spec: `${footLinks.length} links in roughly ${Math.min(lefts, 6)} columns at the bottom of the page.`,
      count: 1,
    });
  }

  // Repeated children of one parent.
  for (const [parentIdx, kids] of byParent) {
    if (kids.length < 3 || parentIdx < 0) continue;
    const kinds = new Set(kids.map((k) => k.kind));
    if (kinds.size !== 1) continue;
    const kind = kids[0].kind;
    const ks = new Set(kids.map((k) => clusterOf.get(k.idx)));
    if (ks.size > 2) continue;
    const parent = containerByIdx.get(parentIdx);
    const layout = layoutOf(parent);
    const inTop = kids.every((k) => k.top <= 110);
    if (inTop) continue; // the nav bar already covers these
    const first = [...ks][0]!;
    const childName = names.get(first) ?? kind;
    const sizes = kids.map((k) => Math.max(k.width, k.height));
    const uniform = Math.max(...sizes) - Math.min(...sizes) <= Math.max(...sizes) * 0.35;

    let name: string | null = null; let role = "";
    if (kind === "visual" && kids.length >= 4 && uniform && Math.max(...sizes) <= 220) { name = "Logo Grid"; role = "Social proof — partner or customer marks"; }
    else if (kind === "visual" && kids.length >= 3) { name = "Image Grid"; role = "Gallery of visuals"; }
    else if (kind === "card") { name = "Card Grid"; role = "Comparable items laid out together"; }
    else if (kind === "control" && (kids[0].role === "tab" || parent?.role === "tablist")) { name = "Tab Group"; role = "Switch between views"; }
    else if (kind === "control" && kids.every((k) => !k.bg || nearlySame(k.bg, kids[0].bg)) && kids[0].radius >= 40 && !kids[0].bg) { name = "Tab Group"; role = "Switch between views"; }
    else if (kind === "control" && kids.every((k) => k.bg)) { name = "Button Group"; role = "Related actions side by side"; }
    else if (kind === "control" && kids.length >= 4) { name = "Link List"; role = "A column or row of navigation links"; }
    else if (kind === "badge") { name = "Tag Group"; role = "A set of filters or categories"; }
    else if (kind === "avatar") { name = "Avatar Stack"; role = "Several people, overlapped or in a row"; }
    else if (kind === "field" && kids.length >= 2) { name = "Form"; role = "Fields collected together"; }
    if (!name) continue;
    const existing = out.find((o) => o.name === name);
    const spec = `${kids.length} × ${childName} in ${layout || "a group"}${parent?.gap ? `, ${parent.gap}px gap` : ""}.`;
    if (existing) { existing.count += 1; if (kids.length > Number((existing.spec.match(/^(\d+)/) ?? [0, 0])[1])) existing.spec = spec; }
    else out.push({ name, role, spec, count: 1 });
  }

  return out;
}

/* ---------------------------------------------------------------- assemble */

function assemble(raw: RawPage, palette: Palette, hovers: Map<number, HoverState>): RenderedComponent[] {
  const { candidates, containers, viewport } = raw;
  const clusters = clusterAll(candidates);
  const vw = viewport.w;

  const monochrome = !clusters.some((k) => k.kind === "control" && k.rep.bg && chroma(k.rep.bg) >= 60);

  // Base names, then disambiguation within a base name.
  const named = clusters.map((k) => ({ k, ...baseName(k.rep, palette, monochrome, vw) }));
  const finalNames = disambiguate(named.map((n) => ({ name: n.name, c: n.k.rep })));
  const nameOf = new Map<Cluster, string>();
  named.forEach((n, i) => nameOf.set(n.k, finalNames[i]));
  for (const k of clusters) { const h = hovers.get(k.rep.idx); if (h) k.hover = h; }

  const significance = (k: Cluster) =>
    k.count * Math.log2(2 + (k.rep.width * k.rep.height) / 1000) *
    (k.kind === "control" && k.count === 1 ? 0.3 : 1);

  const alwaysKeep = new Set<Kind>(["table", "code", "quote", "progress", "field", "switch", "checkbox", "radio"]);
  const ranked = clusters
    .filter((k) => k.count >= 2 || alwaysKeep.has(k.kind) || (k.kind === "card" && k.rep.height >= 200) || (k.kind === "visual" && Math.max(k.rep.width, k.rep.height) >= 200))
    .sort((a, b) => significance(b) - significance(a));

  const leaves: RenderedComponent[] = ranked.slice(0, 20).map((k) => ({
    name: nameOf.get(k)!,
    role: named.find((n) => n.k === k)!.role,
    spec: specFor(k.rep, k.hover),
    count: k.count,
  }));

  const patterns = findPatterns(candidates, clusters, containers, viewport, nameOf);

  // Thin borders, by colour, across the whole page. The commonest one is a
  // token: the rule on rows and sections when drawn one-sided or as a
  // pseudo-element, the edge on cards and inputs when drawn all round.
  // The same rgba rule reads #ebe8e4 over eggshell and #f2f2f2 over a white
  // card; they are one token. Fold colours within a few units together and
  // report the one seen most.
  const byColour = new Map<string, { edge: number; box: number; width: string; n: number }>();
  for (const [key, n] of [...raw.hairlines].sort((a, b) => b[1] - a[1])) {
    const [col, width, how] = key.split("|");
    let home = col;
    for (const k of byColour.keys()) if (colourDist(k, col) <= 14) { home = k; break; }
    const e = byColour.get(home) ?? { edge: 0, box: 0, width, n: 0 };
    if (how === "box") e.box += n; else e.edge += n;
    e.n += n;
    byColour.set(home, e);
  }
  const top = [...byColour.entries()].sort((a, b) => (b[1].edge + b[1].box) - (a[1].edge + a[1].box))[0];
  const hairline: RenderedComponent[] = [];
  if (top && top[1].edge + top[1].box >= 3 && !leaves.some((l) => l.name === "Hairline Divider")) {
    const [col, { edge, box, width }] = top;
    hairline.push(
      edge >= 3
        ? { name: "Hairline Divider", role: "Section and row separation", spec: `${width} solid ${col}, drawn as a single edge.`, count: edge }
        : { name: "Hairline Border", role: "The edge on cards, inputs and panels", spec: `${width} solid ${col}, all round.`, count: box },
    );
    if (edge >= 3 && box >= 3) {
      hairline.push({ name: "Hairline Border", role: "The edge on cards, inputs and panels", spec: `${width} solid ${col}, all round.`, count: box });
    }
  }

  // Patterns first: they are the things a reader recognises the page by.
  const all = [...patterns, ...hairline, ...leaves];
  return all.slice(0, 28);
}

/** Read hover states for the representatives of the most-used controls. */
async function readHoverStates(
  page: import("playwright-core").Page,
  raw: RawPage,
  /** How many controls to hover; each costs three round-trips. */
  limit: number,
  deadline: number,
): Promise<Map<number, HoverState>> {
  const out = new Map<number, HoverState>();
  const clusters = clusterAll(raw.candidates).filter((k) => k.kind === "control").sort((a, b) => b.count - a.count).slice(0, limit);
  for (const k of clusters) {
    if (Date.now() > deadline) break;
    const idx = k.rep.idx;
    try {
      const centre = (await page.evaluate(`(() => {
        const el = document.querySelectorAll("body *")[${idx}];
        if (!el) return null;
        el.scrollIntoView({ block: "center", inline: "nearest" });
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      })()`)) as { x: number; y: number } | null;
      if (!centre) continue;
      await page.mouse.move(centre.x, centre.y);
      await page.waitForTimeout(220);
      const st = (await page.evaluate(`(() => {
        const el = document.querySelectorAll("body *")[${idx}];
        if (!el) return null;
        const cs = getComputedStyle(el);
        const toHex = (v) => { const m = v && v.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/); if (!m || (m[4] !== undefined && parseFloat(m[4]) < 0.05)) return null; const h = (n) => parseInt(n, 10).toString(16).padStart(2, "0"); return "#" + h(m[1]) + h(m[2]) + h(m[3]); };
        const bw = Math.round(parseFloat(cs.borderTopWidth) || 0);
        return { bg: toHex(cs.backgroundColor), fg: toHex(cs.color), border: bw > 0 ? bw + "px " + (toHex(cs.borderTopColor) || "") : "" };
      })()`)) as HoverState | null;
      if (st) out.set(idx, st);
    } catch {
      /* a control that cannot be hovered simply has no recorded hover state */
    }
  }
  await page.mouse.move(0, 0).catch(() => {});
  return out;
}

export type RenderOptions = {
  /**
   * Wall-clock the render may spend, in ms. Every phase is sized to what is
   * left — fewer scroll steps, fewer hovers, then none — so a heavy page on a
   * slow remote browser degrades to a thinner capture instead of a timeout.
   */
  budgetMs?: number;
  /**
   * Called as each phase begins and ends, with elapsed ms. A capture that
   * runs out the clock on a remote browser cannot be debugged from outside;
   * this is how it says which phase it was in when time ran out.
   */
  onPhase?: (phase: string, elapsedMs: number) => void;
};

export async function renderSiteDesign(url: string, opts: RenderOptions = {}): Promise<Rendered | null> {
  const remote = remoteEndpoint();
  const executablePath = remote ? null : findBrowser();
  if (!remote && !executablePath) return null;
  const started = Date.now();
  const budget = Math.max(5_000, opts.budgetMs ?? 40_000);
  const deadline = started + budget;
  const left = () => deadline - Date.now();
  const mark = (phase: string) => opts.onPhase?.(phase, Date.now() - started);

  let browser: import("playwright-core").Browser | null = null;
  try {
    const { chromium } = await import("playwright-core");
    mark("connect:start");
    browser = remote
      ? // Attaching costs nothing at deploy time, which is the point: the
        // function stays small and the browser lives with whoever hosts it.
        // Eight seconds is generous for a handshake; a provider that cannot
        // seat a session by then is queued or down, and the CSS-only reading
        // beats waiting on it.
        await chromium.connectOverCDP(remote, { timeout: Math.min(8_000, Math.max(4_000, budget * 0.3)) })
      : await chromium.launch({
          executablePath: executablePath as string,
          args: ["--no-sandbox"],
        });
    mark("connect:done");
    const page = await browser.newPage({
      viewport: VIEWPORT,
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0 Safari/537.36 BlockSmith-Capture/1.0",
      locale: "en-US",
    });
    mark("page:ready");
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: Math.min(NAV_TIMEOUT_MS, Math.max(5_000, budget * 0.45)) });
    mark("goto:done");
    // Let webfonts land and above-the-fold animation settle before measuring.
    await page.waitForTimeout(Math.min(SETTLE_MS, Math.max(300, left() * 0.05)));
    // Sections that mount on scroll are part of the page too — as many
    // steps as a quarter of the remaining budget allows at ~0.4s each on a
    // remote browser, capped at fourteen. Skipped outright when the clock is
    // nearly out: a thinner reading now beats none at all.
    if (left() > 8_000) {
      const steps = Math.max(2, Math.min(14, Math.floor((left() * 0.25) / 400)));
      await page.evaluate(scrollThrough(steps)).catch(() => {});
    }
    mark("scroll:done");

    const raw = (await page.evaluate(COLLECT_IN_PAGE)) as RawPage;
    mark("collect:done");
    // Tuning the detector means looking at what it saw before grouping. Set
    // BLOCKSMITH_DUMP_CANDIDATES to a path ({host} is replaced) to keep it.
    if (process.env.BLOCKSMITH_DUMP_CANDIDATES) {
      const out = process.env.BLOCKSMITH_DUMP_CANDIDATES.replace("{host}", new URL(url).hostname);
      writeFileSync(out, JSON.stringify(raw, null, 1));
    }
    const total = raw.colors.reduce((sum, [, w]) => sum + w, 0) || 1;
    const colors = raw.colors.map(([value, w]) => ({ value, weight: w / total }));

    // Ground is what covers the screen; ink is the darkest heavily-used
    // colour; accent is the most chromatic thing that is neither.
    const ground = colors[0]?.value;
    const ink = [...colors].sort((a, b) => luminance(a.value) - luminance(b.value))[0]?.value;
    const accent = colors
      .filter((c) => c.value !== ground && c.value !== ink)
      .filter((c) => chroma(c.value) >= 60)
      .sort((a, b) => b.weight - a.weight)[0]?.value;

    // Hover states are the most expensive thing here and the least essential;
    // they get whatever time is left, and none if there is little.
    const hoverBudget = left();
    const hovers =
      hoverBudget > 6_000
        ? await readHoverStates(page, raw, Math.min(10, Math.floor(hoverBudget / 1_200)), deadline - 1_000)
        : new Map<number, HoverState>();
    mark("hover:done");

    return {
      colors,
      fonts: raw.fonts,
      components: assemble(raw, { ground, ink, accent }, hovers),
    };
  } catch (err) {
    // Any failure falls back to the text pass rather than failing the capture.
    if (process.env.BLOCKSMITH_DEBUG_RENDER) {
      console.error("[render-site]", err instanceof Error ? err.message : err);
    }
    return null;
  } finally {
    await browser?.close().catch(() => {});
  }
}
