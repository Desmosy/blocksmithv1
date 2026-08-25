"use client";

/**
 * CaptureDraftBanner — the human gate for captured designs.
 *
 * A design captured via the browser extension is a DRAFT PROJECT: vision
 * values are estimates and we don't know it's the source of truth until a
 * human says so. While the draft marker is in the doc, this banner sits on
 * every wiki page of the doc: review & edit the source, then Confirm — which
 * strips the marker through the existing source API (same conflict semantics
 * as any source edit).
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { hrefWithDoc } from "@/lib/wiki/doc-param";

const MARKER = "<!-- blocksmith:capture-draft -->";

function isCaptureDoc(fileName: string): boolean {
  return /(^|:)capture-/.test(fileName);
}

export function CaptureDraftBanner({ docFileName }: { docFileName: string }) {
  const capture = isCaptureDoc(docFileName);
  const [state, setState] = useState<
    "loading" | "draft" | "confirmed" | "hidden"
  >(capture ? "loading" : "hidden");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/wiki/source?doc=${encodeURIComponent(docFileName)}`,
        { cache: "no-store" },
      );
      if (!res.ok) return setState("hidden");
      const body = (await res.json()) as { content?: string };
      setState(body.content?.includes(MARKER) ? "draft" : "hidden");
    } catch {
      setState("hidden");
    }
  }, [docFileName]);

  useEffect(() => {
    if (capture) void check();
  }, [capture, check]);

  if (state === "hidden" || state === "loading") return null;

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/wiki/source?doc=${encodeURIComponent(docFileName)}`,
        { cache: "no-store" },
      );
      const body = (await res.json()) as {
        content?: string;
        contentHash?: string;
        error?: string;
      };
      if (!res.ok || !body.content) {
        throw new Error(body.error ?? "Could not read the draft source.");
      }
      const confirmed = body.content
        .split("\n")
        .filter(
          (line) =>
            !line.includes(MARKER) && !/^- Status: \*\*Draft/.test(line.trim()),
        )
        .join("\n");
      const save = await fetch("/api/wiki/source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc: docFileName,
          content: confirmed,
          baseContentHash: body.contentHash,
        }),
      });
      const saveBody = (await save.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!save.ok) {
        throw new Error(saveBody.message ?? saveBody.error ?? "Confirm failed");
      }
      setState("confirmed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirm failed");
    } finally {
      setBusy(false);
    }
  }

  if (state === "confirmed") {
    return (
      <div
        className="mb-6 rounded-lg border px-4 py-3 text-sm"
        style={{
          borderColor: "var(--wiki-border)",
          backgroundColor: "var(--wiki-bg)",
        }}
      >
        ✓ Confirmed — this capture is now a regular project. Edits stage as
        drafts on Pipeline like any other document.
      </div>
    );
  }

  return (
    <div
      className="mb-6 rounded-lg border px-4 py-3 text-sm"
      style={{
        borderColor: "#e6b566",
        backgroundColor: "color-mix(in srgb, #e6b566 8%, var(--wiki-bg))",
      }}
    >
      <p className="font-semibold">Captured draft — not confirmed truth yet</p>
      <p className="mt-1" style={{ color: "var(--wiki-muted)" }}>
        This project was generated from screenshots. Colors, sizes, and
        component details are <strong>visual estimates</strong>. Review and
        edit the source, then confirm it as your design.md.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Link
          href={hrefWithDoc("/wiki/source", docFileName)}
          className="rounded-md border px-3 py-1.5 text-xs font-semibold"
          style={{ borderColor: "var(--wiki-border)" }}
        >
          Review &amp; edit source
        </Link>
        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          className="rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          style={{ backgroundColor: "var(--wiki-text)", color: "var(--wiki-bg)" }}
        >
          {busy ? "Confirming…" : "Confirm as design.md"}
        </button>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    </div>
  );
}
