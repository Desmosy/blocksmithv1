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
 *
 * The route also serves the proposal's *history* (`?v=N` — 0 is current) and
 * two export forms: `&raw=1` is the code as text for pasting into an editor,
 * `&download=1` is the full standalone document as a file. Work an agent put
 * in front of a human is only useful if the human can take it away.
 */

const MOTION_CDNS = "https://cdn.jsdelivr.net https://unpkg.com https://esm.sh";

type StoredProposal = {
  code: string;
  intent?: string;
  at: number;
  history?: { code: string; intent?: string; at: number }[];
};

/** `srcdoc` carries a full document inside an attribute. */
function forAttribute(html: string): string {
  return html.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** Agent-authored text placed into our own markup. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell(inner: string, toolbar = ""): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Proposed by your agent</title>
<style>html,body{margin:0;height:100%;background:#fff;display:flex;flex-direction:column}
iframe{border:0;display:block;width:100%;flex:1}
.bar{display:flex;gap:12px;align-items:center;padding:8px 14px;border-bottom:1px solid #ebebeb;
font:12px/1.4 ui-sans-serif,system-ui,sans-serif;color:#666;flex-wrap:wrap}
.bar a{color:#171717;text-decoration:none;padding:2px 8px;border-radius:4px}
.bar a:hover{background:#f2f2f2}
.bar a.on{background:#171717;color:#fff}
.bar .spacer{flex:1}</style>
</head><body>${toolbar}${inner}</body></html>`;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const docParam = params.get("doc") ?? undefined;
  const docRef = resolveDocRef(docParam);

  const stored = await readHandoff<StoredProposal>("proposal", docRef);

  const versions = stored?.code
    ? [
        { code: stored.code, intent: stored.intent, at: stored.at },
        ...(stored.history ?? []),
      ]
    : [];
  const v = Math.min(Math.max(Number(params.get("v")) || 0, 0), Math.max(versions.length - 1, 0));
  const proposal = versions[v];

  if (!proposal?.code) {
    return new NextResponse(
      shell(
        `<div style="height:100%;display:grid;place-items:center;
        font:14px/1.5 ui-sans-serif,system-ui,sans-serif;color:#666">
        Nothing proposed yet. Ask your agent to build something.</div>`,
      ),
      { status: 200, headers: baseHeaders() },
    );
  }

  // The code alone, for pasting into an editor.
  if (params.get("raw")) {
    return new NextResponse(proposal.code, {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  }

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

  // The full document as a file — what "bring it into my IDE" actually needs.
  if (params.get("download")) {
    const stamp = new Date(proposal.at).toISOString().slice(0, 16).replace(/[:T]/g, "-");
    return new NextResponse(inner, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-disposition": `attachment; filename="proposal-${stamp}.html"`,
        "cache-control": "no-store",
      },
    });
  }

  const link = (extra: string) => {
    const q = new URLSearchParams();
    if (docParam) q.set("doc", docParam);
    return `?${q.toString()}${extra}`;
  };
  const versionLinks = versions
    .map((entry, i) => {
      const label = i === 0 ? "latest" : `v${versions.length - i}`;
      const title = escapeHtml(entry.intent ?? new Date(entry.at).toLocaleString());
      return `<a href="${link(`&v=${i}`)}" title="${title}" class="${i === v ? "on" : ""}">${label}</a>`;
    })
    .join("");
  const toolbar =
    `<div class="bar"><span>${escapeHtml(proposal.intent ?? "Proposal")}</span>` +
    `<span class="spacer"></span>${versionLinks}` +
    `<a href="${link(`&v=${v}&raw=1`)}" target="_blank">View code</a>` +
    `<a href="${link(`&v=${v}&download=1`)}">Download HTML</a></div>`;

  const body = shell(
    `<iframe sandbox="allow-scripts allow-popups allow-forms"` +
      ` referrerpolicy="no-referrer" srcdoc="${forAttribute(inner)}"></iframe>`,
    toolbar,
  );

  return new NextResponse(body, { status: 200, headers: baseHeaders() });
}

function baseHeaders(): Record<string, string> {
  return {
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
  };
}
