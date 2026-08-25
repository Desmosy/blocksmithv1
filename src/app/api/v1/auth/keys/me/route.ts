import { NextRequest, NextResponse } from "next/server";
import {
  createApiKeyForUser,
  listApiKeysForUser,
  revokeApiKey,
} from "@/lib/cloud/api-keys";
import { getSupabaseUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Self-serve API keys for signed-in GitHub users (CLI pull / scan / MCP). */
export async function GET() {
  const user = await getSupabaseUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in with GitHub to manage API keys." },
      { status: 401 },
    );
  }

  const keys = await listApiKeysForUser(user.userId);
  return NextResponse.json({ keys, login: user.login });
}

export async function POST(request: NextRequest) {
  const user = await getSupabaseUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in with GitHub to create an API key." },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { label?: string };
    const { key, record } = await createApiKeyForUser(
      body.label ?? `${user.login ?? "cli"}-key`,
      user.userId,
    );

    return NextResponse.json({
      key,
      id: record.id,
      prefix: record.prefix,
      label: record.label,
      createdAt: record.createdAt,
      hint: "Copy now — shown once. Use: blocksmith login --key <key> --url <your-app>",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Create failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getSupabaseUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keyId = request.nextUrl.searchParams.get("id")?.trim();
  if (!keyId) {
    return NextResponse.json({ error: "Missing id query param" }, { status: 400 });
  }

  const ok = await revokeApiKey(keyId, user.userId);
  if (!ok) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
