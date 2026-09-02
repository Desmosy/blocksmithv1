import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUser } from "@/lib/auth/session";
import { requireApiKey } from "@/lib/cloud/auth";
import { ensureDefaultOrg } from "@/lib/cloud/orgs";
import { resolveActor, actorUserId } from "@/lib/cloud/actor";
import { saasStrictMode } from "@/lib/cloud/saas";
import {
  createDeviation,
  listDeviations,
  countOpenDeviations,
  getGovernanceSettings,
} from "@/lib/cloud/deviations";
import type { DeviationStatus, DeviationDiff } from "@/lib/cloud/deviations";

export const dynamic = "force-dynamic";

/** POST — create a new deviation record (from CLI pre-push or CI). */
export async function POST(request: NextRequest) {
  // Accept both API key and session auth
  const actor = await resolveActor(request);
  if (!actor && saasStrictMode()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const docRef = String(body.docRef ?? "").trim();
  const blockId = String(body.blockId ?? "").trim();
  const pushedBy = String(body.pushedBy ?? "").trim();

  if (!docRef || !blockId || !pushedBy) {
    return NextResponse.json(
      { error: "docRef, blockId, and pushedBy are required" },
      { status: 400 },
    );
  }

  const deviationDiff = (body.deviationDiff as DeviationDiff) ?? {
    field: "unknown",
    wikiValue: "",
    pushedValue: "",
  };

  try {
  // Resolve org — use the actor's default org
  let orgId: string;
  if (body.orgId) {
    orgId = String(body.orgId);
  } else {
    const userId = actor ? actorUserId(actor) : null;
    const login =
      actor?.kind === "user" ? actor.login : pushedBy;
    if (userId) {
      const org = await ensureDefaultOrg(userId, login);
      orgId = org.id;
    } else {
      // Local dev / no auth — use a placeholder org
      orgId = "local";
    }
  }

  // Check budget before creating
  const settings = await getGovernanceSettings(orgId);
  const openCount = await countOpenDeviations(orgId, pushedBy);
  if (openCount >= settings.maxOpenPerDev) {
    return NextResponse.json(
      {
        error: "Budget exceeded",
        message: `You have ${openCount} unreviewed deviations (max: ${settings.maxOpenPerDev}). Resolve existing ones before pushing more. Run: blocksmith updates`,
        openCount,
        maxOpen: settings.maxOpenPerDev,
      },
      { status: 429 },
    );
  }

  const deviation = await createDeviation({
    orgId,
    docRef,
    blockId,
    pushedBy,
    deviationDiff,
    commitRef: body.commitRef ? String(body.commitRef) : undefined,
    prUrl: body.prUrl ? String(body.prUrl) : undefined,
    reason: body.reason ? String(body.reason) : undefined,
    ttlHours: settings.ttlHours,
  });

  return NextResponse.json({
    ok: true,
    deviation,
    budget: {
      used: openCount + 1,
      max: settings.maxOpenPerDev,
    },
    expiresIn: `${settings.ttlHours}h`,
  });
  } catch (err) {
    // The CLI needs a message it can print, not a bare 500.
    const message = err instanceof Error ? err.message : "Could not record the deviation.";
    console.error("[api/v1/deviations] create failed:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** GET — list deviations for the current org (wiki queue + CLI updates). */
export async function GET(request: NextRequest) {
  const actor = await resolveActor(request);
  if (!actor && saasStrictMode()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = request.nextUrl.searchParams.get("status") as DeviationStatus | null;
  const pushedBy = request.nextUrl.searchParams.get("pushedBy");
  const limit = Math.min(
    100,
    Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? 50) || 50),
  );

  // A queue that cannot be read renders as an empty queue with a note, not
  // as a 500 — this feeds a status panel, and the panel degrading beats the
  // console filling with server errors on every Sync page visit.
  try {
    // Resolve org
    let orgId: string;
    const reqOrgId = request.nextUrl.searchParams.get("orgId");
    if (reqOrgId) {
      orgId = reqOrgId;
    } else {
      const userId = actor ? actorUserId(actor) : null;
      const login = actor?.kind === "user" ? actor.login : null;
      if (userId) {
        const org = await ensureDefaultOrg(userId, login);
        orgId = org.id;
      } else {
        orgId = "local";
      }
    }

    const deviations = await listDeviations(orgId, {
      status: status ?? undefined,
      pushedBy: pushedBy ?? undefined,
      limit,
    });

    return NextResponse.json({ orgId, deviations });
  } catch (err) {
    console.error("[api/v1/deviations] list failed:", err);
    return NextResponse.json({
      orgId: null,
      deviations: [],
      error: "Deviation queue is unavailable right now.",
    });
  }
}
