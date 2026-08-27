import { NextRequest, NextResponse } from "next/server";
import { loadDesignSystem, prepareDesignSystemDoc, clearDesignSystemCache } from "@/lib/clients/registry";
import { resolveDocRef } from "@/lib/webmcp/registry";
import { requireDocumentAccess } from "@/lib/cloud/access";
import { readUploadMarkdownContent, persistUploadMarkdown } from "@/lib/uploads/persist";
import { isUploadDocRef, uploadFileNameFromRef } from "@/lib/uploads/store";
import { addRationale, factsFromSystem, isRationaleEnabled, rationaleModel } from "@/lib/ingest/rationale";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Add a model's judgement to a stored design system, now, and say what
 * happened.
 *
 * The capture route runs this pass after its response; when that does not
 * land there is nothing to read on the deployment but the absence. This is
 * the same pass on demand, answering with the outcome — applied, or the
 * reason it was not — so the model, the key and the timeout can be checked
 * from outside. It is also the manual action: a system captured before a
 * key was set, or one that was never captured, gets its prose here.
 */
export async function POST(request: NextRequest) {
  let body: { doc?: unknown; timeoutMs?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const doc = resolveDocRef(typeof body.doc === "string" ? body.doc : undefined);
  if (!isUploadDocRef(doc)) {
    return NextResponse.json({ error: "Only stored (upload:) documents can be rewritten." }, { status: 400 });
  }
  const access = await requireDocumentAccess(request, doc, "write");
  if (!access.ok) return access.response;
  if (!isRationaleEnabled()) {
    return NextResponse.json({ applied: false, reason: "not configured", model: null });
  }

  const started = Date.now();
  try {
    await prepareDesignSystemDoc(doc);
    const system = loadDesignSystem(doc);
    const markdown = await readUploadMarkdownContent(uploadFileNameFromRef(doc));
    const timeoutMs = typeof body.timeoutMs === "number" ? Math.min(45_000, body.timeoutMs) : 25_000;
    const result = await addRationale(markdown, factsFromSystem(system), undefined, { timeoutMs });
    if (result.applied) {
      await persistUploadMarkdown(uploadFileNameFromRef(doc), result.markdown);
      clearDesignSystemCache();
    }
    return NextResponse.json({
      applied: result.applied,
      reason: result.reason ?? null,
      model: result.model ?? rationaleModel(),
      ms: Date.now() - started,
    });
  } catch (err) {
    return NextResponse.json(
      { applied: false, reason: err instanceof Error ? err.message : "failed", model: rationaleModel(), ms: Date.now() - started },
      { status: 500 },
    );
  }
}
