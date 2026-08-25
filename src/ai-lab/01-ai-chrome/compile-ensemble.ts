import {
  AiLayoutResponseSchema,
  type AiLayoutResponse,
} from "@/lib/ai/layout-schema";
import { formatDesignContextForPrompt } from "@/lib/ai/build-design-context";
import { loadEnsembleDoc } from "@/lib/ai/load-ensemble-doc";
import { compileDesignIR } from "@/lib/design-ir/compile";
import { mergeValidatedAiChrome } from "@/lib/design-ir/merge-ai-chrome";
import { compileSemanticWikiChrome } from "@/lib/design-ir/semantic-resolve";
import { chatJsonWithModel, chatJsonWithProfile } from "@/ai-lab/shared/chat";
import { getNvidiaProfile } from "@/ai-lab/shared/nvidia-profiles";
import {
  CHROME_SYSTEM_PROMPT,
  buildChromeUserPrompt,
  buildEnsembleRefinerPrompt,
  ENSEMBLE_REFINER_SYSTEM,
} from "@/ai-lab/01-ai-chrome/prompt";

const MD_EXCERPT_MAX = 20_000;

const FAST_PRIMARY_A = "nvidia/nemotron-3-super-120b-a12b";
const FAST_PRIMARY_B = "openai/gpt-oss-120b";

/** Models run in parallel (wall-clock ≈ slowest agent, not sum). */
function parallelPrimaryModels(): string[] {
  const custom = process.env.NVIDIA_MODEL_CHROME?.trim();
  const useUltra = process.env.NVIDIA_ENSEMBLE_ULTRA === "1";

  if (process.env.VERCEL === "1" && !useUltra) {
    return [FAST_PRIMARY_A, FAST_PRIMARY_B];
  }
  if (custom) {
    return [...new Set([custom, FAST_PRIMARY_A])].slice(0, 2);
  }
  return [getNvidiaProfile("chrome").model, FAST_PRIMARY_A];
}

const REFINER_MODEL =
  process.env.NVIDIA_MODEL_CHROME_REFINER?.trim() ||
  "openai/gpt-oss-120b";

export type ChromeEnsembleResult = {
  layout: AiLayoutResponse;
  models: string[];
  passes: ("semantic" | "primary" | "refiner")[];
};

type SharedParts = {
  systemName: string;
  mode: string;
  contentHash: string;
  parsedContextJson: string;
  semanticChromeJson: string;
  markdownExcerpt: string;
};

async function primaryChromePassWithModel(
  docRef: string,
  parts: SharedParts,
  model: string,
): Promise<{ data: AiLayoutResponse; model: string } | null> {
  try {
    const { data, result } = await chatJsonWithModel(
      model,
      "chrome",
      [
        { role: "system", content: CHROME_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildChromeUserPrompt({ docRef, ...parts }),
        },
      ],
      (raw) => AiLayoutResponseSchema.parse(raw),
    );
    return { data, model: result.model };
  } catch (err) {
    console.warn(`[ensemble] primary agent ${model} failed`, err);
    return null;
  }
}

async function refinerChromePass(
  docRef: string,
  parts: {
    systemName: string;
    mode: string;
    parsedContextJson: string;
    semanticChromeJson: string;
    primaryVotesJson: string;
    markdownExcerpt: string;
  },
): Promise<{ data: AiLayoutResponse; model: string }> {
  const { data, result } = await chatJsonWithModel(
    REFINER_MODEL,
    "chrome",
    [
      { role: "system", content: ENSEMBLE_REFINER_SYSTEM },
      {
        role: "user",
        content: buildEnsembleRefinerPrompt({ docRef, ...parts }),
      },
    ],
    (raw) => AiLayoutResponseSchema.parse(raw),
  );
  return { data, model: result.model };
}

/**
 * Parallel ensemble: semantic baseline + N primary agents (parallel) → refiner consensus.
 */
export async function compileChromeEnsemble(
  docRef: string,
): Promise<ChromeEnsembleResult> {
  const start = Date.now();
  const { system, markdown } = await loadEnsembleDoc(docRef);
  const ir = compileDesignIR(docRef, system);
  const semanticChrome = compileSemanticWikiChrome(system);
  const parsedContextJson = formatDesignContextForPrompt(system);
  const markdownExcerpt = markdown.slice(0, MD_EXCERPT_MAX);

  const shared: SharedParts = {
    systemName: system.name,
    mode: system.mode,
    contentHash: system.contentHash ?? "unknown",
    parsedContextJson,
    semanticChromeJson: JSON.stringify(semanticChrome, null, 2),
    markdownExcerpt,
  };

  const models = parallelPrimaryModels();
  console.log("[ensemble] parallel primaries", models.join(", "));

  const primaryResults = await Promise.all(
    models.map((model) => primaryChromePassWithModel(docRef, shared, model)),
  );
  const primaries = primaryResults.filter(
    (p): p is { data: AiLayoutResponse; model: string } => p !== null,
  );

  if (primaries.length === 0) {
    throw new Error(
      "All parallel primary agents failed. Check NVIDIA_API_KEY and model availability.",
    );
  }

  console.log(
    `[ensemble] primaries done in ${Date.now() - start}ms (${primaries.length}/${models.length} ok)`,
  );

  const primaryVotesJson = JSON.stringify(
    primaries.map((p) => ({ model: p.model, chrome: p.data })),
    null,
    2,
  );

  let refiner: { data: AiLayoutResponse; model: string };
  try {
    refiner = await refinerChromePass(docRef, {
      systemName: shared.systemName,
      mode: shared.mode,
      parsedContextJson,
      semanticChromeJson: shared.semanticChromeJson,
      primaryVotesJson,
      markdownExcerpt,
    });
  } catch (err) {
    console.warn("[ensemble] refiner failed, using best primary vote", err);
    refiner = { data: primaries[0].data, model: "primary-fallback" };
  }

  console.log(`[ensemble] refiner done in ${Date.now() - start}ms`);

  const mergedCss = mergeValidatedAiChrome(ir, refiner.data);
  const semanticMerged = mergeValidatedAiChrome(ir, {
    cssVariables: semanticChrome,
    summary: "semantic baseline",
  });

  const finalCss: Record<string, string> = { ...semanticMerged };
  for (const [key, value] of Object.entries(mergedCss)) {
    if (value?.trim()) finalCss[key] = value;
  }
  for (const primary of primaries) {
    for (const [key, value] of Object.entries(primary.data.cssVariables ?? {})) {
      if (!finalCss[key] && value?.trim()) {
        const trial = mergeValidatedAiChrome(ir, {
          cssVariables: { [key]: value },
          summary: "primary fill",
        });
        if (trial[key]) finalCss[key] = trial[key];
      }
    }
  }

  const layout: AiLayoutResponse = {
    cssVariables: finalCss,
    layout:
      refiner.data.layout ??
      primaries.find((p) => p.data.layout)?.data.layout,
    summary:
      refiner.data.summary ||
      primaries[0]?.data.summary ||
      `AI ensemble (${primaries.length} parallel primaries + refiner)`,
  };

  return {
    layout,
    models: [...primaries.map((p) => p.model), refiner.model],
    passes: ["semantic", "primary", "refiner"],
  };
}
