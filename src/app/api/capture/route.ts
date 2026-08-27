import { NextRequest, NextResponse } from "next/server";
import { extractSiteDesign, CaptureError } from "@/lib/ingest/extract-site";
import { synthesizeDesignSystem } from "@/lib/ingest/synthesize-system";
import { saveMarkdownUpload } from "@/lib/uploads/store";
import { prepareDesignSystemDoc } from "@/lib/clients/registry";
import { addRationale } from "@/lib/ingest/rationale";

export const dynamic = "force-dynamic";
/** Rendering a page through a remote browser can exceed the default budget. */
export const maxDuration = 60;

/**
 * Capture a public site's design system, for a person rather than an agent.
 *
 * `capture_site_design` did this already, but only over the WebMCP tool
 * surface, and it answers in prose because that is what an agent reads. There
 * was no way for someone who had just opened the dashboard to do the thing the
 * product is named for — the empty state offered Figma, a repo scan and a file
 * upload, all of which need something you may not have yet.
 *
 * Same engine; this one answers in JSON so the UI can navigate to the result.
 */
export async function POST(request: NextRequest) {
  let body: { url?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const raw = typeof body.url === "string" ? body.url.trim() : "";
  if (!raw) {
    return NextResponse.json({ error: "Enter the address of a site to read." }, { status: 400 });
  }

  // People type "linear.app", not "https://linear.app" — and the prompt bar
  // invites exactly that. Assume https rather than rejecting a bare host.
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const found = await extractSiteDesign(url);
    if (!found.colors.length) {
      return NextResponse.json(
        {
          error:
            `Read ${found.url}, but found no colours stated in its CSS. The page may ` +
            `render everything from images or a framework this cannot see. Try another page on the same site.`,
        },
        { status: 422 },
      );
    }

    const { markdown: measured, title, facts } = synthesizeDesignSystem(found);
    // Judgement on top of measurement, when a model is configured. Never
    // blocks a capture: a timeout or a bad answer leaves the measured
    // document exactly as it was.
    const rationale = await addRationale(measured, facts);
    const saved = await saveMarkdownUpload(rationale.markdown, `capture-${title}`);
    await prepareDesignSystemDoc(saved.docRef);

    return NextResponse.json({
      title,
      docRef: saved.docRef,
      wikiPath: `/wiki?doc=${encodeURIComponent(saved.docRef)}`,
      source: found.url,
      counts: {
        colors: found.colors.length,
        typefaces: found.fonts?.length ?? 0,
        components: found.components?.length ?? 0,
      },
      /** Whether a browser rendered the page, or it was read from CSS alone. */
      readFrom: found.readFrom ?? "css",
      /** Whether a model added rationale, and which one. */
      rationale: rationale.applied ? rationale.model : null,
    });
  } catch (err) {
    if (err instanceof CaptureError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    const message = err instanceof Error ? err.message : "Could not read that site.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
