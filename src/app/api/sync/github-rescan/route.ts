import { NextRequest, NextResponse } from "next/server";
import { getGithubSession } from "@/lib/auth/github";
import { clearDesignSystemCache } from "@/lib/clients/registry";
import { requireDocumentAccess } from "@/lib/cloud/access";
import { cloneGithubRepo, parseGithubUrl } from "@/lib/scan/github";
import { scanAndPersist } from "@/lib/scan/run";
import { getWorkspaceScanSyncStatus } from "@/lib/scan/sync-status";
import { isUploadDocRef, uploadFileNameFromRef } from "@/lib/uploads/store";
import { readUploadMarkdownContent } from "@/lib/uploads/persist";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Re-scan a GitHub-backed workspace scan doc in place (hosted SaaS). */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { doc?: string };
    const doc = body.doc?.trim() ?? "";
    if (!doc || !isUploadDocRef(doc)) {
      return NextResponse.json({ error: "upload: scan doc ref required" }, { status: 400 });
    }

    const fileName = uploadFileNameFromRef(doc);
    const access = await requireDocumentAccess(request, fileName);
    if (!access.ok) return access.response;

    const md = await readUploadMarkdownContent(fileName);
    const status = getWorkspaceScanSyncStatus(md);
    const githubRepo = status.githubRepo;
    if (!githubRepo) {
      return NextResponse.json(
        {
          error:
            "This scan has no github-repo metadata. Re-scan from the home page by selecting the repository.",
        },
        { status: 400 },
      );
    }

    const session = await getGithubSession();
    if (!session) {
      return NextResponse.json(
        { error: "Connect GitHub to refresh this scan." },
        { status: 401 },
      );
    }

    const parsed = parseGithubUrl(githubRepo);
    const { workspaceRoot, cleanup } = await cloneGithubRepo(parsed, {
      token: session.providerToken,
    });

    try {
      const result = await scanAndPersist(workspaceRoot, {
        githubRepo,
        writeSnapshot: false,
        fileNameOverride: fileName,
      });
      clearDesignSystemCache();
      return NextResponse.json({
        success: true,
        docRef: result.docRef,
        fileName: result.fileName,
        reactFiles: result.reactFiles,
        featured: result.components,
        scannedAt: result.scannedAt,
      });
    } finally {
      cleanup();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "github rescan failed";
    console.error("[api/sync/github-rescan]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
