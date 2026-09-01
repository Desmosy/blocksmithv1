import "server-only";

import { getSupabaseUser } from "@/lib/auth/session";
import { registerDocument } from "@/lib/cloud/documents";
import { ensureDefaultOrg } from "@/lib/cloud/orgs";
import { saasDbEnabled } from "@/lib/cloud/saas";

/**
 * Record who a newly saved document belongs to.
 *
 * Without an ownership row `canAccessDocument` default denies — correctly,
 * since it cannot answer whose a document is. The consequence is that nobody
 * can ever edit or approve a change to it, including the person who just made
 * it. Captures are the document type most likely to be edited within a minute
 * of existing, so they are the worst place to leave this unset.
 *
 * Every path that creates one has to claim it, and there are two: the capture
 * route the prompt bar posts to, and the `capture_site_design` tool an agent
 * calls. The first had this and the second did not, which meant a system
 * captured by asking an agent was read-only forever while one captured by
 * typing the same address was not — a difference no one could have guessed
 * from the outside.
 *
 * Anonymous callers — the bookmarklet on somebody else's site, an agent in a
 * browser with no session — leave it unowned, and unowned means read-only.
 * That is the right answer for them.
 *
 * Best effort throughout: a document that saved is worth keeping even when the
 * ownership row fails, and a later import can claim it.
 */
export async function claimUploadForCaller(
  fileName: string,
  docRef: string,
  scanMode = "import",
): Promise<{ claimed: boolean }> {
  if (!saasDbEnabled()) return { claimed: false };
  try {
    const user = await getSupabaseUser();
    if (!user) return { claimed: false };
    const org = await ensureDefaultOrg(user.userId, user.login);
    await registerDocument({
      fileName,
      docRef,
      ownerUserId: user.userId,
      orgId: org.id,
      scanMode,
    });
    return { claimed: true };
  } catch (err) {
    console.error("[uploads] could not claim", fileName, err);
    return { claimed: false };
  }
}
