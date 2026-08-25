"use client";

/**
 * LockStatusCard — compact lock + package state for the Sync page.
 * Full release console lives at /wiki/releases; this is the at-a-glance card.
 */
import { useEffect, useState } from "react";
import type { ReleaseTable } from "@/lib/ir/releases";

export function LockStatusCard({ docFileName }: { docFileName: string }) {
  const [table, setTable] = useState<ReleaseTable | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/wiki/releases?doc=${encodeURIComponent(docFileName)}`,
          { cache: "no-store" },
        );
        if (!res.ok || cancelled) return;
        setTable((await res.json()) as ReleaseTable);
      } catch {
        /* hide card if registry not materialized */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [docFileName]);

  if (!table) return null;

  const pullCmd = `blocksmith pull --doc ${docFileName}`;
  const fresh = table.lock.present && table.lock.fresh;

  return (
    <section className="mt-8 rounded-xl border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Production lock</h2>
        <a
          href={`/wiki/pipeline?doc=${encodeURIComponent(docFileName)}`}
          className="text-xs font-medium underline-offset-2 hover:underline"
        >
          Open Pipeline →
        </a>
      </div>
      <div className="mt-3 grid gap-2 text-sm">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: fresh ? "#22c55e" : "#f97316" }}
          />
          <span className="font-medium">
            {table.lock.present
              ? fresh
                ? "Lock fresh"
                : "Lock stale"
              : "No lock yet"}
          </span>
        </div>
        <p className="text-xs text-[var(--wiki-muted)]">
          Package <code className="font-mono">{table.packageName}</code> · graph{" "}
          <code className="font-mono">{table.graphHash}</code> ·{" "}
          {table.counts.live} live · {table.counts.draftsWaiting} waiting
        </p>
        <div className="relative mt-1 rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] p-2.5">
          <code className="font-mono text-xs">{pullCmd}</code>
          <button
            onClick={() => {
              void navigator.clipboard.writeText(pullCmd);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="absolute right-2 top-1.5 rounded-md border border-[var(--wiki-border)] px-2 py-0.5 text-[11px] font-medium hover:bg-[var(--wiki-active)]"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </section>
  );
}
