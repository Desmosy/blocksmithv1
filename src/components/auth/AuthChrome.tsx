"use client";

import Link from "next/link";
import { IconSignOut } from "@/components/icons";
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

    // The wiki rail is a narrow icon column — Dashboard, Design, Setup are
    // all a glyph in a size-9 slot. The identity renders the same way: the
    // avatar (or initial) as one slot, sign-out as an icon beneath it. The
    // full login lives in the tooltips; text does not fit an 84px rail.
    if (variant === "wiki") {
      return (
        <span className="flex flex-col items-center gap-1">
          <Link
            href="/wiki/sync?doc=apollo.md"
            className="flex size-9 items-center justify-center rounded-lg transition hover:opacity-70"
            title={`${identity} — team workspace`}
            aria-label={`${identity} — team workspace`}
          >
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="auth-chrome__avatar" width={24} height={24} />
            ) : (
              <span className="auth-chrome__avatar auth-chrome__avatar--fallback" aria-hidden>
                {identity.slice(0, 1).toUpperCase()}
              </span>
            )}
          </Link>
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-lg transition hover:opacity-70"
            style={{ color: "var(--wiki-muted)" }}
            onClick={() => void signOut()}
            title="Sign out"
            aria-label="Sign out"
          >
            <IconSignOut size={18} />
          </button>
        </span>
      );
    }

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
          <span className="auth-chrome__login">{identity}</span>
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
