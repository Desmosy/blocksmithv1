import type { ComponentDoc } from "@/lib/blocks/types";

/** Known wiki showcase components that ship inside this BlockSmith app. */
const LOCAL_PREVIEW_SOURCES: Record<string, string> = {
  buttonpreview: "src/components/wiki/ButtonPreview.tsx",
  colorswatchcard: "src/components/wiki/visual/ColorSwatchCard.tsx",
  demobutton: "src/components/wiki/pages/demo/DemoButton.tsx",
  fontspecimen: "src/components/wiki/visual/FontSpecimen.tsx",
  surfacelevelcard: "src/components/wiki/visual/SurfaceLevelCard.tsx",
  typescalepreview: "src/components/wiki/visual/TypeScalePreview.tsx",
};

export function canRenderLocalScannedPreview(component: ComponentDoc): boolean {
  if (!component.scan?.sourceFile) return false;
  const expected = LOCAL_PREVIEW_SOURCES[component.id];
  return expected === component.scan.sourceFile;
}

export function listLocalPreviewComponentIds(): string[] {
  return Object.keys(LOCAL_PREVIEW_SOURCES);
}
