import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/cloud/auth";
import { handleRemoteMcpRequest } from "@/lib/mcp/http-handler";

export const dynamic = "force-dynamic";

/** Pattern 3 — remote MCP (Streamable HTTP). Auth: Bearer bs_live_… */
export async function POST(request: NextRequest) {
  const auth = await requireApiKey(request);
  if (!auth.ok) return auth.response;
  try {
    return await handleRemoteMcpRequest(request);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "MCP error";
    console.error("[api/mcp]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireApiKey(request);
  if (!auth.ok) return auth.response;
  try {
    return await handleRemoteMcpRequest(request);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "MCP error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiKey(request);
  if (!auth.ok) return auth.response;
  try {
    return await handleRemoteMcpRequest(request);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "MCP error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
