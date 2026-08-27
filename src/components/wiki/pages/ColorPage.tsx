"use client";

import { useEffect, useState } from "react";
import { colorBlockId as publicShareColorBlockId } from "@/lib/public-share/block-ids";
import { ShareBlockPanel } from "@/components/share/ShareBlockPanel";
import type { ColorToken, DesignSystem } from "@/lib/blocks/types";
import { groupColorsByCategory } from "@/lib/parser/apollo";
import type { DocLifecycle } from "@/lib/wiki/doc-lifecycle";
import { canEditDoc } from "@/lib/wiki/edit-policy";
import { useEditableBlock } from "@/hooks/useEditableBlock";
import { ContentToolbar } from "../ContentToolbar";
import { ColorSwatchCard } from "../visual/ColorSwatchCard";
import { CopyButton } from "../visual/CopyButton";
import { BlockReleaseStrip } from "../BlockReleaseStrip";

import { PageHeader, type SectionEditProps } from "./PageHeader";

/** Mirror of extract.ts slugFromCssVar so the strip targets the right block. */
/**
 * The share system resolves a colour by `block-ids.ts`'s id, which is not the
 * same string as the editor's block id below — sharing with the editor's id
 * mints a link that resolves to nothing.
 */
function shareBlockIdFor(cssVar: string): string {
  return publicShareColorBlockId(cssVar);
}

function colorBlockId(cssVar: string): string {
  return `token:color:${cssVar.replace(/^--/, "").replace(/^color-/, "")}`;
}

interface ColorForm {
  name: string;
  value: string;
  role: string;
}

