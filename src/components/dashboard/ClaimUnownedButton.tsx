"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Adopt the workspace's ownerless documents into the signed-in account.
 *
 * Shown when the ownership registry is live: captures made through an agent
 * arrive with no owner and are therefore invisible on the tenant-scoped
 * dashboard. One click sweeps them in; documents that belong to anyone are
 * never touched.
 */
export function ClaimUnownedButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const claim = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/cloud/claim-unowned", { method: "POST" });
      const data = (await res.json()) as {
        claimed?: number;
        error?: string;
      };
      if (!res.ok) {
        setNote(data.error ?? "Could not claim documents.");
        return;
      }
      if (data.claimed) {
        setNote(`Claimed ${data.claimed} system${data.claimed === 1 ? "" : "s"} into your workspace.`);
        router.refresh();
      } else {
        setNote("No unowned systems found — everything already has an owner.");
      }
    } catch {
      setNote("Could not claim documents.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3 text-[13px] text-[var(--dash-muted-fg,#6b7280)]">
      <button
        type="button"
        onClick={() => void claim()}
        disabled={busy}
        className="rounded-lg border border-[var(--dash-border,#e5e7eb)] px-3 py-1.5 font-medium text-[var(--dash-foreground,#111)] transition hover:bg-[var(--dash-muted,#f4f4f5)] disabled:opacity-50"
      >
        {busy ? "Claiming…" : "Recover agent-captured systems"}
      </button>
      {note ? <span>{note}</span> : null}
    </div>
  );
}
