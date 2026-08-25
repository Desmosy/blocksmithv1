"use client";

import { useState, useEffect } from "react";
import type { DesignSystem } from "@/lib/blocks/types";
import type { DocLifecycle } from "@/lib/wiki/doc-lifecycle";
import { canEditDoc } from "@/lib/wiki/edit-policy";
import { PageHeader, type SectionEditProps } from "./PageHeader";
import { useEditableBlock } from "@/hooks/useEditableBlock";
import { IconCheck, IconDelete } from "@/components/icons/streamline";
import { BlockReleaseStrip } from "../BlockReleaseStrip";

export function GuidelinesPage({
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
  } = useEditableBlock<{ dos: string[]; donts: string[] }>(
    docFileName,
    "guidelines",
    { dos: system.dos, donts: system.donts },
    system.contentHash || "",
  );

  const [editDos, setEditDos] = useState<string[]>([]);
  const [editDonts, setEditDonts] = useState<string[]>([]);

  // Initialize edit forms when editing begins
  useEffect(() => {
    if (isEditing) {
      setEditDos([...currentData.dos]);
      setEditDonts([...currentData.donts]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  const handleSave = () => {
    saveDraft({
      dos: editDos.filter((d) => d.trim()),
      donts: editDonts.filter((d) => d.trim()),
    });
  };

  return (
    <article>
      <PageHeader
        title="Guidelines"
        description="Do's and don'ts for Apollo — human-readable rules agents should follow."
        status="draft"
        updatedAt={system.updatedAt}
        source={meta?.sourceLabel}
        blockId={policy.canEdit ? "guidelines" : undefined}
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
        <>
          <BlockReleaseStrip docFileName={docFileName} blockId="guideline:dos" />
          <BlockReleaseStrip docFileName={docFileName} blockId="guideline:donts" />
        </>
      ) : null}

      {error && (
        <div className="mb-4 text-xs font-semibold text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {isEditing ? (
        <div className="mt-8 space-y-8 rounded-xl border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] p-6">
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Dos Edit */}
            <div>
              <h3 className="text-sm font-semibold text-emerald-700 mb-4">Do</h3>
              <div className="space-y-3">
                {editDos.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => {
                        const next = [...editDos];
                        next[index] = e.target.value;
                        setEditDos(next);
                      }}
                      className="flex-1 rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--wiki-accent)]"
                      placeholder="Add positive instruction..."
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setEditDos(editDos.filter((_, i) => i !== index));
                      }}
                      className="rounded-lg border border-[var(--wiki-border)] px-2 text-xs font-semibold text-red-600 hover:bg-red-500/10 transition"
                    >
                      Delete
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setEditDos([...editDos, ""])}
                  className="mt-2 text-xs font-semibold text-emerald-700 hover:underline"
                >
                  + Add rule
                </button>
              </div>
            </div>

            {/* Donts Edit */}
            <div>
              <h3 className="text-sm font-semibold text-red-600 mb-4">Don&apos;t</h3>
              <div className="space-y-3">
                {editDonts.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => {
                        const next = [...editDonts];
                        next[index] = e.target.value;
                        setEditDonts(next);
                      }}
                      className="flex-1 rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--wiki-accent)]"
                      placeholder="Add negative constraint..."
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setEditDonts(editDonts.filter((_, i) => i !== index));
                      }}
                      className="rounded-lg border border-[var(--wiki-border)] px-2 text-xs font-semibold text-red-600 hover:bg-red-500/10 transition"
                    >
                      Delete
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setEditDonts([...editDonts, ""])}
                  className="mt-2 text-xs font-semibold text-red-600 hover:underline"
                >
                  + Add rule
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 flex gap-3 border-t border-[var(--wiki-border)] pt-4 justify-end">
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
        <div className="mt-10 grid gap-10 lg:grid-cols-2">
          <section>
            <h2 className="text-sm font-semibold text-[var(--wiki-text)]">Do</h2>
            <ul className="mt-4 space-y-3">
              {currentData.dos.map((item, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-sm leading-relaxed text-[var(--wiki-muted)]"
                >
                  <IconCheck size={14} className="mt-0.5 shrink-0 text-[var(--wiki-text)]" />
                  <span>{item}</span>
                </li>
              ))}
              {currentData.dos.length === 0 && (
                <li className="text-xs text-[var(--wiki-muted)] italic">No positive guidelines.</li>
              )}
            </ul>
          </section>
          <section>
            <h2 className="text-sm font-semibold text-[var(--wiki-text)]">Don&apos;t</h2>
            <ul className="mt-4 space-y-3">
              {currentData.donts.map((item, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-sm leading-relaxed text-[var(--wiki-muted)]"
                >
                  <IconDelete size={14} className="mt-0.5 shrink-0 text-[var(--wiki-text)]" />
                  <span>{item}</span>
                </li>
              ))}
              {currentData.donts.length === 0 && (
                <li className="text-xs text-[var(--wiki-muted)] italic">No negative guidelines.</li>
              )}
            </ul>
          </section>
        </div>
      )}
    </article>
  );
}
