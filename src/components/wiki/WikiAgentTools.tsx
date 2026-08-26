"use client";

/**
 * WikiAgentTools — registers BlockSmith's WebMCP tools on the wiki.
 *
 * This is the point of the whole exercise: an agent looking at the design
 * system a team actually uses gets that system's rules as callable tools,
 * bound to the document the human is currently reading. It renders a single
 * status line so the human can see the surface is live — an agent calling
 * tools invisibly is indistinguishable from one making things up.
 */

import { useEffect, useMemo, useState } from "react";
import { useWebMcp, type WebMcpToolSpec } from "@/hooks/useWebMcp";
import { serverToolSpecs, type ToolDescriptor } from "@/lib/webmcp/client";
import { isWebMcpSupported } from "@/lib/webmcp/types";
import { setProposal } from "@/lib/webmcp/proposal-store";

export function WikiAgentTools({
  docFileName,
  systemName,
}: {
  /** The doc the reader is on, so tools answer for what is on screen. */
  docFileName?: string;
  systemName?: string;
}) {
  const [tools, setTools] = useState<ToolDescriptor[]>([]);

  // Fetch descriptors rather than threading them from the server through every
  // layer of the shell. Skipped entirely when the browser has no agent surface,
  // so a normal visitor never pays for a request they cannot use.
  useEffect(() => {
    if (!isWebMcpSupported()) return;
    const controller = new AbortController();
    fetch("/api/webmcp/invoke", { signal: controller.signal })
      .then((r) => r.json())
      .then((d: { tools?: ToolDescriptor[] }) => setTools(d.tools ?? []))
      .catch(() => {
        /* no agent surface is the common case; failing quietly is correct */
      });
    return () => controller.abort();
  }, []);

  /**
   * The one tool that can only run in the page: what the reader is actually
   * looking at. A remote MCP server cannot answer this, which is the clearest
   * thing WebMCP adds over the transport BlockSmith already had.
   */
  const pageTools = useMemo<WebMcpToolSpec[]>(
    () => [
      {
        name: "propose_component",
        description:
          "Put a component in front of the user on the page they are reading, rendered in this design system's own tokens, and get back the governance verdict. Use this instead of only printing code in chat — the user should see the thing, not the markup.",
        inputSchema: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "The component markup to show.",
            },
            intent: {
              type: "string",
              description: "One line on what you built, e.g. \"pricing card\".",
            },
          },
          required: ["code"],
        },
        // Puts something on the user's screen, so it is not a read.
        annotations: { readOnlyHint: false },
        execute: async (args) => {
          const code = String(args.code ?? "").trim();
          if (!code) return "No code supplied. Pass the component markup as `code`.";

          setProposal({
            code,
            intent: args.intent ? String(args.intent) : undefined,
            at: Date.now(),
          });

          // Return the verdict in the same call so the agent can correct itself
          // without a second round trip.
          try {
            const res = await fetch("/api/webmcp/invoke", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                tool: "check_governance",
                args: { code },
                doc: docFileName,
              }),
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
        name: "get_current_context",
        description:
          "See what the user is looking at right now: which design system is open in their browser and which page of it. Call this first so your answer applies to their actual screen rather than a guess.",
        inputSchema: { type: "object", properties: {} },
        annotations: { readOnlyHint: true },
        execute: () => {
          const path = window.location.pathname;
          const section =
            path.replace(/^\/wiki\/?/, "").replace(/\/$/, "") || "introduction";
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

  const specs = useMemo<WebMcpToolSpec[]>(
    () => [...pageTools, ...serverToolSpecs(tools, docFileName, () => {})],
    [pageTools, tools, docFileName],
  );

  const { supported, registered, error } = useWebMcp(specs);

  if (error) {
    return (
      <p className="text-[11px] text-[var(--wiki-muted)]">
        Agent tools failed to register — {error}
      </p>
    );
  }
  if (!supported) return null;

  return (
    <p
      className="inline-flex items-center gap-1.5 text-[11px] text-[var(--wiki-muted)]"
      role="status"
    >
      <span
        aria-hidden="true"
        className="size-1.5 rounded-full bg-[var(--wiki-text)]"
      />
      {registered.length} agent tools live on this page
    </p>
  );
}
