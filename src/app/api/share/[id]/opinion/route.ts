import { NextResponse } from "next/server";
import { z } from "zod";
import { recordOpinion } from "@/lib/public-share/store";

const bodySchema = z.object({
  reaction: z.enum(["approve", "unsure", "reject"]),
  comment: z.string().max(500).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const stats = await recordOpinion(id, {
      reaction: parsed.data.reaction,
      comment: parsed.data.comment,
    });

    if (!stats) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    return NextResponse.json({ stats });
  } catch {
    return NextResponse.json({ error: "Failed to record opinion" }, { status: 500 });
  }
}
