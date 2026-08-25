"use client";

import { useEffect, useState } from "react";
import type { DesignSystem } from "@/lib/blocks/types";
import type { DocLifecycle } from "@/lib/wiki/doc-lifecycle";
import { canEditDoc } from "@/lib/wiki/edit-policy";
import { useEditableBlock } from "@/hooks/useEditableBlock";
import { FontSpecimen } from "../visual/FontSpecimen";
import { TypeScalePreview } from "../visual/TypeScalePreview";
import { BlockReleaseStrip } from "../BlockReleaseStrip";
import { PageHeader, type SectionEditProps } from "./PageHeader";

function typographyBlockId(name: string): string {
  return `token:typography:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

/** The Apollo parser folds the CSS var tail into role — hide it in the form. */
function cleanRole(role: string): string {
  return role.replace(/\s*·\s*`[^`]+`\s*$/, "").trim();
}

interface TypeForm {
  name: string;
  substitute: string;
  weights: string;
  sizes: string;
  lineHeight: string;
  letterSpacing: string;
  role: string;
}

export function TypographyPage({
  system,
  docFileName,
  meta,
  lifecycle = "preview",
  sectionEdit,
}: {
  system: DesignSystem;
  docFileName?: string;
  meta?: any;
  lifecycle?: DocLifecycle;
  sectionEdit?: SectionEditProps;
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const selected = system.typography[selectedIdx] ?? null;
  const policy = canEditDoc(lifecycle, docFileName ?? "");
  const blockId = selected
    ? typographyBlockId(selected.name)
    : "token:typography:none";

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
  } = useEditableBlock<TypeForm>(
    docFileName ?? "",
    blockId,
    {
      name: selected?.name ?? "",
      substitute: selected?.substitute ?? "",
      weights: selected?.weights ?? "",
      sizes: selected?.sizes ?? "",
      lineHeight: selected?.lineHeight ?? "",
      letterSpacing: selected?.letterSpacing ?? "",
      role: cleanRole(selected?.role ?? ""),
    },
    system.contentHash || "",
  );

  const [form, setForm] = useState<TypeForm>({
    name: "",
    substitute: "",
    weights: "",
    sizes: "",
    lineHeight: "",
    letterSpacing: "",
    role: "",
  });

  useEffect(() => {
    if (isEditing && selected) {
      setForm({
        name: selected.name,
        substitute: selected.substitute,
        weights: selected.weights,
        sizes: selected.sizes,
        lineHeight: selected.lineHeight,
        letterSpacing: selected.letterSpacing,
        role: cleanRole(selected.role),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, selectedIdx]);

  const canEditThis = policy.canEdit && !!docFileName && !!selected;

  return (
    <article>
      <PageHeader
        title="Typography"
        description="Live type specimens."
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
            Editing family:
          </span>
          <select
            value={selectedIdx}
            onChange={(e) => {
              setSelectedIdx(Number(e.target.value));
              setIsEditing(false);
            }}
            className="rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] px-2 py-1 text-sm"
          >
            {system.typography.map((f, i) => (
              <option key={f.name} value={i}>
                {f.name}
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
            Editing <span className="font-mono">{selected.name}</span>
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label="Google Fonts substitute" value={form.substitute} onChange={(v) => setForm({ ...form, substitute: v })} />
            <Field label="Weights" value={form.weights} onChange={(v) => setForm({ ...form, weights: v })} />
            <Field label="Sizes" value={form.sizes} onChange={(v) => setForm({ ...form, sizes: v })} />
            <Field label="Line height" value={form.lineHeight} onChange={(v) => setForm({ ...form, lineHeight: v })} />
            <Field label="Letter spacing" value={form.letterSpacing} onChange={(v) => setForm({ ...form, letterSpacing: v })} />
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold">Role</span>
            <textarea
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--wiki-accent)]"
            />
          </label>
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
                  substitute: form.substitute.trim(),
                  weights: form.weights.trim(),
                  sizes: form.sizes.trim(),
                  lineHeight: form.lineHeight.trim(),
                  letterSpacing: form.letterSpacing.trim(),
                  role: form.role.trim(),
                })
              }
              className="rounded-lg bg-[var(--wiki-text)] px-4 py-2 text-xs font-semibold text-[var(--wiki-bg)] hover:opacity-90 transition"
            >
              Save Draft
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-10 space-y-12">
        {system.typography.map((font) => (
          <FontSpecimen key={font.name} font={font} />
        ))}
      </div>

      {system.typeScale.length > 0 ? (
        <section className="mt-16">
          <h2 className="text-lg font-semibold">Type scale</h2>
          <p className="mt-2 text-sm text-[var(--wiki-muted)]">
            Live scale from tokens — each row renders at its documented size.
          </p>
          <div className="mt-6">
            <TypeScalePreview rows={system.typeScale} />
          </div>
        </section>
      ) : null}
    </article>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--wiki-accent)]"
      />
    </label>
  );
}
