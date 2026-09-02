import "server-only";

import { listAllDocSources, type DocSource } from "@/lib/clients/registry";
import { listUploads, isUploadDocRef, uploadFileNameFromRef } from "@/lib/uploads/store";
import type { SavedUpload } from "@/lib/uploads/store";
import { getSupabaseUser } from "@/lib/auth/session";
import { listOrgsForUser } from "./orgs";
import { listDocumentsForOrg } from "./documents";
import { isPublicContent, saasStrictMode } from "./saas";

/**
 * The documents the current viewer is allowed to know exist.
 *
 * The wiki gates each document on open, but the dashboard's counters,
 * analytics and "recent activity" were built on the raw storage listing —
 * so any visitor who signed in saw every workspace's capture names and
 * totals. A listing is disclosure just like a read is: the same ownership
 * registry that guards the read now decides what the lists contain.
 *
 * Outside strict SaaS mode (a local, single-person install) everything is
 * visible, exactly as before. In strict mode a viewer sees public content
 * plus the documents of the orgs they belong to. Published documents stay
 * reachable by direct link but are not enumerated into other people's
 * dashboards — publishing shares a page, not a directory entry.
 */
async function visibleFileNames(): Promise<Set<string> | null> {
  if (!saasStrictMode()) return null; // null = everything is visible

  const visible = new Set<string>();
  try {
    const user = await getSupabaseUser();
    if (user) {
      const orgs = await listOrgsForUser(user.userId);
      for (const org of orgs) {
        const docs = await listDocumentsForOrg(org.id);
        for (const d of docs) visible.add(d.fileName);
      }
    }
  } catch {
    // Visibility degrades to public-only rather than everything.
  }
  return visible;
}

function bareFileName(ref: string): string {
  return isUploadDocRef(ref) ? uploadFileNameFromRef(ref) : ref;
}

/** `listAllDocSources`, restricted to what the viewer may see. */
export async function listAccessibleDocSources(): Promise<DocSource[]> {
  const all = await listAllDocSources();
  const visible = await visibleFileNames();
  if (visible === null) return all;
  return all.filter((s) => {
    const fileName = bareFileName(s.fileName);
    return isPublicContent(fileName) || visible.has(fileName);
  });
}

/** `listUploads`, restricted to what the viewer may see. */
export async function listAccessibleUploads(): Promise<SavedUpload[]> {
  const all = await listUploads();
  const visible = await visibleFileNames();
  if (visible === null) return all;
  return all.filter(
    (u) => isPublicContent(u.fileName) || visible.has(u.fileName),
  );
}
