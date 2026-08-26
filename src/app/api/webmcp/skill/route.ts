import { NextRequest, NextResponse } from "next/server";
import {
  loadDesignSystem,
  readDocMarkdown,
  resolveDocRef,
} from "@/lib/webmcp/registry";
import { buildSkill } from "@/lib/governance/skill";

export const dynamic = "force-dynamic";

/**
 * Serve a design system as a skill file.
 *
 * `export_skill` cannot return this through a tool result — Chrome caps tool
 * output at 1500 characters and a skill is many times that. So the tool
 * returns a summary and this URL, and the agent (or the human) fetches the
 * document itself.
 *
 * Served as plain text so it can be piped straight into a file:
 *   curl -s '/api/webmcp/skill?doc=portfolio.md' > SKILL.md
 */
export async function GET(request: NextRequest) {
  const doc = request.nextUrl.searchParams.get("doc") ?? undefined;

  try {
    const docRef = resolveDocRef(doc);
    const system = loadDesignSystem(docRef);
    const skill = buildSkill(system, readDocMarkdown(docRef));

    return new NextResponse(skill, {
      status: 200,
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        // A design system changes; a stale skill silently governs to old rules.
        "cache-control": "no-store",
        "content-disposition": `inline; filename="${system.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")}-skill.md"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown design system.";
    return NextResponse.json(
      { error: `Could not build a skill for that document. ${message}` },
      { status: 404 },
    );
  }
}
