"use client";

/**
 * GovernanceVerdict — runs code past the active design system and shows what
 * came back, in wiki chrome.
 *
 * Shared by the Component Playground (which checks whatever you are editing)
 * and the Governance page (which checks code you paste). Both surfaces want the
 * same thing: the rule that was broken and the value to use instead, not a
 * pass/fail light.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const DEBOUNCE_MS = 450;

type Verdict =
  | { state: "idle" }
  | { state: "checking"; text?: string }
  | { state: "pass"; text: string }
  | { state: "fail"; text: string }
  | { state: "error"; text: string };

type Row = { line: string | null; ruleId: string | null; body: string };

/** The engine's line format is stable: `- Line N \`rule-id\` — body`. */
function parseRows(text: string): { headline: string; rows: Row[]; tail: string } {
  const lines = text.split("\n");
  const headline = (lines[0] ?? "").replace(/^(PASS|REJECTED)\s*—\s*/, "");
  const rows: Row[] = [];
  const tail: string[] = [];

  for (const raw of lines.slice(1)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^-\s*Line\s+(\d+)\s*`([^`]+)`\s*—\s*(.*)$/);
    if (m) {
      rows.push({ line: m[1], ruleId: m[2], body: m[3] });
      continue;
    }
    const plain = line.match(/^-\s*Line\s+(\d+):\s*(.*)$/);
    if (plain) {
      rows.push({ line: plain[1], ruleId: null, body: plain[2] });
      continue;
    }
    if (line.startsWith("- ")) rows.push({ line: null, ruleId: null, body: line.slice(2) });
    else tail.push(line);
  }
  return { headline, rows, tail: tail.join(" ") };
}

/** Render the `**bold**` and `` `code` `` the engine emits. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-[var(--wiki-text)]">
              {p.slice(2, -2)}
            </strong>
          );
        }
        if (p.startsWith("`") && p.endsWith("`")) {
          return (
            <code
              key={i}
              className="rounded bg-[var(--wiki-active)] px-1 py-px font-mono text-[11px] text-[var(--wiki-text)]"
            >
              {p.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

export function GovernanceVerdict({
  code,
  doc,
  /** Check as `code` changes rather than only on demand. */
  live = false,
  title = "Governance",
  emptyHint,
}: {
  code: string;
  doc?: string;
  live?: boolean;
  title?: string;
  emptyHint?: string;
}) {
  const [verdict, setVerdict] = useState<Verdict>({ state: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  const check = useCallback(
    async (source: string) => {
      abortRef.current?.abort();
      if (!source.trim()) {
        setVerdict({ state: "idle" });
        return;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      setVerdict((v) => ({ state: "checking", text: "text" in v ? v.text : undefined }));

      try {
        // The wiki's own route, not the agent tool: same engine and rule ids,
        // without the 1500-character cap a tool output has to fit.
        const res = await fetch("/api/wiki/governance-check", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code: source, doc }),
          signal: controller.signal,
        });
        const data = (await res.json()) as {
          total?: number;
          systemName?: string;
          detail?: string[];
          error?: string;
        };
        if (data.error) {
          setVerdict({ state: "error", text: data.error });
          return;
        }
        const total = data.total ?? 0;
        const text = total
          ? [
              `REJECTED — ${total} violation(s) in ${data.systemName ?? "this system"}.`,
              "",
              ...(data.detail ?? []),
            ].join("\n")
          : `PASS — no design system violations in ${data.systemName ?? "this system"}.`;
        setVerdict({ state: total ? "fail" : "pass", text });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setVerdict({
          state: "error",
          text: "Could not reach the governance engine.",
        });
      }
    },
    [doc],
  );

  useEffect(() => {
    if (!live) return;
    const t = setTimeout(() => void check(code), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [live, code, check]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const checking = verdict.state === "checking";
  const text = "text" in verdict ? (verdict.text ?? "") : "";
  const { headline, rows, tail } = parseRows(text);
  const badge = checking ? "CHECKING" : verdict.state === "pass" ? "PASS" : "REJECTED";

  return (
    <section className="rounded-xl border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)]">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--wiki-border)] px-4 py-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--wiki-muted)]">
          {title}
        </h3>
        {!live ? (
          <button
            type="button"
            onClick={() => void check(code)}
            disabled={checking || !code.trim()}
            className="rounded-lg border border-[var(--wiki-border)] px-3 py-1.5 text-xs font-medium text-[var(--wiki-text)] transition hover:bg-[var(--wiki-active)] disabled:opacity-50"
          >
            {checking ? "Checking…" : "Check against this system"}
          </button>
        ) : checking ? (
          <span className="text-[11px] text-[var(--wiki-muted)]">checking…</span>
        ) : null}
      </header>

      <div className="px-4 py-3" aria-live="polite">
        {verdict.state === "idle" ? (
          <p className="max-w-[52ch] text-xs leading-relaxed text-[var(--wiki-muted)]">
            {emptyHint ??
              "Nothing checked yet. This runs the same rules an agent gets through the page."}
          </p>
        ) : verdict.state === "error" ? (
          <p className="text-xs text-[var(--wiki-muted)]">{text}</p>
        ) : (
          <>
            <p className="flex flex-wrap items-baseline gap-2 text-sm text-[var(--wiki-text)]">
              <span
                className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.08em] ${
                  checking
                    ? "bg-[var(--wiki-active)] text-[var(--wiki-muted)]"
                    : verdict.state === "pass"
                      ? "bg-[var(--wiki-text)] text-[var(--wiki-bg)]"
                      : "border border-[var(--wiki-text)] text-[var(--wiki-text)]"
                }`}
              >
                {badge}
              </span>
              <Rich text={headline} />
            </p>

            {rows.length ? (
              <ul
                className={`mt-3 flex flex-col gap-2 ${checking ? "opacity-50" : ""}`}
              >
                {rows.map((r, i) => (
                  <li
                    key={i}
                    className="grid grid-cols-[auto_1fr] gap-x-2 text-xs leading-relaxed text-[var(--wiki-muted)]"
                  >
                    <span className="pt-px font-mono text-[10px] tabular-nums text-[var(--wiki-muted)]">
                      {r.line ? `L${r.line}` : "—"}
                    </span>
                    <span>
                      {r.ruleId ? (
                        <code className="mr-1.5 rounded bg-[var(--wiki-active)] px-1 py-px font-mono text-[10px]">
                          {r.ruleId}
                        </code>
                      ) : null}
                      <Rich text={r.body} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            {tail ? (
              <p className="mt-3 text-[11px] text-[var(--wiki-muted)]">{tail}</p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
