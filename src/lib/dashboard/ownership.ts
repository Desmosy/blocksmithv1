import "server-only";
import { getSupabaseUser } from "@/lib/auth/session";
import { ensureDefaultOrg } from "@/lib/cloud/orgs";
import { registerDocument } from "@/lib/cloud/documents";
import { readUploadMarkdownContent } from "@/lib/uploads/persist";
import { parseProjectMeta } from "./projects";
import { cacheProjectMeta } from "./meta-cache";

/**
 * Register a freshly-created project in the document registry under the signed-in
 * user's org, and denormalize its display metadata into the cache (so the hosted
 * dashboard renders rich cards without reparsing every doc).
 *
 * Without registration a doc is orphaned in hosted mode: it never appears in the
 * org's dashboard and ownership checks default-deny. No-op for anonymous local
 * dev (where the dashboard lists + parses all local uploads instead).
 */
export async function registerOwnedProject(
  fileName: string,
  docRef: string,
  scanMode: string,
): Promise<void> {
  // Cache metadata (best-effort) — the markdown is in the persist memory cache.
  try {
    const md = await readUploadMarkdownContent(fileName);
    await cacheProjectMeta(fileName, parseProjectMeta(fileName, md));
  } catch {
    /* cache is best-effort */
  }

  try {
    const user = await getSupabaseUser();
    if (!user) return;
    const org = await ensureDefaultOrg(user.userId, user.login);
    await registerDocument({
      fileName,
      docRef,
      ownerUserId: user.userId,
      orgId: org.id,
      scanMode,
    });
  } catch (err) {
    console.warn("[ownership] could not register project", err);
  }
}
