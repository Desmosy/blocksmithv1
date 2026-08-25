/**
 * P2 — MCP get_sync_status includes workspace-scan stale/hosted fields.
 * Usage: npm run verify:mcp-sync
 */
import { join } from "path";
import { handleGetSyncStatus } from "../src/mcp/handlers";
import { hydrateUploadMarkdown } from "../src/lib/uploads/persist";

async function main() {
  process.env.AI_LAB_SCAN_CURATE = "0";
  const { scanAndPersist } = await import("../src/lib/scan/run");
  const FIXTURE = join(process.cwd(), "fixtures", "vendor-ui");

  const persisted = await scanAndPersist(FIXTURE);
  await hydrateUploadMarkdown(persisted.fileName);

  const status = handleGetSyncStatus({ doc: persisted.docRef });

  if (!status.workspaceScan) {
    throw new Error("Expected workspaceScan in get_sync_status");
  }
  const ws = status.workspaceScan as {
    isWorkspaceScan: boolean;
    stale: boolean;
    hostedRefreshOnly: boolean;
  };
  if (!ws.isWorkspaceScan) {
    throw new Error("Expected isWorkspaceScan true");
  }
  if (typeof ws.stale !== "boolean") {
    throw new Error("Expected stale boolean");
  }
  if (typeof ws.hostedRefreshOnly !== "boolean") {
    throw new Error("Expected hostedRefreshOnly boolean");
  }
  if (!status.mcpNote || typeof status.mcpNote !== "string") {
    throw new Error("Expected mcpNote string");
  }

  console.log("[verify:mcp-sync] OK");
  console.log("  doc:", persisted.docRef);
  console.log("  stale:", ws.stale);
  console.log("  hostedRefreshOnly:", ws.hostedRefreshOnly);
}

main().catch((err) => {
  console.error("[verify:mcp-sync] FAIL", err);
  process.exit(1);
});
