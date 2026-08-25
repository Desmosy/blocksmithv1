"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createBrowserSupabase,
  supabaseAuthEnabled,
} from "@/lib/supabase/browser";

export type SessionUser = {
  id: string;
  login: string | null;
  email: string | null;
  avatarUrl: string | null;
};

export type SessionStatus = "loading" | "authed" | "anon" | "unconfigured";

export type AuthResult = { ok: true; needsConfirmation?: boolean } | { ok: false; error: string };

export type UseSupabaseSession = {
  status: SessionStatus;
  user: SessionUser | null;
  authConfigured: boolean;
  /** GitHub OAuth (redirects away). */
  signIn: (nextPath?: string) => Promise<void>;
  signInWithGitHub: (nextPath?: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
  signUpWithPassword: (email: string, password: string) => Promise<AuthResult>;
  sendMagicLink: (email: string, nextPath?: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

/**
 * Shared client-side auth state for the global sign-in chrome (S3) and the
 * homepage upload gate (S2). One GitHub-OAuth front door for the whole product.
 */
export function useSupabaseSession(): UseSupabaseSession {
  const authConfigured = supabaseAuthEnabled();
  const [status, setStatus] = useState<SessionStatus>(
    authConfigured ? "loading" : "unconfigured",
  );
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    if (!authConfigured) return;
    const supabase = createBrowserSupabase();
    if (!supabase) {
      setStatus("unconfigured");
      return;
    }

    let active = true;
    const toUser = (u: {
      id: string;
      email?: string | null;
      user_metadata?: Record<string, unknown>;
    }): SessionUser => {
      const meta = u.user_metadata ?? {};
      return {
        id: u.id,
        login:
          (meta.user_name as string | undefined)?.trim() ||
          (meta.preferred_username as string | undefined)?.trim() ||
          u.email?.split("@")[0] ||
          null,
        email: u.email ?? null,
        avatarUrl: (meta.avatar_url as string | undefined) ?? null,
      };
    };

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      if (data.user) {
        setUser(toUser(data.user));
        setStatus("authed");
      } else {
        setUser(null);
        setStatus("anon");
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.user) {
        setUser(toUser(session.user));
        setStatus("authed");
      } else {
        setUser(null);
        setStatus("anon");
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [authConfigured]);

  const callbackUrl = (nextPath?: string): string => {
    const next = nextPath || window.location.pathname + window.location.search;
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  };

  const signInWithGitHub = useCallback(async (nextPath?: string) => {
    const supabase = createBrowserSupabase();
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: callbackUrl(nextPath),
        // user:email is REQUIRED: Supabase fetches the user's email after the
        // OAuth exchange, and GitHub hides private emails without this scope —
        // omitting it fails sign-in with "Error getting user profile".
        scopes: "read:user user:email repo",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  }, []);

  const signInWithPassword = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const supabase = createBrowserSupabase();
      if (!supabase) return { ok: false, error: "Auth is not configured." };
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    },
    [],
  );

  const signUpWithPassword = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const supabase = createBrowserSupabase();
      if (!supabase) return { ok: false, error: "Auth is not configured." };
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: callbackUrl("/") },
      });
      if (error) return { ok: false, error: error.message };
      // When email confirmation is on, no session is returned yet.
      const needsConfirmation = !data.session;
      return { ok: true, needsConfirmation };
    },
    [],
  );

  const sendMagicLink = useCallback(
    async (email: string, nextPath?: string): Promise<AuthResult> => {
      const supabase = createBrowserSupabase();
      if (!supabase) return { ok: false, error: "Auth is not configured." };
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: callbackUrl(nextPath) },
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true, needsConfirmation: true };
    },
    [],
  );

  const signOut = useCallback(async () => {
    const supabase = createBrowserSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setStatus("anon");
  }, []);

  return {
    status,
    user,
    authConfigured,
    signIn: signInWithGitHub,
    signInWithGitHub,
    signInWithPassword,
    signUpWithPassword,
    sendMagicLink,
    signOut,
  };
}
