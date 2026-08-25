import { NextRequest, NextResponse } from "next/server";
import { requireDocumentAccess } from "@/lib/cloud/access";
import { isUploadDocRef, uploadFileNameFromRef } from "@/lib/uploads/store";
import { ensureDocBlocks } from "@/lib/blocks/refresh";
import { rollbackBlock } from "@/lib/ir/registry";
import { writeReferenceLock } from "@/lib/ir/lock";
import { getLockStatus } from "@/lib/ir/enforce";
import { appendRunDurable, createRunLog } from "@/lib/ir/pipeline-runs";
import { buildFailedStages, buildRollbackStages } from "@/lib/ir/pipeline-stages";
import {
  hydrateRegistryFromCloud,
  syncLockToCloud,
  syncRegistryToCloud,
} from "@/lib/ir/cloud-registry";
import { checkRateLimit, clientIp } from "@/lib/cloud/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/wiki/rollback — one click, pointer moves, history never erased.
 *
 * Body: { doc: string, blockId: string }
 * Moves the official pointer to the previous finalized version and
 * regenerates the lock.
 */
export async function POST(request: NextRequest) {
  const log = createRunLog();
  let runDoc: string | undefined;
  let runActor = "local-dev";
  try {
    const { doc, blockId } = (await request.json()) as {
      doc?: string;
      blockId?: string;
    };
    runDoc = doc;

    if (!doc?.trim() || !blockId?.trim()) {
      return NextResponse.json(
        { error: "'doc' and 'blockId' are required" },
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
    log.info(`Rollback requested by ${actor}: ${blockId}`);

    const hydrateStart = Date.now();
    await hydrateRegistryFromCloud(doc);
    log.info(`Registry hydrated (${Date.now() - hydrateStart}ms)`);
    try {
      ensureDocBlocks(doc);
    } catch {
      log.warn("Source markdown not on this instance — rolling back from registry state");
    }
    const lockBefore = getLockStatus(doc).contentHash;
    const started = Date.now();
    const result = rollbackBlock(doc, blockId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }
    log.info(
      `${blockId}: official pointer moved v${result.previousOfficial} → v${result.version} (history immutable)`,
    );

    const { lock } = writeReferenceLock(doc);
    const durationMs = Date.now() - started;
    log.info(`Lock regenerated: ${lock.contentHash} (${durationMs}ms)`);

    // Durability: rolled-back pointer + lock must reach Supabase before
    // response — but a cloud outage must not 500 a completed rollback.
    const persistStart = Date.now();
    try {
      await Promise.all([syncRegistryToCloud(doc), syncLockToCloud(doc, lock)]);
      log.info(`Persisted to cloud registry (${Date.now() - persistStart}ms)`);
    } catch (persistErr) {
      log.error(
        `Cloud persistence failed — rollback applied locally but may not survive a cold start: ${persistErr instanceof Error ? persistErr.message : "unknown error"}`,
      );
    }

    await appendRunDurable({
      docRef: doc,
      actor,
      action: "rollback",
      status: "success",
      summary: `Rolled back ${blockId} to v${result.version}`,
      blocks: [{ id: blockId, version: result.version }],
      lockBefore,
      lockAfter: lock.contentHash,
      durationMs,
      stages: buildRollbackStages(1, lock.contentHash, durationMs),
      log: log.lines,
    });
    return NextResponse.json({
      id: result.id,
      rolledBackTo: result.version,
      previousOfficial: result.previousOfficial,
      lockHash: lock.contentHash,
    });
  } catch (err) {
    console.error("[api/wiki/rollback]", err);
    const message = err instanceof Error ? err.message : "Rollback failed";
    if (runDoc?.trim()) {
      log.error(message);
      await appendRunDurable({
        docRef: runDoc,
        actor: runActor,
        action: "rollback",
        status: "failed",
        summary: `Rollback failed — ${message}`,
        blocks: [],
        stages: buildFailedStages("staging", "error"),
        log: log.lines,
      });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
