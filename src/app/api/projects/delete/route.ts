import { NextRequest, NextResponse } from "next/server";
import { deleteProject } from "@/lib/dashboard/manage";
import { requireDocumentAccess } from "@/lib/cloud/access";
import { isUploadDocRef, uploadFileNameFromRef } from "@/lib/uploads/store";

export const dynamic = "force-dynamic";

/** Delete a project (upload + registry record). Owner/admin only in hosted mode. */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { docRef?: string };
    const docRef = body.docRef?.trim();
    if (!docRef || !isUploadDocRef(docRef)) {
      return NextResponse.json(
        { error: "A deletable project docRef (upload:…) is required." },
        { status: 400 },
      );
    }

    const access = await requireDocumentAccess(
      request,
      uploadFileNameFromRef(docRef),
      "write",
    );
    if (!access.ok) return access.response;

    await deleteProject(docRef);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Delete failed";
    console.error("[api/projects/delete]", err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
