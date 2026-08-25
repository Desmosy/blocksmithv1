"use client";

import { useEffect, useState } from "react";
import type { DesignSystem } from "@/lib/blocks/types";
import type { MarkdownSection } from "@/lib/parser/generic";
import type { DesignIR } from "@/lib/design-ir/schema";
import type { DocLifecycle } from "@/lib/wiki/doc-lifecycle";
import { canEditDoc } from "@/lib/wiki/edit-policy";
import { useEditableBlock } from "@/hooks/useEditableBlock";
import { SourceSwitcherHint } from "../SourceSwitcher";
import { BlockReleaseStrip } from "../BlockReleaseStrip";
import type { DocSource } from "@/lib/clients/registry";
import Link from "next/link";
import { hrefWithDoc } from "@/lib/wiki/doc-param";
import { PageHeader } from "./PageHeader";

interface IntroForm {
  name: string;
  tagline: string;
  overview: string;
}

export function IntroductionPage({
  system,
  ir,
  meta,
  sources,
  docFileName,
  lifecycle = "preview",
}: {
  system: DesignSystem & { mode?: string; sections?: MarkdownSection[] };
  ir: DesignIR;
  meta: {
    displayName: string;
    sourceLabel: string;
    parser: string;
  };
  sources?: DocSource[];
  docFileName: string;
  lifecycle?: DocLifecycle;
}) {
  const fileName = docFileName;
  const isWorkspaceScan = system.mode === "workspace-scan";
  const isStructured = system.mode === "apollo";
  const brandColors = system.colors
    .filter((c) => c.value.startsWith("#"))
    .slice(0, 4);
  const heroBg = ir.preview.pageBackground;
  const accentHex = ir.preview.accent.toLowerCase();
  const firstComponent = system.components[0];

  const policy = canEditDoc(lifecycle, docFileName);
  const canEditThis = policy.canEdit && system.mode !== "generic";

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
  } = useEditableBlock<IntroForm>(
    docFileName,
    "page:introduction",
    {
      name: system.name,
      tagline: system.tagline ?? "",
      overview: system.overview ?? "",
    },
    system.contentHash || "",
  );

  const [form, setForm] = useState<IntroForm>({
    name: "",
    tagline: "",
    overview: "",
  });

  useEffect(() => {
    if (isEditing) {
      setForm({
        name: currentData.name || system.name,
        tagline: currentData.tagline || system.tagline || "",
        overview: currentData.overview || system.overview || "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  const displayName = hasDraft ? currentData.name : system.name;
  const displayTagline = hasDraft ? currentData.tagline : system.tagline;
  const displayOverview = hasDraft ? currentData.overview : system.overview;

  return (
    <article>
      {(isStructured || isWorkspaceScan) && brandColors.length > 0 ? (
        <div
          className="design-preview apollo-preview -mx-4 mb-10 overflow-hidden sm:mx-0"
          style={{ borderRadius: "var(--wiki-radius-card, 16px)" }}
        >
          <div
            className="grid min-h-[200px] grid-cols-2 sm:grid-cols-4"
            style={{ backgroundColor: heroBg }}
          >
            {brandColors.map((c) => (
              <Link
                key={c.cssVar}
                href={hrefWithDoc("/wiki/foundation/color", fileName)}
                className="group flex min-h-[120px] flex-col justify-end p-4 transition hover:opacity-90"
                style={{ backgroundColor: c.value }}
              >
                <span
                  className={`font-mono text-xs font-semibold ${
                    c.value === "#000000" ||
                    c.value.toLowerCase() === accentHex
                      ? c.value === "#000000"
                        ? "text-white"
                        : "text-black"
                      : "text-black/70"
                  }`}
                >
                  {c.name || c.cssVar.replace("--color-", "")}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <PageHeader
        title={displayName}
        description={isWorkspaceScan ? undefined : displayOverview}
        status="draft"
        updatedAt={isWorkspaceScan ? undefined : system.updatedAt}
        source={isWorkspaceScan ? undefined : meta.sourceLabel}
        blockId={canEditThis ? "page:introduction" : undefined}
        isEditing={isEditing}
        hasDraft={hasDraft}
        hasConflict={hasConflict}
        loading={loading}
        onEditToggle={() => setIsEditing(true)}
        onFinalize={(force) => finalize(force)}
        onDiscard={discardDraft}
      />
      {displayTagline && !isEditing ? (
        <p className="-mt-4 mb-8 text-lg text-[var(--wiki-muted)]">{displayTagline}</p>
      ) : null}

      {!policy.canEdit && policy.reason && system.mode !== "generic" ? (
        <p className="mb-4 rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] px-4 py-2.5 text-xs text-[var(--wiki-muted)]">
          {policy.reason}
        </p>
      ) : null}

      {policy.canPromote && system.mode !== "generic" ? (
        <BlockReleaseStrip docFileName={docFileName} blockId="page:introduction" />
      ) : null}

      {error && (
        <div className="mb-4 text-xs font-semibold text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {isEditing ? (
        <div className="mb-8 space-y-4 rounded-xl border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] p-6">
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
            <span className="mb-1 block text-xs font-semibold">Tagline</span>
            <input
              type="text"
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              className="w-full rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--wiki-accent)]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold">Overview</span>
            <textarea
              value={form.overview}
              onChange={(e) => setForm({ ...form, overview: e.target.value })}
              rows={5}
              className="w-full rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] px-3 py-1.5 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-[var(--wiki-accent)]"
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
                  tagline: form.tagline.trim(),
                  overview: form.overview.trim(),
                })
              }
              className="rounded-lg bg-[var(--wiki-text)] px-4 py-2 text-xs font-semibold text-[var(--wiki-bg)] hover:opacity-90 transition"
            >
              Save Draft
            </button>
          </div>
        </div>
      ) : null}

      {isWorkspaceScan && system.scanCoverage ? (
        <>
          <p className="mb-6 rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] px-4 py-3 text-sm text-[var(--wiki-muted)]">
            {system.scanCoverage.reactFiles} React files · {system.scanCoverage.featuredComponents} featured —{" "}
            <Link
              href={hrefWithDoc("/wiki/inventory", fileName)}
              className="font-medium text-[var(--wiki-text)] underline hover:text-[var(--wiki-accent)]"
            >
              full inventory
            </Link>
          </p>
          {system.scanCoverage.reactFiles >= 10 &&
          system.scanCoverage.featuredComponents <
            Math.max(3, Math.floor(system.scanCoverage.reactFiles * 0.2)) ? (
            <p className="mb-6 rounded-lg border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
              <strong>Few featured components.</strong> Add <code className="text-xs">catalogPaths</code> in{" "}
              <code className="text-xs">blocksmith.config.json</code>, or browse the{" "}
              <Link href={hrefWithDoc("/wiki/inventory", fileName)} className="font-medium underline">inventory</Link>.
            </p>
          ) : null}
        </>
      ) : null}

      {isStructured ? (
        <div className="mt-8 flex flex-wrap gap-3">
          <QuickLink href={hrefWithDoc("/wiki/foundation/color", fileName)} label="Colors" />
          <QuickLink href={hrefWithDoc("/wiki/foundation/typography", fileName)} label="Typography" />
          {firstComponent ? (
            <QuickLink
              href={hrefWithDoc(`/wiki/components/${firstComponent.id}`, fileName)}
              label="Components"
            />
          ) : null}
          <QuickLink href={hrefWithDoc("/wiki/guidelines", fileName)} label="Guidelines" />
          <QuickLink href={hrefWithDoc("/studio", fileName)} label="Component Studio" />
        </div>
      ) : "sections" in system &&
        system.sections &&
        system.sections.length > 0 ? (
        <div className="mt-8 flex flex-wrap gap-3">
          {system.nav
            .flatMap((g) => g.items)
            .filter((i) => i.id !== "introduction")
            .slice(0, 8)
            .map((item) => (
              <QuickLink
                key={item.id}
                href={hrefWithDoc(item.href, fileName)}
                label={item.label}
              />
            ))}
        </div>
      ) : null}

      {sources ? (
        <div className="mt-6">
          <SourceSwitcherHint sources={sources} />
        </div>
      ) : null}

      <dl className="mt-10 grid gap-4 sm:grid-cols-2">
        <MetaCard label="Parser" value={meta.parser} />
        <MetaCard label="Source" value={meta.sourceLabel} />
        <MetaCard
          label="Last synced"
          value={new Date(system.updatedAt).toLocaleString()}
        />
        <MetaCard
          label="Mode"
          value={
            system.mode === "workspace-scan"
              ? "Workspace scan wiki"
              : system.mode === "generic"
                ? "Generic markdown"
                : `Structured design system (${system.name})`
          }
        />
      </dl>
    </article>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="wiki-cta-primary text-sm transition">
      {label} →
    </Link>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="wiki-surface-card p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--wiki-muted)]">
        {label}
      </dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  );
}
