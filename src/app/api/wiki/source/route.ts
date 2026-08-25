import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync } from "fs";
import { join, normalize, relative } from "path";
import { createHash } from "crypto";
import {
  isUploadDocRef,
  uploadFileNameFromRef,
  resolveUploadPath,
} from "@/lib/uploads/store";
import {
  persistUploadMarkdown,
  readUploadMarkdownContent,
} from "@/lib/uploads/persist";
import { clearDesignSystemCache } from "@/lib/clients/registry";
import { requireDocumentAccess } from "@/lib/cloud/access";
import { refreshBlocksForDoc } from "@/lib/blocks/refresh";
import { getSectionBody } from "@/lib/parser/sections";

export const dynamic = "force-dynamic";

const DESIGNS_ROOT = join(process.cwd(), "docs/designs.md");

function safeResolveRepoDoc(fileName: string): string {
  const normalized = normalize(fileName).replace(/^(\.\.(\/|\\|$))+/, "");
  if (
    normalized.includes("..") ||
    normalized.includes("/") ||
    normalized.includes("\\")
  ) {
    throw new Error("Invalid document name");
  }
  if (!normalized.toLowerCase().endsWith(".md")) {
    throw new Error("Only .md files are supported");
  }
  const full = join(DESIGNS_ROOT, normalized);
  const rel = relative(DESIGNS_ROOT, full);
  if (rel.startsWith("..") || rel.includes("..")) {
    throw new Error("Path escapes designs directory");
  }
  return full;
}

function resolveDocFile(docRef: string): string {
  if (isUploadDocRef(docRef)) {
    return resolveUploadPath(uploadFileNameFromRef(docRef));
  }
  return safeResolveRepoDoc(docRef);
}

function hashOf(md: string): string {
  return createHash("sha256").update(md).digest("hex").slice(0, 16);
}

async function readDoc(docRef: string): Promise<string> {
  if (isUploadDocRef(docRef)) {
    return readUploadMarkdownContent(uploadFileNameFromRef(docRef));
  }
  return readFileSync(resolveDocFile(docRef), "utf-8");
}

/** GET /api/wiki/source?doc=… → full markdown + content hash for the editor. */
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
    const content = await readDoc(doc);
    const contentHash = hashOf(content);

    // ?section=<slug> → just that section's body, for the per-section editor.
    const section = request.nextUrl.searchParams.get("section");
    if (section) {
      const sectionText = getSectionBody(content, section);
      if (sectionText == null) {
        return NextResponse.json(
          { error: `Section '${section}' not found` },
          { status: 404 },
        );
      }
      return NextResponse.json({ doc, section, sectionText, contentHash });
    }

    return NextResponse.json({ doc, content, contentHash });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read source" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/wiki/source — write the entire markdown file, then re-ingest as
 * staging (editedBy "web"). Same conflict semantics as finalize: a mismatched
 * baseContentHash returns 409 unless `force` is set. Never auto-promotes —
 * production/agents stay on the current lock until someone promotes on Pipeline.
 */
export async function POST(request: NextRequest) {
  try {
    const { doc, content, baseContentHash, force } = await request.json();

    if (typeof doc !== "string" || !doc.trim()) {
      return NextResponse.json({ error: "'doc' is required" }, { status: 400 });
    }
    if (typeof content !== "string") {
      return NextResponse.json(
        { error: "'content' is required" },
        { status: 400 },
      );
    }

    const upload = isUploadDocRef(doc);
    if (upload) {
      const access = await requireDocumentAccess(
        request,
        uploadFileNameFromRef(doc),
      );
      if (!access.ok) return access.response;
    }

    const currentMd = await readDoc(doc);
    const currentHash = hashOf(currentMd);
    if (baseContentHash && currentHash !== baseContentHash && !force) {
      return NextResponse.json(
        {
          error: "Conflict",
          message:
            "This document has been modified since you started editing. Reload or overwrite.",
          currentHash,
        },
        { status: 409 },
      );
    }

    if (upload) {
      await persistUploadMarkdown(uploadFileNameFromRef(doc), content);
    } else {
      writeFileSync(resolveDocFile(doc), content, "utf-8");
    }

    clearDesignSystemCache();
    try {
      refreshBlocksForDoc(doc, "web");
    } catch (err) {
      // Markdown write already succeeded; staging refresh is best-effort.
      console.warn("[api/wiki/source] staging skipped:", err);
    }

    return NextResponse.json({
      success: true,
      staged: true,
      contentHash: hashOf(content),
    });
  } catch (err) {
    console.error("[api/wiki/source]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Save failed" },
      { status: 500 },
    );
  }
}
