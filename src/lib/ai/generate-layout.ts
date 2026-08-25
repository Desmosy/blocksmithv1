/**
 * Wiki chrome AI — single fast pass by default; optional multi-agent ensemble.
 * @see src/ai-lab/01-ai-chrome/compile-chrome.ts
 * @see src/ai-lab/01-ai-chrome/compile-ensemble.ts
 */
import { compileChromeWithAi } from "@/ai-lab/01-ai-chrome/compile-chrome";
import {
  compileChromeEnsemble,
  type ChromeEnsembleResult,
} from "@/ai-lab/01-ai-chrome/compile-ensemble";
import { getNvidiaProfile } from "@/ai-lab/shared/nvidia-profiles";

export type { ChromeEnsembleResult };

export async function generateAiLayout(
  docRef: string,
): Promise<ChromeEnsembleResult> {
  if (process.env.NVIDIA_ENSEMBLE === "1") {
    return compileChromeEnsemble(docRef);
  }

  const layout = await compileChromeWithAi(docRef);
  const model =
    process.env.NVIDIA_MODEL_CHROME?.trim() ||
    getNvidiaProfile("chrome").model;

  return {
    layout,
    models: [model],
    passes: ["semantic", "primary"],
  };
}
