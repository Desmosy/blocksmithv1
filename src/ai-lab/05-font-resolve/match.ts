import type { TypographyFamily } from "@/lib/blocks/types";
import { catalogEntry } from "@/lib/fonts/google-font-catalog";
import {
  fontResolveKey,
  type FontResolution,
  type FontResolutionMap,
} from "@/lib/fonts/font-resolve";
import { chatJsonWithProfile } from "@/ai-lab/shared/chat";
import { isAiLabConfigured } from "@/ai-lab/shared/nvidia-profiles";
import {
  buildFontResolveUserPrompt,
  FONT_RESOLVE_SYSTEM_PROMPT,
} from "@/ai-lab/05-font-resolve/prompt";
import {
  fontResolveResponseSchema,
  type FontResolveResponse,
} from "@/ai-lab/05-font-resolve/types";

function normalizeFamily(name: string): string | null {
  const entry = catalogEntry(name);
  return entry?.family ?? null;
}

function parseWeights(
  weights: number[] | undefined,
  googleFamily: string,
): number[] {
  if (weights?.length) {
    return [...new Set(weights)].sort((a, b) => a - b);
  }
  return catalogEntry(googleFamily)?.weights ?? [400, 500, 600, 700];
}

function toResolutionMap(
  fonts: TypographyFamily[],
  response: FontResolveResponse,
  model: string,
): FontResolutionMap {
  const byName = new Map(
    response.resolutions.map((r) => [r.sourceName.toLowerCase(), r]),
  );
  const out: FontResolutionMap = {};

  for (const font of fonts) {
    const hit =
      byName.get(font.name.toLowerCase()) ??
      response.resolutions.find(
        (r) => r.sourceName.toLowerCase() === font.name.toLowerCase(),
      );
    if (!hit) continue;

    const googleFamily = normalizeFamily(hit.googleFamily);
    if (!googleFamily) {
      console.warn(
        `[ai-lab:05] rejected non-catalog family "${hit.googleFamily}" for ${font.name}`,
      );
      continue;
    }

    const key = fontResolveKey(font);
    out[key] = {
      googleFamily,
      weights: parseWeights(hit.weights, googleFamily),
      sourceName: font.name,
      reason: hit.reason,
      model,
    };
  }

  return out;
}

/** Parser profile (GPT-OSS) — batch match proprietary fonts to catalog entries. */
export async function resolveFontsWithAi(
  fonts: TypographyFamily[],
  docRef: string,
  systemName: string,
): Promise<FontResolutionMap> {
  if (!isAiLabConfigured()) {
    throw new Error(
      "NVIDIA_API_KEY missing — font resolve requires AI Lab (see .env.example).",
    );
  }
  if (!fonts.length) return {};

  const { data, result } = await chatJsonWithProfile(
    "parser",
    [
      { role: "system", content: FONT_RESOLVE_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildFontResolveUserPrompt({
          docRef,
          systemName,
          fonts: fonts.map((f) => ({
            name: f.name,
            role: f.role,
            substitute: f.substitute,
            weights: f.weights,
            letterSpacing: f.letterSpacing,
          })),
        }),
      },
    ],
    (raw) => fontResolveResponseSchema.parse(raw),
  );

  return toResolutionMap(fonts, data, result.model);
}
