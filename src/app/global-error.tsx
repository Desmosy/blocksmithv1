"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Catches root-level failures (including stale .next chunk load errors)
 * when the normal app/error boundary cannot render.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const isChunk =
    error.message?.includes("Cannot find module") ||
    error.message?.includes(".js'");

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
          fontFamily:
            'var(--font-inter, Inter), ui-sans-serif, system-ui, sans-serif',
          background: "#ffffff",
          color: "#171717",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
          BlockSmith could not load
        </h1>
        <p style={{ maxWidth: 420, fontSize: 14, color: "#525252", margin: 0 }}>
          {isChunk
            ? "The dev build cache is out of date. Stop the server, run npm run dev:clean, then hard-refresh the browser (Cmd+Shift+R)."
            : "Something failed while loading the app. Try again or restart the dev server."}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            border: "none",
            borderRadius: 9999,
            background: "#0a0a0a",
            color: "#fff",
            padding: "10px 20px",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
