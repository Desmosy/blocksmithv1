import "server-only";

import { prepareDesignSystemDoc } from "@/lib/clients/registry";
import { refreshBlocksForDoc } from "@/lib/blocks/refresh";
import { isUploadDocRef } from "@/lib/uploads/store";
import { hydrateRegistryFromCloud, syncRegistryToCloud } from "./cloud-registry";
import { listRegistryEntries } from "./registry";

/**
 * Pipeline + promote routes run on cold serverless instances. Upload scans live
 * in Supabase Storage; the block registry must be hydrated from cloud or rebuilt
 * from markdown before buildReleaseTable() — otherwise staging/production lanes
 * stay empty even after a successful finalize on another lambda.
 */
export async function ensurePipelineRegistry(
  docRef: string,
  options?: {
    /**
     * Awaited push to Supabase even when the registry is already warm.
     * Write paths (scan/ingest) set this so the next cold lambda sees their
     * writes; read paths must NOT — syncing on every Pipeline GET turned each
     * page view into N registry writes and dominated cold-load latency
     * (PUBLIC-RELEASE-SPRINT P1 #14: cold load <3s).
     */
    forceSync?: boolean;
  },
): Promise<void> {
  if (isUploadDocRef(docRef)) {
    await prepareDesignSystemDoc(docRef);
  }

  await hydrateRegistryFromCloud(docRef);

  // Only push back to the cloud when we rebuilt the registry from markdown on
  // this instance (or a write path asked for it). If the registry was hydrated
  // from Supabase, the cloud already IS the source of truth.
  const rebuilt = listRegistryEntries(docRef).length === 0;
  if (rebuilt) {
    refreshBlocksForDoc(docRef, "ingest");
  }
  if (rebuilt || options?.forceSync) {
    try {
      await syncRegistryToCloud(docRef);
    } catch (err) {
      // A cloud outage must not fail the action that already succeeded on
      // disk — durability degrades, loudly, in the server log.
      console.warn("[ensure-pipeline-registry] cloud sync failed:", err);
    }
  }
}
