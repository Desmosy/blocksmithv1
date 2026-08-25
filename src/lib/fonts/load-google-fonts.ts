import type { TypographyFamily } from "@/lib/blocks/types";
import type { FontResolutionMap } from "@/lib/fonts/font-resolve";
import { collectWikiFontSpecs } from "@/lib/fonts/resolve-wiki-fonts";
import { googleFontsUrl, type GoogleFontSpec } from "@/lib/fonts/google-map";

export { collectWikiFontSpecs as collectGoogleFontSpecs };

export function wikiFontsStylesheetHref(
  typography: TypographyFamily[],
  fontResolutions?: FontResolutionMap,
): string | null {
  const specs = collectWikiFontSpecs(typography, fontResolutions);
  return specs.length > 0 ? googleFontsUrl(specs) : null;
}

/** Loads Google Fonts for a design system into document.head */
export function loadGoogleFontsForTypography(
  typography: TypographyFamily[],
  fontResolutions?: FontResolutionMap,
): void {
  if (typeof document === "undefined") return;

  const href = wikiFontsStylesheetHref(typography, fontResolutions);
  if (!href) return;

  const id = "blocksmith-google-fonts";
  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  link.href = href;
}

/** Wait until loaded faces are ready (reduces FOUT after visualize). */
export async function loadGoogleFontsForTypographyAsync(
  typography: TypographyFamily[],
  fontResolutions?: FontResolutionMap,
): Promise<void> {
  loadGoogleFontsForTypography(typography, fontResolutions);
  if (typeof document === "undefined") return;

  const specs: GoogleFontSpec[] = collectWikiFontSpecs(
    typography,
    fontResolutions,
  );
  await Promise.allSettled(
    specs.map((s) =>
      document.fonts.load(`400 16px "${s.family}"`),
    ),
  );
}
