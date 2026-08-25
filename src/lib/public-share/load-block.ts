import { loadDesignSystem } from "@/lib/clients/registry";
import type { ColorToken, ComponentDoc, SurfaceRow } from "@/lib/blocks/types";
import type { PublicShareRecord } from "./types";
import { colorBlockId, surfaceBlockId } from "./block-ids";

export type PublicBlockPayload =
  | { kind: "component"; component: ComponentDoc }
  | { kind: "surface"; surface: SurfaceRow }
  | { kind: "color"; color: ColorToken };

export function loadPublicBlock(
  share: PublicShareRecord,
): PublicBlockPayload | null {
  let system;
  try {
    system = loadDesignSystem(share.docFileName);
  } catch {
    return null;
  }

  if (share.blockKind === "component") {
    const component = system.components.find((c) => c.id === share.blockId);
    return component ? { kind: "component", component } : null;
  }

  if (share.blockKind === "surface") {
    const surface = system.surfaces.find(
      (s) => surfaceBlockId(s.level, s.name) === share.blockId,
    );
    return surface ? { kind: "surface", surface } : null;
  }

  if (share.blockKind === "color") {
    const color = system.colors.find(
      (c) => colorBlockId(c.cssVar) === share.blockId,
    );
    return color ? { kind: "color", color } : null;
  }

  return null;
}
