"use client";

import Link from "next/link";
import type { DesignSystem } from "@/lib/blocks/types";
import { hrefWithDoc } from "@/lib/wiki/doc-param";
import { ScannedComponentLivePreview } from "../ScannedComponentLivePreview";
import { canRenderLocalScannedPreview } from "@/lib/scan/local-preview";
import { PageHeader } from "./PageHeader";

export function ScanComponentsHubPage({
  system,
  docFileName,
  meta,
}: {
  system: DesignSystem;
  docFileName: string;
  meta?: { sourceLabel?: string };
}) {
  return (
    <article>
      <PageHeader
        title="Components"
        description={`${system.components.length} designer-facing components from your workspace scan. Open any card for a live visual preview.`}
        status="finalized"
        updatedAt={system.updatedAt}
        source={meta?.sourceLabel}
      />

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {system.components.map((component) => (
          <Link
            key={component.id}
            href={hrefWithDoc(`/wiki/components/${component.id}`, docFileName)}
            className="group overflow-hidden rounded-xl border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] transition hover:border-[var(--wiki-accent)]"
          >
            <div className="border-b border-[var(--wiki-border)] px-4 py-3">
              <p className="font-semibold text-[var(--wiki-text)] group-hover:text-[var(--wiki-accent)]">
                {component.title}
              </p>
              <p className="mt-1 line-clamp-2 text-sm text-[var(--wiki-muted)]">
                {component.role}
              </p>
            </div>
            {canRenderLocalScannedPreview(component) ? (
              <div className="pointer-events-none scale-[0.92] p-4 opacity-95">
                <ScannedComponentLivePreview
                  component={component}
                  system={system}
                  docFileName={docFileName}
                />
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center text-sm text-[var(--wiki-muted)]">
                Open for preview →
              </div>
            )}
          </Link>
        ))}
      </div>
    </article>
  );
}
