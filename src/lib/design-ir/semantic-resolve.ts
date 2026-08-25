/**
 * Generic wiki chrome resolution — no brand slug lists.
 * Uses only: Surfaces table, color Role column, border-radius rows,
 * layout notes, and component descriptions from the parsed doc.
 */
import type { ColorToken, ComponentDoc, DesignSystem } from "@/lib/blocks/types";
import type { LoadedDesignSystem } from "@/lib/clients/registry";
import {
  bodyFontFamily,
  displayFontFamily,
  labelFontFamily,
} from "@/lib/design-tokens/resolve";
import {
  enforceChromeLegibility,
  extractHexes,
} from "@/lib/design-ir/color-utils";
import {
  compileVisualRules,
  visualRulesToCssVars,
} from "@/lib/design-ir/visual-rules";

export { extractHexes };

function roleMatch(text: string | undefined | null, patterns: string[]): boolean {
  const t = (text ?? "").toLowerCase();
  if (!t) return false;
  return patterns.some((p) => t.includes(p.toLowerCase()));
}

function isDarkContextColor(c: ColorToken): boolean {
  const r = (c.role ?? "").toLowerCase();
  return /within dark|dark section|dark hero|on dark|dark backgrounds/.test(r);
}

/** Headline/accent/decorative roles — not default body or chrome text. */
function isDecorativeOrAccentText(c: ColorToken): boolean {
  const r = (c.role ?? "").toLowerCase();
  if (
    /word-level|inline accent|accent text|highlight|decorative|never as body|only as inline|only for inline|specific number-based|violet headline|sage whisper|iris/.test(
      r,
    )
  ) {
    return true;
  }
  if (
    roleMatch(r, ["headline", "display", "hero", "marketing"]) &&
    !roleMatch(r, ["body", "primary text", "navigation", "input"])
  ) {
    return true;
  }
  return false;
}

function firstColorByRole(
  colors: ColorToken[],
  patterns: string[],
  exclude?: (c: ColorToken) => boolean,
): string | null {
  for (const p of patterns) {
    const found = colors.find(
      (c) =>
        c.value.startsWith("#") &&
        roleMatch(c.role, [p]) &&
        !(exclude?.(c)),
    );
    if (found) return found.value;
  }
  return null;
}

function surfaceValue(
  system: DesignSystem,
  namePatterns: string[],
  purposePatterns: string[] = [],
): string | null {
  for (const p of namePatterns) {
    const byName = system.surfaces?.find((row) => roleMatch(row.name, [p]));
    if (byName) return byName.value;
  }
  for (const row of system.surfaces ?? []) {
    if (purposePatterns.some((p) => roleMatch(row.purpose, [p]))) {
      return row.value;
    }
  }
  return null;
}

function radiusForElement(
  system: DesignSystem,
  elementPatterns: string[],
): string | null {
  const row = system.borderRadius?.find((r) => {
    const el = r.element.toLowerCase();
    if (el === "element" || el === "value" || !r.value?.trim()) return false;
    return elementPatterns.some((p) => roleMatch(r.element, [p]));
  });
  return row?.value ?? null;
}

/** Chroma heuristic — accent candidates are saturated hues. */
function isLikelyAccent(c: ColorToken): boolean {
  const r = c.role.toLowerCase();
  if (
    roleMatch(r, [
      "primary action",
      "primary cta",
      "filled cta",
      "filled button",
      "button fill",
      "action color",
      "dominant chromatic",
      "brand accent",
      "interactive",
      "only saturated",
    ])
  ) {
    return true;
  }
  if (
    roleMatch(r, [
      "primary text",
      "body text",
      "headline",
      "secondary text",
      "filled dark cta",
      "dark cta",
    ])
  ) {
    return false;
  }
  if (
    roleMatch(r, [
      "background",
      "canvas",
      "page",
      "card surface",
      "elevated",
      "text",
      "body",
      "headline",
      "border",
      "divider",
      "outline",
      "muted",
      "decorative",
      "never as a button",
      "not a background",
      "svg mask",
    ])
  ) {
    return false;
  }
  if (!c.value.startsWith("#") || c.value.length < 7) return false;
  const hex = c.value.slice(1);
  const r8 = parseInt(hex.slice(0, 2), 16);
  const g8 = parseInt(hex.slice(2, 4), 16);
  const b8 = parseInt(hex.slice(4, 6), 16);
  const max = Math.max(r8, g8, b8);
  const min = Math.min(r8, g8, b8);
  return max - min > 40 && max > 80;
}

