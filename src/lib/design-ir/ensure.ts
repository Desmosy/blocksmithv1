import "server-only";

import type { LoadedDesignSystem } from "@/lib/clients/registry";
import { compileDesignIR } from "@/lib/design-ir/compile";
import {
  DESIGN_IR_COMPILER_REV,
  type DesignIR,
} from "@/lib/design-ir/schema";
import {
  loadDesignIR,
  persistDesignIRFromSystem,
} from "@/lib/design-ir/store";
import { ensureFontResolve } from "@/ai-lab/05-font-resolve/ensure";

/**
 * Returns cached IR when content hash matches; otherwise recompiles and persists.
 */
export function ensureDesignIR(
  docRef: string,
  system: LoadedDesignSystem,
): DesignIR {
  try {
    const cached = loadDesignIR(docRef);
    const hash = system.contentHash ?? "";
    if (
      cached &&
      cached.contentHash === hash &&
      hash.length > 0 &&
      cached.compilerRev === DESIGN_IR_COMPILER_REV
    ) {
      return cached;
    }
    try {
      return persistDesignIRFromSystem(docRef, system);
    } catch (err) {
      console.error("[design-ir] persist failed, using in-memory IR:", docRef, err);
      return compileDesignIR(docRef, system);
    }
  } catch (err) {
    console.error("[design-ir] compile failed for", docRef, err);
    throw err;
  }
}

/** Compile/cache IR, then parser-model font matching (cached on IR). */
export async function ensureDesignIRWithFonts(
  docRef: string,
  system: LoadedDesignSystem,
): Promise<DesignIR> {
  const ir = ensureDesignIR(docRef, system);
  const { ir: resolved } = await ensureFontResolve(docRef, system, ir);
  return resolved;
}
