"use client";

import type { ColorToken } from "@/lib/blocks/types";
import { isLightColor } from "@/lib/apollo/theme-css";
import { CopyButton } from "./CopyButton";

interface ColorSwatchCardProps {
  token: ColorToken;
  onSelect?: (token: ColorToken) => void;
  selected?: boolean;
}

export function ColorSwatchCard({
  token,
  onSelect,
  selected,
}: ColorSwatchCardProps) {
  const light = isLightColor(token.value);
  const varSlug = token.cssVar.replace("--color-", "");

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(token)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(token);
        }
      }}
      className={`group w-full cursor-pointer overflow-hidden border text-left transition hover:ring-2 hover:ring-[var(--wiki-accent)] hover:ring-offset-2 ${
        selected
          ? "ring-2 ring-[var(--wiki-accent)] ring-offset-2"
          : "border-[var(--wiki-border)]"
      }`}
      style={{ borderRadius: "var(--wiki-radius-card, 12px)" }}
    >
      <div
        className="relative flex h-28 w-full items-end p-3"
        style={{
          backgroundColor: token.value,
          backgroundImage: light
            ? "linear-gradient(45deg, #e0e0e0 25%, transparent 25%), linear-gradient(-45deg, #e0e0e0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e0e0e0 75%), linear-gradient(-45deg, transparent 75%, #e0e0e0 75%)"
            : undefined,
          backgroundSize: light ? "12px 12px" : undefined,
          backgroundPosition: light ? "0 0, 0 6px, 6px -6px, -6px 0" : undefined,
        }}
      >
        <div
          className="absolute inset-0"
          style={{ backgroundColor: token.value }}
        />
        <span
          className={`relative z-10 font-mono text-xs font-semibold ${
            light ? "text-black/70" : "text-white"
          }`}
        >
          {token.value}
        </span>
      </div>
      <div
        className="space-y-2 p-4"
        style={{ backgroundColor: "var(--wiki-sidebar, var(--wiki-bg))" }}
      >
        <p className="font-mono text-sm font-semibold text-[var(--wiki-text)]">
          {varSlug}
        </p>
        <p className="text-xs text-[var(--wiki-muted)] line-clamp-2">
          {token.name}
        </p>
        <div onClick={(e) => e.stopPropagation()} className="pt-1">
          <CopyButton value={token.value} label="Copy hex" />
        </div>
      </div>
    </div>
  );
}
