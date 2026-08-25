import { NextRequest, NextResponse } from "next/server";
import { generateDesignSystemFromImage } from "@/lib/dashboard/vision-generate";
import { registerOwnedProject } from "@/lib/dashboard/ownership";
import { isNvidiaConfigured } from "@/lib/ai/nvidia";
import { getSupabaseUser } from "@/lib/auth/session";
import { saasStrictMode } from "@/lib/cloud/saas";
import {
  aiGenerateRateLimitForRequest,
  aiGenerateRateLimitForUser,
} from "@/lib/cloud/rate-limit";

export const dynamic = "force-dynamic";
/** Vision inference can take several seconds. */
export const maxDuration = 90;

const MAX_DATA_URL = 8_000_000; // ~6MB image once base64-encoded

/** Generate a design system from a UI screenshot. Body: { image: dataUrl }. */
export async function POST(request: NextRequest) {
  try {
    if (!isNvidiaConfigured()) {
      return NextResponse.json(
        { error: "AI is not configured on this server." },
        { status: 503 },
      );
    }

    const user = await getSupabaseUser();
    if (saasStrictMode() && !user) {
      return NextResponse.json(
        { error: "Sign in to use AI generation." },
        { status: 401 },
      );
    }
    const limited = user
      ? await aiGenerateRateLimitForUser(user.userId)
      : await aiGenerateRateLimitForRequest(request);
    if (!limited.ok) {
      return NextResponse.json(
        { error: `AI rate limit reached. Try again in ${limited.retryAfterSec}s.` },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
      );
    }
    const body = (await request.json()) as { image?: string };
    const image = body.image?.trim();
    if (!image || !/^data:image\/(png|jpe?g|webp);base64,/.test(image)) {
      return NextResponse.json(
        { error: "Provide a PNG, JPEG, or WebP screenshot." },
        { status: 400 },
      );
    }
    if (image.length > MAX_DATA_URL) {
      return NextResponse.json(
        { error: "Image is too large — use a smaller screenshot (under ~6MB)." },
        { status: 413 },
      );
    }

    const created = await generateDesignSystemFromImage(image);
    await registerOwnedProject(created.fileName, created.docRef, "vision-generate");
    return NextResponse.json({ success: true, ...created });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not read that image";
    console.error("[api/projects/generate-image]", err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
