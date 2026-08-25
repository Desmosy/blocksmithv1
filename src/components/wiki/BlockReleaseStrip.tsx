"use client";

/**
 * BlockReleaseStrip — production state of one block, on its own page.
 *
 * "Live v3 · draft v4 waiting" + one-click Promote. The block page IS the
 * release surface (north star: component/token pages are the block pages).
 */
import { useCallback, useEffect, useState } from "react";
import type { ReleaseRow } from "@/lib/ir/releases";
import { friendlyError } from "@/lib/wiki/friendly-error";

export function BlockReleaseStrip({
  docFileName,
  blockId,
}: {
  docFileName: string;
  blockId: string;
}) {
  const [row, setRow] = useState<ReleaseRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/wiki/releases?doc=${encodeURIComponent(docFileName)}&block=${encodeURIComponent(blockId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { block: ReleaseRow | null };
      setRow(data.block);
    } catch {
      /* registry not materialized — strip simply hides */
    }
  }, [docFileName, blockId]);

  useEffect(() => {
    void load();
    // Refresh instantly when this page saves a draft to staging.
    const onStaged = (e: Event) => {
      const detail = (e as CustomEvent).detail as { blockId?: string };
      if (!detail?.blockId || detail.blockId === blockId) void load();
    };
    window.addEventListener("blocksmith:staged", onStaged);
    return () => window.removeEventListener("blocksmith:staged", onStaged);
  }, [load, blockId]);

  if (!row) return null;

  async function promote() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/wiki/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc: docFileName,
          blockIds: [blockId],
          resolveConflicts: row?.conflict ?? false,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(friendlyError(res.status, data.error));
      setMessage(`Promoted to Production → lock ${data.lockHash}`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Promote failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] px-4 py-2.5 text-sm">
      {row.official != null ? (
        <span className="inline-flex items-center gap-1.5 font-semibold text-[#16a34a]">
          <span className="inline-block h-2 w-2 rounded-full bg-[#22c55e]" />
          Production v{row.official}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--wiki-muted)]">
          <span className="inline-block h-2 w-2 rounded-full bg-[#a1a1aa]" />
          Not in production
        </span>
      )}

      {row.conflict && (
        <span className="font-semibold text-[#dc2626]">
          Conflict v{row.latest} — sources disagree
        </span>
      )}
      {row.stale && (
        <span className="font-semibold text-[#ea580c]">
          Stale — source vanished; lock still pins v{row.official ?? "—"}
        </span>
      )}
      {row.draftPending && !row.conflict && (
        <span className="font-semibold text-[#ca8a04]">
          Staging v{row.latest} waiting
          <span className="ml-1 font-normal text-[var(--wiki-muted)]">
            (agents still on {row.official != null ? `v${row.official}` : "nothing"})
          </span>
        </span>
      )}

      {row.canPromote && (
        <button
          onClick={promote}
          disabled={busy}
          className="rounded-md bg-[var(--wiki-text)] px-3 py-1 text-xs font-semibold text-[var(--wiki-bg)] hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Promoting…" : row.conflict ? "Resolve & promote" : `Promote v${row.latest}`}
        </button>
      )}

      <a
        href={`/wiki/pipeline?doc=${encodeURIComponent(docFileName)}`}
        className="ml-auto text-xs font-medium text-[var(--wiki-muted)] underline-offset-2 hover:underline"
      >
        Open Pipeline →
      </a>

      {message && (
        <span className="basis-full text-xs text-[var(--wiki-muted)]">{message}</span>
      )}
    </div>
  );
}
