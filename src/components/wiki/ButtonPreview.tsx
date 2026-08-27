"use client";

import { IconExpand } from "@/components/icons";
import { InspectablePreview } from "./visual/InspectablePreview";

interface ButtonPreviewProps {
  dark?: boolean;
  highContrast?: boolean;
}

export function ButtonPreview({ dark }: ButtonPreviewProps) {
  return (
    <div
      className="design-preview rounded-xl p-6"
      style={{
        backgroundColor: dark ? "var(--wiki-text)" : "var(--wiki-sidebar)",
        color: dark ? "var(--wiki-bg)" : "var(--wiki-text)",
      }}
    >
      <div className="mb-6 flex justify-end gap-2 text-[var(--wiki-muted)]">
        <button type="button" className="rounded p-1 hover:opacity-80" aria-label="Expand preview">
          <IconExpand size={16} />
        </button>
      </div>

      <div className="space-y-8">
        <PreviewRow label="Small" size="sm" />
        <PreviewRow label="Large" size="lg" />
        <PreviewRow label="Full-width" size="full" fullWidth />
      </div>
    </div>
  );
}

function PreviewRow({
  label,
  size,
  fullWidth,
}: {
  label: string;
  size: "sm" | "lg" | "full";
  fullWidth?: boolean;
}) {
  const py = size === "sm" ? "py-2" : "py-3";
  const px = size === "sm" ? "px-4" : "px-6";
  const width = fullWidth ? "w-full" : "w-auto";

  return (
    <div>
      <p className="mb-3 text-xs font-medium text-[var(--wiki-muted)]">{label}</p>
      <div className={`flex flex-wrap gap-3 ${fullWidth ? "flex-col" : ""}`}>
        <button type="button" className={`wiki-cta-primary text-sm ${py} ${px} ${width}`}>
          Primary
        </button>
        <button type="button" className={`wiki-cta-secondary text-sm ${py} ${px} ${width}`}>
          Secondary
        </button>
      </div>
    </div>
  );
}

export function ApolloButtonSamples() {
  return (
    <div
      className="design-preview apollo-preview space-y-6 rounded-xl p-6"
      style={{
        backgroundColor: "var(--wiki-sidebar)",
        color: "var(--wiki-text)",
      }}
    >
      <p className="text-xs font-medium text-[var(--wiki-muted)]">From your design doc</p>
      <InspectablePreview label="Primary action" compact>
        <button type="button" className="wiki-cta-primary text-base">
          Primary action
        </button>
      </InspectablePreview>
      <InspectablePreview label="Secondary action" compact>
        <button type="button" className="wiki-cta-secondary text-base">
          Secondary action
        </button>
      </InspectablePreview>
      <InspectablePreview label="Ghost action" compact>
        <button
          type="button"
          className="rounded-lg bg-transparent px-4 py-2.5 text-base text-[var(--wiki-muted)]"
        >
          Ghost
        </button>
      </InspectablePreview>
    </div>
  );
}
