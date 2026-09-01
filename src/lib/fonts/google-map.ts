/** Maps Apollo substitute names to Google Fonts CSS family + weights */
export interface GoogleFontSpec {
  family: string;
  weights: number[];
}

const MAP: Record<string, GoogleFontSpec> = {
  Montserrat: { family: "Montserrat", weights: [400, 500, 600, 700] },
  Inter: { family: "Inter", weights: [400, 500, 600, 700] },
  "Inter Variable": { family: "Inter", weights: [400, 500, 600, 700] },
  "DM Sans": { family: "DM Sans", weights: [400, 500, 700] },
  Manrope: { family: "Manrope", weights: [400, 500, 600, 700] },
  "Roboto Condensed": { family: "Roboto Condensed", weights: [400, 700] },
  "IBM Plex Mono": { family: "IBM Plex Mono", weights: [400, 500, 600] },
  "Cormorant Garamond": { family: "Cormorant Garamond", weights: [300, 400, 500] },
  "Source Serif 4": { family: "Source Serif 4", weights: [400, 500, 600, 700] },
  Lora: { family: "Lora", weights: [400, 500, 600, 700] },
  "Crimson Pro": { family: "Crimson Pro", weights: [400, 500, 600, 700] },
  "Libre Baskerville": { family: "Libre Baskerville", weights: [300, 400, 700] },
  "JetBrains Mono": { family: "JetBrains Mono", weights: [400, 500, 600] },
  "Space Mono": { family: "Space Mono", weights: [400, 700] },
  Oswald: { family: "Oswald", weights: [400, 500, 600, 700] },
  Anton: { family: "Anton", weights: [400] },
  "Bebas Neue": { family: "Bebas Neue", weights: [400] },
  "Sofia Pro": { family: "Sofia Pro", weights: [400, 500, 600, 700] },
  "Playfair Display": { family: "Playfair Display", weights: [400, 500, 600, 700] },
  "DM Serif Display": { family: "DM Serif Display", weights: [400, 500, 600, 700] },
  "General Sans": { family: "General Sans", weights: [400, 500, 600, 700] },
  "Work Sans": { family: "Work Sans", weights: [400, 500, 600, 700] },
  "Plus Jakarta Sans": { family: "Plus Jakarta Sans", weights: [400, 500, 600, 700] },
  "Instrument Serif": { family: "Instrument Serif", weights: [400, 500, 600, 700] },
  "Fraunces": { family: "Fraunces", weights: [400, 500, 600, 700] },
};

export function googleFontFromSubstitute(substitute: string): GoogleFontSpec | null {
  const key = substitute?.trim().replace(/['"]/g, "");
  if (!key) return null;
  if (MAP[key]) return MAP[key];

  // Comma-separated list — try each (avoids matching "Inter" inside "Inter, DM Sans")
  if (key.includes(",")) {
    for (const part of key.split(",").map((p) => p.trim())) {
      const hit = googleFontFromSubstitute(part);
      if (hit) return hit;
    }
    return null;
  }

  const partial = Object.keys(MAP).find(
    (k) =>
      key.toLowerCase() === k.toLowerCase() ||
      key.toLowerCase().startsWith(`${k.toLowerCase()} `),
  );
  return partial ? MAP[partial] : null;
}

export function googleFontsUrl(specs: GoogleFontSpec[]): string {
  // A capture records whatever case the page used, so the same face can arrive
  // twice — "EB Garamond" from the catalogue and "Eb garamond" from the
  // document. Asking Google for both wastes a request and, for the spelling
  // that is not a real family, returns nothing. Merge on the folded name and
  // keep the better-cased spelling.
  const merged = new Map<string, GoogleFontSpec>();
  for (const spec of specs) {
    const key = spec.family.trim().toLowerCase();
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...spec, weights: [...spec.weights] });
      continue;
    }
    existing.weights = [...new Set([...existing.weights, ...spec.weights])].sort(
      (a, b) => a - b,
    );
    // Prefer the spelling that looks like a real family name over a
    // sentence-cased one derived from a heading.
    if (/[A-Z]/.test(spec.family.slice(1))) existing.family = spec.family;
  }

  const params = [...merged.values()]
    .map((s) => `family=${s.family.replace(/ /g, "+")}:wght@${s.weights.join(";")}`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}
