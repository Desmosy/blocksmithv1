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
  if (user?.email) {
    await acceptPendingInvites(user.userId, user.email);
  }

  const allowed = await canAccessDocument(fileName, user?.userId ?? null, {
    action: "read",
  });
  if (!allowed) notFound();
}
