import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "./api-keys";

export function bearerFromRequest(request: Request | NextRequest): string | null {
  const auth = request.headers.get("authorization")?.trim();
  if (!auth?.toLowerCase().startsWith("bearer ")) return null;
  return auth.slice(7).trim() || null;
}

export async function requireApiKey(request: Request | NextRequest) {
  const key = await authenticateApiKey(bearerFromRequest(request));
  if (!key) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Unauthorized — provide Authorization: Bearer bs_live_…" },
        { status: 401 },
      ),
    };
  }
  return { ok: true as const, key };
}
