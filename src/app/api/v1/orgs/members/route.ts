import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUser } from "@/lib/auth/session";
import { ensureDefaultOrg, removeOrgMember } from "@/lib/cloud/orgs";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest) {
  const user = await getSupabaseUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memberId = request.nextUrl.searchParams.get("id")?.trim();
  if (!memberId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const org = await ensureDefaultOrg(user.userId, user.login);
    await removeOrgMember(org.id, user.userId, memberId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Remove failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
