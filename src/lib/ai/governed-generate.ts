import "server-only";

import { createHash } from "crypto";
import {
  prepareDesignSystemDoc,
  loadDesignSystem,
  type LoadedDesignSystem,
} from "@/lib/clients/registry";
import { packageNameForDoc } from "@/lib/ir/releases";
import { formatDesignContextForPrompt } from "@/lib/ai/build-design-context";
import {
  paletteFromColors,
  findOffTokenColors,
  nearestToken,
} from "@/lib/governance/color-lint";
import { chatWithModels, type ChatMessage } from "@/ai-lab/shared/chat";

/**
 * Fast, reliable models for live generation — deliberately NOT the heavy 550B
 * "chrome" model (≈2min/call). Override with NVIDIA_MODEL_GENERATE (comma-sep).
 */
const GENERATE_MODELS = (
  process.env.NVIDIA_MODEL_GENERATE?.trim() ||
  "nvidia/nemotron-3-super-120b-a12b,openai/gpt-oss-120b"
)
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

/** Component code is short; cap tokens for speed + cost. */
const GENERATE_MAX_TOKENS = Number(process.env.NVIDIA_GENERATE_MAX_TOKENS ?? 1600);

/**
 * Governed vs ungoverned generation — the live engine behind the investor
 * showcase AND a real product surface (the playground / "generate with my
 * design system"). One prompt, two agents:
 *
 *   · ungoverned — no design system; invents brand values.
 *   · governed   — grounded in the tenant's approved tokens + components and
 *                  told to use only those.
 *
 * Crucially, drift is scored by the SAME color-lint engine the CI gate and the
 * MCP `validate_ui_code` tool use — so the violation counts are real
 * enforcement output, not the model's self-assessment.
 *
 * Stateless and tenant-safe: callers must pass a docRef they're authorized for
 * (enforced at the route). Results are cached by (doc, contentHash, prompt) to
 * cap LLM spend and make repeat demos instant.
 */

export interface DriftViolation {
  hex: string;
  line: number;
  snippet: string;
  /** Nearest approved token — the prescriptive fix. */
  nearest?: { name: string; cssVar?: string; hex: string };
}

export interface AgentOutput {
  code: string;
  driftCount: number;
  violations: DriftViolation[];
  /** True when the output imports the approved package. */
  usesApprovedKit: boolean;
  model: string;
}

export interface GovernedGenerateResult {
  doc: string;
  systemName: string;
  prompt: string;
  packageName: string;
  approvedTokenCount: number;
  approvedComponents: string[];
  governed: AgentOutput;
  ungoverned: AgentOutput;
  cached: boolean;
  generatedAt: string;
}

export const MAX_PROMPT_LEN = 600;

const CODE_FENCE_RE = /```(?:tsx?|jsx?|javascript|typescript)?\s*([\s\S]*?)```/i;

/** Pull the first fenced code block, or return the trimmed text as-is. */
function extractCode(raw: string): string {
  const m = raw.match(CODE_FENCE_RE);
  return (m ? m[1] : raw).trim();
}

function approvedComponentTitles(system: LoadedDesignSystem): string[] {
  return system.components
    .map((c) => c.title)
    .filter((t) => /^[A-Z]/.test(t))
    .slice(0, 24);
}

function scoreDrift(
  code: string,
  system: LoadedDesignSystem,
): AgentOutput["violations"] {
  const palette = paletteFromColors(system.colors);
  const offTokens = findOffTokenColors(code, palette);
  return offTokens.map((o) => {
    const near = nearestToken(o.hex, system.colors);
    return {
      hex: o.hex,
      line: o.line,
      snippet: o.snippet,
      nearest: near
        ? { name: near.name, cssVar: near.cssVar, hex: near.hex }
        : undefined,
    };
  });
}

function buildOutput(
  raw: string,
  model: string,
  system: LoadedDesignSystem,
  packageName: string,
): AgentOutput {
  const code = extractCode(raw);
  const violations = scoreDrift(code, system);
  return {
    code,
    violations,
    driftCount: violations.length,
    usesApprovedKit: code.includes(packageName),
    model,
  };
}

