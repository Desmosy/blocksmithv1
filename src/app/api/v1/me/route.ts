import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/cloud/auth";

export const dynamic = "force-dynamic";

/** Pattern 2/4 — verify API key (CLI `blocksmith whoami`, SDK health check) */
export async function GET(request: NextRequest) {
  const auth = await requireApiKey(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({
    ok: true,
    key: auth.key,
    service: "blocksmith",
    version: "0.1.0",
  });
}
