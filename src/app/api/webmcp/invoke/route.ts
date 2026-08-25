import { NextRequest, NextResponse } from "next/server";
import {
  WEBMCP_TOOLS,
  WEBMCP_TOOLS_BY_NAME,
  clampOutput,
} from "@/lib/webmcp/registry";

export const dynamic = "force-dynamic";

/**
 * Server dispatch for the in-page WebMCP tools.
 *
 * The browser can't call the tool handlers directly — they read the design
 * system off the server. So the registered tool's `execute` posts here, and
 * this route runs the shared implementation from the registry.
 *
 * Read-only tools are open so judges reach a working tool with no auth wall.
 * Any tool that mutates state must go through the existing promote/lock gates,
 * not through this route.
 */
export async function POST(request: NextRequest) {
  let body: { tool?: string; args?: Record<string, unknown>; doc?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const name = typeof body.tool === "string" ? body.tool : "";
  const tool = WEBMCP_TOOLS_BY_NAME.get(name);

  if (!tool) {
    return NextResponse.json(
      {
        error: `Unknown tool "${name}".`,
        available: WEBMCP_TOOLS.map((t) => t.name),
      },
      { status: 404 },
    );
  }

  if (!tool.annotations.readOnlyHint) {
    return NextResponse.json(
      { error: `"${name}" changes state and cannot be invoked over this route.` },
      { status: 403 },
    );
  }

  try {
    const text = await tool.run(body.args ?? {}, { doc: body.doc });
    return NextResponse.json({ text: clampOutput(text) });
  } catch (err) {
    // Return the failure as tool text, not an HTTP error: a descriptive
    // message lets the agent self-correct and retry, which is what Chrome's
    // best-practices guidance asks for.
    const message = err instanceof Error ? err.message : "Tool failed.";
    console.error(`[webmcp/${name}]`, err);
    return NextResponse.json({ text: `Error: ${message}` });
  }
}

/** Lets the page (and DevTools) confirm what's exposed without invoking anything. */
export async function GET() {
  return NextResponse.json({
    tools: WEBMCP_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      annotations: t.annotations,
    })),
  });
}
