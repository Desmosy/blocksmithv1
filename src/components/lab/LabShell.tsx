"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWebMcp, type WebMcpToolSpec } from "@/hooks/useWebMcp";
import {
  serverToolSpecs,
  nextCallId,
  type ToolCall,
  type ToolDescriptor,
} from "@/lib/webmcp/client";
import { LabEditor } from "./LabEditor";
import { LabVerdict } from "./LabVerdict";
import { LabActivity } from "./LabActivity";
import { LabPresetBar } from "./LabPresetBar";
import { LabSpecimen } from "./LabSpecimen";
import { installDevPolyfill } from "@/lib/webmcp/dev-polyfill";
import type { FixReport, PresetSummary, Verdict } from "./types";

const CHECK_DEBOUNCE_MS = 400;

/**
 * Pull the applied / needs-a-decision lists out of the engine's fix summary.
 * The format is stable: "- Line N: …" under one of two headings.
 */
function parseFixReport(text: string): FixReport | null {
  const applied: { line: number; text: string }[] = [];
  const skipped: { line: number; text: string }[] = [];
  let bucket: "applied" | "skipped" | null = null;

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (/^Applied \d+ fix/i.test(line)) { bucket = "applied"; continue; }
    if (/need a decision from you/i.test(line)) { bucket = "skipped"; continue; }
    const m = line.match(/^-\s*Line\s+(\d+):\s*(.*)$/);
    if (!m || !bucket) continue;
    (bucket === "applied" ? applied : skipped).push({
      line: Number(m[1]),
      text: m[2],
    });
  }
  return applied.length || skipped.length ? { applied, skipped } : null;
}

