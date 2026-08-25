import { NextRequest, NextResponse } from "next/server";
import { requireDocumentAccess } from "@/lib/cloud/access";
import { isUploadDocRef, uploadFileNameFromRef } from "@/lib/uploads/store";
import { buildPromoteDiffs } from "@/lib/ir/diff";
import { hydrateRegistryFromCloud } from "@/lib/ir/cloud-registry";

export const dynamic = "force-dynamic";

/**
 * GET /api/wiki/pipeline/diff?doc=…&blocks=id1,id2
 * Production vs staging content per block — feeds PromoteDiffDrawer.
 */
export async function GET(request: NextRequest) {
  const doc = request.nextUrl.searchParams.get("doc");
  const blocksParam = request.nextUrl.searchParams.get("blocks");
  if (!doc || !blocksParam) {
    return NextResponse.json(
      { error: "Missing doc or blocks parameter" },
      { status: 400 },
    );
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

    await hydrateRegistryFromCloud(doc);
    const blockIds = blocksParam
      .split(",")
      .map((b) => b.trim())
      .filter(Boolean);

    return NextResponse.json({ docRef: doc, diffs: buildPromoteDiffs(doc, blockIds) });
  } catch (err) {
    console.error("[api/wiki/pipeline/diff]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to build diff" },
      { status: 500 },
    );
  }
}
