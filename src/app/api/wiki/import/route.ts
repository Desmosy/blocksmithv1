import { NextResponse } from "next/server";
import {
  clearDesignSystemCache,
  loadDesignSystem,
  prepareDesignSystemDoc,
} from "@/lib/clients/registry";
import {
  isApolloStructuredMarkdown,
  isComprehensiveWikiMarkdown,
} from "@/lib/parser/generic";
import { getSupabaseUser } from "@/lib/auth/session";
import {
  listDocumentsForOrg,
  registerDocument,
} from "@/lib/cloud/documents";
import { ensureDefaultOrg } from "@/lib/cloud/orgs";
import { saasDbEnabled, saasStrictMode } from "@/lib/cloud/saas";
import { saveMarkdownUpload, listUploads } from "@/lib/uploads/store";
import { wikiUrlForDoc } from "@/lib/uploads/doc-ref";

export async function GET() {
  const user = await getSupabaseUser();

  // Signed in: only ever return the caller's own org uploads.
  if (user) {
    const org = await ensureDefaultOrg(user.userId, user.login);
    const orgDocs = await listDocumentsForOrg(org.id);
    const orgFileNames = new Set(orgDocs.map((d) => d.fileName));
    const uploads = (await listUploads()).filter((u) =>
      orgFileNames.has(u.fileName),
    );
    return NextResponse.json({ uploads });
  }

  // Anonymous + strict: never leak cross-tenant upload metadata.
  if (saasStrictMode()) {
    return NextResponse.json(
      { error: "Sign in to view your uploads." },
      { status: 401 },
    );
  }

  // Anonymous but auth is configured: show nothing rather than every tenant's
  // files. Only a pure local dev box with no Supabase gets the open listing.
  if (saasDbEnabled()) {
    return NextResponse.json({ uploads: [] });
  }
  return NextResponse.json({ uploads: await listUploads() });
}

export async function POST(request: Request) {
  try {
    const user = await getSupabaseUser();
    if (saasStrictMode() && !user) {
      return NextResponse.json(
        { error: "Sign in with GitHub to upload design documents." },
        { status: 401 },
      );
    }

    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Missing file" }, { status: 400 });
      }
      if (!file.name.toLowerCase().endsWith(".md")) {
        return NextResponse.json({ error: "Only .md files are supported" }, { status: 400 });
      }
      const markdown = await file.text();
      const saved = await saveMarkdownUpload(markdown, file.name);
      if (user) {
        const org = await ensureDefaultOrg(user.userId, user.login);
        await registerDocument({
          fileName: saved.fileName,
          docRef: saved.docRef,
          ownerUserId: user.userId,
          orgId: org.id,
          scanMode: "import",
        });
      }
      clearDesignSystemCache();
      const origin = request.headers.get("origin") ?? new URL(request.url).origin;
      return NextResponse.json(
        await buildImportResponse(saved, markdown, origin),
      );
    }

    const body = await request.json();
    const markdown = typeof body.markdown === "string" ? body.markdown : "";
    const fileName =
      typeof body.fileName === "string" ? body.fileName : undefined;

    if (!markdown.trim()) {
      return NextResponse.json({ error: "Markdown is empty" }, { status: 400 });
    }

    const saved = await saveMarkdownUpload(markdown, fileName);
    if (user) {
      const org = await ensureDefaultOrg(user.userId, user.login);
      await registerDocument({
        fileName: saved.fileName,
        docRef: saved.docRef,
        ownerUserId: user.userId,
        orgId: org.id,
        scanMode: "import",
      });
    }
    clearDesignSystemCache();
    const origin = request.headers.get("origin") ?? new URL(request.url).origin;

    return NextResponse.json(
      await buildImportResponse(saved, markdown, origin),
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function detectParserHint(md: string): "apollo" | "generic" {
  if (isComprehensiveWikiMarkdown(md)) return "generic";
  return isApolloStructuredMarkdown(md) ? "apollo" : "generic";
}

async function buildImportResponse(
  saved: Awaited<ReturnType<typeof saveMarkdownUpload>>,
  markdown: string,
  origin: string,
) {
  await prepareDesignSystemDoc(saved.docRef);
  const system = loadDesignSystem(saved.docRef);
  const parser =
    system.mode === "apollo" ? "apollo" : detectParserHint(markdown);
  return {
    ...saved,
    wikiUrl: `${origin.replace(/\/$/, "")}${wikiUrlForDoc(saved.docRef)}`,
    parser,
    systemName: system.name,
    stats: {
      colors: system.colors.length,
      typography: system.typography.length,
      components: system.components.length,
      surfaces: system.surfaces.length,
    },
  };
}
