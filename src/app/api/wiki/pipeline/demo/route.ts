import { NextResponse } from "next/server";
import { seedInvestorDemo } from "@/lib/ir/demo-seed";

export const dynamic = "force-dynamic";

/**
 * POST /api/wiki/pipeline/demo — (re)seed the investor demo pipeline.
 * Only touches the synthetic `demo:investor.md` registry; no auth needed,
 * no customer data involved. Works on Vercel without local setup.
 */
export async function POST() {
  try {
    const result = seedInvestorDemo();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/wiki/pipeline/demo]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Demo seed failed" },
      { status: 500 },
    );
  }
}
