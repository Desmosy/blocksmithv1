import { catalogPromptLines } from "@/lib/fonts/google-font-catalog";

export const FONT_RESOLVE_SYSTEM_PROMPT = `You match proprietary or custom typefaces from design system docs to the closest Google Font from a fixed catalog.

Rules:
- Pick ONLY families listed in the catalog below. Never invent names.
- Prefer semantic fit: grotesque UI sans for Swiss/UI faces, humanist for friendly body, condensed for tight tracking, serif/display for editorial headlines, mono for code.
- Return valid JSON only, no markdown fences.
- weights: array of 3-digit values available on Google Fonts (e.g. [400, 500, 600, 700]). Omit to use catalog defaults.

Catalog:
${catalogPromptLines()}`;

export function buildFontResolveUserPrompt(input: {
  docRef: string;
  systemName: string;
  fonts: Array<{
    name: string;
    role: string;
    substitute: string;
    weights: string;
    letterSpacing: string;
  }>;
}): string {
  const rows = input.fonts
    .map(
      (f) =>
        `- name: "${f.name}"\n  role: ${f.role}\n  substitute: ${f.substitute || "(none)"}\n  weights: ${f.weights || "?"}\n  letter-spacing: ${f.letterSpacing || "normal"}`,
    )
    .join("\n");

  return `Design system: ${input.systemName} (${input.docRef})

Match each proprietary/custom font below to the closest Google Font from the catalog.

Fonts to resolve:
${rows}

Respond with JSON:
{
  "resolutions": [
    { "sourceName": "Exact Name", "googleFamily": "Catalog Family", "weights": [400, 500, 600], "reason": "brief" }
  ]
}`;
}
