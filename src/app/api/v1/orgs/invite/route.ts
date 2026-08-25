import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUser } from "@/lib/auth/session";
import { ensureDefaultOrg, inviteOrgMember } from "@/lib/cloud/orgs";
import type { OrgRole } from "@/lib/cloud/rbac";
import { ORG_ROLES } from "@/lib/cloud/rbac";
import { sendOrgInvite } from "@/lib/email/send-org-invite";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getSupabaseUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    role?: OrgRole;
  };

  const email = body.email?.trim();
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const role = body.role ?? "member";
  if (!ORG_ROLES.includes(role) || role === "owner") {
    return NextResponse.json(
      { error: "role must be admin, member, or viewer" },
      { status: 400 },
    );
  }

  try {
    const org = await ensureDefaultOrg(user.userId, user.login);
    const member = await inviteOrgMember(org.id, user.userId, email, role);
    const delivery = await sendOrgInvite({ email, orgName: org.name, role });
    return NextResponse.json({
      ok: true,
      member,
      delivery,
      hint: delivery.delivered
        ? "Invite email sent. They gain access when they sign in with GitHub using that email."
        : "Invite saved. Configure RESEND_API_KEY to deliver email automatically.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invite failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
