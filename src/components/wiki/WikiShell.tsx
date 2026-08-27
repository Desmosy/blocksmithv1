"use client";

import { Suspense, useMemo, useState, useEffect } from "react";
import type { LoadedDesignSystem } from "@/lib/clients/registry";
import type { DocSource } from "@/lib/clients/registry";
import { useVisualizeStyle } from "@/hooks/useVisualizeStyle";
import { useSyncEvents } from "@/hooks/useSyncEvents";
import type { DocLifecycle } from "@/lib/wiki/doc-lifecycle";
import { WikiRail } from "./WikiRail";
import { Sidebar } from "./Sidebar";
import { WikiWorkspaceBar } from "./WikiWorkspaceBar";
import { VisualizeStyleButton } from "./VisualizeStyleButton";
import { VisualizeLoadingOverlay } from "./VisualizeLoadingOverlay";
import { WikiBuildGate } from "./WikiBuildGate";
import { WikiAgentTools } from "./WikiAgentTools";
import { ProposedChanges } from "./ProposedChanges";
import { SyncToast } from "./SyncToast";
import { ScanStaleBanner } from "./ScanStaleBanner";
import { PostScanBanner } from "./PostScanBanner";
import { CaptureDraftBanner } from "./CaptureDraftBanner";
import { WikiEditBanner } from "./WikiEditBanner";

interface WikiShellProps {
  system: LoadedDesignSystem;
  sources: DocSource[];
  currentFileName: string;
  lifecycle: DocLifecycle;
  children: React.ReactNode;
}

function WikiShellInner({
  system,
  sources,
  currentFileName,
  lifecycle,
  children,
}: WikiShellProps) {
  const [isDark, setIsDark] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const sync = useSyncEvents(currentFileName);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(searchQuery), 120);
    return () => window.clearTimeout(id);
  }, [searchQuery]);

  const {
    canVisualize,
    hasTokens,
    aiConfigured,
    applied,
    loading,
    loadingStage,
    summary,
    aiWarning,
    toggle,
  } = useVisualizeStyle(system, currentFileName);

  useEffect(() => {
    if (applied) {
      document.documentElement.dataset.wikiDark = isDark ? "1" : "0";
    } else {
      document.documentElement.dataset.wikiDark = "";
    }
  }, [isDark, applied]);

  const filteredNav = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return system.nav;

    return system.nav
      .map((section) => ({
        ...section,
        items: section.items
          .map((item) => {
            const childHits =
              item.children?.filter((c) =>
                c.label.toLowerCase().includes(q),
              ) ?? [];
            const parentHit = item.label.toLowerCase().includes(q);
            if (!parentHit && childHits.length === 0) return null;
            return {
              ...item,
              children:
                parentHit || childHits.length === 0
                  ? item.children
                  : childHits,
            };
          })
          .filter((item): item is NonNullable<typeof item> => item != null),
      }))
      .filter((s) => s.items.length > 0);
  }, [system.nav, debouncedSearch]);

  return (
    <div className="apollo-tokens-root flex h-screen overflow-hidden">
      <WikiRail
        currentFileName={currentFileName}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
        canToggleTheme={applied}
      />
      <div className="flex min-w-0 flex-1 flex-col">
      <WikiWorkspaceBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        systemName={system.name}
        lifecycle={lifecycle}
        sources={sources}
        currentFileName={currentFileName}
        parser={
          system.mode === "workspace-scan" ||
          system.mode === "apollo" ||
          system.mode === "generic"
            ? system.mode
            : "generic"
        }
        styleApplied={applied}
        summary={
          aiWarning
            ? aiWarning
            : applied && canVisualize
              ? (summary ?? "Your design theme applied")
              : null
        }
        visualizeControl={
          <VisualizeStyleButton
            canVisualize={canVisualize}
            hasTokens={hasTokens}
            aiConfigured={aiConfigured}
            applied={applied}
            loading={loading}
            onClick={toggle}
          />
        }
      />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          sections={filteredNav}
          currentFileName={currentFileName}
          forceExpand={debouncedSearch.trim().length > 0}
        />
        <main
          className="relative min-h-0 flex-1 overflow-y-auto"
          style={{ backgroundColor: "var(--wiki-bg)" }}
        >
          <VisualizeLoadingOverlay open={loading} stage={loadingStage} />
          {/* Outside WikiBuildGate on purpose: the gate withholds children while
              a doc opens, and an agent arriving mid-build would find no tools. */}
          <div
            className="mx-auto px-8 pt-6 sm:px-10"
            style={{ maxWidth: "var(--wiki-content-max, 72rem)" }}
          >
            <WikiAgentTools
              docFileName={currentFileName}
              systemName={system.name}
              components={system.components.map((c) => c.title)}
            />
            {/* Sits above the page content on every wiki page: a change waiting
                on you should not be something you have to go find. */}
            <ProposedChanges docFileName={currentFileName} />
          </div>
          <div
            className="mx-auto px-8 pb-10 pt-4 sm:px-10"
            style={{ maxWidth: "var(--wiki-content-max, 72rem)" }}
          >
            <WikiBuildGate
              docFileName={currentFileName}
              systemName={system.name}
            >
              <PostScanBanner />
              <CaptureDraftBanner docFileName={currentFileName} />
              {system.mode === "workspace-scan" ? (
                <ScanStaleBanner docFileName={currentFileName} />
              ) : null}
              <WikiEditBanner
                docFileName={currentFileName}
                lifecycle={lifecycle}
              />
              {children}
            </WikiBuildGate>
          </div>
        </main>
      </div>
      <SyncToast message={sync.message} />
      </div>
    </div>
  );
}

export function WikiShell(props: WikiShellProps) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-[var(--wiki-muted)]">
          Loading wiki…
        </div>
      }
    >
      <WikiShellInner {...props} />
    </Suspense>
  );
}
