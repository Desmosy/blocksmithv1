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

const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 1_500_000;
const MAX_STYLESHEETS = 4;

export type Extracted = {
  url: string;
  title: string | null;
  colors: { value: string; count: number }[];
  fonts: string[];
  radii: number[];
  spacing: number[];
  fontSizes: number[];
};

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

function collectFonts(css: string): string[] {
  const out = new Set<string>();
  for (const m of css.matchAll(/font-family\s*:\s*([^;{}]+)/gi)) {
    const first = m[1].split(",")[0].trim().replace(/^["']|["']$/g, "");
    // Skip generics and CSS variables — neither names a typeface.
    if (!first || first.startsWith("var(") || first.startsWith("--")) continue;
    if (/^(inherit|initial|unset|sans-serif|serif|monospace|system-ui|ui-\w+|cursive|fantasy)$/i.test(first)) {
      continue;
    }
    out.add(first);
  }
  return [...out].slice(0, 8);
}

/** Absolute URLs for the page's own stylesheets, capped. */
function stylesheetUrls(html: string, base: URL): string[] {
  const urls: string[] = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/rel\s*=\s*["']?stylesheet/i.test(tag)) continue;
    const href = tag.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    try {
      const abs = new URL(href, base);
      if (abs.protocol === "http:" || abs.protocol === "https:") {
        urls.push(abs.href);
      }
    } catch {
      /* skip unparseable href */
    }
    if (urls.length >= MAX_STYLESHEETS) break;
  }
  return urls;
}

export async function extractSiteDesign(rawUrl: string): Promise<Extracted> {
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

  const colorCounts = collectColors(css);
  const colors = [...colorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14)
    .map(([value, count]) => ({ value, count }));

  return {
    url: url.href,
    title,
    colors,
    fonts: collectFonts(css),
    radii: collectNumbers(css, ["border-radius"]).slice(0, 8),
    spacing: collectNumbers(css, ["padding", "margin", "gap"]).slice(0, 10),
    fontSizes: collectNumbers(css, ["font-size"]).slice(0, 10),
  };
}
