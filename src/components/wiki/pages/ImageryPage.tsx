import type { DesignSystem } from "@/lib/blocks/types";
import { PageHeader, type SectionEditProps } from "./PageHeader";
import { GraphicsKit } from "@/components/wiki/GraphicsKit";

export function ImageryPage({
  system,
  docFileName,
  meta,
  sectionEdit,
}: {
  system: DesignSystem;
  docFileName?: string;
  meta?: any;
  sectionEdit?: SectionEditProps;
}) {
  return (
    <article>
      <PageHeader
        title="Imagery"
        description="Art direction, illustration style, and photography rules."
        status="draft"
        updatedAt={system.updatedAt}
        source={meta?.sourceLabel}
        sectionEdit={sectionEdit}
      />
      <p className="mt-6 max-w-2xl text-sm leading-relaxed text-[var(--wiki-muted)]">
        {system.imagery}
      </p>
      <GraphicsKit system={system} docFileName={docFileName} />
    </article>
  );
}
