import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/cloud/auth";
import { requireDocumentAccess } from "@/lib/cloud/access";
import { ensureDocBlocks } from "@/lib/blocks/refresh";
import { buildLock, serializeLock, verifyLock } from "@/lib/ir/lock";
import { isUploadDocRef, uploadFileNameFromRef } from "@/lib/uploads/store";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/lock?docRef=… — Design CI/CD LOCK artifact.
 *
 * Returns blocksmith.lock built from the registry's official (promoted)
 * graph. The CLI writes this file into the customer repo on `blocksmith pull`;
 * agents and validate_ui resolve against it, never against drafts.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiKey(request);
  if (!auth.ok) return auth.response;

  const docRef = request.nextUrl.searchParams.get("docRef");
  if (!docRef) {
    return NextResponse.json({ error: "Missing docRef parameter" }, { status: 400 });
  }

  try {
    if (isUploadDocRef(docRef)) {
      const access = await requireDocumentAccess(
        request,
        uploadFileNameFromRef(docRef),
      );
      if (!access.ok) return access.response;
    }

    ensureDocBlocks(docRef);
    const lock = buildLock(docRef);
    const verification = verifyLock(docRef, lock);

    if (request.nextUrl.searchParams.get("format") === "file") {
      return new NextResponse(serializeLock(lock), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": 'attachment; filename="blocksmith.lock"',
        },
      });
    }

    return NextResponse.json({
      lock,
      pinnedBlocks: Object.keys(lock.blocks).length,
      fresh: verification.ok,
    });
  } catch (err) {
    console.error("[api/v1/lock]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to build lock" },
      { status: 500 },
    );
  }
}
