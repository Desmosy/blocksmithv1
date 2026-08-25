"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ScanStatus = {
  stale: boolean;
  workspaceRoot: string | null;
  githubRepo: string | null;
  hostedRefreshOnly: boolean;
  refreshHint: "server-rescan" | "cli-rescan" | "github-rescan" | null;
  publishedFactsHash: string | null;
  liveFactsHash: string | null;
  scannedAt: string | null;
};

export function ScanStaleBanner({ docFileName }: { docFileName: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<ScanStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedCount, setUpdatedCount] = useState<number | null>(null);

  // After a re-scan, count what landed in Staging so we can point the operator
  // at the Pipeline instead of leaving them on a silently-updated wiki.
  const countStaged = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/wiki/pipeline?doc=${encodeURIComponent(docFileName)}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        lanes?: { staging?: unknown[] };
      };
      const n = data.lanes?.staging?.length ?? 0;
      if (n > 0) setUpdatedCount(n);
    } catch {
      /* pipeline not materialized — skip the banner */
    }
  }, [docFileName]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/sync/scan-status?doc=${encodeURIComponent(docFileName)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "status failed");
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "status failed");
    }
  }, [docFileName]);

  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);

  const rescan = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/sync/rescan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc: docFileName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "rescan failed");
      await load();
      await countStaged();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "rescan failed");
    } finally {
      setRefreshing(false);
    }
  };

  if (!status) return null;

  const pipelineHref = `/wiki/pipeline?doc=${encodeURIComponent(docFileName)}`;
  const updatedBanner =
    updatedCount && updatedCount > 0 ? (
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm">
        <span className="font-semibold text-[var(--wiki-text)]">
          {updatedCount} block{updatedCount === 1 ? "" : "s"} updated by the
          re-scan — review them before agents see anything.
        </span>
        <a
          href={pipelineHref}
          className="ml-auto rounded-lg bg-[var(--wiki-text)] px-3 py-1.5 text-xs font-bold text-[var(--wiki-bg)] hover:opacity-90"
        >
          Review Pipeline →
        </a>
      </div>
    ) : null;

  const githubRescan = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/sync/github-rescan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc: docFileName }),
      });
      const text = await res.text();
      const data = text ? (JSON.parse(text) as { error?: string }) : {};
      if (!res.ok) throw new Error(data.error || "GitHub rescan failed");
      await load();
      await countStaged();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "GitHub rescan failed");
    } finally {
      setRefreshing(false);
    }
  };

  if (status.hostedRefreshOnly) {
    return (
      <>
        {updatedBanner}
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] px-4 py-3">
          {status.githubRepo ? (
            <button
              type="button"
              onClick={githubRescan}
              disabled={refreshing}
              className="rounded-lg bg-[var(--wiki-accent)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {refreshing ? "Scanning…" : "Re-scan from GitHub"}
            </button>
          ) : null}
          {error ? (
            <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
          ) : null}
        </div>
      </>
    );
  }

  if (!status.stale) return updatedBanner;

  return (
    <>
    {updatedBanner}
    <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
      <p className="font-semibold">Wiki behind workspace</p>
      <p className="mt-1 text-xs opacity-90">
        Code changed in{" "}
        <code className="font-mono">{status.workspaceRoot ?? "workspace"}</code>{" "}
        since last scan
        {status.scannedAt
          ? ` (${new Date(status.scannedAt).toLocaleString()})`
          : ""}
        . Refresh to sync IDE → wiki.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={rescan}
          disabled={refreshing}
          className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {refreshing ? "Scanning…" : "Refresh scan"}
        </button>
        {error ? (
          <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
        ) : null}
      </div>
    </div>
    </>
  );
}
