import type { DesignSystem } from "@/lib/blocks/types";
import { buildApolloCssVars } from "@/lib/apollo/theme-css";
import { fontStackFromFamily, inferFontKind } from "@/lib/fonts/font-stack";

function fontVarName(font: DesignSystem["typography"][number]): string {
  if (font.cssVar?.trim()) {
    return font.cssVar.startsWith("--") ? font.cssVar : `--font-${font.cssVar}`;
  }
  const slug = font.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug ? `--font-${slug}` : "";
}

function buildFontCssVars(typography: DesignSystem["typography"]): string {
  return typography
    .map((font) => {
      const varName = fontVarName(font);
      if (!varName) return "";
      const stack = fontStackFromFamily(font, inferFontKind(font));
      return `${varName}: ${stack};`;
    })
    .filter(Boolean)
    .join("\n  ");
}

/** Injects design token CSS vars from the loaded .md (any structured system). */
export function ApolloThemeStyles({ system }: { system: DesignSystem }) {
  const colorVars = buildApolloCssVars(system.colors);
  const fontVars = buildFontCssVars(system.typography);
  if (!colorVars && !fontVars) return null;
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          .design-preview, .apollo-preview,
          html.design-wiki-applied .apollo-tokens-root {
            ${colorVars}
            ${fontVars}
          }
        `,
      }}
    />
  );
}
