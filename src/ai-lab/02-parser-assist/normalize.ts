import { isApolloStructuredMarkdown } from "@/lib/parser/generic";
import { chatWithProfile } from "@/ai-lab/shared/chat";
import { isAiLabConfigured } from "@/ai-lab/shared/nvidia-profiles";
import {
  NORMALIZE_SYSTEM_PROMPT,
  buildNormalizeUserPrompt,
} from "@/ai-lab/02-parser-assist/prompt";

const MAX_SOURCE_CHARS = 48_000;

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:markdown|md)?\s*([\s\S]*?)```$/i);
  return fence ? fence[1].trim() : trimmed;
}

/**
 * GPT-OSS (parser profile) rewrites messy design .md into BlockSmith table format.
 */
export async function normalizeMarkdownWithAi(
  markdown: string,
  docRef: string,
): Promise<{ markdown: string; model: string }> {
  if (!isAiLabConfigured()) {
    throw new Error(
      "NVIDIA_API_KEY missing — parser assist requires AI Lab (see src/ai-lab/README.md).",
    );
  }

  const excerpt =
    markdown.length > MAX_SOURCE_CHARS
      ? markdown.slice(0, MAX_SOURCE_CHARS) + "\n\n[…truncated for model context…]"
      : markdown;

  const result = await chatWithProfile(
    "parser",
    [
      { role: "system", content: NORMALIZE_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildNormalizeUserPrompt({ docRef, excerpt }),
      },
    ],
    { stream: false },
  );

  const normalized = stripCodeFences(result.content);

  if (!isApolloStructuredMarkdown(normalized)) {
    throw new Error(
      "AI normalization did not produce a structured design doc (missing color token table).",
    );
  }

  return { markdown: normalized, model: result.model };
}
