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

    const poll = async () => {
      try {
        const url = `/api/webmcp/proposal${docFileName ? `?doc=${encodeURIComponent(docFileName)}` : ""}`;
        const res = await fetch(url, { cache: "no-store" });
        const data = (await res.json()) as { proposal: Proposal | null };
        if (cancelled) return;
        const next = data.proposal;
        if (next && next.at > lastSeen) {
          lastSeen = next.at;
          setLocal(next);
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

  const code = proposal?.code ?? manual;
  const fromAgent = Boolean(proposal);

  const clear = () => {
    setProposal(null);
    setManual("");
    setShowCode(false);
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
              {showCode ? "Hide code" : "Show code"}
            </button>
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
              <CodeBlock
                code={code}
                language="html"
                filename="proposed component"
                showLineNumbers
                scrollable
                maxHeight={288}
              />
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
