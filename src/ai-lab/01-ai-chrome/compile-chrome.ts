import {
  AiLayoutResponseSchema,
  type AiLayoutResponse,
} from "@/lib/ai/layout-schema";
import { formatDesignContextForPrompt } from "@/lib/ai/build-design-context";
import { loadEnsembleDoc } from "@/lib/ai/load-ensemble-doc";
import { compileSemanticWikiChrome } from "@/lib/design-ir/semantic-resolve";
import { chatJsonWithProfile } from "@/ai-lab/shared/chat";
import {
  CHROME_SYSTEM_PROMPT,
  buildChromeUserPrompt,
} from "@/ai-lab/01-ai-chrome/prompt";

const MD_EXCERPT_MAX = 24_000;

/**
 * Step 01 — AI chrome compiler (Nemotron via NVIDIA Integrate API).
 * Validates output with Zod; caller merges via mergeValidatedAiChrome.
 */
export async function compileChromeWithAi(
  docRef: string,
): Promise<AiLayoutResponse> {
  const { system, markdown } = await loadEnsembleDoc(docRef);
  const parsedContext = formatDesignContextForPrompt(system);
  const semanticChrome = compileSemanticWikiChrome(system);

  const { data } = await chatJsonWithProfile(
    "chrome",
    [
      { role: "system", content: CHROME_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildChromeUserPrompt({
          docRef,
          systemName: system.name,
          mode: system.mode,
          contentHash: system.contentHash ?? "unknown",
          parsedContextJson: parsedContext,
          semanticChromeJson: JSON.stringify(semanticChrome, null, 2),
          markdownExcerpt: markdown.slice(0, MD_EXCERPT_MAX),
        }),
      },
    ],
    (raw) => AiLayoutResponseSchema.parse(raw),
  );

  return data;
}
