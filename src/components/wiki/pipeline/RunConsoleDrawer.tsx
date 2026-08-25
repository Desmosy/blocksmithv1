"use client";

/**
 * RunConsoleDrawer — Jenkins-style console output for one pipeline run.
 *
 * Click any run row in the stage grid → timestamped server-side log,
 * blocks touched, lock before → after, and the run outcome. Failed runs
 * are as inspectable as successful ones — that is the point.
 */
import { useEffect } from "react";
import type { PipelineRun, RunLogLine } from "@/lib/ir/pipeline-runs";
import { formatStageDuration } from "@/lib/ir/pipeline-stages";

const ACTION_LABELS: Record<string, string> = {
  promote: "Promote to Production",
  rollback: "Rollback",
  "pin-lock": "Pin production lock",
  ingest: "Scan",
  "demo-seed": "Demo seed",
};

function timePart(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--:--";
  return d.toTimeString().slice(0, 8);
}

function LogLine({ line }: { line: RunLogLine }) {
  return (
    <div className={`run-console__line run-console__line--${line.level}`}>
      <span className="run-console__ts">{timePart(line.ts)}</span>
      <span className="run-console__level">{line.level.toUpperCase()}</span>
      <span className="run-console__msg">{line.msg}</span>
    </div>
  );
}

export function RunConsoleDrawer({
  run,
  onClose,
}: {
  run: PipelineRun;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const failed = run.status === "failed";
  const runLabel = run.runNumber != null ? `#${run.runNumber}` : run.id.slice(0, 12);

  return (
    <div className="run-console-backdrop" onClick={onClose} role="presentation">
      <aside
        className="run-console"
        role="dialog"
        aria-label={`Run ${runLabel} console output`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="run-console__header">
          <div className="run-console__title-row">
            <span
              className={`run-console__status ${failed ? "run-console__status--failed" : "run-console__status--success"}`}
            >
              {failed ? "✕ failed" : "✓ success"}
            </span>
            <h2 className="run-console__title">
              Run {runLabel} — {ACTION_LABELS[run.action] ?? run.action}
            </h2>
            <button
              type="button"
              className="run-console__close"
              onClick={onClose}
              aria-label="Close console"
            >
              ✕
            </button>
          </div>
          <p className="run-console__meta">
            {run.actor} · {new Date(run.createdAt).toLocaleString()}
            {run.durationMs != null && <> · {formatStageDuration(run.durationMs)}</>}
          </p>
          <p className="run-console__summary">{run.summary}</p>
          {run.lockBefore || run.lockAfter ? (
            <p className="run-console__lock">
              lock {run.lockBefore ? run.lockBefore.slice(7, 19) : "none"} →{" "}
              {run.lockAfter ? run.lockAfter.slice(7, 19) : "none"}
            </p>
          ) : null}
        </header>

        {run.blocks.length > 0 && (
          <div className="run-console__blocks">
            {run.blocks.slice(0, 24).map((b) => (
              <span key={b.id} className="run-console__block-chip">
                {b.id}
                {b.version != null ? ` v${b.version}` : ""}
              </span>
            ))}
            {run.blocks.length > 24 && (
              <span className="run-console__block-chip run-console__block-chip--more">
                +{run.blocks.length - 24} more
              </span>
            )}
          </div>
        )}

        <div className="run-console__output" aria-label="Console output">
          <p className="run-console__output-label">Console output</p>
          {run.log && run.log.length > 0 ? (
            run.log.map((line, i) => <LogLine key={i} line={line} />)
          ) : (
            <div className="run-console__line run-console__line--info">
              <span className="run-console__ts">{timePart(run.createdAt)}</span>
              <span className="run-console__level">INFO</span>
              <span className="run-console__msg">
                {run.summary} — no console log captured (run logged before
                console output shipped).
              </span>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
