import "server-only";

import type { LoadedDesignSystem } from "@/lib/clients/registry";
import type { TypographyFamily } from "@/lib/blocks/types";
import type { DesignIR } from "@/lib/design-ir/schema";
import { compileFontStacksWithResolutions } from "@/lib/fonts/font-resolve";
import {
  listFontsNeedingResolve,
  type FontResolutionMap,
} from "@/lib/fonts/font-resolve";
import { isAiLabConfigured } from "@/ai-lab/shared/nvidia-profiles";
import { resolveFontsWithAi } from "@/ai-lab/05-font-resolve/match";
import { FONT_RESOLVE_REV } from "@/ai-lab/05-font-resolve/types";
import { persistDesignIR } from "@/lib/design-ir/store";

export type FontResolveResult = {
  applied: boolean;
  cached: boolean;
  resolvedCount: number;
  model?: string;
  reason?: string;
};

/**
 * How long a page render will wait for the font-matching model.
 *
 * This runs on the wiki's critical path: nothing reaches the browser until it
 * returns. The call was unbounded, and its cache (`.blocksmith/design`) is
 * gitignored and unwritable on a serverless host — so every request paid the
 * full model latency and a slow model hung the page indefinitely. A resolved
 * font is a nicety; the stacks already carry real fallbacks. So it gets a
 * budget, and the page renders either way.
 */
const BUDGET_MS = Number(process.env.AI_LAB_FONT_RESOLVE_BUDGET_MS ?? 2500);

/**
 * Documents whose resolve overran or failed, and when to try again.
 *
 * Without this, a doc the model is slow on pays the budget on every render,
 * for every reader. Per-process and deliberately short: a warm server stops
 * retrying, a new one starts fresh.
 */
const COOLDOWN_MS = 10 * 60_000;
const coolingOff = new Map<string, number>();

function onCooldown(docRef: string): boolean {
  const until = coolingOff.get(docRef);
  if (until === undefined) return false;
  if (Date.now() < until) return true;
  coolingOff.delete(docRef);
  return false;
}

/** Resolve within the budget, or `null` — the caller renders without it. */
async function resolveWithinBudget(
  fonts: TypographyFamily[],
  docRef: string,
  systemName: string,
): Promise<FontResolutionMap | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      resolveFontsWithAi(fonts, docRef, systemName),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), BUDGET_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function fontResolveEnabled(): boolean {
  const flag = process.env.AI_LAB_FONT_RESOLVE?.trim();
  if (flag === "0" || flag?.toLowerCase() === "false") return false;
  return true;
}

function cacheSatisfied(ir: DesignIR, system: LoadedDesignSystem): boolean {
  if (ir.fontResolveRev !== FONT_RESOLVE_REV) return false;
  const needed = listFontsNeedingResolve(
    system.typography,
    ir.fontResolutions,
  );
  return needed.length === 0;
}

function applyResolutionsToIR(
  ir: DesignIR,
  system: LoadedDesignSystem,
  merged: FontResolutionMap,
): DesignIR {
  return {
    ...ir,
    fontResolutions: merged,
    fontResolveRev: FONT_RESOLVE_REV,
    fontStacks: compileFontStacksWithResolutions(
      system.typography,
      merged,
    ),
  };
}

/**
 * After Design IR compile: LLM-match unresolved proprietary fonts (parser model).
 * Results cached in ir.json keyed by doc contentHash.
 */
export async function ensureFontResolve(
  docRef: string,
  system: LoadedDesignSystem,
  ir: DesignIR,
): Promise<{ ir: DesignIR; result: FontResolveResult }> {
  if (!fontResolveEnabled()) {
    return {
      ir,
      result: { applied: false, cached: false, resolvedCount: 0, reason: "disabled" },
    };
  }

  if (cacheSatisfied(ir, system)) {
    return {
      ir,
      result: {
        applied: true,
        cached: true,
        resolvedCount: Object.keys(ir.fontResolutions ?? {}).length,
      },
    };
  }

  const needed = listFontsNeedingResolve(
    system.typography,
    ir.fontResolutions,
  );

  if (needed.length === 0) {
    const updated = applyResolutionsToIR(ir, system, ir.fontResolutions ?? {});
    try {
      persistDesignIR(updated);
    } catch (err) {
      console.error("[ai-lab:05] persist IR failed:", docRef, err);
    }
    return {
      ir: updated,
      result: { applied: true, cached: true, resolvedCount: 0 },
    };
  }

  if (!isAiLabConfigured()) {
    return {
      ir,
      result: {
        applied: false,
        cached: false,
        resolvedCount: 0,
        reason: "no_api_key",
      },
    };
  }

  if (onCooldown(docRef)) {
    return {
      ir,
      result: { applied: false, cached: false, resolvedCount: 0, reason: "cooling_off" },
    };
  }

  try {
    const newResolutions = await resolveWithinBudget(needed, docRef, system.name);
    if (newResolutions === null) {
      coolingOff.set(docRef, Date.now() + COOLDOWN_MS);
      console.warn(
        `[ai-lab:05] font resolve for ${docRef} exceeded ${BUDGET_MS}ms — rendering with fallback stacks`,
      );
      return {
        ir,
        result: { applied: false, cached: false, resolvedCount: 0, reason: "over_budget" },
      };
    }
    const merged: FontResolutionMap = {
      ...(ir.fontResolutions ?? {}),
      ...newResolutions,
    };
    const updated = applyResolutionsToIR(ir, system, merged);
    try {
      persistDesignIR(updated);
    } catch (err) {
      console.error("[ai-lab:05] persist IR failed:", docRef, err);
    }

    const model = Object.values(newResolutions).find((r) => r.model)?.model;
    return {
      ir: updated,
      result: {
        applied: true,
        cached: false,
        resolvedCount: Object.keys(newResolutions).length,
        model,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    coolingOff.set(docRef, Date.now() + COOLDOWN_MS);
    console.error("[ai-lab:05] font resolve failed for", docRef, message);
    return {
      ir,
      result: {
        applied: false,
        cached: false,
        resolvedCount: 0,
        reason: message,
      },
    };
  }
}
