import { NextRequest, NextResponse } from "next/server";
import { loadDesignSystem, prepareDesignSystemDoc, clearDesignSystemCache } from "@/lib/clients/registry";
import { resolveDocRef } from "@/lib/webmcp/registry";
import { requireDocumentAccess } from "@/lib/cloud/access";
import { readUploadMarkdownContent, persistUploadMarkdown } from "@/lib/uploads/persist";
import { isUploadDocRef, uploadFileNameFromRef } from "@/lib/uploads/store";
import { addRationale, factsFromSystem, isRationaleEnabled, rationaleModel, rationaleModels } from "@/lib/ingest/rationale";
import { createNvidiaClient } from "@/ai-lab/shared/nvidia-profiles";

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
  let body: { doc?: unknown; timeoutMs?: unknown; listModels?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  // Which models this deployment's key can actually reach. Catalogues move,
  // and the only authority on what is available today is the endpoint.
  if (body.listModels === true) {
    const key = process.env.NVIDIA_API_KEY?.trim() || process.env.NVIDIA_API_KEY_FALLBACK?.trim();
    if (!key) return NextResponse.json({ error: "not configured" }, { status: 400 });
    try {
      const list = await createNvidiaClient(key).models.list();
      const ids = list.data.map((m) => m.id).filter((id) => /instruct|nemotron|gpt-oss|mistral|qwen|llama/i.test(id)).sort();
      return NextResponse.json({ chain: rationaleModels(), available: ids.slice(0, 80), total: list.data.length });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "list failed" }, { status: 500 });
    }
  }
  const doc = resolveDocRef(typeof body.doc === "string" ? body.doc : undefined);
  if (!isUploadDocRef(doc)) {
    return NextResponse.json({ error: "Only stored (upload:) documents can be rewritten." }, { status: 400 });
  }
  // A captured system is created anonymously by whoever captured it, and the
  // capture route runs this same pass on it with no check at all. Running it
  // again on such a document is no more privileged than that, so captures
  // pass; everything else still has to clear the document's own access rule,
  // which default-denies a private document to anyone it cannot place.
  const isCapture = /^upload:capture-/.test(doc);
  if (!isCapture) {
    const access = await requireDocumentAccess(request, doc, "read");
    if (!access.ok) return access.response;
  }
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
      raw: result.raw ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { applied: false, reason: err instanceof Error ? err.message : "failed", model: rationaleModel(), ms: Date.now() - started },
      { status: 500 },
    );
  }
}
