import { NextResponse } from "next/server";
import {
  clearDesignSystemCache,
  loadDesignSystem,
  prepareDesignSystemDoc,
} from "@/lib/clients/registry";
import { getSupabaseUser } from "@/lib/auth/session";
import { registerDocument } from "@/lib/cloud/documents";
import { ensureDefaultOrg } from "@/lib/cloud/orgs";
import { saasStrictMode } from "@/lib/cloud/saas";
import {
  aiGenerateRateLimitForRequest,
  aiGenerateRateLimitForUser,
} from "@/lib/cloud/rate-limit";
import { saveMarkdownUpload, isUploadDocRef, uploadFileNameFromRef, readUploadMarkdown } from "@/lib/uploads/store";
import { persistUploadMarkdown } from "@/lib/uploads/persist";
import { requireDocumentAccess } from "@/lib/cloud/access";
import { wikiUrlForDoc } from "@/lib/uploads/doc-ref";
import { hrefWithDoc } from "@/lib/wiki/doc-param";
import {
  extractDesignMarkdownFromImages,
  isCaptureConfigured,
} from "@/lib/ingest/capture";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/ingest/capture — design-first ingest from the browser extension.
 *
 * Body: { images: string[] (data URLs, ≤4), sourceUrl?: string, title?: string }
 *
 * Screenshot(s) of a design (Canva, Figma, Adobe, any tab) → vision model →
 * Style Reference design.md → existing upload pipeline → wiki URL. Captured
 * values are visual estimates: docs enter as previews/drafts, never straight
 * into a lock — the human still promotes.
 */
export async function POST(request: Request) {
  try {
    if (!isCaptureConfigured()) {
      return NextResponse.json(
        {
          error:
            "Capture ingest is not enabled on this deployment (vision model not configured).",
        },
        { status: 503 },
      );
    }

    const user = await getSupabaseUser();
    if (saasStrictMode() && !user) {
      return NextResponse.json(
        { error: "Sign in to BlockSmith in this browser, then capture again." },
        { status: 401 },
      );
    }

    // Vision calls are real LLM spend — reuse the AI limits.
    const ipLimit = await aiGenerateRateLimitForRequest(request);
    if (!ipLimit.ok) {
      return NextResponse.json(
        { error: `Too many captures — try again in ${ipLimit.retryAfterSec}s.` },
        { status: 429 },
      );
    }
    if (user) {
      const userLimit = await aiGenerateRateLimitForUser(user.userId);
      if (!userLimit.ok) {
        return NextResponse.json(
          { error: `Too many captures — try again in ${userLimit.retryAfterSec}s.` },
          { status: 429 },
        );
      }
    }

    const body = (await request.json()) as {
      images?: unknown;
      sourceUrl?: string;
      title?: string;
      targetDoc?: string;
    };

    const { markdown, model } = await extractDesignMarkdownFromImages({
      images: (body.images ?? []) as string[],
      sourceUrl: typeof body.sourceUrl === "string" ? body.sourceUrl : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
    });

    const baseName = (body.title || "captured-design")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    let saved;
    const targetDoc = typeof body.targetDoc === "string" ? body.targetDoc.trim() : "";
    if (targetDoc) {
      if (!isUploadDocRef(targetDoc)) {
        return NextResponse.json({ error: "Capture enrichment target must be an upload: document reference." }, { status: 400 });
      }
      const targetFile = uploadFileNameFromRef(targetDoc);
      const access = await requireDocumentAccess(request, targetFile, "write");
      if (!access.ok) return access.response;
      const existing = await readUploadMarkdown(targetDoc);
      if (!/workspace-root:\s*figma:\/\//i.test(existing)) {
        return NextResponse.json({ error: "Capture enrichment currently requires a Figma connector document." }, { status: 400 });
      }
      const appendix = [
        "## Supplemental Capture Evidence",
        "",
        "> Vision-derived observations below are estimates. Exact Figma tree values above remain authoritative.",
        "",
        markdown,
        "",
        `<!-- blocksmith:supplemental-capture target=${targetDoc} -->`,
      ].join("\n");
      const merged = `${existing.trimEnd()}\n\n${appendix.trim()}\n`;
      const persisted = await persistUploadMarkdown(targetFile, merged);
      saved = { docRef: targetDoc, fileName: targetFile, label: targetFile.replace(/\.md$/, ""), bytes: persisted.bytes, savedAt: persisted.savedAt };
    } else {
      saved = await saveMarkdownUpload(markdown, `capture-${baseName || "design"}.md`);
    }

    if (user && !targetDoc) {
      const org = await ensureDefaultOrg(user.userId, user.login);
      await registerDocument({
        fileName: saved.fileName,
        docRef: saved.docRef,
        ownerUserId: user.userId,
        orgId: org.id,
        scanMode: "import",
      });
    }
    clearDesignSystemCache();
    await prepareDesignSystemDoc(saved.docRef);
    const system = loadDesignSystem(saved.docRef);

    // Extension requests send Origin: chrome-extension://… — never use that.
    const headerOrigin = request.headers.get("origin");
    const origin = headerOrigin?.startsWith("http")
      ? headerOrigin
      : new URL(request.url).origin;
    const base = origin.replace(/\/$/, "");
    return NextResponse.json({
      ...saved,
      // A capture is a DRAFT PROJECT until a human reviews and confirms it in
      // the wiki — it is not assumed to be the source of truth.
      status: "draft",
      enrichedExisting: Boolean(targetDoc),
      wikiUrl: `${base}${wikiUrlForDoc(saved.docRef)}`,
      reviewUrl: `${base}${hrefWithDoc("/wiki/source", saved.docRef)}`,
      model,
      systemName: system.name,
      stats: {
        colors: system.colors.length,
        typography: system.typography.length,
        components: system.components.length,
      },
    });
  } catch (err) {
    console.error("[api/ingest/capture]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Capture ingest failed" },
      { status: 500 },
    );
  }
}
