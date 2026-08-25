import "server-only";
import {
  getAiLabClient,
  getNvidiaProfile,
  isAiLabConfigured,
} from "@/ai-lab/shared/nvidia-profiles";
import { persistDesignProject, type CreatedProject } from "./create";
import type {
  ScannedColor,
  ScannedComponent,
  ScannedCssVar,
} from "@/lib/scan/types";

/** Thrown when no AI model is configured, so callers can fall back to a starter. */
export class AiNotConfiguredError extends Error {}

export type GenSpec = {
  name?: string;
  colors?: { name: string; hex: string; role?: string }[];
  typeScale?: { name: string; px: number }[];
  radii?: { name: string; px: number }[];
  spacing?: { name: string; px: number }[];
  components?: { name: string; role?: string }[];
};

const SYSTEM_PROMPT = `You are a senior design-systems engineer. Given a short description, design a small, tasteful, accessible design system.

Respond with ONLY a JSON object (no prose, no markdown fences) matching exactly:
{
  "name": "string — a short product/system name",
  "colors": [{"name":"Brand Primary","hex":"#1d4ed8","role":"Primary actions"}],
  "typeScale": [{"name":"Body","px":16}],
  "radii": [{"name":"Medium","px":8}],
  "spacing": [{"name":"md","px":16}],
  "components": [{"name":"Button","role":"Primary call to action"}]
}

Rules: 6–10 colors with real, varied hex values (include surfaces, text, border, and a few accents); 4–6 type sizes; 2–4 radii; 3–5 spacing steps; 4–7 components. Hex must be #rrggbb. Keep names concise. Output JSON only.`;

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normHex(raw: string): string | null {
  const m = String(raw).match(/#([0-9a-fA-F]{3,8})\b/);
  if (!m) return null;
  let h = m[1].toLowerCase();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length >= 6) h = h.slice(0, 6);
  return h.length === 6 ? `#${h}` : null;
}

function px(n: unknown): string | null {
  const v = typeof n === "number" ? n : parseFloat(String(n));
  return Number.isFinite(v) && v >= 0 ? `${v}px` : null;
}

/** Pull a JSON object out of a model response (handles fences, <think>, prose). */
export function extractSpec(text: string): GenSpec | null {
  let t = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1];
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1)) as GenSpec;
  } catch {
    return null;
  }
}

export function specToParts(spec: GenSpec): {
  cssVars: ScannedCssVar[];
  colors: ScannedColor[];
  components: ScannedComponent[];
} {
  const SOURCE = "ai";
  const cssVars: ScannedCssVar[] = [];
  const colors: ScannedColor[] = [];
  const seen = new Set<string>();

  const push = (name: string, value: string) => {
    if (!name || name === "--" || seen.has(name)) return;
    seen.add(name);
    cssVars.push({ name, value, source: SOURCE });
  };

  for (const c of (spec.colors ?? []).slice(0, 16)) {
    const hex = normHex(c.hex);
    if (!hex || !c.name) continue;
    const cssVar = `--color-${slug(c.name)}`;
    push(cssVar, hex);
    colors.push({ token: cssVar, hex, source: SOURCE });
  }
  for (const r of (spec.radii ?? []).slice(0, 8)) {
    const v = px(r.px);
    if (v && r.name) push(`--radius-${slug(r.name)}`, v);
  }
  for (const s of (spec.spacing ?? []).slice(0, 10)) {
    const v = px(s.px);
    if (v && s.name) push(`--spacing-${slug(s.name)}`, v);
  }
  for (const t of (spec.typeScale ?? []).slice(0, 10)) {
    const v = px(t.px);
    if (v && t.name) push(`--font-size-${slug(t.name)}`, v);
  }

  const components: ScannedComponent[] = [];
  const seenComp = new Set<string>();
  for (const comp of (spec.components ?? []).slice(0, 12)) {
    const id = slug(comp.name ?? "");
    if (!id || seenComp.has(id)) continue;
    seenComp.add(id);
    components.push({
      id,
      title: comp.name,
      filePath: `project://component/${id}`,
      exports: [comp.name.replace(/[^A-Za-z0-9]/g, "")],
      colorsUsed: [],
      cssVarsUsed: [],
      catalog: {
        category: "design_primitive",
        designerRole: comp.role?.trim() || "Component",
        reason: "",
      },
    });
  }

  return { cssVars, colors, components };
}

/** Generate a design system from a natural-language prompt → editable wiki project. */
export async function generateDesignSystemFromPrompt(
  prompt: string,
): Promise<CreatedProject> {
  if (!isAiLabConfigured()) {
    throw new AiNotConfiguredError("AI generation is not configured.");
  }
  const client = getAiLabClient();
  if (!client) throw new AiNotConfiguredError("AI generation is not configured.");

  const profile = getNvidiaProfile("parser");
  const res = await client.chat.completions.create({
    model: profile.model,
    temperature: 0.5,
    max_tokens: 1800,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt.slice(0, 2000) },
    ],
  });

  const text = res.choices?.[0]?.message?.content ?? "";
  const spec = extractSpec(text);
  if (!spec) throw new Error("The model did not return a usable design system.");

  const parts = specToParts(spec);
  if (parts.colors.length === 0) {
    throw new Error("The model returned no usable colors.");
  }

  const name = spec.name?.trim() || prompt.trim().slice(0, 60) || "Generated System";
  return persistDesignProject(name, parts);
}
