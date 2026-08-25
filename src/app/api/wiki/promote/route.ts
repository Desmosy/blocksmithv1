import { NextRequest, NextResponse } from "next/server";
import { requireDocumentAccess } from "@/lib/cloud/access";
import { isUploadDocRef, uploadFileNameFromRef } from "@/lib/uploads/store";
import { ensureDocBlocks } from "@/lib/blocks/refresh";
import {
  promoteBlock,
  resolveConflict,
  updateManifest,
  type PromoteResult,
} from "@/lib/ir/registry";
import { writeReferenceLock } from "@/lib/ir/lock";
import { getLockStatus } from "@/lib/ir/enforce";
import { appendRunDurable, createRunLog } from "@/lib/ir/pipeline-runs";
import { buildFailedStages, buildPromoteStages } from "@/lib/ir/pipeline-stages";
import {
  hydrateRegistryFromCloud,
  syncLockToCloud,
  syncRegistryToCloud,
} from "@/lib/ir/cloud-registry";
import { checkRateLimit, clientIp } from "@/lib/cloud/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/wiki/promote — the human gate of Design CI/CD, batch or single.
 *
 * Body: { doc: string, blockIds: string[], resolveConflicts?: boolean }
 *
 * Promotes the latest version of each block to official, then regenerates the
 * reference lock once. Conflicted blocks are skipped unless
 * `resolveConflicts` is set (explicit human decision).
 */
export async function POST(request: NextRequest) {
  const log = createRunLog();
  let runDoc: string | undefined;
  let runActor = "local-dev";
  try {
    const { doc, blockIds, resolveConflicts } = (await request.json()) as {
      doc?: string;
      blockIds?: string[];
      resolveConflicts?: boolean;
    };
    runDoc = doc;

    if (!doc?.trim()) {
      return NextResponse.json({ error: "'doc' is required" }, { status: 400 });
    }
    if (!Array.isArray(blockIds) || blockIds.length === 0) {
      return NextResponse.json(
        { error: "'blockIds' must be a non-empty array" },
        { status: 400 },
      );
    }

    const rl = await checkRateLimit(
      `pipeline:write:${clientIp(request)}`,
      Number(process.env.BLOCKSMITH_PIPELINE_RATE_LIMIT ?? 120),
      10 * 60_000,
    );
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Too many pipeline actions — try again in ${rl.retryAfterSec}s.` },
        { status: 429 },
      );
    }

    let actor = "local-dev";
    if (isUploadDocRef(doc)) {
      const access = await requireDocumentAccess(
        request,
        uploadFileNameFromRef(doc),
        "write",
      );
      if (!access.ok) return access.response;
      actor = access.userId ?? actor;
    }
    runActor = actor;
    log.info(`Promote requested by ${actor}: ${blockIds.length} block${blockIds.length === 1 ? "" : "s"}`);

    const hydrateStart = Date.now();
    await hydrateRegistryFromCloud(doc);
    log.info(`Registry hydrated (${Date.now() - hydrateStart}ms)`);
    try {
      ensureDocBlocks(doc);
    } catch {
      log.warn("Source markdown not on this instance — promoting from registry state");
    }
    const lockBefore = getLockStatus(doc).contentHash;
    log.info(`Lock before: ${lockBefore ?? "none"}`);
    const started = Date.now();

    const results: PromoteResult[] = [];
    const promoteStart = Date.now();
    // deferManifest: rebuild the manifest once for the batch, not per block —
    // per-block manifest writes are O(N²) directory scans on large promotes.
    for (const blockId of blockIds) {
      let result = promoteBlock(doc, blockId, "", { deferManifest: true });
      if (!result.ok && resolveConflicts && /conflict/i.test(result.error ?? "")) {
        log.warn(`${blockId}: conflict — resolving by promoting latest version`);
        result = resolveConflict(doc, blockId, "", { deferManifest: true });
      }
      if (result.ok) {
        log.info(`${blockId}: promoted to v${result.version}`);
      } else {
        log.error(`${blockId}: ${result.error ?? "promote failed"}`);
      }
      results.push(result);
    }
    updateManifest(doc);
    const promoteDurationMs = Date.now() - promoteStart;

    const lockStart = Date.now();
    const { lock } = writeReferenceLock(doc);
    const lockDurationMs = Date.now() - lockStart;
    const durationMs = Date.now() - started;
    log.info(`Lock regenerated: ${lock.contentHash} (${Object.keys(lock.blocks).length} blocks pinned, ${lockDurationMs}ms)`);

    const promoted = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);

    // Durability: the response must not outrun persistence — a frozen lambda
    // drops fire-and-forget mirrors, silently losing the promote. But a cloud
    // outage must not turn a promote that ALREADY SUCCEEDED into a 500: degrade
    // loudly (run log + response flag), never fail the action.
    const persistStart = Date.now();
    let persisted = true;
    try {
      await Promise.all([syncRegistryToCloud(doc), syncLockToCloud(doc, lock)]);
      log.info(`Persisted to cloud registry (${Date.now() - persistStart}ms)`);
    } catch (persistErr) {
      persisted = false;
      log.error(
        `Cloud persistence failed — promote applied locally but may not survive a cold start: ${persistErr instanceof Error ? persistErr.message : "unknown error"}`,
      );
    }

    // A batch where every block failed is a FAILED run — recorded, inspectable.
    if (promoted.length === 0 && failed.length > 0) {
      await appendRunDurable({
        docRef: doc,
        actor,
        action: "promote",
        status: "failed",
        summary: `Promote failed — 0 of ${blockIds.length} block${blockIds.length === 1 ? "" : "s"} promoted`,
        blocks: failed.map((r) => ({ id: r.id })),
        lockBefore,
        lockAfter: lock.contentHash,
        durationMs,
        stages: buildFailedStages("production", `${failed.length} failed`),
        log: log.lines,
      });
    }

    if (promoted.length > 0) {
      if (failed.length > 0) {
        log.warn(`${failed.length} block${failed.length === 1 ? "" : "s"} failed to promote`);
      }
      await appendRunDurable({
        docRef: doc,
        actor,
        action: "promote",
        status: "success",
        summary: `Promoted ${promoted.length} block${promoted.length === 1 ? "" : "s"} to Production`,
        blocks: promoted.map((r) => ({ id: r.id, version: r.version })),
        lockBefore,
        lockAfter: lock.contentHash,
        durationMs,
        stages: buildPromoteStages(
          promoted.length,
          lock.contentHash,
          promoteDurationMs,
          lockDurationMs,
        ),
        log: log.lines,
      });
    }

    return NextResponse.json({
      promoted: promoted.map((r) => ({ id: r.id, version: r.version })),
      failed: results
        .filter((r) => !r.ok)
        .map((r) => ({ id: r.id, error: r.error })),
      lockHash: lock.contentHash,
      pinnedBlocks: Object.keys(lock.blocks).length,
      ...(persisted ? {} : { persistenceWarning: "Cloud sync failed — see run console" }),
    });
  } catch (err) {
    console.error("[api/wiki/promote]", err);
    const message = err instanceof Error ? err.message : "Promote failed";
    // Fail loud, fail helpful: the failure is a run too — inspectable in the
    // Pipeline console, not just a 500 in the browser devtools.
    if (runDoc?.trim()) {
      log.error(message);
      await appendRunDurable({
        docRef: runDoc,
        actor: runActor,
        action: "promote",
        status: "failed",
        summary: `Promote failed — ${message}`,
        blocks: [],
        stages: buildFailedStages("production", "error"),
        log: log.lines,
      });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
