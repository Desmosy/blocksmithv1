import type { DesignSystem } from "@/lib/blocks/types";
import { PageHeader, type SectionEditProps } from "./PageHeader";

export function ImageryPage({
  system,
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
    </article>
  );
}
