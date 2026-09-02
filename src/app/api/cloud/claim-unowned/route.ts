import { NextResponse } from "next/server";
import { getSupabaseUser } from "@/lib/auth/session";
import { ensureDefaultOrg } from "@/lib/cloud/orgs";
import { getDocument, registerDocument } from "@/lib/cloud/documents";
import { saasDbEnabled } from "@/lib/cloud/saas";
import { listUploads } from "@/lib/uploads/store";

export const dynamic = "force-dynamic";

/**
 * Claim every unowned document into the caller's workspace.
 *
 * A capture made through an agent — ChatGPT's browser, an MCP tool call —
 * carries no session, so `claimUploadForCaller` finds nobody to give it to
 * and the document lands ownerless. Ownerless means invisible: the home
 * grid is scoped to the registry, and the listing fix scoped analytics the
 * same way, so a person whose whole workspace was captured by their agent
 * opens the dashboard to "No design systems yet".
 *
 * This is the recovery: a signed-in user sweeps the uploads and registers
 * every document that has NO ownership row to their default org. Documents
 * that already belong to anyone — this user or another — are never touched,
 * so it can only ever adopt orphans, not take. First to claim an orphan
 * wins, which is the trust model claim.ts already states ("a later import
 * can claim it"); orphans exist precisely because nobody could be named at
 * creation time.
 */
export async function POST() {
  if (!saasDbEnabled()) {
    return NextResponse.json(
      { error: "Ownership registry is not configured on this deployment." },
      { status: 400 },
    );
  }
  const user = await getSupabaseUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to claim documents." }, { status: 401 });
  }

  const org = await ensureDefaultOrg(user.userId, user.login);
  const uploads = await listUploads();

  let claimed = 0;
  const errors: string[] = [];
  for (const u of uploads) {
    try {
      const existing = await getDocument(u.fileName);
      if (existing) continue; // owned by someone — never reassign
      await registerDocument({
        fileName: u.fileName,
        docRef: u.docRef,
        ownerUserId: user.userId,
        orgId: org.id,
        scanMode: "import",
      });
      claimed += 1;
    } catch (err) {
      errors.push(u.fileName);
      console.error("[claim-unowned]", u.fileName, err);
    }
  }

  return NextResponse.json({
    claimed,
    scanned: uploads.length,
    failed: errors.length,
  });
}
