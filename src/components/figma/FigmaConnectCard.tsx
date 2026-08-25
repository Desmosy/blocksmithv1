"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Phase = "idle" | "importing" | "error";

type ConnectResult = {
  wikiUrl?: string;
  docRef?: string;
  error?: string;
  summary?: { cssVars: number; colors: number; components: number };
  figmaStats?: {
    namedColorStyles: number;
    textStyles: number;
    rawFills: number;
    componentSets: number;
  };
};

/**
 * UI connector: paste a Figma file URL + personal access token to import its
 * design tokens + components into a governed BlockSmith design.md wiki.
 */
export function FigmaConnectCard() {
  const router = useRouter();
  const [figmaUrl, setFigmaUrl] = useState("");
  const [figmaToken, setFigmaToken] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  const busy = phase === "importing";

  const connect = async () => {
    setPhase("importing");
    setError(null);
    try {
      const res = await fetch("/api/figma/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ figmaUrl, figmaToken }),
      });
      const data = (await res.json()) as ConnectResult;
      if (!res.ok) throw new Error(data.error || "Import failed");
      if (!data.wikiUrl) throw new Error("Import succeeded but no wiki URL was returned.");
      router.push(data.wikiUrl);
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Import failed");
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl">

      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-black/50">
        Figma file URL
      </label>
      <input
        type="url"
        value={figmaUrl}
        onChange={(e) => setFigmaUrl(e.target.value)}
        placeholder="https://www.figma.com/design/…"
        className="mb-4 w-full rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40"
        disabled={busy}
      />

      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-black/50">
        Personal access token
      </label>
      <input
        type="password"
        value={figmaToken}
        onChange={(e) => setFigmaToken(e.target.value)}
        placeholder="figd_…"
        className="mb-1 w-full rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40"
        disabled={busy}
      />
      <p className="mb-5 text-xs text-black/45">
        Figma → Settings → Security → Personal access tokens
      </p>

      <button
        type="button"
        onClick={() => void connect()}
        disabled={busy || !figmaUrl || !figmaToken}
        className="w-full rounded-md bg-black px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Reading structure and visual language…" : "Create fused design.md"}
      </button>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
