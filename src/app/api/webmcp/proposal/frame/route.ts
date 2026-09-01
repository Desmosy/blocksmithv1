import { NextRequest, NextResponse } from "next/server";
import { loadDesignSystem, prepareDesignSystemDoc } from "@/lib/clients/registry";
import { resolveDocRef } from "@/lib/webmcp/registry";
import { readHandoff } from "@/lib/webmcp/handoff";
import { buildProposalDocument } from "@/lib/webmcp/render-proposal";

export const dynamic = "force-dynamic";

/**
 * The agent's proposal, on its own page.
 *
 * The Governance panel shows a proposal inline, which is right for a button or
 * a card — you glance at it beside the verdict. It is wrong for a landing page:
 * a full composition inside a review card reads as a thumbnail of itself, and
 * the thing an agent just built for you deserves to be looked at at the size it
 * was designed for.
 *
 * Same renderer as the inline preview, so this is the identical document at a
 * different size, and the same rule about scripts: a proposal is third-party
 * output, so the CSP here says `script-src 'none'`. Inline SVG and CSS render;
 * nothing executes.
 */
export async function GET(request: NextRequest) {
  const docParam = request.nextUrl.searchParams.get("doc") ?? undefined;
  const docRef = resolveDocRef(docParam);

  const proposal = await readHandoff<{ code: string; intent?: string }>(
    "proposal",
    docRef,
  );

  const html = await (async () => {
    if (!proposal?.code) {
      return `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;height:100%;display:grid;place-items:center;
  font:14px/1.5 ui-sans-serif,system-ui,sans-serif;color:#666;background:#fff}</style>
</head><body>Nothing proposed yet. Ask your agent to build something.</body></html>`;
    }
    try {
      await prepareDesignSystemDoc(docRef);
      const system = loadDesignSystem(docRef);
      return buildProposalDocument(proposal.code, system, { standalone: true });
    } catch {
      // The proposal is what the reader came for; render it unstyled rather
      // than showing an error because the system could not be loaded.
      return `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;padding:0}</style></head><body>${proposal.code}</body></html>`;
    }
  })();

  return new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy":
        "default-src 'none'; style-src 'unsafe-inline'; img-src data: https:; font-src data:; frame-ancestors 'self'",
      "x-frame-options": "SAMEORIGIN",
    },
  });
}
