import { NextResponse } from "next/server";
import { requireActor, actorUserId } from "@/lib/cloud/actor";
import { aiGenerateRateLimitForRequest, aiGenerateRateLimitForUser } from "@/lib/cloud/rate-limit";
import { proposeFigmaAnnotations } from "@/lib/ingest/capture";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}

export async function POST(request: Request) {
  const auth = await requireActor(request);
  if (!auth.ok) return auth.response;
  const ipLimit = await aiGenerateRateLimitForRequest(request);
  if (!ipLimit.ok) return NextResponse.json({ error: `Rate limited; retry in ${ipLimit.retryAfterSec}s` }, { status: 429, headers: cors });
  const userId = actorUserId(auth.actor);
  if (userId) {
    const userLimit = await aiGenerateRateLimitForUser(userId);
    if (!userLimit.ok) return NextResponse.json({ error: `Rate limited; retry in ${userLimit.retryAfterSec}s` }, { status: 429, headers: cors });
  }
  try {
    const body = (await request.json()) as {
      nodes?: Array<{ id: string; name: string; type: string; existingAnnotations?: string[] }>;
      images?: string[];
      projectContext?: string;
    };
    const result = await proposeFigmaAnnotations({
      nodes: Array.isArray(body.nodes) ? body.nodes : [],
      images: Array.isArray(body.images) ? body.images : undefined,
      projectContext: typeof body.projectContext === "string" ? body.projectContext.slice(0, 2000) : undefined,
    });
    return NextResponse.json(result, { headers: cors });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Proposal generation failed" }, { status: 400, headers: cors });
  }
}
