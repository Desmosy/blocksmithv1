import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseUser } from "@/lib/auth/session";
import {
  getDocument,
  setDocumentPublished,
} from "@/lib/cloud/documents";
import { getMemberRole, listOrgsForUser } from "@/lib/cloud/orgs";
import { roleAtLeast } from "@/lib/cloud/rbac";
import { isUploadDocRef, uploadFileNameFromRef } from "@/lib/uploads/store";

/** Map an incoming doc ref (`upload:foo.md` or a bare scan name) to the
 * registry file-name key. */
function fileNameFromDoc(doc: string): string {
  return isUploadDocRef(doc) ? uploadFileNameFromRef(doc) : doc;
}

async function siteUrlFor(
  origin: string,
  orgId: string | undefined,
  userId: string,
): Promise<string | null> {
  if (!orgId) return null;
  const orgs = await listOrgsForUser(userId);
  const org = orgs.find((o) => o.id === orgId);
  return org ? `${origin}/sites/${org.slug}` : null;
}

export async function GET(request: NextRequest) {
  const doc = request.nextUrl.searchParams.get("doc");
  if (!doc) {
    return NextResponse.json({ error: "doc is required" }, { status: 400 });
  }
  const user = await getSupabaseUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const record = await getDocument(fileNameFromDoc(doc));
  if (!record) {
    return NextResponse.json({ published: false, canPublish: false });
  }
  const role = await getMemberRole(record.orgId ?? "", user.userId);
  const canPublish = !!role && roleAtLeast(role, "admin");
  const origin = request.nextUrl.origin;
  return NextResponse.json({
    published: !!record.published,
    canPublish,
    siteUrl: canPublish || record.published
      ? await siteUrlFor(origin, record.orgId, user.userId)
      : null,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const doc = typeof body.doc === "string" ? body.doc : "";
    const published = body.published === true;
    if (!doc) {
      return NextResponse.json({ error: "doc is required" }, { status: 400 });
    }

    const user = await getSupabaseUser();
    if (!user) {
      return NextResponse.json(
        { error: "Sign in to publish." },
        { status: 401 },
      );
    }

    const fileName = fileNameFromDoc(doc);
    const record = await getDocument(fileName);
    if (!record) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Publishing org IP to the open web is an admin/owner action.
    const role = await getMemberRole(record.orgId ?? "", user.userId);
    if (!role || !roleAtLeast(role, "admin")) {
      return NextResponse.json(
        { error: "Only org owners and admins can publish a wiki." },
        { status: 403 },
      );
    }

    const updated = await setDocumentPublished(fileName, published);
    const origin = request.nextUrl.origin;
    return NextResponse.json({
      published: !!updated.published,
      siteUrl: await siteUrlFor(origin, updated.orgId, user.userId),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Publish failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
