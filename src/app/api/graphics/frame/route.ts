import { NextRequest, NextResponse } from "next/server";
import { loadDesignSystem, prepareDesignSystemDoc } from "@/lib/clients/registry";
import { resolveDocRef } from "@/lib/webmcp/registry";
import { requireDocumentAccess } from "@/lib/cloud/access";
import { graphicsKit } from "@/lib/graphics/kit";

export const dynamic = "force-dynamic";

/**
 * One graphics-kit snippet as a standalone document, for the wiki to embed.
 *
 * The wiki page ships a strict CSP — scripts need a nonce — and a `srcdoc`
 * iframe inherits it, so a snippet's inline script never ran there and the
 * canvas stayed blank. A document served from its own URL carries its own
 * policy. This one is as small as it can be: inline script and style only,
 * no network, no navigation, and embeddable from this origin alone. The
 * frame that loads it is also sandboxed to scripts, so it is an opaque origin
 * with nothing to reach.
 *
 * The body is the exact string the CodeBlock shows the reader.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const id = params.get("id") ?? "";
  const doc = resolveDocRef(params.get("doc") ?? undefined);

  // Same gate as the wiki page that embeds this: a private system's palette
  // is still that system's.
  const access = await requireDocumentAccess(request, doc, "read");
  if (!access.ok) return access.response;

  try {
    await prepareDesignSystemDoc(doc).catch(() => {});
    const system = loadDesignSystem(doc);
    const kit = graphicsKit(system);
    const snippet = kit.snippets.find((s) => s.id === id);
    if (!snippet) {
      return new NextResponse("Unknown snippet", { status: 404 });
    }
    // The orb is centred as an object; a canvas fills the frame edge to edge,
    // because that is how it will be used. Centring a canvas shrinks it to
    // its content width and shows the graphic at two-thirds of the frame.
    const layout =
      snippet.id === "svg-orb"
        ? "display:grid;place-items:center;min-height:100vh"
        : "display:block;height:100vh;overflow:hidden";
    const html =
      `<!doctype html><html><head><meta charset="utf-8">` +
      `<style>html,body{margin:0;background:${kit.palette.ground};${layout}}svg{max-width:100%;height:auto}canvas{width:100%!important;height:100vh!important;display:block}</style>` +
      `</head><body>${snippet.code}</body></html>`;
    return new NextResponse(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "content-security-policy":
          "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'self'",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not build the graphic.";
    return new NextResponse(message, { status: 500 });
  }
}
