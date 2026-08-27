"use client";

import type { DocLifecycle } from "@/lib/wiki/doc-lifecycle";
import { SourceSwitcher } from "./SourceSwitcher";
import type { DocSource } from "@/lib/clients/registry";
import { IconSearch } from "@/components/icons";

const LIFECYCLE_COPY: Record<
  DocLifecycle,
  { label: string; detail: string }
> = {
  preview: {
    label: "Preview",
    detail: "Browse only — connect a repo to approve releases",
  },
  connected: {
    label: "Connected",
    detail: "Synced from your codebase",
  },
  pinned: {
    label: "Pinned",
    detail: "Lock active in your repo",
  },
};

export function WikiWorkspaceBar({
  systemName,
  lifecycle,
  sources,
  currentFileName,
  parser,
  visualizeControl,
  styleApplied,
  summary,
  searchQuery,
  onSearchChange,
}: {
  systemName: string;
  lifecycle: DocLifecycle;
  sources: DocSource[];
  currentFileName: string;
  parser: "apollo" | "generic" | "workspace-scan";
  visualizeControl?: React.ReactNode;
  styleApplied?: boolean;
  summary?: string | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}) {
  const status = LIFECYCLE_COPY[lifecycle];

  return (
    <div
      className="flex h-14 shrink-0 items-center gap-4 border-b px-5"
      style={{
        borderColor: "var(--wiki-border)",
        backgroundColor: "var(--wiki-sidebar)",
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-[var(--wiki-text)]">
            {systemName}
          </p>
          <span
            className="rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide"
            style={{
              borderColor: "var(--wiki-border)",
              color: "var(--wiki-muted)",
            }}
            title={status.detail}
          >
            {status.label}
          </span>
          {styleApplied && summary ? (
            <span className="text-xs text-[var(--wiki-muted)]">{summary}</span>
          ) : null}
        </div>
      </div>

      <label className="relative hidden min-w-0 max-w-xs flex-1 md:block">
        <span className="sr-only">Search design system</span>
        <IconSearch
          size={15}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
          style={{ color: "var(--wiki-muted)" }}
        />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search this system…"
          className="h-8 w-full rounded-lg border pl-9 pr-3 text-sm outline-none transition focus:ring-1"
          style={{
            borderColor: "var(--wiki-border)",
            backgroundColor: "var(--wiki-bg)",
            color: "var(--wiki-text)",
          }}
        />
      </label>

      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <SourceSwitcher
          sources={sources}
          currentFileName={currentFileName}
          parser={parser}
        />
        {visualizeControl}
      </div>
    </div>
  );
}
