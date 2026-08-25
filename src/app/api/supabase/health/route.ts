import { NextResponse } from "next/server";
import { supabaseAnonKey, supabaseStorageEnabled, supabaseUrl } from "@/lib/supabase/env";
import { supabaseStorageHealth } from "@/lib/supabase/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const storage = await supabaseStorageHealth();
  return NextResponse.json({
    url: supabaseUrl() ?? null,
    anonKeySet: Boolean(supabaseAnonKey()),
    serviceRoleSet: supabaseStorageEnabled(),
    storage,
  });
}
