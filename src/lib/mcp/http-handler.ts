import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createBlocksmithMcpServer } from "./blocksmith-server";

/**
 * Stateless remote MCP — one Server + Transport per HTTP request (Pattern 3).
 */
export async function handleRemoteMcpRequest(request: Request): Promise<Response> {
  const server = createBlocksmithMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}
