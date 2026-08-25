/**
 * Live HTTP test — Patterns 2, 3, 4 against running dev server.
 * Usage: npm run dev (separate terminal) && npm run verify:patterns-live
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { createApiKey } from "../src/lib/cloud/api-keys";

function loadEnvLocal() {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  loadEnvLocal();
  process.env.BLOCKSMITH_ADMIN_SECRET ??= "test-admin-secret";
  process.env.AI_LAB_SCAN_CURATE = "0";

  const base = process.env.BLOCKSMITH_API_URL ?? "http://localhost:3000";
  const { key } = createApiKey("patterns-live-test");
  const auth = { Authorization: `Bearer ${key}` };

  const results: Record<string, string> = {};

  const me = await fetch(`${base}/api/v1/me`, { headers: auth });
  results["P2 GET /api/v1/me"] =
    me.ok ? `OK ${me.status}` : `FAIL ${me.status} ${await me.text()}`;

  const { BlockSmith } = await import("../packages/sdk/dist/index.js");
  const client = new BlockSmith({ apiKey: key, baseUrl: base });
  try {
    const sdkMe = await client.me();
    results["P4 SDK client.me()"] = sdkMe.ok ? `OK prefix ${sdkMe.key.prefix}` : "FAIL";
  } catch (e) {
    results["P4 SDK client.me()"] = `FAIL ${e instanceof Error ? e.message : e}`;
  }

  const scan = await fetch(`${base}/api/v1/scans`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ fixture: "vendor" }),
  });
  results["P2 POST /api/v1/scans"] =
    scan.ok ? `OK ${scan.status}` : `FAIL ${scan.status} ${(await scan.text()).slice(0, 120)}`;

  const mcp = await fetch(`${base}/api/mcp`, {
    method: "POST",
    headers: {
      ...auth,
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
        clientInfo: { name: "verify", version: "1" },
      },
    }),
  });
  const mcpBody = await mcp.text();
  results["P3 POST /api/mcp initialize"] =
    mcp.ok && mcpBody.includes("blocksmith")
      ? `OK ${mcp.status}`
      : `FAIL ${mcp.status} ${mcpBody.slice(0, 150)}`;

  try {
    const sdkScan = await client.createScan({ fixture: "vendor" });
    results["P4 SDK createScan()"] = sdkScan.success
      ? `OK ${sdkScan.fileName}`
      : "FAIL";
  } catch (e) {
    results["P4 SDK createScan()"] = `FAIL ${e instanceof Error ? e.message : e}`;
  }

  const demo = await fetch(`${base}/demo/pulse`);
  const demoHtml = await demo.text();
  results["Pulse /demo/pulse"] =
    demo.ok && demoHtml.includes("acme-ui-kit")
      ? `OK ${demo.status}`
      : `FAIL ${demo.status}`;

  try {
    const sdkCodegen = await client.codegen.pulse({
      doc: "upload:scan-acme-ui-kit.md",
    });
    results["P2 POST /api/v1/codegen/pulse"] = sdkCodegen.packageName.includes("acme")
      ? `OK ${sdkCodegen.packageName}`
      : "FAIL";
  } catch (e) {
    results["P2 POST /api/v1/codegen/pulse"] =
      `FAIL ${e instanceof Error ? e.message : e}`;
  }

  // CLI binary exists
  const cliPath = join(process.cwd(), "packages/cli/dist/cli.js");
  results["P2 CLI built"] = existsSync(cliPath) ? "OK dist/cli.js" : "FAIL not built";

  console.log("Patterns 2–4 live verification");
  console.log(`  Base URL: ${base}`);
  console.log("");
  for (const [k, v] of Object.entries(results)) {
    console.log(`  ${v.startsWith("OK") ? "✓" : "✗"} ${k}: ${v}`);
  }

  const failed = Object.values(results).filter((v) => !v.startsWith("OK"));
  if (failed.length) {
    console.error(`\n${failed.length} check(s) failed — is npm run dev running?`);
    process.exit(1);
  }
  console.log("\nOK — Patterns 2, 3, 4 work against live HTTP.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
