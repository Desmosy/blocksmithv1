/**
 * Pipeline payload types — shared between /api/wiki/pipeline and the
 * Pipeline console UI. Client-safe (types only).
 */
import type { ReleaseRow, ReleaseTable } from "./releases";
import type { PipelineRun } from "./pipeline-runs";

export interface PipelineLanes {
  /** Drafts, never-promoted, conflicts — what promote would ship. */
  staging: ReleaseRow[];
  /** Blocks with an active official pointer. */
  production: ReleaseRow[];
  /** Block ids pinned in the current reference lock. */
  lockedIds: string[];
}

export interface PipelinePayload {
  docRef: string;
  packageName: string;
  graphHash: string;
  counts: ReleaseTable["counts"];
  lock: ReleaseTable["lock"];
  lockBody: string;
  lanes: PipelineLanes;
  runs: PipelineRun[];
  lastIngest: PipelineRun | null;
  /** Pins drifting from official — "N PRs would fail validate:ui". */
  driftCount: number;
}
