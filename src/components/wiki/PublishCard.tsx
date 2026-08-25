"use client";

import { useCallback, useEffect, useState } from "react";

type PublishState = {
  published: boolean;
  canPublish: boolean;
  siteUrl: string | null;
};

/**
 * Per-org public publishing toggle (admins/owners only). Flips the doc's
 * opt-in public flag so it becomes readable on the org's /sites/<slug> site.
 */
export function PublishCard({ docFileName }: { docFileName: string }) {
  const [state, setState] = useState<PublishState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/wiki/publish?doc=${encodeURIComponent(docFileName)}`,
      );
      if (!res.ok) {
        setState(null);
        return;
      }
      setState(await res.json());
    } catch {
      setState(null);
    }
  }, [docFileName]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async () => {
    if (!state) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/wiki/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc: docFileName, published: !state.published }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Publish failed");
      setState((prev) =>
        prev ? { ...prev, published: data.published, siteUrl: data.siteUrl } : prev,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  };

  // Not signed in / not in an org with this doc — hide the control entirely.
  if (!state) return null;

  if (!state.canPublish) {
    return (
      <p className="text-xs text-[var(--wiki-muted)]">
        {state.published
          ? "This wiki is published to your team’s public site."
          : "Ask an org admin or owner to publish this wiki publicly."}
      </p>
    );
  }

  const publicHref = state.siteUrl;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--wiki-text)]">
            {state.published ? "Public — live on your site" : "Private to your team"}
          </p>
          <p className="text-xs text-[var(--wiki-muted)]">
            {state.published ? "Anyone with the link." : "Signed-in teammates only."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={busy}
          className="shrink-0 rounded-full border border-[var(--wiki-border)] px-4 py-1.5 text-xs font-semibold text-[var(--wiki-text)] transition hover:opacity-70 disabled:opacity-50"
        >
          {busy
            ? "Saving…"
            : state.published
              ? "Unpublish"
              : "Publish to public site"}
        </button>
      </div>

      {state.published && publicHref ? (
        <a
          href={publicHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs font-medium text-[var(--wiki-text)] underline"
        >
          {publicHref}
        </a>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
