"use client";

import type { ComponentDoc, DesignSystem } from "@/lib/blocks/types";
import {
  buildPreviewContextFromIR,
  buildPreviewContextFromSystem,
  parseComponentPreviewSpec,
} from "@/ai-lab/04-component-previews";
import { PretextComponentView } from "@blocksmith/pretext-components/react";
import { toComponentSpec } from "@/lib/pretext-components/adapter";
import { useDesignIROptional } from "@/lib/design-ir/context";

/** Renders live preview via @blocksmith/pretext-components (Pretext text layout). */
export function ComponentLivePreview({
  component,
  system,
}: {
  component: ComponentDoc;
  system: DesignSystem;
}) {
  const ir = useDesignIROptional();
  const ctx = ir ? buildPreviewContextFromIR(ir) : buildPreviewContextFromSystem(system);
  const spec = parseComponentPreviewSpec(component, ctx);

  return (
    <PretextComponentView
      component={component}
      spec={toComponentSpec(spec)}
    />
  );
}
