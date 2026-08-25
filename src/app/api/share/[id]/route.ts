import { NextResponse } from "next/server";
import { getShare } from "@/lib/public-share/store";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const share = await getShare(id);
  if (!share || !share.enabled) {
    return NextResponse.json({ error: "Share not found" }, { status: 404 });
  }
  return NextResponse.json({ share });
}
