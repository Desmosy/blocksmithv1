"use client";

import { useState } from "react";

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-md border border-[var(--wiki-border)] bg-[var(--wiki-bg)] px-2 py-1 text-xs font-medium transition hover:bg-[var(--wiki-active)]"
    >
      {copied ? "Copied" : label ?? "Copy"}
    </button>
  );
}
