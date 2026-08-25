import type { TypographyFamily } from "@/lib/blocks/types";
import type { FontResolutionMap } from "@/lib/fonts/font-resolve";
import { wikiFontsStylesheetHref } from "@/lib/fonts/load-google-fonts";

/**
 * Loads all wiki typography (body + display + substitutes) from Google Fonts on first paint.
 */
export function WikiFontFaces({
  typography,
  fontResolutions,
}: {
  typography: TypographyFamily[];
  fontResolutions?: FontResolutionMap;
}) {
  const href = wikiFontsStylesheetHref(typography, fontResolutions);
  if (!href) return null;

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        id="blocksmith-wiki-fonts"
        rel="stylesheet"
        href={href}
      />
    </>
  );
}
