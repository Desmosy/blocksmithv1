import { NextResponse } from "next/server";
import { isNvidiaConfigured } from "@/lib/ai/nvidia";

export const dynamic = "force-dynamic";

/** Whether AI Lab (Visualize ensemble) is configured on this server. */
export async function GET() {
  return NextResponse.json({
    configured: isNvidiaConfigured(),
    visualizeMode:
      process.env.NVIDIA_ENSEMBLE === "1" ? "ensemble" : "hybrid",
    required: true,
  });
}
