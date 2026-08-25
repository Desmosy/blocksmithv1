import { NextRequest, NextResponse } from "next/server";
import { requireDocumentAccess } from "@/lib/cloud/access";
import {
  listGovernanceEvents,
  updateGovernanceEventStatus,
} from "@/lib/cloud/governance-events";
import { isUploadDocRef, uploadFileNameFromRef } from "@/lib/uploads/store";

export const dynamic = "force-dynamic";

/** Wiki UI — list governance violations for a doc (session auth). */
export async function GET(request: NextRequest) {
  const docParam = request.nextUrl.searchParams.get("doc")?.trim();
  if (!docParam || !isUploadDocRef(docParam)) {
    return NextResponse.json({ error: "Missing or invalid upload doc ref" }, { status: 400 });
  }

  const fileName = uploadFileNameFromRef(docParam);
  const access = await requireDocumentAccess(request, fileName, "read");
  if (!access.ok) return access.response;

  const status = request.nextUrl.searchParams.get("status") as
    | "open"
    | "acknowledged"
    | "resolved"
    | null;
  const limit = Math.min(
    50,
    Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? 30) || 30),
  );

  const events = await listGovernanceEvents(docParam, {
    status: status ?? undefined,
    limit,
  });

  const openEvents = await listGovernanceEvents(docParam, {
    status: "open",
    limit: 100,
  });

  return NextResponse.json({
    docRef: docParam,
    events,
    openCount: openEvents.length,
  });
}

/** Wiki UI — mark violation resolved (session auth). */
export async function PATCH(request: NextRequest) {
  const docParam = request.nextUrl.searchParams.get("doc")?.trim();
  if (!docParam || !isUploadDocRef(docParam)) {
    return NextResponse.json({ error: "Missing or invalid upload doc ref" }, { status: 400 });
  }

  const fileName = uploadFileNameFromRef(docParam);
  const access = await requireDocumentAccess(request, fileName, "write");
  if (!access.ok) return access.response;

  let body: { id?: string; status?: "open" | "acknowledged" | "resolved" };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id || !body.status) {
    return NextResponse.json({ error: "id and status required" }, { status: 400 });
  }

  try {
    await updateGovernanceEventStatus(body.id, body.status);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 404 });
  }
}
