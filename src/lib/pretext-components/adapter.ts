import {
  composeGallery,
  type ComponentDoc,
  type ComponentSpec,
  type GalleryComposition,
} from "@blocksmith/pretext-components";
import {
  buildPreviewContextFromIR,
  parseComponentPreviewSpec,
  type ComponentPreviewSpec,
} from "@/ai-lab/04-component-previews";
import type { LoadedDesignSystem } from "@/lib/clients/registry";
import type { DesignIR } from "@/lib/design-ir/schema";
import type { ComponentDoc as BlockComponentDoc } from "@/lib/blocks/types";

function toPackageDoc(component: BlockComponentDoc): ComponentDoc {
  return {
    id: component.id,
    title: component.title,
    role: component.role,
    description: component.description,
  };
}

/** ComponentPreviewSpec matches ComponentSpec shape — pass through for the spin-off renderer. */
export function toComponentSpec(spec: ComponentPreviewSpec): ComponentSpec {
  return spec;
}

export function buildComponentGallery(
  ir: DesignIR,
  system: LoadedDesignSystem,
): GalleryComposition {
  const ctx = buildPreviewContextFromIR(ir);
  const items = system.components.map((component) => ({
    component: toPackageDoc(component),
    spec: toComponentSpec(parseComponentPreviewSpec(component, ctx)),
  }));

  const maxWidth = parseInt(
    ir.wikiChrome.cssVariables["--wiki-content-max"] ?? "960",
    10,
  );

  return composeGallery({
    systemName: system.name,
    docRef: ir.docRef,
    previewBg: ir.preview.pageBackground,
    maxWidth: Number.isFinite(maxWidth) ? maxWidth : 960,
    items,
  });
}
