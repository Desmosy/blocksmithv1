"use client";

import type { SurfaceRow } from "@/lib/blocks/types";
import { surfaceBlockId } from "@/lib/public-share/block-ids";
import { ShareBlockPanel } from "@/components/share/ShareBlockPanel";
import { InspectablePreview } from "./InspectablePreview";

export function SurfaceLevelCard({
  surface,
  index,
  total,
  docFileName,
}: {
  surface: SurfaceRow;
  index: number;
  total: number;
  docFileName?: string;
}) {
  const blockId = surfaceBlockId(surface.level, surface.name);
  const title = `Level ${surface.level} — ${surface.name}`;
  return (
    <div>
      <InspectablePreview
        label={`Level ${surface.level} — ${surface.name}`}
        className="block"
      >
        <div
          className="wiki-surface-swatch relative overflow-hidden transition"
          style={{
            backgroundColor: surface.value,
            marginLeft: index * 24,
            minHeight: 120,
            zIndex: total - index,
            borderRadius: "var(--wiki-radius-card, 20px)",
            border: "var(--wiki-card-border, none)",
            boxShadow: "var(--wiki-card-shadow, none)",
          }}
        >
          <div className="flex h-full min-h-[120px] items-center justify-between p-8">
            <div>
              <p
                className="text-lg font-semibold"
                style={{ color: "var(--wiki-text)" }}
              >
                Level {surface.level} — {surface.name}
              </p>
              <p
                className="mt-1 font-mono text-sm"
                style={{ color: "var(--wiki-muted)" }}
              >
                {surface.value}
              </p>
            </div>
            <p
              className="max-w-md text-right text-sm"
              style={{ color: "var(--wiki-muted)" }}
            >
              {surface.purpose}
            </p>
          </div>
        </div>
      </InspectablePreview>
      {docFileName ? (
        <ShareBlockPanel
          docFileName={docFileName}
          blockKind="surface"
          blockId={blockId}
          blockTitle={title}
        />
      ) : null}
    </div>
  );
}
