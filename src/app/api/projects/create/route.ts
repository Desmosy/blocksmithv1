import { NextRequest, NextResponse } from "next/server";
import { createStarterProject } from "@/lib/dashboard/create";
import { generateDesignSystemFromPrompt } from "@/lib/dashboard/generate";
import { registerOwnedProject } from "@/lib/dashboard/ownership";
import { isNvidiaConfigured } from "@/lib/ai/nvidia";
import { getSupabaseUser } from "@/lib/auth/session";
import { saasStrictMode } from "@/lib/cloud/saas";
import {
  aiGenerateRateLimitForRequest,
  aiGenerateRateLimitForUser,
} from "@/lib/cloud/rate-limit";

export const dynamic = "force-dynamic";
/** AI generation can take a few seconds — give it headroom. */
export const maxDuration = 60;

/**
 * Create a new design system project from a name/prompt → editable wiki.
 * When `useAi` is set and a model is configured, generate real tokens/components
 * from the prompt; otherwise (or on any AI error) fall back to a blank starter.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { name?: string; useAi?: boolean };
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "Give the project a name." }, { status: 400 });
    }

    // Someone — often an agent — asking to "capture the design system from
    // example.com" here means capture, not "make a blank project with that
    // sentence as its name". Left alone this produces a starter scaffold whose
    // tokens have nothing to do with the site, which looks like a bad capture
    // rather than the wrong door.
    const site = name.match(/https?:\/\/[^\s)]+|(?:^|\s)((?:[a-z0-9-]+\.)+[a-z]{2,})(?=\s|$)/i);
    if (site && /\b(capture|import|copy|clone|from|scan|steal|like)\b/i.test(name)) {
      const url = (site[0].trim().startsWith("http") ? site[0].trim() : `https://${site[1] ?? site[0].trim()}`);
      return NextResponse.json(
        {
          error:
            `That looks like a request to capture ${url}, not a project name. ` +
            `Use the capture_site_design tool, or POST /api/webmcp/invoke with ` +
            `{"tool":"capture_site_design","args":{"url":"${url}"}}.`,
          suggestedTool: "capture_site_design",
          suggestedUrl: url,
        },
        { status: 400 },
      );
    }

    // Hosted mode: creating writes storage + (for AI) spends tokens — require sign-in.
    const user = await getSupabaseUser();
    if (saasStrictMode() && !user) {
      return NextResponse.json(
        { error: "Sign in to create projects." },
        { status: 401 },
      );
    }

    if (body.useAi && isNvidiaConfigured()) {
      const limited = user
        ? await aiGenerateRateLimitForUser(user.userId)
        : await aiGenerateRateLimitForRequest(request);
      if (!limited.ok) {
        return NextResponse.json(
          { error: `AI rate limit reached. Try again in ${limited.retryAfterSec}s.` },
          { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
        );
      }
      try {
        const created = await generateDesignSystemFromPrompt(name);
        await registerOwnedProject(created.fileName, created.docRef, "ai-generate");
        return NextResponse.json({ success: true, generated: true, ...created });
      } catch (aiErr) {
        // Never block the user on a flaky model — fall back to a blank starter.
        console.warn("[api/projects/create] AI generation failed, using starter", aiErr);
      }
    }

    const created = await createStarterProject(name);
    await registerOwnedProject(created.fileName, created.docRef, "create");
    return NextResponse.json({ success: true, generated: false, ...created });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not create project";
    console.error("[api/projects/create]", err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
