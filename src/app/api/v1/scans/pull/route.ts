import { NextRequest, NextResponse } from "next/server";
import { requireDocumentAccess } from "@/lib/cloud/access";
import { requireApiKey } from "@/lib/cloud/auth";
import { getWorkspaceRootFromMarkdown } from "@/lib/scan/parse";
import {
  pullOverridesPayload,
  readUploadWikiOverrides,
} from "@/lib/scan/upload-overrides";
import { readUploadMarkdownContent } from "@/lib/uploads/persist";
import {
  isUploadDocRef,
  uploadFileNameFromRef,
} from "@/lib/uploads/store";
import { ensureDocBlocks } from "@/lib/blocks/refresh";
import { buildLock } from "@/lib/ir/lock";
import {
  loadDesignSystem,
  prepareDesignSystemDoc,
} from "@/lib/clients/registry";
import { generateDesignSystemMarkdown } from "@/lib/wiki/export-markdown";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiKey(request);
  if (!auth.ok) return auth.response;

  const docParam = request.nextUrl.searchParams.get("docRef");
  if (!docParam) {
    return NextResponse.json({ error: "Missing docRef parameter" }, { status: 400 });
  }

  if (!isUploadDocRef(docParam)) {
    return NextResponse.json(
      { error: "Pull only supports upload: scan docs (workspace scans)." },
      { status: 400 },
    );
  }

  try {
    const fileName = uploadFileNameFromRef(docParam);
    const access = await requireDocumentAccess(request, fileName, "write");
    if (!access.ok) return access.response;

    const stored = await readUploadWikiOverrides(fileName);
    const overrides = pullOverridesPayload(stored);
    const md = await readUploadMarkdownContent(fileName);
    const suggestedWorkspace =
      getWorkspaceRootFromMarkdown(md) ?? undefined;

    // Full DESIGN.md: the complete wiki content (tokens, every component,
    // surfaces, guidelines, agent guide) with human-finalized governance
    // merged in — not a per-component delta. This is what the repo gets.
    let fullMarkdown: string | null = null;
    let systemName: string | undefined;
    let stats:
      | { components: number; colors: number; typography: number; surfaces: number }
      | undefined;
    try {
      await prepareDesignSystemDoc(docParam);
      const system = loadDesignSystem(docParam);
      fullMarkdown = generateDesignSystemMarkdown(system, overrides);
      systemName = system.name;
      stats = {
        components: system.components.length,
        colors: system.colors.length,
        typography: system.typography.length,
        surfaces: system.surfaces.length,
      };
    } catch (err) {
      console.warn("[api/v1/scans/pull] full export skipped:", err);
    }

    // Design CI/CD: pull delivers the lock alongside DESIGN.md so the repo
    // pins exactly the block versions a human promoted in the wiki.
    let lock = null;
    try {
      ensureDocBlocks(docParam);
      lock = buildLock(docParam);
    } catch (err) {
      console.warn("[api/v1/scans/pull] lock build skipped:", err);
    }

    return NextResponse.json({
      docRef: docParam,
      overrides,
      finalizedCount: Object.keys(overrides).length,
      suggestedWorkspace,
      fullMarkdown,
      systemName,
      stats,
      lock,
    });
  } catch (err) {
    console.error("[api/v1/scans/pull]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to pull scan data" },
      { status: 500 },
    );
  }
}
