import type { GalleryComposition, GalleryItem } from "./types";

export function composeGallery(input: {
  systemName: string;
  docRef: string;
  previewBg: string;
  maxWidth?: number;
  items: GalleryItem[];
}): GalleryComposition {
  return {
    systemName: input.systemName,
    docRef: input.docRef,
    previewBg: input.previewBg,
    maxWidth: input.maxWidth ?? 960,
    items: input.items,
  };
}
