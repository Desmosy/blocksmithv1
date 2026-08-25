import "server-only";

import { readFileSync } from "fs";
import {
  loadDesignSystem,
  prepareDesignSystemDoc,
  type LoadedDesignSystem,
} from "@/lib/clients/registry";
import { resolveDesignMarkdownPath } from "@/lib/ai/resolve-design-doc";
import { readUploadMarkdownContent } from "@/lib/uploads/persist";
import {
  isUploadDocRef,
  uploadFileNameFromRef,
} from "@/lib/uploads/store";

/**
 * Load doc for AI ensemble on serverless — hydrates Supabase uploads first.
 * (Wiki uses the same path via prepareDesignSystemDoc + loadDesignSystem.)
 */
export async function loadEnsembleDoc(docRef: string): Promise<{
  system: LoadedDesignSystem;
  markdown: string;
}> {
  await prepareDesignSystemDoc(docRef);
  const system = loadDesignSystem(docRef);

  const markdown = isUploadDocRef(docRef)
    ? await readUploadMarkdownContent(uploadFileNameFromRef(docRef))
    : readFileSync(resolveDesignMarkdownPath(docRef), "utf-8");

  return { system, markdown };
}
