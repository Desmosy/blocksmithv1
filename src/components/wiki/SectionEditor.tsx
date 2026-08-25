"use client";

/**
 * SectionEditor — universal "Edit this section" raw-markdown editor.
 *
 * Every wiki page maps to one markdown heading; this collapsible control lets a
 * user edit that section's source and save it to staging, even on pages with no
 * structured form. It is the guarantee that *nothing* in the wiki is read-only
 * (on editable docs). Structured forms remain the primary path where they exist;
 * this is the always-available fallback.
 *
 * Save path is the same finalize pipeline as every other edit — blockId
 * `section:<slug>` is handled by modify.ts via replaceSectionBody.
 */
import { useCallback, useState } from "react";
import type { DocLifecycle } from "@/lib/wiki/doc-lifecycle";
import { canEditDoc } from "@/lib/wiki/edit-policy";
import { sectionSlug } from "@/lib/parser/sections";
import { friendlyError } from "@/lib/wiki/friendly-error";

export function SectionEditor({
  docFileName,
  sectionHeading,
  lifecycle = "preview",
}: {
  docFileName: string;
  sectionHeading: string;
  lifecycle?: DocLifecycle;
}) {
  const policy = canEditDoc(lifecycle, docFileName);
  const slug = sectionSlug(sectionHeading);

  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [original, setOriginal] = useState("");
  const [baseHash, setBaseHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/wiki/source?doc=${encodeURIComponent(docFileName)}&section=${encodeURIComponent(slug)}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load section");
      setContent(data.sectionText);
      setOriginal(data.sectionText);
      setBaseHash(data.contentHash);
      setConflict(false);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to load section");
    } finally {
      setLoading(false);
    }
  }, [docFileName, slug]);

  // Don't render on read-only docs — keeps preview samples honest.
  if (!policy.canEdit) return null;

  const dirty = content !== original;

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !original) await load();
  }

  async function save(force = false) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/wiki/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc: docFileName,
          blockId: `section:${slug}`,
          updatedData: { markdown: content },
          baseContentHash: force ? undefined : baseHash,
          force,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setConflict(true);
        setMessage(
          "This document changed since you opened the editor. Reload or overwrite.",
        );
        return;
      }
      if (!res.ok) throw new Error(friendlyError(res.status, data.error));
      setOriginal(content);
      setBaseHash(data.contentHash ?? baseHash);
      setConflict(false);
      setMessage(
        policy.canPromote
          ? "Saved to staging. Open Pipeline to promote."
          : "Saved to your preview document.",
      );
      window.dispatchEvent(
        new CustomEvent("blocksmith:staged", {
          detail: { docRef: docFileName, blockId: `section:${slug}` },
        }),
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-6 rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)]">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left text-xs font-semibold text-[var(--wiki-muted)] hover:text-[var(--wiki-text)] transition"
      >
        <span>
          <span className="font-mono">{"</>"}</span> Edit section source
          {dirty ? (
            <span className="ml-2 font-normal text-[#ca8a04]">• unsaved</span>
          ) : null}
        </span>
        <span className="text-[var(--wiki-muted)]">{open ? "▾" : "▸"}</span>
      </button>

      {open ? (
        <div className="border-t border-[var(--wiki-border)] p-4">
          {loading ? (
            <p className="text-xs text-[var(--wiki-muted)]">Loading…</p>
          ) : (
            <>
              <p className="mb-2 text-[11px] text-[var(--wiki-muted)]">
                Editing the raw markdown for{" "}
                <span className="font-semibold">{sectionHeading}</span>. Saves to
                staging like any other edit.
              </p>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                spellCheck={false}
                className="h-64 w-full resize-y rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] p-3 font-mono text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-[var(--wiki-accent)]"
              />

              {conflict ? (
                <div className="mt-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-[11px] text-red-600 dark:text-red-400">
                  File changed since you opened this.{" "}
                  <button
                    type="button"
                    onClick={() => save(true)}
                    disabled={saving}
                    className="font-semibold underline"
                  >
                    Overwrite & save
                  </button>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => save(false)}
                  disabled={saving || !dirty}
                  className="rounded-md bg-[var(--wiki-text)] px-3 py-1.5 text-xs font-semibold text-[var(--wiki-bg)] hover:opacity-90 transition disabled:opacity-50"
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
                  className="rounded-md border border-[var(--wiki-border)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--wiki-active)] transition disabled:opacity-50"
                >
                  Revert
                </button>
                {message ? (
                  <span className="text-[11px] text-[var(--wiki-muted)]">
                    {message}
                  </span>
                ) : null}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
