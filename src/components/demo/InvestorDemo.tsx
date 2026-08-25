"use client";

/**
 * Investor demo — the 90-second walkthrough (PROJECT-PIPELINE.md).
 *
 * Seeds a synthetic product pipeline (3 drafts staged, 1 conflict, stale
 * lock), then renders the real Pipeline console against it. Everything the
 * viewer clicks is the production code path — promote, diff, lock, runs.
 */
import { useEffect, useState, type CSSProperties } from "react";
import { PipelinePage } from "@/components/wiki/pages/PipelinePage";
import { GovernedAiShowcase } from "./GovernedAiShowcase";

/** Wiki CSS variables for standalone (non-WikiShell) rendering. */
const WIKI_VARS: Record<string, string> = {
  "--wiki-bg": "#ffffff",
  "--wiki-text": "#18181b",
  "--wiki-muted": "#71717a",
  "--wiki-border": "#e4e4e7",
  "--wiki-sidebar": "#fafafa",
  "--wiki-active": "#f4f4f5",
};

export function InvestorDemo() {
  const [docRef, setDocRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/wiki/pipeline/demo", { method: "POST" });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Seed failed");
        if (!cancelled) setDocRef(body.docRef as string);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Seed failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main
      className="min-h-screen px-6 py-8 md:px-12"
      style={{
        ...(WIKI_VARS as CSSProperties),
        backgroundColor: "var(--wiki-bg)",
        color: "var(--wiki-text)",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <header className="mx-auto mb-6 max-w-6xl">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--wiki-muted)]">
          BlockSmith · live demo — every click is the real pipeline
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          A team just edited their design system. Agents haven&apos;t seen a
          thing.
        </h1>
        <ol className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[var(--wiki-muted)]">
          <li>1 · Staging is full, the lock is stale</li>
          <li>2 · Select cards → review the diff → Promote</li>
          <li>3 · Lock turns green; every agent re-pins on next pull</li>
          <li>
            4 ·{" "}
            <a
              href="/demo/device?doc=demo:investor.md"
              className="underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              Same promote reaches device frames →
            </a>
          </li>
        </ol>
      </header>

      <div className="mx-auto max-w-6xl">
        <GovernedAiShowcase />
      </div>

      <div className="mx-auto max-w-6xl">
        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-500">
            {error}
          </p>
        )}
        {!docRef && !error && (
          <p className="text-sm text-[var(--wiki-muted)]">
            Seeding the demo pipeline…
          </p>
        )}
        {docRef && <PipelinePage docFileName={docRef} />}
      </div>

      <footer className="mx-auto mt-10 max-w-6xl border-t border-[var(--wiki-border)] pt-4 text-xs text-[var(--wiki-muted)]">
        Reload to re-seed. Spec:{" "}
        <a
          href="/schema/blocksmith.blocks.v1.json"
          className="underline underline-offset-2"
        >
          blocksmith.blocks.v1
        </a>{" "}
        ·{" "}
        <a
          href="/schema/blocksmith.lock.v1.json"
          className="underline underline-offset-2"
        >
          blocksmith.lock.v1
        </a>
      </footer>
    </main>
  );
}
