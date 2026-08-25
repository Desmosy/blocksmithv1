import type { DesignSystem } from "@/lib/blocks/types";
import type { DesignIR } from "@/lib/design-ir/schema";
import {
  buildPreviewContextFromIR,
  classifyComponentKind,
  parseComponentPreviewSpec,
} from "@/ai-lab/04-component-previews";

/**
 * A compact fingerprint of a design system version — enough to detect drift
 * (what changed token-to-token, component-to-component) between two doc
 * revisions, without storing the whole IR.
 */
export type ComponentSig = {
  title: string;
  kind: string;
  fill: string;
  text: string;
  radius: string;
};

export type SystemSnapshot = {
  contentHash: string;
  updatedAt: string;
  name: string;
  colors: Record<string, string>;
  fonts: string[];
  components: Record<string, ComponentSig>;
};

export function buildSystemSnapshot(
  system: DesignSystem,
  ir: DesignIR,
): SystemSnapshot {
  const ctx = buildPreviewContextFromIR(ir);
  const components: Record<string, ComponentSig> = {};
  for (const c of system.components) {
    const spec = parseComponentPreviewSpec(c, ctx);
    components[c.id] = {
      title: c.title,
      kind: classifyComponentKind(c),
      fill: spec.backgroundColor,
      text: spec.color,
      radius: spec.borderRadius,
    };
  }

  return {
    contentHash: system.contentHash ?? "",
    updatedAt: system.updatedAt,
    name: system.name,
    colors: Object.fromEntries(system.colors.map((c) => [c.name, c.value])),
    fonts: system.typography.map((t) => t.name),
    components,
  };
}

export type ColorChange = { name: string; before: string; after: string };
export type ComponentFieldChange = {
  id: string;
  title: string;
  field: keyof ComponentSig;
  before: string;
  after: string;
};

export type SystemDiff = {
  colors: { added: string[]; removed: string[]; changed: ColorChange[] };
  components: {
    added: string[];
    removed: string[];
    changed: ComponentFieldChange[];
  };
  hasChanges: boolean;
};

function keysDiff(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
): { added: string[]; removed: string[]; common: string[] } {
  const added = Object.keys(next).filter((k) => !(k in prev));
  const removed = Object.keys(prev).filter((k) => !(k in next));
  const common = Object.keys(next).filter((k) => k in prev);
  return { added, removed, common };
}

export function diffSnapshots(
  prev: SystemSnapshot,
  next: SystemSnapshot,
): SystemDiff {
  const colorKeys = keysDiff(prev.colors, next.colors);
  const colorChanged: ColorChange[] = colorKeys.common
    .filter((name) => prev.colors[name] !== next.colors[name])
    .map((name) => ({ name, before: prev.colors[name], after: next.colors[name] }));

  const compKeys = keysDiff(prev.components, next.components);
  const compChanged: ComponentFieldChange[] = [];
  for (const id of compKeys.common) {
    const a = prev.components[id];
    const b = next.components[id];
    (Object.keys(b) as (keyof ComponentSig)[]).forEach((field) => {
      if (a[field] !== b[field]) {
        compChanged.push({
          id,
          title: b.title,
          field,
          before: String(a[field]),
          after: String(b[field]),
        });
      }
    });
  }

  const colors = {
    added: colorKeys.added,
    removed: colorKeys.removed,
    changed: colorChanged,
  };
  const components = {
    added: compKeys.added.map((id) => next.components[id].title),
    removed: compKeys.removed.map((id) => prev.components[id].title),
    changed: compChanged,
  };

  const hasChanges =
    colors.added.length +
      colors.removed.length +
      colors.changed.length +
      components.added.length +
      components.removed.length +
      components.changed.length >
    0;

  return { colors, components, hasChanges };
}
