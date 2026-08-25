import type { AiLayoutResponse } from "@/lib/ai/layout-schema";
import type { DesignIR } from "@/lib/design-ir/schema";
import { mergeValidatedAiChrome } from "@/lib/design-ir/merge-ai-chrome";
import { buildWikiChromeCss } from "@/lib/apollo/wiki-chrome-css";

const WIKI_VAR_KEYS = [
  "--wiki-bg",
  "--wiki-sidebar",
  "--wiki-border",
  "--wiki-text",
  "--wiki-muted",
  "--wiki-active",
  "--wiki-accent",
  "--wiki-font",
  "--wiki-display-font",
  "--wiki-label-font",
  "--wiki-content-max",
  "--wiki-radius",
  "--wiki-radius-card",
  "--wiki-nav-bg",
  "--wiki-nav-text",
  "--wiki-nav-muted",
  "--wiki-nav-radius",
  "--wiki-cta-on-accent",
] as const;

export const VISUALIZE_STYLE_ID = "blocksmith-visualize-chrome";

/** Privy product chrome — must match src/styles/blocksmith-chrome.css :root */
export const DEFAULT_WIKI_VARS: Record<string, string> = {
  "--wiki-bg": "#ffffff",
  "--wiki-sidebar": "#ffffff",
  "--wiki-border": "color-mix(in srgb, #010110 12%, transparent)",
  "--wiki-text": "#010110",
  "--wiki-muted": "#73737c",
  "--wiki-active": "color-mix(in srgb, #d9d9d9 35%, #ffffff)",
  "--wiki-accent": "#010110",
  "--wiki-font": "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  "--wiki-display-font":
    'var(--font-display), "Source Serif 4", Georgia, "Times New Roman", serif',
  "--wiki-label-font":
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  "--wiki-content-max": "75rem",
  "--wiki-radius": "8px",
  "--wiki-radius-card": "8px",
  "--wiki-nav-bg": "#ffffff",
  "--wiki-nav-text": "#010110",
  "--wiki-nav-muted": "#73737c",
  "--wiki-nav-radius": "0",
  "--wiki-cta-fill": "#010110",
  "--wiki-cta-on-accent": "#ffffff",
};

function injectWikiChromeStyles(properties: Record<string, string>): void {
  if (typeof document === "undefined") return;

  let el = document.getElementById(VISUALIZE_STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = VISUALIZE_STYLE_ID;
    document.head.appendChild(el);
  }

  el.textContent = buildWikiChromeCss(properties, { documentLevel: true });
}

/** Client-safe: apply compiled Design IR only (no legacy wiki-theme / compile chain). */
export function applyVisualizeThemeFromIR(
  ir: DesignIR,
  layout?: AiLayoutResponse | null,
): void {
  const properties = mergeValidatedAiChrome(ir, layout);
  applyThemeToDocument(properties);
  injectWikiChromeStyles(properties);

  // The global top nav is frozen product chrome (--chrome-nav-*); Visualize never
  // reshapes it, so the legacy floating-pill flag is intentionally not applied.

  if (layout?.layout?.contentMaxWidth) {
    document.documentElement.style.setProperty(
      "--wiki-content-max",
      layout.layout.contentMaxWidth,
    );
  }
  if (layout?.layout?.sidebarWidth) {
    document.documentElement.style.setProperty(
      "--wiki-sidebar-width",
      layout.layout.sidebarWidth,
    );
  }
  if (layout?.layout?.borderRadius) {
    document.documentElement.style.setProperty(
      "--wiki-radius",
      layout.layout.borderRadius,
    );
    injectWikiChromeStyles({
      ...properties,
      "--wiki-radius": layout.layout.borderRadius,
    });
  }
}

export function applyThemeToDocument(
  properties: Record<string, string>,
): void {
  const root = document.documentElement;
  root.classList.add("design-wiki-applied");
  root.dataset.theme = "design";

  for (const [key, value] of Object.entries(properties)) {
    root.style.setProperty(key, value);
  }

  document.body.style.backgroundColor = properties["--wiki-bg"] ?? "";
  document.body.style.color = properties["--wiki-text"] ?? "";
  document.body.style.fontFamily = properties["--wiki-font"] ?? "";
}

export function getWikiChromeKeysFromIR(ir: DesignIR): string[] {
  return Object.keys(ir.wikiChrome.cssVariables);
}

export function clearThemeFromDocument(
  colorVars: string[],
  extraKeys: string[] = [],
  wikiChromeKeys: string[] = [],
): void {
  const root = document.documentElement;
  root.classList.remove("design-wiki-applied");
  root.dataset.theme = "light";

  const keysToClear = new Set<string>([
    ...WIKI_VAR_KEYS,
    ...wikiChromeKeys,
    ...extraKeys,
  ]);
  for (const key of keysToClear) {
    root.style.removeProperty(key);
  }

  for (const key of colorVars) {
    root.style.removeProperty(key);
  }
  root.style.removeProperty("--wiki-sidebar-width");
  root.style.removeProperty("--font-sans");

  document.body.style.removeProperty("background-color");
  document.body.style.removeProperty("color");
  document.body.style.removeProperty("font-family");

  document.getElementById(VISUALIZE_STYLE_ID)?.remove();
  delete document.documentElement.dataset.wikiNav;
}

export function getInlineThemeKeysFromIR(ir: DesignIR): string[] {
  return [
    ...Object.keys(ir.colorVariables),
    ...Object.keys(ir.fontStacks),
  ];
}