export function ColorPage({
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
  const [viewport, setViewport] = useState("desktop");
  const [highContrast, setHighContrast] = useState(false);
  const [previewDark, setPreviewDark] = useState(false);
  const [selected, setSelected] = useState<ColorToken | null>(
    system.colors[0] ?? null,
  );

  const policy = canEditDoc(lifecycle, docFileName ?? "");
  const blockId = selected ? colorBlockId(selected.cssVar) : "token:color:none";

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
  } = useEditableBlock<ColorForm>(
    docFileName ?? "",
    blockId,
    {
      name: selected?.name ?? "",
      value: selected?.value ?? "",
      role: selected?.role ?? "",
    },
    system.contentHash || "",
  );

  const [form, setForm] = useState<ColorForm>({ name: "", value: "", role: "" });

  useEffect(() => {
    if (isEditing && selected) {
      setForm({
        name: currentData.name || selected.name,
        value: currentData.value || selected.value,
        role: currentData.role || selected.role,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  const groups = groupColorsByCategory(system.colors);
  const canEditThis = policy.canEdit && !!docFileName && !!selected;

  // Show the staged draft hex in the inspector so the edit is visible pre-save.
  const displayValue = hasDraft ? currentData.value : selected?.value;
  const displayName = hasDraft ? currentData.name : selected?.name;
  const displayRole = hasDraft ? currentData.role : selected?.role;

  if (!system.colors.length) {
    return (
      <article>
        <PageHeader
          title="Color"
          description="No color tokens found."
          status="draft"
          updatedAt={system.updatedAt}
          source={meta?.sourceLabel}
        />
      </article>
    );
  }

  const validHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(form.value.trim());

  return (
    <article className="design-preview apollo-preview -mx-4 sm:mx-0">
      <PageHeader
        title="Color"
        description={`${system.colors.length} token${system.colors.length === 1 ? "" : "s"}`}
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
            Editing <span className="font-mono">{selected.cssVar}</span>
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
              <span className="mb-1 block text-xs font-semibold">Hex value</span>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-8 w-8 shrink-0 rounded-md border border-[var(--wiki-border)]"
                  style={{ backgroundColor: validHex ? form.value : "transparent" }}
                />
                <input
                  type="text"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  placeholder="#rrggbb"
                  className={`w-full rounded-lg border bg-[var(--wiki-bg)] px-3 py-1.5 font-mono text-sm focus:outline-none focus:ring-1 ${
                    validHex
                      ? "border-[var(--wiki-border)] focus:ring-[var(--wiki-accent)]"
                      : "border-red-500/50 focus:ring-red-500"
                  }`}
                />
              </div>
              {!validHex ? (
                <span className="mt-1 block text-[11px] text-red-600">
                  Enter a valid hex like #1a1a1a
                </span>
              ) : null}
            </label>
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
              disabled={!validHex}
              onClick={() =>
                saveDraft({
                  name: form.name.trim(),
                  value: form.value.trim(),
                  role: form.role.trim(),
                })
              }
              className="rounded-lg bg-[var(--wiki-text)] px-4 py-2 text-xs font-semibold text-[var(--wiki-bg)] hover:opacity-90 transition disabled:opacity-50"
            >
              Save Draft
            </button>
          </div>
        </div>
      ) : null}

      <ContentToolbar
        viewport={viewport}
        onViewportChange={setViewport}
        highContrast={highContrast}
        onHighContrastChange={setHighContrast}
        previewDark={previewDark}
        onPreviewDarkChange={setPreviewDark}
      />

      {selected ? (
        <div
          className="mb-10 overflow-hidden border border-[var(--wiki-border)]"
          style={{
            backgroundColor: previewDark ? "#1a1a1a" : displayValue,
            minHeight: 140,
            borderRadius: "var(--wiki-radius-card, 16px)",
          }}
        >
          <div
            className="flex h-full min-h-[140px] flex-col justify-between p-6"
            style={{
              color: previewDark
                ? displayValue
                : displayValue === "#000000" ||
                    parseInt((displayValue ?? "#000000").slice(1), 16) < 0x888888
                  ? "#fff"
                  : "#000",
            }}
          >
            <div>
              <p className="text-2xl font-semibold font-mono">
                {selected.cssVar.replace("--color-", "")}
              </p>
              <p className="mt-1 text-lg opacity-90">{displayName}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-xl">{displayValue}</span>
              <CopyButton value={displayValue ?? ""} />
              <CopyButton value={selected.cssVar} label="Copy CSS var" />
            </div>
            <p
              className={`mt-4 max-w-2xl text-sm ${
                highContrast ? "opacity-100" : "opacity-80"
              }`}
            >
              {displayRole}
            </p>
          </div>
        </div>
      ) : null}

      <div
        className="space-y-12"
        data-preview-theme={previewDark ? "dark" : "light"}
      >
        {Array.from(groups.entries()).map(([group, tokens]) => (
          <section key={group}>
            <h2 className="mb-4 text-xs font-bold tracking-widest text-[var(--wiki-muted)]">
              {group}
            </h2>
            <div
              className={`grid gap-4 ${
                viewport === "mobile"
                  ? "grid-cols-1"
                  : viewport === "tablet"
                    ? "grid-cols-2"
                    : "grid-cols-2 lg:grid-cols-3"
              }`}
            >
              {tokens.map((token) => (
                <ColorSwatchCard
                  key={token.cssVar}
                  token={token}
                  selected={selected?.cssVar === token.cssVar}
                  onSelect={(t) => {
                    setSelected(t);
                    setIsEditing(false);
                  }}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-12">
        <h2 className="text-sm font-semibold mb-4">Full palette strip</h2>
        <div className="flex h-16 overflow-hidden rounded-xl border border-[var(--wiki-border)]">
          {system.colors.map((c) => (
            <button
              key={c.cssVar}
              type="button"
              title={c.name}
              className="min-w-0 flex-1 transition hover:flex-[2]"
              style={{ backgroundColor: c.value }}
              onClick={() => {
                setSelected(c);
                setIsEditing(false);
              }}
            />
          ))}
        </div>
      </section>

      {/* Last, not first. Sharing a token is something you do after looking at
          it — above the palette it pushed the actual colours below the fold and
          asked for opinions on something the reader had not seen yet. */}
      {docFileName && selected ? (
        <section className="mt-8">
          <ShareBlockPanel
            docFileName={docFileName}
            blockKind="color"
            blockId={shareBlockIdFor(selected.cssVar)}
            blockTitle={selected.name}
          />
        </section>
      ) : null}
    </article>
  );
}
