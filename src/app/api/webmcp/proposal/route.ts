import { NextRequest, NextResponse } from "next/server";
import { resolveDocRef } from "@/lib/webmcp/registry";
import { clearHandoff, readHandoff, writeHandoff } from "@/lib/webmcp/handoff";

export const dynamic = "force-dynamic";

/**
 * The latest component an agent proposed, per design system.
 *
 * An agent and the human it is working with are often not in the same browser:
 * ChatGPT's browser runs on OpenAI's servers, so a proposal held in page memory
 * lands somewhere the human cannot see. Keeping the latest proposal here means
 * whoever has that design system open — on any machine — sees what was built.
 *
 * Held by the shared handoff store: memory for speed, object storage so the
 * write and the read may land on different instances — which they will, since
 * the agent and the human are in different browsers. A proposal is a moment in
 * a conversation, not a record, so it expires. One per design system: a second
 * proposal replaces the first rather than growing a queue nobody reads.
 */

type StoredProposal = {
  code: string;
  intent?: string;
  at: number;
};

const MAX_CODE_BYTES = 24_000;

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
    await clearHandoff("proposal", doc);
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

  await writeHandoff<StoredProposal>("proposal", doc, {
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
  const doc = resolveDocRef(
    request.nextUrl.searchParams.get("doc") ?? undefined,
  );
  const found = await readHandoff<StoredProposal>("proposal", doc);
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

  const doc = resolveDocRef(request.nextUrl.searchParams.get("doc") ?? undefined);
  const existed = await clearHandoff("proposal", doc);
  return NextResponse.json({ ok: true, cleared: existed ? 1 : 0, doc });
}
