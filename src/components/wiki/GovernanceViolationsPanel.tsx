"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { GovernanceEvent, GovernanceEventStatus } from "@/lib/governance/types";
import { hrefWithDoc } from "@/lib/wiki/doc-param";

function formatWhen(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

const STATUS_STYLE: Record<GovernanceEventStatus, string> = {
  open: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  acknowledged: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  resolved: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
};

const TIER_STYLE = {
  block: "text-red-600 dark:text-red-400",
  warn: "text-amber-700 dark:text-amber-300",
};

function EventRow({
  event,
  docFileName,
  onStatus,
}: {
  event: GovernanceEvent;
  docFileName: string;
  onStatus: (id: string, status: GovernanceEventStatus) => void;
}) {
  return (
    <li className="rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={`rounded px-1.5 py-0.5 font-semibold uppercase tracking-wide ${STATUS_STYLE[event.status]}`}
        >
          {event.status}
        </span>
        <span className="font-medium text-[var(--wiki-text)]">{event.author}</span>
        <span className="text-[var(--wiki-muted)]">·</span>
        <span className="text-[var(--wiki-muted)]">{event.source}</span>
        <span className="text-[var(--wiki-muted)]">·</span>
        <time dateTime={event.ts} className="text-[var(--wiki-muted)]">
          {formatWhen(event.ts)}
        </time>
        {event.commit ? (
          <>
            <span className="text-[var(--wiki-muted)]">·</span>
            <code className="font-mono text-[10px]">{event.commit.slice(0, 7)}</code>
          </>
        ) : null}
      </div>

      {event.componentTitle ? (
        <p className="mt-2 text-sm font-semibold text-[var(--wiki-text)]">
          {event.componentTitle}
          {event.action === "overridden" ? (
            <span className="ml-2 text-xs font-normal text-amber-700 dark:text-amber-300">
              pushed despite warnings
            </span>
          ) : null}
        </p>
      ) : null}

      {event.overrideReason ? (
        <p className="mt-2 text-xs text-[var(--wiki-muted)]">
          <strong className="text-[var(--wiki-text)]">Override reason:</strong>{" "}
          {event.overrideReason}
        </p>
      ) : null}

      <ul className="mt-3 space-y-2">
        {event.findings.map((f, i) => (
          <li key={`${f.ruleId}-${i}`} className="text-xs">
            <span className={`font-semibold uppercase ${TIER_STYLE[f.tier]}`}>
              {f.tier}
            </span>
            <span className="text-[var(--wiki-muted)]"> · {f.ruleId}</span>
            <p className="mt-0.5 text-[var(--wiki-text)]">{f.message}</p>
            {f.snippet ? (
              <code className="mt-1 block rounded bg-[var(--wiki-active)] px-2 py-1 font-mono text-[10px]">
                {f.snippet}
              </code>
            ) : null}
          </li>
        ))}
      </ul>

      {event.status === "open" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onStatus(event.id, "acknowledged")}
            className="rounded-md border border-[var(--wiki-border)] px-2 py-1 text-[10px] font-medium hover:bg-[var(--wiki-active)]"
          >
            Acknowledge
          </button>
          <button
            type="button"
            onClick={() => onStatus(event.id, "resolved")}
            className="rounded-md bg-[var(--wiki-cta-fill,var(--wiki-accent))] px-2 py-1 text-[10px] font-semibold text-[color:var(--wiki-cta-on-accent,#fff)] hover:opacity-90"
          >
            Mark resolved
          </button>
          {event.componentId ? (
            <Link
              href={hrefWithDoc(`/wiki/components/${event.componentId}`, docFileName)}
              className="rounded-md border border-[var(--wiki-border)] px-2 py-1 text-[10px] font-medium hover:bg-[var(--wiki-active)]"
            >
              Open component
            </Link>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/** Design-lead feed — warn-tier overrides and block-tier bypasses from dev pushes. */
export function GovernanceViolationsPanel({ docFileName }: { docFileName: string }) {
  const [events, setEvents] = useState<GovernanceEvent[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"open" | "all">("open");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ doc: docFileName, limit: "30" });
      if (filter === "open") q.set("status", "open");
      const res = await fetch(`/api/wiki/governance/violations?${q}`);
      const data = await res.json();
      if (res.ok) {
        setEvents(data.events ?? []);
        setOpenCount(data.openCount ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [docFileName, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (id: string, status: GovernanceEventStatus) => {
    await fetch(`/api/wiki/governance/violations?doc=${encodeURIComponent(docFileName)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    await load();
  };

  return (
    <section className="mt-8 rounded-xl border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--wiki-text)]">Violations</h2>
          <p className="mt-1 max-w-xl text-xs text-[var(--wiki-muted)]">
            Governance warnings pushed by developers appear here. Acknowledge or
            resolve — the audit trail stays.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => setFilter("open")}
            className={`rounded-md px-2 py-1 font-medium ${filter === "open" ? "bg-[var(--wiki-cta-fill,var(--wiki-accent))] text-[color:var(--wiki-cta-on-accent,#fff)]" : "border border-[var(--wiki-border)]"}`}
          >
            Open{openCount ? ` (${openCount})` : ""}
          </button>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-md px-2 py-1 font-medium ${filter === "all" ? "bg-[var(--wiki-cta-fill,var(--wiki-accent))] text-[color:var(--wiki-cta-on-accent,#fff)]" : "border border-[var(--wiki-border)]"}`}
          >
            All
          </button>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-[var(--wiki-muted)]">Loading violations…</p>
      ) : events.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--wiki-muted)]">
          No violations recorded{filter === "open" ? " (open)" : ""}. Devs can run{" "}
          <code className="font-mono text-[10px]">check_governance_diff</code> in
          Cursor before push; overrides with{" "}
          <code className="font-mono text-[10px]">record=true</code> land here.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {events.map((e) => (
            <EventRow
              key={e.id}
              event={e}
              docFileName={docFileName}
              onStatus={setStatus}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
