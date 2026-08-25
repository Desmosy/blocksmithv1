import { createApiKey } from "../src/lib/cloud/api-keys";

async function main() {
  process.env.BLOCKSMITH_ADMIN_SECRET ??= "test-admin-secret";
  const { key } = createApiKey("mcp-accept-test");
  const r = await fetch("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "1" },
      },
    }),
  });
  const body = await r.text();
  console.log("Status:", r.status);
  console.log("Body:", body.slice(0, 400));
  if (!r.ok || !body.includes("blocksmith")) process.exit(1);
  console.log("OK — remote MCP accepts initialize with Cursor-style headers");
}

main();
