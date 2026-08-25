"use client";

/**
 * SourcePage — full-document markdown editor (Phase 4 of the wiki edit track).
 *
 * Power-user escape hatch: edit the whole `.md` and save it to staging in one
 * shot via POST /api/wiki/source. Same promote semantics as structured edits —
 * production/agents stay on the current lock until someone promotes on Pipeline.
 * A plain textarea (no Monaco) keeps the bundle light for v1.
 */
import { useCallback, useEffect, useState } from "react";
import type { DocLifecycle } from "@/lib/wiki/doc-lifecycle";
import { canEditDoc } from "@/lib/wiki/edit-policy";
import { friendlyError } from "@/lib/wiki/friendly-error";
import { PageHeader } from "./PageHeader";

export function SourcePage({
  docFileName,
  lifecycle = "preview",
}: {
  docFileName: string;
  lifecycle?: DocLifecycle;
}) {
  const policy = canEditDoc(lifecycle, docFileName);
  const [content, setContent] = useState("");
  const [original, setOriginal] = useState("");
  const [baseHash, setBaseHash] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/wiki/source?doc=${encodeURIComponent(docFileName)}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load source");
      setContent(data.content);
      setOriginal(data.content);
      setBaseHash(data.contentHash);
      setConflict(false);
      setMessage(null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to load source");
    } finally {
      setLoading(false);
    }
  }, [docFileName]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = content !== original;

  async function save(force = false) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/wiki/source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc: docFileName,
          content,
          baseContentHash: force ? undefined : baseHash,
          force,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setConflict(true);
        setMessage(
          "This document changed since you loaded it. Reload to see the latest, or overwrite.",
        );
        return;
      }
      if (!res.ok) throw new Error(friendlyError(res.status, data.error));
      setOriginal(content);
      setBaseHash(data.contentHash);
      setConflict(false);
      setMessage(
        policy.canPromote
          ? "Saved to staging. Promote on Pipeline."
          : "Saved to preview. Connect a repo to promote.",
      );
      window.dispatchEvent(
        new CustomEvent("blocksmith:staged", {
          detail: { docRef: docFileName, blockId: "source:full" },
        }),
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article>
      <PageHeader
        title="Source"
        description="Edit the full document. For single tokens, prefer the token pages."
        status="draft"
        source={docFileName}
      />

      <div className="mb-4 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-2.5 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
        Source edits affect the entire document.
      </div>

      {!policy.canEdit ? (
        <p className="rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] px-4 py-3 text-sm text-[var(--wiki-muted)]">
          {policy.reason ?? "Read-only. Connect a repo and scan to edit."}
        </p>
      ) : loading ? (
        <p className="text-sm text-[var(--wiki-muted)]">Loading source…</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => save(false)}
              disabled={saving || !dirty}
              className="rounded-lg bg-[var(--wiki-text)] px-4 py-2 text-xs font-semibold text-[var(--wiki-bg)] hover:opacity-90 transition disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save to staging"}
            </button>
            <button
              type="button"
              onClick={() => {
                setContent(original);
                setMessage(null);
              }}
              disabled={saving || !dirty}
              className="rounded-lg border border-[var(--wiki-border)] px-4 py-2 text-xs font-semibold hover:bg-[var(--wiki-active)] transition disabled:opacity-50"
            >
              Discard changes
            </button>
            <button
              type="button"
              onClick={() => load()}
              disabled={saving}
              className="rounded-lg border border-[var(--wiki-border)] px-4 py-2 text-xs font-semibold hover:bg-[var(--wiki-active)] transition disabled:opacity-50"
            >
              Reload
            </button>
            {dirty ? (
              <span className="text-xs text-[var(--wiki-muted)]">
                Unsaved changes
              </span>
            ) : null}
          </div>

          {conflict ? (
            <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-2.5 text-xs text-red-600 dark:text-red-400">
              <p className="font-semibold">Conflict</p>
              <p className="mt-1 opacity-90">
                The file changed since you loaded it.
              </p>
              <button
                type="button"
                onClick={() => save(true)}
                disabled={saving}
                className="mt-2 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition disabled:opacity-50"
              >
                Overwrite & save to staging
              </button>
            </div>
          ) : null}

          {message ? (
            <p className="mb-3 text-xs text-[var(--wiki-muted)]">{message}</p>
          ) : null}

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
            className="h-[60vh] w-full resize-y rounded-xl border border-[var(--wiki-border)] bg-[var(--wiki-bg)] p-4 font-mono text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-[var(--wiki-accent)]"
          />
        </>
      )}
    </article>
  );
}
