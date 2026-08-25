import { NextResponse } from "next/server";
import { isNvidiaConfigured } from "@/lib/ai/nvidia";
import { requireDocumentAccess } from "@/lib/cloud/access";
import { isUploadDocRef, uploadFileNameFromRef } from "@/lib/uploads/store";
import { getSupabaseUser } from "@/lib/auth/session";
import {
  aiGenerateRateLimitForRequest,
  aiGenerateRateLimitForUser,
} from "@/lib/cloud/rate-limit";
import {
  runGovernedGenerate,
  normalizePrompt,
} from "@/lib/ai/governed-generate";

export const runtime = "nodejs";
/** Two parallel LLM completions — allow headroom on cold serverless. */
export const maxDuration = 120;

/**
 * POST { doc, prompt } → governed-vs-ungoverned generation with real,
 * engine-scored drift. Tenant-safe (access-gated on the doc), rate-limited
 * (LLM spend), and degrades to 503 when no model is configured so the client
 * can fall back to the static sample.
 */
export async function POST(request: Request) {
  try {
    if (!isNvidiaConfigured()) {
      return NextResponse.json(
        {
          error: "AI generation is not configured on this server.",
          code: "not_configured",
        },
        { status: 503 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const doc = typeof body.doc === "string" ? body.doc.trim() : "";
    if (!doc) {
      return NextResponse.json({ error: "Missing doc." }, { status: 400 });
    }
    let prompt: string;
    try {
      prompt = normalizePrompt(body.prompt);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Invalid prompt." },
        { status: 400 },
      );
    }

    // Tenant scoping: you may only generate against a design system you can
    // read. Public demo/sample docs pass; private docs require access.
    if (isUploadDocRef(doc)) {
      const access = await requireDocumentAccess(
        request,
        uploadFileNameFromRef(doc),
        "read",
      );
      if (!access.ok) return access.response;
    }

    // Rate limit: per-IP always; tighter-but-larger per-user when signed in.
    const ipLimit = await aiGenerateRateLimitForRequest(request);
    if (!ipLimit.ok) {
      return NextResponse.json(
        { error: "Rate limit reached — try again shortly.", code: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSec) } },
      );
    }
    const user = await getSupabaseUser().catch(() => null);
    if (user) {
      const userLimit = await aiGenerateRateLimitForUser(user.userId);
      if (!userLimit.ok) {
        return NextResponse.json(
          { error: "Rate limit reached — try again shortly.", code: "rate_limited" },
          {
            status: 429,
            headers: { "Retry-After": String(userLimit.retryAfterSec) },
          },
        );
      }
    }

    const result = await runGovernedGenerate(doc, prompt);
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Generation failed.";
    console.error("[api/ai/governed-generate]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
