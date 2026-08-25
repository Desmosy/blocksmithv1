import { NextRequest, NextResponse } from "next/server";
import {
  isUploadDocRef,
  uploadFileNameFromRef,
} from "@/lib/uploads/store";
import { readUploadMarkdownContent } from "@/lib/uploads/persist";
import { getWorkspaceScanSyncStatus } from "@/lib/scan/sync-status";

export async function GET(request: NextRequest) {
  try {
    const doc =
      request.nextUrl.searchParams.get("doc")?.trim() ||
      process.env.BLOCKSMITH_DOC?.trim();
    if (!doc) {
      return NextResponse.json({ error: "doc query required" }, { status: 400 });
    }

    if (!isUploadDocRef(doc)) {
      return NextResponse.json(
        { error: "Scan status only supports upload: scan docs" },
        { status: 400 },
      );
    }
    const md = await readUploadMarkdownContent(uploadFileNameFromRef(doc));
    const status = getWorkspaceScanSyncStatus(md);

    return NextResponse.json({ docRef: doc, ...status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "scan-status failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
