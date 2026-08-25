import type { DesignSystem } from "@/lib/blocks/types";
import type { DocSource } from "@/lib/clients/registry";
import { SourceSwitcherHint } from "../SourceSwitcher";
import { SyncStatusPanel } from "./SyncStatusPanel";
import { ScanPullHint } from "../ScanPullHint";
import { ApiKeysPanel } from "../ApiKeysPanel";
import { TeamPanel } from "../TeamPanel";
import { PublishCard } from "../PublishCard";
import { LockStatusCard } from "../LockStatusCard";
import { DeviationsQueuePanel } from "../DeviationsQueuePanel";
import { GovernanceSettingsPanel } from "../GovernanceSettingsPanel";

export function SyncPage({
  system,
  meta,
  sources,
  docFileName,
}: {
  system: DesignSystem & { mode?: string };
  meta: {
    displayName: string;
    sourceLabel: string;
    parser: string;
  };
  sources: DocSource[];
  docFileName?: string;
}) {
  const isScan = system.mode === "workspace-scan";

  return (
    <article>
      <h1 className="text-3xl font-semibold tracking-tight">Sync</h1>
      <p className="mt-4 max-w-xl text-sm text-[var(--wiki-muted)]">
        {isScan ? (
          <>Live sync between your IDE and the wiki. Promote edits on Pipeline, then pull to sync locally.</>
        ) : (
          <>File watcher pushes changes via SSE — no manual refresh needed.</>
        )}
      </p>

      <SourceSwitcherHint sources={sources} />

      {isScan && docFileName ? (
        <div className="mt-6">
          <ScanPullHint
            docRef={docFileName}
            suggestedWorkspace={system.scanWorkspaceRoot}
            visible
          />
        </div>
      ) : null}

      {/* Live sync status — client component */}
      <SyncStatusPanel />

      {/* Deviation queue — pending reviews with TTL countdown */}
      <DeviationsQueuePanel />

      {/* Production lock at a glance — full console at /wiki/releases */}
      {docFileName ? <LockStatusCard docFileName={docFileName} /> : null}

      <div className="mt-8 space-y-4">
        <StatusRow label="Client" value={meta.displayName} />
        <StatusRow label="Source" value={meta.sourceLabel} />
        <StatusRow label="Parser" value={meta.parser} />
        <StatusRow
          label="Last loaded"
          value={new Date(system.updatedAt).toLocaleString()}
        />
        <StatusRow label="Supported files" value={`${sources.length} .md in designs.md/`} />
      </div>



      <section className="mt-10 rounded-xl border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] p-5">
        <h2 className="text-sm font-semibold">Team workspace</h2>
        <p className="mt-2 text-xs text-[var(--wiki-muted)]">
          Invite by email. Access starts on first sign-in.
        </p>
        <div className="mt-4">
          <TeamPanel />
        </div>

        {/* Governance deviation settings — admin/owner only */}
        <GovernanceSettingsPanel />

        {docFileName ? (
          <div className="mt-6 border-t border-[var(--wiki-border)] pt-5">
            <h3 className="text-sm font-semibold">Public site</h3>
            <p className="mt-1 mb-3 text-xs text-[var(--wiki-muted)]">
              Admins and owners only.
            </p>
            <PublishCard docFileName={docFileName} />
          </div>
        ) : null}
      </section>

      <section className="mt-10 rounded-xl border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] p-5">
        <h2 className="text-sm font-semibold">API keys (CLI & MCP)</h2>
        <p className="mt-2 text-xs text-[var(--wiki-muted)]">
          For <code className="font-mono">blocksmith pull</code>, local scans, and Cursor MCP.
        </p>
        <div className="mt-4">
          <ApiKeysPanel />
        <p className="mt-3 text-xs text-[var(--wiki-muted)]">
          New teammate setup:{" "}
          <a
            href="https://github.com/Desmosy/blocksmith/blob/main/docs/FRIENDS-ONBOARDING.md"
            className="font-medium text-[var(--wiki-text)] underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            FRIENDS-ONBOARDING.md
          </a>
        </p>
        </div>
      </section>


    </article>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--wiki-border)] px-4 py-3 text-sm">
      <span className="text-[var(--wiki-muted)]">{label}</span>
      <span className="font-medium text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}

function SyncStep({
  number,
  title,
  description,
  status,
}: {
  number: number;
  title: string;
  description: string;
  status: "active" | "planned";
}) {
  return (
    <div className="flex gap-4 rounded-lg border border-[var(--wiki-border)] p-4">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
        style={{
          backgroundColor:
            status === "active"
              ? "rgba(34, 197, 94, 0.15)"
              : "var(--wiki-active)",
          color:
            status === "active" ? "#22c55e" : "var(--wiki-muted)",
        }}
      >
        {number}
      </div>
      <div>
        <p className="text-sm font-semibold">
          {title}
          {status === "active" ? (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-500">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
              Active
            </span>
          ) : (
            <span className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium text-[var(--wiki-muted)]" style={{ backgroundColor: "var(--wiki-active)" }}>
              Planned
            </span>
          )}
        </p>
        <p className="mt-1 text-sm text-[var(--wiki-muted)]">{description}</p>
      </div>
    </div>
  );
}
