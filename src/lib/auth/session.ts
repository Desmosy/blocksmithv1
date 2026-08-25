import "server-only";

import { createUserSupabase } from "@/lib/supabase/user-server";

export type SupabaseUser = {
  userId: string;
  login: string | null;
  email: string | null;
};

export async function getSupabaseUser(): Promise<SupabaseUser | null> {
  const supabase = await createUserSupabase();
  if (!supabase) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const login =
    (user.user_metadata?.user_name as string | undefined)?.trim() ||
    (user.user_metadata?.preferred_username as string | undefined)?.trim() ||
    user.email?.split("@")[0] ||
    null;

  return {
    userId: user.id,
    login,
    email: user.email ?? null,
  };
}
