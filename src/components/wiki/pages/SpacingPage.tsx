"use client";

import { useEffect, useState } from "react";
import type { DesignSystem } from "@/lib/blocks/types";
import type { DesignIR } from "@/lib/design-ir/schema";
import type { DocLifecycle } from "@/lib/wiki/doc-lifecycle";
import { canEditDoc } from "@/lib/wiki/edit-policy";
import { useEditableBlock } from "@/hooks/useEditableBlock";
import { spacingBaseUnitLabel } from "@/lib/visualize/preview-tokens";
import {
  BorderRadiusSample,
  SpacingScaleList,
} from "../visual/SpacingInspectables";
import { BlockReleaseStrip } from "../BlockReleaseStrip";
import { PageHeader, type SectionEditProps } from "./PageHeader";

function spacingBlockId(token: string): string {
  return `token:spacing:${token.replace(/^--/, "")}`;
}

interface SpacingForm {
  name: string;
  value: string;
}

export function SpacingPage({
  system,
  ir,
  meta,
  docFileName,
  lifecycle = "preview",
  sectionEdit,
}: {
  system: DesignSystem;
  ir: DesignIR;
  docFileName?: string;
  meta?: { sourceLabel?: string };
  lifecycle?: DocLifecycle;
  sectionEdit?: SectionEditProps;
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const selected = system.spacing[selectedIdx] ?? null;
  const policy = canEditDoc(lifecycle, docFileName ?? "");
  const blockId = selected
    ? spacingBlockId(selected.token)
    : "token:spacing:none";

  const {
    isEditing,
    setIsEditing,
    hasDraft,
    hasConflict,
    error,
    loading,
    saveDraft,
    discardDraft,
    finalize,
  } = useEditableBlock<SpacingForm>(
    docFileName ?? "",
    blockId,
    { name: selected?.name ?? "", value: selected?.value ?? "" },
    system.contentHash || "",
  );

  const [form, setForm] = useState<SpacingForm>({ name: "", value: "" });

  useEffect(() => {
    if (isEditing && selected) {
      setForm({ name: selected.name, value: selected.value });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, selectedIdx]);

  const canEditThis =
    policy.canEdit && !!docFileName && !!selected && system.spacing.length > 0;

  return (
    <article>
      <PageHeader
        title="Spacing & shapes"
        description={`Base unit ${spacingBaseUnitLabel(ir)}`}
        status="draft"
        updatedAt={system.updatedAt}
        source={meta?.sourceLabel}
        blockId={canEditThis ? blockId : undefined}
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

      {canEditThis ? (
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs font-semibold text-[var(--wiki-muted)]">
            Editing token:
          </span>
          <select
            value={selectedIdx}
            onChange={(e) => {
              setSelectedIdx(Number(e.target.value));
              setIsEditing(false);
            }}
            className="rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] px-2 py-1 font-mono text-sm"
          >
            {system.spacing.map((s, i) => (
              <option key={s.token} value={i}>
                {s.token} ({s.value})
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {policy.canPromote && docFileName && selected ? (
        <BlockReleaseStrip docFileName={docFileName} blockId={blockId} />
      ) : null}

      {error && (
        <div className="mb-4 text-xs font-semibold text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {isEditing && selected ? (
        <div className="mb-8 space-y-4 rounded-xl border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--wiki-muted)]">
            Editing <span className="font-mono">{selected.token}</span>
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold">Name</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--wiki-accent)]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold">Value</span>
              <input
                type="text"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder="e.g. 16px"
                className="w-full rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] px-3 py-1.5 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-[var(--wiki-accent)]"
              />
            </label>
          </div>
          <div className="flex justify-end gap-3 border-t border-[var(--wiki-border)] pt-4">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-lg border border-[var(--wiki-border)] px-4 py-2 text-xs font-semibold hover:bg-[var(--wiki-active)] transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() =>
                saveDraft({
                  name: form.name.trim(),
                  value: form.value.trim(),
                })
              }
              className="rounded-lg bg-[var(--wiki-text)] px-4 py-2 text-xs font-semibold text-[var(--wiki-bg)] hover:opacity-90 transition"
            >
              Save Draft
            </button>
          </div>
        </div>
      ) : null}

      <section className="mt-10">
        <h2 className="text-xs font-bold tracking-widest text-[var(--wiki-muted)] mb-6">
          SPACING SCALE
        </h2>
        <SpacingScaleList spacing={system.spacing} />
      </section>

      <section className="mt-12">
        <h2 className="text-xs font-bold tracking-widest text-[var(--wiki-muted)] mb-6">
          BORDER RADIUS
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {system.borderRadius.map((r) => (
            <div
              key={r.element}
              className="apollo-preview flex flex-col items-center rounded-xl border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] p-6"
            >
              <div className="w-full">
                <BorderRadiusSample row={r} />
              </div>
              <p className="mt-4 font-medium capitalize">{r.element}</p>
              <p className="font-mono text-sm text-[var(--wiki-muted)]">
                {r.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {system.layout.length > 0 ? (
        <section className="mt-12 flex flex-wrap gap-4">
          {system.layout.map((l) => (
            <div
              key={l.label}
              className="rounded-xl border border-[var(--wiki-border)] px-6 py-4"
            >
              <p className="text-xs text-[var(--wiki-muted)]">{l.label}</p>
              <p className="text-2xl font-semibold mt-1">{l.value}</p>
            </div>
          ))}
        </section>
      ) : null}
    </article>
  );
}
