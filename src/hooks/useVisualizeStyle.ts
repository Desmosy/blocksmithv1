"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import type { LoadedDesignSystem } from "@/lib/clients/registry";
import type { AiLayoutResponse } from "@/lib/ai/layout-schema";
import type { DesignIR } from "@/lib/design-ir/schema";
import { useDesignIR } from "@/lib/design-ir/context";
import {
  applyVisualizeThemeFromIR,
  clearThemeFromDocument,
  getInlineThemeKeysFromIR,
  getWikiChromeKeysFromIR,
} from "@/lib/apollo/apply-theme-client";
import { loadGoogleFontsForTypographyAsync } from "@/lib/fonts/load-google-fonts";
import {
  loadVisualizePreference,
  saveVisualizePreference,
} from "@/lib/visualize-storage";
import {
  visualizeAiRefineWarning,
  visualizeStatusMessage,
  type VisualizeCompileMode,
} from "@/ai-lab/03-visualize-status/messages";

const LAYOUT_EXTRA_KEYS = [
  "--wiki-content-max",
  "--wiki-sidebar-width",
  "--wiki-radius",
  "--wiki-radius-card",
];

const MIN_LOADING_MS = 800;
/** Background AI refine — preview is already visible from semantic IR. */
const AI_LAYOUT_TIMEOUT_MS = 90_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Wiki can visualize when IR has tokens (semantic chrome — no LLM required). */
export function canVisualizeSystem(ir: DesignIR): boolean {
  return (
    ir.tokens.colors.length > 0 ||
    ir.tokens.components.length > 0 ||
    ir.tokens.spacing.length > 0
  );
}

export function useVisualizeStyle(
  _system: LoadedDesignSystem,
  fileName: string,
) {
  const ir = useDesignIR();
  const [applied, setApplied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [compileMode, setCompileMode] = useState<VisualizeCompileMode>(
    "unavailable",
  );
  const [aiWarning, setAiWarning] = useState<string | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const applyingRef = useRef(false);
  const appliedHashRef = useRef<string | null>(null);
  const aiRunningRef = useRef(false);

  const hasTokens = canVisualizeSystem(ir);
  const canVisualize = hasTokens;

  useEffect(() => {
    void fetch("/api/ai/status")
      .then((r) => r.json())
      .then((d: { configured?: boolean }) => setAiConfigured(!!d.configured))
      .catch(() => setAiConfigured(false));
  }, []);

  const applyDeterministicTheme = useCallback(async () => {
    await loadGoogleFontsForTypographyAsync(
      ir.tokens.typography,
      ir.fontResolutions,
    );
    applyVisualizeThemeFromIR(ir);
    setCompileMode("deterministic");
    setSummary(visualizeStatusMessage("deterministic"));
  }, [ir]);

  const applyAiTheme = useCallback(
    async (layout: AiLayoutResponse) => {
      await loadGoogleFontsForTypographyAsync(
        ir.tokens.typography,
        ir.fontResolutions,
      );
      applyVisualizeThemeFromIR(ir, layout);
      setCompileMode("ai");
      setSummary(
        layout.summary ?? visualizeStatusMessage("ai"),
      );
      setAiWarning(null);
    },
    [ir],
  );

  const fetchAndApplyAiLayout = useCallback(async (): Promise<void> => {
    if (aiConfigured !== true || aiRunningRef.current) return;

    aiRunningRef.current = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_LAYOUT_TIMEOUT_MS);

    try {
      const res = await fetch("/api/ai/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc: fileName,
          contentHash: ir.contentHash,
        }),
        signal: controller.signal,
      });

      const data = (await res.json()) as {
        layout?: AiLayoutResponse;
        summary?: string;
        error?: string;
      };

      if (res.ok && data.layout) {
        await applyAiTheme(data.layout);
        return;
      }

      const err = data.error ?? `AI layout failed (${res.status})`;
      setAiWarning(visualizeAiRefineWarning(err));
      console.warn("[visualize] AI refine:", err);
    } catch (err) {
      const msg =
        err instanceof Error && err.name === "AbortError"
          ? `AI layout timed out after ${AI_LAYOUT_TIMEOUT_MS / 1000}s`
          : err instanceof Error
            ? err.message
            : String(err);
      setAiWarning(visualizeAiRefineWarning(msg));
      console.warn("[visualize] AI refine failed, keeping semantic chrome", err);
    } finally {
      clearTimeout(timeout);
      aiRunningRef.current = false;
    }
  }, [fileName, ir.contentHash, aiConfigured, applyAiTheme]);

  useEffect(() => {
    const wasApplied = loadVisualizePreference(fileName);
    if (wasApplied && canVisualize) {
      setApplied(true);
      appliedHashRef.current = ir.contentHash;
      void applyDeterministicTheme();
      void fetchAndApplyAiLayout();
    }
    setHydrated(true);
  }, [
    fileName,
    canVisualize,
    ir.contentHash,
    applyDeterministicTheme,
    fetchAndApplyAiLayout,
  ]);

  useEffect(() => {
    if (!hydrated || !applied || !canVisualize) return;
    if (appliedHashRef.current === ir.contentHash) return;
    appliedHashRef.current = ir.contentHash;
    void (async () => {
      await applyDeterministicTheme();
      await fetchAndApplyAiLayout();
    })();
  }, [
    ir.contentHash,
    hydrated,
    applied,
    canVisualize,
    applyDeterministicTheme,
    fetchAndApplyAiLayout,
  ]);

  useEffect(() => {
    if (!hydrated) return;
    saveVisualizePreference(fileName, applied);
  }, [applied, fileName, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (applied) {
      document.documentElement.classList.add("design-wiki-applied");
      document.documentElement.dataset.theme = "design";
    } else {
      document.documentElement.classList.remove("design-wiki-applied");
      document.documentElement.dataset.theme = "light";
      delete document.documentElement.dataset.wikiNav;
      setSummary(null);
      setAiWarning(null);
      setCompileMode("unavailable");
    }
  }, [applied, hydrated]);

  const clear = useCallback(() => {
    clearThemeFromDocument(
      getInlineThemeKeysFromIR(ir),
      LAYOUT_EXTRA_KEYS,
      getWikiChromeKeysFromIR(ir),
    );
    appliedHashRef.current = null;
    setApplied(false);
  }, [ir]);

  const apply = useCallback(async () => {
    if (!canVisualize || applyingRef.current) return;

    applyingRef.current = true;
    const started = Date.now();
    setLoading(true);
    setAiWarning(null);
    setApplied(true);

    try {
      await applyDeterministicTheme();
      appliedHashRef.current = ir.contentHash;

      const elapsed = Date.now() - started;
      if (elapsed < MIN_LOADING_MS) {
        await sleep(MIN_LOADING_MS - elapsed);
      }
      setLoading(false);

      void fetchAndApplyAiLayout();
    } catch {
      setLoading(false);
    } finally {
      applyingRef.current = false;
    }
  }, [
    canVisualize,
    applyDeterministicTheme,
    fetchAndApplyAiLayout,
    ir.contentHash,
  ]);

  const toggle = useCallback(() => {
    if (applied) {
      clear();
    } else {
      void apply();
    }
  }, [applied, clear, apply]);

  return {
    canVisualize,
    hasTokens,
    aiConfigured,
    applied,
    loading,
    loadingStage: null,
    summary,
    compileMode,
    aiWarning,
    toggle,
    clear,
  };
}
