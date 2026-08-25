"use client";

/**
 * PipelineStageView — Jenkins-class stage grid backed by real pipeline runs.
 * Durations come from server-measured stage results; counts and lock state
 * come from the live registry payload. No fabricated branch tags or guessed
 * inter-run timing.
 */
import { useMemo, useState, type ReactNode } from "react";
import type { PipelinePayload } from "@/lib/ir/pipeline";
import type { PipelineRun } from "@/lib/ir/pipeline-runs";
import {
  PIPELINE_STAGE_IDS,
  averageRunDurationMs,
  averageStageDurationMs,
  formatStageDuration,
  stagesForRun,
  type PipelineStageId,
  type PipelineStageResult,
} from "@/lib/ir/pipeline-stages";
import { RunConsoleDrawer } from "./RunConsoleDrawer";

const STAGE_LABELS: Record<PipelineStageId, string> = {
  ingest: "scan",
  staging: "staging",
  production: "production",
  lock: "lock",
};

function formatRunTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Live registry snapshot — not a logged run, but real current state. */
function stagesForCurrent(data: PipelinePayload): PipelineStageResult[] {
  const ingest = data.lastIngest;
  const stagingN = data.lanes.staging.length;
  const prodN = data.lanes.production.length;
  const { lock } = data;

  return [
    {
      stage: "ingest",
      status: ingest ? "success" : "empty",
      durationMs: ingest?.durationMs,
      detail: ingest ? ingest.summary : "no scan recorded",
    },
    {
      stage: "staging",
      status: stagingN > 0 ? "active" : "success",
      detail: stagingN > 0 ? `${stagingN} waiting` : "clear",
    },
    {
      stage: "production",
      status: prodN > 0 ? "success" : "empty",
      detail: `${prodN} live`,
    },
    {
      stage: "lock",
      status: !lock.present ? "waiting" : lock.fresh ? "success" : "failed",
      detail: !lock.present
        ? "unpinned"
        : lock.fresh
          ? `${lock.pinnedBlocks} pinned`
          : "stale — pull required",
    },
  ] as PipelineStageResult[];
}

function cellPrimaryForRun(stage: PipelineStageResult): string {
  if (stage.durationMs != null) return formatStageDuration(stage.durationMs);
  return "—";
}

function cellPrimaryForCurrent(stage: PipelineStageResult, data: PipelinePayload): string {
  if (stage.stage === "ingest" && data.lastIngest) {
    return formatRunTime(data.lastIngest.createdAt);
  }
  if (stage.stage === "staging") return String(data.lanes.staging.length);
  if (stage.stage === "production") return String(data.lanes.production.length);
  if (stage.stage === "lock") {
    if (!data.lock.present) return "none";
    return data.lock.fresh ? "fresh" : "stale";
  }
  return "—";
}

function StageCellView({
  stage,
  mode,
  data,
}: {
  stage: PipelineStageResult;
  mode: "current" | "run";
  data?: PipelinePayload;
}) {
  const primary =
    mode === "current" && data
      ? cellPrimaryForCurrent(stage, data)
      : cellPrimaryForRun(stage);

  return (
    <div className={`pipeline-stage-cell pipeline-stage-cell--${stage.status}`}>
      <span className="pipeline-stage-cell__duration">{primary}</span>
      {stage.detail && (
        <span className="pipeline-stage-cell__sub">{stage.detail}</span>
      )}
    </div>
  );
}

function RunMeta({
  runNumber,
  label,
  time,
  actor,
  detail,
  actions,
  failed,
  onOpenConsole,
}: {
  runNumber: string;
  label: string;
  time: string;
  actor?: string;
  detail?: string;
  actions?: ReactNode;
  failed?: boolean;
  onOpenConsole?: () => void;
}) {
  const badgeVariant = failed
    ? "failed"
    : label === "current"
      ? "current"
      : "history";
  return (
    <div className="pipeline-run-meta">
      <div className="pipeline-run-meta__top">
        {onOpenConsole ? (
          <button
            type="button"
            className={`pipeline-run-badge pipeline-run-badge--${badgeVariant} pipeline-run-badge--clickable`}
            onClick={onOpenConsole}
            title="Open console output"
          >
            {runNumber}
          </button>
        ) : (
          <span className={`pipeline-run-badge pipeline-run-badge--${badgeVariant}`}>
            {runNumber}
          </span>
        )}
        <span className="pipeline-run-meta__time">{time}</span>
      </div>
      {actor && <p className="pipeline-run-meta__actor">{actor}</p>}
      {detail && <p className="pipeline-run-meta__detail">{detail}</p>}
      {(onOpenConsole || actions) && (
        <div className="pipeline-run-meta__actions">
          {onOpenConsole && (
            <button
              type="button"
              className="pipeline-run-action"
              onClick={onOpenConsole}
            >
              Console output
            </button>
          )}
          {actions}
        </div>
      )}
    </div>
  );
}

