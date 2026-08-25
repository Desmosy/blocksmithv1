"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicShareRecord, ShareBlockKind } from "@/lib/public-share/types";
import { CopyButton } from "@/components/wiki/visual/CopyButton";

interface ShareBlockPanelProps {
  docFileName: string;
  blockKind: ShareBlockKind;
  blockId: string;
  blockTitle: string;
}

export function ShareBlockPanel({
  docFileName,
  blockKind,
  blockId,
  blockTitle,
}: ShareBlockPanelProps) {
  const [share, setShare] = useState<PublicShareRecord | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        doc: docFileName,
        blockKind,
        blockId,
      });
      const res = await fetch(`/api/share?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setShare(data.share ?? null);
      setUrl(data.url ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load share");
    } finally {
      setLoading(false);
    }
  }, [docFileName, blockKind, blockId]);

  useEffect(() => {
    load();
  }, [load]);

  const createLink = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docFileName, blockKind, blockId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create");
      setShare(data.share);
      setUrl(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create link");
    } finally {
      setCreating(false);
    }
  };

  const total = share
    ? share.stats.opinions.approve +
      share.stats.opinions.unsure +
      share.stats.opinions.reject
    : 0;

  return (
    <section className="mt-8 rounded-2xl border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--wiki-muted)]">
            Public feedback
          </h2>
          <p className="mt-1 text-sm text-[var(--wiki-text)]">
            Share &ldquo;{blockTitle}&rdquo; for real opinions before launch.
          </p>
        </div>
        {!share && !loading ? (
          <button
            type="button"
            onClick={createLink}
            disabled={creating}
            className="rounded-lg bg-[var(--wiki-text)] px-4 py-2 text-sm font-medium text-[var(--wiki-bg)] transition hover:opacity-90 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Get public link"}
          </button>
        ) : null}
      </div>

      {loading ? (
        <p className="mt-3 text-xs text-[var(--wiki-muted)]">Loading share…</p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      {share && url ? (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex-1 truncate rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] px-3 py-2 text-xs">
              {url}
            </code>
            <CopyButton value={url} label="Copy link" />
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-[var(--wiki-border)] px-3 py-2 text-xs font-medium transition hover:bg-[var(--wiki-bg)]"
            >
              Open public page ↗
            </a>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Stat label="Views" value={share.stats.views} />
            <Stat label="Works" value={share.stats.opinions.approve} />
            <Stat label="Unsure" value={share.stats.opinions.unsure} />
            <Stat label="Doesn’t work" value={share.stats.opinions.reject} />
          </dl>

          {total === 0 ? (
            <p className="text-xs text-[var(--wiki-muted)]">
              No opinions yet — send the link to teammates or a small test audience.
            </p>
          ) : null}

          <button
            type="button"
            onClick={load}
            className="text-xs text-[var(--wiki-muted)] underline hover:text-[var(--wiki-text)]"
          >
            Refresh stats
          </button>
        </div>
      ) : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] px-3 py-2">
      <dt className="text-[10px] uppercase tracking-wide text-[var(--wiki-muted)]">
        {label}
      </dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
