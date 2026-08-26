"use client";

/**
 * GovernanceCheckPanel — paste code, get the system's verdict.
 *
 * The rest of the Governance page reports on what has already been ingested.
 * This checks something that has not: a snippet from a PR, from an agent, from
 * anywhere. It is the same tool an agent reaches through the page, so what a
 * reviewer sees here and what an agent is told are the same answer.
 */

import { useId, useState } from "react";
import { GovernanceVerdict } from "./GovernanceVerdict";

const SAMPLE = `<div className="p-5 rounded-xl shadow-lg bg-gradient-to-br from-slate-900 to-black">
  <h3 className="text-2xl text-blue-600">Pro</h3>
  <button className="rounded-lg px-6 py-3 bg-blue-500">Start trial</button>
</div>`;

export function GovernanceCheckPanel({ docFileName }: { docFileName?: string }) {
  const [code, setCode] = useState("");
  const id = useId();

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-medium text-[var(--wiki-text)]">
          Check code against this system
        </h2>
        <button
          type="button"
          className="text-xs text-[var(--wiki-muted)] underline underline-offset-4 hover:text-[var(--wiki-text)]"
          onClick={() => setCode(code ? "" : SAMPLE)}
        >
          {code ? "Clear" : "Paste a typical AI component"}
        </button>
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--wiki-muted)]">
        Colours, spacing, type sizes, radii, banned patterns, and composition —
        the same checks an agent gets through this page.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <label
            htmlFor={id}
            className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--wiki-muted)]"
          >
            Component
          </label>
          <textarea
            id={id}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            rows={12}
            placeholder="Paste a component…"
            className="mt-2 w-full resize-y rounded-xl border border-[var(--wiki-border)] bg-[var(--wiki-bg)] p-3 font-mono text-[12px] leading-relaxed text-[var(--wiki-text)] outline-none focus:border-[var(--wiki-text)]"
          />
        </div>
        <GovernanceVerdict
          code={code}
          doc={docFileName}
          live
          title="Verdict"
          emptyHint="Paste a component, or load the sample. It is checked as you type."
        />
      </div>
    </section>
  );
}
