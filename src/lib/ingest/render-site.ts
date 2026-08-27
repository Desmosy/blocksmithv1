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

import { existsSync, readdirSync } from "fs";
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
 */
const COLLECT_IN_PAGE = `(() => {
  const rgbToHex = (v) => {
    const m = v.match(/rgba?\\(\\s*(\\d+)[,\\s]+(\\d+)[,\\s]+(\\d+)(?:[,\\s/]+([\\d.]+))?/);
    if (!m) return null;
    if (m[4] !== undefined && Number(m[4]) < 0.05) return null;
    const hex = (n) => Number(n).toString(16).padStart(2, "0");
    return "#" + hex(m[1]) + hex(m[2]) + hex(m[3]);
  };
  const px = (v) => Math.round(parseFloat(v) || 0);
  const area = new Map();
  const fontUse = new Map();
  const candidates = [];

  const all = Array.prototype.slice.call(document.querySelectorAll("body *"), 0, 4000);
  for (const el of all) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) < 0.05) continue;

    const size = rect.width * rect.height;
    const bg = rgbToHex(cs.backgroundColor);
    if (bg) area.set(bg, (area.get(bg) || 0) + size);

    const text = (el.textContent || "").trim();
    let own = false;
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && (n.textContent || "").trim().length > 0) { own = true; break; }
    }
    if (own && text) {
      const fg = rgbToHex(cs.color);
      const w = Math.min(text.length, 400) * px(cs.fontSize);
      if (fg) area.set(fg, (area.get(fg) || 0) + w);
      const fam = cs.fontFamily.split(",")[0].replace(/["']/g, "").trim();
      if (fam) fontUse.set(fam, (fontUse.get(fam) || 0) + w);
    }

    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute("role") || "";
    const radius = px(cs.borderTopLeftRadius);
    const bordered = px(cs.borderTopWidth) > 0;

    // Detect controls by how they look, not by tag. Most sites build buttons
    // out of divs — monad.com's are divs with a 100px radius — so requiring
    // <button> or <a> finds almost nothing on a modern page.
    const shortLabel = text.length > 0 && text.length <= 40;
    const controlSized = rect.height >= 24 && rect.height <= 90 && rect.width >= 40 && rect.width <= 460;
    const looksClickable = bg !== null || bordered || radius >= 6;
    const nativeControl =
      tag === "button" || tag === "input" || tag === "textarea" || tag === "select" || role === "button";
    const isControl =
      (nativeControl && rect.height <= 90) ||
      (shortLabel && controlSized && looksClickable && el.children.length <= 4);
    const looksLikeCard =
      rect.width >= 180 && rect.height >= 90 && el.children.length >= 2 &&
      (px(cs.borderTopWidth) > 0 || cs.boxShadow !== "none" || bg !== null) &&
      px(cs.paddingTop) >= 8;

    // A graphic carries no text and often no children, so every test above
    // rejects it — which is why an illustration-led page came back as nothing
    // but links. Images, inline SVG, canvas, and the gradient blobs modern
    // marketing pages are built from are all real parts of a design system.
    const bgImage = cs.backgroundImage && cs.backgroundImage !== "none" ? cs.backgroundImage : "";
    const isMedia = tag === "img" || tag === "svg" || tag === "canvas" || tag === "video";
    const looksLikeVisual =
      (isMedia || bgImage.length > 0) &&
      rect.width >= 48 && rect.height >= 48 &&
      text.length <= 8;

    // A rule is a line: wide, and one or two pixels tall. It has no text, no
    // padding and no children, so nothing else here can see it either.
    // A rule is drawn as often with border-bottom as border-top, and an <hr>
    // may carry neither. Checking only the top edge missed most of them.
    const anyBorder =
      px(cs.borderTopWidth) > 0 || px(cs.borderBottomWidth) > 0 ||
      px(cs.borderLeftWidth) > 0 || px(cs.borderRightWidth) > 0;
    const looksLikeDivider =
      rect.width >= 80 && rect.height <= 4 &&
      text.length === 0 &&
      (tag === "hr" || bg !== null || anyBorder);

    if (!isControl && !looksLikeCard && !looksLikeVisual && !looksLikeDivider) continue;

    candidates.push({
      kind: isControl
        ? ((tag === "input" || tag === "textarea" || tag === "select") ? "field" : "control")
        : looksLikeDivider ? "divider"
        : looksLikeVisual ? "visual"
        : "card",
      tag: tag,
      bg: bg,
      fg: rgbToHex(cs.color),
      border: px(cs.borderTopWidth) > 0 ? px(cs.borderTopWidth) + "px " + (rgbToHex(cs.borderTopColor) || "") : "",
      radius: px(cs.borderTopLeftRadius),
      padY: px(cs.paddingTop),
      padX: px(cs.paddingLeft),
      height: Math.round(rect.height),
      fontSize: px(cs.fontSize),
      fontFamily: cs.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
      weight: cs.fontWeight,
      transform: cs.textTransform,
      shadow: cs.boxShadow === "none" ? "" : cs.boxShadow.slice(0, 60),
      media: isMedia ? tag : bgImage ? bgImage.slice(0, 80) : "",
      label: (function () {
        const half = text.slice(0, Math.floor(text.length / 2));
        // "LoginLogin" is one label rendered twice by a hover-state span.
        return (half && text === half + half ? half : text).slice(0, 28);
      })()
    });
  }

  const byWeight = (a, b) => b[1] - a[1];
  return {
    colors: Array.from(area.entries()).sort(byWeight).slice(0, 18),
    fonts: Array.from(fontUse.entries()).sort(byWeight).slice(0, 6).map((e) => e[0]),
    candidates: candidates.slice(0, 600)
  };
})()`;

