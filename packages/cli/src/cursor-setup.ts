import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";
import type { Flags } from "./args.js";
import { flagBool, flagStr } from "./args.js";
import { loadConfig } from "./config.js";
import { resolvePullWorkspace } from "./resolve-workspace.js";

function remoteMcpTransport(baseUrl: string, apiKey: string) {
  const origin = baseUrl.replace(/\/$/, "");
  return {
    url: `${origin}/api/mcp`,
    headers: { Authorization: `Bearer ${apiKey}` },
  };
}

function cursorMcpDeeplink(baseUrl: string, apiKey: string): string {
  const encoded = Buffer.from(JSON.stringify(remoteMcpTransport(baseUrl, apiKey))).toString(
    "base64",
  );
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent("blocksmith")}&config=${encoded}`;
}

export function cmdSetupCursor(flags: Flags): void {
  const config = loadConfig();
  if (!config) {
    throw new Error(
      "Not logged in. Run:\n  blocksmith login --key bs_live_… --url <host>\n" +
        "Create a key in the wiki under Sync → API keys.",
    );
  }

  const global = flagBool(flags, "global", "g");
  const workspace = flagStr(flags, "workspace", "w");

  let targetPath: string;
  if (global) {
    targetPath = join(homedir(), ".cursor", "mcp.json");
  } else {
    const resolved = resolvePullWorkspace({ explicit: workspace });
    targetPath = join(resolved.path, ".cursor", "mcp.json");
  }

  const entry = { blocksmith: remoteMcpTransport(config.baseUrl, config.apiKey) };
  let merged: { mcpServers: Record<string, unknown> } = { mcpServers: entry };

  if (existsSync(targetPath)) {
    try {
      const existing = JSON.parse(readFileSync(targetPath, "utf-8")) as {
        mcpServers?: Record<string, unknown>;
      };
      merged = {
        mcpServers: { ...(existing.mcpServers ?? {}), ...entry },
      };
    } catch {
      /* replace unreadable file */
    }
  }

  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, `${JSON.stringify(merged, null, 2)}\n`, "utf-8");

  console.log(`Wrote ${targetPath}`);
  console.log("\nRestart Cursor or refresh MCP in Settings → MCP.");
  console.log("\nOne-click install (open while Cursor is running):");
  console.log(cursorMcpDeeplink(config.baseUrl, config.apiKey));
}
