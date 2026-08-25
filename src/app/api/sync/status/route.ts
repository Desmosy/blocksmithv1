import { NextRequest, NextResponse } from "next/server";
import { getDefaultDocFileName, loadDesignSystem, prepareDesignSystemDoc } from "@/lib/clients/registry";
import { getBlockStoreIndex } from "@/lib/blocks/store";
import { getWorkspaceScanSyncStatus } from "@/lib/scan/sync-status";
import { getWatcherStatus, startWatcher } from "@/lib/sync/watcher";
import { isUploadDocRef, uploadFileNameFromRef } from "@/lib/uploads/store";
import { readUploadMarkdownContent } from "@/lib/uploads/persist";
import { resolveDocParam } from "@/lib/wiki/doc-param";

export const dynamic = "force-dynamic";

/**
 * GET /api/sync/status?doc=apollo.md
 * Watcher + block store status for Sync page and MCP parity.
 */
export async function GET(request: NextRequest) {
  startWatcher();

  const docParam = request.nextUrl.searchParams.get("doc");
  let docRef: string;
  try {
    docRef = resolveDocParam(docParam ?? undefined) ?? getDefaultDocFileName();
  } catch {
    return NextResponse.json({ error: "Invalid doc" }, { status: 400 });
  }

  const watcher = getWatcherStatus();
  const index = getBlockStoreIndex();

  let system: { name: string; contentHash?: string; updatedAt: string } | null =
    null;
  try {
    await prepareDesignSystemDoc(docRef);
    const s = loadDesignSystem(docRef);
    system = {
      name: s.name,
      contentHash: s.contentHash,
      updatedAt: s.updatedAt,
    };
  } catch {
    /* missing doc */
  }

  let workspaceScan = null;
  if (isUploadDocRef(docRef)) {
    try {
      const md = await readUploadMarkdownContent(
        uploadFileNameFromRef(docRef),
      );
      const s = getWorkspaceScanSyncStatus(md);
      if (s.isWorkspaceScan) workspaceScan = s;
    } catch {
      /* optional */
    }
  }

  return NextResponse.json({
    docRef,
    watcher,
    blockStore: {
      lastSyncAt: index.lastSyncAt,
      doc: index.docs[docRef] ?? null,
      systemContentHash: system?.contentHash,
    },
    system,
    workspaceScan,
  });
}