type Candidate = {
  kind: "control" | "field" | "card" | "visual" | "divider";
  tag: string;
  bg: string | null;
  fg: string | null;
  border: string;
  radius: number;
  padY: number;
  padX: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  weight: string;
  transform: string;
  shadow: string;
  label: string;
  /** For a visual: the tag, or the background-image it is painted with. */
  media?: string;
};

/**
 * Name a control by the role its fill plays in the palette.
 *
 * Numbering clusters by arrival order gives "Pill Button 2, 3, 4", which tells
 * a reader nothing. The accent fill is the primary action, the ink fill is the
 * one beside it, an outline is the quiet one — which is what a designer would
 * have called them anyway.
 */
function nameFor(
  c: Candidate,
  index: number,
  palette?: { accent?: string; ink?: string; ground?: string },
  /** No saturated fill anywhere on the page — dark is the primary treatment. */
  monochrome = false,
): { name: string; role: string } {
  if (c.kind === "field") {
    return { name: "Text Input Field", role: "Single-line entry in forms and search" };
  }
  if (c.kind === "card") {
    return c.shadow
      ? { name: "Elevated Card", role: "Raised content block" }
      : { name: "Card", role: "Content block separated by a border" };
  }
  if (c.kind === "divider") {
    return { name: "Hairline Divider", role: "Section separation" };
  }
  if (c.kind === "visual") {
    const gradient = /gradient/i.test(c.media ?? "");
    const round = c.radius >= 999 || c.radius >= c.height / 2;
    if (gradient && round) {
      return { name: "Gradient Orb", role: "Decorative product visual" };
    }
    if (gradient) return { name: "Gradient Panel", role: "Decorative surface" };
    if (c.tag === "svg") return { name: "Icon", role: "Inline pictogram" };
    return { name: "Image", role: "Photography or illustration" };
  }

  const pill = c.radius >= 40;
  const shape = pill ? "Pill Button" : "Button";
  const fill = c.bg?.toLowerCase();
  const same = (a?: string, b?: string) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());

  // Classify a fill by what it *is*, not by matching one exact token. A page
  // often has several near-blacks — monad.com uses #000000 and #242424 — and
  // an exact match against whichever happens to be darkest calls the other one
  // primary.
  const rgb = fill ? [1, 3, 5].map((i) => parseInt(fill.slice(i, i + 2), 16)) : null;
  const luminance = rgb ? (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255 : 1;
  const saturation = rgb ? Math.max(...rgb) - Math.min(...rgb) : 0;

  /** Two colours a reader cannot tell apart are the same colour. */
  const nearlySame = (a?: string, b?: string) => {
    if (!a || !b) return false;
    if (a.toLowerCase() === b.toLowerCase()) return true;
    const ch = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [x, y] = [ch(a), ch(b)];
    return x.every((v, i) => Math.abs(v - y[i]) <= 6);
  };

  // A light fill with a visible border is an outline treatment however close
  // its fill happens to be to the page — monad.com's ghost button sits on
  // #f8f3f1 against a #f6f3f1 ground, two units apart and indistinguishable.
  if (c.border && luminance > 0.7) {
    return { name: `Ghost ${shape}`, role: "Lower-weight action beside a primary" };
  }

  // A fill that matches the page reads as an outline treatment, whatever the
  // CSS says.
  if (!c.bg || nearlySame(fill, palette?.ground)) {
    return c.border
      ? { name: `Ghost ${shape}`, role: "Lower-weight action beside a primary" }
      : { name: "Text Link", role: "Inline navigation" };
  }
  if (same(fill, palette?.accent) || (saturation >= 60 && luminance < 0.75)) {
    return { name: `Primary ${shape}`, role: "The primary conversion action" };
  }
  if (luminance < 0.25) {
    // On a page with no accent to be secondary to, the black button is the
    // primary action — calling it "Secondary" describes a hierarchy the page
    // does not have.
    return monochrome
      ? { name: `Filled ${shape}`, role: "The primary action" }
      : { name: `Secondary ${shape}`, role: "A committing action that is not the primary" };
  }
  if (luminance > 0.85) {
    return { name: `Inverse ${shape}`, role: "An action sitting on a dark surface" };
  }
  return { name: shape, role: "A filled action" };
}

