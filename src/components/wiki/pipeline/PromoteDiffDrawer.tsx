"use client";

/**
 * PromoteDiffDrawer — required review step before promote (spec §3, §5).
 *
 * Side-by-side production vs staging per block, swatches for colors,
 * blast-radius copy, then Confirm → POST /api/wiki/promote.
 */
import { useEffect, useState } from "react";
import type { PromoteDiff } from "@/lib/ir/diff";

function Swatch({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-3.5 w-3.5 rounded border border-black/20"
        style={{ backgroundColor: value }}
      />
      <code className="font-mono text-xs">{value}</code>
    </span>
  );
}

function FieldValue({ value, isColor }: { value?: string; isColor: boolean }) {
  if (value == null || value === "")
    return <span className="text-xs text-[var(--wiki-muted)]">—</span>;
  if (isColor && /^#[0-9a-fA-F]{3,8}$/.test(value.trim()))
    return <Swatch value={value.trim()} />;
  return (
    <span className="whitespace-pre-wrap break-words text-xs">{value}</span>
  );
}

export function PromoteDiffDrawer({
  docFileName,
  blockIds,
  hasConflict,
  onConfirm,
  onClose,
  busy,
}: {
  docFileName: string;
  blockIds: string[];
  hasConflict: boolean;
  onConfirm: () => void;
  onClose: () => void;
  busy: boolean;
}) {
  const [diffs, setDiffs] = useState<PromoteDiff[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/wiki/pipeline/diff?doc=${encodeURIComponent(docFileName)}&blocks=${encodeURIComponent(blockIds.join(","))}`,
          { cache: "no-store" },
        );
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Diff failed");
        if (!cancelled) setDiffs(body.diffs as PromoteDiff[]);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Diff failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [docFileName, blockIds]);

  const changedFieldCount =
    diffs?.reduce(
      (sum, d) => sum + d.fields.filter((f) => f.changed).length,
      0,
    ) ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center">
      <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-[var(--wiki-border)] bg-[var(--wiki-bg)] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[var(--wiki-border)] px-5 py-4">
          <div>
            <h2 className="text-base font-bold">
              Promote {blockIds.length} block{blockIds.length === 1 ? "" : "s"} to
              Production
            </h2>
            <p className="mt-0.5 text-xs text-[var(--wiki-muted)]">
              This updates <strong>Production</strong>: your repo lock, your
              package, agents, and CI all follow it after the next pull.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-[var(--wiki-border)] px-2.5 py-1 text-xs hover:bg-[var(--wiki-active)]"
          >
            Esc
          </button>
        </header>

        <div className="max-h-[55vh] overflow-y-auto px-5 py-4">
          {error && <p className="text-sm text-red-500">{error}</p>}
          {!diffs && !error && (
            <p className="text-sm text-[var(--wiki-muted)]">Computing diff…</p>
          )}
          {diffs?.map((d) => (
            <section key={d.id} className="mb-5 last:mb-0">
              <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                {d.title}
                <code className="font-mono text-xs text-[var(--wiki-muted)]">
                  {d.id}
                </code>
                <span className="rounded-full bg-[var(--wiki-active)] px-2 py-0.5 font-mono text-[11px]">
                  {d.productionVersion != null
                    ? `v${d.productionVersion} → v${d.stagingVersion}`
                    : `new → v${d.stagingVersion}`}
                </span>
                {d.stagingStatus === "conflict" && (
                  <span className="text-[11px] font-bold uppercase text-[#dc2626]">
                    conflict — promoting accepts this source
                  </span>
                )}
              </h3>
              <table className="mt-2 w-full table-fixed border-collapse text-left">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-[var(--wiki-muted)]">
                    <th className="w-28 py-1 pr-2">Field</th>
                    <th className="py-1 pr-2">Production</th>
                    <th className="py-1">Staging (after promote)</th>
                  </tr>
                </thead>
                <tbody>
                  {d.fields
                    .filter((f) => f.changed || f.isColor)
                    .slice(0, 8)
                    .map((f) => (
                      <tr
                        key={f.key}
                        className="border-t border-[var(--wiki-border)] align-top"
                        style={
                          f.changed
                            ? { backgroundColor: "rgba(234,179,8,0.06)" }
                            : undefined
                        }
                      >
                        <td className="py-1.5 pr-2 font-mono text-xs">{f.key}</td>
                        <td className="py-1.5 pr-2">
                          <FieldValue value={f.production} isColor={f.isColor} />
                        </td>
                        <td className="py-1.5">
                          <FieldValue value={f.staging} isColor={f.isColor} />
                          {f.changed && (
                            <span className="ml-1 text-[10px] font-bold text-[#ca8a04]">
                              changed
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>

        <footer className="flex items-center justify-between border-t border-[var(--wiki-border)] px-5 py-4">
          <p className="text-xs text-[var(--wiki-muted)]">
            {changedFieldCount} field{changedFieldCount === 1 ? "" : "s"} change ·
            history is append-only; rollback is one click
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-[var(--wiki-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--wiki-active)]"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={busy || !diffs}
              className="rounded-md bg-[var(--wiki-text)] px-4 py-2 text-sm font-bold text-[var(--wiki-bg)] hover:opacity-90 disabled:opacity-50"
            >
              {busy
                ? "Promoting…"
                : hasConflict
                  ? "Resolve & promote to Production"
                  : "Promote to Production"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