export function resolvePageBackground(system: DesignSystem): string {
  return (
    surfaceValue(system, ["canvas", "page", "paper"], [
      "page background",
      "default page",
      "page canvas",
    ]) ??
    firstColorByRole(system.colors, [
      "page background",
      "page canvas",
      "dominant surface",
      "whole site",
    ]) ??
    firstColorByRole(system.colors, ["background —", "background -"]) ??
    system.colors.find((c) => roleMatch(c.role, ["page background"]))?.value ??
    "#ffffff"
  );
}

export function resolveElevatedSurface(system: DesignSystem): string {
  return (
    surfaceValue(system, ["bone", "cream", "card", "mint", "elevated"], [
      "card",
      "elevated",
      "nav",
      "panel",
      "secondary",
      "warm",
      "badge",
    ]) ??
    firstColorByRole(system.colors, [
      "card surfaces",
      "card surface",
      "elevated",
      "nav bar",
      "metric panel",
    ]) ??
    resolvePageBackground(system)
  );
}

export function resolveSidebarSurface(system: DesignSystem): string {
  return resolveElevatedSurface(system);
}

export function resolveActiveSurface(system: DesignSystem): string {
  const sidebar = resolveSidebarSurface(system);
  const warm = surfaceValue(system, ["bone", "cream", "warm"], [
    "secondary",
    "badge",
    "alternating",
  ]);
  if (warm && warm !== sidebar) return warm;
  return sidebar;
}

export function resolveDarkSurface(system: DesignSystem): string | null {
  return (
    surfaceValue(system, ["hero dark", "dark", "forest", "nav dark"], [
      "hero",
      "dark",
      "deepest",
    ]) ??
    firstColorByRole(system.colors, ["hero", "dark nav", "dark surface"]) ??
    null
  );
}

function isHoverOnlyColor(c: ColorToken): boolean {
  return /hover state|darkening of|hover\//i.test(c.role);
}

export function resolveAccent(system: DesignSystem): string {
  const byRole = firstColorByRole(system.colors, [
    "brand logo",
    "brand accent",
    "search button",
    "search trigger",
    "signature",
    "primary action button",
    "primary action",
    "filled cta",
    "main cta",
    "button fill",
    "filled button",
    "action color",
    "only chromatic",
    "conversion",
    "interactive",
  ]);
  if (byRole) return byRole;

  const accent =
    system.colors.find((c) => !isHoverOnlyColor(c) && isLikelyAccent(c)) ??
    system.colors.find((c) => !isHoverOnlyColor(c) && /brand|logo|coral|accent/.test(c.role.toLowerCase()));
  return accent?.value ?? system.colors[0]?.value ?? "#1a1a1a";
}

export function resolveTextColor(system: DesignSystem): string {
  return (
    firstColorByRole(
      system.colors,
      [
        "body text",
        "default body text",
        "primary text",
        "primary navigation text",
        "input text",
        "structural",
        "dominant neutral",
      ],
      isDecorativeOrAccentText,
    ) ?? "#1a1a1a"
  );
}

export function resolveMutedText(system: DesignSystem): string {
  return (
    firstColorByRole(system.colors, ["muted", "secondary", "tertiary", "helper"]) ??
    "#6b6b6b"
  );
}

