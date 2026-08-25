"use client";

import Link from "next/link";
import type { DocSource } from "@/lib/clients/registry";

interface SourceSwitcherProps {
  sources: DocSource[];
  currentFileName: string;
  parser: "apollo" | "generic" | "workspace-scan";
}

/**
 * Shows the current project's source file. Switching between projects happens on
 * the dashboard — a wiki is scoped to one project, so this is informational
 * (no cross-project jumping, which silently swapped your project).
 */
export function SourceSwitcher({
  currentFileName,
  parser,
}: SourceSwitcherProps) {
  return (
    <p className="text-xs text-[var(--wiki-muted)]">
      Source: <span className="font-mono">{currentFileName}</span>
      <span className="ml-2 rounded bg-[var(--wiki-active)] px-1.5 py-0.5">
        {parser}
      </span>
    </p>
  );
}

export function SourceSwitcherHint({ sources }: { sources: DocSource[] }) {
  if (sources.length === 0) {
    return (
      <p className="text-sm text-amber-700">
        Paste or upload <code className="font-mono">.md</code> on the{" "}
        <Link href="/" className="underline hover:text-[var(--wiki-text)]">
          home page
        </Link>{" "}
        or add files to <code className="font-mono">docs/designs.md/</code>.
      </p>
    );
  }
  return null;
}
