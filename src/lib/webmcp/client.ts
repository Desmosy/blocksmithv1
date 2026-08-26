/**
 * Browser-side plumbing for the WebMCP layer.
 *
 * Server tools (the registry) answer questions about the design system and are
 * dispatched over HTTP. Client tools act on what the human is currently looking
 * at — the open preset, the code in the editor — and can only run in the page.
 * Both kinds end up in the same `document.modelContext` surface.
 */

import type { WebMcpToolSpec } from "@/hooks/useWebMcp";

/** Tool descriptor as served by `GET /api/webmcp/invoke`. */
export type ToolDescriptor = {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
};

/** One agent tool call, for the activity log the human watches. */
export type ToolCall = {
  id: number;
  name: string;
  args: Record<string, unknown>;
  result: string;
  at: number;
  /** A call that changed page state rather than answering a question. */
  mutating: boolean;
};

let callSeq = 0;
export const nextCallId = (): number => ++callSeq;

/**
 * Fill a tool's `component` parameter with the components the active system
 * actually has.
 *
 * This is what makes the tool surface live rather than static: swapping the
 * design system rewrites the schema, the tool re-registers, and the agent's
 * options change with it — so it can no longer name a component that was valid
 * under the previous system. Without this the surface is identical for every
 * design system and `toolchange` never fires.
 */
function bindComponentEnum(
  tool: ToolDescriptor,
  components: string[],
): Record<string, unknown> | undefined {
  const schema = tool.inputSchema as
    | { properties?: Record<string, Record<string, unknown>> }
    | undefined;
  if (!schema?.properties?.component || !components.length) {
    return tool.inputSchema;
  }
  return {
    ...schema,
    properties: {
      ...schema.properties,
      component: { ...schema.properties.component, enum: components },
    },
  };
}

/**
 * Turn server tool descriptors into registrable specs whose `execute` posts to
 * the dispatch route. `onCall` feeds the activity log so the human can see what
 * the agent did without reading a devtools panel.
 */
export function serverToolSpecs(
  tools: ToolDescriptor[],
  doc: string | undefined,
  onCall: (call: ToolCall) => void,
  /** Component names in the active system, bound into schemas that take one. */
  components: string[] = [],
  /** Session-local token edits, sent with every call so checks stay current. */
  tokenOverrides: Record<string, string> = {},
): WebMcpToolSpec[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: bindComponentEnum(t, components),
    annotations: t.annotations,
    execute: async (args) => {
      let result: string;
      try {
        const res = await fetch("/api/webmcp/invoke", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tool: t.name, args, doc, tokenOverrides }),
        });
        const data = (await res.json()) as { text?: string; error?: string };
        result = data.text ?? data.error ?? "Tool returned nothing.";
      } catch (err) {
        // Return the failure as tool text rather than throwing: a described
        // failure is something the agent can retry from, an exception is not.
        result = `Error: ${
          err instanceof Error ? err.message : "the request failed"
        }. The page may be offline — try again.`;
      }
      onCall({
        id: nextCallId(),
        name: t.name,
        args,
        result,
        at: Date.now(),
        mutating: false,
      });
      return result;
    },
  }));
}