/** Prose spec in the same voice the authored systems use. */
function specFor(c: Candidate): string {
  // A rule and a graphic are not described by type size and padding. Running
  // them through the control spec produced lines like "Transparent fill, at
  // 16px weight 400, 0px radius, 0px 0px padding" — true of nothing worth
  // knowing.
  if (c.kind === "divider") {
    const line = c.border || (c.bg ? `${c.bg} rule` : "hairline rule");
    return `${line}, ${c.height}px tall.`;
  }
  if (c.kind === "visual") {
    const shape =
      c.radius >= 999 || c.radius >= c.height / 2
        ? "circular"
        : c.radius > 0
          ? `${c.radius}px radius`
          : "square-cornered";
    const paint = /gradient/i.test(c.media ?? "")
      ? "gradient fill"
      : c.tag === "svg"
        ? "inline SVG"
        : c.tag === "img"
          ? "raster image"
          : c.bg
            ? `${c.bg} fill`
            : "image fill";
    return `${paint}, ${shape}, roughly ${c.height}px tall.`;
  }

  const parts: string[] = [];
  parts.push(c.bg ? `${c.bg} fill` : "Transparent fill");
  if (c.border) parts.push(`${c.border} border`);
  if (c.fg) parts.push(`${c.fg} text`);
  if (c.fontFamily) {
    const t = c.transform && c.transform !== "none" ? ` ${c.transform}` : "";
    parts.push(`${c.fontFamily} at ${c.fontSize}px weight ${c.weight}${t}`);
  }
  parts.push(`${c.radius >= 999 ? "fully rounded" : `${c.radius}px radius`}`);
  parts.push(`${c.padY}px ${c.padX}px padding`);
  if (c.height) parts.push(`height ~${c.height}px`);
  if (c.shadow) parts.push(`shadow ${c.shadow}`);
  return parts.join(", ") + ".";
}

