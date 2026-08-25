import type OpenAI from "openai";
import {
  createNvidiaClient,
  getAiLabClient,
  getNvidiaProfile,
  type NvidiaProfileId,
} from "@/ai-lab/shared/nvidia-profiles";
import { extractJsonFromModelText } from "@/ai-lab/shared/extract-json";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatResult = {
  content: string;
  reasoning?: string;
  model: string;
};

function extraBodyForProfile(profile: ReturnType<typeof getNvidiaProfile>) {
  if (!profile.enable_thinking) {
    return {
      extra_body: {
        chat_template_kwargs: { enable_thinking: false },
      },
    } as Record<string, unknown>;
  }
  return {
    extra_body: {
      chat_template_kwargs: { enable_thinking: true },
      reasoning_budget: profile.reasoning_budget ?? 8192,
    },
  } as Record<string, unknown>;
}

const CHROME_MODEL_FALLBACKS = [
  "nvidia/nemotron-3-super-120b-a12b",
  "openai/gpt-oss-120b",
] as const;

/**
 * Try an explicit, ordered list of models across all available API keys —
 * first success wins. Use this when latency/reliability matter more than a
 * specific profile's default model (e.g. a live, multi-user endpoint that
 * must not block on a 550B model). `maxTokens` trims output for speed/cost.
 */
export async function chatWithModels(
  models: string[],
  profileId: NvidiaProfileId,
  messages: ChatMessage[],
  opts?: { maxTokens?: number; stream?: boolean },
): Promise<ChatResult> {
  const base = getNvidiaProfile(profileId);
  const keys = [
    process.env.NVIDIA_API_KEY?.trim(),
    process.env.NVIDIA_API_KEY_FALLBACK?.trim(),
  ].filter((k, i, a): k is string => Boolean(k) && a.indexOf(k) === i);
  if (keys.length === 0) {
    throw new Error(
      "NVIDIA_API_KEY missing. Add it to .env.local (see src/ai-lab/README.md).",
    );
  }

  let lastErr: unknown;
  for (const apiKey of keys) {
    const client = createNvidiaClient(apiKey);
    for (const model of models) {
      try {
        return await runChat(
          client,
          { ...base, model, max_tokens: opts?.maxTokens ?? base.max_tokens },
          messages,
          opts?.stream ?? false,
        );
      } catch (err) {
        lastErr = err;
        console.warn(`[ai-lab] chatWithModels: ${model} failed, trying next…`);
      }
    }
  }
  throw lastErr;
}

export async function chatWithProfile(
  profileId: NvidiaProfileId,
  messages: ChatMessage[],
  options?: { stream?: boolean },
): Promise<ChatResult> {
  const profile = getNvidiaProfile(profileId);
  const client = getAiLabClient();
  if (!client) {
    throw new Error(
      "NVIDIA_API_KEY missing. Add it to .env.local (see src/ai-lab/README.md).",
    );
  }

  const modelsToTry =
    profileId === "chrome"
      ? [profile.model, ...CHROME_MODEL_FALLBACKS.filter((m) => m !== profile.model)]
      : [profile.model];

  let lastErr: unknown;
  for (const model of modelsToTry) {
    try {
      return await runChat(client, { ...profile, model }, messages, options?.stream ?? false);
    } catch (err) {
      lastErr = err;
      console.warn(`[ai-lab] model ${model} failed, trying next…`);
    }
  }

  const fallbackKey = process.env.NVIDIA_API_KEY_FALLBACK?.trim();
  const primary = process.env.NVIDIA_API_KEY?.trim();
  if (fallbackKey && fallbackKey !== primary) {
    const fbClient = createNvidiaClient(fallbackKey);
    for (const model of modelsToTry) {
      try {
        return await runChat(fbClient, { ...profile, model }, messages, options?.stream ?? false);
      } catch (err) {
        lastErr = err;
      }
    }
  }

  throw lastErr;
}

async function runChat(
  client: OpenAI,
  profile: ReturnType<typeof getNvidiaProfile>,
  messages: ChatMessage[],
  stream: boolean,
): Promise<ChatResult> {
  const base = {
    model: profile.model,
    messages,
    temperature: profile.temperature,
    top_p: profile.top_p,
    max_tokens: profile.max_tokens,
    ...extraBodyForProfile(profile),
  };

  if (stream) {
    const completion = await client.chat.completions.create({
      ...base,
      stream: true,
    });
    let content = "";
    let reasoning = "";
    for await (const chunk of completion) {
      if (!chunk.choices?.length) continue;
      const delta = chunk.choices[0].delta as {
        content?: string | null;
        reasoning_content?: string | null;
      };
      if (delta.reasoning_content) reasoning += delta.reasoning_content;
      if (delta.content) content += delta.content;
    }
    return { content, reasoning: reasoning || undefined, model: profile.model };
  }

  const completion = await client.chat.completions.create({
    ...base,
    stream: false,
  });
  const msg = completion.choices[0]?.message as {
    content?: string | null;
    reasoning_content?: string | null;
  };
  const content = msg?.content ?? "";
  if (!content) throw new Error(`Empty response from ${profile.model}`);
  return {
    content,
    reasoning: msg?.reasoning_content ?? undefined,
    model: profile.model,
  };
}

export async function chatJsonWithProfile<T>(
  profileId: NvidiaProfileId,
  messages: ChatMessage[],
  parse: (raw: unknown) => T,
): Promise<{ data: T; result: ChatResult }> {
  const result = await chatWithProfile(profileId, messages, { stream: false });
  const jsonText = extractJsonFromModelText(result.content);
  const parsed = JSON.parse(jsonText) as unknown;
  return { data: parse(parsed), result };
}

/** Single-model call for parallel ensemble agents (no sequential fallback). */
export async function chatJsonWithModel<T>(
  model: string,
  profileId: NvidiaProfileId,
  messages: ChatMessage[],
  parse: (raw: unknown) => T,
): Promise<{ data: T; result: ChatResult }> {
  const client = getAiLabClient();
  if (!client) {
    throw new Error(
      "NVIDIA_API_KEY missing. Add it to .env.local (see src/ai-lab/README.md).",
    );
  }
  const profile = { ...getNvidiaProfile(profileId), model };
  const result = await runChat(client, profile, messages, false);
  const jsonText = extractJsonFromModelText(result.content);
  const parsed = JSON.parse(jsonText) as unknown;
  return { data: parse(parsed), result };
}