export function PipelineStageView({
  data,
  docFileName,
  onChanged,
}: {
  data: PipelinePayload;
  docFileName: string;
  onChanged: () => void;
}) {
  const [busyRun, setBusyRun] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consoleRun, setConsoleRun] = useState<PipelineRun | null>(null);

  const runs = data.runs;
  const currentStages = useMemo(() => stagesForCurrent(data), [data]);
  const chronological = useMemo(() => [...runs].reverse(), [runs]);

  const avgTimes = useMemo(() => {
    const out = {} as Record<PipelineStageId, string>;
    for (const id of PIPELINE_STAGE_IDS) {
      const ms = averageStageDurationMs(chronological, id);
      out[id] = ms != null ? formatStageDuration(ms) : "—";
    }
    return out;
  }, [chronological]);

  const fullRunEstimate = useMemo(() => {
    const ms = averageRunDurationMs(chronological, "promote");
    return ms != null ? formatStageDuration(ms) : "—";
  }, [chronological]);

  async function rollbackRun(run: PipelineRun) {
    setBusyRun(run.id);
    setError(null);
    try {
      for (const b of run.blocks) {
        const res = await fetch("/api/wiki/rollback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ doc: docFileName, blockId: b.id }),
        });
        if (!res.ok) {
          const body = await res.json();
          throw new Error(`${b.id}: ${body.error ?? "rollback failed"}`);
        }
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rollback failed");
    } finally {
      setBusyRun(null);
    }
  }

  return (
    <section className="pipeline-stage-view">
      <p className="pipeline-stage-view__summary">
        Average stage times{" "}
        <span className="pipeline-stage-view__summary-muted">
          (measured on promote runs: {fullRunEstimate})
        </span>
      </p>

      <div className="pipeline-stage-grid" role="table" aria-label="Pipeline stages">
        <div className="pipeline-stage-grid__header" role="row">
          <div className="pipeline-stage-grid__corner" role="columnheader" />
          {PIPELINE_STAGE_IDS.map((id, i) => (
            <div key={id} className="pipeline-stage-grid__stage-header" role="columnheader">
              <span className="pipeline-stage-grid__stage-name">{STAGE_LABELS[id]}</span>
              <span className="pipeline-stage-grid__stage-avg">{avgTimes[id]}</span>
              <div
                className="pipeline-stage-grid__stage-bar"
                style={{
                  opacity:
                    i === 1 && data.lanes.staging.length > 0 ? 1 : 0.35,
                }}
              />
            </div>
          ))}
        </div>

        <div className="pipeline-stage-grid__row pipeline-stage-grid__row--current" role="row">
          <RunMeta
            runNumber="live"
            label="current"
            time="now"
            detail={`${data.counts.live} live · ${data.lanes.staging.length} staged · lock ${data.lock.present ? (data.lock.fresh ? "fresh" : "stale") : "none"}`}
          />
          {currentStages.map((stage) => (
            <StageCellView
              key={`current-${stage.stage}`}
              stage={stage}
              mode="current"
              data={data}
            />
          ))}
        </div>

        {runs.length === 0 ? (
          <div className="pipeline-stage-grid__empty">
            No runs yet — promote, pin the lock, or scan a repo to start.
          </div>
        ) : (
          runs.map((run) => {
            const cells = stagesForRun(run);
            const runLabel =
              run.runNumber != null ? `#${run.runNumber}` : run.id.slice(0, 12);
            return (
              <div key={run.id} className="pipeline-stage-grid__row" role="row">
                <RunMeta
                  runNumber={runLabel}
                  label="history"
                  time={formatRunTime(run.createdAt)}
                  actor={run.actor}
                  detail={run.summary}
                  failed={run.status === "failed"}
                  onOpenConsole={() => setConsoleRun(run)}
                  actions={
                    run.action === "promote" && run.status !== "failed" ? (
                      <button
                        type="button"
                        onClick={() => rollbackRun(run)}
                        disabled={busyRun !== null}
                        className="pipeline-run-action"
                        title="Rollback this promote run"
                      >
                        {busyRun === run.id ? "Rolling back…" : "↺ Rollback run"}
                      </button>
                    ) : undefined
                  }
                />
                {cells.map((stage) => (
                  <StageCellView key={`${run.id}-${stage.stage}`} stage={stage} mode="run" />
                ))}
              </div>
            );
          })
        )}
      </div>

      {error && <p className="pipeline-stage-view__error">{error}</p>}

      {consoleRun && (
        <RunConsoleDrawer run={consoleRun} onClose={() => setConsoleRun(null)} />
      )}
    </section>
  );
}
