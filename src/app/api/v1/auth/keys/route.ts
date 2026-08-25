import { NextRequest, NextResponse } from "next/server";
import { adminSecretOk, createApiKey, listApiKeys } from "@/lib/cloud/api-keys";

export const dynamic = "force-dynamic";

/** Create API keys (admin) or list prefixes. Requires BLOCKSMITH_ADMIN_SECRET header. */
export async function POST(request: NextRequest) {
  const admin = request.headers.get("x-blocksmith-admin-secret");
  if (!adminSecretOk(admin)) {
    return NextResponse.json(
      {
        error:
          "Forbidden — set BLOCKSMITH_ADMIN_SECRET on server and send X-BlockSmith-Admin-Secret",
      },
      { status: 403 },
    );
  }
  const body = (await request.json().catch(() => ({}))) as { label?: string };
  const { key, record } = createApiKey(body.label ?? "default");
  return NextResponse.json({
    key,
    id: record.id,
    prefix: record.prefix,
    label: record.label,
    createdAt: record.createdAt,
    hint: "Store the key now — it is not shown again. Use: Authorization: Bearer <key>",
  });
}

export async function GET(request: NextRequest) {
  const admin = request.headers.get("x-blocksmith-admin-secret");
  if (!adminSecretOk(admin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ keys: listApiKeys() });
}