export function LabShell({
  tools,
  presets,
  initialDoc,
  initialCode,
}: {
  tools: ToolDescriptor[];
  presets: PresetSummary[];
  initialDoc: string;
  initialCode: string;
}) {
  // Runs during the first render, before useWebMcp's effect, so a simulated
  // agent surface is in place when registration happens. No-op in production
  // and without ?agent=sim.
  useState(installDevPolyfill);

  const [doc, setDoc] = useState(initialDoc);
  const [code, setCode] = useState(initialCode);
  const [verdict, setVerdict] = useState<Verdict>({ state: "idle" });
  const [calls, setCalls] = useState<ToolCall[]>([]);
  const [fixing, setFixing] = useState(false);
  const [fixReport, setFixReport] = useState<FixReport | null>(null);
  /** Session-local token edits. Never written to the shipped presets. */
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const logCall = useCallback((call: ToolCall) => {
    setCalls((prev) => [call, ...prev].slice(0, 40));
  }, []);

  /** Run the code through governance. Shared by the editor and the agent. */
  const selectPreset = useCallback((fileName: string) => {
    setDoc(fileName);
    // Overrides name tokens in the system that was active, so they cannot
    // carry across to a different one.
    setOverrides({});
  }, []);

  const check = useCallback(
    async (source: string, forDoc: string, signal?: AbortSignal) => {
      setVerdict((v) => ({ ...v, state: "checking" }));
      try {
        const res = await fetch("/api/webmcp/invoke", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            tool: "check_governance",
            args: { code: source },
            doc: forDoc,
            tokenOverrides: stateRef.current.overrides,
          }),
          signal,
        });
        const data = (await res.json()) as { text?: string; error?: string };
        const text = data.text ?? data.error ?? "";
        setVerdict({
          state: text.startsWith("PASS") ? "pass" : "fail",
          text,
        });
        return text;
      } catch (err) {
        if ((err as Error).name === "AbortError") return "";
        setVerdict({
          state: "error",
          text: "Could not reach the governance engine. Check your connection.",
        });
        return "";
      }
    },
    [],
  );

  /** Apply every mechanical fix, then re-check. Shared by the button and the agent. */
  const fix = useCallback(async () => {
    const source = stateRef.current.code;
    if (!source.trim()) return "Nothing to fix — the editor is empty.";
    setFixing(true);
    try {
      const res = await fetch("/api/webmcp/invoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tool: "fix_violations",
          args: { code: source },
          doc: stateRef.current.doc,
          tokenOverrides: stateRef.current.overrides,
        }),
      });
      const data = (await res.json()) as { text?: string };
      const text = data.text ?? "";
      const fenced = text.match(/^```\n([\s\S]*?)\n```/);
      if (fenced) setCode(fenced[1]);
      setFixReport(parseFixReport(text));
      return text;
    } catch {
      return "Could not reach the governance engine.";
    } finally {
      setFixing(false);
    }
  }, []);

  // Re-check as the human types, and whenever the active preset changes.
  useEffect(() => {
    if (!code.trim()) {
      setVerdict({ state: "idle" });
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(() => {
      void check(code, doc, controller.signal);
    }, CHECK_DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [code, doc, check]);

  // Agent tools need the current code and preset without re-registering on
  // every keystroke, which would churn the tool surface constantly.
  const stateRef = useRef({ doc, code, overrides });
  stateRef.current = { doc, code, overrides };

  /**
   * Client tools: these act on what the human is looking at, so they cannot be
   * dispatched server-side. Switching a preset here re-registers the whole
   * surface, which is what fires `toolchange`.
   */
  const clientTools = useMemo<WebMcpToolSpec[]>(
    () => [
      {
        name: "get_current_context",
        description:
          "See what the user is looking at right now: which design system is active and the component code currently in their editor. Call this first so your answer applies to their actual screen rather than a guess.",
        inputSchema: { type: "object", properties: {} },
        annotations: { readOnlyHint: true },
        execute: () => {
          const { doc: d, code: c } = stateRef.current;
          const preset = presets.find((p) => p.fileName === d);
          const result = [
            `Active design system: ${preset?.name ?? d} (${d}).`,
            c.trim()
              ? `The editor holds ${c.split("\n").length} lines of component code.`
              : "The editor is empty.",
            c.trim() ? "" : "",
            c.trim() ? "```\n" + c.slice(0, 700) + "\n```" : "",
          ]
            .filter(Boolean)
            .join("\n");
          logCall({
            id: nextCallId(),
            name: "get_current_context",
            args: {},
            result,
            at: Date.now(),
            mutating: false,
          });
          return result;
        },
      },
      {
        name: "use_preset",
        description:
          "Switch which design system governs the user's work. The page updates and the tool surface re-registers, so subsequent checks run against the new system's rules.",
        inputSchema: {
          type: "object",
          properties: {
            preset: {
              type: "string",
              description: "Preset file name, e.g. portfolio.md.",
              enum: presets.map((p) => p.fileName),
            },
          },
          required: ["preset"],
        },
        annotations: { readOnlyHint: false },
        execute: (args) => {
          const wanted = String(args.preset ?? "").trim();
          const match =
            presets.find((p) => p.fileName === wanted) ??
            presets.find((p) =>
              p.name.toLowerCase().includes(wanted.toLowerCase().replace(/\.md$/, "")),
            );
          const result = match
            ? `Switched to **${match.name}** — ${match.componentCount} components, ${match.tokenCount} tokens. Checks now run against its rules.`
            : `No preset named "${wanted}". Available: ${presets
                .map((p) => p.fileName)
                .join(", ")}.`;
          if (match) setDoc(match.fileName);
          logCall({
            id: nextCallId(),
            name: "use_preset",
            args,
            result,
            at: Date.now(),
            mutating: Boolean(match),
          });
          return result;
        },
      },
      {
        name: "apply_token_change",
        description:
          "Change one design token's colour for this session. The page re-renders in the new colour and every later check judges against it. The shipped design system is not modified — this is a proposal the user can see, not a saved edit.",
        inputSchema: {
          type: "object",
          properties: {
            token: {
              type: "string",
              description: 'Token name as the system spells it, e.g. "Oxblood".',
            },
            value: {
              type: "string",
              description: 'New colour as hex, e.g. "#8e2436".',
            },
          },
          required: ["token", "value"],
        },
        annotations: { readOnlyHint: false },
        execute: (args) => {
          const tokenName = String(args.token ?? "").trim();
          const value = String(args.value ?? "").trim().toLowerCase();
          const preset = presets.find((p) => p.fileName === stateRef.current.doc);
          const known = preset?.specimen.colors ?? [];

          if (!/^#[0-9a-f]{3}([0-9a-f]{3})?$/.test(value)) {
            return `"${args.value}" is not a hex colour. Pass something like #8e2436.`;
          }
          const match = known.find(
            (c) => c.name.toLowerCase() === tokenName.toLowerCase(),
          );
          if (!match) {
            return (
              `${preset?.name ?? "This system"} has no token called "${tokenName}". ` +
              `Its tokens are: ${known.map((c) => c.name).join(", ")}.`
            );
          }

          setOverrides((prev) => ({ ...prev, [match.name]: value }));
          const result =
            `**${match.name}** is now \`${value}\` for this session ` +
            `(was \`${match.value}\`). The page has re-rendered and later checks ` +
            `use the new value. Nothing was saved to the design system.`;
          logCall({
            id: nextCallId(),
            name: "apply_token_change",
            args,
            result,
            at: Date.now(),
            mutating: true,
          });
          return result;
        },
      },
      {
        name: "propose_component",
        description:
          "Put component code into the user's editor so they can see it. It is checked against the active design system immediately and the verdict is returned to you. Use this instead of only printing code in chat.",
        inputSchema: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "The full component source to place in the editor.",
            },
          },
          required: ["code"],
        },
        annotations: { readOnlyHint: false },
        execute: async (args) => {
          const source = String(args.code ?? "");
          if (!source.trim()) {
            return "No code supplied. Pass the component source as `code`.";
          }
          setCode(source);
          const text = await check(source, stateRef.current.doc);
          const result =
            (text || "Checked.") +
            "\n\nThe code is now on the user's screen.";
          logCall({
            id: nextCallId(),
            name: "propose_component",
            args: { code: `${source.slice(0, 80)}…` },
            result: text,
            at: Date.now(),
            mutating: true,
          });
          return result;
        },
      },
    ],
    [presets, check, logCall],
  );

  const activeComponents = useMemo(
    () => presets.find((p) => p.fileName === doc)?.components ?? [],
    [presets, doc],
  );

  const serverSpecs = useMemo(
    () => serverToolSpecs(tools, doc, logCall, activeComponents, overrides),
    [tools, doc, logCall, activeComponents, overrides],
  );

  const allTools = useMemo(
    () => [...clientTools, ...serverSpecs],
    [clientTools, serverSpecs],
  );

  const { supported, registered, error } = useWebMcp(allTools);
  const activePreset = presets.find((p) => p.fileName === doc);

  // The specimen renders from the overridden palette, so a token the agent
  // changes is visible on screen rather than only in the checks.
  const liveSpecimen = useMemo(() => {
    if (!activePreset || !Object.keys(overrides).length) return null;
    return {
      ...activePreset.specimen,
      colors: activePreset.specimen.colors.map((c) =>
        overrides[c.name] ? { ...c, value: overrides[c.name] } : c,
      ),
    };
  }, [activePreset, overrides]);

  // Load the active system's own typefaces. Without this the specimen renders
  // in the substitute stack and every preset looks the same.
  useEffect(() => {
    const href = activePreset?.specimen.fontsHref;
    if (!href) return;
    const id = "blocksmith-lab-fonts";
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (link.href !== href) link.href = href;
  }, [activePreset?.specimen.fontsHref]);

  return (
    <div className="lab">
      <LabPresetBar
        presets={presets}
        active={doc}
        onSelect={selectPreset}
        supported={supported}
        registeredCount={registered.length}
        registrationError={error}
      />

      <div className="lab-grid">
        <section className="lab-pane" aria-label="Component code">
          {activePreset ? (
            <LabSpecimen specimen={liveSpecimen ?? activePreset.specimen} />
          ) : null}
          <LabEditor
            code={code}
            onChange={setCode}
            presetName={activePreset?.name ?? doc}
          />
        </section>

        <section className="lab-pane" aria-label="Governance verdict">
          <LabVerdict
            verdict={verdict}
            presetName={activePreset?.name ?? doc}
            onFix={() => void fix()}
            fixing={fixing}
            fixReport={fixReport}
            onDismissFixReport={() => setFixReport(null)}
          />
          <LabActivity calls={calls} />
        </section>
      </div>
    </div>
  );
}
