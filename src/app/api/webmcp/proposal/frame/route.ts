import { NextRequest, NextResponse } from "next/server";
import { loadDesignSystem, prepareDesignSystemDoc } from "@/lib/clients/registry";
import { resolveDocRef } from "@/lib/webmcp/registry";
import { readHandoff } from "@/lib/webmcp/handoff";
import { buildProposalDocument } from "@/lib/webmcp/render-proposal";

export const dynamic = "force-dynamic";

/**
 * The agent's proposal, on its own page, and actually running.
 *
 * The inline preview on the Governance page renders without scripts, and that
 * stays true — it sits inside our own page, beside a verdict, and executing
 * third-party output there would put model-written JavaScript on our origin
 * next to the reader's session.
 *
 * But a page whose motion never plays is not the page the agent built. Asking
 * for a landing page and being shown a still frame of it is how you conclude
 * the tool produces lifeless work, when in fact the tool refused to run it.
 *
 * So the full-page view — an explicit click, opened in its own tab — executes,
 * inside a sandbox with `allow-scripts` and deliberately **without**
 * `allow-same-origin`. That combination puts the content in an opaque origin:
 * scripts run, and they cannot read this origin's cookies, storage or DOM.
 * A `srcdoc` frame inherits the embedding document's policy, so the CSP below
 * is what governs it — inline script for the agent's own code, and the three
 * CDNs a motion library is actually fetched from.
 */

const MOTION_CDNS = "https://cdn.jsdelivr.net https://unpkg.com https://esm.sh";

/** `srcdoc` carries a full document inside an attribute. */
function forAttribute(html: string): string {
  return html.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function shell(inner: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Proposed by your agent</title>
<style>html,body{margin:0;height:100%;background:#fff}
iframe{border:0;display:block;width:100%;height:100%}</style>
</head><body>${inner}</body></html>`;
}

export async function GET(request: NextRequest) {
  const docParam = request.nextUrl.searchParams.get("doc") ?? undefined;
  const docRef = resolveDocRef(docParam);

  const proposal = await readHandoff<{ code: string; intent?: string }>(
    "proposal",
    docRef,
  );

  let body: string;
  if (!proposal?.code) {
    body = shell(
      `<div style="height:100%;display:grid;place-items:center;
        font:14px/1.5 ui-sans-serif,system-ui,sans-serif;color:#666">
        Nothing proposed yet. Ask your agent to build something.</div>`,
    );
  } else {
    let inner: string;
    try {
      await prepareDesignSystemDoc(docRef);
      const system = loadDesignSystem(docRef);
      inner = buildProposalDocument(proposal.code, system, { standalone: true });
    } catch {
      // The proposal is what the reader came for; render it unstyled rather
      // than replacing it with an error because the system would not load.
      inner = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;padding:0}</style></head><body>${proposal.code}</body></html>`;
    }
    body = shell(
      `<iframe sandbox="allow-scripts allow-popups allow-forms"` +
        ` referrerpolicy="no-referrer" srcdoc="${forAttribute(inner)}"></iframe>`,
    );
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": [
        "default-src 'none'",
        `script-src 'unsafe-inline' 'unsafe-eval' ${MOTION_CDNS}`,
        "style-src 'unsafe-inline' https://fonts.googleapis.com",
        "img-src data: blob: https:",
        "font-src data: https://fonts.gstatic.com https://cdn.jsdelivr.net",
        `connect-src ${MOTION_CDNS}`,
        "frame-src 'self' data:",
        "frame-ancestors 'self'",
      ].join("; "),
      "x-frame-options": "SAMEORIGIN",
    },
  });
}
