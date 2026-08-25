import { NextRequest, NextResponse } from "next/server";
import { requireDocumentAccess } from "@/lib/cloud/access";
import { requireApiKey } from "@/lib/cloud/auth";
import {
  appendGovernanceEvent,
  listGovernanceEvents,
  updateGovernanceEventStatus,
} from "@/lib/cloud/governance-events";
import { checkGovernanceDiff } from "@/lib/governance/check-diff";
import type {
  GovernanceEventAction,
  GovernanceEventSource,
  GovernanceEventStatus,
  NewGovernanceEvent,
} from "@/lib/governance/types";
import { uploadFileNameFromRef, isUploadDocRef } from "@/lib/uploads/store";

export const dynamic = "force-dynamic";

/** POST — run governance check and optionally record an event (CLI / hooks / MCP). */
export async function POST(request: NextRequest) {
  const auth = await requireApiKey(request);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const docRef = String(body.docRef ?? body.doc ?? "").trim();
  const code = String(body.code ?? "").trim();
  if (!docRef || !code) {
    return NextResponse.json({ error: "docRef and code are required" }, { status: 400 });
  }

  if (!isUploadDocRef(docRef)) {
    return NextResponse.json(
      { error: "Governance check supports upload: scan docs only." },
      { status: 400 },
    );
  }

  const fileName = uploadFileNameFromRef(docRef);
  const access = await requireDocumentAccess(request, fileName, "write");
  if (!access.ok) return access.response;

  const result = checkGovernanceDiff({
    docRef,
    code,
    component: body.component ? String(body.component) : undefined,
    filePath: body.filePath ? String(body.filePath) : undefined,
  });

  const record = body.record === true;
  let event = null;
  if (record && result.findings.length > 0) {
    const overrideReason = body.overrideReason ? String(body.overrideReason) : undefined;
    const hasBlock = result.blockCount > 0;
    const defaultAction: GovernanceEventAction = overrideReason
      ? hasBlock
        ? "bypass"
        : "overridden"
      : "detected";
    const payload: NewGovernanceEvent = {
      docRef,
      componentId: result.component?.id,
      componentTitle: result.component?.title,
      author: String(body.author ?? "api-key"),
      source: (body.source as GovernanceEventSource) ?? "cli",
      action: (body.action as GovernanceEventAction) ?? defaultAction,
      findings: result.findings,
      commit: body.commit ? String(body.commit) : undefined,
      branch: body.branch ? String(body.branch) : undefined,
      overrideReason,
    };
    event = await appendGovernanceEvent(payload);
  }

  return NextResponse.json({ ...result, event });
}

/** GET — list governance events for a doc (API key). */
export async function GET(request: NextRequest) {
  const auth = await requireApiKey(request);
  if (!auth.ok) return auth.response;

  const docRef = request.nextUrl.searchParams.get("docRef")?.trim();
  if (!docRef) {
    return NextResponse.json({ error: "Missing docRef" }, { status: 400 });
  }

  if (!isUploadDocRef(docRef)) {
    return NextResponse.json({ error: "Invalid docRef" }, { status: 400 });
  }

  const fileName = uploadFileNameFromRef(docRef);
  const access = await requireDocumentAccess(request, fileName, "read");
  if (!access.ok) return access.response;

  const status = request.nextUrl.searchParams.get("status") as GovernanceEventStatus | null;
  const limit = Math.min(
    100,
    Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? 25) || 25),
  );

  const events = await listGovernanceEvents(docRef, {
    status: status ?? undefined,
    limit,
  });

  return NextResponse.json({ docRef, events });
}

/** PATCH — resolve or acknowledge a violation (session or API key). */
export async function PATCH(request: NextRequest) {
  const auth = await requireApiKey(request);
  if (!auth.ok) return auth.response;

  let body: { id?: string; status?: GovernanceEventStatus };
  try {
    body = (await request.json()) as { id?: string; status?: GovernanceEventStatus };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id || !body.status) {
    return NextResponse.json({ error: "id and status required" }, { status: 400 });
  }

  if (!["open", "acknowledged", "resolved"].includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    await updateGovernanceEventStatus(body.id, body.status);
    return NextResponse.json({ ok: true, id: body.id, status: body.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 404 });
  }
}
