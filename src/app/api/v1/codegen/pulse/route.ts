import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/cloud/auth";
import { runPulseCodegen } from "@/lib/codegen/run";

export const dynamic = "force-dynamic";

/** Pattern 2/4 — generate @blocksmith/<slug> from workspace-scan doc */
export async function POST(request: NextRequest) {
  const auth = await requireApiKey(request);
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json().catch(() => ({}))) as { doc?: string };
    const result = await runPulseCodegen(body.doc);
    const origin = new URL(request.url).origin;

    return NextResponse.json({
      ...result,
      demoUrl: `${origin}${result.demoUrl}`,
      nextSteps: [
        `npm run build -w ${result.packageName}`,
        `open ${origin}${result.demoUrl}`,
      ],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Codegen failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
