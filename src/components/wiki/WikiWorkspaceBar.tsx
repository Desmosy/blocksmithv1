"use client";

import type { DocLifecycle } from "@/lib/wiki/doc-lifecycle";
import { SourceSwitcher } from "./SourceSwitcher";
import type { DocSource } from "@/lib/clients/registry";

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
}: {
  systemName: string;
  lifecycle: DocLifecycle;
  sources: DocSource[];
  currentFileName: string;
  parser: "apollo" | "generic" | "workspace-scan";
  visualizeControl?: React.ReactNode;
  styleApplied?: boolean;
  summary?: string | null;
}) {
  const status = LIFECYCLE_COPY[lifecycle];

  return (
    <div
      className="flex flex-col gap-3 border-b px-5 py-3 sm:flex-row sm:items-center"
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
          >
            {status.label}
          </span>
          {styleApplied && summary ? (
            <span className="text-xs text-[var(--wiki-muted)]">{summary}</span>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs text-[var(--wiki-muted)]">{status.detail}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
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
