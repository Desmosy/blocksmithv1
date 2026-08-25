import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { acceptPendingInvites } from "@/lib/cloud/orgs";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

type SupabaseCookie = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

function safeNextPath(raw: string | null): string {
  const next = raw?.trim() || "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

function failRedirect(origin: string, reason: string, detail?: string): NextResponse {
  const params = new URLSearchParams({ auth_error: reason });
  if (detail?.trim()) params.set("auth_detail", detail.slice(0, 200));
  return NextResponse.redirect(`${origin}/?${params.toString()}`);
}

export async function GET(request: NextRequest) {
  const sbUrl = supabaseUrl();
  const sbKey = supabaseAnonKey();
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (!sbUrl || !sbKey) {
    return failRedirect(origin, "supabase_not_configured");
  }

  const oauthErr =
    searchParams.get("error_description")?.trim() ||
    searchParams.get("error")?.trim();
  if (oauthErr) {
    return failRedirect(origin, "github_connect_failed", oauthErr);
  }

  if (!code) {
    return failRedirect(origin, "github_connect_failed", "missing_code");
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const redirectOrigin =
    process.env.NODE_ENV === "production" && forwardedHost
      ? `https://${forwardedHost}`
      : origin;

  const response = NextResponse.redirect(new URL(next, redirectOrigin));

  const supabase = createServerClient(sbUrl, sbKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: SupabaseCookie[]) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return failRedirect(
      origin,
      "github_connect_failed",
      error?.message ?? "exchange_failed",
    );
  }

  try {
    await acceptPendingInvites(data.user.id, data.user.email ?? null);
  } catch (err) {
    console.warn("[auth/callback] acceptPendingInvites failed", err);
  }

  return response;
}
