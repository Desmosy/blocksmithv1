"use client";

/**
 * When a workspace-scan doc was rescanned, local draft base hash may be stale.
 * Polls doc content hash so finalize conflict UI can surface without a full reload.
 */
import { useEffect, useState } from "react";

export function useScanDocContentHash(docFileName: string): string | undefined {
  const [hash, setHash] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/sync/status?doc=${encodeURIComponent(docFileName)}`,
        );
        const data = await res.json();
        if (!cancelled) {
          setHash(data.blockStore?.systemContentHash);
        }
      } catch {
        /* ignore */
      }
    };
    load();
    const id = setInterval(load, 6000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [docFileName]);

  return hash;
}
