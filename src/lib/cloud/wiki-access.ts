import "server-only";

import { notFound } from "next/navigation";
import { getSupabaseUser } from "@/lib/auth/session";
import { acceptPendingInvites } from "./orgs";
import { canAccessDocument } from "./documents";
import { isPublicContent, saasStrictMode } from "./saas";
import { isUploadDocRef, uploadFileNameFromRef } from "@/lib/uploads/store";

/**
 * Gate wiki read for every non-public doc in production SaaS mode — uploads
 * (`upload:` refs) AND scan/repo docs (bare file names). Only the named demo
 * and bundled repo samples render without authentication.
 */
export async function assertWikiDocAccess(docRef: string): Promise<void> {
  if (!saasStrictMode()) return;

  // Resolve to the registry file name: uploads carry the upload: prefix; scan
  // and repo docs are referenced by their bare file name.
  const fileName = isUploadDocRef(docRef)
    ? uploadFileNameFromRef(docRef)
    : docRef;
  if (isPublicContent(fileName)) return;

  const user = await getSupabaseUser();
  // Invite acceptance is a convenience on the way in, not the gate itself; a
  // transient failure here must not take the whole page down.
  if (user?.email) {
    try {
      await acceptPendingInvites(user.userId, user.email);
    } catch (err) {
      console.error("[wiki-access] invite acceptance failed:", err);
    }
  }

  // The gate proper. An error answering "may they read this?" is treated as
  // "no" — a denial renders the same not-found page a missing doc does,
  // where an unhandled throw rendered the raw error boundary on every
  // Supabase hiccup and read as the wiki being broken.
  let allowed = false;
  try {
    allowed = await canAccessDocument(fileName, user?.userId ?? null, {
      action: "read",
    });
  } catch (err) {
    console.error("[wiki-access] access check failed:", fileName, err);
  }
  if (!allowed) notFound();
}
