"use client";

import { useState } from "react";
import type { ComponentDoc } from "@/lib/blocks/types";

type DraftPayload = {
  role: string;
  description: string;
  rationale: string;
  model?: string;
};

type Props = {
  component: ComponentDoc;
  docFileName: string;
  currentRole: string;
  currentDescription: string;
  onApply: (role: string, description: string) => void;
  /** Compact layout for view mode (before edit panel opens). */
  compact?: boolean;
};

export function GovernanceCopilotPanel({
  component,
  docFileName,
  currentRole,
  currentDescription,
  onApply,
  compact = false,
}: Props) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<DraftPayload | null>(null);

  const scanContext = component.scan
    ? {
        sourceFile: component.scan.sourceFile,
        exports: component.scan.exports,
        cssVarsUsed: component.scan.cssVarsUsed,
        colorsUsed: component.scan.colorsUsed,
      }
    : undefined;

  const requestDraft = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError("Describe how this component should be used.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuggestion(null);

    try {
      const res = await fetch("/api/wiki/governance/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docRef: docFileName,
          componentTitle: component.title,
          componentId: component.id,
          currentRole,
          currentDescription,
          prompt: trimmed,
          scanContext,
        }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        draft?: DraftPayload;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      if (!data.draft) {
        throw new Error("No draft returned");
      }

      setSuggestion(data.draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Draft failed");
    } finally {
      setLoading(false);
    }
  };

  const applySuggestion = () => {
    if (!suggestion) return;
    onApply(suggestion.role, suggestion.description);
    setSuggestion(null);
    setPrompt("");
  };

  const hasChange =
    suggestion &&
    (suggestion.role.trim() !== currentRole.trim() ||
      suggestion.description.trim() !== currentDescription.trim());

  return (
    <div
      className={
        compact
          ? "rounded-xl border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] p-4"
          : "rounded-xl border border-violet-500/20 bg-violet-500/5 p-5"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--wiki-text)]">
            Governance copilot
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--wiki-muted)]">
            Describe intent — drafts usage rules and do&apos;s/don&apos;ts.
          </p>
        </div>
      </div>

      <label htmlFor="governanceCopilotPrompt" className="sr-only">
        Governance prompt for {component.title}
      </label>
      <textarea
        id="governanceCopilotPrompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={compact ? 3 : 4}
        disabled={loading}
        placeholder="e.g. Primary CTA only — max one per view. Never for destructive actions."
        className="mt-4 w-full rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] p-3 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-[var(--wiki-accent)] disabled:opacity-60"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void requestDraft()}
          disabled={loading || !prompt.trim()}
          className="rounded-lg bg-[var(--wiki-accent)] px-4 py-2 text-xs font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Drafting…" : "Draft rules"}
        </button>
        {suggestion ? (
          <button
            type="button"
            onClick={() => setSuggestion(null)}
            className="text-xs font-medium text-[var(--wiki-muted)] hover:text-[var(--wiki-text)]"
          >
            Clear suggestion
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="mt-3 text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {suggestion ? (
        <div className="mt-4 space-y-3 rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] p-4">
          {suggestion.rationale ? (
            <p className="text-xs leading-relaxed text-[var(--wiki-muted)]">
              <span className="font-semibold text-[var(--wiki-text)]">Why: </span>
              {suggestion.rationale}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--wiki-muted)]">
                Suggested role
              </p>
              <p className="mt-1 text-sm text-[var(--wiki-text)]">
                {suggestion.role || "(empty)"}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--wiki-muted)]">
                Suggested rules
              </p>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-[var(--wiki-text)]">
                {suggestion.description || "(empty)"}
              </pre>
            </div>
          </div>

          {hasChange ? (
            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                onClick={applySuggestion}
                className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-xs font-semibold text-[var(--wiki-text)] transition hover:bg-violet-500/20"
              >
                Apply to draft
              </button>
            </div>
          ) : (
            <p className="text-xs text-[var(--wiki-muted)]">
              Suggestion matches current governance — edit the prompt or apply to confirm.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
