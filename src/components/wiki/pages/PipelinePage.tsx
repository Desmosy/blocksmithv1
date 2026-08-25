"use client";

/**
 * Pipeline — the visual promote console (PROJECT-PIPELINE.md).
 *
 * Jenkins-class stage grid for run history, staging/production queues below,
 * promote with diff drawer, lock strip, handshake.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PipelinePayload } from "@/lib/ir/pipeline";
import { friendlyError } from "@/lib/wiki/friendly-error";
import { LockStrip } from "../pipeline/LockStrip";
import { StageLane } from "../pipeline/StageLane";
import { BlockCard } from "../pipeline/BlockCard";
import { PromoteDiffDrawer } from "../pipeline/PromoteDiffDrawer";
import { PipelineStageView } from "../pipeline/PipelineStageView";
import { HandshakePanel } from "./ReleasesPage";

export function PipelinePage({ docFileName }: { docFileName: string }) {
  const [data, setData] = useState<PipelinePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerIds, setDrawerIds] = useState<string[] | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [justPromoted, setJustPromoted] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/wiki/pipeline?doc=${encodeURIComponent(docFileName)}`,
        { cache: "no-store" },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(friendlyError(res.status, body.error));
      setData(body as PipelinePayload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pipeline");
    }
  }, [docFileName]);

  useEffect(() => {
    void load();
  }, [load]);

  const staging = useMemo(() => data?.lanes.staging ?? [], [data]);
  const production = useMemo(() => data?.lanes.production ?? [], [data]);
  const lockedIds = useMemo(
    () => new Set(data?.lanes.lockedIds ?? []),
    [data],
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openDrawer = (ids: string[]) => {
    if (ids.length === 0) return;
    setSuccess(null);
    setDrawerIds(ids);
  };

  const drawerHasConflict = useMemo(
    () =>
      (drawerIds ?? []).some(
        (id) => staging.find((r) => r.id === id)?.conflict,
      ),
    [drawerIds, staging],
  );

  async function confirmPromote() {
    if (!drawerIds) return;
    setPromoting(true);
    try {
      const res = await fetch("/api/wiki/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc: docFileName,
          blockIds: drawerIds,
          resolveConflicts: drawerHasConflict,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(friendlyError(res.status, body.error));
      const ids = (body.promoted as { id: string }[]).map((p) => p.id);
      setJustPromoted(new Set(ids));
      setTimeout(() => setJustPromoted(new Set()), 2500);
      setSuccess(`${ids.length} block${ids.length === 1 ? "" : "s"} promoted → lock ${body.lockHash}.`);
      setSelected(new Set());
      setDrawerIds(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Promote failed");
      setDrawerIds(null);
    } finally {
      setPromoting(false);
    }
  }

  if (error && !data) {
    return (
      <article>
        <h1 className="pipeline-page-title">Pipeline</h1>
        <p className="mt-4 text-sm text-red-500">{error}</p>
      </article>
    );
  }
  if (!data) {
    return (
      <article className="pipeline-page">
        <h1 className="pipeline-page-title">Pipeline</h1>
        <p className="pipeline-page-subtitle">Loading pipeline…</p>
        <div className="pipeline-stage-view pipeline-stage-view--loading" aria-hidden>
          <div className="pipeline-skeleton-bar" />
          <div className="pipeline-skeleton-grid" />
        </div>
      </article>
    );
  }

  const selectedIds = [...selected].filter((id) =>
    staging.some((r) => r.id === id),
  );

  return (
    <article className="pipeline-page">
      <header className="pipeline-page-header">
        <div>
          <h1 className="pipeline-page-title">Pipeline</h1>
          <p className="pipeline-page-subtitle">
            <Link href="/wiki/releases" className="pipeline-page-link">
              Table view →
            </Link>
          </p>
        </div>
        {staging.length > 0 && (
          <button
            type="button"
            onClick={() =>
              openDrawer(
                selectedIds.length ? selectedIds : staging.map((r) => r.id),
              )
            }
            className="pipeline-promote-btn"
          >
            {selectedIds.length
              ? `Promote ${selectedIds.length} selected`
              : `Promote all waiting (${staging.length})`}
          </button>
        )}
      </header>

      <LockStrip data={data} docFileName={docFileName} onPinned={load} />

      {success && (
        <p className="pipeline-notice pipeline-notice--success">{success}</p>
      )}
      {error && data && (
        <p className="pipeline-notice pipeline-notice--error">{error}</p>
      )}

      <PipelineStageView data={data} docFileName={docFileName} onChanged={load} />

      <div className="pipeline-lanes">
        <StageLane
          title="Staging"
          subtitle="Saved edits waiting for review"
          count={staging.length}
          empty={
            production.length > 0 ? (
              <span>Nothing staged yet.</span>
            ) : (
              <span>Scan a repo to get started.</span>
            )
          }
        >
          {staging.map((row) => (
            <BlockCard
              key={row.id}
              row={row}
              lane="staging"
              selected={selected.has(row.id)}
              onToggle={() => toggle(row.id)}
            />
          ))}
        </StageLane>

        <StageLane
          title="Production"
          subtitle="Approved versions in the lock graph"
          count={production.length}
          empty={<span>Nothing promoted yet.</span>}
        >
          {production.map((row) => (
            <BlockCard
              key={row.id}
              row={row}
              lane="production"
              locked={lockedIds.has(row.id)}
              justPromoted={justPromoted.has(row.id)}
            />
          ))}
        </StageLane>
      </div>

      <HandshakePanel
        table={{ packageName: data.packageName }}
        docFileName={docFileName}
      />

      {drawerIds && (
        <PromoteDiffDrawer
          docFileName={docFileName}
          blockIds={drawerIds}
          hasConflict={drawerHasConflict}
          onConfirm={confirmPromote}
          onClose={() => setDrawerIds(null)}
          busy={promoting}
        />
      )}
    </article>
  );
}
