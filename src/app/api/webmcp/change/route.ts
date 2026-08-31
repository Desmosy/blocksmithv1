import { NextRequest, NextResponse } from "next/server";
import { resolveDocRef } from "@/lib/webmcp/registry";
import { clearHandoff, readHandoff, writeHandoff } from "@/lib/webmcp/handoff";

export const dynamic = "force-dynamic";

/**
 * Changes an agent has proposed to a design system, awaiting a human.
 *
 * This is the seam that makes an agent useful in the wiki without making it
 * dangerous. It drafts the tedious part — a token with a sensible role, a rule
 * written in the system's voice, a deprecation with its replacement — and
 * parks it here. Nothing reaches the design system from this route.
 *
 * Approval goes through `/api/wiki/finalize`, called by the browser with the
 * human's own session. So the agent cannot write, cannot promote, and cannot
 * bypass the access check that already guards every edit. The worst a bad
 * proposal can do is waste someone's time reading it.
 *
 * Held by the same handoff store the component proposals use, so a change
 * staged by an agent in one browser reaches the human in another — and
 * survives the instance the agent happened to write to. A proposal is a moment
 * in a conversation, not a record, so it expires.
 */

export type ProposedChange = {
  id: string;
  /** A block id `modifyMarkdownBlock` understands, e.g. `token:color:accent`. */
  blockId: string;
  /** The shape that block's editor expects. */
  updatedData: unknown;
  /** One line on what this does, shown to the human. */
  summary: string;
  /** Why the agent thinks it is right. */
  rationale?: string;
  /** True when this adds a block rather than changing an existing one. */
  create?: boolean;
  at: number;
};

const MAX_PER_DOC = 8;
const MAX_SUMMARY = 200;
const MAX_RATIONALE = 600;

/** Block kinds the design-system editor can actually apply. */
const EDITABLE = [
  "agent-guide",
  "guidelines",
  "page:introduction",
  "section:",
  "token:color:",
  "token:spacing:",
  "token:typography:",
  "component:",
];

function isEditable(blockId: string): boolean {
  return EDITABLE.some((prefix) =>
    prefix.endsWith(":") ? blockId.startsWith(prefix) : blockId === prefix,
  );
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const doc = resolveDocRef(typeof body.doc === "string" ? body.doc : undefined);

  // Discarding is the human rejecting a proposal.
  if (body.discard) {
    const id = String(body.discard);
    const list = ((await readHandoff<ProposedChange[]>("change", doc)) ?? []).filter(
      (c) => c.id !== id,
    );
    if (list.length) writeHandoff("change", doc, list);
    else clearHandoff("change", doc);
    return NextResponse.json({ ok: true, discarded: id });
  }

  const blockId = typeof body.blockId === "string" ? body.blockId.trim() : "";
  const summary = typeof body.summary === "string" ? body.summary.trim() : "";

  if (!blockId || !isEditable(blockId)) {
    return NextResponse.json(
      {
        error:
          `"${blockId}" is not an editable part of a design system. ` +
          `Use one of: ${EDITABLE.join(", ")}`,
      },
      { status: 400 },
    );
  }
  if (!summary) {
    return NextResponse.json(
      { error: "`summary` is required — a human has to read this." },
      { status: 400 },
    );
  }
  if (body.updatedData === undefined || body.updatedData === null) {
    return NextResponse.json({ error: "`updatedData` is required." }, { status: 400 });
  }

  const change: ProposedChange = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    blockId,
    updatedData: body.updatedData,
    summary: summary.slice(0, MAX_SUMMARY),
    rationale:
      typeof body.rationale === "string" && body.rationale.trim()
        ? body.rationale.trim().slice(0, MAX_RATIONALE)
        : undefined,
    create: body.create === true,
    at: Date.now(),
  };

  const list = [
    ...((await readHandoff<ProposedChange[]>("change", doc)) ?? []),
    change,
  ].slice(-MAX_PER_DOC);
  writeHandoff("change", doc, list);

  return NextResponse.json({ ok: true, id: change.id, pending: list.length });
}

export async function GET(request: NextRequest) {
  const doc = resolveDocRef(request.nextUrl.searchParams.get("doc") ?? undefined);
  return NextResponse.json(
    { changes: (await readHandoff<ProposedChange[]>("change", doc)) ?? [] },
    { headers: { "cache-control": "no-store" } },
  );
}
