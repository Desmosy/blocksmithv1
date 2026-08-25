"use client";

import { useMemo, useState } from "react";
import type { TypographyFamily } from "@/lib/blocks/types";
import { pickGoogleFontSpec } from "@/lib/fonts/font-stack";
import { googleFontSpecFromName } from "@/lib/fonts/resolve-wiki-fonts";
import { CopyButton } from "./CopyButton";
import { InspectablePreview } from "./InspectablePreview";

const SAMPLE =
  "The quick brown fox jumps over the lazy dog. 0123456789";

export function FontSpecimen({ font }: { font: TypographyFamily }) {
  const isDisplay =
    font.role.toLowerCase().includes("display") ||
    font.role.toLowerCase().includes("headline") ||
    font.role.toLowerCase().includes("editorial");
  const spec =
    pickGoogleFontSpec(font.substitute, {
      preferSerif: isDisplay,
      skipInter: true,
    }) ?? googleFontSpecFromName(font.substitute.split(",")[0]?.trim() ?? font.name);
  const family = spec?.family ?? font.substitute ?? "system-ui";
  const defaultWeight = parseInt(font.weights.match(/\d+/)?.[0] ?? "400", 10);
  const sizes = useMemo(
    () =>
      font.sizes
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !Number.isNaN(n)),
    [font.sizes],
  );
  const maxSize = sizes.length ? Math.max(...sizes) : 48;

  const [previewText, setPreviewText] = useState(
    font.name.includes("Mono") ? "const design = true;" : SAMPLE,
  );
  const [fontSize, setFontSize] = useState(sizes[0] ?? 24);
  const [weight, setWeight] = useState(defaultWeight);

  const weights = spec?.weights ?? [400, 700];
  const googleUrl = spec
    ? `https://fonts.google.com/specimen/${spec.family.replace(/ /g, "+")}`
    : null;

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--wiki-border)]">
      <div className="border-b border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--wiki-text)]">
              {font.name}
            </h2>
            {font.cssVar ? (
              <p className="mt-1 font-mono text-xs text-[var(--wiki-muted)]">
                {font.cssVar}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {googleUrl ? (
              <a
                href={googleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-[var(--wiki-text)] px-3 py-1.5 text-xs font-medium text-[var(--wiki-bg)] transition hover:opacity-90"
              >
                View on Google Fonts ↗
              </a>
            ) : null}
            {font.substitute ? (
              <CopyButton value={font.substitute} label="Copy substitute" />
            ) : null}
          </div>
        </div>
        <p className="mt-3 text-sm text-[var(--wiki-muted)]">{font.role}</p>
      </div>

      <InspectablePreview label={font.name}>
        <div
          className="apollo-preview flex min-h-[200px] items-center justify-center px-8 py-12"
          style={{
            fontFamily: isDisplay
              ? "var(--wiki-display-font)"
              : `"${family}", var(--wiki-font)`,
            fontSize: `${fontSize}px`,
            fontWeight: weight,
            letterSpacing: font.letterSpacing.includes("em")
              ? font.letterSpacing
              : undefined,
            lineHeight: font.lineHeight.split(",")[0] ?? 1.2,
            color: "var(--wiki-text)",
            backgroundColor: "var(--wiki-bg)",
          }}
        >
          <p className="max-w-full break-words text-center">{previewText}</p>
        </div>
      </InspectablePreview>

      <div className="space-y-4 border-t border-[var(--wiki-border)] bg-[var(--wiki-bg)] p-6">
        <label className="block text-xs font-medium text-[var(--wiki-muted)]">
          Preview text
          <input
            type="text"
            value={previewText}
            onChange={(e) => setPreviewText(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] px-3 py-2 text-sm text-[var(--wiki-text)] outline-none focus:ring-1 focus:ring-[var(--wiki-text)]"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-medium text-[var(--wiki-muted)]">
            Size — {fontSize}px
            <input
              type="range"
              min={12}
              max={maxSize > 12 ? maxSize : 88}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--wiki-text)]"
            />
          </label>
          <label className="text-xs font-medium text-[var(--wiki-muted)]">
            Weight — {weight}
            <select
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
              className="mt-2 w-full rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] px-3 py-2 text-sm"
            >
              {weights.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </label>
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--wiki-muted)]">Substitute (web)</dt>
            <dd className="font-medium">{font.substitute || "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--wiki-muted)]">Documented sizes</dt>
            <dd>{font.sizes || "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--wiki-muted)]">Line height</dt>
            <dd>{font.lineHeight || "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--wiki-muted)]">Letter spacing</dt>
            <dd>{font.letterSpacing || "—"}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
