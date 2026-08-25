/**
 * GET /api/wiki/export — Export the current wiki as markdown.
 *
 * Query params:
 *   ?doc=apollo.md     — which doc to export
 *   ?format=md         — "md" (default) or "json"
 *
 * Returns a downloadable markdown file containing all wiki content
 * structured as a single document with sections.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  loadDesignSystem,
  getDefaultDocFileName,
} from "@/lib/clients/registry";
import { resolveDocParam } from "@/lib/wiki/doc-param";
import { generateDesignSystemMarkdown } from "@/lib/wiki/export-markdown";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const docParam = request.nextUrl.searchParams.get("doc");
  const format = request.nextUrl.searchParams.get("format") ?? "md";

  let fileName: string;
  try {
    fileName = resolveDocParam(docParam ?? undefined) ?? getDefaultDocFileName();
  } catch {
    return NextResponse.json({ error: "Invalid document reference" }, { status: 400 });
  }

  let system;
  try {
    system = loadDesignSystem(fileName);
  } catch {
    return NextResponse.json({ error: `Document not found: ${fileName}` }, { status: 404 });
  }

  if (format === "json") {
    return NextResponse.json({ system });
  }

  const md = generateDesignSystemMarkdown(system);
  const safeName = system.name.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-").toLowerCase();

  return new Response(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}-wiki-export.md"`,
    },
  });
}
