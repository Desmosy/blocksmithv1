"use client";

import { useState, useEffect } from "react";
import type { DesignSystem } from "@/lib/blocks/types";
import { ApolloButtonSamples, ButtonPreview } from "../ButtonPreview";
import { ComponentLivePreview } from "../visual/ComponentLivePreview";
import { PageHeader } from "./PageHeader";
import { BlockStatusBadge } from "../BlockStatusBadge";
import { IconCheck } from "@/components/icons/streamline";
import { useEditableBlock } from "@/hooks/useEditableBlock";

function buttonTips(system: DesignSystem): string[] {
  const fromDos = system.dos?.filter((d) => /button|cta|primary/i.test(d));
  if (fromDos && fromDos.length > 0) return fromDos.slice(0, 4);
  return [
    "Use one primary accent for main calls to action.",
    "Reserve outline styles for secondary actions.",
    "Keep ghost buttons low-emphasis with muted label color.",
    "Match border-radius and type scale from your design doc.",
  ];
}

const PLATFORMS = ["iOS", "Android", "Web", "Guidelines"] as const;

export function ButtonsPage({
  system,
  docFileName,
  meta,
}: {
  system: DesignSystem;
  docFileName: string;
  meta: any;
}) {
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>("Web");
  const [previewDark, setPreviewDark] = useState(false);
  const [highContrast, setHighContrast] = useState(false);

  const buttonDocs = system.components.filter((c) =>
    c.title.toLowerCase().includes("button"),
  );
  const tips = buttonTips(system);
  const buttonIntro =
    buttonDocs[0]?.description ??
    `${system.name} button patterns from your design documentation.`;

  return (
    <article>
      <PageHeader
        title="Buttons"
        description={buttonIntro}
        status="draft"
        updatedAt={system.updatedAt}
        source={meta?.sourceLabel}
      />

      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <div>
          <section className="mt-4">
            <h2 className="text-sm font-semibold">Top tips</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[var(--wiki-muted)]">
              {tips.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ol>
          </section>

          <div
            className="mt-8 flex gap-6 border-b border-[var(--wiki-border)]"
            role="tablist"
            aria-label="Platform"
          >
            {PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={platform === p}
                onClick={() => setPlatform(p)}
                className={`pb-3 text-sm font-medium transition ${
                  platform === p
                    ? "border-b-2 border-[var(--wiki-text)] text-[var(--wiki-text)]"
                    : "text-[var(--wiki-muted)] hover:text-[var(--wiki-text)]"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <section className="mt-8">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              Filled buttons
              <IconCheck size={16} className="text-[var(--wiki-text)]" aria-hidden />
            </h2>
            <p className="mt-3 text-sm text-[var(--wiki-muted)]">
              On {platform}, use your doc&apos;s primary accent for filled actions and
              outline or ghost styles for secondary paths. Radii and padding come from
              your component specs.
            </p>

            <div className="mt-8 space-y-8">
              {buttonDocs.map((doc) => (
                <EditableComponentRow
                  key={doc.id}
                  doc={doc}
                  system={system}
                  docFileName={docFileName}
                />
              ))}
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--wiki-muted)]">
            Live preview
          </p>
          <div className="apollo-preview">
            <ApolloButtonSamples />
          </div>
          {platform !== "Web" ? (
            <ButtonPreview dark={previewDark} highContrast={highContrast} />
          ) : null}
        </aside>
      </div>
    </article>
  );
}

function EditableComponentRow({
  doc,
  system,
  docFileName,
}: {
  doc: any;
  system: DesignSystem;
  docFileName: string;
}) {
  const {
    isEditing,
    setIsEditing,
    currentData,
    hasDraft,
    hasConflict,
    error,
    success,
    loading,
    saveDraft,
    discardDraft,
    finalize,
  } = useEditableBlock<{ role: string; description: string }>(
    docFileName,
    `component:${doc.id}`,
    { role: doc.role, description: doc.description },
    system.contentHash || "",
  );

  const [editRole, setEditRole] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Initialize edit forms when editing begins
  useEffect(() => {
    if (isEditing) {
      setEditRole(currentData.role);
      setEditDesc(currentData.description);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  const handleSave = () => {
    saveDraft({
      role: editRole,
      description: editDesc,
    });
  };

  const displayStatus = hasConflict ? "conflict" : hasDraft ? "draft" : "finalized";

  return (
    <div className="border-b border-[var(--wiki-border)] pb-8 last:border-0">
      {hasConflict && (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400">
          <p className="font-semibold">Conflict Detected</p>
          <p className="mt-1 text-xs opacity-90">
            This component changed in the IDE while you were editing.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => finalize(true)}
              className="rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 transition"
              disabled={loading}
            >
              {loading ? "Saving…" : "Overwrite & save"}
            </button>
            <button
              type="button"
              onClick={discardDraft}
              className="rounded-lg border border-red-500/20 bg-transparent px-3 py-1 text-xs font-medium hover:bg-red-500/10 transition"
            >
              Discard Draft
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h3 className="font-medium text-base">{doc.title}</h3>
          <BlockStatusBadge status={displayStatus} />
        </div>

        {!hasConflict && (
          <div className="flex items-center gap-2">
            {isEditing ? (
              <span className="text-xs text-[var(--wiki-muted)] italic">Editing…</span>
            ) : (
              <>
                {hasDraft && (
                  <button
                    type="button"
                    onClick={() => finalize(false)}
                    disabled={loading}
                    className="flex h-7 items-center justify-center rounded-lg bg-green-600 px-2.5 text-xs font-semibold text-white hover:bg-green-700 transition disabled:opacity-50"
                  >
                    {loading ? "Saving…" : "Save to staging"}
                  </button>
                )}
                {hasDraft && (
                  <button
                    type="button"
                    onClick={discardDraft}
                    className="flex h-7 items-center justify-center rounded-lg border border-[var(--wiki-border)] px-2.5 text-xs font-semibold text-[var(--wiki-muted)] hover:text-[var(--wiki-text)] hover:bg-[var(--wiki-active)] transition"
                  >
                    Discard
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="flex h-7 items-center justify-center rounded-lg border border-[var(--wiki-border)] px-2.5 text-xs font-semibold text-[var(--wiki-text)] hover:bg-[var(--wiki-active)] transition"
                >
                  {hasDraft ? "Edit Draft" : "Edit block"}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-2 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          {success}
        </div>
      )}

      {isEditing ? (
        <div className="mt-4 space-y-4 rounded-xl border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] p-4">
          <div>
            <label htmlFor={`roleInput-${doc.id}`} className="block text-xs font-semibold uppercase tracking-wider text-[var(--wiki-muted)] mb-1">
              Role
            </label>
            <input
              id={`roleInput-${doc.id}`}
              type="text"
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
              className="w-full rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--wiki-accent)]"
            />
          </div>
          <div>
            <label htmlFor={`descTextarea-${doc.id}`} className="block text-xs font-semibold uppercase tracking-wider text-[var(--wiki-muted)] mb-1">
              Description
            </label>
            <textarea
              id={`descTextarea-${doc.id}`}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--wiki-accent)]"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-lg border border-[var(--wiki-border)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--wiki-active)] transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg bg-[var(--wiki-accent)] text-black px-3 py-1.5 text-xs font-semibold hover:opacity-90 transition"
            >
              Save Draft
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-[var(--wiki-muted)] font-medium">
            Role: {currentData.role}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--wiki-muted)]">{currentData.description}</p>
          <div className="mt-4">
            <ComponentLivePreview
              component={{
                ...doc,
                role: currentData.role,
                description: currentData.description,
              }}
              system={system}
            />
          </div>
        </>
      )}
    </div>
  );
}

