import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUser } from "@/lib/auth/session";
import { authenticateApiKey } from "./api-keys";
import { bearerFromRequest } from "./auth";
import type { Actor } from "./types";

export async function resolveActor(
  request: Request | NextRequest,
): Promise<Actor | null> {
  const key = await authenticateApiKey(bearerFromRequest(request));
  if (key) {
    return {
      kind: "apiKey",
      userId: key.userId,
      keyId: key.id,
      prefix: key.prefix,
      label: key.label,
      isAdmin: key.isAdmin,
    };
  }

  const user = await getSupabaseUser();
  if (user) {
    return {
      kind: "user",
      userId: user.userId,
      login: user.login,
    };
  }

  return null;
}

export function actorUserId(actor: Actor): string | null {
  if (actor.kind === "user") return actor.userId;
  return actor.userId;
}

export async function requireActor(request: Request | NextRequest) {
  const actor = await resolveActor(request);
  if (!actor) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error:
            "Unauthorized — sign in with GitHub or provide Authorization: Bearer bs_live_…",
        },
        { status: 401 },
      ),
    };
  }
  return { ok: true as const, actor };
}
