"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { DesignSystem } from "@/lib/blocks/types";
import {
  buildPreviewContextFromIR,
  buildPreviewContextFromSystem,
} from "@/ai-lab/04-component-previews";
import {
  ARCHETYPES,
  composeArchetype,
  type ArchetypeId,
} from "@/ai-lab/06-demo-compose";
import { generateProjectFiles, type CodeFile } from "@/ai-lab/07-code-export";
import { useDesignIROptional } from "@/lib/design-ir/context";
import { CopyButton } from "../visual/CopyButton";
import { LandingView } from "./demo/LandingView";
import { DashboardView } from "./demo/DashboardView";

function themeVars(vars: Record<string, string>): CSSProperties {
  return vars as CSSProperties;
}

export function DemoPage({ system }: { system: DesignSystem; docFileName?: string }) {
  const ir = useDesignIROptional();
  const [showProvenance, setShowProvenance] = useState(false);
  const [view, setView] = useState<"preview" | "code">("preview");
  const [archetype, setArchetype] = useState<ArchetypeId>("landing");

  const ctx = useMemo(
    () => (ir ? buildPreviewContextFromIR(ir) : buildPreviewContextFromSystem(system)),
    [ir, system],
  );
  const model = useMemo(
    () => composeArchetype(archetype, system, ctx),
    [archetype, system, ctx],
  );
  const files = useMemo<CodeFile[]>(
    () => (ir ? generateProjectFiles(system, ir, ctx, model) : []),
    [ir, system, ctx, model],
  );

  const vars = useMemo(
    () => ({
      ...(ir?.colorVariables ?? {}),
      ...(ir?.fontStacks ?? {}),
      ...(ir?.wikiChrome.cssVariables ?? {}),
    }),
    [ir],
  );

  return (
    <article>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--wiki-text)]">
            Generated demo
          </h1>
          <p className="mt-1 text-sm text-[var(--wiki-muted)]">
            Live surfaces composed from {system.name}&apos;s tokens and
            components — same system, different layouts.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {/* Archetype selector */}
          <div className="flex rounded-lg border border-[var(--wiki-border)] p-0.5 text-xs font-medium">
            {ARCHETYPES.map((a) => (
              <button
                key={a.id}
                type="button"
                title={a.description}
                onClick={() => setArchetype(a.id)}
                className={`rounded-md px-3 py-1 transition ${
                  archetype === a.id
                    ? "bg-[var(--wiki-active)] text-[var(--wiki-text)]"
                    : "text-[var(--wiki-muted)] hover:text-[var(--wiki-text)]"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
          {/* Preview / Code */}
          {files.length > 0 ? (
            <div className="flex rounded-lg border border-[var(--wiki-border)] p-0.5 text-xs font-medium">
              {(["preview", "code"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`rounded-md px-3 py-1 capitalize transition ${
                    view === v
                      ? "bg-[var(--wiki-accent)] text-[var(--wiki-cta-on-accent,#fff)]"
                      : "text-[var(--wiki-muted)] hover:bg-[var(--wiki-active)]"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setShowProvenance((p) => !p)}
            className="rounded-md border border-[var(--wiki-border)] px-3 py-1.5 text-xs font-medium text-[var(--wiki-muted)] transition hover:bg-[var(--wiki-active)]"
          >
            {showProvenance ? "Hide sources" : "What's sourced?"}
          </button>
        </div>
      </header>

      {showProvenance ? (
        <ul className="mb-6 space-y-1 rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] p-4 text-xs text-[var(--wiki-muted)]">
          {model.provenance.map((p) => (
            <li key={p}>• {p}</li>
          ))}
          <li className="pt-1 opacity-70">
            Copy is sample text; colors, type, radii and components are your system.
          </li>
        </ul>
      ) : null}

      {view === "code" ? <CodeView files={files} /> : null}

      <div
        hidden={view !== "preview"}
        className="overflow-hidden rounded-2xl border border-[var(--wiki-border)]"
        style={{
          ...themeVars(vars),
          backgroundColor: "var(--wiki-bg)",
          color: "var(--wiki-text)",
          fontFamily: "var(--wiki-font)",
        }}
      >
        {model.archetype === "dashboard" ? (
          <DashboardView model={model} />
        ) : (
          <LandingView model={model} />
        )}
      </div>
    </article>
  );
}

function CodeView({ files }: { files: CodeFile[] }) {
  const [active, setActive] = useState(0);
  const file = files[active] ?? files[0];
  if (!file) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--wiki-border)]">
      <div className="flex items-center justify-between border-b border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] px-2">
        <div className="flex flex-wrap">
          {files.map((f, i) => (
            <button
              key={f.path}
              type="button"
              onClick={() => setActive(i)}
              className={`border-b-2 px-3 py-2 text-xs font-medium transition ${
                i === active
                  ? "border-[var(--wiki-accent)] text-[var(--wiki-text)]"
                  : "border-transparent text-[var(--wiki-muted)] hover:text-[var(--wiki-text)]"
              }`}
            >
              {f.path}
            </button>
          ))}
        </div>
        <CopyButton value={file.contents} label="Copy file" />
      </div>
      <pre className="overflow-x-auto bg-[var(--wiki-bg)] p-4 text-xs leading-relaxed">
        <code className="text-[var(--wiki-text)]">{file.contents}</code>
      </pre>
    </div>
  );
}
