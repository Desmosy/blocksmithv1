import OpenAI from "openai";

export type NvidiaProfileId = "chrome" | "parser";

export type NvidiaProfile = {
  id: NvidiaProfileId;
  model: string;
  temperature: number;
  top_p: number;
  max_tokens: number;
  /** Nemotron reasoning/thinking — off for JSON chrome reliability */
  enable_thinking: boolean;
  reasoning_budget?: number;
};

const BASE_URL =
  process.env.NVIDIA_BASE_URL?.trim() ||
  "https://integrate.api.nvidia.com/v1";

export function getNvidiaProfile(id: NvidiaProfileId): NvidiaProfile {
  if (id === "chrome") {
    return {
      id,
      model:
        process.env.NVIDIA_MODEL_CHROME?.trim() ||
        (process.env.VERCEL === "1"
          ? "nvidia/nemotron-3-super-120b-a12b"
          : "nvidia/nemotron-3-ultra-550b-a55b"),
      temperature: 0.35,
      top_p: 0.95,
      max_tokens: 8192,
      enable_thinking: false,
      reasoning_budget: 4096,
    };
  }
  return {
    id,
    model:
      process.env.NVIDIA_MODEL_PARSER?.trim() || "openai/gpt-oss-120b",
    temperature: 0.5,
    top_p: 1,
    max_tokens: 4096,
    enable_thinking: false,
  };
}

function apiKeys(): string[] {
  const keys = [
    process.env.NVIDIA_API_KEY?.trim(),
    process.env.NVIDIA_API_KEY_FALLBACK?.trim(),
  ].filter((k): k is string => Boolean(k));
  return [...new Set(keys)];
}

export function isAiLabConfigured(): boolean {
  return apiKeys().length > 0;
}

export function createNvidiaClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey, baseURL: BASE_URL });
}

/** First working client from primary / fallback keys. */
export function getAiLabClient(): OpenAI | null {
  const keys = apiKeys();
  if (keys.length === 0) return null;
  return createNvidiaClient(keys[0]);
}
