import { NextRequest, NextResponse } from "next/server";
import { handleFigmaTokenDrift } from "@/mcp/handlers";
import { requireDocumentAccess } from "@/lib/cloud/access";
import { isUploadDocRef, uploadFileNameFromRef } from "@/lib/uploads/store";
import type { FigmaVariableDefs } from "@/lib/figma/types";
import type { FigmaComponentInput } from "@/lib/figma/components";

export const dynamic = "force-dynamic";

/**
 * Reconcile a Figma library against a code scan doc — "Figma says X, code says Y".
 * When `components` is passed, also drifts the component library at the
 * variant/prop level.
 *
 * Body: { variables, components?, doc?, fileKey? }  (doc must be a workspace-scan upload)
 * Returns the structured drift report(s) plus a rendered markdown table.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      variables?: FigmaVariableDefs;
      designContextCode?: string;
      components?: FigmaComponentInput;
      doc?: string;
      fileKey?: string;
    };

    const hasVariables =
      body.variables && typeof body.variables === "object";
    if (!hasVariables && !body.designContextCode) {
      return NextResponse.json(
        {
          error:
            "Provide `variables` (get_variable_defs) or `designContextCode` (get_design_context) — at least one is required.",
        },
        { status: 400 },
      );
    }

    // Drift reads the code-scan doc's tokens — gate it like any doc read.
    if (body.doc && isUploadDocRef(body.doc)) {
      const access = await requireDocumentAccess(
        request,
        uploadFileNameFromRef(body.doc),
        "read",
      );
      if (!access.ok) return access.response;
    }

    const result = await handleFigmaTokenDrift({
      variables: body.variables,
      designContextCode: body.designContextCode,
      components: body.components,
      doc: body.doc,
      fileKey: body.fileKey,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error, docRef: result.docRef }, { status: 400 });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "figma drift failed";
    console.error("[api/figma/drift]", err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
