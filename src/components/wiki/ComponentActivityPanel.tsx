import Link from "next/link";
import type {
  ActivityEntry,
  ActivityAction,
  ActivitySource,
} from "@/lib/activity/store";
import { hrefWithDoc } from "@/lib/wiki/doc-param";

const ACTION_LABEL: Record<ActivityAction, string> = {
  fix: "Fix",
  change: "Change",
  prompt: "Prompt",
  note: "Note",
};

const SOURCE_LABEL: Record<ActivitySource, string> = {
  mcp: "MCP",
  git: "Git",
};

const ACTION_STYLE: Record<ActivityAction, string> = {
  fix: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  change: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  prompt: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  note: "bg-[var(--wiki-active)] text-[var(--wiki-muted)]",
};

function formatWhen(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ActivityRow({
  entry,
  docFileName,
  showComponent,
}: {
  entry: ActivityEntry;
  docFileName: string;
  showComponent?: boolean;
}) {
  return (
    <li className="rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--wiki-muted)]">
        <span
          className={`rounded px-1.5 py-0.5 font-semibold uppercase tracking-wide ${ACTION_STYLE[entry.action]}`}
        >
          {ACTION_LABEL[entry.action]}
        </span>
        <span className="font-medium text-[var(--wiki-text)]">{entry.author}</span>
        <span aria-hidden>·</span>
        <time dateTime={entry.ts}>{formatWhen(entry.ts)}</time>
        {entry.source ? (
          <>
            <span aria-hidden>·</span>
            <span className="rounded bg-[var(--wiki-active)] px-1.5 py-0.5 font-medium">
              {SOURCE_LABEL[entry.source]}
            </span>
          </>
        ) : null}
        {entry.commit ? (
          <>
            <span aria-hidden>·</span>
            <code className="rounded bg-[var(--wiki-active)] px-1 py-0.5 font-mono text-[10px]">
              {entry.commit.slice(0, 7)}
            </code>
          </>
        ) : null}
      </div>

      {showComponent && entry.componentTitle ? (
        <p className="mt-2 text-sm font-medium">
          <Link
            href={hrefWithDoc(`/wiki/components/${entry.componentId}`, docFileName)}
            className="text-[var(--wiki-text)] hover:text-[var(--wiki-accent)]"
          >
            {entry.componentTitle}
          </Link>
        </p>
      ) : null}

      <p className="mt-2 text-sm leading-relaxed text-[var(--wiki-text)]">
        {entry.summary}
      </p>

      {entry.prompt ? (
        <p className="mt-2 text-xs leading-relaxed text-[var(--wiki-muted)]">
          <span className="font-semibold uppercase tracking-wide">Prompt</span>
          {" — "}
          {entry.prompt}
        </p>
      ) : null}

      {entry.files?.length ? (
        <p className="mt-2 font-mono text-[11px] text-[var(--wiki-muted)]">
          {entry.files.join(", ")}
        </p>
      ) : null}
    </li>
  );
}

export function ComponentActivityPanel({
  entries,
  docFileName,
  componentTitle,
  showComponent = false,
  limit,
}: {
  entries: ActivityEntry[];
  docFileName: string;
  componentTitle?: string;
  showComponent?: boolean;
  limit?: number;
}) {
  const visible = limit ? entries.slice(0, limit) : entries;

  return (
    <section className="mt-10 border-t border-[var(--wiki-border)] pt-8">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--wiki-muted)]">
            Activity
          </h2>
          <p className="mt-1 text-xs text-[var(--wiki-muted)]">
            {componentTitle
              ? `Who worked on ${componentTitle} — prompts, fixes, and summaries agents and teammates share via MCP.`
              : "Recent component work logged from connected IDEs — check here before redoing a fix."}
          </p>
        </div>
        {entries.length > 0 ? (
          <span className="shrink-0 text-xs text-[var(--wiki-muted)]">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </span>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--wiki-border)] px-4 py-6 text-sm text-[var(--wiki-muted)]">
          No logged work yet. Real entries come from{" "}
          <strong className="font-medium text-[var(--wiki-text)]">git commits</strong> (post-commit
          hook, matched to components) or{" "}
          <code className="rounded bg-[var(--wiki-active)] px-1 py-0.5 text-xs">
            log_component_work
          </code>{" "}
          via MCP. Each design doc (<code className="text-xs">BLOCKSMITH_DOC</code>) keeps its own
          ledger — vendors do not share activity unless they use the same doc ref.
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((entry) => (
            <ActivityRow
              key={entry.id}
              entry={entry}
              docFileName={docFileName}
              showComponent={showComponent}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
