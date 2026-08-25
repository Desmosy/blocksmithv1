import { NextRequest, NextResponse } from "next/server";
import { resolveActor, actorUserId } from "@/lib/cloud/actor";
import { saasStrictMode } from "@/lib/cloud/saas";
import { ensureDefaultOrg } from "@/lib/cloud/orgs";
import {
  countOpenDeviations,
  countBlockRejections,
  getGovernanceSettings,
} from "@/lib/cloud/deviations";

export const dynamic = "force-dynamic";

/**
 * GET — check a developer's deviation budget before pushing.
 * Query: ?pushedBy=<login>&blockId=<optional>
 */
export async function GET(request: NextRequest) {
  const actor = await resolveActor(request);
  if (!actor && saasStrictMode()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pushedBy = request.nextUrl.searchParams.get("pushedBy")?.trim();
  if (!pushedBy) {
    return NextResponse.json(
      { error: "pushedBy query param is required" },
      { status: 400 },
    );
  }

  // Resolve org
  let orgId: string;
  const reqOrgId = request.nextUrl.searchParams.get("orgId");
  if (reqOrgId) {
    orgId = reqOrgId;
  } else {
    const userId = actor ? actorUserId(actor) : null;
    const login = actor?.kind === "user" ? actor.login : pushedBy;
    if (userId) {
      const org = await ensureDefaultOrg(userId, login);
      orgId = org.id;
    } else {
      orgId = "local";
    }
  }

  const settings = await getGovernanceSettings(orgId);
  const openCount = await countOpenDeviations(orgId, pushedBy);

  const result: Record<string, unknown> = {
    pushedBy,
    openCount,
    maxOpen: settings.maxOpenPerDev,
    remaining: Math.max(0, settings.maxOpenPerDev - openCount),
    budgetExceeded: openCount >= settings.maxOpenPerDev,
  };

  // If a specific block is queried, check rejection escalation too
  const blockId = request.nextUrl.searchParams.get("blockId")?.trim();
  if (blockId) {
    const rejections = await countBlockRejections(orgId, blockId, pushedBy);
    result.blockId = blockId;
    result.rejections = rejections;
    result.blockLocked = rejections >= settings.rejectionsBeforeBlock;
    result.rejectionsBeforeBlock = settings.rejectionsBeforeBlock;
  }

  return NextResponse.json(result);
}
