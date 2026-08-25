/**
 * Pipeline runs — append-only audit log of the Design CI/CD control plane.
 *
 * Every promote, rollback, pin-lock, and auto-promoting ingest is a run:
 * who did it, what moved, lock hash before → after. Runs are never deleted;
 * rollback is itself a new run (PROJECT-PIPELINE.md §4).
 *
 * Storage: .blocksmith/runs/<docKey>.json (disk, capped) + best-effort
 * Supabase mirror (`pipeline_runs`) when the SaaS database is configured.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { blocksmithWritableRoot } from "@/lib/runtime/writable-root";

export type PipelineRunAction =
  | "promote"
  | "rollback"
  | "pin-lock"
  | "ingest"
  | "demo-seed";

export type PipelineRunStatus = "success" | "failed";

/** One console-output line, captured server-side while the run executed. */
export interface RunLogLine {
  ts: string;
  level: "info" | "warn" | "error";
  msg: string;
}

const LOG_CAP = 200;

/**
 * Console logger for a pipeline run — Jenkins-style: every write path builds
 * one of these so the run is inspectable afterwards, especially on failure.
 */
export interface RunLog {
  lines: RunLogLine[];
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

export function createRunLog(): RunLog {
  const lines: RunLogLine[] = [];
  const push = (level: RunLogLine["level"], msg: string) => {
    if (lines.length >= LOG_CAP) return;
    lines.push({ ts: new Date().toISOString(), level, msg });
  };
  return {
    lines,
    info: (msg) => push("info", msg),
    warn: (msg) => push("warn", msg),
    error: (msg) => push("error", msg),
  };
}

export interface PipelineRun {
  id: string;
  docRef: string;
  /** Monotonic per-doc sequence (1-based). */
  runNumber?: number;
  /** GitHub login, API-key owner id, "ingest", or "local-dev". */
  actor: string;
  action: PipelineRunAction;
  /** Human summary, e.g. "Promoted 3 blocks". */
  summary: string;
  /** Block ids touched with resulting versions. */
  blocks: { id: string; version?: number }[];
  lockBefore?: string;
  lockAfter?: string;
  /** Total wall-clock ms for the server operation. */
  durationMs?: number;
  /** Per-stage results when recorded (see pipeline-stages.ts). */
  stages?: import("./pipeline-stages").PipelineStageResult[];
  /** Run outcome — failed runs are first-class (never silently dropped). */
  status?: PipelineRunStatus;
  /** Console output captured while the run executed. */
  log?: RunLogLine[];
  createdAt: string;
}

const RUNS_CAP = 200;

function runsPath(docRef: string): string {
  const key = docRef.replace(/[^a-zA-Z0-9._-]/g, "_");
  return join(blocksmithWritableRoot(), "runs", `${key}.json`);
}

function readRuns(docRef: string): PipelineRun[] {
  const p = runsPath(docRef);
  if (!existsSync(p)) return [];
  try {
    const parsed = JSON.parse(readFileSync(p, "utf-8")) as PipelineRun[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistRunToDisk(
  run: Omit<PipelineRun, "id" | "createdAt" | "runNumber">,
): PipelineRun {
  const prior = readRuns(run.docRef);
  const entry: PipelineRun = {
    ...run,
    runNumber: prior.length + 1,
    id: `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  try {
    const runs = [...prior, entry].slice(-RUNS_CAP);
    const p = runsPath(run.docRef);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, `${JSON.stringify(runs, null, 2)}\n`, "utf-8");
  } catch {
    /* disk may be read-only (serverless) — cloud mirror still records */
  }
  return entry;
}

export function appendRun(
  run: Omit<PipelineRun, "id" | "createdAt" | "runNumber">,
): PipelineRun {
  const entry = persistRunToDisk(run);
  // Best-effort durable mirror; never blocks the control plane.
  void mirrorRunToCloud(entry).catch(() => {});
  return entry;
}

/**
 * Awaited variant for API routes: the Supabase mirror completes before the
 * response is sent, so the run (and its console log) survives a lambda freeze.
 * Mirror failure is non-fatal — the control-plane action already succeeded.
 */
export async function appendRunDurable(
  run: Omit<PipelineRun, "id" | "createdAt" | "runNumber">,
): Promise<PipelineRun> {
  const entry = persistRunToDisk(run);
  await mirrorRunToCloud(entry).catch(() => {});
  return entry;
}

export function listRuns(docRef: string, limit = 25): PipelineRun[] {
  return readRuns(docRef).slice(-limit).reverse();
}

async function mirrorRunToCloud(run: PipelineRun): Promise<void> {
  const { saasDbEnabled } = await import("@/lib/cloud/saas");
  if (!saasDbEnabled()) return;
  const { getSupabaseAdmin } = await import("@/lib/supabase/server");
  const sb = getSupabaseAdmin();
  const base = {
    run_id: run.id,
    doc_ref: run.docRef,
    actor: run.actor,
    action: run.action,
    summary: run.summary,
    blocks: run.blocks,
    lock_before: run.lockBefore ?? null,
    lock_after: run.lockAfter ?? null,
    created_at: run.createdAt,
    run_number: run.runNumber ?? null,
    duration_ms: run.durationMs ?? null,
    stages: run.stages ?? null,
  };
  const { error } = await sb.from("blocksmith_pipeline_runs").insert({
    ...base,
    status: run.status ?? "success",
    log: run.log ?? null,
  });
  // Deployments that haven't applied the status/log migration yet must still
  // record the run — retry with the legacy shape.
  if (error) {
    await sb.from("blocksmith_pipeline_runs").insert(base);
  }
}

/** Pull runs from Supabase when the local disk is cold (serverless). */
export async function hydrateRunsFromCloud(docRef: string): Promise<void> {
  try {
    const { saasDbEnabled } = await import("@/lib/cloud/saas");
    if (!saasDbEnabled()) return;
    if (readRuns(docRef).length > 0) return; // disk already warm
    const { getSupabaseAdmin } = await import("@/lib/supabase/server");
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("blocksmith_pipeline_runs")
      .select("*")
      .eq("doc_ref", docRef)
      .order("created_at", { ascending: true })
      .limit(RUNS_CAP);
    if (error || !data?.length) return;
    const runs: PipelineRun[] = data.map((r) => ({
      id: r.run_id,
      docRef: r.doc_ref,
      runNumber: r.run_number ?? undefined,
      actor: r.actor,
      action: r.action,
      summary: r.summary,
      blocks: (r.blocks ?? []) as PipelineRun["blocks"],
      lockBefore: r.lock_before ?? undefined,
      lockAfter: r.lock_after ?? undefined,
      durationMs: r.duration_ms ?? undefined,
      stages: (r.stages ?? undefined) as PipelineRun["stages"],
      status: (r.status ?? undefined) as PipelineRun["status"],
      log: (r.log ?? undefined) as PipelineRun["log"],
      createdAt: r.created_at,
    }));
    const p = runsPath(docRef);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, `${JSON.stringify(runs, null, 2)}\n`, "utf-8");
  } catch {
    /* hydration is best-effort */
  }
}
