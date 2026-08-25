"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function SignOutButton() {
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    const sb = createBrowserSupabase();
    if (sb) {
      await sb.auth.signOut().catch(() => {});
    }
    window.location.href = "/";
  };

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      disabled={busy}
      className="rounded-md border border-lavender-mist px-3 py-1.5 text-[13px] text-graphite transition-colors hover:border-ink-black/30 hover:text-ink-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-black/30 disabled:opacity-50"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
