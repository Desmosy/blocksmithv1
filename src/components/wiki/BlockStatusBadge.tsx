"use client";

/**
 * BlockStatusBadge — visual indicator for block sync state.
 *
 * Surfaces the draft/finalized/stale/deprecated/conflict status that's been
 * in the type system since day 1 but never wired to the UI.
 */

import type { BlockStatus } from "@/lib/blocks/types";

const STATUS_CONFIG: Record<
  BlockStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "Staging",
    className:
      "border border-[var(--wiki-border)] bg-[var(--wiki-active)] text-[var(--wiki-muted)]",
  },
  finalized: {
    label: "Live",
    className:
      "border border-[var(--wiki-text)] bg-[var(--wiki-text)] text-[var(--wiki-bg)]",
  },
  stale: {
    label: "Stale",
    className:
      "border border-[var(--wiki-border)] bg-[var(--wiki-active)] text-[var(--wiki-text)]",
  },
  // Deprecated still renders and still works — it is a decision, not a
  // failure — so it reads quieter than conflict rather than as an error.
  deprecated: {
    label: "Deprecated",
    className:
      "border border-dashed border-[var(--wiki-border)] bg-transparent text-[var(--wiki-muted)] line-through decoration-1",
  },
  conflict: {
    label: "Conflict",
    className:
      "border border-[var(--wiki-text)] bg-transparent text-[var(--wiki-text)]",
  },
};

interface BlockStatusBadgeProps {
  status: BlockStatus;
  /** Optional label override */
  label?: string;
  /** Compact mode — dot only, no text */
  compact?: boolean;
}

export function BlockStatusBadge({
  status,
  label,
  compact,
}: BlockStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  if (compact) {
    return (
      <span
        className="inline-block h-2 w-2 rounded-full bg-[var(--wiki-muted)]"
        title={label ?? config.label}
      />
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${config.className}`}
    >
      {label ?? config.label}
    </span>
  );
}

/**
 * SyncedAtLabel — shows when the block was last synced from disk.
 */
export function SyncedAtLabel({ updatedAt }: { updatedAt: string }) {
  const date = new Date(updatedAt);
  const relative = getRelativeTime(date);

  return (
    <span
      className="text-[11px] text-[var(--wiki-muted)]"
      title={date.toLocaleString()}
    >
      Synced {relative}
    </span>
  );
}

function getRelativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString();
}
