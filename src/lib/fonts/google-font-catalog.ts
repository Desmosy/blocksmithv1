import type { GoogleFontSpec } from "@/lib/fonts/google-map";

export type GoogleFontCatalogEntry = {
  family: string;
  category: "sans" | "serif" | "display" | "mono" | "slab";
  tags: string[];
  weights: number[];
};

/** Curated Google Fonts for LLM matching — not the full 1,500-family catalog. */
export const GOOGLE_FONT_CATALOG: GoogleFontCatalogEntry[] = [
  { family: "Inter", category: "sans", tags: ["neutral", "ui", "readable", "grotesque"], weights: [400, 500, 600, 700] },
  { family: "Roboto", category: "sans", tags: ["neutral", "ui", "material"], weights: [400, 500, 700] },
  { family: "Open Sans", category: "sans", tags: ["friendly", "humanist", "ui"], weights: [400, 600, 700] },
  { family: "Lato", category: "sans", tags: ["warm", "humanist", "ui"], weights: [400, 700] },
  { family: "Montserrat", category: "sans", tags: ["geometric", "display", "tight"], weights: [400, 500, 600, 700] },
  { family: "Poppins", category: "sans", tags: ["geometric", "friendly", "round"], weights: [400, 500, 600, 700] },
  { family: "Nunito", category: "sans", tags: ["round", "friendly", "soft"], weights: [400, 600, 700] },
  { family: "Nunito Sans", category: "sans", tags: ["round", "ui", "compact"], weights: [400, 600, 700] },
  { family: "Work Sans", category: "sans", tags: ["grotesque", "ui", "neutral"], weights: [400, 500, 600, 700] },
  { family: "DM Sans", category: "sans", tags: ["geometric", "modern", "ui"], weights: [400, 500, 700] },
  { family: "Manrope", category: "sans", tags: ["geometric", "modern", "ui"], weights: [400, 500, 600, 700] },
  { family: "Plus Jakarta Sans", category: "sans", tags: ["geometric", "startup", "modern"], weights: [400, 500, 600, 700] },
  { family: "Outfit", category: "sans", tags: ["geometric", "modern", "clean"], weights: [400, 500, 600, 700] },
  { family: "Figtree", category: "sans", tags: ["friendly", "modern", "ui"], weights: [400, 500, 600, 700] },
  { family: "Rubik", category: "sans", tags: ["rounded", "friendly", "ui"], weights: [400, 500, 700] },
  { family: "Source Sans 3", category: "sans", tags: ["humanist", "neutral", "adobe"], weights: [400, 600, 700] },
  { family: "IBM Plex Sans", category: "sans", tags: ["corporate", "technical", "neutral"], weights: [400, 500, 600, 700] },
  { family: "Public Sans", category: "sans", tags: ["government", "neutral", "ui"], weights: [400, 600, 700] },
  { family: "Libre Franklin", category: "sans", tags: ["grotesque", "editorial", "news"], weights: [400, 600, 700] },
  { family: "Barlow", category: "sans", tags: ["condensed", "industrial", "grotesque"], weights: [400, 500, 600, 700] },
  { family: "Barlow Condensed", category: "sans", tags: ["condensed", "tight", "display"], weights: [400, 500, 600, 700] },
  { family: "Roboto Condensed", category: "sans", tags: ["condensed", "news", "compact"], weights: [400, 700] },
  { family: "Oswald", category: "display", tags: ["condensed", "impact", "headline"], weights: [400, 500, 600, 700] },
  { family: "Bebas Neue", category: "display", tags: ["condensed", "all-caps", "impact"], weights: [400] },
  { family: "Anton", category: "display", tags: ["condensed", "impact", "headline"], weights: [400] },
  { family: "Archivo", category: "sans", tags: ["grotesque", "news", "dense"], weights: [400, 500, 600, 700] },
  { family: "Archivo Narrow", category: "sans", tags: ["condensed", "editorial", "tight"], weights: [400, 500, 600, 700] },
  { family: "Space Grotesk", category: "sans", tags: ["geometric", "tech", "startup"], weights: [400, 500, 600, 700] },
  { family: "Sora", category: "sans", tags: ["geometric", "modern", "ui"], weights: [400, 500, 600, 700] },
  { family: "Urbanist", category: "sans", tags: ["geometric", "modern", "minimal"], weights: [400, 500, 600, 700] },
  { family: "Raleway", category: "sans", tags: ["elegant", "thin", "fashion"], weights: [400, 500, 600, 700] },
  { family: "PT Sans", category: "sans", tags: ["humanist", "neutral", "ui"], weights: [400, 700] },
  { family: "Karla", category: "sans", tags: ["grotesque", "quirky", "friendly"], weights: [400, 500, 600, 700] },
  { family: "Mulish", category: "sans", tags: ["minimal", "ui", "neutral"], weights: [400, 600, 700] },
  { family: "Hanken Grotesk", category: "sans", tags: ["grotesque", "modern", "ui"], weights: [400, 500, 600, 700] },
  { family: "Playfair Display", category: "serif", tags: ["editorial", "elegant", "high-contrast"], weights: [400, 500, 600, 700] },
  { family: "Lora", category: "serif", tags: ["editorial", "warm", "readable"], weights: [400, 500, 600, 700] },
  { family: "Merriweather", category: "serif", tags: ["readable", "editorial", "screen"], weights: [400, 700] },
  { family: "Libre Baskerville", category: "serif", tags: ["classic", "editorial", "traditional"], weights: [400, 700] },
  { family: "Cormorant Garamond", category: "serif", tags: ["elegant", "fashion", "high-contrast"], weights: [300, 400, 500, 600, 700] },
  { family: "Source Serif 4", category: "serif", tags: ["neutral", "readable", "adobe"], weights: [400, 500, 600, 700] },
  { family: "Crimson Pro", category: "serif", tags: ["book", "editorial", "classic"], weights: [400, 500, 600, 700] },
  { family: "Fraunces", category: "serif", tags: ["soft", "editorial", "display"], weights: [400, 500, 600, 700] },
  { family: "DM Serif Display", category: "serif", tags: ["display", "editorial", "high-contrast"], weights: [400] },
  { family: "DM Serif Text", category: "serif", tags: ["editorial", "readable"], weights: [400] },
  { family: "Instrument Serif", category: "serif", tags: ["editorial", "modern", "display"], weights: [400] },
  { family: "EB Garamond", category: "serif", tags: ["classic", "book", "traditional"], weights: [400, 500, 600, 700] },
  { family: "Bitter", category: "serif", tags: ["slab", "editorial", "readable"], weights: [400, 700] },
  { family: "Roboto Slab", category: "slab", tags: ["slab", "sturdy", "ui"], weights: [400, 700] },
  { family: "IBM Plex Mono", category: "mono", tags: ["code", "technical", "mono"], weights: [400, 500, 600] },
  { family: "JetBrains Mono", category: "mono", tags: ["code", "developer", "mono"], weights: [400, 500, 600, 700] },
  { family: "Space Mono", category: "mono", tags: ["code", "retro", "mono"], weights: [400, 700] },
  { family: "Roboto Mono", category: "mono", tags: ["code", "neutral", "mono"], weights: [400, 500, 700] },
  { family: "Fira Code", category: "mono", tags: ["code", "ligatures", "mono"], weights: [400, 500, 600, 700] },
  { family: "Source Code Pro", category: "mono", tags: ["code", "adobe", "mono"], weights: [400, 600, 700] },
  { family: "Inconsolata", category: "mono", tags: ["code", "compact", "mono"], weights: [400, 700] },
];

const CATALOG_BY_FAMILY = new Map(
  GOOGLE_FONT_CATALOG.map((e) => [e.family.toLowerCase(), e]),
);

export function isCatalogFamily(family: string): boolean {
  return CATALOG_BY_FAMILY.has(family.trim().toLowerCase());
}

export function catalogEntry(family: string): GoogleFontCatalogEntry | null {
  return CATALOG_BY_FAMILY.get(family.trim().toLowerCase()) ?? null;
}

export function catalogSpec(family: string, weights?: number[]): GoogleFontSpec | null {
  const entry = catalogEntry(family);
  if (!entry) return null;
  return {
    family: entry.family,
    weights: weights?.length ? weights : entry.weights,
  };
}

/** Compact list for LLM prompts. */
export function catalogPromptLines(): string {
  return GOOGLE_FONT_CATALOG.map(
    (e) => `- ${e.family} (${e.category}): ${e.tags.join(", ")}`,
  ).join("\n");
}
