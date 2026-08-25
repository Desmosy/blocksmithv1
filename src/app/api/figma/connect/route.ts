import { NextRequest, NextResponse } from "next/server";
import { handleImportFigmaVariables } from "@/mcp/handlers";
import {
  parseFigmaFileKey,
  fetchFigmaFile,
  extractFigmaFile,
  fetchFigmaFrameImages,
} from "@/lib/figma/rest";
import { extractFigmaVisualEnrichment, isCaptureConfigured } from "@/lib/ingest/capture";

export const dynamic = "force-dynamic";
/** Fetching a large Figma file can exceed the default budget. */
export const maxDuration = 60;

/**
 * UI connector: paste a Figma file URL + personal access token → import its
 * tokens + components into a governed design.md. Uses the Figma REST API (the
 * web app can't use the agent-side MCP), recovering tokens from color/text
 * styles and raw fills so it works on any Figma plan (not just Enterprise).
 *
 * Body: { figmaUrl, figmaToken, projectName? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      figmaUrl?: string;
      figmaToken?: string;
      projectName?: string;
      visualEnrichment?: boolean;
    };

    const fileKey = body.figmaUrl ? parseFigmaFileKey(body.figmaUrl) : null;
    if (!fileKey) {
      return NextResponse.json(
        { error: "Could not read a Figma file key from that URL. Paste a figma.com/design/… or figma.com/file/… link." },
        { status: 400 },
      );
    }
    if (!body.figmaToken?.trim()) {
      return NextResponse.json(
        { error: "A Figma personal access token is required (Figma → Settings → Security → Personal access tokens)." },
        { status: 400 },
      );
    }

    const file = await fetchFigmaFile(fileKey, body.figmaToken.trim());
    const extract = extractFigmaFile(file);
    let fusion:
      | { enabled: true; model: string; renderedFrames: number; annotations: number }
      | { enabled: false; reason: string } = { enabled: false, reason: "Visual enrichment was not requested." };
    let markdownAppendix = [
      "## Figma provenance",
      `- File key: \`${fileKey}\``,
      `- File version: \`${(file as { version?: string }).version || "current"}\``,
      `- Structured nodes are authoritative; visual observations are descriptive.`,
      `- Annotations imported: ${extract.annotations.length}`,
      `- Saved measurements imported: ${extract.measurements.length}`,
      ...extract.measurements.slice(0, 50).map((m) =>
        `- Measurement \`${m.id}\`: \`${m.startNodeId}\` ${m.startSide} → \`${m.endNodeId}\` ${m.endSide}; ${m.offsetType.toLowerCase()} ${m.value}${m.text ? `; “${m.text.replace(/\n/g, " ") }”` : ""}`,
      ),
    ].join("\n");

    if (body.visualEnrichment !== false && isCaptureConfigured()) {
      try {
        const renders = await fetchFigmaFrameImages(fileKey, body.figmaToken.trim(), extract.frames);
        if (renders.length) {
          const visual = await extractFigmaVisualEnrichment({
            images: renders.map((r) => r.image),
            fileName: body.projectName?.trim() || file.name || "Figma File",
            fileKey,
            frameRefs: renders.map(({ nodeId, name }) => ({ nodeId, name })),
            annotations: extract.annotations,
            structuredSummary: `${Object.keys(extract.variables).length} exact tokens; ${extract.components.length} component sets; ${extract.stats.namedColorStyles} named color styles; ${extract.stats.textStyles} text styles; ${extract.measurements.length} saved measurements.`,
          });
          markdownAppendix += `\n\n${visual.markdown}\n\n<!-- blocksmith:figma-fusion model=${visual.model} -->`;
          fusion = { enabled: true, model: visual.model, renderedFrames: renders.length, annotations: extract.annotations.length };
        } else fusion = { enabled: false, reason: "No renderable top-level frames were found." };
      } catch (error) {
        fusion = { enabled: false, reason: error instanceof Error ? error.message : "Visual enrichment failed." };
      }
    } else if (!isCaptureConfigured()) {
      fusion = { enabled: false, reason: "NVIDIA_API_KEY is not configured; structured import completed." };
    }

    if (
      Object.keys(extract.variables).length === 0 &&
      extract.components.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "No tokens or components found in this file. It may be empty, or restricted from your token. Try a file with color styles or components.",
        },
        { status: 422 },
      );
    }

    const result = await handleImportFigmaVariables({
      variables: extract.variables,
      components: extract.components,
      fileKey,
      fileName: body.projectName?.trim() || file.name || "Figma File",
      markdownAppendix,
    });

    const { registerOwnedProject } = await import("@/lib/dashboard/ownership");
    await registerOwnedProject(result.fileName, result.docRef, "figma");

    return NextResponse.json({
      success: true,
      docRef: result.docRef,
      wikiUrl: result.wikiPath,
      summary: result.summary,
      figmaStats: extract.stats,
      fusion,
      measurements: extract.measurements.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Figma connect failed";
    console.error("[api/figma/connect]", err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
