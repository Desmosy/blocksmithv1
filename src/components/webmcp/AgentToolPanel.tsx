"use client";

/**
 * AgentToolPanel — the tools an agent can see on this page, shown to the human.
 *
 * An agent calling tools invisibly is indistinguishable from one making
 * things up, so the surface is made visible: one line that says how many
 * tools are live, which opens to the full list with each tool's purpose and
 * whether it reads or acts. It renders even in a browser without WebMCP —
 * then it says so, and lists what an agent *would* see — because the reader
 * deciding whether to trust this is usually not the agent.
 */

import { useState } from "react";

export type PanelTool = {
  name: string;
  description: string;
  readOnly: boolean;
  /** Where the tool runs: on the server, in this page, or on any site. */
  kind: "server" | "page";
};

export function AgentToolPanel({
  tools,
  registered,
  supported,
  error,
  scope,
  tone = "wiki",
}: {
  tools: PanelTool[];
  /** Names the browser actually accepted. */
  registered: string[];
  supported: boolean;
  error?: string | null;
  /** What the tools are bound to, e.g. the design system's name. */
  scope?: string;
  tone?: "wiki" | "dashboard";
}) {
  const [open, setOpen] = useState(false);
  const live = new Set(registered);
  const muted = tone === "wiki" ? "text-[var(--wiki-muted)]" : "text-muted-foreground";
  const text = tone === "wiki" ? "text-[var(--wiki-text)]" : "text-foreground";
  const border = tone === "wiki" ? "border-[var(--wiki-border)]" : "border-border";
  const surface = tone === "wiki" ? "bg-[var(--wiki-sidebar)]" : "bg-card";

  const headline = error
    ? `Agent tools failed to register — ${error}`
    : supported
      ? `${registered.length} agent tools live on this page`
      : `${tools.length} agent tools on this page · WebMCP is off in this browser`;

  return (
    <div className="text-[11px]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 ${muted} hover:${text}`}
      >
        <span
          aria-hidden="true"
          className={`size-1.5 rounded-full ${supported && !error ? (tone === "wiki" ? "bg-[var(--wiki-text)]" : "bg-foreground") : "border border-current"}`}
        />
        {headline}
        <span aria-hidden="true" className="opacity-60">{open ? "▴" : "▾"}</span>
      </button>

      {open ? (
        <div className={`mt-2 rounded-lg border ${border} ${surface} px-4 py-3`}>
          <p className={muted}>
            {supported
              ? `Registered through document.modelContext${scope ? ` and bound to ${scope}` : ""}. An agent in this browser can call any of these; read-only tools answer, the others put work in front of you.`
              : `This browser exposes no document.modelContext, so nothing is registered. In Chrome, enable chrome://flags/#enable-webmcp-testing. Listed here is what an agent would see${scope ? `, bound to ${scope}` : ""}.`}
          </p>
          <ul className={`mt-3 divide-y ${border.replace("border-", "divide-")}`}>
            {tools.map((t) => (
              <li key={t.name} className="flex gap-3 py-2">
                <div className="w-44 shrink-0">
                  <code className={`${text} text-[11px]`}>{t.name}</code>
                  <div className={`mt-0.5 flex flex-wrap gap-1 ${muted}`}>
                    <span className={`rounded border ${border} px-1 leading-4`}>{t.readOnly ? "read" : "acts"}</span>
                    <span className={`rounded border ${border} px-1 leading-4`}>{t.kind === "page" ? "in page" : "server"}</span>
                    {supported && !live.has(t.name) ? (
                      <span className={`rounded border ${border} px-1 leading-4`}>not registered</span>
                    ) : null}
                  </div>
                </div>
                <p className={`min-w-0 flex-1 leading-relaxed ${muted}`}>{t.description}</p>
              </li>
            ))}
          </ul>
          <p className={`mt-3 ${muted}`}>
            Full surface, including the remote MCP server:{" "}
            <a className="underline underline-offset-2" href="/.well-known/webmcp.json" target="_blank" rel="noreferrer">
              /.well-known/webmcp.json
            </a>
            {" · "}
            <a className="underline underline-offset-2" href="/protocol/webmcp">
              how it works
            </a>
          </p>
        </div>
      ) : null}
    </div>
  );
}
