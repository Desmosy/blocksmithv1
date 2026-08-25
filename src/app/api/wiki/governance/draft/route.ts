import { NextRequest, NextResponse } from "next/server";
import {
  draftComponentGovernance,
  governanceCopilotEnabled,
} from "@/ai-lab/10-governance-copilot/draft";
import { requireDocumentAccess } from "@/lib/cloud/access";
import { saasStrictMode } from "@/lib/cloud/saas";
import { isUploadDocRef, uploadFileNameFromRef } from "@/lib/uploads/store";

export async function POST(request: NextRequest) {
  try {
    if (!governanceCopilotEnabled()) {
      return NextResponse.json(
        {
          error:
            "Governance copilot requires NVIDIA_API_KEY in .env.local (see src/ai-lab/README.md).",
        },
        { status: 503 },
      );
    }

    const body = await request.json();
    const { docRef } = body as { docRef?: string };
    if (docRef && isUploadDocRef(docRef)) {
      const access = await requireDocumentAccess(
        request,
        uploadFileNameFromRef(docRef),
      );
      if (!access.ok) return access.response;
    } else if (saasStrictMode()) {
      return NextResponse.json(
        { error: "docRef (upload:…) is required for governance drafts" },
        { status: 400 },
      );
    }

    const {
      componentTitle,
      componentId,
      currentRole = "",
      currentDescription = "",
      prompt,
      scanContext,
    } = body as {
      componentTitle?: string;
      componentId?: string;
      currentRole?: string;
      currentDescription?: string;
      prompt?: string;
      scanContext?: {
        sourceFile: string;
        exports: string[];
        cssVarsUsed: string[];
        colorsUsed: string[];
      };
    };

    if (!componentTitle?.trim() || !componentId?.trim()) {
      return NextResponse.json(
        { error: "componentTitle and componentId are required" },
        { status: 400 },
      );
    }

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const draft = await draftComponentGovernance({
      componentTitle: componentTitle.trim(),
      componentId: componentId.trim(),
      currentRole: String(currentRole),
      currentDescription: String(currentDescription),
      userPrompt: prompt.trim(),
      scanContext:
        scanContext?.sourceFile
          ? {
              sourceFile: String(scanContext.sourceFile),
              exports: Array.isArray(scanContext.exports)
                ? scanContext.exports.map(String)
                : [],
              cssVarsUsed: Array.isArray(scanContext.cssVarsUsed)
                ? scanContext.cssVarsUsed.map(String)
                : [],
              colorsUsed: Array.isArray(scanContext.colorsUsed)
                ? scanContext.colorsUsed.map(String)
                : [],
            }
          : undefined,
    });

    return NextResponse.json({ ok: true, draft });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Draft failed";
    console.error("[api/wiki/governance/draft]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
