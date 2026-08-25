import { NextRequest, NextResponse } from "next/server";
import { handleImportFigmaVariables } from "@/mcp/handlers";
import { registerOwnedProject } from "@/lib/dashboard/ownership";
import { getSupabaseUser } from "@/lib/auth/session";
import { saasStrictMode } from "@/lib/cloud/saas";
import type { FigmaVariableDefs } from "@/lib/figma/types";
import type { FigmaComponentInput } from "@/lib/figma/components";

export const dynamic = "force-dynamic";

/**
 * Figma-fit wedge: POST a Figma library (variables from get_variable_defs +
 * published components) → a governed design.md upload. Figma stays the design
 * source of truth; this seeds the IR so the wiki / tokens / Component Library
 * render the library.
 *
 * Body: { variables, components?, fileKey?, fileName?, projectName? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      variables?: FigmaVariableDefs;
      designContextCode?: string;
      components?: FigmaComponentInput;
      fileKey?: string;
      fileName?: string;
      projectName?: string;
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

    // Hosted mode: writing a doc requires sign-in (else it's orphaned).
    if (saasStrictMode() && !(await getSupabaseUser())) {
      return NextResponse.json(
        { error: "Sign in to import a design system." },
        { status: 401 },
      );
    }

    const result = await handleImportFigmaVariables({
      variables: body.variables,
      designContextCode: body.designContextCode,
      components: body.components,
      fileKey: body.fileKey,
      fileName: body.fileName,
      projectName: body.projectName,
    });
    await registerOwnedProject(result.fileName, result.docRef, "figma");

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "figma import failed";
    console.error("[api/figma/import]", err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
