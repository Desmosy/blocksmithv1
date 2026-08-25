"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";

type Mode = "signin" | "signup";

export function AuthDialog({
  mode,
  onModeChange,
  onClose,
}: {
  mode: Mode;
  onModeChange: (m: Mode) => void;
  onClose: () => void;
}) {
  const {
    signInWithGitHub,
    signInWithPassword,
    signUpWithPassword,
    sendMagicLink,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const reset = () => {
    setError(null);
    setNotice(null);
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    reset();
    if (!email.trim() || !password) {
      setError("Enter your email and a password.");
      return;
    }
    if (mode === "signup" && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    const res =
      mode === "signin"
        ? await signInWithPassword(email.trim(), password)
        : await signUpWithPassword(email.trim(), password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (mode === "signup" && res.needsConfirmation) {
      setNotice("Check your inbox to confirm your email, then sign in.");
      return;
    }
    onClose();
  };

  const magicLink = async () => {
    reset();
    if (!email.trim()) {
      setError("Enter your email first.");
      return;
    }
    setBusy(true);
    const res = await sendMagicLink(email.trim());
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setNotice("Magic link sent — check your inbox to finish signing in.");
  };

  return (
    <div
      className="auth-dialog__overlay"
      role="dialog"
      aria-modal="true"
      aria-label={mode === "signin" ? "Sign in" : "Create account"}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="auth-dialog">
        <button
          type="button"
          className="auth-dialog__close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <h2 className="auth-dialog__title">
          {mode === "signin" ? "Sign in to BlockSmith" : "Create your account"}
        </h2>
        <p className="auth-dialog__subtitle">
          Your design files stay private to your team.
        </p>

        <button
          type="button"
          className="auth-dialog__github"
          disabled={busy}
          onClick={() => void signInWithGitHub()}
        >
          Continue with GitHub
        </button>

        <div className="auth-dialog__divider">
          <span>or {mode === "signin" ? "sign in" : "sign up"} with email</span>
        </div>

        <form className="auth-dialog__form" onSubmit={submitPassword}>
          <label className="auth-dialog__label">
            Email
            <input
              type="email"
              autoComplete="email"
              className="auth-dialog__input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
          </label>
          <label className="auth-dialog__label">
            Password
            <input
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className="auth-dialog__input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signin" ? "Your password" : "At least 8 characters"}
              required
            />
          </label>

          {error ? <p className="auth-dialog__error">{error}</p> : null}
          {notice ? <p className="auth-dialog__notice">{notice}</p> : null}

          <button type="submit" className="auth-dialog__submit" disabled={busy}>
            {busy
              ? "Working…"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <button
          type="button"
          className="auth-dialog__magic"
          disabled={busy}
          onClick={() => void magicLink()}
        >
          Email me a magic link instead
        </button>

        <p className="auth-dialog__switch">
          {mode === "signin" ? (
            <>
              New here?{" "}
              <button type="button" onClick={() => { reset(); onModeChange("signup"); }}>
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button type="button" onClick={() => { reset(); onModeChange("signin"); }}>
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
