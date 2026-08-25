import "server-only";

import { NextResponse } from "next/server";
import { canAccessDocument } from "./documents";
import { actorUserId, resolveActor } from "./actor";
import type { DocAction } from "./rbac";
import { saasStrictMode } from "./saas";

export async function requireDocumentAccess(
  request: Request,
  fileName: string,
  action: DocAction = "write",
): Promise<
  | { ok: true; userId: string | null; isAdmin: boolean }
  | { ok: false; response: Response }
> {
  if (!saasStrictMode()) {
    return { ok: true, userId: null, isAdmin: true };
  }

  const actor = await resolveActor(request);
  if (!actor) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "Unauthorized — sign in or use an API key to access this document.",
        },
        { status: 401 },
      ),
    };
  }

  const userId = actorUserId(actor);
  const isAdmin = actor.kind === "apiKey" && actor.isAdmin;

  const allowed = await canAccessDocument(fileName, userId, {
    allowAdminKey: isAdmin,
    action,
  });

  if (!allowed) {
    const msg =
      action === "read"
        ? "Forbidden — you do not have access to view this document."
        : "Forbidden — your team role cannot modify this document (need member or above).";
    return {
      ok: false,
      response: NextResponse.json({ error: msg }, { status: 403 }),
    };
  }

  return { ok: true, userId, isAdmin };
}
