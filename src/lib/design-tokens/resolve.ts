import type { ColorToken, TypographyFamily } from "@/lib/blocks/types";
import { fontStackFromFamily } from "@/lib/fonts/font-stack";

function colorByRole(
  colors: ColorToken[],
  rolePatterns: string[],
): string | null {
  for (const pattern of rolePatterns) {
    const found = colors.find((c) =>
      c.role.toLowerCase().includes(pattern.toLowerCase()),
    );
    if (found?.value.startsWith("#")) return found.value;
  }
  return null;
}

export function colorByVar(
  colors: ColorToken[],
  slugs: string[],
  fallback: string,
): string {
  for (const slug of slugs) {
    const found = colors.find((c) =>
      c.cssVar.replace("--color-", "").includes(slug),
    );
    if (found?.value.startsWith("#")) return found.value;
  }
  return fallback;
}

export function pageBackground(colors: ColorToken[]): string {
  return (
    colorByRole(colors, [
      "page canvas",
      "page background",
      "canvas and section",
      "entire site sits",
    ]) ??
    colorByVar(
      colors,
      [
        "concrete-canvas",
        "parchment",
        "paper-white",
        "cream-paper",
        "eggshell",
        "canvas",
        "page-ground",
        "surface-page",
        "warm",
      ],
      "#ffffff",
    )
  );
}

export function primaryText(colors: ColorToken[]): string {
  return (
    colorByRole(colors, [
      "primary navigation text",
      "body text",
      "primary text",
    ]) ??
    colorByVar(
      colors,
      [
        "ink",
        "charcoal-navy",
        "charcoal-ink",
        "soft-black",
        "obsidian",
        "midnight-ink",
        "graphite",
        "illustration-ink",
      ],
      "#1a1a1a",
    )
  );
}

export function secondaryText(colors: ColorToken[]): string {
  return (
    colorByRole(colors, ["muted helper", "secondary", "tertiary"]) ??
    colorByVar(
      colors,
      [
        "pencil-gray",
        "gravel",
        "charcoal-text",
        "faded-stone",
        "slate",
        "cinder",
        "graphite",
      ],
      "#6b6b6b",
    )
  );
}

export function borderColor(colors: ColorToken[]): string {
  return (
    colorByRole(colors, ["nav borders", "border", "divider", "outline"]) ??
    colorByVar(
      colors,
      ["ink", "chalk", "subtle-gray", "ash-gray", "charcoal-navy", "graphite"],
      "#e5e7eb",
    )
  );
}

export function cardBackground(colors: ColorToken[]): string {
  return (
    colorByRole(colors, [
      "card and panel",
      "card surfaces",
      "nav bar",
      "overlay panels",
    ]) ??
    colorByVar(
      colors,
      [
        "cream-card",
        "card-mint",
        "frost-white",
        "crisp-white",
        "card-white",
        "surface-card",
        "powder",
        "chalk-gray",
      ],
      pageBackground(colors),
    )
  );
}

export function accentColor(colors: ColorToken[]): string {
  const byRole = colorByRole(colors, [
    "primary action",
    "primary cta",
    "main cta",
    "dominant chromatic",
    "primary action button",
  ]);
  if (byRole) return byRole;

  const bySlug = colorByVar(
    colors,
    [
      "citra-orange",
      "sprout",
      "deep-teal",
      "sky-crayon",
      "signal-blue",
      "ember",
      "apollo-gold",
      "accent",
    ],
    "",
  );
  if (bySlug) return bySlug;

  const mutedExact = new Set([
    "eggshell",
    "powder",
    "chalk",
    "fog",
    "gravel",
    "cinder",
    "obsidian",
    "canvas",
    "crisp-white",
    "ash",
    "mist",
    "slate",
    "parchment",
    "dew",
    "paper-white",
    "cream-paper",
    "frost-white",
    "chalk-gray",
    "sea-foam",
    "mint-card",
    "blush-sand",
    "lavender-tint",
    "sage-whisper",
  ]);

  const saturated = colors.find((c) => {
    if (!c.value.startsWith("#")) return false;
    const slug = c.cssVar.replace(/^--color-/, "").toLowerCase();
    return !mutedExact.has(slug);
  });
  return saturated?.value ?? "#27ae60";
}

