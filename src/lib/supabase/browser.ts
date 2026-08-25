import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "./env";

export function supabaseAuthEnabled(): boolean {
  return Boolean(supabaseUrl() && supabaseAnonKey());
}

export function createBrowserSupabase(): SupabaseClient | null {
  const url = supabaseUrl();
  const key = supabaseAnonKey();
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}
