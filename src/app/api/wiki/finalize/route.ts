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
  hydrateUploadMarkdown,
  persistUploadMarkdown,
  readUploadMarkdownContent,
} from "@/lib/uploads/persist";
import { clearDesignSystemCache } from "@/lib/clients/registry";
import { modifyMarkdownBlock } from "@/lib/parser/modify";
import { getWorkspaceRootFromMarkdown } from "@/lib/scan/parse";
import { setComponentOverride } from "@/lib/scan/overrides";
import { setUploadComponentOverride } from "@/lib/scan/upload-overrides";
import { requireDocumentAccess } from "@/lib/cloud/access";
import { refreshBlocksForDoc } from "@/lib/blocks/refresh";
import { syncLockToCloud, syncRegistryToCloud } from "@/lib/ir/cloud-registry";
import { getBlockHistory, promoteBlock } from "@/lib/ir/registry";
import { writeReferenceLock } from "@/lib/ir/lock";
import { checkRateLimit, clientIp } from "@/lib/cloud/rate-limit";

const DESIGNS_ROOT = join(process.cwd(), "docs/designs.md");

function safeResolveRepoDoc(fileName: string): string {
  const normalized = normalize(fileName).replace(/^(\.\.(\/|\\|$))+/, "");
  if (normalized.includes("..") || normalized.includes("/") || normalized.includes("\\")) {
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
    const fileName = uploadFileNameFromRef(docRef);
    return resolveUploadPath(fileName);
  }
  return safeResolveRepoDoc(docRef);
}

export async function POST(request: NextRequest) {
  try {
    const { doc, blockId, updatedData, baseContentHash, force, promote, create } =
      await request.json();

    if (typeof doc !== "string" || !doc.trim()) {
      return NextResponse.json(
        { error: "Document name 'doc' is required" },
        { status: 400 },
      );
    }
    if (typeof blockId !== "string" || !blockId.trim()) {
      return NextResponse.json(
        { error: "Block ID 'blockId' is required" },
        { status: 400 },
      );
    }

    const rl = await checkRateLimit(
      `pipeline:write:${clientIp(request)}`,
      Number(process.env.BLOCKSMITH_PIPELINE_RATE_LIMIT ?? 120),
      10 * 60_000,
    );
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Too many edits — try again in ${rl.retryAfterSec}s.` },
        { status: 429 },
      );
    }
    if (!updatedData) {
      return NextResponse.json(
        { error: "Updated data 'updatedData' is required" },
        { status: 400 },
      );
    }

    const upload = isUploadDocRef(doc);
    const fileName = upload ? uploadFileNameFromRef(doc) : null;

    if (upload && fileName) {
      const access = await requireDocumentAccess(request, fileName);
      if (!access.ok) return access.response;
    }

    const currentMd = upload
      ? await readUploadMarkdownContent(fileName!)
      : readFileSync(resolveDocFile(doc), "utf-8");

    // Check for conflict
    const currentHash = createHash("sha256")
      .update(currentMd)
      .digest("hex")
      .slice(0, 16);

    if (baseContentHash && currentHash !== baseContentHash && !force) {
      return NextResponse.json(
        {
          error: "Conflict",
          message:
            "This document has been modified in the IDE since you started editing.",
          currentHash,
        },
        { status: 409 },
      );
    }

    // Apply the changes to the markdown content
    // `create` is explicit: adding a block is a different intent from editing
    // one, and inferring it from a missing slug would turn a typo into a
    // near-duplicate component.
    const modifiedMd = modifyMarkdownBlock(currentMd, blockId, updatedData, {
      create: create === true,
    });

    if (upload && fileName) {
      await persistUploadMarkdown(fileName, modifiedMd);
    } else {
      writeFileSync(resolveDocFile(doc), modifiedMd, "utf-8");
    }

    // Workspace-scan: persist human prose (cloud sidecar + optional local vendor tree)
    if (
      blockId.startsWith("component:") &&
      /blocksmith-source:\s*workspace-scan/i.test(currentMd)
    ) {
      const componentId = blockId.replace(/^component:/, "");
      const role =
        typeof updatedData.role === "string" ? updatedData.role : "";
      const description =
        typeof updatedData.description === "string"
          ? updatedData.description
          : "";

      if (upload && fileName) {
        await setUploadComponentOverride(fileName, componentId, {
          role,
          description,
        });
      }

      const workspaceRoot = getWorkspaceRootFromMarkdown(currentMd);
      if (workspaceRoot) {
        const { isAllowedServerWorkspacePath } = await import("@/lib/scan/service");
        if (isAllowedServerWorkspacePath(workspaceRoot)) {
          setComponentOverride(workspaceRoot, componentId, { role, description });
        }
      }
    }

    // Clear server-side cache
    clearDesignSystemCache();

    // SAVE TO STAGING: a human edit re-ingests as editedBy "web", which
    // records a new DRAFT version. Production (and the lock, and agents)
    // stay untouched until someone promotes on Pipeline — that separation
    // is the product. `promote: true` is the explicit one-step escape hatch.
    const promoteNow = promote === true;
    let promotion: {
      stagedVersion?: number;
      promotedVersion?: number;
      lockHash?: string;
    } = {};
    let stagingError: string | undefined;
    try {
      refreshBlocksForDoc(doc, "web");
      const history = getBlockHistory(doc, blockId);
      promotion.stagedVersion =
        history?.versions[history.versions.length - 1]?.version;
      if (promoteNow) {
        const promoted = promoteBlock(doc, blockId);
        const { lock } = writeReferenceLock(doc);
        promotion.promotedVersion = promoted.ok ? promoted.version : undefined;
        promotion.lockHash = lock.contentHash;
        // Lock must reach Supabase before response (survives lambda freeze).
        await syncLockToCloud(doc, lock);
      }
      await syncRegistryToCloud(doc);
    } catch (err) {
      stagingError =
        err instanceof Error ? err.message : "Staging registry update failed";
      console.warn("[api/wiki/finalize] staging skipped:", err);
    }

    // Recompute hash for response
    const newHash = createHash("sha256")
      .update(modifiedMd)
      .digest("hex")
      .slice(0, 16);

    const stagedOk = promotion.stagedVersion != null && !stagingError;
    return NextResponse.json({
      success: true,
      contentHash: newHash,
      staged: stagedOk,
      stagedVersion: promotion.stagedVersion,
      promotedVersion: promotion.promotedVersion,
      lockHash: promotion.lockHash,
      stagingError,
      pipelineUrl: `/wiki/pipeline?doc=${encodeURIComponent(doc)}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Finalization failed";
    console.error("[api/wiki/finalize]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