export function resolveBorderColor(system: DesignSystem): string {
  return (
    firstColorByRole(
      system.colors,
      [
        "card borders",
        "soft dividers on light",
        "subtle borders for cards",
        "divider lines",
        "hairline borders",
        "decorative borders",
        "subtle divider",
        "divider",
        "hairline",
        "tertiary border",
        "secondary section border",
        "outline",
        "structural outline",
        "border",
      ],
      (c) => isDarkContextColor(c) || isDecorativeOrAccentText(c),
    ) ?? "#e5e7eb"
  );
}

export type ButtonChromeHint = {
  fill: string | null;
  text: string | null;
  radius: string | null;
  variant: "filled" | "outline" | "ghost";
};

function parseButtonFromDescription(desc: string): Partial<ButtonChromeHint> {
  const hexes = extractHexes(desc);
  const lower = desc.toLowerCase();
  const variant = /transparent background|ghost|outline|1px border/.test(lower)
    ? "outline"
    : /background\s*#/.test(lower) || /filled/.test(lower)
      ? "filled"
      : "filled";

  const radiusMatch = desc.match(/border-radius\s+(\d+px|9999px|800px)/i);
  const textMatch = desc.match(/text\s+(#[0-9a-fA-F]{3,8})/i);
  const bgMatch =
    desc.match(/background\s+(#[0-9a-fA-F]{3,8})/i) ??
    desc.match(/(#[0-9a-fA-F]{3,8})\s+background/i);

  return {
    fill: bgMatch?.[1] ?? hexes[0] ?? null,
    text: textMatch?.[1] ?? null,
    radius: radiusMatch?.[1] ?? null,
    variant,
  };
}

function isSecondaryButton(comp: ComponentDoc): boolean {
  return roleMatch(`${comp.title} ${comp.role}`, [
    "secondary action",
    "second-priority",
    "tertiary",
    "ghost",
    "outline",
  ]);
}

export function resolvePrimaryButton(
  system: DesignSystem,
): ButtonChromeHint | null {
  const buttonish = system.components.filter(
    (c) =>
      roleMatch(c.title, ["button", "cta", "pill"]) ||
      roleMatch(c.role, ["button", "cta", "filled"]),
  );

  const comp =
    buttonish.find(
      (c) =>
        roleMatch(c.title, ["primary"]) && roleMatch(c.title, ["button", "cta"]),
    ) ??
    buttonish.find(
      (c) =>
        !isSecondaryButton(c) &&
        roleMatch(c.role, ["dominant", "primary action", "main cta", "start trial"]),
    ) ??
    buttonish.find((c) => !isSecondaryButton(c)) ??
    buttonish.find((c) => roleMatch(c.role, ["filled cta", "primary"]));

  if (!comp) return null;
  const parsed = parseButtonFromDescription(comp.description);
  return {
    fill: parsed.fill ?? resolveAccent(system),
    text: parsed.text ?? resolveTextColor(system),
    radius:
      parsed.radius ??
      radiusForElement(system, ["button", "cta", "primary"]) ??
      "8px",
    variant: parsed.variant ?? "filled",
  };
}

export function resolveNavChrome(system: DesignSystem): {
  floatingPill: boolean;
  navRadius: string | null;
  navBackground: string | null;
} {
  const navComp = system.components.find((c) =>
    roleMatch(c.title, ["navigation", "nav bar", "nav"]),
  );
  const corpus = [
    system.layoutNotes,
    navComp?.description ?? "",
    navComp?.role ?? "",
  ].join(" ");

  const floatingPill = roleMatch(corpus, [
    "floating pill",
    "floating nav",
    "centered pill",
    "detached",
    "pill nav",
  ]);

  return {
    floatingPill,
    navRadius:
      radiusForElement(system, ["pill", "nav", "link"]) ??
      radiusForElement(system, ["button"]),
    navBackground:
      surfaceValue(system, ["nav", "cream"], ["navigation", "nav"]) ??
      resolveElevatedSurface(system),
  };
}

/** Full deterministic chrome from parsed structure only. */
export function compileSemanticWikiChrome(
  system: LoadedDesignSystem,
): Record<string, string> {
  const isMixed = system.theme?.toLowerCase() === "mixed";
  const bg = resolvePageBackground(system);
  const elevated = resolveSidebarSurface(system);
  const activeSurface = resolveActiveSurface(system);
  const dark = resolveDarkSurface(system);
  const primaryBtn = resolvePrimaryButton(system);
  const nav = resolveNavChrome(system);

  const buttonRadius =
    primaryBtn?.radius ??
    radiusForElement(system, ["button", "cta"]) ??
    "8px";
  const cardRadius =
    radiusForElement(system, ["cards", "card", "panel", "feature"]) ??
    buttonRadius;

  const maxWidth =
    system.layout?.find((l) => roleMatch(l.label, ["max-width", "page"]))?.value ??
    "72rem";

  const navBg = isMixed && dark ? dark : nav.navBackground ?? elevated;

  const chrome: Record<string, string> = {
    "--wiki-bg": isMixed
      ? surfaceValue(system, ["page light", "light"], ["light section"]) ?? bg
      : bg,
    "--wiki-sidebar": elevated,
    "--wiki-border": resolveBorderColor(system),
    "--wiki-text": resolveTextColor(system),
    "--wiki-muted": resolveMutedText(system),
    "--wiki-active": activeSurface,
    "--wiki-accent": resolveAccent(system),
    "--wiki-font": bodyFontFamily(system.typography),
    "--wiki-display-font": displayFontFamily(system.typography),
    "--wiki-label-font": labelFontFamily(system.typography),
    "--wiki-content-max": maxWidth,
    "--wiki-radius": buttonRadius,
    "--wiki-radius-card": cardRadius,
    "--wiki-nav-bg": navBg,
    "--wiki-cta-on-accent": primaryBtn?.text ?? resolveTextColor(system),
    "--wiki-nav-radius": nav.floatingPill ? nav.navRadius ?? buttonRadius : "0",
  };

  if (isMixed && dark) {
    chrome["--wiki-nav-text"] = "#ffffff";
    chrome["--wiki-nav-muted"] =
      firstColorByRole(system.colors, ["fog", "muted", "sage"]) ?? "#879b93";
  } else {
    chrome["--wiki-nav-text"] = resolveTextColor(system);
    chrome["--wiki-nav-muted"] = resolveMutedText(system);
  }

  return enforceChromeLegibility({
    ...chrome,
    ...visualRulesToCssVars(compileVisualRules(system)),
  });
}

export function semanticPreviewFromChrome(
  chrome: Record<string, string>,
  system: DesignSystem,
): {
  accent: string;
  pageBackground: string;
  cardBackground: string;
  border: string;
  text: string;
  buttonRadius: string;
  cardRadius: string;
  ctaOnAccent?: string;
  navFloatingPill?: boolean;
  navRadius?: string;
} {
  const navRadius = chrome["--wiki-nav-radius"] ?? "0";
  return {
    accent: chrome["--wiki-accent"] ?? "#1a1a1a",
    pageBackground: chrome["--wiki-bg"] ?? "#ffffff",
    cardBackground: chrome["--wiki-sidebar"] ?? "#fafafa",
    border: chrome["--wiki-border"] ?? "#e5e7eb",
    text: chrome["--wiki-text"] ?? "#1a1a1a",
    buttonRadius: chrome["--wiki-radius"] ?? "8px",
    cardRadius: chrome["--wiki-radius-card"] ?? "8px",
    ctaOnAccent: chrome["--wiki-cta-on-accent"],
    navFloatingPill:
      parseInt(navRadius, 10) > 100 || resolveNavChrome(system).floatingPill,
    navRadius,
  };
}
