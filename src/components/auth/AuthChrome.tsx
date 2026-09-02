"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";

/**
 * Global sign-in chrome (S3 of SECURITY-RELEASE-GATE.md). Renders on the
 * homepage header and the wiki rail so identity is visible on every surface
 * that touches customer design data.
 *
 * variant "home" reuses the marketing button classes; "wiki" uses neutral
 * wiki-token styling so it matches the doc shell.
 */
export function AuthChrome({ variant = "home" }: { variant?: "home" | "wiki" }) {
  const { status, user, authConfigured, openAuth, signOut } = useAuth();

  if (!authConfigured) return null;
  if (status === "loading") {
    return <span className={`auth-chrome auth-chrome--${variant} auth-chrome--loading`} aria-hidden />;
  }

  if (status === "authed" && user) {
    const identity = user.login ?? user.email ?? "?";
    return (
      <span className={`auth-chrome auth-chrome--${variant}`}>
        <Link
          href="/wiki/sync?doc=apollo.md"
          className="auth-chrome__identity"
          title={`${identity} — team workspace`}
        >
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" className="auth-chrome__avatar" width={24} height={24} />
          ) : (
            <span className="auth-chrome__avatar auth-chrome__avatar--fallback" aria-hidden>
              {identity.slice(0, 1).toUpperCase()}
            </span>
          )}
          {/* The wiki rail is 84px wide; a login rendered there arrives
              cropped mid-name, which reads as a bug. The avatar or initial
              is the identity; the full name lives in the tooltip. */}
          {variant === "wiki" ? null : (
            <span className="auth-chrome__login">{identity}</span>
          )}
        </Link>
        <button type="button" className="auth-chrome__btn" onClick={() => void signOut()}>
          Sign out
        </button>
      </span>
    );
  }

  return (
    <span className={`auth-chrome auth-chrome--${variant} flex items-center gap-4`}>
      <button
        type="button"
        className={variant === "home" ? "btn-slide bg-transparent border border-black text-ink-black font-plain font-medium text-[14px] tracking-wide px-[20px] py-[8px] rounded-none" : "auth-chrome__btn auth-chrome__btn--ghost"}
        onClick={() => openAuth("signin")}
      >
        Sign in
      </button>
      <button
        type="button"
        className={variant === "home" ? "btn-slide bg-ink-black text-paper-white font-plain font-medium text-[14px] tracking-wide px-[20px] py-[8px] rounded-none" : "auth-chrome__btn auth-chrome__btn--primary"}
        onClick={() => openAuth("signup")}
      >
        Get started
      </button>
    </span>
  );
}
