import type { DesignSystem } from "@/lib/blocks/types";
import {
  buildPreviewContextFromSystem,
  classifyComponentKind,
  parseComponentPreviewSpec,
  type ComponentPreviewSpec,
} from "@/ai-lab/04-component-previews";

export type ParsedComponentStyles = ComponentPreviewSpec & {
  isButton: boolean;
  isInput: boolean;
  isCard: boolean;
};

/** Legacy adapter — previews now live in `src/ai-lab/04-component-previews/`. */
export function parseComponentStyles(
  component: { title: string; description: string; role: string },
  system: DesignSystem,
): ParsedComponentStyles {
  const ctx = buildPreviewContextFromSystem(system);
  const spec = parseComponentPreviewSpec(
    {
      id: "legacy",
      title: component.title,
      role: component.role,
      description: component.description,
    },
    ctx,
  );
  const kind = classifyComponentKind({
    id: "legacy",
    title: component.title,
    role: component.role,
    description: component.description,
  });

  return {
    ...spec,
    isButton: kind === "button",
    isInput: kind === "input",
    isCard: kind === "card",
  };
}
