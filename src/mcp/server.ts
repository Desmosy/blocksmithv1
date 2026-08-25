#!/usr/bin/env npx tsx
/**
 * BlockSmith MCP server — stdio transport (local IDE).
 * Remote HTTP: /api/mcp (Pattern 3) — see docs/DISTRIBUTION.md
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createBlocksmithMcpServer } from "@/lib/mcp/blocksmith-server";

async function main() {
  const server = createBlocksmithMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[blocksmith-mcp] ready on stdio");
}

main().catch((err) => {
  console.error("[blocksmith-mcp] fatal:", err);
  process.exit(1);
});