/** Group identical treatments so ten buttons become one component. */
function cluster(
  candidates: Candidate[],
  palette?: { accent?: string; ink?: string; ground?: string },
): RenderedComponent[] {
  const groups = new Map<string, { c: Candidate; count: number }>();
  for (const c of candidates) {
    const key = [c.kind, c.bg, c.fg, c.border, c.radius, c.padY, c.padX, c.fontSize, c.transform].join("|");
    const found = groups.get(key);
    if (found) found.count += 1;
    else groups.set(key, { c, count: 1 });
  }

  const measured = [...groups.values()]
    .filter((g) => g.count >= 2 || g.c.kind !== "card")
    .sort((a, b) => b.count - a.count);

  /**
   * A page whose buttons are all black has no saturated accent to find, and
   * hunting for one lands on whatever stray colour happens to be most vivid.
   * When nothing here is saturated, dark *is* the primary treatment — which is
   * how a reader sees it — rather than "secondary because it isn't the accent".
   */
  const monochrome = !measured.some((g) => {
    const f = g.c.bg?.toLowerCase();
    if (!f || f.length < 7) return false;
    const ch = [1, 3, 5].map((i) => parseInt(f.slice(i, i + 2), 16));
    return Math.max(...ch) - Math.min(...ch) >= 60;
  });

  /**
   * Merge by the component each measurement describes, not by the pixels.
   *
   * Grouping on exact values treats a nav link at 16px and the same link at
   * 17px as two components, so one link rendered at nine sizes came out as
   * "Text Link" through "Text Link 9" — nine entries for one thing, filling
   * the list and crowding out everything real. Classify first, then merge what
   * lands on the same name, keeping the most-used variant as the spec and
   * summing what they were seen doing.
   */
  const byRole = new Map<string, { name: string; role: string; c: Candidate; count: number }>();
  for (const [i, g] of measured.entries()) {
    const { name, role } = nameFor(g.c, i, palette, monochrome);
    const found = byRole.get(name);
    if (found) {
      // `measured` is sorted by count, so the variant already held is the
      // most-used one and stays as the spec; this one only adds to the tally.
      found.count += g.count;
    } else {
      byRole.set(name, { name, role, c: g.c, count: g.count });
    }
  }

  return [...byRole.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)
    .map((g) => ({
      name: g.name,
      role: g.role,
      spec: specFor(g.c),
      count: g.count,
    }));
}

export async function renderSiteDesign(url: string): Promise<Rendered | null> {
  const remote = remoteEndpoint();
  const executablePath = remote ? null : findBrowser();
  if (!remote && !executablePath) return null;

  let browser: import("playwright-core").Browser | null = null;
  try {
    const { chromium } = await import("playwright-core");
    browser = remote
      ? // Attaching costs nothing at deploy time, which is the point: the
        // function stays small and the browser lives with whoever hosts it.
        await chromium.connectOverCDP(remote, { timeout: NAV_TIMEOUT_MS })
      : await chromium.launch({
          executablePath: executablePath as string,
          args: ["--no-sandbox"],
        });
    const page = await browser.newPage({
      viewport: VIEWPORT,
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0 Safari/537.36 BlockSmith-Capture/1.0",
      locale: "en-US",
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
    // Let webfonts land and above-the-fold animation settle before measuring.
    await page.waitForTimeout(SETTLE_MS);

    const raw = (await page.evaluate(COLLECT_IN_PAGE)) as {
      colors: [string, number][];
      fonts: string[];
      candidates: unknown[];
    };
    const total = raw.colors.reduce((sum, [, w]) => sum + w, 0) || 1;

    const colors = raw.colors.map(([value, w]) => ({ value, weight: w / total }));

    // Ground is what covers the screen; ink is the darkest heavily-used
    // colour; accent is the most chromatic thing that is neither.
    const lum = (h: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
      const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const chroma = (h: string) => {
      const v = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
      return Math.max(...v) - Math.min(...v);
    };
    const ground = colors[0]?.value;
    const ink = [...colors].sort((a, b) => lum(a.value) - lum(b.value))[0]?.value;
    const accent = colors
      .filter((c) => c.value !== ground && c.value !== ink)
      .filter((c) => chroma(c.value) >= 60)
      .sort((a, b) => b.weight - a.weight)[0]?.value;

    return {
      colors,
      fonts: raw.fonts,
      components: cluster(raw.candidates as unknown as Candidate[], { ground, ink, accent }),
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
