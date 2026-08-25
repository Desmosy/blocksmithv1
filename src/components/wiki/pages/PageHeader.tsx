/**
 * PageHeader — standard wiki page header with block status badge.
 *
 * Provides consistent title + description + status across all wiki pages.
 * The status badge and sync timestamp make the handshake-ready schema
 * visible to humans — "is this finalized? when did it last sync?"
 */

import type { BlockStatus } from "@/lib/blocks/types";
import type { DocLifecycle } from "@/lib/wiki/doc-lifecycle";
import { BlockStatusBadge, SyncedAtLabel } from "../BlockStatusBadge";
import { SectionEditor } from "../SectionEditor";

/**
 * Opt-in universal raw-markdown editor for a page's section. The router builds
 * this (it knows the doc's parser mode and the exact heading); pages forward it.
 */
export interface SectionEditProps {
  docFileName: string;
  sectionHeading: string;
  lifecycle?: DocLifecycle;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Block status — defaults to "draft" (most content is IDE-sourced, not yet finalized) */
  status?: BlockStatus;
  /** ISO timestamp of last parse/sync */
  updatedAt?: string;
  /** Source file path for attribution */
  source?: string;
  children?: React.ReactNode;

  // Editable actions
  blockId?: string;
  isEditing?: boolean;
  hasDraft?: boolean;
  hasConflict?: boolean;
  loading?: boolean;
  onEditToggle?: () => void;
  onFinalize?: (force?: boolean) => void;
  onDiscard?: () => void;

  /**
   * Opt-in universal raw-markdown editor for this page's section. Renders on
   * every page that supplies it, so nothing is read-only on editable docs.
   */
  sectionEdit?: SectionEditProps;
}

export function PageHeader({
  title,
  description,
  status = "draft",
  updatedAt,
  source,
  children,
  blockId,
  isEditing,
  hasDraft,
  hasConflict,
  loading,
  onEditToggle,
  onFinalize,
  onDiscard,
  sectionEdit,
}: PageHeaderProps) {
  // Determine displayed status dynamically
  const displayStatus = hasConflict ? "conflict" : hasDraft ? "draft" : status;

  return (
    <div className="mb-8">
      {hasConflict && (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400">
          <p className="font-semibold">Conflict Detected</p>
          <p className="mt-1 text-xs opacity-90">
            This block changed in the IDE while you were editing. Force-write
            your edits, or discard to load the latest.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => onFinalize?.(true)}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition"
              disabled={loading}
            >
              {loading ? "Saving…" : "Overwrite & save to staging"}
            </button>
            <button
              onClick={onDiscard}
              className="rounded-lg border border-red-500/20 bg-transparent px-3 py-1.5 text-xs font-medium hover:bg-red-500/10 transition"
            >
              Discard my draft
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1
            className="text-3xl font-normal text-[var(--wiki-text)]"
            style={{
              fontFamily: "var(--wiki-display-font)",
              letterSpacing: "var(--wiki-heading-tracking, -0.03em)",
            }}
          >
            {title}
          </h1>
          <BlockStatusBadge status={displayStatus} />
        </div>

        {blockId && !hasConflict && (
          <div className="flex items-center gap-2">
            {isEditing ? (
              <span className="text-xs text-[var(--wiki-muted)] italic">Editing block…</span>
            ) : (
              <>
                {hasDraft && (
                  <button
                    type="button"
                    onClick={() => onFinalize?.(false)}
                    disabled={loading}
                    className="flex h-8 items-center justify-center rounded-lg bg-[var(--wiki-text)] px-3 text-xs font-semibold text-[var(--wiki-bg)] hover:opacity-90 transition disabled:opacity-50"
                  >
                    {loading ? "Saving…" : "Save to staging"}
                  </button>
                )}
                {hasDraft && (
                  <button
                    type="button"
                    onClick={onDiscard}
                    className="flex h-8 items-center justify-center rounded-lg border border-[var(--wiki-border)] px-3 text-xs font-semibold text-[var(--wiki-muted)] hover:text-[var(--wiki-text)] hover:bg-[var(--wiki-active)] transition"
                  >
                    Discard
                  </button>
                )}
                <button
                  type="button"
                  onClick={onEditToggle}
                  className="flex h-8 items-center justify-center rounded-lg border border-[var(--wiki-border)] px-3 text-xs font-semibold text-[var(--wiki-text)] hover:bg-[var(--wiki-active)] transition"
                >
                  {hasDraft ? "Edit Draft" : "Edit block"}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {description ? (
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--wiki-muted)]">
          {description}
        </p>
      ) : null}
      {(updatedAt || source) ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {updatedAt ? <SyncedAtLabel updatedAt={updatedAt} /> : null}
          {source ? (
            <span className="text-[11px] text-[var(--wiki-muted)] font-mono">
              {source}
            </span>
          ) : null}
        </div>
      ) : null}
      {sectionEdit ? (
        <div className="mt-4">
          <SectionEditor
            docFileName={sectionEdit.docFileName}
            sectionHeading={sectionEdit.sectionHeading}
            lifecycle={sectionEdit.lifecycle}
          />
        </div>
      ) : null}
      {children}
    </div>
  );
}

