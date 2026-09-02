"use client";

/**
 * GovernanceCheckPanel — what an agent proposed, and whether the system allows it.
 *
 * The rest of the Governance page reports on what has already been ingested.
 * This is for something that has not been: a component an agent just built.
 *
 * The agent puts it here through `propose_component` — nobody pastes anything.
 * The panel shows the rendered result first, because the person judging it is
 * usually looking at a component, not reading markup. Pasting by hand is kept
 * as a fallback for when there is no agent in the browser.
 */

import { useEffect, useId, useState } from "react";
import type { DesignSystem } from "@/lib/blocks/types";
import { GovernanceVerdict } from "./GovernanceVerdict";
import { ProposalPreview } from "./ProposalPreview";
import { CodeBlock } from "@/components/ui/code-block";
import {
  getProposal,
  subscribeToProposals,
  setProposal,
  type Proposal,
} from "@/lib/webmcp/proposal-store";

const SAMPLE = `<div class="p-5 rounded-xl shadow-lg bg-gradient-to-br from-slate-900 to-black">
  <h3 class="text-2xl text-blue-600">Pro</h3>
  <p class="text-sm mt-3">$29 / month</p>
  <button class="rounded-lg px-6 py-3 bg-blue-500">Start trial</button>
</div>`;

export function GovernanceCheckPanel({
  system,
  docFileName,
}: {
  system: DesignSystem;
  docFileName?: string;
}) {
  const [proposal, setLocal] = useState<Proposal | null>(null);
  const [manual, setManual] = useState("");
  const [showCode, setShowCode] = useState(false);
  /**
   * Older proposals for this system, newest first. The server keeps them —
   * "show me another version" stopped destroying the last one long ago — but
   * the panel only ever showed the current, so three components built in one
   * chat looked like one. v0 is the current proposal.
   */
  const [versions, setVersions] = useState<
    { v: number; intent: string | null; at: number }[]
  >([]);
  /** Which version is on screen. 0 is the live proposal; older ones are read-only. */
  const [viewV, setViewV] = useState(0);
  const [viewingCode, setViewingCode] = useState<string | null>(null);
  /**
   * Edits made here, on top of whatever the agent proposed.
   *
   * Null means "showing what arrived". Once someone types, this holds the
   * working copy — so a rejected component can be corrected in place and the
   * preview and verdict follow along, instead of being a read-only artifact
   * you can only accept or discard.
   */
  const [draft, setDraft] = useState<string | null>(null);
  const id = useId();

  // An agent proposing a component is the primary path in.
  useEffect(() => {
    setLocal(getProposal());
    return subscribeToProposals(setLocal);
  }, []);

  // Watch the server too. The agent is often in a different browser — one on
  // OpenAI's machines, say — so a proposal that only lived in page memory would
  // never reach the person it was built for.
  useEffect(() => {
    let cancelled = false;
    let lastSeen = 0;
    let lastVersions = -1;

    const poll = async () => {
      try {
        const q = docFileName ? `?doc=${encodeURIComponent(docFileName)}` : "";
        const res = await fetch(`/api/webmcp/proposal${q}`, { cache: "no-store" });
        const data = (await res.json()) as {
          proposal: Proposal | null;
          versions?: number;
        };
        if (cancelled) return;
        const next = data.proposal;
        if (next && next.at > lastSeen) {
          lastSeen = next.at;
          setLocal(next);
          // A newly arrived proposal is the thing to look at; keeping an edit
          // from the previous one — or an old version — on screen would hide it.
          setDraft(null);
          setViewV(0);
          setViewingCode(null);
        }
        // The history metadata is fetched only when its depth changes, so the
        // steady-state poll stays one request.
        const depth = data.versions ?? 0;
        if (depth !== lastVersions) {
          lastVersions = depth;
          if (depth > 1) {
            const listRes = await fetch(`/api/webmcp/proposal${q}${q ? "&" : "?"}list=1`, {
              cache: "no-store",
            });
            const list = (await listRes.json()) as {
              versions: { v: number; intent: string | null; at: number }[];
            };
            if (!cancelled) setVersions(list.versions ?? []);
          } else {
            setVersions([]);
          }
        }
      } catch {
        /* a dropped poll is not worth surfacing; the next one will land */
      }
    };

    void poll();
    const timer = setInterval(poll, 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [docFileName]);

  const arrived = proposal?.code ?? manual;
  const viewingOld = viewV > 0 && viewingCode !== null;
  const code = viewingOld ? viewingCode : (draft ?? arrived);
  const fromAgent = Boolean(proposal);
  const edited = !viewingOld && draft !== null && draft !== arrived;

  /** Show an earlier version. Its body ships on demand — the list is metadata. */
  const viewVersion = async (v: number) => {
    if (v === 0) {
      setViewV(0);
      setViewingCode(null);
      return;
    }
    try {
      const q = docFileName ? `?doc=${encodeURIComponent(docFileName)}&` : "?";
      const res = await fetch(`/api/webmcp/proposal/frame${q}v=${v}&raw=1`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const body = await res.text();
      setViewV(v);
      setViewingCode(body);
      setDraft(null);
    } catch {
      /* leave the current view in place */
    }
  };

  const clear = () => {
    setProposal(null);
    setManual("");
    setDraft(null);
    setShowCode(false);
    setVersions([]);
    setViewV(0);
    setViewingCode(null);
    // Clear it for every viewer, not just this tab.
    void fetch("/api/webmcp/proposal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "", doc: docFileName }),
    }).catch(() => {});
  };

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-medium text-[var(--wiki-text)]">
          {fromAgent ? "Your agent proposed this" : "Check a component"}
        </h2>
        <div className="flex items-center gap-3 text-xs">
          {code ? (
            <button
              type="button"
              className="text-[var(--wiki-muted)] underline underline-offset-4 hover:text-[var(--wiki-text)]"
              onClick={() => setShowCode((v) => !v)}
            >
              {showCode ? "Hide code" : "Edit code"}
            </button>
          ) : null}
          {/* A landing page inside a review card reads as a thumbnail of
              itself. Open it at the size it was designed for. */}
          {fromAgent && code ? (
            <a
              href={`/api/webmcp/proposal/frame?${docFileName ? `doc=${encodeURIComponent(docFileName)}&` : ""}v=${viewV}`}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--wiki-muted)] underline underline-offset-4 hover:text-[var(--wiki-text)]"
            >
              Open full page ↗
            </a>
          ) : null}
          <button
            type="button"
            className="text-[var(--wiki-muted)] underline underline-offset-4 hover:text-[var(--wiki-text)]"
            onClick={() => (code ? clear() : setManual(SAMPLE))}
          >
            {code ? "Clear" : "Try a typical AI component"}
          </button>
        </div>
      </div>

      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--wiki-muted)]">
        {fromAgent
          ? proposal?.intent
            ? `“${proposal.intent}” — rendered in this system's own tokens, and checked against its rules.`
            : "Rendered in this system's own tokens, and checked against its rules."
          : "Ask an agent for a component and it appears here. You can also paste one."}
      </p>

      {/* Everything built in this conversation, not just the last thing. Each
          new proposal pushes the previous into history on the server; without
          this, three components generated in one chat looked like one. A
          dropdown rather than pills, so ten versions read as ten rows instead
          of a wall of chips. */}
      {fromAgent && versions.length > 1 ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <label
            htmlFor={`${id}-history`}
            className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--wiki-muted)]"
          >
            History
          </label>
          <select
            id={`${id}-history`}
            value={viewV}
            onChange={(e) => void viewVersion(Number(e.target.value))}
            className="max-w-full rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] px-3 py-1.5 text-xs text-[var(--wiki-text)] outline-none focus:border-[var(--wiki-text)]"
          >
            {versions.map((entry) => {
              const label =
                entry.v === 0 ? "Latest" : `v${versions.length - entry.v}`;
              const when = new Date(entry.at).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              });
              const intent = entry.intent
                ? entry.intent.length > 64
                  ? `${entry.intent.slice(0, 64)}…`
                  : entry.intent
                : "Untitled proposal";
              return (
                <option key={entry.v} value={entry.v}>
                  {label} · {when} — {intent}
                </option>
              );
            })}
          </select>
          {viewingOld ? (
            <span className="text-[var(--wiki-muted)]">
              Earlier version — read-only.{" "}
              <button
                type="button"
                onClick={() => void viewVersion(0)}
                className="underline underline-offset-4 hover:text-[var(--wiki-text)]"
              >
                Back to latest
              </button>
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Stacked, each band full width. Side by side, the preview was squeezed
          into half a column and every violation wrapped to four lines in the
          other half — the rule text is a sentence and needs the measure. */}
      {code ? (
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <ProposalPreview code={code} system={system} />
            {/* Say what the frame can and cannot show. It renders inline styles
                and this system's CSS variables, but the sandbox has no scripts,
                so a utility-class framework never runs — a missing gradient here
                is the preview's limit, not the component's. */}
            <p className="text-[11px] leading-relaxed text-[var(--wiki-muted)]">
              Rendered with this system&apos;s tokens and inline styles. Utility
              classes such as Tailwind are not applied, so the verdict is the
              accurate account of what the markup actually does.
            </p>
            {showCode ? (
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <label
                    htmlFor={`${id}-edit`}
                    className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--wiki-muted)]"
                  >
                    {fromAgent ? "Agent's component — editable" : "Component"}
                  </label>
                  {edited ? (
                    <button
                      type="button"
                      onClick={() => setDraft(null)}
                      className="text-[11px] text-[var(--wiki-muted)] underline underline-offset-4 hover:text-[var(--wiki-text)]"
                    >
                      Revert to what the agent sent
                    </button>
                  ) : null}
                </div>
                <textarea
                  id={`${id}-edit`}
                  value={code}
                  onChange={(e) => {
                    if (!viewingOld) setDraft(e.target.value);
                  }}
                  readOnly={viewingOld}
                  spellCheck={false}
                  rows={10}
                  className="w-full resize-y rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] p-3 font-mono text-[12px] leading-relaxed text-[var(--wiki-text)] outline-none focus:border-[var(--wiki-text)]"
                />
                <p className="text-[11px] leading-relaxed text-[var(--wiki-muted)]">
                  {viewingOld
                    ? "An earlier version, kept as it arrived. Go back to the latest to edit."
                    : "Edit and the preview and verdict follow. Fixing a violation here is the fastest way to see the rule you just satisfied."}
                </p>
              </div>
            ) : null}
          </div>
          <GovernanceVerdict
            code={code}
            doc={docFileName}
            live
            title="Verdict"
          />
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div>
            <label
              htmlFor={id}
              className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--wiki-muted)]"
            >
              Paste a component
            </label>
            <textarea
              id={id}
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              spellCheck={false}
              rows={10}
              placeholder="…or just ask your agent for one."
              className="mt-2 w-full resize-y rounded-xl border border-[var(--wiki-border)] bg-[var(--wiki-bg)] p-3 font-mono text-[12px] leading-relaxed text-[var(--wiki-text)] outline-none focus:border-[var(--wiki-text)]"
            />
          </div>
          <GovernanceVerdict
            code=""
            doc={docFileName}
            live
            title="Verdict"
            emptyHint="Nothing to check yet. Ask your agent to build something, and it will appear here rendered."
          />
        </div>
      )}
    </section>
  );
}
