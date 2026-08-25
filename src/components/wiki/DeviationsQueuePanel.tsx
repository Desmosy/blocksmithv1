"use client";

/**
 * DeviationsQueuePanel — displays pending, approved, and rejected deviations
 * on the wiki Sync page. Admins/owners can Pass or Rollback.
 */

import { useEffect, useState, useCallback } from "react";

type DeviationDiff = {
  field: string;
  wikiValue: string;
  pushedValue: string;
};

type Deviation = {
  id: string;
  blockId: string;
  pushedBy: string;
  deviationDiff: DeviationDiff;
  commitRef?: string;
  reason?: string;
  status: string;
  reviewedBy?: string;
  fixSuggestion?: string;
  createdAt: string;
  expiresAt: string;
  resolvedAt?: string;
  rejectionCount: number;
};

export function DeviationsQueuePanel() {
  const [deviations, setDeviations] = useState<Deviation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fixText, setFixText] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<string | null>(null);

  const fetchDeviations = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/deviations");
      if (!res.ok) {
        setDeviations([]);
        return;
      }
      const data = (await res.json()) as { deviations: Deviation[] };
      setDeviations(data.deviations ?? []);
    } catch {
      setError("Could not load deviations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDeviations();
  }, [fetchDeviations]);

  const handleAction = async (
    id: string,
    action: "pass" | "rollback",
  ) => {
    setActing(id);
    try {
      const body: Record<string, string> = { action };
      if (action === "rollback" && fixText[id]) {
        body.fixSuggestion = fixText[id];
      }
      const res = await fetch(`/api/v1/deviations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await fetchDeviations();
      }
    } catch {
      /* ignore */
    } finally {
      setActing(null);
    }
  };

  const pending = deviations.filter((d) => d.status === "pending");
  const resolved = deviations.filter((d) => d.status !== "pending");

  if (loading) {
    return (
      <div className="mt-8 rounded-xl border border-[var(--wiki-border)] p-5">
        <p className="text-sm text-[var(--wiki-muted)]">Loading deviations…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8 rounded-xl border border-[var(--wiki-border)] p-5">
        <p className="text-sm text-[var(--wiki-muted)]">{error}</p>
      </div>
    );
  }

  if (deviations.length === 0) {
    return null; // Don't show the panel if there are no deviations
  }

  return (
    <div className="mt-8 rounded-xl border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          {pending.length > 0 ? (
            <>
              <span
                className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold"
                style={{ backgroundColor: "rgba(234, 179, 8, 0.15)", color: "#eab308" }}
              >
                {pending.length}
              </span>
              Pending Deviations
            </>
          ) : (
            "Deviations"
          )}
        </h2>
      </div>

      {pending.length > 0 && (
        <div className="mt-4 space-y-3">
          {pending.map((d) => (
            <PendingDeviationCard
              key={d.id}
              deviation={d}
              acting={acting === d.id}
              fixText={fixText[d.id] ?? ""}
              onFixTextChange={(text) =>
                setFixText((prev) => ({ ...prev, [d.id]: text }))
              }
              onPass={() => handleAction(d.id, "pass")}
              onRollback={() => handleAction(d.id, "rollback")}
            />
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-medium text-[var(--wiki-muted)]">
            Resolved ({resolved.length})
          </summary>
          <div className="mt-2 space-y-2">
            {resolved.slice(0, 10).map((d) => (
              <ResolvedDeviationRow key={d.id} deviation={d} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function PendingDeviationCard({
  deviation,
  acting,
  fixText,
  onFixTextChange,
  onPass,
  onRollback,
}: {
  deviation: Deviation;
  acting: boolean;
  fixText: string;
  onFixTextChange: (text: string) => void;
  onPass: () => void;
  onRollback: () => void;
}) {
  const timeLeft = getTimeLeft(deviation.expiresAt);

  return (
    <div className="rounded-lg border border-[var(--wiki-border)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold">
              {deviation.blockId}
            </span>
            <span className="text-xs text-[var(--wiki-muted)]">
              · @{deviation.pushedBy}
            </span>
            <span className="text-xs text-[var(--wiki-muted)]">
              · {formatAgo(deviation.createdAt)}
            </span>
          </div>

          <div
            className="mt-2 rounded-md px-3 py-2 font-mono text-xs"
            style={{ backgroundColor: "var(--wiki-active)" }}
          >
            <span className="text-[var(--wiki-muted)]">
              {deviation.deviationDiff.field}:{" "}
            </span>
            <span style={{ color: "#ef4444" }}>
              {deviation.deviationDiff.wikiValue}
            </span>
            <span className="text-[var(--wiki-muted)]"> → </span>
            <span style={{ color: "#22c55e" }}>
              {deviation.deviationDiff.pushedValue}
            </span>
          </div>

          {deviation.reason && (
            <p className="mt-1.5 text-xs text-[var(--wiki-muted)]">
              Reason: &ldquo;{deviation.reason}&rdquo;
            </p>
          )}

          <p className="mt-1.5 text-xs text-[var(--wiki-muted)]">
            Auto-approves in:{" "}
            <span className="font-medium text-[var(--wiki-text)]">
              {timeLeft}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onPass}
          disabled={acting}
          className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
          style={{
            backgroundColor: "rgba(34, 197, 94, 0.12)",
            color: "#22c55e",
          }}
        >
          {acting ? "…" : "Pass"}
        </button>
        <button
          onClick={onRollback}
          disabled={acting}
          className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
          style={{
            backgroundColor: "rgba(239, 68, 68, 0.12)",
            color: "#ef4444",
          }}
        >
          {acting ? "…" : "Rollback"}
        </button>
        <input
          type="text"
          value={fixText}
          onChange={(e) => onFixTextChange(e.target.value)}
          placeholder="Fix suggestion (optional for rollback)"
          className="ml-2 flex-1 rounded-md border border-[var(--wiki-border)] bg-transparent px-2 py-1.5 text-xs text-[var(--wiki-text)] placeholder:text-[var(--wiki-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--wiki-text)]"
        />
      </div>

      {deviation.commitRef && (
        <p className="mt-2 font-mono text-[10px] text-[var(--wiki-muted)]">
          commit: {deviation.commitRef.slice(0, 8)}
        </p>
      )}
    </div>
  );
}

function ResolvedDeviationRow({ deviation }: { deviation: Deviation }) {
  const icon =
    deviation.status === "approved" || deviation.status === "auto_approved"
      ? "✅"
      : deviation.status === "rejected"
        ? "❌"
        : "🔧";

  const statusLabel =
    deviation.status === "auto_approved"
      ? "auto-approved"
      : deviation.status === "approved"
        ? `approved by @${deviation.reviewedBy ?? "?"}`
        : deviation.status === "rejected"
          ? `rejected by @${deviation.reviewedBy ?? "?"}`
          : "resolved";

  return (
    <div className="flex items-center gap-2 rounded-md px-3 py-2 text-xs">
      <span>{icon}</span>
      <span className="font-mono font-medium">{deviation.blockId}</span>
      <span className="text-[var(--wiki-muted)]">·</span>
      <span className="text-[var(--wiki-muted)]">{statusLabel}</span>
      <span className="text-[var(--wiki-muted)]">
        · {formatAgo(deviation.resolvedAt ?? deviation.createdAt)}
      </span>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) {
    const mins = Math.floor(diff / 60000);
    return `${mins}m ago`;
  }
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getTimeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "expiring…";
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
