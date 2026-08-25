import { NextRequest, NextResponse } from "next/server";
import { requireDocumentAccess } from "@/lib/cloud/access";
import { isUploadDocRef, uploadFileNameFromRef } from "@/lib/uploads/store";
import { buildReleaseTable } from "@/lib/ir/releases";
import { listRuns, hydrateRunsFromCloud } from "@/lib/ir/pipeline-runs";
import { ensurePipelineRegistry } from "@/lib/ir/ensure-pipeline-registry";
import type { PipelinePayload } from "@/lib/ir/pipeline";
import type { BlocksmithLockV1 } from "@/lib/ir/types";

export const dynamic = "force-dynamic";

/** GET /api/wiki/pipeline?doc=… — one payload for the whole console. */
export async function GET(request: NextRequest) {
  const doc = request.nextUrl.searchParams.get("doc");
  if (!doc) {
    return NextResponse.json({ error: "Missing doc parameter" }, { status: 400 });
  }

  try {
    if (isUploadDocRef(doc)) {
      const access = await requireDocumentAccess(
        request,
        uploadFileNameFromRef(doc),
        "read",
      );
      if (!access.ok) return access.response;
    }

    // Serverless cold start: hydrate upload markdown + registry from Supabase,
    // bootstrap from scan markdown when the registry table is empty.
    await Promise.all([ensurePipelineRegistry(doc), hydrateRunsFromCloud(doc)]);

    const table = buildReleaseTable(doc);
    const lock = JSON.parse(table.lockBody) as BlocksmithLockV1;
    const runs = listRuns(doc, 25);

    const staging = table.rows.filter(
      (r) => r.draftPending || r.official == null || r.conflict,
    );
    const production = table.rows.filter((r) => r.official != null);

    const drift = table.lock.drift;
    const driftCount = drift
      ? drift.versionMismatches.length +
        drift.missingInLock.length +
        drift.missingInRegistry.length
      : table.lock.present
        ? 0
        : production.length;

    const payload: PipelinePayload = {
      docRef: doc,
      packageName: table.packageName,
      graphHash: table.graphHash,
      counts: table.counts,
      lock: table.lock,
      lockBody: table.lockBody,
      lanes: {
        staging,
        production,
        lockedIds: Object.keys(lock.blocks),
      },
      runs,
      // runs are newest-first; first ingest in the window is the latest scan.
      lastIngest: runs.find((r) => r.action === "ingest") ?? null,
      driftCount,
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[api/wiki/pipeline]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to build pipeline" },
      { status: 500 },
    );
  }
}
