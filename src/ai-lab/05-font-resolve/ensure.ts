import "server-only";

import type { LoadedDesignSystem } from "@/lib/clients/registry";
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

  try {
    const newResolutions = await resolveFontsWithAi(
      needed,
      docRef,
      system.name,
    );
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
