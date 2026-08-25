import { NextRequest, NextResponse } from "next/server";
import { requireDocumentAccess } from "@/lib/cloud/access";
import { isUploadDocRef, uploadFileNameFromRef } from "@/lib/uploads/store";
import { ensureDocBlocks } from "@/lib/blocks/refresh";
import { getOfficialBlocks } from "@/lib/ir/registry";
import { writeReferenceLock } from "@/lib/ir/lock";
import { getLockStatus } from "@/lib/ir/enforce";
import { appendRunDurable, createRunLog } from "@/lib/ir/pipeline-runs";
import { buildFailedStages, buildPinLockStages } from "@/lib/ir/pipeline-stages";
import {
  hydrateRegistryFromCloud,
  syncLockToCloud,
} from "@/lib/ir/cloud-registry";
import { checkRateLimit, clientIp } from "@/lib/cloud/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/wiki/pin-lock — fix the "40 Live, no lock" dead end.
 *
 * When ingest auto-promoted everything and there is nothing to click,
 * the production graph is ready but agents are unpinned. This writes the
 * reference lock from the current official graph and logs a run.
 *
 * Body: { doc: string }
 */
export async function POST(request: NextRequest) {
  const log = createRunLog();
  let runDoc: string | undefined;
  let runActor = "local-dev";
  try {
    const { doc } = (await request.json()) as { doc?: string };
    if (!doc?.trim()) {
      return NextResponse.json({ error: "'doc' is required" }, { status: 400 });
    }
    runDoc = doc;

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
    log.info(`Pin lock requested by ${actor}`);

    const hydrateStart = Date.now();
    await hydrateRegistryFromCloud(doc);
    log.info(`Registry hydrated (${Date.now() - hydrateStart}ms)`);
    try {
      ensureDocBlocks(doc);
    } catch {
      log.warn("Source markdown not on this instance — pinning from registry state");
    }

    const official = getOfficialBlocks(doc);
    if (official.length === 0) {
      return NextResponse.json(
        { error: "Nothing in production yet — promote at least one block first." },
        { status: 409 },
      );
    }

    const before = getLockStatus(doc);
    const started = Date.now();
    const { lock, path } = writeReferenceLock(doc);
    const durationMs = Date.now() - started;
    const pinned = Object.keys(lock.blocks).length;
    log.info(`${official.length} production blocks found`);
    log.info(`Lock written: ${lock.contentHash} (${pinned} blocks pinned, ${durationMs}ms)`);

    // Durability: lock must reach Supabase before we respond — but a cloud
    // outage must not 500 a pin that already succeeded locally.
    const persistStart = Date.now();
    try {
      await syncLockToCloud(doc, lock);
      log.info(`Lock persisted to cloud (${Date.now() - persistStart}ms)`);
    } catch (persistErr) {
      log.error(
        `Cloud persistence failed — lock pinned locally but may not survive a cold start: ${persistErr instanceof Error ? persistErr.message : "unknown error"}`,
      );
    }

    await appendRunDurable({
      docRef: doc,
      actor,
      action: "pin-lock",
      status: "success",
      summary: `Pinned production lock (${pinned} blocks)`,
      blocks: official.map((b) => ({ id: b.id, version: b.version })),
      lockBefore: before.contentHash,
      lockAfter: lock.contentHash,
      durationMs,
      stages: buildPinLockStages(pinned, lock.contentHash, durationMs),
      log: log.lines,
    });

    return NextResponse.json({
      lockHash: lock.contentHash,
      pinnedBlocks: Object.keys(lock.blocks).length,
      path,
    });
  } catch (err) {
    console.error("[api/wiki/pin-lock]", err);
    const message = err instanceof Error ? err.message : "Pin lock failed";
    if (runDoc?.trim()) {
      log.error(message);
      await appendRunDurable({
        docRef: runDoc,
        actor: runActor,
        action: "pin-lock",
        status: "failed",
        summary: `Pin lock failed — ${message}`,
        blocks: [],
        stages: buildFailedStages("lock", "error"),
        log: log.lines,
      });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