export function bodyFontFamily(typography: TypographyFamily[]): string {
  const ui = typography.find((t) => {
    const role = t.role.toLowerCase();
    const name = t.name.toLowerCase();
    if (name.includes("mono") || name === "arial" || name === "system-ui") {
      return false;
    }
    return (
      role.includes("sole typeface") ||
      role.includes("every text element") ||
      role.includes("body") ||
      role.includes("functional ui") ||
      role.includes("functional") ||
      role.includes("ui") ||
      role.includes("nav") ||
      role.includes("button") ||
      role.includes("primary ui")
    );
  });
  if (ui) return fontStackFromFamily(ui, "sans");

  const sans = typography.find((t) => {
    const role = t.role.toLowerCase();
    const name = t.name.toLowerCase();
    return (
      !name.includes("mono") &&
      name !== "arial" &&
      name !== "system-ui" &&
      !role.includes("display") &&
      !role.includes("headline") &&
      !role.includes("editorial")
    );
  });
  if (sans) return fontStackFromFamily(sans, "sans");

  return "Inter, ui-sans-serif, system-ui, sans-serif";
}

export function displayFontFamily(typography: TypographyFamily[]): string {
  const soleTypeface = typography.find((t) => {
    const role = t.role.toLowerCase();
    return (
      role.includes("sole typeface") ||
      role.includes("every text element") ||
      role.includes("all functional ui")
    );
  });
  if (soleTypeface) return fontStackFromFamily(soleTypeface, "sans");

  const display = typography.find(
    (t) =>
      !t.name.toLowerCase().includes("mono") &&
      (t.role.toLowerCase().includes("display") ||
        t.role.toLowerCase().includes("headline") ||
        t.role.toLowerCase().includes("editorial")),
  );
  if (display) {
    const corpus = `${display.role} ${display.name}`.toLowerCase();
    // Explicit sans signals win — prose like "editorial confidence" must not
    // flip a geometric sans into a serif stack.
    const sansSignal = /\bsans\b|grotesk|geometric|gothic|neue|helvetica/.test(
      corpus,
    );
    const serifSignal =
      /\bserif\b|slab|literary|playfair|baskerville|garamond|times|georgia|recoleta|tiempos|freight/.test(
        corpus,
      );
    const useSerif = serifSignal && !sansSignal;
    return fontStackFromFamily(display, useSerif ? "serif" : "sans");
  }
  return bodyFontFamily(typography);
}

export function labelFontFamily(typography: TypographyFamily[]): string {
  const mono = typography.find(
    (t) =>
      t.name.toLowerCase().includes("mono") ||
      t.role.toLowerCase().includes("eyebrow") ||
      t.role.toLowerCase().includes("label"),
  );
  if (mono) return fontStackFromFamily(mono, "mono");
  return bodyFontFamily(typography);
}

export function inferColorGroups(colors: ColorToken[]): Map<string, ColorToken[]> {
  const map = new Map<string, ColorToken[]>();
  for (const c of colors) {
    const role = c.role.toLowerCase();
    let group = "Palette";
    if (
      role.includes("cta") ||
      role.includes("accent") ||
      role.includes("primary action") ||
      role.includes("brand")
    ) {
      group = "Accent & brand";
    } else if (
      role.includes("background") ||
      role.includes("surface") ||
      role.includes("page") ||
      role.includes("canvas")
    ) {
      group = "Surfaces";
    } else if (role.includes("text") || role.includes("body") || role.includes("nav")) {
      group = "Text";
    } else if (role.includes("border") || role.includes("divider")) {
      group = "Borders & UI";
    }
    const list = map.get(group) ?? [];
    list.push(c);
    map.set(group, list);
  }
  return map;
}
