/**
 * The discovery manifest: everything an agent can call on BlockSmith, in one
 * document, served at /.well-known/webmcp.json.
 *
 * WebMCP tools are discovered by being on the page; a manifest lets an agent
 * (or a judge) see the whole surface before opening anything — which page
 * registers what, how each tool is invoked, and what the remote MCP server
 * adds. Everything here is read from the registry, so the manifest cannot
 * describe a tool that does not exist.
 */

import { BLOCKSMITH_MCP_TOOL_NAMES } from "@/lib/mcp/blocksmith-server";
import { ANYWHERE_SCRIPT_PATH, ANYWHERE_TOOLS } from "./anywhere-tools";
import { PAGE_TOOLS } from "./page-tools";
import { WEBMCP_LIMITS, WEBMCP_TOOLS } from "./registry";

export const WEBMCP_MANIFEST_PATH = "/.well-known/webmcp.json";

export function buildWebMcpManifest(origin: string) {
  const serverTools = WEBMCP_TOOLS.map((t) => ({
    name: t.name,
    kind: "server" as const,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: t.annotations,
    invoke: {
      method: "POST",
      url: `${origin}/api/webmcp/invoke`,
      body: { tool: t.name, args: "<arguments>", doc: "<optional design system ref>" },
      returns: "{ text }",
    },
  }));
  const pageTools = PAGE_TOOLS.map((t) => ({
    name: t.name,
    kind: "page" as const,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: t.annotations,
    invoke: { how: "document.modelContext on /wiki — runs in the reader's browser, no HTTP equivalent" },
  }));
  const anywhereTools = ANYWHERE_TOOLS.map((t) => ({
    name: t.name,
    kind: "anywhere" as const,
    description: t.description,
    parameters: t.parameters,
    annotations: { readOnlyHint: t.readOnly },
    invoke: { how: `registered on any site by ${origin}${ANYWHERE_SCRIPT_PATH}; backed by ${t.backedBy}` },
  }));

  return {
    name: "BlockSmith",
    description:
      "Design-system governance for agents: read a system's rules, check code against it, capture a system from any site, and stage changes for a human to approve.",
    origin,
    protocol: {
      name: "WebMCP",
      api: "document.modelContext.registerTool",
      spec: "https://github.com/webmachinelearning/webmcp",
      limits: WEBMCP_LIMITS,
    },
    surfaces: [
      {
        page: `${origin}/wiki?doc=<design system ref>`,
        description: "Every design system page. Tools are bound to the document on screen; switching systems re-registers them.",
        tools: [...WEBMCP_TOOLS.map((t) => t.name), ...PAGE_TOOLS.map((t) => t.name)],
      },
      {
        page: `${origin}/dashboard`,
        description: "The signed-in home. Read-only tools against the default system, so an agent can start work before a page is chosen.",
        tools: WEBMCP_TOOLS.filter((t) => t.annotations.readOnlyHint).map((t) => t.name),
      },
      {
        page: "any website",
        description: `Bookmarklet or the BlockSmith extension runs ${ANYWHERE_SCRIPT_PATH} on the open site and registers these there.`,
        script: `${origin}${ANYWHERE_SCRIPT_PATH}`,
        tools: ANYWHERE_TOOLS.map((t) => t.name),
      },
    ],
    tools: [...serverTools, ...pageTools, ...anywhereTools],
    remoteMcp: {
      endpoint: `${origin}/api/mcp`,
      transport: "streamable-http",
      auth: "Authorization: Bearer <BlockSmith API key>",
      tools: [...BLOCKSMITH_MCP_TOOL_NAMES],
      note: "The same governance engine, for agents outside a browser (Cursor, Claude Code, CI).",
    },
    examples: [
      {
        tool: "check_governance",
        doc: "saas.md",
        args: { code: '<button style="background:#ff0000;border-radius:2px">Buy now</button>' },
        expect: "Violations with rule ids and the nearest token for each off-system value.",
      },
      {
        tool: "capture_site_design",
        args: { url: "https://cohere.com" },
        expect: "A design system measured from the rendered page, saved as upload:capture-cohere-<id>.md.",
      },
      {
        tool: "figma_token_drift",
        doc: "saas.md",
        args: { variables: { "Color/Brand": "#4c70e8", "Radius/Medium": "8" } },
        expect: "Figma says X, code says Y — per token, with renames and near misses told apart from real drift.",
      },
    ],
    counts: {
      server: WEBMCP_TOOLS.length,
      page: PAGE_TOOLS.length,
      anywhere: ANYWHERE_TOOLS.length,
      remoteMcp: BLOCKSMITH_MCP_TOOL_NAMES.length,
    },
  };
}

export type WebMcpManifest = ReturnType<typeof buildWebMcpManifest>;
