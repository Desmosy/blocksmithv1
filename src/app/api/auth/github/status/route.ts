import { NextResponse } from "next/server";
import { getGithubSession } from "@/lib/auth/github";
import { supabaseAuthEnabled } from "@/lib/supabase/browser";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!supabaseAuthEnabled()) {
    return NextResponse.json({
      configured: false,
      connected: false,
    });
  }

  const session = await getGithubSession();
  if (!session) {
    return NextResponse.json({
      configured: true,
      connected: false,
    });
  }

  return NextResponse.json({
    configured: true,
    connected: true,
    login: session.login,
  });
}
