import { NextRequest, NextResponse } from "next/server";
import { buildWebMcpManifest } from "@/lib/webmcp/manifest";
import { corsPreflight, withCors } from "@/lib/webmcp/cors";

export const dynamic = "force-dynamic";

/**
 * GET /.well-known/webmcp.json (rewritten here) — the discovery manifest.
 *
 * Public and cross-origin: discovery that needs a login is not discovery.
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const res = NextResponse.json(buildWebMcpManifest(origin), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
  return withCors(res);
}

export async function OPTIONS() {
  return corsPreflight();
}
