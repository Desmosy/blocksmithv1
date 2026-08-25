"use client";

import Link from "next/link";

export default function ShareError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] p-8">
      <h1 className="text-xl font-semibold">Could not load this preview</h1>
      <p className="mt-3 text-sm text-[var(--wiki-muted)]">
        This link may be invalid, or the build cache is stale. Restart with a
        clean cache:
      </p>
      <pre className="mt-4 overflow-x-auto rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-bg)] p-4 text-xs">
        npm run dev:clean
      </pre>
      {error.message ? (
        <p className="mt-4 font-mono text-xs text-[var(--wiki-muted)]">
          {error.message}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-[var(--wiki-text)] px-4 py-2 text-sm font-medium text-[var(--wiki-bg)]"
        >
          Try again
        </button>
        <Link
          href="/wiki"
          className="rounded-lg border border-[var(--wiki-border)] px-4 py-2 text-sm font-medium"
        >
          Back to wiki
        </Link>
      </div>
    </div>
  );
}
