import { LAYOUT_SYSTEM_PROMPT } from "@/lib/ai/layout-schema";

export const CHROME_SYSTEM_PROMPT = `${LAYOUT_SYSTEM_PROMPT}

You are step 01 of the BlockSmith AI Lab pipeline (chrome compiler).
Output must be valid JSON only. Every hex must exist in the PARSED TOKENS color list.`;

export function buildChromeUserPrompt(parts: {
  docRef: string;
  systemName: string;
  mode: string;
  contentHash: string;
  parsedContextJson: string;
  markdownExcerpt: string;
  semanticChromeJson: string;
}): string {
  return [
    `Design file: ${parts.docRef}`,
    `System: ${parts.systemName} (${parts.mode})`,
    `Content hash: ${parts.contentHash}`,
    "",
    "=== DETERMINISTIC SEMANTIC CHROME (hint — improve if doc implies different mapping) ===",
    parts.semanticChromeJson,
    "",
    "=== PARSED TOKENS (authoritative hex — do not invent colors) ===",
    parts.parsedContextJson,
    "",
    "=== SOURCE MARKDOWN ===",
    parts.markdownExcerpt,
    "",
    "Produce wiki chrome JSON that matches THIS design system visibly (canvas, card surfaces, accent CTA, radii, fonts).",
  ].join("\n");
}

export const ENSEMBLE_REFINER_SYSTEM = `${LAYOUT_SYSTEM_PROMPT}

You are the ENSEMBLE REFINER (step 01b). You receive:
1) PARSED TOKENS (authoritative hex palette)
2) DETERMINISTIC semantic chrome (baseline vote)
3) PRIMARY AI chrome (first model vote)

Produce the FINAL consensus wiki chrome JSON. Resolve disagreements by preferring values that:
- Match Surfaces table + color Role columns in the source markdown
- Keep legible text/background contrast
- Use only hex from PARSED TOKENS

Output valid JSON only. This is the version shown to designers — accuracy is mandatory.`;

export function buildEnsembleRefinerPrompt(parts: {
  docRef: string;
  systemName: string;
  mode: string;
  parsedContextJson: string;
  semanticChromeJson: string;
  /** One or more parallel primary agent votes */
  primaryVotesJson: string;
  markdownExcerpt: string;
}): string {
  return [
    `Design file: ${parts.docRef}`,
    `System: ${parts.systemName} (${parts.mode})`,
    "",
    "=== PARSED TOKENS (only allowed hex) ===",
    parts.parsedContextJson,
    "",
    "=== VOTE A: DETERMINISTIC SEMANTIC CHROME ===",
    parts.semanticChromeJson,
    "",
    "=== VOTES B1..Bn: PARALLEL PRIMARY AI AGENTS ===",
    parts.primaryVotesJson,
    "",
    "=== SOURCE MARKDOWN ===",
    parts.markdownExcerpt,
    "",
    "Produce FINAL consensus chrome JSON. Merge the parallel primary votes; prefer values that match Surfaces + Roles in markdown. Every --wiki-* hex must be from PARSED TOKENS.",
  ].join("\n");
}
