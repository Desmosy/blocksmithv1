import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  supabaseServiceRoleKey,
  supabaseStorageEnabled,
  supabaseUrl,
} from "./env";

let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseStorageEnabled()) {
    throw new Error(
      "Supabase not configured — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  if (!client) {
    client = createClient(supabaseUrl()!, supabaseServiceRoleKey()!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
