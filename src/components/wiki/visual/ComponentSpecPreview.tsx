"use client";

import type { ComponentDoc, DesignSystem } from "@/lib/blocks/types";
import { ComponentLivePreview } from "./ComponentLivePreview";

/** @deprecated Use ComponentLivePreview — kept for imports. */
export function ComponentSpecPreview({
  component,
  system,
}: {
  component: ComponentDoc;
  system: DesignSystem;
}) {
  return <ComponentLivePreview component={component} system={system} />;
}
