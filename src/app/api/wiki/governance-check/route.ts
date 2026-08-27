import { NextRequest, NextResponse } from "next/server";
import { governanceReport, resolveDocRef } from "@/lib/webmcp/registry";

export const dynamic = "force-dynamic";

/**
 * The governance verdict for the wiki's own UI.
 *
 * The Governance panel used to call the agent tool and render its text. That
 * text is capped at eight violations because WebMCP gives a tool 1500
 * characters — a sensible budget for an agent and a bad one for a person, who
 * got "…and 3 more" with no way to see them.
 *
 * Same engine, same rule ids, no cap.
 */
export async function POST(request: NextRequest) {
  let body: { code?: unknown; doc?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code : "";
  if (!code.trim()) {
    return NextResponse.json({ error: "`code` is required." }, { status: 400 });
  }

  try {
    const doc = resolveDocRef(typeof body.doc === "string" ? body.doc : undefined);
    const report = governanceReport(code, { doc });
    return NextResponse.json(
      { total: report.total, systemName: report.systemName, detail: report.detail },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Check failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
