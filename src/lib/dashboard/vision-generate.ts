import "server-only";
import {
  getAiLabClient,
  isAiLabConfigured,
} from "@/ai-lab/shared/nvidia-profiles";
import { persistDesignProject, type CreatedProject } from "./create";
import { AiNotConfiguredError, extractSpec, specToParts } from "./generate";

/** Image-capable model. Override with NVIDIA_MODEL_VISION. */
const VISION_MODEL =
  process.env.NVIDIA_MODEL_VISION?.trim() ||
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning";

const VISION_PROMPT = `You are a senior design-systems engineer. Look at this UI screenshot and infer the design system it uses.

Respond with ONLY a JSON object (no prose, no markdown fences) matching exactly:
{
  "name": "string — a short product/system name",
  "colors": [{"name":"Brand Primary","hex":"#1d4ed8","role":"Primary actions"}],
  "typeScale": [{"name":"Body","px":16}],
  "radii": [{"name":"Medium","px":8}],
  "spacing": [{"name":"md","px":16}],
  "components": [{"name":"Button","role":"Primary call to action"}]
}

Extract the dominant colors you actually see as #rrggbb hex (surfaces, text, borders, accents), approximate type sizes, corner radii, spacing steps, and the visible components each with a concise role. Output JSON only.`;

/** Generate a design system from a UI screenshot (data URL or https URL). */
export async function generateDesignSystemFromImage(
  imageUrl: string,
): Promise<CreatedProject> {
  if (!isAiLabConfigured()) {
    throw new AiNotConfiguredError("AI is not configured.");
  }
  const client = getAiLabClient();
  if (!client) throw new AiNotConfiguredError("AI is not configured.");

  const params = {
    model: VISION_MODEL,
    temperature: 0.4,
    max_tokens: 6000,
    messages: [
      {
        role: "user" as const,
        content: [
          { type: "text" as const, text: VISION_PROMPT },
          { type: "image_url" as const, image_url: { url: imageUrl } },
        ],
      },
    ],
  };
  // NVIDIA reasoning controls (sent at body root, like Python's extra_body).
  (params as Record<string, unknown>).chat_template_kwargs = {
    enable_thinking: false,
  };

  const res = await client.chat.completions.create(params);
  const text = res.choices?.[0]?.message?.content ?? "";
  const spec = extractSpec(text);
  if (!spec) {
    throw new Error("The model could not read a design system from that image.");
  }
  const parts = specToParts(spec);
  if (parts.colors.length === 0) {
    throw new Error("No colors could be read from the image.");
  }
  const name = spec.name?.trim() || "From screenshot";
  return persistDesignProject(name, parts);
}
