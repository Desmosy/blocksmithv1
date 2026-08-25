import {
  curateScanToWikiMarkdown,
  scanCurateEnabled,
  scanFactsHash,
} from "./curate";
import { mergeInventoryIntoMarkdown } from "@/lib/scan/inventory";
import { loadCuratedScan, persistCuratedScan } from "./store";
import type { WorkspaceScanResult } from "@/lib/scan/types";

export type ScanCurateResult = {
  applied: boolean;
  cached: boolean;
  markdown: string;
  model?: string;
  reason?: string;
};

/**
 * Scan → [black box] → wiki .md
 * Falls back to deterministic facts markdown when disabled or on failure.
 */
export async function resolveScanMarkdownForWiki(
  result: WorkspaceScanResult,
  factsMarkdown: string,
  docRef: string,
): Promise<ScanCurateResult> {
  if (!scanCurateEnabled()) {
    return { applied: false, cached: false, markdown: factsMarkdown, reason: "disabled" };
  }

  const hash = scanFactsHash(factsMarkdown);
  const cached = loadCuratedScan(docRef, hash);
  if (cached) {
    return {
      applied: true,
      cached: true,
      markdown: mergeInventoryIntoMarkdown(cached, result.inventory),
    };
  }

  try {
    const { markdown: curated, model } = await curateScanToWikiMarkdown(
      result,
      factsMarkdown,
      docRef,
    );
    const markdown = mergeInventoryIntoMarkdown(curated, result.inventory);
    persistCuratedScan(docRef, hash, markdown, {
      model,
      factsBytes: factsMarkdown.length,
    });
    return { applied: true, cached: false, markdown, model };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ai-lab:09] scan curate failed for", docRef, message);
    return { applied: false, cached: false, markdown: factsMarkdown, reason: message };
  }
}
