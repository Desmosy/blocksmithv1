"use client";

import { useEffect, useState } from "react";
import { IconArrowRight, IconCheck } from "@/components/icons/streamline";

const STEPS = [
  "Saving your design document",
  "Parsing color & type tokens",
  "Building component pages",
  "Rendering your wiki",
];

export function WikiGeneratingOverlay({
  open,
  systemName,
}: {
  open: boolean;
  systemName?: string;
}) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!open) {
      setStep(0);
      return;
    }
    const id = setInterval(() => {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, 450);
    return () => clearInterval(id);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--wiki-bg)]/90 backdrop-blur-sm"
      role="alertdialog"
      aria-busy="true"
      aria-label="Building wiki"
    >
      <div
        className="mx-4 w-full max-w-md rounded-lg border px-8 py-10 text-center"
        style={{
          borderColor: "var(--wiki-border)",
          backgroundColor: "var(--wiki-bg)",
        }}
      >
        <div
          className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-2 border-[var(--wiki-border)] border-t-[var(--wiki-text)]"
          aria-hidden
        />
        <h2
          className="text-xl font-normal tracking-tight"
          style={{
            fontFamily: "var(--wiki-display-font)",
            color: "var(--wiki-text)",
          }}
        >
          Building your wiki
        </h2>
        {systemName ? (
          <p className="mt-2 text-sm text-[var(--wiki-muted)]">{systemName}</p>
        ) : null}
        <p className="mt-6 text-sm font-medium text-[var(--wiki-text)]">
          {STEPS[step]}…
        </p>
        <ul className="mt-4 space-y-2 text-left text-xs text-[var(--wiki-muted)]">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={`flex items-center gap-2${i <= step ? " text-[var(--wiki-text)]" : ""}`}
            >
              {i < step ? (
                <IconCheck size={12} />
              ) : i === step ? (
                <IconArrowRight size={12} />
              ) : (
                <span className="inline-block h-1 w-1 rounded-full bg-[var(--wiki-muted)]" />
              )}
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
