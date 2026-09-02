"use client";

import { useCallback, useEffect, useState } from "react";
import { CursorMcpInstall } from "./CursorMcpInstall";

type KeyRow = {
  id: string;
  prefix: string;
  label: string;
  createdAt: string;
  lastUsedAt?: string;
};

export function ApiKeysPanel() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [login, setLogin] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/keys/me");
      const data = await res.json();
      if (!res.ok) {
        setKeys([]);
        setLogin(null);
        if (res.status !== 401) setError(data.error || "Failed to load keys");
        return;
      }
      setKeys(data.keys ?? []);
      setLogin(data.login ?? null);
    } catch {
      setError("Failed to load API keys");
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
      const res = await fetch("/api/v1/auth/keys/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "cli" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      setNewKey(data.key);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/v1/auth/keys/me?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Revoke failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revoke failed");
    }
  };

  if (loading) {
    return (
      <p className="text-sm text-[var(--wiki-muted)]">Loading API keys…</p>
    );
  }

  if (!login) {
    return (
      <p className="text-sm text-[var(--wiki-muted)]">
        Connect GitHub to generate API keys.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--wiki-muted)]">
        Signed in as <strong className="text-[var(--wiki-text)]">@{login}</strong>
      </p>

      <button
        type="button"
        onClick={() => void createKey()}
        disabled={creating}
        className="rounded-lg bg-[var(--wiki-cta-fill,var(--wiki-accent))] px-4 py-2 text-xs font-semibold text-[color:var(--wiki-cta-on-accent,#fff)] hover:opacity-90 disabled:opacity-50"
      >
        {creating ? "Creating…" : "Create API key"}
      </button>

      {newKey ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs">
          <p className="font-semibold text-[var(--wiki-text)]">Copy your key now</p>
          <code className="mt-2 block break-all font-mono text-[11px]">{newKey}</code>
          <p className="mt-2 text-[var(--wiki-muted)]">
            Shown once — revoke and create a new key if you lose it.
          </p>
          <CursorMcpInstall apiKey={newKey} />
        </div>
      ) : null}

      {keys.length > 0 && !newKey ? (
        <p className="text-xs text-[var(--wiki-muted)]">
          Run <code className="font-mono">blocksmith setup cursor</code> to configure Cursor.
        </p>
      ) : null}

      {error ? (
        <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      {keys.length > 0 ? (
        <ul className="divide-y divide-[var(--wiki-border)] rounded-lg border border-[var(--wiki-border)]">
          {keys.map((k) => (
            <li
              key={k.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
            >
              <div>
                <span className="font-mono text-[var(--wiki-text)]">{k.prefix}…</span>
                <span className="ml-2 text-[var(--wiki-muted)]">{k.label}</span>
              </div>
              <button
                type="button"
                onClick={() => void revoke(k.id)}
                className="text-[var(--wiki-muted)] hover:text-red-600"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[var(--wiki-muted)]">No API keys yet.</p>
      )}
    </div>
  );
}
