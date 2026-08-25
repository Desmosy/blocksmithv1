import { NextRequest, NextResponse } from "next/server";
import { renameProject } from "@/lib/dashboard/manage";
import { requireDocumentAccess } from "@/lib/cloud/access";
import { isUploadDocRef, uploadFileNameFromRef } from "@/lib/uploads/store";

export const dynamic = "force-dynamic";

/** Rename a project (frontmatter + H1). Owner/admin only in hosted mode. */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { docRef?: string; name?: string };
    const docRef = body.docRef?.trim();
    if (!docRef || !isUploadDocRef(docRef) || !body.name?.trim()) {
      return NextResponse.json(
        { error: "A project docRef (upload:…) and name are required." },
        { status: 400 },
      );
    }

    const access = await requireDocumentAccess(
      request,
      uploadFileNameFromRef(docRef),
      "write",
    );
    if (!access.ok) return access.response;

    const name = await renameProject(docRef, body.name);
    return NextResponse.json({ success: true, name });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Rename failed";
    console.error("[api/projects/rename]", err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
