"use client";

import { useCallback, useEffect, useState } from "react";
import type { OpinionReaction, ShareStats } from "@/lib/public-share/types";

const REACTIONS: {
  id: OpinionReaction;
  label: string;
  hint: string;
}[] = [
  { id: "approve", label: "Works for me", hint: "I’d expect this in the product" },
  { id: "unsure", label: "Not sure", hint: "Needs context or feels off" },
  { id: "reject", label: "Doesn’t work", hint: "Color, copy, or feel misses" },
];

function storageKey(shareId: string): string {
  return `blocksmith-opinion-${shareId}`;
}

function viewKey(shareId: string): string {
  return `blocksmith-view-${shareId}`;
}

export function OpinionPanel({
  shareId,
  initialStats,
}: {
  shareId: string;
  initialStats: ShareStats;
}) {
  const [stats, setStats] = useState(initialStats);
  const [voted, setVoted] = useState<OpinionReaction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const prior = localStorage.getItem(storageKey(shareId));
    if (prior === "approve" || prior === "unsure" || prior === "reject") {
      setVoted(prior);
    }
  }, [shareId]);

  useEffect(() => {
    if (sessionStorage.getItem(viewKey(shareId))) return;
    sessionStorage.setItem(viewKey(shareId), "1");
    fetch(`/api/share/${shareId}/view`, { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.stats) setStats(data.stats);
      })
      .catch(() => {});
  }, [shareId]);

  const submit = useCallback(
    async (reaction: OpinionReaction) => {
      if (voted || submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch(`/api/share/${shareId}/opinion`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reaction }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not save");
        localStorage.setItem(storageKey(shareId), reaction);
        setVoted(reaction);
        if (data.stats) setStats(data.stats);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setSubmitting(false);
      }
    },
    [shareId, voted, submitting],
  );

  const total =
    stats.opinions.approve + stats.opinions.unsure + stats.opinions.reject;

  return (
    <section className="mt-10 rounded-2xl border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--wiki-muted)]">
          Your opinion
        </h2>
        <p className="text-xs text-[var(--wiki-muted)]">
          {stats.views} view{stats.views === 1 ? "" : "s"}
          {total > 0 ? ` · ${total} response${total === 1 ? "" : "s"}` : ""}
        </p>
      </div>
      <p className="mt-2 text-sm text-[var(--wiki-text)]">
        Pick the reaction that matches your gut — no account needed.
      </p>

      {voted ? (
        <p className="mt-4 text-sm font-medium text-[var(--wiki-text)]">
          Thanks — you chose &ldquo;
          {REACTIONS.find((r) => r.id === voted)?.label}&rdquo;.
        </p>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {REACTIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              disabled={submitting}
              onClick={() => submit(r.id)}
              className="rounded-xl border border-[var(--wiki-border)] bg-[var(--wiki-bg)] px-4 py-4 text-left transition hover:border-[var(--wiki-text)] hover:ring-1 hover:ring-[var(--wiki-text)] disabled:opacity-50"
            >
              <span className="block text-sm font-semibold">{r.label}</span>
              <span className="mt-1 block text-xs text-[var(--wiki-muted)]">
                {r.hint}
              </span>
            </button>
          ))}
        </div>
      )}

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      {total > 0 ? (
        <div className="mt-6 space-y-2 border-t border-[var(--wiki-border)] pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--wiki-muted)]">
            Community pulse
          </p>
          <OpinionBar
            label="Works for me"
            count={stats.opinions.approve}
            total={total}
            accent="#66bb6a"
          />
          <OpinionBar
            label="Not sure"
            count={stats.opinions.unsure}
            total={total}
            accent="#ffa726"
          />
          <OpinionBar
            label="Doesn’t work"
            count={stats.opinions.reject}
            total={total}
            accent="#ef5350"
          />
        </div>
      ) : null}
    </section>
  );
}

function OpinionBar({
  label,
  count,
  total,
  accent,
}: {
  label: string;
  count: number;
  total: number;
  accent: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span className="text-[var(--wiki-muted)]">
          {count} ({pct}%)
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--wiki-border)]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: accent }}
        />
      </div>
    </div>
  );
}
