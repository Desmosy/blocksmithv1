"use client";

import type { SpacingToken } from "@/lib/blocks/types";
import { useDesignIR } from "@/lib/design-ir/context";
import {
  previewAccentColor,
  previewBorderColor,
  previewCardBackground,
  radiusForElement,
} from "@/lib/visualize/preview-tokens";
import { InspectablePreview } from "./InspectablePreview";

type BorderRadiusRow = { element: string; value: string };

export function SpacingScaleRow({
  token,
  value,
  barWidthPct,
  minBarPx,
  accentColor,
}: {
  token: string;
  value: string;
  barWidthPct: number;
  minBarPx: number;
  accentColor: string;
}) {
  const label = token.replace("--spacing-", "");
  return (
    <div className="flex items-start gap-4">
      <span className="w-20 pt-2 font-mono text-xs text-[var(--wiki-muted)]">
        {label}
      </span>
      <div className="min-w-0 flex-1">
        <InspectablePreview label={token} compact showTypography={false}>
          <div
            className="h-8 rounded-md apollo-preview"
            style={{
              width: `${Math.max(barWidthPct, 4)}%`,
              backgroundColor: accentColor,
              minWidth: minBarPx > 0 ? 8 : 0,
            }}
          />
        </InspectablePreview>
      </div>
      <span className="w-12 pt-2 text-right text-sm font-medium">{value}</span>
    </div>
  );
}

export function BorderRadiusSample({ row }: { row: BorderRadiusRow }) {
  const ir = useDesignIR();
  const fill = /card/i.test(row.element)
    ? previewCardBackground(ir)
    : "var(--wiki-sidebar, #fff)";
  const border = previewBorderColor(ir);
  const radius =
    row.value || radiusForElement(ir, new RegExp(row.element, "i"));

  return (
    <InspectablePreview label={row.element} compact showTypography={false}>
      <div
        className="h-20 w-full design-preview"
        style={{
          backgroundColor: fill,
          borderRadius: radius,
          border: `1px solid ${border}`,
        }}
      />
    </InspectablePreview>
  );
}

export function SpacingScaleList({ spacing }: { spacing: SpacingToken[] }) {
  const ir = useDesignIR();
  const accent = previewAccentColor(ir);
  const maxVal = Math.max(
    ...spacing.map((s) => parseInt(s.value, 10) || 0),
    96,
  );

  return (
    <div className="space-y-6">
      {spacing.map((s) => {
        const px = parseInt(s.value, 10) || 0;
        const pct = (px / maxVal) * 100;
        return (
          <SpacingScaleRow
            key={s.token}
            token={s.token}
            value={s.value}
            barWidthPct={pct}
            minBarPx={px}
            accentColor={accent}
          />
        );
      })}
    </div>
  );
}