function ungovernedMessages(prompt: string): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You are a frontend engineer AI. Write a single small, self-contained " +
        "React + TypeScript (TSX) component for the user's request. Use inline " +
        "styles. You have no design system or component library to follow — use " +
        "your own judgment for colors, spacing, and components. Respond with " +
        "ONLY one ```tsx code block, no prose.",
    },
    { role: "user", content: prompt },
  ];
}

function governedMessages(
  prompt: string,
  system: LoadedDesignSystem,
  packageName: string,
  approvedComponents: string[],
): ChatMessage[] {
  const context = formatDesignContextForPrompt(system);
  return [
    {
      role: "system",
      content:
        "You are a frontend engineer AI working inside a governed design " +
        "system. You MUST follow these hard rules:\n" +
        `1. Colors: use ONLY the CSS variable tokens below via var(--token). NEVER write a raw hex value.\n` +
        `2. Components: compose ONLY these approved components: ${approvedComponents.join(", ") || "(none — use tokens on native elements)"}.\n` +
        `3. Import approved components from "${packageName}" and import "${packageName}/tokens.css".\n` +
        "4. Do not invent variants, colors, or components outside the system.\n\n" +
        "APPROVED DESIGN SYSTEM (authoritative — this is what the team pinned " +
        "in their blocksmith.lock):\n" +
        context +
        "\n\nRespond with ONLY one ```tsx code block, no prose.",
    },
    { role: "user", content: prompt },
  ];
}

// ── Result cache (cap LLM spend; instant repeat demos) ──────────────────────
type CacheEntry = { at: number; result: GovernedGenerateResult };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX = 200;

function cacheKey(doc: string, contentHash: string, prompt: string): string {
  return createHash("sha256")
    .update(`${doc}::${contentHash}::${prompt}`)
    .digest("hex");
}

function readCache(key: string): GovernedGenerateResult | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.result;
}

function writeCache(key: string, result: GovernedGenerateResult): void {
  if (cache.size >= CACHE_MAX) {
    // Drop oldest — cheap LRU-ish eviction.
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) cache.delete(oldest[0]);
  }
  cache.set(key, { at: Date.now(), result });
}

/** Sanitize + bound the user prompt. Throws on empty. */
export function normalizePrompt(input: unknown): string {
  const p = typeof input === "string" ? input.trim() : "";
  if (!p) throw new Error("Prompt is required.");
  return p.slice(0, MAX_PROMPT_LEN);
}

export async function runGovernedGenerate(
  docRef: string,
  rawPrompt: string,
): Promise<GovernedGenerateResult> {
  const prompt = normalizePrompt(rawPrompt);

  await prepareDesignSystemDoc(docRef);
  const system = loadDesignSystem(docRef);
  const packageName = packageNameForDoc(docRef);
  const approvedComponents = approvedComponentTitles(system);

  const key = cacheKey(docRef, system.contentHash ?? "", prompt);
  const cachedResult = readCache(key);
  if (cachedResult) return { ...cachedResult, cached: true };

  // Two agents in parallel — same prompt, different grounding.
  const [ungovRaw, govRaw] = await Promise.all([
    chatWithModels(GENERATE_MODELS, "chrome", ungovernedMessages(prompt), {
      maxTokens: GENERATE_MAX_TOKENS,
    }),
    chatWithModels(
      GENERATE_MODELS,
      "chrome",
      governedMessages(prompt, system, packageName, approvedComponents),
      { maxTokens: GENERATE_MAX_TOKENS },
    ),
  ]);

  const result: GovernedGenerateResult = {
    doc: docRef,
    systemName: system.name,
    prompt,
    packageName,
    approvedTokenCount: system.colors.length,
    approvedComponents,
    ungoverned: buildOutput(ungovRaw.content, ungovRaw.model, system, packageName),
    governed: buildOutput(govRaw.content, govRaw.model, system, packageName),
    cached: false,
    generatedAt: new Date().toISOString(),
  };

  writeCache(key, result);
  return result;
}
