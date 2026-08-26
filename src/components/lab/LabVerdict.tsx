"use client";

import type { Verdict } from "./types";
import { RichText } from "./RichText";

type Row = { line: string | null; body: string };

/**
 * Split the engine's text into rows so violations can be laid out as a list
 * rather than a wall of prose. The engine's format is stable: each violation
 * is `- Line N: body`.
 */
function parseRows(text: string): { headline: string; rows: Row[]; tail: string } {
  const lines = text.split("\n");
  const headline = lines[0] ?? "";
  const rows: Row[] = [];
  const tailParts: string[] = [];

  for (const raw of lines.slice(1)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^-\s*Line\s+(\d+):\s*(.*)$/);
    if (m) {
      rows.push({ line: m[1], body: m[2] });
    } else if (line.startsWith("- ")) {
      rows.push({ line: null, body: line.slice(2) });
    } else {
      tailParts.push(line);
    }
  }
  return { headline, rows, tail: tailParts.join(" ") };
}

export function LabVerdict({
  verdict,
  presetName,
  onFix,
  fixing,
}: {
  verdict: Verdict;
  presetName: string;
  onFix: () => void;
  fixing: boolean;
}) {
  if (verdict.state === "idle") {
    return (
      <div className="lab-verdict is-idle">
        <div className="lab-pane-head">
          <span className="lab-pane-title">Verdict</span>
        </div>
        <p className="lab-empty">
          Nothing to check yet. Paste a component or pick a sample, and{" "}
          {presetName} will judge it.
        </p>
      </div>
    );
  }

  if (verdict.state === "error") {
    return (
      <div className="lab-verdict is-error">
        <div className="lab-pane-head">
          <span className="lab-pane-title">Verdict</span>
        </div>
        <p className="lab-empty">{verdict.text}</p>
      </div>
    );
  }

  const text = verdict.text ?? "";
  const { headline, rows, tail } = parseRows(text);
  const checking = verdict.state === "checking";

  return (
    <div
      className={`lab-verdict is-${verdict.state}`}
      aria-busy={checking}
      aria-live="polite"
    >
      <div className="lab-pane-head">
        <span className="lab-pane-title">Verdict</span>
        {checking ? <span className="lab-checking">checking…</span> : null}
        {verdict.state === "fail" && !checking ? (
          <button
            type="button"
            className="lab-fix"
            onClick={onFix}
            disabled={fixing}
          >
            {fixing ? "Fixing…" : "Fix what can be fixed"}
          </button>
        ) : null}
      </div>

      <p className="lab-headline">
        {/* While a check is in flight the rows below are the previous result.
            Labelling them PASS or REJECTED would assert a verdict the engine
            has not returned yet. */}
        <span className="lab-badge">
          {checking ? "CHECKING" : verdict.state === "pass" ? "PASS" : "REJECTED"}
        </span>
        <RichText text={headline.replace(/^(PASS|REJECTED)\s*—\s*/, "")} />
      </p>

      {rows.length > 0 ? (
        <ul className="lab-violations">
          {rows.map((r, i) => (
            <li key={i}>
              {r.line ? <span className="lab-line">L{r.line}</span> : null}
              <span className="lab-violation-body">
                <RichText text={r.body} />
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {tail ? <p className="lab-tail">{tail}</p> : null}
    </div>
  );
}
