/**
 * Pipeline stage results — recorded at append time on the server.
 * The stage grid reads these fields; legacy runs without them show honest
 * fallbacks (no fabricated durations).
 */
import type { PipelineRun, PipelineRunAction } from "./pipeline-runs";

export type PipelineStageId = "ingest" | "staging" | "production" | "lock";

export type PipelineStageStatus =
  | "success"
  | "failed"
  | "active"
  | "skipped"
  | "waiting"
  | "empty";

export interface PipelineStageResult {
  stage: PipelineStageId;
  status: PipelineStageStatus;
  /** Wall-clock ms for this stage when measured server-side. */
  durationMs?: number;
  /** Human detail: block count, hash prefix, actor. */
  detail?: string;
}

export const PIPELINE_STAGE_IDS: PipelineStageId[] = [
  "ingest",
  "staging",
  "production",
  "lock",
];

export function shortLockHash(hash?: string): string {
  if (!hash) return "—";
  const h = hash.replace(/^sha256:/, "");
  return h.length > 8 ? `${h.slice(0, 8)}…` : h;
}

export function formatStageDuration(ms?: number): string {
  if (ms == null || ms < 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

export function buildIngestStages(
  blockCount: number,
  durationMs: number,
): PipelineStageResult[] {
  return [
    {
      stage: "ingest",
      status: "success",
      durationMs,
      detail: blockCount > 0 ? `${blockCount} blocks` : undefined,
    },
    { stage: "staging", status: "skipped", detail: "—" },
    { stage: "production", status: "skipped", detail: "—" },
    { stage: "lock", status: "skipped", detail: "—" },
  ];
}

export function buildPromoteStages(
  blockCount: number,
  lockAfter: string | undefined,
  promoteDurationMs: number,
  lockDurationMs: number,
): PipelineStageResult[] {
  return [
    { stage: "ingest", status: "success", detail: "passed" },
    {
      stage: "staging",
      status: "success",
      detail: blockCount > 0 ? `${blockCount} reviewed` : undefined,
    },
    {
      stage: "production",
      status: "success",
      durationMs: promoteDurationMs,
      detail: blockCount > 0 ? `${blockCount} blocks` : undefined,
    },
    {
      stage: "lock",
      status: lockAfter ? "success" : "waiting",
      durationMs: lockDurationMs,
      detail: lockAfter ? shortLockHash(lockAfter) : undefined,
    },
  ];
}

export function buildPinLockStages(
  blockCount: number,
  lockAfter: string | undefined,
  durationMs: number,
): PipelineStageResult[] {
  return [
    { stage: "ingest", status: "success", detail: "passed" },
    { stage: "staging", status: "success", detail: "passed" },
    { stage: "production", status: "success", detail: "passed" },
    {
      stage: "lock",
      status: "success",
      durationMs,
      detail: lockAfter ? shortLockHash(lockAfter) : `${blockCount} pinned`,
    },
  ];
}

export function buildRollbackStages(
  blockCount: number,
  lockAfter: string | undefined,
  durationMs: number,
): PipelineStageResult[] {
  return [
    { stage: "ingest", status: "success", detail: "passed" },
    {
      stage: "staging",
      status: "failed",
      durationMs,
      detail: "reverted",
    },
    {
      stage: "production",
      status: "success",
      detail: blockCount > 0 ? `${blockCount} restored` : undefined,
    },
    {
      stage: "lock",
      status: lockAfter ? "success" : "skipped",
      detail: lockAfter ? shortLockHash(lockAfter) : undefined,
    },
  ];
}

/**
 * Stage row for a run that failed partway — everything before `failedAt`
 * passed, `failedAt` is red, everything after never ran.
 */
export function buildFailedStages(
  failedAt: PipelineStageId,
  detail?: string,
): PipelineStageResult[] {
  const failedIdx = PIPELINE_STAGE_IDS.indexOf(failedAt);
  return PIPELINE_STAGE_IDS.map((stage, i) => {
    if (i < failedIdx) return { stage, status: "success" as const, detail: "passed" };
    if (i === failedIdx) return { stage, status: "failed" as const, detail: detail ?? "failed" };
    return { stage, status: "skipped" as const, detail: "—" };
  });
}

/** Fallback for runs logged before per-stage timing existed. */
export function deriveStagesFromLegacyRun(run: PipelineRun): PipelineStageResult[] {
  const n = run.blocks.length;
  const blockDetail = n > 0 ? `${n} blocks` : undefined;

  switch (run.action) {
    case "ingest":
      return [
        {
          stage: "ingest",
          status: "success",
          durationMs: run.durationMs,
          detail: blockDetail,
        },
        { stage: "staging", status: "skipped", detail: "—" },
        { stage: "production", status: "skipped", detail: "—" },
        { stage: "lock", status: "skipped", detail: "—" },
      ];
    case "promote":
      return [
        { stage: "ingest", status: "success", detail: "passed" },
        { stage: "staging", status: "success", detail: blockDetail },
        {
          stage: "production",
          status: "success",
          durationMs: run.durationMs,
          detail: blockDetail,
        },
        {
          stage: "lock",
          status: run.lockAfter ? "success" : "waiting",
          detail: run.lockAfter ? shortLockHash(run.lockAfter) : undefined,
        },
      ];
    case "pin-lock":
      return [
        { stage: "ingest", status: "success", detail: "passed" },
        { stage: "staging", status: "success", detail: "passed" },
        { stage: "production", status: "success", detail: "passed" },
        {
          stage: "lock",
          status: "success",
          durationMs: run.durationMs,
          detail: run.lockAfter ? shortLockHash(run.lockAfter) : blockDetail,
        },
      ];
    case "rollback":
      return [
        { stage: "ingest", status: "success", detail: "passed" },
        {
          stage: "staging",
          status: "failed",
          durationMs: run.durationMs,
          detail: "reverted",
        },
        { stage: "production", status: "success", detail: blockDetail },
        {
          stage: "lock",
          status: run.lockAfter ? "success" : "skipped",
          detail: run.lockAfter ? shortLockHash(run.lockAfter) : undefined,
        },
      ];
    case "demo-seed":
      return [
        { stage: "ingest", status: "success", detail: "seeded" },
        { stage: "staging", status: "active", detail: "staged" },
        { stage: "production", status: "success", detail: "—" },
        { stage: "lock", status: "waiting", detail: "demo" },
      ];
    default:
      return PIPELINE_STAGE_IDS.map((stage) => ({
        stage,
        status: "empty" as const,
        detail: "—",
      }));
  }
}

export function stagesForRun(run: PipelineRun): PipelineStageResult[] {
  if (run.stages?.length === 4) return run.stages;
  return deriveStagesFromLegacyRun(run);
}

export function averageStageDurationMs(
  runs: PipelineRun[],
  stageId: PipelineStageId,
): number | null {
  const samples: number[] = [];
  for (const run of runs) {
    const stage = stagesForRun(run).find((s) => s.stage === stageId);
    if (stage?.durationMs != null && stage.durationMs >= 0) {
      samples.push(stage.durationMs);
    }
  }
  if (samples.length === 0) return null;
  return Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
}

export function averageRunDurationMs(runs: PipelineRun[], action: PipelineRunAction): number | null {
  const samples = runs
    .filter((r) => r.action === action && r.durationMs != null && r.durationMs >= 0)
    .map((r) => r.durationMs as number);
  if (samples.length === 0) return null;
  return Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
}
