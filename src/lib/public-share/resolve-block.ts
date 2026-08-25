import { loadDesignSystem } from "@/lib/clients/registry";
import { colorBlockId, surfaceBlockId } from "./block-ids";
import type { CreateShareInput } from "./types";

export { colorBlockId, surfaceBlockId } from "./block-ids";
export { isShareBlockKind } from "./block-ids";

export interface ResolvedBlock {
  blockTitle: string;
  systemName: string;
  contentHash: string;
}

export function resolveBlock(input: CreateShareInput): ResolvedBlock {
  const system = loadDesignSystem(input.docFileName);

  if (input.blockKind === "component") {
    const component = system.components.find((c) => c.id === input.blockId);
    if (!component) {
      throw new Error(`Component not found: ${input.blockId}`);
    }
    return {
      blockTitle: component.title,
      systemName: system.name,
      contentHash: system.contentHash ?? "",
    };
  }

  if (input.blockKind === "surface") {
    const surface = system.surfaces.find(
      (s) => surfaceBlockId(s.level, s.name) === input.blockId,
    );
    if (!surface) {
      throw new Error(`Surface not found: ${input.blockId}`);
    }
    return {
      blockTitle: `Level ${surface.level} — ${surface.name}`,
      systemName: system.name,
      contentHash: system.contentHash ?? "",
    };
  }

  if (input.blockKind === "color") {
    const color = system.colors.find((c) => colorBlockId(c.cssVar) === input.blockId);
    if (!color) {
      throw new Error(`Color token not found: ${input.blockId}`);
    }
    return {
      blockTitle: color.name,
      systemName: system.name,
      contentHash: system.contentHash ?? "",
    };
  }

  throw new Error(`Unsupported block kind: ${input.blockKind as string}`);
}
