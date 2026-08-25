import type { PublicBlockPayload } from "@/lib/public-share/load-block";
import type { DesignSystem } from "@/lib/blocks/types";
import { ComponentLivePreview } from "@/components/wiki/visual/ComponentLivePreview";

export function PublicBlockPreview({
  block,
  system,
}: {
  block: PublicBlockPayload;
  system: DesignSystem;
}) {
  if (block.kind === "component") {
    return (
      <ComponentLivePreview component={block.component} system={system} />
    );
  }

  if (block.kind === "surface") {
    const s = block.surface;
    return (
      <div
        className="overflow-hidden rounded-2xl border border-black/10 shadow-md"
        style={{
          backgroundColor: s.value,
          minHeight: 160,
        }}
      >
        <div className="flex h-full min-h-[160px] flex-col justify-center p-8">
          <p className="text-lg font-semibold text-[var(--color-midnight-ink,#000)]">
            Level {s.level} — {s.name}
          </p>
          <p className="mt-1 font-mono text-sm opacity-70">{s.value}</p>
          <p className="mt-3 max-w-lg text-sm text-[var(--color-charcoal-text,#47423d)]">
            {s.purpose}
          </p>
        </div>
      </div>
    );
  }

  const c = block.color;
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--wiki-border)]">
      <div
        className="flex h-40 items-end p-6"
        style={{ backgroundColor: c.value }}
      >
        <span className="font-mono text-sm font-semibold text-black/80">
          {c.value}
        </span>
      </div>
      <div className="bg-[var(--wiki-bg)] p-6">
        <p className="font-semibold">{c.name}</p>
        <p className="mt-1 font-mono text-xs text-[var(--wiki-muted)]">
          {c.cssVar}
        </p>
        <p className="mt-2 text-sm text-[var(--wiki-muted)]">{c.role}</p>
      </div>
    </div>
  );
}
