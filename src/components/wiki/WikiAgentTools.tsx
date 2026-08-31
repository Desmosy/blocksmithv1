"use client";

/**
 * WikiAgentTools — registers BlockSmith's WebMCP tools on the wiki.
 *
 * This is the point of the whole exercise: an agent looking at the design
 * system a team actually uses gets that system's rules as callable tools,
 * bound to the document the human is currently reading. The human sees the
 * same surface through the tool panel — an agent calling tools invisibly is
 * indistinguishable from one making things up.
 *
 * The page tools' descriptors (name, description, schema) come from
 * `page-tools.ts`, the one place the manifest and the verifier read them
 * from; only the implementations live here, because they touch page state.
 */

import { useEffect, useMemo, useState } from "react";
import { useWebMcp, type WebMcpToolSpec } from "@/hooks/useWebMcp";
import { serverToolSpecs, type ToolDescriptor } from "@/lib/webmcp/client";
import { pageTool, PAGE_TOOLS } from "@/lib/webmcp/page-tools";
import { setProposal } from "@/lib/webmcp/proposal-store";
import { AgentToolPanel, type PanelTool } from "@/components/webmcp/AgentToolPanel";

export function WikiAgentTools({
  docFileName,
  systemName,
  components = [],
}: {
  /** The doc the reader is on, so tools answer for what is on screen. */
  docFileName?: string;
  systemName?: string;
  /**
   * Component names in the open system, bound into the schemas that take one.
   * This is what makes the tool surface differ between design systems, so
   * switching one fires `toolchange` instead of leaving the agent on a stale
   * enum from the system it was looking at before.
   */
  components?: string[];
}) {
  const [tools, setTools] = useState<ToolDescriptor[]>([]);

  // Fetched in every browser: the panel lists the surface even where no
  // agent can use it, so a reader without the flag still sees what exists.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/webmcp/invoke", { signal: controller.signal })
      .then((r) => r.json())
      .then((d: { tools?: ToolDescriptor[] }) => setTools(d.tools ?? []))
      .catch(() => {
        /* the wiki works without the list */
      });
    return () => controller.abort();
  }, []);

  /**
   * The tools that can only run in the page: what the reader is actually
   * looking at, and putting work on their screen. A remote MCP server cannot
   * do either, which is the clearest thing WebMCP adds over the transport
   * BlockSmith already had.
   */
  const pageTools = useMemo<WebMcpToolSpec[]>(
    () => [
      {
        ...pageTool("propose_component"),
        execute: async (args) => {
          const code = String(args.code ?? "").trim();
          if (!code) return "No code supplied. Pass the component markup as `code`.";

          const intent = args.intent ? String(args.intent) : undefined;
          setProposal({ code, intent, at: Date.now() });

          // Publish it so the human sees this even when they are in a different
          // browser — an agent in ChatGPT's browser is not in the user's Chrome.
          void fetch("/api/webmcp/proposal", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ code, intent, doc: docFileName }),
          }).catch(() => {
            /* the local view already updated; publishing is best effort */
          });

          // Return the verdict in the same call so the agent can correct itself
          // without a second round trip.
          try {
            const res = await fetch("/api/webmcp/invoke", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ tool: "check_governance", args: { code }, doc: docFileName }),
            });
            const data = (await res.json()) as { text?: string };
            return (
              (data.text ?? "Shown on the page.") +
              "\n\nIt is now on the user's screen, rendered in this system's tokens."
            );
          } catch {
            return "Shown on the user's screen, but the governance check could not run.";
          }
        },
      },
      {
        ...pageTool("propose_design_change"),
        execute: async (args) => {
          const blockId = String(args.blockId ?? "").trim();
          const summary = String(args.summary ?? "").trim();
          if (!blockId || !summary) return "Pass at least `blockId` and `summary`.";

          let updatedData: unknown;
          const raw = args.updatedData;
          if (typeof raw === "string") {
            try {
              updatedData = JSON.parse(raw);
            } catch {
              return "`updatedData` must be valid JSON for that block type.";
            }
          } else {
            updatedData = raw;
          }

          try {
            const res = await fetch("/api/webmcp/change", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                blockId,
                summary,
                updatedData,
                rationale: args.rationale ? String(args.rationale) : undefined,
                // Adding a token is a different intent from editing one, and
                // the editor will not infer it — so the proposal has to say so.
                create: args.create === true || String(args.create ?? "") === "true",
                doc: docFileName,
              }),
            });
            const data = (await res.json()) as { error?: string; pending?: number };
            if (data.error) return data.error;
            return [
              `Staged: “${summary}”.`,
              "",
              "It is now waiting on the design system page for the user to approve",
              "or discard. You cannot apply it yourself — only they can, and the",
              `change does not exist in ${systemName ?? "the system"} until they do.`,
            ].join("\n");
          } catch {
            return "Could not stage that change. The page may be offline.";
          }
        },
      },
      {
        ...pageTool("get_current_context"),
        execute: () => {
          const path = window.location.pathname;
          const section = path.replace(/^\/wiki\/?/, "").replace(/\/$/, "") || "introduction";
          return [
            `The user has **${systemName ?? docFileName ?? "a design system"}** open`,
            docFileName ? ` (\`${docFileName}\`)` : "",
            `, on the ${section.replace(/\//g, " › ")} page.`,
            "\n\nCall get_governance_rules for its tokens, or list_components",
            " for what it offers and what it has ruled out.",
          ].join("");
        },
      },
    ],
    [docFileName, systemName],
  );

  // Join on a stable key: a new array with the same names must not re-register.
  const componentKey = components.join("\u0000");
  const specs = useMemo<WebMcpToolSpec[]>(
    () => [
      ...pageTools,
      ...serverToolSpecs(tools, docFileName, () => {}, componentKey ? componentKey.split("\u0000") : []),
    ],
    [pageTools, tools, docFileName, componentKey],
  );

  const { supported, registered, error } = useWebMcp(specs);

  const panel: PanelTool[] = [
    ...PAGE_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      readOnly: t.annotations.readOnlyHint === true,
      kind: "page" as const,
    })),
    ...tools.map((t) => ({
      name: t.name,
      description: t.description,
      readOnly: t.annotations?.readOnlyHint === true,
      kind: "server" as const,
    })),
  ];

  return (
    <AgentToolPanel
      tools={panel}
      registered={registered}
      supported={supported}
      error={error}
      scope={systemName}
      tone="wiki"
    />
  );
}
