"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  IconColorPalette,
  IconLink,
  IconModuleAlt,
  IconUpload,
} from "@/components/icons/streamline";
import ImportFigmaDialog from "@/components/shadcn-studio/dialog/dialog-09";

const EXAMPLES = [
  "A modern fintech dashboard, calm blues",
  "A bold developer tool, high contrast",
  "A warm wellness app, soft and rounded",
];

/**
 * First-run onboarding shown when a user has no projects yet. Explains the ways
 * to start and offers one-click example generation (when AI is configured).
 */
export function DashboardEmptyState({ aiEnabled }: { aiEnabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateExample = async (prompt: string) => {
    setBusy(prompt);
    setError(null);
    try {
      const res = await fetch("/api/projects/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: prompt, useAi: true }),
      });
      const data = (await res.json()) as { wikiPath?: string; error?: string };
      if (!res.ok || !data.wikiPath) throw new Error(data.error || "Generation failed");
      router.push(data.wikiPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
      setBusy(null);
    }
  };

  const card =
    "flex flex-col items-start gap-2 rounded-[var(--dash-radius)] border border-[var(--dash-border)] bg-[var(--dash-surface)] p-5 text-left transition-colors hover:border-[var(--dash-border-strong)]";

  return (
    <div className="rounded-[var(--dash-radius)] border border-dashed border-[var(--dash-border)] bg-[var(--dash-surface)] p-8 sm:p-12">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-[22px] font-semibold tracking-tight text-[var(--dash-foreground)]">
          Create your first design system
        </h2>
        <p className="mt-2 text-[15px] text-[var(--dash-muted-fg)]">
          Describe one above and generate it, bring one in from Figma or your
          codebase, or upload a <code className="text-[13px]">design.md</code>.
          Everything becomes a governed, editable wiki.
        </p>
      </div>

      {aiEnabled && (
        <div className="mx-auto mt-7 max-w-2xl">
          <p className="mb-2 text-center font-gtstandardmono text-[10px] uppercase tracking-wider text-[var(--dash-subtle-fg)]">
            Or try an example
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                disabled={!!busy}
                onClick={() => void generateExample(ex)}
                className="rounded-full border border-[var(--dash-border)] px-4 py-2 text-[13px] text-[var(--dash-foreground)] transition-colors hover:border-[var(--dash-border-strong)] disabled:opacity-50"
              >
                {busy === ex ? "Generating…" : `“${ex}”`}
              </button>
            ))}
          </div>
          {error && (
            <p className="mt-3 text-center text-[13px] text-[var(--dash-destructive)]">{error}</p>
          )}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ImportFigmaDialog>
          <button className={`${card} text-left w-full h-full flex flex-col justify-start items-start`}>
            <IconLink size={20} className="text-[var(--dash-muted-fg)]" />
            <span className="text-[14px] font-medium text-[var(--dash-foreground)] mt-2">Import from Figma</span>
            <span className="text-[13px] text-[var(--dash-muted-fg)] mt-1 text-left">Pull styles + components from a file.</span>
          </button>
        </ImportFigmaDialog>
        <Link href="/dashboard/connectors#codebase" className={card}>
          <IconModuleAlt size={20} className="text-[var(--dash-muted-fg)]" />
          <span className="text-[14px] font-medium text-[var(--dash-foreground)]">Scan a repo</span>
          <span className="text-[13px] text-[var(--dash-muted-fg)]">Extract the system from your code.</span>
        </Link>
        <Link href="/dashboard/connectors" className={card}>
          <IconUpload size={20} className="text-[var(--dash-muted-fg)]" />
          <span className="text-[14px] font-medium text-[var(--dash-foreground)]">Upload or paste .md</span>
          <span className="text-[13px] text-[var(--dash-muted-fg)]">Bring an existing design doc.</span>
        </Link>
      </div>

      {!aiEnabled && (
        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[12px] text-[var(--dash-subtle-fg)]">
          <IconColorPalette size={14} /> AI generation is off — set a model to
          enable “Generate with AI”.
        </p>
      )}
    </div>
  );
}
