import { NextRequest, NextResponse } from "next/server";
import { clearDesignSystemCache } from "@/lib/clients/registry";
import { getWorkspaceRootFromMarkdown } from "@/lib/scan/parse";
import { scanAndPersist } from "@/lib/scan/run";
import { isUploadDocRef, uploadFileNameFromRef } from "@/lib/uploads/store";
import { requireDocumentAccess } from "@/lib/cloud/access";
import { isAllowedServerWorkspacePath } from "@/lib/scan/service";
import { readUploadMarkdownContent } from "@/lib/uploads/persist";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { doc?: string };
    const doc =
      body.doc?.trim() || process.env.BLOCKSMITH_DOC?.trim() || "";
    if (!doc || !isUploadDocRef(doc)) {
      return NextResponse.json(
        { error: "upload: scan doc ref required" },
        { status: 400 },
      );
    }

    const fileName = uploadFileNameFromRef(doc);
    const access = await requireDocumentAccess(request, fileName);
    if (!access.ok) return access.response;

    const md = await readUploadMarkdownContent(fileName);
    const workspaceRoot = getWorkspaceRootFromMarkdown(md);
    if (!workspaceRoot) {
      return NextResponse.json(
        { error: "No workspace-root in scan document" },
        { status: 400 },
      );
    }

    if (!isAllowedServerWorkspacePath(workspaceRoot)) {
      return NextResponse.json(
        {
          error:
            "Server cannot rescan this workspace path. Run `blocksmith scan /path/to/repo` locally or re-scan from GitHub on the home page.",
        },
        { status: 403 },
      );
    }

    const result = await scanAndPersist(workspaceRoot);
    clearDesignSystemCache();

    return NextResponse.json({
      success: true,
      docRef: result.docRef,
      fileName: result.fileName,
      components: result.components,
      reactFiles: result.reactFiles,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "rescan failed";
    console.error("[api/sync/rescan]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
