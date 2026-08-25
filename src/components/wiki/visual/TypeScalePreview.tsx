"use client";

import type { TypeScaleRow } from "@/lib/blocks/types";
import { InspectablePreview } from "./InspectablePreview";

export function TypeScalePreview({ rows }: { rows: TypeScaleRow[] }) {
  return (
    <div
      className="space-y-0 divide-y divide-[var(--wiki-border)] overflow-hidden"
      style={{
        borderRadius: "var(--wiki-radius-card, 16px)",
        border: "var(--wiki-card-border, 1px solid var(--wiki-border))",
        boxShadow: "var(--wiki-card-shadow, none)",
      }}
    >
      {rows.map((row) => {
        const size = parseFloat(row.size);
        return (
          <div
            key={row.role}
            className="apollo-preview bg-[var(--wiki-bg)] px-6 py-5 transition hover:bg-[var(--wiki-sidebar)]"
          >
            <div className="flex items-start gap-6">
              <div className="w-24 shrink-0 pt-1">
                <p className="font-mono text-xs text-[var(--wiki-muted)]">
                  {row.token.replace("--text-", "")}
                </p>
                <p className="text-xs font-medium capitalize text-[var(--wiki-text)]">
                  {row.role}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <InspectablePreview label={row.token} compact>
                  <p
                    className="truncate"
                    style={{
                      fontSize: row.size,
                      lineHeight: `${parseFloat(row.lineHeight) / size}`,
                      letterSpacing: row.letterSpacing || "var(--wiki-body-tracking)",
                      fontFamily: /heading|display/.test(row.role)
                        ? "var(--wiki-display-font, var(--wiki-font))"
                        : "var(--wiki-font)",
                      color: "var(--wiki-text)",
                      fontFeatureSettings: "var(--wiki-font-features, normal)",
                    }}
                  >
                    Ag — {row.role} at {row.size}
                  </p>
                </InspectablePreview>
              </div>
              <div className="hidden shrink-0 pt-1 text-right text-xs text-[var(--wiki-muted)] sm:block">
                <div>{row.size}</div>
                <div>LH {row.lineHeight}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
