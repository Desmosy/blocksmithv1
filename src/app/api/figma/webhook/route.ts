import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { fetchFigmaFile, extractFigmaFile, fetchFigmaFrameImages } from "@/lib/figma/rest";
import { extractFigmaVisualEnrichment, isCaptureConfigured } from "@/lib/ingest/capture";
import { handleImportFigmaVariables } from "@/mcp/handlers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type FigmaWebhook = {
  event_type?: string;
  passcode?: string;
  file_key?: string;
  file_name?: string;
  version_id?: string;
  node_id?: string;
};

function validPasscode(actual: string | undefined): boolean {
  const expected = process.env.FIGMA_WEBHOOK_PASSCODE || "";
  if (!expected || !actual) return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Figma V2 webhook: re-import exact structure and optionally refresh visual semantics. */
export async function POST(request: Request) {
  const event = (await request.json().catch(() => ({}))) as FigmaWebhook;
  if (!validPasscode(event.passcode)) return NextResponse.json({ error: "Invalid webhook passcode" }, { status: 401 });
  if (event.event_type === "PING") return NextResponse.json({ ok: true, event: "PING" });
  if (!event.file_key) return NextResponse.json({ ok: true, ignored: "Event has no file key" });

  const token = process.env.FIGMA_ACCESS_TOKEN?.trim();
  if (!token) return NextResponse.json({ ok: true, queued: false, reason: "FIGMA_ACCESS_TOKEN is not configured" }, { status: 202 });

  const file = await fetchFigmaFile(event.file_key, token);
  const extract = extractFigmaFile(file);
  let appendix = `## Figma provenance\n- File key: \`${event.file_key}\`\n- Trigger: \`${event.event_type || "unknown"}\`\n- Version: \`${event.version_id || (file as { version?: string }).version || "current"}\`\n- Annotations imported: ${extract.annotations.length}\n- Saved measurements imported: ${extract.measurements.length}`;
  if (extract.measurements.length) appendix += `\n${extract.measurements.slice(0, 50).map((m) => `- Measurement \`${m.id}\`: \`${m.startNodeId}\` ${m.startSide} → \`${m.endNodeId}\` ${m.endSide}; ${m.offsetType.toLowerCase()} ${m.value}${m.text ? `; “${m.text.replace(/\n/g, " ")}”` : ""}`).join("\n")}`;
  let renderedFrames = 0;
  if (isCaptureConfigured()) {
    const renders = await fetchFigmaFrameImages(event.file_key, token, extract.frames);
    renderedFrames = renders.length;
    if (renders.length) {
      const visual = await extractFigmaVisualEnrichment({
        images: renders.map((r) => r.image),
        fileName: event.file_name || file.name || "Figma File",
        fileKey: event.file_key,
        frameRefs: renders.map(({ nodeId, name }) => ({ nodeId, name })),
        annotations: extract.annotations,
        structuredSummary: `${Object.keys(extract.variables).length} exact tokens; ${extract.components.length} component sets.`,
      });
      appendix += `\n\n${visual.markdown}\n\n<!-- blocksmith:figma-fusion model=${visual.model} -->`;
    }
  }
  const result = await handleImportFigmaVariables({
    variables: extract.variables,
    components: extract.components,
    fileKey: event.file_key,
    fileName: event.file_name || file.name,
    markdownAppendix: appendix,
  });
  return NextResponse.json({ ok: true, event: event.event_type, docRef: result.docRef, renderedFrames, annotations: extract.annotations.length, measurements: extract.measurements.length });
}
