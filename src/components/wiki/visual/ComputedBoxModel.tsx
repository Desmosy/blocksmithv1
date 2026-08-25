"use client";

import type { CSSProperties } from "react";
import type { BoxModelMetrics, ComputedSnapshot } from "@/lib/visual/computed-metrics";
import { formatPx } from "@/lib/visual/computed-metrics";

interface ComputedBoxModelProps {
  snapshot: ComputedSnapshot;
  label?: string;
  compact?: boolean;
  showTypography?: boolean;
}

function SideLabel({ value, position }: { value: number; position: string }) {
  if (value === 0) return null;
  return (
    <span
      className={`absolute font-mono text-[10px] text-[var(--wiki-muted)] ${position}`}
    >
      {formatPx(value)}
    </span>
  );
}

function BoxLayer({
  metrics,
  layer,
}: {
  metrics: BoxModelMetrics;
  layer: "margin" | "border" | "padding" | "content";
}) {
  const b = metrics;
  const styles: Record<typeof layer, CSSProperties> = {
    margin: {
      background: "transparent",
      border: "1px dashed color-mix(in srgb, var(--wiki-muted) 55%, transparent)",
    },
    border: {
      background: "color-mix(in srgb, #f9a825 18%, var(--wiki-bg))",
      border: "1px solid color-mix(in srgb, #f9a825 45%, var(--wiki-border))",
    },
    padding: {
      background: "color-mix(in srgb, #66bb6a 22%, var(--wiki-bg))",
      border: "1px solid color-mix(in srgb, #66bb6a 40%, var(--wiki-border))",
    },
    content: {
      background: "color-mix(in srgb, #42a5f5 25%, var(--wiki-bg))",
      border: "1px solid color-mix(in srgb, #42a5f5 50%, var(--wiki-border))",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: 48,
      minHeight: 28,
    },
  };

  const pad =
    layer === "padding"
      ? `${b.paddingTop}px ${b.paddingRight}px ${b.paddingBottom}px ${b.paddingLeft}px`
      : undefined;
  const borderW =
    layer === "border"
      ? `${b.borderTop}px ${b.borderRight}px ${b.borderBottom}px ${b.borderLeft}px`
      : undefined;
  const margin =
    layer === "margin"
      ? `${b.marginTop}px ${b.marginRight}px ${b.marginBottom}px ${b.marginLeft}px`
      : undefined;

  return (
    <div
      className="relative box-border"
      style={{
        ...styles[layer],
        padding: pad,
        borderWidth: borderW,
        margin,
      }}
    >
      {layer === "margin" && (
        <>
          <SideLabel value={b.marginTop} position="left-1/2 top-0 -translate-x-1/2 -translate-y-full" />
          <SideLabel value={b.marginRight} position="right-0 top-1/2 translate-x-full -translate-y-1/2 pl-1" />
          <SideLabel value={b.marginBottom} position="left-1/2 bottom-0 -translate-x-1/2 translate-y-full" />
          <SideLabel value={b.marginLeft} position="left-0 top-1/2 -translate-x-full -translate-y-1/2 pr-1" />
        </>
      )}
      {layer === "border" && (
        <>
          <SideLabel value={b.borderTop} position="left-1/2 top-0.5 -translate-x-1/2" />
          <SideLabel value={b.borderRight} position="right-0.5 top-1/2 -translate-y-1/2" />
          <SideLabel value={b.borderBottom} position="left-1/2 bottom-0.5 -translate-x-1/2" />
          <SideLabel value={b.borderLeft} position="left-0.5 top-1/2 -translate-y-1/2" />
        </>
      )}
      {layer === "padding" && (
        <>
          <SideLabel value={b.paddingTop} position="left-1/2 top-0.5 -translate-x-1/2" />
          <SideLabel value={b.paddingRight} position="right-0.5 top-1/2 -translate-y-1/2" />
          <SideLabel value={b.paddingBottom} position="left-1/2 bottom-0.5 -translate-x-1/2" />
          <SideLabel value={b.paddingLeft} position="left-0.5 top-1/2 -translate-y-1/2" />
        </>
      )}
      {layer === "content" && (
        <span className="font-mono text-[10px] font-medium text-[var(--wiki-text)]">
          {b.contentWidth}×{b.contentHeight}
        </span>
      )}
      {layer !== "content" && <BoxLayer metrics={metrics} layer={nextLayer(layer)} />}
    </div>
  );
}

function nextLayer(layer: "margin" | "border" | "padding" | "content") {
  const order = ["margin", "border", "padding", "content"] as const;
  const i = order.indexOf(layer);
  return order[i + 1] ?? "content";
}

function PropertyRow({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex gap-2 text-[11px] leading-snug">
      <span className="shrink-0 text-[var(--wiki-muted)]">{name}</span>
      <span className="min-w-0 break-all font-mono text-[var(--wiki-text)]">{value}</span>
    </div>
  );
}

export function ComputedBoxModel({
  snapshot,
  label,
  compact = false,
  showTypography = true,
}: ComputedBoxModelProps) {
  const { box } = snapshot;
  const hasSurface =
    snapshot.backgroundColor !== "rgba(0, 0, 0, 0)" &&
    snapshot.backgroundColor !== "transparent";
  const showTypo = showTypography;
  const showSurface = !compact || hasSurface;

  return (
    <div
      className="mt-3 rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] p-3"
      aria-label={label ? `Computed styles for ${label}` : "Computed styles"}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--wiki-muted)]">
          Computed
        </p>
        {label ? (
          <p className="truncate font-mono text-[10px] text-[var(--wiki-muted)]">{label}</p>
        ) : null}
      </div>

      <div className="overflow-x-auto pb-1">
        <BoxLayer metrics={box} layer="margin" />
      </div>

      <div
        className={`mt-3 grid gap-x-4 gap-y-1 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}
      >
        <PropertyRow name="width" value={`${box.contentWidth}px`} />
        <PropertyRow name="height" value={`${box.contentHeight}px`} />
        {box.paddingTop + box.paddingRight + box.paddingBottom + box.paddingLeft > 0 ? (
          <PropertyRow
            name="padding"
            value={`${box.paddingTop} ${box.paddingRight} ${box.paddingBottom} ${box.paddingLeft}`}
          />
        ) : null}
        {box.borderTop + box.borderRight + box.borderBottom + box.borderLeft > 0 ? (
          <PropertyRow
            name="border"
            value={`${box.borderTop} ${box.borderRight} ${box.borderBottom} ${box.borderLeft}`}
          />
        ) : null}
        {showSurface && snapshot.backgroundColor !== "rgba(0, 0, 0, 0)" ? (
          <PropertyRow name="background" value={snapshot.backgroundColor} />
        ) : null}
        {snapshot.borderRadius !== "0px" ? (
          <PropertyRow name="border-radius" value={snapshot.borderRadius} />
        ) : null}
        {showTypo ? (
          <>
            <PropertyRow name="font-size" value={snapshot.fontSize} />
            <PropertyRow name="line-height" value={snapshot.lineHeight} />
            {snapshot.letterSpacing !== "normal" ? (
              <PropertyRow name="letter-spacing" value={snapshot.letterSpacing} />
            ) : null}
            <PropertyRow name="font-weight" value={snapshot.fontWeight} />
            <PropertyRow name="font-family" value={snapshot.fontFamily} />
            <PropertyRow name="color" value={snapshot.color} />
          </>
        ) : null}
        {snapshot.boxShadow !== "none" ? (
          <PropertyRow name="box-shadow" value={snapshot.boxShadow} />
        ) : null}
      </div>
    </div>
  );
}
