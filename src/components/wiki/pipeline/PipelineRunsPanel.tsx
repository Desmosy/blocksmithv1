"use client";

/**
 * PipelineRunsPanel — append-only audit of every promote, rollback,
 * pin-lock, and ingest (spec §4). Rollback of a promote run rolls each
 * block back; the rollback itself becomes a new run.
 */
import { useState } from "react";
import type { PipelineRun } from "@/lib/ir/pipeline-runs";

const ACTION_META: Record<string, { label: string }> = {
  promote: { label: "PROMOTE" },
  rollback: { label: "ROLLBACK" },
  "pin-lock": { label: "LOCK" },
  ingest: { label: "INGEST" },
  "demo-seed": { label: "DEMO" },
};

export function PipelineRunsPanel({
  runs,
  docFileName,
  onChanged,
}: {
  runs: PipelineRun[];
  docFileName: string;
  onChanged: () => void;
}) {
  const [busyRun, setBusyRun] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function rollbackRun(run: PipelineRun) {
    setBusyRun(run.id);
    setError(null);
    try {
      for (const b of run.blocks) {
        const res = await fetch("/api/wiki/rollback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ doc: docFileName, blockId: b.id }),
        });
        if (!res.ok) {
          const body = await res.json();
          throw new Error(`${b.id}: ${body.error ?? "rollback failed"}`);
        }
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rollback failed");
    } finally {
      setBusyRun(null);
    }
  }

  return (
    <section className="rounded-xl border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)]">
      <header className="border-b border-[var(--wiki-border)] px-4 py-3">
        <h2 className="text-sm font-bold uppercase tracking-wider">Pipeline runs</h2>
        <p className="mt-0.5 text-[11px] text-[var(--wiki-muted)]">
          Append-only audit — who promoted what, lock before → after
        </p>
      </header>
      <div className="max-h-[480px] overflow-y-auto p-3">
        {runs.length === 0 && (
          <p className="py-6 text-center text-xs text-[var(--wiki-muted)]">
            No runs yet — promote a block or pin the lock.
          </p>
        )}
        <ol className="space-y-2.5">
          {runs.map((run) => {
            const meta = ACTION_META[run.action] ?? ACTION_META.ingest;
            return (
              <li
                key={run.id}
                className="rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] p-3 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-medium tracking-wide text-[var(--wiki-muted)]">
                    {meta.label}
                  </span>
                  <span className="font-medium">{run.summary}</span>
                </div>
                <p className="mt-1 text-[var(--wiki-muted)]">
                  {run.actor} · {new Date(run.createdAt).toLocaleString()}
                </p>
                {run.blocks.length > 0 && (
                  <p className="mt-1 truncate font-mono text-[11px] text-[var(--wiki-muted)]">
                    {run.blocks
                      .slice(0, 3)
                      .map((b) => `${b.id}${b.version ? ` v${b.version}` : ""}`)
                      .join(", ")}
                    {run.blocks.length > 3 ? ` +${run.blocks.length - 3} more` : ""}
                  </p>
                )}
                {run.lockBefore && run.lockAfter && run.lockBefore !== run.lockAfter && (
                  <p className="mt-1 truncate font-mono text-[10px] text-[var(--wiki-muted)]">
                    lock {run.lockBefore.slice(7, 15)}… → {run.lockAfter.slice(7, 15)}…
                  </p>
                )}
                {run.action === "promote" && (
                  <button
                    onClick={() => rollbackRun(run)}
                    disabled={busyRun !== null}
                    className="mt-2 rounded-md border border-[var(--wiki-border)] px-2 py-1 text-[11px] font-medium hover:bg-[var(--wiki-active)] disabled:opacity-50"
                  >
                    {busyRun === run.id ? "Rolling back…" : "Rollback run"}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      </div>
    </section>
  );
}
