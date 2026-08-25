/** Remote MCP transport config for Cursor (same shape as `.cursor/mcp.json` server entry). */
export type RemoteMcpTransport = {
  url: string;
  headers: Record<string, string>;
};

export function remoteMcpTransport(baseUrl: string, apiKey: string): RemoteMcpTransport {
  const origin = baseUrl.replace(/\/$/, "");
  return {
    url: `${origin}/api/mcp`,
    headers: { Authorization: `Bearer ${apiKey}` },
  };
}

export function buildMcpJsonConfig(baseUrl: string, apiKey: string) {
  return {
    mcpServers: {
      blocksmith: remoteMcpTransport(baseUrl, apiKey),
    },
  };
}

function base64EncodeJson(value: unknown): string {
  const json = JSON.stringify(value);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(json).toString("base64");
  }
  return btoa(json);
}

/** Cursor one-click install deeplink — https://cursor.com/docs/mcp/install-links */
export function buildCursorMcpDeeplink(
  serverName: string,
  baseUrl: string,
  apiKey: string,
): string {
  const transport = remoteMcpTransport(baseUrl, apiKey);
  const encoded = base64EncodeJson(transport);
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(serverName)}&config=${encoded}`;
}
