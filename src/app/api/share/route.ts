import { NextResponse } from "next/server";
import { z } from "zod";
import { createShare, findShareByBlock, publicShareUrl } from "@/lib/public-share/store";
import { isShareBlockKind } from "@/lib/public-share/block-ids";
import { requireDocumentAccess } from "@/lib/cloud/access";

const bodySchema = z.object({
  docFileName: z.string().min(1),
  blockKind: z.string(),
  blockId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    if (!isShareBlockKind(parsed.data.blockKind)) {
      return NextResponse.json({ error: "Invalid blockKind" }, { status: 400 });
    }

    // Only someone with access to the document may publish a public share link
    // for one of its blocks — no minting strangers' design IP into the open.
    const access = await requireDocumentAccess(
      request,
      parsed.data.docFileName,
      "read",
    );
    if (!access.ok) return access.response;

    const record = await createShare({
      docFileName: parsed.data.docFileName,
      blockKind: parsed.data.blockKind,
      blockId: parsed.data.blockId,
    });

    const origin = request.headers.get("origin") ?? new URL(request.url).origin;
    return NextResponse.json({
      share: record,
      url: publicShareUrl(record.id, origin),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create share";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const docFileName = searchParams.get("doc");
  const blockKind = searchParams.get("blockKind");
  const blockId = searchParams.get("blockId");

  if (!docFileName || !blockKind || !blockId) {
    return NextResponse.json(
      { error: "doc, blockKind, and blockId are required" },
      { status: 400 },
    );
  }
  if (!isShareBlockKind(blockKind)) {
    return NextResponse.json({ error: "Invalid blockKind" }, { status: 400 });
  }

  const record = await findShareByBlock({
    docFileName,
    blockKind,
    blockId,
  });

  if (!record) {
    return NextResponse.json({ share: null }, { status: 200 });
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  return NextResponse.json({
    share: record,
    url: publicShareUrl(record.id, origin),
  });
}
