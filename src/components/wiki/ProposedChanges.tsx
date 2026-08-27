"use client";

/**
 * ProposedChanges — what an agent wants to change about the design system,
 * waiting on a human.
 *
 * This is the half of the loop that makes an agent worth having in the wiki.
 * It drafts the tedious part; nothing it drafts is real until someone here
 * approves it. Approving calls the same `/api/wiki/finalize` a human edit goes
 * through, from this browser with this person's session — so the agent never
 * holds write access, and every existing access check still applies.
 *
 * Renders nothing when there is nothing pending, so it costs a reader who is
 * not working with an agent exactly one request.
 */

import { useCallback, useEffect, useState } from "react";
import { CodeBlock } from "@/components/ui/code-block";

type ProposedChange = {
  id: string;
  blockId: string;
  updatedData: unknown;
  summary: string;
  rationale?: string;
  at: number;
};

type Outcome = { id: string; state: "applying" | "applied" | "failed"; message?: string };

const POLL_MS = 3000;

/** Plain-language name for a block id, so the list reads like design work. */
function describeTarget(blockId: string): string {
  if (blockId === "guidelines") return "Do's and Don'ts";
  if (blockId === "agent-guide") return "Agent guidance";
  if (blockId === "page:introduction") return "Introduction";
  if (blockId.startsWith("token:color:")) return `Colour · ${blockId.slice(12)}`;
  if (blockId.startsWith("token:spacing:")) return `Spacing · ${blockId.slice(14)}`;
  if (blockId.startsWith("token:typography:")) return `Type · ${blockId.slice(17)}`;
  if (blockId.startsWith("component:")) return `Component · ${blockId.slice(10)}`;
  if (blockId.startsWith("section:")) return `Section · ${blockId.slice(8)}`;
  return blockId;
}

export function ProposedChanges({ docFileName }: { docFileName?: string }) {
  const [changes, setChanges] = useState<ProposedChange[]>([]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const url = `/api/webmcp/change${docFileName ? `?doc=${encodeURIComponent(docFileName)}` : ""}`;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const data = (await res.json()) as { changes?: ProposedChange[] };
      setChanges(data.changes ?? []);
    } catch {
      /* a dropped poll is not worth surfacing */
    }
  }, [url]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const discard = async (id: string) => {
    await fetch("/api/webmcp/change", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ discard: id, doc: docFileName }),
    }).catch(() => {});
    void refresh();
  };

  /**
   * Approving is a human edit. It goes through the same route the wiki's own
   * editor uses, with this browser's session — the agent is never the author
   * of a write.
   */
  const approve = async (change: ProposedChange) => {
    setOutcome({ id: change.id, state: "applying" });
    try {
      const res = await fetch("/api/wiki/finalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          doc: docFileName,
          blockId: change.blockId,
          updatedData: change.updatedData,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setOutcome({
          id: change.id,
          state: "failed",
          message:
            data.error ??
            (res.status === 401 || res.status === 403
              ? "You need to be signed in to change this design system."
              : `The edit was refused (${res.status}).`),
        });
        return;
      }
      setOutcome({ id: change.id, state: "applied" });
      await discard(change.id);
    } catch {
      setOutcome({
        id: change.id,
        state: "failed",
        message: "Could not reach the server.",
      });
    }
  };

  if (!changes.length) return null;

  return (
    <section className="mt-10 rounded-xl border border-[var(--wiki-text)] bg-[var(--wiki-sidebar)]">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--wiki-border)] px-5 py-3">
        <h2 className="text-sm font-semibold text-[var(--wiki-text)]">
          Your agent proposed {changes.length}{" "}
          {changes.length === 1 ? "change" : "changes"} to this design system
        </h2>
        <span className="text-[11px] text-[var(--wiki-muted)]">
          Nothing changes until you approve it
        </span>
      </header>

      <ul className="divide-y divide-[var(--wiki-border)]">
        {changes.map((c) => {
          const isOpen = expanded === c.id;
          const result = outcome?.id === c.id ? outcome : null;
          return (
            <li key={c.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--wiki-text)]">{c.summary}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.06em] text-[var(--wiki-muted)]">
                    {describeTarget(c.blockId)}
                  </p>
                  {c.rationale ? (
                    <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[var(--wiki-muted)]">
                      {c.rationale}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : c.id)}
                    className="rounded-lg px-2 py-1.5 text-xs text-[var(--wiki-muted)] underline underline-offset-4 hover:text-[var(--wiki-text)]"
                  >
                    {isOpen ? "Hide" : "What changes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void discard(c.id)}
                    disabled={result?.state === "applying"}
                    className="rounded-lg border border-[var(--wiki-border)] px-3 py-1.5 text-xs text-[var(--wiki-text)] hover:bg-[var(--wiki-active)] disabled:opacity-50"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={() => void approve(c)}
                    disabled={result?.state === "applying"}
                    className="rounded-lg bg-[var(--wiki-text)] px-3 py-1.5 text-xs font-medium text-[var(--wiki-bg)] hover:opacity-90 disabled:opacity-50"
                  >
                    {result?.state === "applying" ? "Applying…" : "Approve"}
                  </button>
                </div>
              </div>

              {isOpen ? (
                <div className="mt-3">
                  <CodeBlock
                    code={JSON.stringify(c.updatedData, null, 2)}
                    language="json"
                    filename={describeTarget(c.blockId)}
                    scrollable
                    maxHeight={224}
                  />
                </div>
              ) : null}

              {result?.state === "failed" ? (
                <p className="mt-2 text-xs text-[var(--wiki-text)]">
                  {result.message}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
