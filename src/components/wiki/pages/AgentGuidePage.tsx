"use client";

import { useState, useEffect } from "react";
import type { DesignSystem } from "@/lib/blocks/types";
import type { DocLifecycle } from "@/lib/wiki/doc-lifecycle";
import { canEditDoc } from "@/lib/wiki/edit-policy";
import { PageHeader, type SectionEditProps } from "./PageHeader";
import { useEditableBlock } from "@/hooks/useEditableBlock";
import { BlockReleaseStrip } from "../BlockReleaseStrip";

export function AgentGuidePage({
  system,
  docFileName,
  meta,
  lifecycle = "preview",
  sectionEdit,
}: {
  system: DesignSystem;
  docFileName: string;
  meta: any;
  lifecycle?: DocLifecycle;
  sectionEdit?: SectionEditProps;
}) {
  const policy = canEditDoc(lifecycle, docFileName);
  const {
    isEditing,
    setIsEditing,
    currentData,
    hasDraft,
    hasConflict,
    error,
    loading,
    saveDraft,
    discardDraft,
    finalize,
  } = useEditableBlock<{ text: string }>(
    docFileName,
    "agent-guide",
    { text: system.agentGuide || "" },
    system.contentHash || "",
  );

  const [editText, setEditText] = useState("");

  // Initialize edit forms when editing begins
  useEffect(() => {
    if (isEditing) {
      setEditText(currentData.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  const handleSave = () => {
    saveDraft({ text: editText });
  };

  return (
    <article>
      <PageHeader
        title="Agent guide"
        description="Instructions for LLM coding agents via MCP."
        status="draft"
        updatedAt={system.updatedAt}
        source={meta?.sourceLabel}
        blockId={policy.canEdit ? "agent-guide" : undefined}
        isEditing={isEditing}
        hasDraft={hasDraft}
        hasConflict={hasConflict}
        loading={loading}
        onEditToggle={() => setIsEditing(true)}
        onFinalize={(force) => finalize(force)}
        onDiscard={discardDraft}
        sectionEdit={sectionEdit}
      />

      {!policy.canEdit && policy.reason ? (
        <p className="mb-4 rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] px-4 py-2.5 text-xs text-[var(--wiki-muted)]">
          {policy.reason}
        </p>
      ) : null}

      {policy.canPromote ? (
        <BlockReleaseStrip docFileName={docFileName} blockId="agent-rule:guide" />
      ) : null}

      {error && (
        <div className="mb-4 text-xs font-semibold text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {isEditing ? (
        <div className="mt-8 space-y-4 rounded-xl border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] p-6">
          <div>
            <label htmlFor="agentGuideTextarea" className="block text-xs font-semibold uppercase tracking-wider text-[var(--wiki-muted)] mb-2">
              Agent Prompt Instructions
            </label>
            <textarea
              id="agentGuideTextarea"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={15}
              className="w-full rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] p-4 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[var(--wiki-accent)]"
              placeholder="Markdown instructions for coding agents…"
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-lg border border-[var(--wiki-border)] px-4 py-2 text-xs font-semibold hover:bg-[var(--wiki-active)] transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg bg-[var(--wiki-accent)] text-black px-4 py-2 text-xs font-semibold hover:opacity-90 transition"
            >
              Save Draft
            </button>
          </div>
        </div>
      ) : (
        <pre className="mt-8 max-w-2xl overflow-x-auto rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] p-6 text-sm leading-relaxed whitespace-pre-wrap font-sans text-[var(--wiki-muted)]">
          {currentData.text || "No prompt guide defined."}
        </pre>
      )}
    </article>
  );
}
