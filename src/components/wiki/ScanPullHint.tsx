"use client";

import { useState } from "react";

type ScanPullHintProps = {
  docRef: string;
  suggestedWorkspace?: string;
  visible?: boolean;
};

function isEphemeralHostedPath(path: string): boolean {
  return /\/tmp\/blocksmith-clone/i.test(path);
}

export function ScanPullHint({
  docRef,
  suggestedWorkspace,
  visible = true,
}: ScanPullHintProps) {
  const [copied, setCopied] = useState(false);

  if (!visible || !docRef.startsWith("upload:")) return null;

  const hosted = suggestedWorkspace && isEphemeralHostedPath(suggestedWorkspace);
  const pullCmd = `blocksmith pull --doc ${docRef}`;
  const loginHint =
    typeof window !== "undefined"
      ? `blocksmith login --key bs_live_… --url ${window.location.origin}`
      : "blocksmith login --key bs_live_… --url https://your-app";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pullCmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] px-4 py-3 text-sm text-[var(--wiki-muted)]">
      <p className="font-medium text-[var(--wiki-text)]">
        Pull to your project
      </p>
      {suggestedWorkspace && !hosted ? (
        <p className="mt-1 text-xs">
          From: <code className="font-mono text-[11px]">{suggestedWorkspace}</code>
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="block min-w-0 flex-1 overflow-x-auto rounded-lg bg-[var(--wiki-bg)] px-3 py-2 font-mono text-xs text-[var(--wiki-text)]">
          cd ~/your-repo && {pullCmd}
        </code>
        <button
          type="button"
          onClick={() => void copy()}
          className="shrink-0 rounded-lg border border-[var(--wiki-border)] px-3 py-1.5 text-xs font-medium text-[var(--wiki-text)] hover:bg-[var(--wiki-bg)]"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-[var(--wiki-muted)]">
        API key from Wiki → Sync. <code className="font-mono">{loginHint}</code>
      </p>
    </div>
  );
}
