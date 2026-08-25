import type { TypographyFamily } from "@/lib/blocks/types";
import { googleFontFromSubstitute, type GoogleFontSpec } from "@/lib/fonts/google-map";

/** Serif/sans/mono inference from typography table role + name. */
export function inferFontKind(font: TypographyFamily): "sans" | "serif" | "mono" {
  const role = (font.role ?? "").toLowerCase();
  const name = (font.name ?? "").toLowerCase();
  if (name.includes("mono")) return "mono";
  if (
    role.includes("serif") ||
    role.includes("literary") ||
    (role.includes("editorial") && role.includes("serif")) ||
    role.includes("display") ||
    role.includes("headline")
  ) {
    return "serif";
  }
  return "sans";
}

export function substituteParts(substitute: string): string[] {
  return substitute
    .split(",")
    .map((p) =>
      p
        .trim()
        .replace(/['"]/g, "")
        .replace(/\s*\([^)]*\)/g, "")
        .trim(),
    )
    .filter(Boolean);
}

/** Try each comma-separated substitute (not the whole string at once). */
export function pickGoogleFontSpec(
  substitute: string,
  options?: { preferSerif?: boolean; skipInter?: boolean },
): GoogleFontSpec | null {
  const parts = substituteParts(substitute);
  const ordered = options?.preferSerif
    ? [
        ...parts.filter((p) => isSerifSubstitute(p)),
        ...parts.filter((p) => !isSerifSubstitute(p)),
      ]
    : options?.skipInter
      ? [...parts.filter((p) => p.toLowerCase() !== "inter"), ...parts]
      : parts;

  for (const part of ordered) {
    const spec = googleFontFromSubstitute(part);
    if (spec) return spec;
  }
  return null;
}

function isSerifSubstitute(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes("serif") ||
    n.includes("baskerville") ||
    n.includes("garamond") ||
    n.includes("lora") ||
    n.includes("crimson")
  );
}

export function fontStackFromFamily(
  font: TypographyFamily,
  kind: "sans" | "serif" | "mono",
): string {
  const byName = font?.name ? googleFontFromSubstitute(font.name) : null;
  if (byName) {
    const fallback =
      kind === "serif" ? "serif" : kind === "mono" ? "monospace" : "sans-serif";
    return `"${byName.family}", ui-${fallback}, system-ui, ${fallback}`;
  }

  if (!font?.substitute) {
    return kind === "serif"
      ? "ui-serif, Georgia, serif"
      : "ui-sans-serif, system-ui, sans-serif";
  }

  const spec = pickGoogleFontSpec(font.substitute, {
    preferSerif: kind === "serif",
    skipInter: kind === "sans",
  });

  if (spec) {
    const fallback =
      kind === "serif" ? "serif" : kind === "mono" ? "monospace" : "sans-serif";
    return `"${spec.family}", ui-${fallback}, system-ui, ${fallback}`;
  }

  const first = substituteParts(font.substitute)[0] ?? "system-ui";
  const fallback =
    kind === "serif" ? "serif" : kind === "mono" ? "monospace" : "sans-serif";
  const ui = kind === "serif" ? "ui-serif" : kind === "mono" ? "ui-monospace" : "ui-sans-serif";
  return `"${first}", ${ui}, system-ui, ${fallback}`;
}
