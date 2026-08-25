import { NextRequest, NextResponse } from "next/server";
import { resolveActor, actorUserId } from "@/lib/cloud/actor";
import { saasStrictMode } from "@/lib/cloud/saas";
import { ensureDefaultOrg, getMemberRole } from "@/lib/cloud/orgs";
import { roleAtLeast } from "@/lib/cloud/rbac";
import {
  approveDeviation,
  rejectDeviation,
  resolveDeviation,
  getGovernanceSettings,
} from "@/lib/cloud/deviations";

export const dynamic = "force-dynamic";

/** PATCH — pass, rollback, or resolve a deviation (admin/owner only for pass/rollback). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await resolveActor(request);
  if (!actor && saasStrictMode()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: { action?: string; fixSuggestion?: string };
  try {
    body = (await request.json()) as { action?: string; fixSuggestion?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action;
  if (!action || !["pass", "rollback", "resolve"].includes(action)) {
    return NextResponse.json(
      { error: "action must be pass, rollback, or resolve" },
      { status: 400 },
    );
  }

  // For pass/rollback, check the actor has review permissions
  if (action === "pass" || action === "rollback") {
    const userId = actor ? actorUserId(actor) : null;
    if (userId) {
      const login = actor?.kind === "user" ? actor.login : null;
      const org = await ensureDefaultOrg(userId, login);
      const settings = await getGovernanceSettings(org.id);
      const role = await getMemberRole(org.id, userId);
      if (role) {
        const minRole = settings.reviewRoles.includes("member")
          ? "member"
          : "admin";
        if (!roleAtLeast(role, minRole)) {
          return NextResponse.json(
            { error: `Your role (${role}) cannot review deviations. Need: ${settings.reviewRoles.join(" or ")}` },
            { status: 403 },
          );
        }
      }
    }
  }

  const reviewedBy =
    actor?.kind === "user"
      ? actor.login ?? "unknown"
      : actor?.kind === "apiKey"
        ? actor.label
        : "unknown";

  try {
    if (action === "pass") {
      await approveDeviation(id, reviewedBy);
    } else if (action === "rollback") {
      await rejectDeviation(id, reviewedBy, body.fixSuggestion);
    } else {
      await resolveDeviation(id);
    }
    return NextResponse.json({ ok: true, id, action });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 404 });
  }
}
