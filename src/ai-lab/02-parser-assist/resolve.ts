import "server-only";

import { createHash } from "crypto";
import { readFileSync } from "fs";
import {
  isApolloStructuredMarkdown,
  isComprehensiveWikiMarkdown,
} from "@/lib/parser/generic";
import { isWorkspaceScanMarkdown } from "@/lib/scan/parse";
import { isAiLabConfigured } from "@/ai-lab/shared/nvidia-profiles";
import {
  needsParserAssist,
  parserAssistEnabled,
} from "@/ai-lab/02-parser-assist/needs-assist";
import { normalizeMarkdownWithAi } from "@/ai-lab/02-parser-assist/normalize";
import {
  loadNormalizedMarkdown,
  persistNormalizedMarkdown,
  purgeNormalizedMarkdown,
} from "@/ai-lab/02-parser-assist/store";

export type ParserAssistResult = {
  applied: boolean;
  cached: boolean;
  model?: string;
  reason?: string;
};

/**
 * How long a page render will wait for the normalizing model.
 *
 * Like font resolve, this sits on the wiki's critical path and its cache is a
 * directory that does not survive a serverless host, so an unbounded call
 * meant an unstructured document could hang the page for as long as the model
 * took. The budget is generous — a normalized doc parses far better than a raw
 * one — but it is finite, and the page renders either way.
 */
const BUDGET_MS = Number(process.env.AI_LAB_PARSER_ASSIST_BUDGET_MS ?? 8000);

/** Documents whose normalize overran or failed, and when to try again. */
const COOLDOWN_MS = 10 * 60_000;
const coolingOff = new Map<string, number>();

function onCooldown(docRef: string): boolean {
  const until = coolingOff.get(docRef);
  if (until === undefined) return false;
  if (Date.now() < until) return true;
  coolingOff.delete(docRef);
  return false;
}

function contentHash(md: string): string {
  return createHash("sha256").update(md).digest("hex").slice(0, 16);
}

/** Markdown to feed into apollo/generic parser (sync). */
export function resolveMarkdownForParsing(
  docRef: string,
  rawMarkdown: string,
): string {
  if (isWorkspaceScanMarkdown(rawMarkdown)) return rawMarkdown;
  if (isComprehensiveWikiMarkdown(rawMarkdown)) return rawMarkdown;
  if (isApolloStructuredMarkdown(rawMarkdown)) return rawMarkdown;

  const hash = contentHash(rawMarkdown);
  const cached = loadNormalizedMarkdown(docRef, hash);
  if (cached && isApolloStructuredMarkdown(cached)) return cached;

  return rawMarkdown;
}

/**
 * Before loadDesignSystem: normalize unstructured docs via AI and cache on disk.
 */
export async function ensureParserAssist(
  docRef: string,
  rawMarkdown: string,
): Promise<ParserAssistResult> {
  // Run the comprehensive-wiki self-heal before any other gate: a stale
  // squashed rewrite can exist on disk even when assist is now disabled, and it
  // must never shadow the doc-driven parser.
  if (isWorkspaceScanMarkdown(rawMarkdown)) {
    return { applied: false, cached: false, reason: "workspace_scan" };
  }
  if (isComprehensiveWikiMarkdown(rawMarkdown)) {
    if (purgeNormalizedMarkdown(docRef)) {
      const { clearDesignSystemCache } = await import("@/lib/clients/registry");
      clearDesignSystemCache();
      return { applied: false, cached: false, reason: "comprehensive_wiki_purged" };
    }
    return { applied: false, cached: false, reason: "comprehensive_wiki" };
  }
  if (!parserAssistEnabled()) {
    return { applied: false, cached: false, reason: "disabled" };
  }
  if (!needsParserAssist(rawMarkdown)) {
    return { applied: false, cached: false, reason: "already_structured" };
  }
  if (!isAiLabConfigured()) {
    return { applied: false, cached: false, reason: "no_api_key" };
  }

  const hash = contentHash(rawMarkdown);
  const existing = loadNormalizedMarkdown(docRef, hash);
  if (existing && isApolloStructuredMarkdown(existing)) {
    return { applied: true, cached: true };
  }

  if (onCooldown(docRef)) {
    return { applied: false, cached: false, reason: "cooling_off" };
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const outcome = await Promise.race([
      normalizeMarkdownWithAi(rawMarkdown, docRef),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), BUDGET_MS);
      }),
    ]);
    if (outcome === null) {
      coolingOff.set(docRef, Date.now() + COOLDOWN_MS);
      console.warn(
        `[ai-lab:02] parser assist for ${docRef} exceeded ${BUDGET_MS}ms — parsing the document as written`,
      );
      return { applied: false, cached: false, reason: "over_budget" };
    }
    const { markdown: normalized, model } = outcome;
    persistNormalizedMarkdown(docRef, hash, normalized, {
      model,
      sourceBytes: rawMarkdown.length,
    });
    const { clearDesignSystemCache } = await import("@/lib/clients/registry");
    clearDesignSystemCache();
    return { applied: true, cached: false, model };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    coolingOff.set(docRef, Date.now() + COOLDOWN_MS);
    console.error("[ai-lab:02] normalize failed for", docRef, message);
    return { applied: false, cached: false, reason: message };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function readRawMarkdown(fullPath: string): string {
  return readFileSync(fullPath, "utf-8");
}
