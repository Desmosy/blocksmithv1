import type { DesignSystem } from "@/lib/blocks/types";
import { PageHeader, type SectionEditProps } from "./PageHeader";

export function LayoutPage({
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
        title="Layout"
        description="Layout guidelines and page grid structures."
        status="draft"
        updatedAt={system.updatedAt}
        source={meta?.sourceLabel}
        sectionEdit={sectionEdit}
      />
      <p className="mt-6 max-w-2xl text-sm leading-relaxed text-[var(--wiki-muted)] whitespace-pre-wrap">
        {system.layoutNotes}
      </p>
    </article>
  );
}
