"use client";

/**
 * Releases — the wiki's release console (Stream A spine).
 *
 * What's live, what's waiting, what re-scan broke, what the lock says, what
 * @blocksmith/<product> was built from. Promote and rollback are one click;
 * history is never erased. Agents never see anything this screen hasn't
 * promoted.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IconCheck, IconLock } from "@/components/icons/streamline";
import { BlockStatusBadge } from "../BlockStatusBadge";
import type { ReleaseRow, ReleaseTable } from "@/lib/ir/releases";
import { useCopyToClipboard } from "usehooks-ts";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";

export function ReleasesPage({ docFileName }: { docFileName: string }) {
  const [table, setTable] = useState<ReleaseTable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showLock, setShowLock] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/wiki/releases?doc=${encodeURIComponent(docFileName)}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      setTable((await res.json()) as ReleaseTable);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load releases");
    }
  }, [docFileName]);

  useEffect(() => {
    void load();
  }, [load]);

  const promotable = useMemo(
    () => table?.rows.filter((r) => r.canPromote) ?? [],
    [table],
  );
  const releaseRows = useReactTable({
    data: table?.rows ?? [],
    columns: useMemo(() => [{ accessorKey: "id", header: "Block" }], []),
    getCoreRowModel: getCoreRowModel(),
  });

  async function promote(blockIds: string[], resolveConflicts = false) {
    setBusy("promote");
    setNotice(null);
    try {
      const res = await fetch("/api/wiki/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc: docFileName, blockIds, resolveConflicts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Promote failed");
      const n = data.promoted?.length ?? 0;
      setNotice(`Promoted ${n} block${n === 1 ? "" : "s"} → lock ${data.lockHash}.`);
      setSelected(new Set());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Promote failed");
    } finally {
      setBusy(null);
    }
  }

  async function rollback(blockId: string) {
    setBusy(blockId);
    setNotice(null);
    try {
      const res = await fetch("/api/wiki/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc: docFileName, blockId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Rollback failed");
      setNotice(`${blockId} rolled back to v${data.rolledBackTo} → lock ${data.lockHash}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rollback failed");
    } finally {
      setBusy(null);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (error && !table) {
    return (
      <article>
        <h1 className="text-3xl font-semibold tracking-tight">Releases</h1>
        <p className="mt-4 text-sm text-red-500">{error}</p>
      </article>
    );
  }

  if (!table) {
    return (
      <article>
        <h1 className="text-3xl font-semibold tracking-tight">Releases</h1>
        <p className="mt-4 text-sm text-[var(--wiki-muted)]">Loading release state…</p>
      </article>
    );
  }

  const { counts, lock } = table;

  return (
    <article>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Releases{" "}
            <span className="text-base font-normal text-[var(--wiki-muted)]">
              (table view)
            </span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--wiki-muted)]">
            Agents and CI compile from promoted versions only.{" "}
            <Link href="/wiki/pipeline" className="font-medium underline underline-offset-2">
              Visual Pipeline →
            </Link>
          </p>
        </div>
        {promotable.length > 0 && (
          <button
            onClick={() =>
              promote(
                (selected.size ? [...selected] : promotable.map((r) => r.id)),
                true,
              )
            }
            disabled={busy !== null}
            className="rounded-lg bg-[var(--wiki-text)] px-4 py-2 text-sm font-semibold text-[var(--wiki-bg)] hover:opacity-90 disabled:opacity-50"
          >
            {busy === "promote"
              ? "Promoting…"
              : selected.size
                ? `Promote ${selected.size} selected`
                : `Promote all waiting (${promotable.length})`}
          </button>
        )}
      </div>

      {/* Pipeline summary */}
      <div className="mt-6 flex flex-wrap gap-3">
        <SummaryChip label="Live" value={counts.live} tone="#16a34a" />
        <SummaryChip label="Drafts waiting" value={counts.draftsWaiting} tone="#ca8a04" />
        <SummaryChip label="Stale" value={counts.stale} tone="#ea580c" />
        <SummaryChip label="Conflicts" value={counts.conflicts} tone="#dc2626" />
        <SummaryChip label="Never promoted" value={counts.neverPromoted} tone="#71717a" />
      </div>

      {/* Lock banner */}
      <div
        className="mt-6 rounded-xl border p-4 text-sm"
        style={{
          borderColor: lock.present && lock.fresh ? "rgba(34,197,94,0.4)" : "rgba(249,115,22,0.4)",
          backgroundColor: lock.present && lock.fresh ? "rgba(34,197,94,0.06)" : "rgba(249,115,22,0.06)",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-2 font-semibold">
              {lock.present && lock.fresh ? (
                <IconLock size={14} />
              ) : null}
              {lock.present
                ? lock.fresh
                  ? "Lock fresh"
                  : "Lock stale — versions were promoted after it was written"
                : "No lock written yet — agents are unpinned"}
            </span>
            <span className="ml-3 font-mono text-xs text-[var(--wiki-muted)]">
              graph {table.graphHash}
            </span>
            {lock.present && (
              <span className="ml-3 text-xs text-[var(--wiki-muted)]">
                {lock.pinnedBlocks} blocks pinned
                {lock.generatedAt
                  ? ` · ${formatDateTime(lock.generatedAt)}`
                  : ""}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowLock((s) => !s)}
            className="rounded-md border border-[var(--wiki-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--wiki-active)]"
          >
            {showLock ? "Hide" : "View"} blocksmith.lock
          </button>
        </div>
        {!lock.fresh && lock.drift && (
          <ul className="mt-2 list-disc pl-5 text-xs text-[var(--wiki-muted)]">
            {lock.drift.versionMismatches.slice(0, 5).map((m) => (
              <li key={m.id}>
                <code className="font-mono">{m.id}</code>: locked v{m.locked},
                official is v{m.official}
              </li>
            ))}
            {lock.drift.missingInLock.slice(0, 5).map((id) => (
              <li key={id}>
                <code className="font-mono">{id}</code>: promoted but not pinned
              </li>
            ))}
          </ul>
        )}
        {showLock && (
          <div className="relative mt-3">
            <CopyButton text={table.lockBody} label="Copy lock" />
            <pre className="max-h-72 overflow-auto rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] p-3 text-xs leading-relaxed">
              {table.lockBody}
            </pre>
          </div>
        )}
      </div>

      {notice && (
        <p className="mt-4 rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-2 text-sm text-green-600">
          {notice}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-2 text-sm text-red-500">
          {error}
        </p>
      )}

      {/* Release table */}
      <div className="mt-8 overflow-x-auto rounded-xl border border-[var(--wiki-border)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] text-xs uppercase tracking-wide text-[var(--wiki-muted)]">
            <tr>
              <th className="px-3 py-2.5 w-8"></th>
              <th className="px-3 py-2.5">Block</th>
              <th className="px-3 py-2.5">State</th>
              <th className="px-3 py-2.5">Production</th>
              <th className="px-3 py-2.5">Latest</th>
              <th className="px-3 py-2.5">Last promote</th>
              <th className="px-3 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {releaseRows.getRowModel().rows.map(({ original: row }) => (
              <ReleaseRowView
                key={row.id}
                row={row}
                selected={selected.has(row.id)}
                onToggle={() => toggle(row.id)}
                expanded={expanded === row.id}
                onExpand={() =>
                  setExpanded((e) => (e === row.id ? null : row.id))
                }
                busy={busy}
                onPromote={() => promote([row.id], row.conflict)}
                onRollback={() => rollback(row.id)}
              />
            ))}
            {releaseRows.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-[var(--wiki-muted)]">
                  No blocks yet — scan a repo to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <HandshakePanel table={table} docFileName={docFileName} />
    </article>
  );
}

