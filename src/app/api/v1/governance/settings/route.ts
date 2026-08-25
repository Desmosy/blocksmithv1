import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUser } from "@/lib/auth/session";
import { ensureDefaultOrg, getMemberRole } from "@/lib/cloud/orgs";
import { roleAtLeast } from "@/lib/cloud/rbac";
import {
  getGovernanceSettings,
  updateGovernanceSettings,
} from "@/lib/cloud/deviations";
import type { GovernanceSettingsUpdate } from "@/lib/cloud/deviations";

export const dynamic = "force-dynamic";

/** GET — read governance settings for the current org. */
export async function GET() {
  const user = await getSupabaseUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const org = await ensureDefaultOrg(user.userId, user.login);
  const settings = await getGovernanceSettings(org.id);

  return NextResponse.json({ org: { id: org.id, name: org.name }, settings });
}

/** PATCH — update governance settings (admin/owner only). */
export async function PATCH(request: NextRequest) {
  const user = await getSupabaseUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const org = await ensureDefaultOrg(user.userId, user.login);
  const role = await getMemberRole(org.id, user.userId);
  if (!role || !roleAtLeast(role, "admin")) {
    return NextResponse.json(
      { error: "Only admins and owners can change governance settings." },
      { status: 403 },
    );
  }

  let body: GovernanceSettingsUpdate;
  try {
    body = (await request.json()) as GovernanceSettingsUpdate;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate bounds
  if (body.ttlHours !== undefined) {
    if (body.ttlHours < 1 || body.ttlHours > 720) {
      return NextResponse.json(
        { error: "ttlHours must be between 1 and 720 (30 days)" },
        { status: 400 },
      );
    }
  }
  if (body.maxOpenPerDev !== undefined) {
    if (body.maxOpenPerDev < 1 || body.maxOpenPerDev > 50) {
      return NextResponse.json(
        { error: "maxOpenPerDev must be between 1 and 50" },
        { status: 400 },
      );
    }
  }
  if (body.rejectionsBeforeBlock !== undefined) {
    if (body.rejectionsBeforeBlock < 1 || body.rejectionsBeforeBlock > 10) {
      return NextResponse.json(
        { error: "rejectionsBeforeBlock must be between 1 and 10" },
        { status: 400 },
      );
    }
  }

  const settings = await updateGovernanceSettings(org.id, body);
  return NextResponse.json({ ok: true, settings });
}
