import type { DesignSystem } from "@/lib/blocks/types";

export type WikiVisualRules = {
  cardShadow: string;
  cardBorder: string;
  ctaFill: string;
  ctaBorder: string;
  headingLetterSpacing: string;
  bodyLetterSpacing: string;
  fontFeatureSettings: string;
  navDivider: string;
  elevatedShadow: string;
};

function designCorpus(system: DesignSystem): string {
  return [
    system.overview,
    system.layoutNotes,
    ...(system.dos ?? []),
    ...(system.donts ?? []),
    ...system.components.map((c) => `${c.title} ${c.role} ${c.description}`),
  ].join("\n");
}

/**
 * Type-scale tables often use "—" / "–" / "-" / "n/a" to mean "no tracking".
 * Those are not valid `letter-spacing` values, so coerce anything that isn't a
 * real CSS length (or `normal`) back to the supplied fallback.
 */
function sanitizeLetterSpacing(
  value: string | undefined,
  fallback: string,
): string {
  const v = (value ?? "").trim();
  if (!v || /^(normal|none|n\/a|na|default|auto)$/i.test(v)) {
    return /^normal$/i.test(v) ? "normal" : fallback;
  }
  if (/^—|^–|^-$/.test(v)) return fallback;
  if (/^-?(\d+(\.\d+)?|\.\d+)(em|px|rem|%|ex|ch)$/.test(v)) return v;
  // Bare number (e.g. "-0.02") → interpret as em, the tracking convention.
  if (/^-?(\d+(\.\d+)?|\.\d+)$/.test(v)) return v === "0" ? "0" : `${v}em`;
  return fallback;
}

function cleanShadowValue(value: string): string {
  const dash = value.indexOf("—");
  const trimmed = (dash > 0 ? value.slice(0, dash) : value).trim();
  return trimmed.replace(/\s+/g, " ");
}

function extractShadowStack(corpus: string): string | null {
  const m = corpus.match(
    /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,[^)]+\)\s*0px[^,\n]+(?:,\s*rgba\([^)]+\)\s*0px[^,\n]+){1,4}/i,
  );
  return m?.[0] ? cleanShadowValue(m[0]) : null;
}

/** Accent is scarce (logo/search/active only) — not for generic filled CTAs. */
export function isSignatureAccent(system: DesignSystem): boolean {
  const text = designCorpus(system).toLowerCase();
  return (
    (/exclusively for|never for body text|signature|never for decorative/.test(text) &&
      /logo|search button|search trigger|active.*state|active\/selected/.test(text)) ||
    /primary action:\s*no distinct cta color/i.test(text)
  );
}

export function cardsUseFlatStyle(system: DesignSystem): boolean {
  const text = designCorpus(system).toLowerCase();
  return (
    /cards use no shadow|no shadow.*listing card|no visible border.*card|no shadow by default/.test(
      text,
    ) || /don't add heavy drop shadows to listing cards/.test(text)
  );
}

function elevationShadowFromCorpus(
  corpus: string,
  labels: string[],
): string | null {
  const lower = corpus.toLowerCase();
  for (const label of labels) {
    const re = new RegExp(
      `\\*\\*[^*]*${label}[^*]*\\*\\*[:\\s\`]+([^\`\\n]+)`,
      "i",
    );
    const m = corpus.match(re);
    if (m?.[1]?.includes("rgba")) return cleanShadowValue(m[1]);
    if (lower.includes(label)) {
      const stack = extractShadowStack(corpus);
      if (stack) return stack;
    }
  }
  return extractShadowStack(corpus);
}

export function compileVisualRules(system: DesignSystem): WikiVisualRules {
  const flat = cardsUseFlatStyle(system);
  const signature = isSignatureAccent(system);
  const corpus = designCorpus(system);

  const headingRow = system.typeScale.find((r) =>
    /heading|display/.test(r.role.toLowerCase()),
  );
  const bodyRow =
    system.typeScale.find((r) => r.role.toLowerCase() === "body") ??
    system.typeScale.find((r) => /body/.test(r.role.toLowerCase()));

  const openTypeMatch = corpus.match(/font-feature-settings:\s*['"]?([^'";]+)/i);
  const fontFeatures = openTypeMatch?.[1]?.trim() ?? "";

  // Prefer a token whose role is structural (divider/hairline) over a name-based
  // guess — decorative pastels named "…mist" should not become structural lines.
  const divider =
    system.colors.find((c) => /divider|hairline/.test(c.role.toLowerCase()))?.value ??
    system.colors.find((c) => c.name.toLowerCase().includes("mist"))?.value;

  const carbon =
    system.colors.find((c) => /primary text|headings/.test(c.role.toLowerCase()))
      ?.value ?? "#222222";

  return {
    cardShadow: flat ? "none" : elevationShadowFromCorpus(corpus, ["card"]) ?? "none",
    cardBorder: flat ? "none" : "1px solid color-mix(in srgb, var(--wiki-border) 20%, transparent)",
    ctaFill: signature ? "transparent" : "var(--wiki-accent)",
    ctaBorder: signature ? `1px solid ${carbon}` : "none",
    headingLetterSpacing: sanitizeLetterSpacing(
      headingRow?.letterSpacing,
      "-0.02em",
    ),
    bodyLetterSpacing: sanitizeLetterSpacing(bodyRow?.letterSpacing, "normal"),
    fontFeatureSettings: fontFeatures ? `"${fontFeatures}"` : "normal",
    navDivider: divider ? `1px solid ${divider}` : "1px solid var(--wiki-border)",
    elevatedShadow:
      elevationShadowFromCorpus(corpus, ["search", "popover", "elevated"]) ??
      "none",
  };
}

export function visualRulesToCssVars(rules: WikiVisualRules): Record<string, string> {
  return {
    "--wiki-card-shadow": rules.cardShadow,
    "--wiki-card-border": rules.cardBorder,
    "--wiki-cta-fill": rules.ctaFill,
    "--wiki-cta-border": rules.ctaBorder,
    "--wiki-heading-tracking": rules.headingLetterSpacing,
    "--wiki-body-tracking": rules.bodyLetterSpacing,
    "--wiki-font-features": rules.fontFeatureSettings,
    "--wiki-nav-divider": rules.navDivider,
    "--wiki-elevated-shadow": rules.elevatedShadow,
  };
}
