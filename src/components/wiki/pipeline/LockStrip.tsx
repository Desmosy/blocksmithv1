"use client";

/**
 * LockStrip — persistent status bar at the top of Pipeline (spec §1).
 */
import { useState } from "react";
import type { PipelinePayload } from "@/lib/ir/pipeline";

export function LockStrip({
  data,
  docFileName,
  onPinned,
}: {
  data: PipelinePayload;
  docFileName: string;
  onPinned: () => void;
}) {
  const [showJson, setShowJson] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const { lock } = data;
  const state: "none" | "stale" | "fresh" = !lock.present
    ? "none"
    : lock.fresh
      ? "fresh"
      : "stale";

  const pullCmd = `blocksmith pull --doc ${docFileName}`;

  const copy = (key: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  async function pinLock() {
    setPinning(true);
    setError(null);
    try {
      const res = await fetch("/api/wiki/pin-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc: docFileName }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Pin failed");
      onPinned();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pin failed");
    } finally {
      setPinning(false);
    }
  }

  const message = {
    none: "Production graph ready — pin your repo to enforce agents",
    stale: `Promoted after last pull — ${data.driftCount} pin${data.driftCount === 1 ? "" : "s"} would fail validate:ui`,
    fresh: "Agents and CI pinned to this graph",
  }[state];

  return (
    <div className={`pipeline-lock-strip pipeline-lock-strip--${state}`}>
      <div className="pipeline-lock-strip__main">
        <span className={`pipeline-lock-strip__dot pipeline-lock-strip__dot--${state}`} />
        <span className="pipeline-lock-strip__label">
          {state === "none" ? "No lock" : state === "stale" ? "Lock stale" : "Lock fresh"}
        </span>
        <span className="pipeline-lock-strip__message">{message}</span>
        <span className="pipeline-lock-strip__meta">
          {data.graphHash} · {data.packageName} · {data.counts.live} in production
        </span>
      </div>

      <div className="pipeline-lock-strip__actions">
        {state === "none" && (
          <button
            type="button"
            onClick={pinLock}
            disabled={pinning || data.counts.live === 0}
            className="pipeline-lock-strip__btn pipeline-lock-strip__btn--primary"
          >
            {pinning ? "Pinning…" : "Pin production lock"}
          </button>
        )}
        {state === "stale" && (
          <button
            type="button"
            onClick={() => copy("pull", pullCmd)}
            className="pipeline-lock-strip__btn pipeline-lock-strip__btn--primary"
          >
            {copied === "pull" ? "Copied" : "Copy pull"}
          </button>
        )}
        {state === "fresh" && (
          <button
            type="button"
            onClick={() => copy("lock", data.lockBody)}
            className="pipeline-lock-strip__btn pipeline-lock-strip__btn--primary"
          >
            {copied === "lock" ? "Copied" : "Copy lock"}
          </button>
        )}
        <button
          type="button"
          onClick={() => copy("pull2", pullCmd)}
          className="pipeline-lock-strip__btn"
        >
          {copied === "pull2" ? "Copied" : "Copy pull"}
        </button>
        <button
          type="button"
          onClick={() => setShowJson((s) => !s)}
          className="pipeline-lock-strip__btn"
        >
          {showJson ? "Hide JSON" : "View JSON"}
        </button>
        {error && <span className="pipeline-lock-strip__error">{error}</span>}
      </div>

      {showJson && (
        <pre className="pipeline-lock-strip__json">{data.lockBody}</pre>
      )}
    </div>
  );
}