function ReleaseRowView({
  row,
  selected,
  onToggle,
  expanded,
  onExpand,
  busy,
  onPromote,
  onRollback,
}: {
  row: ReleaseRow;
  selected: boolean;
  onToggle: () => void;
  expanded: boolean;
  onExpand: () => void;
  busy: string | null;
  onPromote: () => void;
  onRollback: () => void;
}) {
  const state = row.conflict
    ? "conflict"
    : row.stale
      ? "stale"
      : row.draftPending || row.official == null
        ? "draft"
        : "finalized";

  return (
    <>
      <tr className="border-b border-[var(--wiki-border)] last:border-0 hover:bg-[var(--wiki-active)]/40">
        <td className="px-3 py-2.5">
          {row.canPromote && (
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggle}
              aria-label={`Select ${row.id}`}
            />
          )}
        </td>
        <td className="px-3 py-2.5">
          <button onClick={onExpand} className="text-left">
            <span className="font-medium">{row.title}</span>
            <span className="ml-2 font-mono text-xs text-[var(--wiki-muted)]">
              {row.id}
            </span>
          </button>
        </td>
        <td className="px-3 py-2.5">
          <BlockStatusBadge
            status={state}
            label={state === "finalized" ? "Live" : undefined}
          />
        </td>
        <td className="px-3 py-2.5 font-mono text-xs">
          {row.official != null ? `v${row.official}` : "—"}
        </td>
        <td className="px-3 py-2.5 font-mono text-xs">
          v{row.latest}
          {row.draftPending && (
            <span className="ml-1.5 text-[10px] font-semibold uppercase text-[#ca8a04]">
              waiting
            </span>
          )}
        </td>
        <td className="px-3 py-2.5 text-xs text-[var(--wiki-muted)]">
          {row.lastPromotedAt
            ? formatDate(row.lastPromotedAt)
            : "never"}
          {row.latestEditedBy ? ` · via ${row.latestEditedBy}` : ""}
        </td>
        <td className="px-3 py-2.5 text-right">
          <div className="inline-flex gap-2">
            {row.canPromote && (
              <button
                onClick={onPromote}
                disabled={busy !== null}
                className="rounded-md bg-[var(--wiki-text)] px-2.5 py-1 text-xs font-semibold text-[var(--wiki-bg)] hover:opacity-90 disabled:opacity-50"
              >
                {row.conflict ? "Resolve & promote" : "Promote"}
              </button>
            )}
            {row.canRollback && (
              <button
                onClick={onRollback}
                disabled={busy !== null}
                className="rounded-md border border-[var(--wiki-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--wiki-active)] disabled:opacity-50"
              >
                {busy === row.id ? "Rolling back…" : "Rollback"}
              </button>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-[var(--wiki-border)] bg-[var(--wiki-sidebar)]/60">
          <td colSpan={7} className="px-6 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--wiki-muted)]">
              Version history (append-only)
            </p>
            <ul className="mt-2 space-y-1 text-xs">
              {row.history.map((h) => (
                <li key={h.version} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold">v{h.version}</span>
                  <BlockStatusBadge status={h.status} compact />
                  <span className="text-[var(--wiki-muted)]">
                    {h.status}
                    {h.version === row.official ? " · official ←" : ""}
                  </span>
                  <span className="text-[var(--wiki-muted)]">
                    {formatDateTime(h.createdAt)}
                  </span>
                  {h.editedBy && (
                    <span className="text-[var(--wiki-muted)]">via {h.editedBy}</span>
                  )}
                  <span className="font-mono text-[var(--wiki-muted)]">
                    {h.contentHash.slice(0, 18)}…
                  </span>
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}

/** Sync handshake — pull command, lock, package, CI, MCP. Zero tribal knowledge. */
export function HandshakePanel({
  table,
  docFileName,
}: {
  table: Pick<ReleaseTable, "packageName">;
  docFileName: string;
}) {
  const pullCmd = `blocksmith pull --doc ${docFileName}`;
  const ciSnippet = `# .github/workflows/validate-ui.yml — gate PRs on the design lock
- run: npm run validate:ui -- --range "origin/\${{ github.base_ref }}...HEAD"`;
  const mcpUrl = "/api/mcp  (Bearer bs_live_…  ·  tools read promoted versions only)";

  return (
    <section className="mt-10 rounded-xl border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] p-5">
      <h2 className="text-sm font-semibold">Handshake</h2>
      <p className="mt-1 text-xs text-[var(--wiki-muted)]">
        Consume promoted versions in your repo and CI.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <HandshakeItem
          label="1 · Pull the lock into your repo"
          value={pullCmd}
          copy={pullCmd}
        />
        <HandshakeItem
          label="2 · Import the package"
          value={`import { Button } from "${table.packageName}"`}
          copy={`import { Button } from "${table.packageName}"`}
        />
        <HandshakeItem
          label="3 · Gate CI on the lock"
          value={ciSnippet}
          copy={ciSnippet}
          mono
        />
        <HandshakeItem label="4 · Point agents at MCP" value={mcpUrl} copy="/api/mcp" />
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-xs">
        <a
          href={`/demo/device?doc=${encodeURIComponent(docFileName)}`}
          className="rounded-md border border-[var(--wiki-border)] px-3 py-1.5 font-medium hover:bg-[var(--wiki-active)]"
        >
          Preview on device frames →
        </a>
        <a
          href="/schema/blocksmith.blocks.v1.json"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-[var(--wiki-border)] px-3 py-1.5 font-medium hover:bg-[var(--wiki-active)]"
        >
          blocks.v1 schema →
        </a>
        <a
          href="/schema/blocksmith.lock.v1.json"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-[var(--wiki-border)] px-3 py-1.5 font-medium hover:bg-[var(--wiki-active)]"
        >
          lock.v1 schema →
        </a>
      </div>
    </section>
  );
}

function HandshakeItem({
  label,
  value,
  copy,
  mono,
}: {
  label: string;
  value: string;
  copy: string;
  mono?: boolean;
}) {
  return (
    <div className="relative rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--wiki-muted)]">
        {label}
      </p>
      <pre
        className={`mt-1.5 overflow-x-auto whitespace-pre-wrap text-xs ${mono ? "font-mono" : "font-mono"}`}
      >
        {value}
      </pre>
      <CopyButton text={copy} label="Copy" />
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const [, copy] = useCopyToClipboard();
  return (
    <button
      onClick={() => {
        void copy(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="absolute right-2 top-2 rounded-md border border-[var(--wiki-border)] bg-[var(--wiki-bg)] px-2 py-1 text-[11px] font-medium hover:bg-[var(--wiki-active)]"
    >
      {copied ? (
        <span className="inline-flex items-center gap-1">
          <IconCheck size={12} />
          Copied
        </span>
      ) : (
        label
      )}
    </button>
  );
}

function SummaryChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm"
      style={{ borderColor: `${tone}55`, color: value > 0 ? tone : "var(--wiki-muted)" }}
    >
      <span className="text-lg font-bold leading-none">{value}</span>
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}
