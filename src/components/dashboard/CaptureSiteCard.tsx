"use client";

/**
 * "Name a site you like" — the first thing to try on an empty dashboard.
 *
 * Deliberately the primary action. The other three ways in each need something
 * you may not have on your first visit: a Figma token, a repo to scan, an
 * existing design.md. This one needs a URL, works with nothing configured, and
 * is the shortest path from an empty account to a governed design system —
 * which is the thing worth seeing.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconColorPalette } from "@/components/icons";

const SUGGESTIONS = ["linear.app", "stripe.com", "vercel.com"];

type Result = {
  title: string;
  wikiPath: string;
  counts: { colors: number; typefaces: number; components: number };
  readFrom: "rendered" | "css";
};

export function CaptureSiteCard() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const capture = async (target: string) => {
    const trimmed = target.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = (await res.json()) as Result & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error || "Could not read that site.");
      setResult(data);
      router.push(data.wikiPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that site.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-[var(--dash-radius)] border border-[var(--dash-border)] bg-[var(--dash-surface)] p-6">
      <div className="flex items-start gap-3">
        <IconColorPalette size={20} className="mt-0.5 text-[var(--dash-muted-fg)]" />
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-medium text-[var(--dash-foreground)]">
            Name a site you like
          </h3>
          <p className="mt-1 text-[14px] leading-relaxed text-[var(--dash-muted-fg)]">
            BlockSmith reads its colours, type and spacing and turns them into a
            design system you can build against — and govern. No account or
            token needed.
          </p>

          <form
            className="mt-4 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void capture(url);
            }}
          >
            <label className="sr-only" htmlFor="capture-url">
              Site address
            </label>
            <input
              id="capture-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="linear.app"
              spellCheck={false}
              autoComplete="url"
              disabled={busy}
              className="min-w-0 flex-1 rounded-[var(--dash-radius)] border border-[var(--dash-border)] bg-[var(--dash-background)] px-3 py-2 text-[14px] text-[var(--dash-foreground)] outline-none placeholder:text-[var(--dash-muted-fg)]/60 focus:border-[var(--dash-primary)] disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={busy || !url.trim()}
              className="shrink-0 rounded-[var(--dash-radius)] bg-[var(--dash-primary)] px-4 py-2 text-[14px] font-medium text-[var(--dash-primary-foreground)] hover:bg-[var(--dash-primary-hover)] disabled:opacity-50"
            >
              {busy ? "Reading…" : "Capture"}
            </button>
          </form>

          {busy ? (
            <p className="mt-2 text-[13px] text-[var(--dash-muted-fg)]">
              Opening the page and reading how it is built. This takes a few
              seconds.
            </p>
          ) : null}

          {!busy && !error ? (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-[var(--dash-muted-fg)]">
              <span>Try</span>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setUrl(s);
                    void capture(s);
                  }}
                  className="rounded-full border border-[var(--dash-border)] px-3 py-1 text-[13px] text-[var(--dash-foreground)] hover:border-[var(--dash-border-strong)]"
                >
                  {s}
                </button>
              ))}
            </p>
          ) : null}

          {error ? (
            <p className="mt-3 text-[13px] text-red-600 dark:text-red-400">{error}</p>
          ) : null}

          {result ? (
            <p className="mt-3 text-[13px] text-[var(--dash-foreground)]">
              Captured {result.title} — {result.counts.colors} colours,{" "}
              {result.counts.typefaces} typefaces
              {result.readFrom === "rendered"
                ? `, ${result.counts.components} components`
                : " (read from CSS only)"}
              . Opening it…
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
