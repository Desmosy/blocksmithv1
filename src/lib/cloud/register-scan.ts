import "server-only";

import type { ScanPersistResult } from "@/lib/scan/run";
import { registerDocument } from "./documents";
import { ensureDefaultOrg } from "./orgs";
import { actorUserId } from "./actor";
import type { Actor } from "./types";
import { isPublicDemoDocument } from "./saas";

export async function registerScanOwnership(
  result: Pick<ScanPersistResult, "fileName" | "docRef">,
  actor: Actor | null,
  scanMode: string,
  githubRepo?: string,
): Promise<void> {
  if (isPublicDemoDocument(result.fileName)) return;

  const userId = actor ? actorUserId(actor) : null;
  if (!userId) return;

  const login = actor?.kind === "user" ? actor.login : null;
  const org = await ensureDefaultOrg(userId, login);

  await registerDocument({
    fileName: result.fileName,
    docRef: result.docRef,
    ownerUserId: userId,
    orgId: org.id,
    githubRepo,
    scanMode,
  });
}
