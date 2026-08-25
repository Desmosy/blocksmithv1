import { chatJsonWithProfile } from "@/ai-lab/shared/chat";
import { isAiLabConfigured } from "@/ai-lab/shared/nvidia-profiles";
import {
  GOVERNANCE_DRAFT_SYSTEM,
  buildGovernanceDraftUserPrompt,
} from "./prompt";

export type GovernanceDraftInput = {
  componentTitle: string;
  componentId: string;
  currentRole: string;
  currentDescription: string;
  userPrompt: string;
  scanContext?: {
    sourceFile: string;
    exports: string[];
    cssVarsUsed: string[];
    colorsUsed: string[];
  };
};

export type GovernanceDraftResult = {
  role: string;
  description: string;
  rationale: string;
  model: string;
};

function parseGovernanceDraft(raw: unknown): GovernanceDraftResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("Model returned non-object JSON");
  }
  const o = raw as Record<string, unknown>;
  const role = typeof o.role === "string" ? o.role.trim() : "";
  const description = typeof o.description === "string" ? o.description.trim() : "";
  const rationale = typeof o.rationale === "string" ? o.rationale.trim() : "";
  if (!role && !description) {
    throw new Error("Model returned empty role and description");
  }
  return { role, description, rationale, model: "" };
}

export function governanceCopilotEnabled(): boolean {
  return isAiLabConfigured();
}

export async function draftComponentGovernance(
  input: GovernanceDraftInput,
): Promise<GovernanceDraftResult> {
  if (!isAiLabConfigured()) {
    throw new Error(
      "NVIDIA_API_KEY missing — add it to .env.local to use the governance copilot (see src/ai-lab/README.md).",
    );
  }

  const prompt = input.userPrompt.trim();
  if (!prompt) {
    throw new Error("Prompt is required");
  }

  const { data, result } = await chatJsonWithProfile(
    "parser",
    [
      { role: "system", content: GOVERNANCE_DRAFT_SYSTEM },
      {
        role: "user",
        content: buildGovernanceDraftUserPrompt({ ...input, userPrompt: prompt }),
      },
    ],
    parseGovernanceDraft,
  );

  return { ...data, model: result.model };
}
