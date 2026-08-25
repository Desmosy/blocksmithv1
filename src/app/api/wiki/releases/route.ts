import { NextRequest, NextResponse } from "next/server";
import { requireDocumentAccess } from "@/lib/cloud/access";
import { isUploadDocRef, uploadFileNameFromRef } from "@/lib/uploads/store";
import { buildReleaseTable, getBlockRelease } from "@/lib/ir/releases";
import { hydrateRegistryFromCloud } from "@/lib/ir/cloud-registry";

export const dynamic = "force-dynamic";

/**
 * GET /api/wiki/releases?doc=…            → full release table (Releases screen)
 * GET /api/wiki/releases?doc=…&block=id   → single row (block page badges)
 */
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
      );
      if (!access.ok) return access.response;
    }

    await hydrateRegistryFromCloud(doc);

    const blockId = request.nextUrl.searchParams.get("block");
    if (blockId) {
      return NextResponse.json({
        docRef: doc,
        block: getBlockRelease(doc, blockId),
      });
    }

    return NextResponse.json(buildReleaseTable(doc));
  } catch (err) {
    console.error("[api/wiki/releases]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to build releases" },
      { status: 500 },
    );
  }
}
