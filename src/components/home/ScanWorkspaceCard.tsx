"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { IconLink } from "@/components/icons";
import { markWikiBuilding } from "@/components/wiki/WikiBuildGate";
import { createBrowserSupabase, supabaseAuthEnabled } from "@/lib/supabase/browser";

type ScanPhase = "idle" | "cloning" | "scanning" | "building" | "done" | "error";

type GithubRepo = {
  fullName: string;
  name: string;
  owner: string;
  private: boolean;
  updatedAt: string;
  defaultBranch: string;
};

const PHASE_LABELS: Record<ScanPhase, string> = {
  idle: "",
  cloning: "Cloning repository…",
  scanning: "Scanning files…",
  building: "Building wiki…",
  done: "Redirecting…",
  error: "",
};

/** Goal 1 entry: GitHub OAuth → pick your repo → scan → wiki */
export function ScanWorkspaceCard() {
  const router = useRouter();
  const authConfigured = supabaseAuthEnabled();

  const [connected, setConnected] = useState(false);
  const [login, setLogin] = useState<string | null>(null);
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    scanMs?: number;
    cloneMs?: number;
    featured?: number;
    reactFiles?: number;
  } | null>(null);

  const loadStatus = useCallback(async () => {
    if (!authConfigured) return;
    try {
      const res = await fetch("/api/auth/github/status");
      const data = await res.json();
      setConnected(!!data.connected);
      setLogin(data.login ?? null);
    } catch {
      setConnected(false);
    }
  }, [authConfigured]);

  const loadRepos = useCallback(async () => {
    setLoadingRepos(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/github/repos");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load repositories");
      const list = (data.repos ?? []) as GithubRepo[];
      setRepos(list);
      setSelectedRepo((prev) => prev || list[0]?.fullName || "");
      if (data.login) setLogin(data.login);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load repositories");
      setRepos([]);
    } finally {
      setLoadingRepos(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");
    const authDetail = params.get("auth_detail");
    if (authError) {
      const base =
        authError === "github_connect_failed"
          ? "GitHub connect failed. Check Supabase Auth → GitHub provider and URL Configuration, then try again."
          : "GitHub sign-in is not configured on this server.";
      setError(authDetail ? `${base} (${authDetail})` : base);
      window.history.replaceState({}, "", "/");
    }
  }, [loadStatus]);

  useEffect(() => {
    if (connected) void loadRepos();
  }, [connected, loadRepos]);

  const disconnectGithub = async () => {
    const supabase = createBrowserSupabase();
    if (!supabase) return;

    setDisconnecting(true);
    setError(null);
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      setConnected(false);
      setLogin(null);
      setRepos([]);
      setSelectedRepo("");
      setPhase("idle");
      setStats(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign out");
    } finally {
      setDisconnecting(false);
    }
  };

  const connectGithub = async () => {
    const supabase = createBrowserSupabase();
    if (!supabase) {
      setError("GitHub sign-in is not configured on this server.");
      return;
    }

    setConnecting(true);
    setError(null);
    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=/`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo,
          // user:email required — see useSupabaseSession.signInWithGitHub.
          scopes: "read:user user:email repo",
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      setError(err instanceof Error ? err.message : "GitHub connect failed");
      setConnecting(false);
    }
  };

  const runScan = async (body: Record<string, string>) => {
    setPhase(body.github ? "cloning" : "scanning");
    setError(null);
    setStats(null);

    try {
      if (body.github) {
        setTimeout(() => {
          setPhase((prev) => (prev === "cloning" ? "scanning" : prev));
        }, 3000);
      }

      const res = await fetch("/api/scan/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const raw = await res.text();
      let data: { error?: string; wikiUrl?: string; docRef?: string; projectName?: string; scanMs?: number; cloneMs?: number; featured?: number; reactFiles?: number };
      try {
        data = JSON.parse(raw) as typeof data;
      } catch {
        if (res.status === 504 || /<!DOCTYPE/i.test(raw)) {
          throw new Error(
            "Scan timed out on the server. Try a smaller repo, use Try demo, or run `blocksmith scan /path` locally.",
          );
        }
        throw new Error(`Scan failed (${res.status}). Server returned a non-JSON response.`);
      }
      if (!res.ok) throw new Error(data.error || "Scan failed");

      const docRef = data.docRef?.trim();
      const wikiUrl = data.wikiUrl?.trim();
      if (!docRef || !wikiUrl) {
        throw new Error("Scan succeeded but the server response was incomplete.");
      }

      setStats({
        scanMs: data.scanMs,
        cloneMs: data.cloneMs,
        featured: data.featured,
        reactFiles: data.reactFiles,
      });

      setPhase("building");
      markWikiBuilding(docRef, data.projectName ?? "Workspace");

      // Land on the wiki with a post-scan banner (Open Pipeline / Browse) so a
      // fresh scan doesn't dump the operator into a bare-looking intro page.
      const landed = new URL(wikiUrl, window.location.origin);
      if (typeof data.featured === "number") {
        landed.searchParams.set("scanned", String(data.featured));
      } else {
        landed.searchParams.set("scanned", "");
      }

      await new Promise((r) => setTimeout(r, 600));
      setPhase("done");
      router.push(`${landed.pathname}${landed.search}`);
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Scan failed");
    }
  };

  const handleScanSelected = () => {
    if (!selectedRepo) return;
    runScan({ github: selectedRepo });
  };

  const isLoading = phase !== "idle" && phase !== "error";

  return (
    <div className="flex w-full flex-col gap-4">

      {!authConfigured ? (
        <p className="scan-card__notice">
          GitHub sign-in isn&apos;t configured. Enable Supabase Auth with the
          GitHub provider.
        </p>
      ) : !connected ? (
        <div className="scan-card__connect">
          <button
            type="button"
            className="scan-card__btn scan-card__btn--github"
            disabled={connecting || isLoading}
            onClick={() => void connectGithub()}
          >
            <IconLink size={18} className="scan-card__icon" />
            {connecting ? "Redirecting…" : "Connect GitHub"}
          </button>
          <button
            type="button"
            className="scan-card__btn scan-card__btn--secondary"
            disabled={isLoading}
            onClick={() => runScan({ workspace: "fixture:vendor" })}
          >
            Try demo
          </button>
        </div>
      ) : (
        <>
          <div className="scan-card__connected">
            <span className="scan-card__connected-label">
              Signed in{login ? ` as ${login}` : ""}
            </span>
            <span className="scan-card__connected-actions">
              <button
                type="button"
                className="scan-card__link-btn"
                disabled={loadingRepos || isLoading}
                onClick={() => void loadRepos()}
              >
                Refresh repos
              </button>
              <button
                type="button"
                className="scan-card__link-btn"
                disabled={disconnecting || isLoading}
                onClick={() => void disconnectGithub()}
              >
                {disconnecting ? "Signing out…" : "Sign out"}
              </button>
            </span>
          </div>

          <label className="scan-card__field-label" htmlFor="scan-repo-select">
            Repository
          </label>
          <select
            id="scan-repo-select"
            value={selectedRepo}
            onChange={(e) => {
              setSelectedRepo(e.target.value);
              setError(null);
              if (phase === "error") setPhase("idle");
            }}
            className="scan-card__select"
            disabled={isLoading || loadingRepos || repos.length === 0}
          >
            {repos.length === 0 ? (
              <option value="">No repositories found</option>
            ) : (
              repos.map((repo) => (
                <option key={repo.fullName} value={repo.fullName}>
                  {repo.fullName}
                  {repo.private ? " (private)" : ""}
                </option>
              ))
            )}
          </select>

          <div className="scan-card__actions">
            <button
              type="button"
              className="scan-card__btn scan-card__btn--secondary"
              disabled={isLoading}
              onClick={() => runScan({ workspace: "fixture:vendor" })}
            >
              Try demo
            </button>
            <button
              type="button"
              className="scan-card__btn scan-card__btn--primary"
              disabled={isLoading || !selectedRepo || loadingRepos}
              onClick={handleScanSelected}
            >
              {isLoading ? (
                <span className="scan-card__spinner" />
              ) : (
                "Scan codebase"
              )}
            </button>
          </div>
        </>
      )}

      {isLoading && (
        <div className="scan-card__progress">
          <span className="scan-card__progress-dot" />
          <span className="scan-card__progress-text">{PHASE_LABELS[phase]}</span>
        </div>
      )}

      {error && <p className="scan-card__error">{error}</p>}

      {stats && phase === "done" && (
        <p className="scan-card__stats">
          {stats.featured} components, {stats.reactFiles} React files
          {stats.scanMs ? ` — ${(stats.scanMs / 1000).toFixed(1)}s` : ""}
          {stats.cloneMs ? ` (clone ${(stats.cloneMs / 1000).toFixed(1)}s)` : ""}
        </p>
      )}
    </div>
  );
}

