import { NextResponse } from "next/server";
import { listActivity } from "@/lib/activity/store";
import { getDefaultDocFileName } from "@/lib/clients/registry";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const doc = searchParams.get("doc")?.trim() || getDefaultDocFileName();
  const componentId = searchParams.get("component")?.trim() || undefined;
  const limit = Math.min(
    50,
    Math.max(1, Number(searchParams.get("limit") ?? 25) || 25),
  );

  const entries = listActivity(doc, { componentId, limit });
  return NextResponse.json({ docRef: doc, componentId: componentId ?? null, entries });
}
