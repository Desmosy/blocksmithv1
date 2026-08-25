/**
 * Verify BlockSmith MCP delivers governance via the connector itself (not repo files).
 *
 * Usage: npm run mcp:probe
 *        BLOCKSMITH_DOC=upload:design-xxx.md npm run mcp:probe
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function run() {
  const doc = process.env.BLOCKSMITH_DOC ?? "apollo.md";
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", "--conditions=react-server", "src/mcp/server.ts"],
    env: { ...process.env, BLOCKSMITH_DOC: doc } as Record<string, string>,
  });

  const client = new Client(
    { name: "blocksmith-probe", version: "0.0.0" },
    { capabilities: {} },
  );
  await client.connect(transport);

  const instructions = client.getInstructions?.() ?? "";
  if (!instructions.includes("governed loop")) {
    console.error("FAIL: server instructions missing governed loop");
    process.exit(1);
  }
  console.log("✓ instructions delivered on connect");
  console.log(`  ${instructions.slice(0, 120).replace(/\n/g, " ")}…`);

  const tools = await client.listTools();
  const names = tools.tools.map((t) => t.name).sort();
  const required = [
    "scan_workspace",
    "check_component_governance",
    "get_component_docs",
    "get_component_history",
    "get_design_tokens",
    "get_governance_rules",
    "get_sync_status",
    "list_components",
    "log_component_work",
    "validate_ui_code",
  ];
  const missing = required.filter((n) => !names.includes(n));
  if (missing.length) {
    console.error("FAIL: missing tools:", missing.join(", "));
    process.exit(1);
  }
  console.log(`✓ ${names.length} tools:`, names.join(", "));

  const prompts = await client.listPrompts();
  if (!prompts.prompts.some((p) => p.name === "governed_ui_task")) {
    console.error("FAIL: governed_ui_task prompt not registered");
    process.exit(1);
  }
  console.log("✓ prompts:", prompts.prompts.map((p) => p.name).join(", "));

  const rules = await client.callTool({
    name: "get_governance_rules",
    arguments: { doc },
  });
  const rulesText = (rules.content as { type: string; text: string }[])[0]?.text ?? "";
  if (!rulesText.includes("Allowed color tokens")) {
    console.error("FAIL: get_governance_rules returned unexpected payload");
    process.exit(1);
  }
  console.log("✓ get_governance_rules");
  console.log(rulesText.split("\n").slice(0, 3).join("\n"));

  const bad = await client.callTool({
    name: "validate_ui_code",
    arguments: { doc, code: "button { color: #ff00ff; }" },
  });
  if (!bad.isError) {
    console.error("FAIL: validate_ui_code should flag off-token #ff00ff");
    process.exit(1);
  }
  console.log("✓ validate_ui_code flags off-token colors");

  console.log("\nOK: connector carries governance (no repo rule files required)");
  await client.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
