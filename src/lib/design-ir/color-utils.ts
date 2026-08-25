/** Shared hex extraction — safe for client bundles (no semantic compiler deps). */
export function extractHexes(text: string): string[] {
  return [...text.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase());
}

export type Rgb = { r: number; g: number; b: number };

/** Parse #rgb / #rrggbb (ignores alpha) → 0-255 channels, or null. */
export function parseHex(hex: string): Rgb | null {
  if (typeof hex !== "string") return null;
  const m = hex.trim().match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function isHex(value: string | undefined | null): value is string {
  return typeof value === "string" && parseHex(value) !== null;
}

function toHex2(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, "0");
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
}

function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance (0 = black, 1 = white). */
export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  return (
    0.2126 * channelLuminance(rgb.r) +
    0.7152 * channelLuminance(rgb.g) +
    0.0722 * channelLuminance(rgb.b)
  );
}

/** WCAG contrast ratio between two colors (1–21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

/** Linear sRGB blend of two hexes; t = weight of `a` (1 = all a, 0 = all b). */
export function mixHex(a: string, b: string, t: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return a;
  const w = Math.max(0, Math.min(1, t));
  return rgbToHex({
    r: ca.r * w + cb.r * (1 - w),
    g: ca.g * w + cb.g * (1 - w),
    b: ca.b * w + cb.b * (1 - w),
  });
}

/**
 * Pick the foreground with the best contrast on `bg` from `candidates`,
 * falling back to pure black/white. Guarantees a legible result on any surface.
 */
export function bestForeground(bg: string, candidates: string[]): string {
  if (!isHex(bg)) return candidates.find(isHex) ?? "#1a1a1a";
  const pool = [...candidates.filter(isHex), "#ffffff", "#000000"];
  let best = pool[0];
  let bestRatio = -1;
  for (const c of pool) {
    const ratio = contrastRatio(c, bg);
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = c;
    }
  }
  return best;
}

/**
 * Keep `fg` if it reads on `bg` at `min` contrast; otherwise swap to the most
 * legible black/white. Non-hex inputs pass through untouched.
 */
export function ensureReadable(fg: string, bg: string, min = 4.5): string {
  if (!isHex(fg) || !isHex(bg)) return fg;
  if (contrastRatio(fg, bg) >= min) return fg;
  return bestForeground(bg, []);
}

/**
 * Resolve secondary/muted text: must be distinct from the surface and at least
 * `min` contrast. If the doc's pick fails (e.g. it reused a background token),
 * derive an on-palette mid-tone by blending the body text toward the surface.
 */
export function legibleMuted(
  candidate: string,
  bg: string,
  text: string,
  min = 2.4,
): string {
  if (
    isHex(candidate) &&
    isHex(bg) &&
    candidate.toLowerCase() !== bg.toLowerCase() &&
    contrastRatio(candidate, bg) >= min
  ) {
    return candidate;
  }
  if (isHex(text) && isHex(bg)) {
    // Step the blend toward text until it clears the threshold.
    for (const t of [0.55, 0.65, 0.75, 0.85, 1]) {
      const mixed = mixHex(text, bg, t);
      if (contrastRatio(mixed, bg) >= min) return mixed;
    }
    return text;
  }
  return isHex(candidate) ? candidate : "#6b6b6b";
}

/**
 * Final guardrail over a resolved wiki-chrome map. Role-matchers (and the AI
 * refinement) read prose and can pick a foreground that collides with its
 * surface — e.g. a token labelled "muted surfaces" used as muted *text*, or a
 * CTA label that fails contrast on the accent. This keeps every text/surface
 * pairing legible regardless of how the doc is written, deriving on-palette
 * tones only when the supplied value fails. Operates on a copy.
 *
 * Client-safe: pure color math, no parser/server deps.
 */
export function enforceChromeLegibility(
  input: Record<string, string>,
): Record<string, string> {
  const chrome = { ...input };
  const bg = chrome["--wiki-bg"];
  const accent = chrome["--wiki-accent"];

  // Body + muted text against the page background.
  chrome["--wiki-text"] = ensureReadable(chrome["--wiki-text"], bg);
  chrome["--wiki-muted"] = legibleMuted(
    chrome["--wiki-muted"],
    bg,
    chrome["--wiki-text"],
  );

  // Sidebar text reads on the sidebar surface (which may differ from the page).
  const sidebar = chrome["--wiki-sidebar"];
  if (isHex(sidebar)) {
    chrome["--wiki-muted"] = legibleMuted(
      chrome["--wiki-muted"],
      sidebar,
      chrome["--wiki-text"],
    );
  }

  // Label on the primary accent (CTA fill, active nav) must be readable.
  if (isHex(accent)) {
    chrome["--wiki-cta-on-accent"] = bestForeground(accent, [
      chrome["--wiki-cta-on-accent"],
      chrome["--wiki-bg"],
      chrome["--wiki-text"],
    ]);
  }

  // Nav chrome legible against its own (possibly dark) background.
  const navBg = chrome["--wiki-nav-bg"];
  chrome["--wiki-nav-text"] = ensureReadable(chrome["--wiki-nav-text"], navBg);
  chrome["--wiki-nav-muted"] = legibleMuted(
    chrome["--wiki-nav-muted"],
    navBg,
    chrome["--wiki-nav-text"],
  );

  return chrome;
}
