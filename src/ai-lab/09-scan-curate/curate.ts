import { createHash } from "crypto";
import { chatWithProfile } from "@/ai-lab/shared/chat";
import { isAiLabConfigured } from "@/ai-lab/shared/nvidia-profiles";
import type { WorkspaceScanResult } from "@/lib/scan/types";
import {
  assertCuratedScanShape,
  assertHexSubset,
} from "./validate";
import {
  CURATE_SYSTEM_PROMPT,
  buildCurateUserPrompt,
} from "./prompt";

const MAX_FACTS_CHARS = 40_000;

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:markdown|md)?\s*([\s\S]*?)```$/i);
  return fence ? fence[1].trim() : trimmed;
}

function factsJson(result: WorkspaceScanResult): string {
  return JSON.stringify(
    {
      projectName: result.projectName,
      workspaceRoot: result.workspaceRoot,
      scannedAt: result.scannedAt,
      gitCommit: result.gitCommit,
      cssVars: result.cssVars,
      colors: result.colors.slice(0, 80),
      components: result.components.map((c) => ({
        title: c.title,
        filePath: c.filePath,
        exports: c.exports,
        cssVarsUsed: c.cssVarsUsed,
        colorsUsed: c.colorsUsed,
        catalog: c.catalog,
      })),
      excluded: result.excludedComponents.slice(0, 20).map((x) => ({
        title: x.title,
        filePath: x.filePath,
        catalog: x.catalog,
      })),
      inventory: result.inventory.map((f) => ({
        filePath: f.filePath,
        exports: f.exports,
        featured: f.featured,
        category: f.category,
      })),
      coverage: result.coverage,
    },
    null,
    2,
  );
}

export function scanCurateEnabled(): boolean {
  if (process.env.AI_LAB_SCAN_CURATE === "0") return false;
  if (process.env.AI_LAB_SCAN_CURATE === "1") return true;
  return isAiLabConfigured();
}

export function scanFactsHash(factsMarkdown: string): string {
  return createHash("sha256").update(factsMarkdown).digest("hex").slice(0, 16);
}

/**
 * Black box: scan facts in → designer wiki .md out.
 * Model must not invent tokens; validation enforces hex subset.
 */
export async function curateScanToWikiMarkdown(
  result: WorkspaceScanResult,
  factsMarkdown: string,
  docRef: string,
): Promise<{ markdown: string; model: string }> {
  if (!isAiLabConfigured()) {
    throw new Error(
      "NVIDIA_API_KEY missing — scan curation requires AI Lab (see src/ai-lab/README.md).",
    );
  }

  const json = factsJson(result);
  const excerpt =
    factsMarkdown.length > MAX_FACTS_CHARS
      ? factsMarkdown.slice(0, MAX_FACTS_CHARS) + "\n\n[…truncated…]"
      : factsMarkdown;

  const response = await chatWithProfile(
    "parser",
    [
      { role: "system", content: CURATE_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildCurateUserPrompt({ docRef, factsJson: json, factsMarkdownExcerpt: excerpt }),
      },
    ],
    { stream: false },
  );

  const curated = stripCodeFences(response.content);
  assertCuratedScanShape(curated);
  assertHexSubset(factsMarkdown, curated);

  return { markdown: curated, model: response.model };
}
