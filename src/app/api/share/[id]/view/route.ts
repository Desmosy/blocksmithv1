import { NextResponse } from "next/server";
import { recordView } from "@/lib/public-share/store";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const stats = await recordView(id);
  if (!stats) {
    return NextResponse.json({ error: "Share not found" }, { status: 404 });
  }
  return NextResponse.json({ stats });
}
