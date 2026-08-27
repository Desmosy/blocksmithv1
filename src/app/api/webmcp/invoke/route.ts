import { NextRequest, NextResponse } from "next/server";
import { prepareDesignSystemDoc } from "@/lib/clients/registry";
import {
  WEBMCP_TOOLS,
  WEBMCP_TOOLS_BY_NAME,
  clampOutput,
} from "@/lib/webmcp/registry";

export const dynamic = "force-dynamic";

const MAX_OVERRIDES = 40;

/** Keep only well-formed hex overrides, and cap how many a request may carry. */
function sanitizeOverrides(
  raw: unknown,
): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, string> = {};
  let n = 0;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (n >= MAX_OVERRIDES) break;
    if (typeof key !== "string" || typeof value !== "string") continue;
    if (!/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(value.trim())) continue;
    out[key.slice(0, 80)] = value.trim().toLowerCase();
    n++;
  }
  return n ? out : undefined;
}

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
  let body: {
    tool?: string;
    args?: Record<string, unknown>;
    doc?: string;
    tokenOverrides?: Record<string, string>;
  };
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
    /**
     * Hydrate the document before running anything against it.
     *
     * `loadDesignSystem` is synchronous and reads from an in-process cache, so
     * a captured or uploaded doc has to be pulled out of Supabase first. On a
     * single long-lived server the capture that created it did that already;
     * on serverless the next request is a different instance with an empty
     * cache, and every tool answered "not loaded — call prepareDesignSystemDoc
     * first" for a document that was sitting in storage the whole time.
     */
    if (body.doc) {
      try {
        await prepareDesignSystemDoc(body.doc);
      } catch {
        // A doc that cannot be hydrated will fail in the tool with a message
        // written for the caller; failing here would lose that.
      }
    }

    const text = await tool.run(body.args ?? {}, {
      doc: body.doc,
      // Session-local only: overrides arrive per request and are never
      // persisted. This route is public, so a token edit must not be able to
      // rewrite a shipped preset for everyone.
      tokenOverrides: sanitizeOverrides(body.tokenOverrides),
    });
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

/**
 * Lets the page (and DevTools) confirm what's exposed without invoking anything.
 *
 * `inputSchema` is part of the descriptor: the page registers these tools with
 * WebMCP, and a tool registered without its schema gives the agent no way to
 * know what arguments it takes. It is also what `bindComponentEnum` narrows to
 * the active design system, so leaving it out makes every system's tool surface
 * identical and `toolchange` never fires.
 */
export async function GET() {
  return NextResponse.json({
    tools: WEBMCP_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      annotations: t.annotations,
    })),
  });
}
