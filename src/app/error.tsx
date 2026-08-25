"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

function isStaleChunkError(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes("Cannot find module") ||
    message.includes("Loading chunk") ||
    /\.js'/.test(message)
  );
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const staleChunk = isStaleChunkError(error.message);
  const isDev = process.env.NODE_ENV === "development";

  useEffect(() => {
    console.error("[BlockSmith]", error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center text-[#171717]">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm text-[#525252]">
        {isDev && staleChunk ? (
          <>
            The dev build cache is out of date. Stop the server, run{" "}
            <code className="rounded bg-[#f5f5f5] px-1.5 py-0.5 font-mono text-xs">
              npm run dev:clean
            </code>
            , then hard-refresh (Cmd+Shift+R).
          </>
        ) : isDev ? (
          <>
            This is often a stale dev cache. Run{" "}
            <code className="rounded bg-[#f5f5f5] px-1.5 py-0.5 font-mono text-xs">
              npm run dev:clean
            </code>{" "}
            in the project folder, then hard-refresh the browser.
          </>
        ) : (
          "An unexpected error occurred. Try again, or head back to your dashboard."
        )}
      </p>
      {isDev && error.message ? (
        <pre className="max-w-lg overflow-x-auto rounded-lg bg-[#f5f5f5] p-3 text-left text-xs text-[#525252]">
          {error.message}
          {error.digest ? `\n(digest: ${error.digest})` : ""}
        </pre>
      ) : null}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-[#0a0a0a] px-5 py-2 text-sm font-medium text-white"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="rounded-full border border-black/15 px-5 py-2 text-sm font-medium text-[#171717] transition-colors hover:border-black/40"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
