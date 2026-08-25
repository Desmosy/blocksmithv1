import { NextResponse } from "next/server";
import { getSupabaseUser } from "@/lib/auth/session";
import {
  ensureDefaultOrg,
  listOrgMembers,
  listOrgsForUser,
} from "@/lib/cloud/orgs";

export const dynamic = "force-dynamic";

/** Current user's workspace org + members (auto-creates personal org). */
export async function GET() {
  const user = await getSupabaseUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in with GitHub to view your team." },
      { status: 401 },
    );
  }

  const org = await ensureDefaultOrg(user.userId, user.login);
  const members = await listOrgMembers(org.id);

  return NextResponse.json({
    org,
    members,
    login: user.login,
    email: user.email,
    currentUserId: user.userId,
  });
}
