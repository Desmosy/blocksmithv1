import { NextResponse } from "next/server";
import { generateAiLayout } from "@/lib/ai/generate-layout";
import { isNvidiaConfigured } from "@/lib/ai/nvidia";
import { validateDocRef } from "@/lib/ai/resolve-design-doc";

export const runtime = "nodejs";
/** Hybrid default: one background LLM refine (~60–90s). Must be a static literal for Next.js. */
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    if (!isNvidiaConfigured()) {
      return NextResponse.json(
        {
          error:
            "NVIDIA_API_KEY not configured. Copy .env.example to .env.local and restart the dev server.",
        },
        { status: 503 },
      );
    }

    const body = await request.json();
    const docRef = validateDocRef(body.doc);

    const ensemble = await generateAiLayout(docRef);

    return NextResponse.json({
      ok: true,
      layout: ensemble.layout,
      source: docRef,
      summary: ensemble.layout.summary,
      ensemble: {
        models: ensemble.models,
        passes: ensemble.passes,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI layout failed";
    console.error("[api/ai/layout]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
