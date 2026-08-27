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
 * The whole request has to answer inside the platform's limit, in JSON.
 *
 * A capture that ran past sixty seconds on Vercel was answered by the
 * platform with a plain-text error page, and the client — expecting JSON —
 * failed on "Unexpected token 'A'". The budget below is shared out: the
 * browser render gets most of it and degrades to fit, the model pass gets
 * what is left and is skipped when that is too little, and a final race
 * turns anything still running into a JSON 504 with a message a person can
 * act on.
 */
const TOTAL_BUDGET_MS = Number(process.env.BLOCKSMITH_CAPTURE_BUDGET_MS ?? 52_000);
const RENDER_SHARE = 0.65;

function timeoutJson(ms: number, progress: Record<string, number>): Promise<NextResponse> {
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve(
          NextResponse.json(
            {
              error:
                "That page took longer to read than this deployment allows. Try a lighter page on the same site, " +
                "or run it again — a second attempt is usually faster.",
              // Which phases finished, and when. The last one listed is
              // where the time went.
              progress,
            },
            { status: 504 },
          ),
        ),
      ms,
    ),
  );
}

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
  const progress: Record<string, number> = {};
  return Promise.race([capture(request, progress), timeoutJson(TOTAL_BUDGET_MS, progress)]);
}

async function capture(request: NextRequest, progress: Record<string, number>): Promise<NextResponse> {
  const started = Date.now();
  const left = () => TOTAL_BUDGET_MS - (Date.now() - started);
  const onPhase = (phase: string) => { progress[phase] = Date.now() - started; };
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
    const found = await extractSiteDesign(url, { renderBudgetMs: Math.floor(TOTAL_BUDGET_MS * RENDER_SHARE), onPhase });
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
    const tR = Date.now();
    const rationale = await addRationale(measured, facts, undefined, { timeoutMs: left() - 4_000 });
    const rationaleMs = Date.now() - tR;
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
      /** Phase timings in ms — the answer to "why was that slow". */
      timings: { ...(found.timings ?? {}), rationale: rationaleMs, total: Date.now() - started, rationaleSkipped: rationale.reason ?? null, progress },
    });
  } catch (err) {
    if (err instanceof CaptureError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    const message = err instanceof Error ? err.message : "Could not read that site.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
