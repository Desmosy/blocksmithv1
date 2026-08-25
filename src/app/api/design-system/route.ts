/**
 * GET /api/design-system — JSON endpoint for the parsed design system.
 *
 * Returns the full DesignSystem object for any loaded doc.
 * Useful for non-MCP tools, CI scripts, and the future CLI.
 *
 * Query params:
 *   ?doc=apollo.md    — specific doc (defaults to first available)
 *
 * Response: { system: DesignSystem, meta: { ... } }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  loadDesignSystem,
  getDefaultDocFileName,
  getClientMeta,
  prepareDesignSystemDoc,
} from "@/lib/clients/registry";
import { resolveDocParam } from "@/lib/wiki/doc-param";
import { ensureDesignIRWithFonts } from "@/lib/design-ir/ensure";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const docParam = request.nextUrl.searchParams.get("doc");

  let fileName: string;
  try {
    fileName = resolveDocParam(docParam ?? undefined) ?? getDefaultDocFileName();
  } catch {
    return NextResponse.json(
      { error: "Invalid document reference" },
      { status: 400 },
    );
  }

  try {
    await prepareDesignSystemDoc(fileName);
    const system = loadDesignSystem(fileName);
    const meta = getClientMeta(fileName);
    const ir = await ensureDesignIRWithFonts(fileName, system);

    return NextResponse.json({
      ir,
      system: {
        id: system.id,
        name: system.name,
        tagline: system.tagline,
        theme: system.theme,
        overview: system.overview,
        sourcePath: system.sourcePath,
        updatedAt: system.updatedAt,
        contentHash: system.contentHash,
        colors: system.colors,
        typography: system.typography,
        typeScale: system.typeScale,
        spacing: system.spacing,
        borderRadius: system.borderRadius,
        layout: system.layout,
        components: system.components,
        dos: system.dos,
        donts: system.donts,
        surfaces: system.surfaces,
        imagery: system.imagery,
        agentGuide: system.agentGuide,
        similarBrands: system.similarBrands,
      },
      meta: {
        id: meta.id,
        displayName: meta.displayName,
        sourceLabel: meta.sourceLabel,
        parser: meta.parser,
        origin: meta.origin,
      },
    });
  } catch {
    return NextResponse.json(
      { error: `Document not found: ${fileName}` },
      { status: 404 },
    );
  }
}
