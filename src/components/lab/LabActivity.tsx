"use client";

import type { ToolCall } from "@/lib/webmcp/client";
import { RichText } from "./RichText";

/**
 * What the agent did, in the order it did it.
 *
 * This exists because the human is the point. An agent calling tools in a
 * sidebar the user cannot see is indistinguishable from an agent making things
 * up — the log is what makes the collaboration legible.
 */
export function LabActivity({ calls }: { calls: ToolCall[] }) {
  return (
    <div className="lab-activity">
      <div className="lab-pane-head">
        <span className="lab-pane-title">Agent activity</span>
        {calls.length > 0 ? (
          <span className="lab-count">{calls.length}</span>
        ) : null}
      </div>

      {calls.length === 0 ? (
        <p className="lab-empty">
          No tool calls yet. When an agent reads the design system or proposes a
          component, every call it makes shows up here.
        </p>
      ) : (
        <ol className="lab-calls">
          {calls.map((c) => (
            <li key={c.id} className={c.mutating ? "is-mutating" : undefined}>
              <div className="lab-call-head">
                <code className="lab-call-name">{c.name}</code>
                {c.mutating ? (
                  <span className="lab-call-tag">changed the page</span>
                ) : null}
              </div>
              <p className="lab-call-result">
                <RichText text={firstLine(c.result)} />
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function firstLine(result: string): string {
  const line = result.split("\n").find((l) => l.trim()) ?? "";
  return line.length > 160 ? `${line.slice(0, 157)}…` : line;
}
