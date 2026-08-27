"use client";

import type { FC } from "react";
import type {
  FidelityCheck,
  FidelityReport,
  SystemDiff,
} from "@/ai-lab/08-governance";
import type { ActivityEntry } from "@/lib/activity/store";
import type { DesignSystem } from "@/lib/blocks/types";
import { IconCheck, IconDelete } from "@/components/icons";
import { ComponentActivityPanel } from "../ComponentActivityPanel";
import { GovernanceViolationsPanel } from "../GovernanceViolationsPanel";
import { GovernanceCheckPanel } from "../GovernanceCheckPanel";

const STATUS_BORDER: Record<FidelityCheck["status"], string> = {
  pass: "var(--wiki-text)",
  warn: "var(--wiki-muted)",
  fail: "var(--wiki-text)",
};
const STATUS_ICON: Record<
  FidelityCheck["status"],
  FC<{ size?: number; className?: string }>
> = {
  pass: IconCheck,
  warn: IconDelete,
  fail: IconDelete,
};

function ScoreRing({ score }: { score: number }) {
  const color = score >= 85 ? "#16a34a" : score >= 60 ? "#d97706" : "#dc2626";
  return (
    <div
      className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full"
      style={{ border: `4px solid ${color}` }}
    >
      <span className="text-2xl font-bold" style={{ color }}>
        {score}
      </span>
    </div>
  );
}

function CheckRow({ check }: { check: FidelityCheck }) {
  const StatusIcon = STATUS_ICON[check.status];
  return (
    <li className="flex items-start gap-3 py-2">
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
        style={{
          borderColor: STATUS_BORDER[check.status],
          color: "var(--wiki-text)",
        }}
      >
        <StatusIcon size={12} />
      </span>
      <div>
        <p className="text-sm font-medium text-[var(--wiki-text)]">{check.label}</p>
        <p className="text-xs text-[var(--wiki-muted)]">{check.detail}</p>
      </div>
    </li>
  );
}

function DriftList({ diff }: { diff: SystemDiff }) {
  const Row = ({ label, items }: { label: string; items: string[] }) =>
    items.length ? (
      <div className="mt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--wiki-muted)]">
          {label} ({items.length})
        </p>
        <ul className="mt-1 space-y-0.5">
          {items.map((i) => (
            <li key={i} className="text-sm text-[var(--wiki-text)]">
              {i}
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <h3 className="text-sm font-semibold text-[var(--wiki-text)]">Tokens</h3>
        <Row label="Added" items={diff.colors.added} />
        <Row label="Removed" items={diff.colors.removed} />
        <Row
          label="Changed"
          items={diff.colors.changed.map(
            (c) => `${c.name}: ${c.before} → ${c.after}`,
          )}
        />
        {diff.colors.added.length +
          diff.colors.removed.length +
          diff.colors.changed.length ===
        0 ? (
          <p className="mt-2 text-sm text-[var(--wiki-muted)]">No token changes.</p>
        ) : null}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-[var(--wiki-text)]">Components</h3>
        <Row label="Added" items={diff.components.added} />
        <Row label="Removed" items={diff.components.removed} />
        <Row
          label="Restyled"
          items={diff.components.changed.map(
            (c) => `${c.title} · ${c.field}: ${c.before} → ${c.after}`,
          )}
        />
        {diff.components.added.length +
          diff.components.removed.length +
          diff.components.changed.length ===
        0 ? (
          <p className="mt-2 text-sm text-[var(--wiki-muted)]">No component changes.</p>
        ) : null}
      </div>
    </div>
  );
}

export function GovernancePage({
  report,
  diff,
  previousLabel,
  system,
  docFileName = "apollo.md",
  teamActivity = [],
}: {
  report: FidelityReport;
  system: DesignSystem;
  diff: SystemDiff | null;
  previousLabel: string | null;
  docFileName?: string;
  teamActivity?: ActivityEntry[];
}) {
  return (
    <article>
      <h1 className="text-3xl font-semibold tracking-tight text-[var(--wiki-text)]">
        Governance
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--wiki-muted)]">
        Fidelity score and drift since the last version.
      </p>

      <GovernanceCheckPanel system={system} docFileName={docFileName} />

      {/* Fidelity */}
      <section className="mt-10 rounded-xl border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] p-6">
        <div className="flex items-center gap-6">
          <ScoreRing score={report.score} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--wiki-muted)]">
              Fidelity score
            </p>
            <p className="mt-1 text-lg font-medium text-[var(--wiki-text)]">
              {report.summary}
            </p>
          </div>
        </div>
        <ul className="mt-6 divide-y divide-[var(--wiki-border)]">
          {report.checks.map((c) => (
            <CheckRow key={c.id} check={c} />
          ))}
        </ul>
      </section>

      {/* Drift */}
      <section className="mt-8 rounded-xl border border-[var(--wiki-border)] p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-[var(--wiki-text)]">
            Drift since last version
          </h2>
          {previousLabel ? (
            <span className="text-xs text-[var(--wiki-muted)]">
              vs {previousLabel}
            </span>
          ) : null}
        </div>
        {!diff ? (
          <p className="text-sm text-[var(--wiki-muted)]">
            First version — drift will show after the next edit.
          </p>
        ) : !diff.hasChanges ? (
          <p className="text-sm text-[var(--wiki-muted)]">
            No changes since the previous recorded version.
          </p>
        ) : (
          <DriftList diff={diff} />
        )}
      </section>

      <GovernanceViolationsPanel docFileName={docFileName} />

      <ComponentActivityPanel
        entries={teamActivity}
        docFileName={docFileName}
        showComponent
        limit={15}
      />
    </article>
  );
}
