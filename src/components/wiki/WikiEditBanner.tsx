"use client";

/**
 * WikiEditBanner — "you have staged changes" notice across the wiki.
 *
 * Fires whenever any block for this doc is sitting in staging (a human saved an
 * edit but no one has promoted yet). It is the connective tissue that makes the
 * wiki feel like one product: edit on any page → this banner → Pipeline promote.
 *
 * Honesty rule (Step 1): preview docs have no real Pipeline, so the copy and CTA
 * change — a preview save is "saved to your preview document", not "promote to
 * production".
 */
import { useCallback, useEffect, useState } from "react";
import type { DocLifecycle } from "@/lib/wiki/doc-lifecycle";
import { hrefWithDoc } from "@/lib/wiki/doc-param";

interface Counts {
  draftsWaiting: number;
  conflicts: number;
}

export function WikiEditBanner({
  docFileName,
  lifecycle,
}: {
  docFileName: string;
  lifecycle: DocLifecycle;
}) {
  const [counts, setCounts] = useState<Counts>({ draftsWaiting: 0, conflicts: 0 });

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/wiki/releases?doc=${encodeURIComponent(docFileName)}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { counts?: Counts };
      if (data.counts) {
        setCounts({
          draftsWaiting: data.counts.draftsWaiting ?? 0,
          conflicts: data.counts.conflicts ?? 0,
        });
      }
    } catch {
      /* registry not materialized — banner simply hides */
    }
  }, [docFileName]);

  useEffect(() => {
    void load();
    // A finalize on any page fires this — refresh the count without a reload.
    const onStaged = () => void load();
    window.addEventListener("blocksmith:staged", onStaged);
    return () => window.removeEventListener("blocksmith:staged", onStaged);
  }, [load]);

  const staged = counts.draftsWaiting + counts.conflicts;
  if (staged <= 0) return null;

  const isPreview = lifecycle === "preview";
  const blocksLabel = staged === 1 ? "1 staged change" : `${staged} staged changes`;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] px-4 py-3 text-sm">
      <span className="inline-flex items-center gap-2 font-semibold text-[var(--wiki-text)]">
        <span className="inline-block h-2 w-2 rounded-full bg-[#ca8a04]" />
        {blocksLabel}
      </span>
      <span className="text-[var(--wiki-muted)]">
        {isPreview
          ? "Saved to your preview document. Connect a repo to promote to production."
          : "Open Pipeline to promote them to production."}
      </span>
      {counts.conflicts > 0 ? (
        <span className="font-semibold text-[#dc2626]">
          {counts.conflicts === 1
            ? "1 conflict needs resolving"
            : `${counts.conflicts} conflicts need resolving`}
        </span>
      ) : null}
      {!isPreview ? (
        <a
          href={hrefWithDoc("/wiki/pipeline", docFileName)}
          className="ml-auto rounded-md bg-[var(--wiki-text)] px-3 py-1.5 text-xs font-semibold text-[var(--wiki-bg)] hover:opacity-90"
        >
          Open Pipeline →
        </a>
      ) : null}
    </div>
  );
}
