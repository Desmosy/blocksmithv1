"use client";

import type { ComponentDoc, DesignSystem } from "@/lib/blocks/types";
import { ScannedComponentLivePreview } from "./ScannedComponentLivePreview";
import { ComponentLivePreview } from "./visual/ComponentLivePreview";
import { canRenderLocalScannedPreview } from "@/lib/scan/local-preview";
import { canPreviewScannedComponent, isScannedComponent } from "@/lib/scan/parse";
import { GovernanceCopilotPanel } from "./GovernanceCopilotPanel";

type Props = {
  component: ComponentDoc;
  system: DesignSystem;
  docFileName: string;
  editRole: string;
  editDesc: string;
  onRoleChange: (v: string) => void;
  onDescChange: (v: string) => void;
  onCancel: () => void;
  onSave: () => void;
};

function designMdPreview(
  componentTitle: string,
  componentId: string,
  role: string,
  description: string,
): string {
  const title =
    componentTitle ||
    componentId.charAt(0).toUpperCase() + componentId.slice(1);
  return `## ${title}

**Role:** ${role.trim() || "(empty)"}

${description.trim() || "(no usage notes yet)"}

<!-- blocksmith-end-${componentId} -->`;
}

export function ComponentGovernanceEditPanel({
  component,
  system,
  docFileName,
  editRole,
  editDesc,
  onRoleChange,
  onDescChange,
  onCancel,
  onSave,
}: Props) {
  const scanned = isScannedComponent(component);
  const localPreview = scanned && canRenderLocalScannedPreview(component);
  const tokenPreview =
    !localPreview && (!scanned || canPreviewScannedComponent(component));
  const previewComponent = {
    ...component,
    role: editRole,
    description: editDesc,
  };

  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm text-[var(--wiki-text)]">
        <p className="font-medium">Governance — not Figma</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--wiki-muted)]">
          You are setting <strong className="text-[var(--wiki-text)]">rules</strong>{" "}
          for when and how to use {component.title}: what agents and engineers must
          follow in <code className="font-mono text-[11px]">DESIGN.md</code>. Colors,
          spacing, and variants come from <strong className="text-[var(--wiki-text)]">code</strong>{" "}
          (preview below) — saving only changes human-facing policy. Saved edits
          land in <strong className="text-[var(--wiki-text)]">Staging</strong>;
          promote them to Production on the Pipeline.
        </p>
      </div>

      <GovernanceCopilotPanel
        component={component}
        docFileName={docFileName}
        currentRole={editRole}
        currentDescription={editDesc}
        onApply={(role, description) => {
          onRoleChange(role);
          onDescChange(description);
        }}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--wiki-muted)]">
            What you are changing
          </p>

          <div>
            <label
              htmlFor="compRoleInput"
              className="mb-1 block text-sm font-medium text-[var(--wiki-text)]"
            >
              When to use this component
            </label>
            <p className="mb-2 text-xs text-[var(--wiki-muted)]">
              One line — primary CTA, form labels, destructive actions only, etc.
            </p>
            <input
              id="compRoleInput"
              type="text"
              value={editRole}
              onChange={(e) => onRoleChange(e.target.value)}
              className="w-full rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--wiki-accent)]"
              placeholder="e.g. Primary actions on marketing pages — max one per view"
            />
          </div>

          <div>
            <label
              htmlFor="compDescTextarea"
              className="mb-1 block text-sm font-medium text-[var(--wiki-text)]"
            >
              Usage rules, do&apos;s & don&apos;ts
            </label>
            <p className="mb-2 text-xs text-[var(--wiki-muted)]">
              What designers and agents must respect — not pixel specs.
            </p>
            <textarea
              id="compDescTextarea"
              value={editDesc}
              onChange={(e) => onDescChange(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] p-3 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-[var(--wiki-accent)]"
              placeholder={`Do: use for main submit actions\nDon't: stack two primary buttons\nPair with: Secondary for cancel`}
            />
          </div>

          {scanned && component.scan ? (
            <div className="rounded-lg border border-dashed border-[var(--wiki-border)] bg-[var(--wiki-bg)] px-3 py-2 text-xs text-[var(--wiki-muted)]">
              <span className="font-medium text-[var(--wiki-text)]">From code (read-only): </span>
              <code className="font-mono">{component.scan.sourceFile}</code>
              {component.scan.cssVarsUsed.length > 0 ? (
                <span>
                  {" "}
                  · tokens: {component.scan.cssVarsUsed.slice(0, 4).join(", ")}
                  {component.scan.cssVarsUsed.length > 4 ? "…" : ""}
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-[var(--wiki-border)] px-4 py-2 text-xs font-semibold hover:bg-[var(--wiki-active)] transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              className="rounded-lg bg-[var(--wiki-accent)] px-4 py-2 text-xs font-semibold text-black hover:opacity-90 transition"
            >
              Save draft
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--wiki-muted)]">
              Live component (from repo scan)
            </p>
            {localPreview ? (
              <ScannedComponentLivePreview
                component={previewComponent}
                system={system}
                docFileName={docFileName}
              />
            ) : tokenPreview ? (
              <ComponentLivePreview component={previewComponent} system={system} />
            ) : (
              <p className="text-sm text-[var(--wiki-muted)]">
                No visual preview for this component yet.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--wiki-muted)]">
              Preview — DESIGN.md section after save
            </p>
            <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--wiki-bg)] p-3 font-mono text-[11px] leading-relaxed text-[var(--wiki-text)]">
              {designMdPreview(component.title, component.id, editRole, editDesc)}
            </pre>
            <p className="mt-2 text-[11px] text-[var(--wiki-muted)]">
              After promoting to Production, run{" "}
              <code className="font-mono">blocksmith pull --doc {docFileName}</code>{" "}
              in your repo so Cursor/agents read this file.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
