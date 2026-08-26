import { NextRequest, NextResponse } from "next/server";
import { resolveDocRef } from "@/lib/webmcp/registry";

export const dynamic = "force-dynamic";

/**
 * The latest component an agent proposed, per design system.
 *
 * An agent and the human it is working with are often not in the same browser:
 * ChatGPT's browser runs on OpenAI's servers, so a proposal held in page memory
 * lands somewhere the human cannot see. Keeping the latest proposal here means
 * whoever has that design system open — on any machine — sees what was built.
 *
 * Deliberately in-memory and unpersisted. A proposal is a moment in a
 * conversation, not a record; it should not outlive the process or accumulate
 * on disk. One per design system, so a second proposal replaces the first
 * rather than growing a queue nobody reads.
 */

type StoredProposal = {
  code: string;
  intent?: string;
  at: number;
};

const MAX_CODE_BYTES = 24_000;
const MAX_DOCS = 20;
/** A proposal older than this is stale conversation, not current work. */
const TTL_MS = 30 * 60 * 1000;

const proposals = new Map<string, StoredProposal>();

function prune() {
  const cutoff = Date.now() - TTL_MS;
  for (const [doc, p] of proposals) {
    if (p.at < cutoff) proposals.delete(doc);
  }
  // Bound the map regardless, oldest first.
  if (proposals.size > MAX_DOCS) {
    const byAge = [...proposals.entries()].sort((a, b) => a[1].at - b[1].at);
    for (const [doc] of byAge.slice(0, proposals.size - MAX_DOCS)) {
      proposals.delete(doc);
    }
  }
}

export async function POST(request: NextRequest) {
  let body: { code?: unknown; intent?: unknown; doc?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const doc = resolveDocRef(
    typeof body.doc === "string" ? body.doc : undefined,
  );

  // Clearing is a legitimate write — the human dismissing what was proposed.
  if (body.code === null || body.code === "") {
    proposals.delete(doc);
    return NextResponse.json({ ok: true, cleared: true });
  }

  const code = typeof body.code === "string" ? body.code : "";
  if (!code.trim()) {
    return NextResponse.json({ error: "`code` is required." }, { status: 400 });
  }
  if (code.length > MAX_CODE_BYTES) {
    return NextResponse.json(
      { error: `Component is too large (max ${MAX_CODE_BYTES} characters).` },
      { status: 413 },
    );
  }

  prune();
  proposals.set(doc, {
    code,
    intent:
      typeof body.intent === "string" && body.intent.trim()
        ? body.intent.trim().slice(0, 160)
        : undefined,
    at: Date.now(),
  });

  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest) {
  prune();
  const doc = resolveDocRef(
    request.nextUrl.searchParams.get("doc") ?? undefined,
  );
  const found = proposals.get(doc) ?? null;
  return NextResponse.json(
    { proposal: found },
    { headers: { "cache-control": "no-store" } },
  );
}

/**
 * Clear staged proposals so a demo can be re-run from a known state.
 *
 * Development only. In production this 404s, because the deployed demo must not
 * carry an unauthenticated way to mutate state — /api/webmcp/invoke refuses
 * anything that is not read-only, and this route should not be the exception
 * that undoes that. Proposals there are per-process, one per system, and expire
 * after thirty minutes, so a redeploy or the next proposal is the reset.
 *
 * Used by `npm run demo:reset`.
 */
export async function DELETE(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  const docParam = request.nextUrl.searchParams.get("doc");
  if (docParam) {
    const doc = resolveDocRef(docParam);
    const existed = proposals.delete(doc);
    return NextResponse.json({ ok: true, cleared: existed ? 1 : 0, doc });
  }

  const cleared = proposals.size;
  proposals.clear();
  return NextResponse.json({ ok: true, cleared });
}
