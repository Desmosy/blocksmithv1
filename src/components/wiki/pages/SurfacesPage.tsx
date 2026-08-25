import type { DesignSystem } from "@/lib/blocks/types";
import { SurfaceLevelCard } from "../visual/SurfaceLevelCard";
import { PageHeader, type SectionEditProps } from "./PageHeader";

export function SurfacesPage({
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
    <article className="apollo-preview">
      <PageHeader
        title="Surfaces"
        description="Stacked elevation levels — visual surface hierarchy."
        status="draft"
        updatedAt={system.updatedAt}
        source={meta?.sourceLabel}
        sectionEdit={sectionEdit}
      />

      <div className="mt-10 space-y-8">
        {system.surfaces.map((s, i) => (
          <SurfaceLevelCard
            key={`${s.level}-${s.name}`}
            surface={s}
            index={i}
            total={system.surfaces.length}
            docFileName={docFileName}
          />
        ))}
      </div>
    </article>
  );
}
