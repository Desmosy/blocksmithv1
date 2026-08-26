"use client";

/**
 * Self-serve API keys for the CLI and the MCP server. Same endpoints as the
 * wiki's Sync panel, in the dashboard's own tokens.
 */

import { useCallback, useEffect, useState } from "react";
import { buildCursorMcpDeeplink, buildMcpJsonConfig } from "@/lib/cursor/mcp-deeplink";

type KeyRow = {
  id: string;
  prefix: string;
  label: string;
  createdAt: string;
  lastUsedAt?: string;
};

const ENDPOINT = "/api/v1/auth/keys/me";

export function ApiKeysManager() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [login, setLogin] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<"key" | "config" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(ENDPOINT);
      const data = await res.json();
      if (!res.ok) {
        setKeys([]);
        setLogin(null);
        // 401 is the signed-out state, not a failure worth shouting about.
        if (res.status !== 401) setError(data.error || "Could not load your keys.");
        return;
      }
      setKeys(data.keys ?? []);
      setLogin(data.login ?? null);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createKey = async () => {
    setCreating(true);
    setError(null);
    setNewKey(null);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "cli" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create a key.");
      setNewKey(data.key);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create a key.");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`${ENDPOINT}?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not revoke that key.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke that key.");
    }
  };

  const copy = async (text: string, what: "key" | "config") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("Your browser blocked the clipboard — select and copy manually.");
    }
  };

  if (loading) {
    return <p className="text-[14px] text-[var(--dash-muted-fg)]">Loading your keys…</p>;
  }

  if (!login) {
    return (
      <p className="text-[14px] text-[var(--dash-muted-fg)]">
        Sign in with GitHub to create an API key.
      </p>
    );
  }

  const mcpJson = origin
    ? JSON.stringify(buildMcpJsonConfig(origin, newKey ?? "YOUR_API_KEY"), null, 2)
    : "";

  return (
    <div className="space-y-5">
      <p className="text-[14px] text-[var(--dash-muted-fg)]">
        Signed in as{" "}
        <strong className="font-medium text-[var(--dash-foreground)]">@{login}</strong>
      </p>

      <button
        type="button"
        onClick={() => void createKey()}
        disabled={creating}
        className="rounded-[var(--dash-radius)] bg-[var(--dash-primary)] px-4 py-2 text-[13px] font-medium text-[var(--dash-primary-foreground)] hover:bg-[var(--dash-primary-hover)] disabled:opacity-50"
      >
        {creating ? "Creating…" : "Create API key"}
      </button>

      {newKey ? (
        <div className="rounded-[var(--dash-radius)] border border-[var(--dash-border)] bg-[var(--dash-muted)] p-4">
          <p className="text-[13px] font-medium text-[var(--dash-foreground)]">
            Copy this now — it is shown once
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-[var(--dash-radius)] border border-[var(--dash-border)] bg-[var(--dash-surface)] px-3 py-2 font-mono text-[12px] text-[var(--dash-foreground)]">
              {newKey}
            </code>
            <button
              type="button"
              onClick={() => void copy(newKey, "key")}
              className="rounded-[var(--dash-radius)] border border-[var(--dash-border)] px-3 py-2 text-[13px] text-[var(--dash-foreground)] hover:bg-[var(--dash-surface)]"
            >
              {copied === "key" ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-2 text-[13px] text-[var(--dash-muted-fg)]">
            If you lose it, revoke it and create another.
          </p>

          {origin ? (
            <div className="mt-4 border-t border-[var(--dash-border)] pt-4">
              <p className="text-[13px] font-medium text-[var(--dash-foreground)]">
                Connect your editor
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <a
                  href={buildCursorMcpDeeplink("blocksmith", origin, newKey)}
                  className="rounded-[var(--dash-radius)] border border-[var(--dash-border)] px-3 py-2 text-[13px] text-[var(--dash-foreground)] hover:bg-[var(--dash-surface)]"
                >
                  Add to Cursor
                </a>
                <button
                  type="button"
                  onClick={() => void copy(mcpJson, "config")}
                  className="rounded-[var(--dash-radius)] border border-[var(--dash-border)] px-3 py-2 text-[13px] text-[var(--dash-foreground)] hover:bg-[var(--dash-surface)]"
                >
                  {copied === "config" ? "Copied" : "Copy mcp.json"}
                </button>
              </div>
              <p className="mt-2 font-mono text-[12px] text-[var(--dash-muted-fg)]">
                blocksmith login --key … --url {origin}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="text-[13px] text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      {keys.length ? (
        <ul className="divide-y divide-[var(--dash-border)] rounded-[var(--dash-radius)] border border-[var(--dash-border)]">
          {keys.map((k) => (
            <li
              key={k.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <span className="font-mono text-[13px] text-[var(--dash-foreground)]">
                  {k.prefix}…
                </span>
                <span className="ml-2 text-[13px] text-[var(--dash-muted-fg)]">{k.label}</span>
              </div>
              <button
                type="button"
                onClick={() => void revoke(k.id)}
                className="shrink-0 text-[13px] text-[var(--dash-muted-fg)] hover:text-red-600"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] text-[var(--dash-muted-fg)]">
          No keys yet. Create one to use the CLI or connect your editor.
        </p>
      )}
    </div>
  );
}
