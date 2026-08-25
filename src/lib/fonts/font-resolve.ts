import type { TypographyFamily } from "@/lib/blocks/types";
import {
  catalogSpec,
  isCatalogFamily,
} from "@/lib/fonts/google-font-catalog";
import {
  googleFontFromSubstitute,
  type GoogleFontSpec,
} from "@/lib/fonts/google-map";
import {
  fontStackFromFamily,
  inferFontKind,
  pickGoogleFontSpec,
} from "@/lib/fonts/font-stack";
function parseFontWeights(weights: string | undefined): number[] {
  if (!weights?.trim()) return [400, 500, 600, 700];
  const parsed = [...weights.matchAll(/\d{3}/g)].map((m) => Number(m[0]));
  return parsed.length
    ? [...new Set(parsed)].sort((a, b) => a - b)
    : [400, 500, 600, 700];
}

export type FontResolution = {
  googleFamily: string;
  weights: number[];
  sourceName: string;
  reason?: string;
  model?: string;
};

export type FontResolutionMap = Record<string, FontResolution>;

const SKIP_FONT_NAMES = new Set([
  "arial",
  "system-ui",
  "helvetica",
  "helvetica neue",
  "sans-serif",
  "serif",
  "monospace",
  "times new roman",
  "georgia",
  "-apple-system",
  "blinkmacsystemfont",
  "segoe ui",
  "roboto",
]);

function isResolvableFontName(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (!n || SKIP_FONT_NAMES.has(n)) return false;
  if (n.includes("detected in extracted")) return false;
  return true;
}

/** Stable key per typography row (font name slug). */
export function fontResolveKey(font: TypographyFamily): string {
  return font.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function deterministicSpec(font: TypographyFamily): GoogleFontSpec | null {
  const weights = parseFontWeights(font.weights);
  const byName = googleFontFromSubstitute(font.name);
  if (byName) return byName;

  if (font.substitute?.trim()) {
    const kind = inferFontKind(font);
    const fromSub = pickGoogleFontSpec(font.substitute, {
      preferSerif: kind === "serif",
      skipInter: kind === "sans",
    });
    if (fromSub) return fromSub;
  }

  const cleanName = font.name.trim().replace(/['"]/g, "");
  if (isCatalogFamily(cleanName)) {
    return catalogSpec(cleanName, weights);
  }

  return null;
}

export function isFontDeterministicallyResolved(font: TypographyFamily): boolean {
  return deterministicSpec(font) !== null;
}

/** Typography rows that still need AI / IR cache lookup. */
export function listFontsNeedingResolve(
  typography: TypographyFamily[],
  cached?: FontResolutionMap,
): TypographyFamily[] {
  const needed: TypographyFamily[] = [];
  for (const font of typography) {
    if (!isResolvableFontName(font.name)) continue;
    const key = fontResolveKey(font);
    if (cached?.[key]?.googleFamily) continue;
    if (!isFontDeterministicallyResolved(font)) {
      needed.push(font);
    }
  }
  return needed;
}

export function resolutionToSpec(resolution: FontResolution): GoogleFontSpec {
  const catalog = catalogSpec(resolution.googleFamily, resolution.weights);
  return (
    catalog ?? {
      family: resolution.googleFamily,
      weights: resolution.weights.length
        ? resolution.weights
        : [400, 500, 600, 700],
    }
  );
}

export function specForFont(
  font: TypographyFamily,
  resolutions?: FontResolutionMap,
): GoogleFontSpec | null {
  const key = fontResolveKey(font);
  const cached = resolutions?.[key];
  if (cached?.googleFamily) {
    return resolutionToSpec(cached);
  }
  return deterministicSpec(font);
}

export function fontStackWithResolutions(
  font: TypographyFamily,
  resolutions?: FontResolutionMap,
): string {
  const spec = specForFont(font, resolutions);
  const kind = inferFontKind(font);
  if (spec) {
    const fallback =
      kind === "serif" ? "serif" : kind === "mono" ? "monospace" : "sans-serif";
    return `"${spec.family}", ui-${fallback}, system-ui, ${fallback}`;
  }
  return fontStackFromFamily(font, kind);
}

export function compileFontStacksWithResolutions(
  typography: TypographyFamily[],
  resolutions?: FontResolutionMap,
): Record<string, string> {
  const stacks: Record<string, string> = {};
  for (const font of typography) {
    const slug = fontResolveKey(font);
    const key = font.cssVar?.trim()
      ? font.cssVar.startsWith("--")
        ? font.cssVar
        : `--font-${font.cssVar}`
      : slug
        ? `--font-${slug}`
        : "";
    if (!key) continue;
    stacks[key] = fontStackWithResolutions(font, resolutions);
  }
  return stacks;
}
