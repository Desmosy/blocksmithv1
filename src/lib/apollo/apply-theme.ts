import type { AiLayoutResponse } from "@/lib/ai/layout-schema";
import type { DesignSystem } from "@/lib/blocks/types";
import type { DesignIR } from "@/lib/design-ir/schema";
import { buildWikiThemeStyle } from "@/lib/apollo/wiki-theme";
import {
  applyThemeToDocument,
  applyVisualizeThemeFromIR,
  clearThemeFromDocument,
  DEFAULT_WIKI_VARS,
  getInlineThemeKeysFromIR,
  getWikiChromeKeysFromIR,
  VISUALIZE_STYLE_ID,
} from "@/lib/apollo/apply-theme-client";
import { buildWikiChromeCss } from "@/lib/apollo/wiki-chrome-css";

export {
  applyVisualizeThemeFromIR,
  applyThemeToDocument,
  clearThemeFromDocument,
  DEFAULT_WIKI_VARS,
  getInlineThemeKeysFromIR,
  getWikiChromeKeysFromIR,
  VISUALIZE_STYLE_ID,
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

/** Legacy path when IR not available */
export function buildAllThemeProperties(
  system: DesignSystem,
): Record<string, string> {
  const wiki = buildWikiThemeStyle(system);
  const tokens: Record<string, string> = { ...wiki };

  for (const color of system.colors) {
    const key = color.cssVar.startsWith("--")
      ? color.cssVar
      : `--color-${color.cssVar}`;
    tokens[key] = color.value;
  }

  return tokens;
}

export function mergeThemeProperties(
  system: DesignSystem,
  layout?: AiLayoutResponse | null,
): Record<string, string> {
  const base = buildAllThemeProperties(system);
  if (!layout?.cssVariables) return base;
  return { ...base, ...layout.cssVariables };
}

export function applyVisualizeTheme(
  system: DesignSystem,
  layout?: AiLayoutResponse | null,
): void {
  const properties = mergeThemeProperties(system, layout);
  applyThemeToDocument(properties);
  injectWikiChromeStyles(properties);

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

export function getColorVarKeysFromIR(ir: DesignIR): string[] {
  return Object.keys(ir.colorVariables);
}

export function getColorVarKeys(system: DesignSystem): string[] {
  return system.colors.map((c) =>
    c.cssVar.startsWith("--") ? c.cssVar : `--color-${c.cssVar}`,
  );
}
