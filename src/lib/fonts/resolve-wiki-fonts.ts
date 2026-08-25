import type { TypographyFamily } from "@/lib/blocks/types";
import {
  bodyFontFamily,
  displayFontFamily,
  labelFontFamily,
} from "@/lib/design-tokens/resolve";
import type { FontResolutionMap } from "@/lib/fonts/font-resolve";
import { specForFont } from "@/lib/fonts/font-resolve";
import {
  fontStackFromFamily,
  inferFontKind,
  substituteParts,
} from "@/lib/fonts/font-stack";
import {
  googleFontFromSubstitute,
  type GoogleFontSpec,
} from "@/lib/fonts/google-map";

const SYSTEM_FACES = new Set([
  "arial",
  "system-ui",
  "helvetica",
  "times new roman",
  "georgia",
  "sans-serif",
  "serif",
  "monospace",
]);

export function parseFontWeights(weights: string | undefined): number[] {
  if (!weights?.trim()) return [400, 500, 600, 700];
  const parsed = [...weights.matchAll(/\d{3}/g)].map((m) => Number(m[0]));
  return parsed.length ? [...new Set(parsed)].sort((a, b) => a - b) : [400, 500, 600, 700];
}

/** First quoted family in a CSS font stack, e.g. `"Playfair Display", serif` */
export function primaryFamilyFromStack(stack: string): string | null {
  const m = stack.match(/"([^"]+)"/) ?? stack.match(/'([^']+)'/);
  if (m?.[1]) return m[1];
  const first = stack.split(",")[0]?.trim().replace(/['"]/g, "");
  if (!first || SYSTEM_FACES.has(first.toLowerCase())) return null;
  if (first.toLowerCase().startsWith("ui-")) return null;
  return first;
}

function isProprietaryFamily(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.startsWith("pp ") ||
    n.includes("neue corp") ||
    n.includes("waldenburg") ||
    n === "switzer" ||
    n === "general sans" ||
    n.split(/\s+/).length > 3
  );
}

/** Resolve a Google Fonts spec — known map first, then dynamic family name. */
export function googleFontSpecFromName(
  name: string,
  weights?: number[],
): GoogleFontSpec | null {
  const clean = name.trim().replace(/['"]/g, "");
  if (!clean || SYSTEM_FACES.has(clean.toLowerCase())) return null;

  const mapped = googleFontFromSubstitute(clean);
  if (mapped) return mapped;

  if (isProprietaryFamily(clean)) return null;

  return {
    family: clean,
    weights: weights?.length ? weights : [400, 500, 600, 700],
  };
}

function addSpec(
  specs: GoogleFontSpec[],
  seen: Set<string>,
  spec: GoogleFontSpec | null,
): void {
  if (!spec || seen.has(spec.family)) return;
  seen.add(spec.family);
  specs.push(spec);
}

/**
 * All Google Font families required to render the wiki for this typography table.
 * Includes body, display, label stacks + every named/substitute row.
 */
export function collectWikiFontSpecs(
  typography: TypographyFamily[],
  fontResolutions?: FontResolutionMap,
): GoogleFontSpec[] {
  const specs: GoogleFontSpec[] = [];
  const seen = new Set<string>();

  if (!typography.length) return specs;

  const stacks = [
    { stack: bodyFontFamily(typography), weights: findWeightsForRole(typography, "body") },
    {
      stack: displayFontFamily(typography),
      weights: findWeightsForRole(typography, "display"),
    },
    {
      stack: labelFontFamily(typography),
      weights: findWeightsForRole(typography, "label"),
    },
  ];

  for (const { stack, weights } of stacks) {
    const primary = primaryFamilyFromStack(stack);
    if (primary) {
      addSpec(specs, seen, googleFontSpecFromName(primary, weights));
    }
  }

  for (const font of typography) {
    const weights = parseFontWeights(font.weights);
    addSpec(specs, seen, specForFont(font, fontResolutions));
    addSpec(specs, seen, googleFontFromSubstitute(font.name));
    for (const part of substituteParts(font.substitute ?? "")) {
      addSpec(
        specs,
        seen,
        googleFontFromSubstitute(part) ?? googleFontSpecFromName(part, weights),
      );
    }
  }

  return specs;
}

function findWeightsForRole(
  typography: TypographyFamily[],
  kind: "body" | "display" | "label",
): number[] {
  const match = typography.find((font) => {
    const role = font.role.toLowerCase();
    const name = font.name.toLowerCase();
    if (kind === "body") {
      return (
        role.includes("body") ||
        role.includes("functional") ||
        role.includes("ui") ||
        (!role.includes("display") &&
          !role.includes("headline") &&
          !role.includes("editorial") &&
          !name.includes("mono"))
      );
    }
    if (kind === "display") {
      return (
        role.includes("display") ||
        role.includes("headline") ||
        role.includes("editorial")
      );
    }
    return name.includes("mono") || role.includes("label") || role.includes("eyebrow");
  });
  return parseFontWeights(match?.weights);
}
