"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import type { ComponentDoc, DesignSystem } from "@/lib/blocks/types";
import { ShareBlockPanel } from "@/components/share/ShareBlockPanel";
import { ComponentLivePreview } from "../visual/ComponentLivePreview";
import { PageHeader } from "./PageHeader";
import { useEditableBlock } from "@/hooks/useEditableBlock";
import { ComponentActivityPanel } from "../ComponentActivityPanel";
import { ScannedComponentPanel } from "../ScannedComponentPanel";
import { ScannedComponentLivePreview } from "../ScannedComponentLivePreview";
import type { ActivityEntry } from "@/lib/activity/store";
import { canPreviewScannedComponent, isScannedComponent } from "@/lib/scan/parse";
import { canRenderLocalScannedPreview } from "@/lib/scan/local-preview";
import { useScanDocContentHash } from "../ScanConflictHint";
import { ScanPullHint } from "../ScanPullHint";
import { ComponentGovernanceEditPanel } from "../ComponentGovernanceEditPanel";
import { GovernanceCopilotPanel } from "../GovernanceCopilotPanel";
import { BlockReleaseStrip } from "../BlockReleaseStrip";

export function ComponentDetailPage({
  system,
  component,
  docFileName,
  activity = [],
  sourceExcerpt,
}: {
  system: DesignSystem;
  component: ComponentDoc;
  docFileName: string;
  activity?: ActivityEntry[];
  sourceExcerpt?: string | null;
}) {
  const scanned = isScannedComponent(component);
  // Workspace-scan wikis are editable for Goal 2 — curated .md may omit scanCoverage frontmatter
  const isWorkspaceScanWiki =
    Boolean(system.scanInventory?.length) || Boolean(system.scanWorkspaceRoot);
  const scanProseEditable = scanned && isWorkspaceScanWiki;
  // Poll for stale-banner only — using this as edit base hash causes false "Conflict" UI
  useScanDocContentHash(scanProseEditable ? docFileName : "");
  const localPreview = scanned && canRenderLocalScannedPreview(component);
  const showTokenPreview =
    !localPreview && (!scanned || canPreviewScannedComponent(component));
  const [showPullHint, setShowPullHint] = useState(false);

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
    `component:${component.id}`,
    { role: component.role, description: component.description },
    system.contentHash || "",
    {
      onFinalizeSuccess: () => {
        if (scanProseEditable && docFileName.startsWith("upload:")) {
          setShowPullHint(true);
        }
      },
    },
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

  const applyCopilotDraft = (role: string, description: string) => {
    setEditRole(role);
    setEditDesc(description);
    if (!isEditing) {
      setIsEditing(true);
    }
  };

  const updatedComponent = {
    ...component,
    role: currentData.role,
    description: currentData.description,
  };

  return (
    <article>
      <PageHeader
        title={component.title}
        description={currentData.role}
        status={scanProseEditable && hasDraft ? "draft" : "finalized"}
        updatedAt={system.updatedAt}
        blockId={
          scanned && !scanProseEditable
            ? undefined
            : `component:${component.id}`
        }
        isEditing={scanProseEditable ? isEditing : scanned ? false : isEditing}
        hasDraft={scanProseEditable ? hasDraft : scanned ? false : hasDraft}
        hasConflict={
          scanProseEditable ? hasConflict : scanned ? false : hasConflict
        }
        loading={loading}
        onEditToggle={
          scanProseEditable || !scanned ? () => setIsEditing(true) : undefined
        }
        onFinalize={
          scanProseEditable || !scanned
            ? (force) => finalize(force)
            : undefined
        }
        onDiscard={
          scanProseEditable || !scanned ? discardDraft : undefined
        }
      />

      <BlockReleaseStrip
        docFileName={docFileName}
        blockId={`component:${component.id}`}
      />

      <ScanPullHint
        docRef={docFileName}
        suggestedWorkspace={system.scanWorkspaceRoot}
        visible={showPullHint}
      />

      {error && (
        <div className="mb-4 text-xs font-semibold text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          {success}{" "}
          <Link href={`/wiki/pipeline?doc=${encodeURIComponent(docFileName)}`} className="underline">
            Open Pipeline →
          </Link>
        </div>
      )}

      {isEditing && scanProseEditable ? (
        <ComponentGovernanceEditPanel
          component={component}
          system={system}
          docFileName={docFileName}
          editRole={editRole}
          editDesc={editDesc}
          onRoleChange={setEditRole}
          onDescChange={setEditDesc}
          onCancel={() => setIsEditing(false)}
          onSave={handleSave}
        />
      ) : isEditing ? (
        <div className="mt-8 space-y-4 rounded-xl border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] p-6">
          <div>
            <label htmlFor="compRoleInput" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--wiki-muted)]">
              Component role
            </label>
            <input
              id="compRoleInput"
              type="text"
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
              className="w-full rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="compDescTextarea" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--wiki-muted)]">
              Description
            </label>
            <textarea
              id="compDescTextarea"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={6}
              className="w-full rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] p-3 text-sm"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setIsEditing(false)} className="rounded-lg border px-4 py-2 text-xs font-semibold">
              Cancel
            </button>
            <button type="button" onClick={handleSave} className="rounded-lg bg-[var(--wiki-accent)] px-4 py-2 text-xs font-semibold text-black">
              Save draft
            </button>
          </div>
        </div>
      ) : (
        <>
          {scanProseEditable ? (
            <div className="mt-8">
              <GovernanceCopilotPanel
                component={component}
                docFileName={docFileName}
                currentRole={currentData.role}
                currentDescription={currentData.description}
                onApply={applyCopilotDraft}
                compact
              />
            </div>
          ) : null}

          {localPreview || showTokenPreview ? (
            <div className="mt-8">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-[var(--wiki-muted)]">
                Live preview
              </p>
              {localPreview ? (
                <ScannedComponentLivePreview
                  component={component}
                  system={system}
                  docFileName={docFileName}
                />
              ) : (
                <>
                  <p className="mb-4 text-xs text-[var(--wiki-muted)]">
                    Token-based preview.
                  </p>
                  <ComponentLivePreview
                    component={updatedComponent}
                    system={system}
                  />
                </>
              )}
            </div>
          ) : scanned ? (
            <div className="mt-8 rounded-lg border border-dashed border-[var(--wiki-border)] px-4 py-3 text-sm text-[var(--wiki-muted)]">
              No visual preview available for this component yet.
            </div>
          ) : (
            <div className="mt-8">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-[var(--wiki-muted)]">
                Live preview
              </p>
              <ComponentLivePreview component={updatedComponent} system={system} />
            </div>
          )}

          {scanned ? (
            <details className="mt-8 rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--wiki-text)]">
                Scan details (for engineers)
              </summary>
              <div className="mt-4">
                <ScannedComponentPanel
                  component={component}
                  sourceExcerpt={sourceExcerpt}
                />
              </div>
            </details>
          ) : null}

          <ShareBlockPanel
            docFileName={docFileName}
            blockKind="component"
            blockId={component.id}
            blockTitle={component.title}
          />

          {(scanProseEditable || !scanned) && currentData.description ? (
            <div className="mt-8 max-w-2xl">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--wiki-muted)]">
                {scanProseEditable ? "Designer notes" : "Spec"}
              </p>
              <p className="text-sm leading-relaxed text-[var(--wiki-muted)]">
                {currentData.description}
              </p>
            </div>
          ) : null}

          <ComponentActivityPanel
            entries={activity}
            docFileName={docFileName}
            componentTitle={component.title}
          />
        </>
      )}
    </article>
  );
}
