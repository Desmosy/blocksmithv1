"use client";

import { useMemo } from "react";
import { useWebMcp, type WebMcpToolSpec } from "@/hooks/useWebMcp";

/**
 * Mounts BlockSmith's WebMCP tools on whatever page renders it.
 *
 * The tool *definitions* come from the server (`GET /api/webmcp/invoke`
 * mirrors the shared registry), but registration has to happen in the browser
 * — so this component holds the client half: it turns each definition into a
 * tool whose `execute` posts back to the dispatch route.
 *
 * Renders nothing by default. Pass `showStatus` on the demo page so a human
 * can see the agent surface is live.
 */
export function WebMcpTools({
  doc,
  tools,
  showStatus = false,
}: {
  /** Document the tools operate against; omit for the server default. */
  doc?: string;
  /** Tool descriptors from the shared registry. */
  tools: { name: string; description: string; inputSchema?: Record<string, unknown>; annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean } }[];
  showStatus?: boolean;
}) {
  const specs = useMemo<WebMcpToolSpec[]>(
    () =>
      tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        annotations: t.annotations,
        execute: async (args) => {
          const res = await fetch("/api/webmcp/invoke", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ tool: t.name, args, doc }),
          });
          const data = (await res.json()) as { text?: string; error?: string };
          return data.text ?? data.error ?? "Tool returned nothing.";
        },
      })),
    [tools, doc],
  );

  const { supported, registered, error } = useWebMcp(specs);

  if (!showStatus) return null;

  return (
    <div className="rounded-lg border border-[var(--wiki-border)] p-3 text-xs">
      {!supported ? (
        <p className="text-[var(--wiki-muted)]">
          Agent tools are off in this browser. Enable{" "}
          <code className="font-mono">chrome://flags/#enable-webmcp-testing</code>{" "}
          and relaunch, or open this page in ChatGPT&apos;s browser.
        </p>
      ) : error ? (
        <p className="text-red-500">Could not register agent tools: {error}</p>
      ) : (
        <p className="text-[var(--wiki-muted)]">
          <span className="font-semibold text-emerald-500">
            {registered.length} agent tools ready
          </span>{" "}
          — {registered.join(", ")}
        </p>
      )}
    </div>
  );
}
