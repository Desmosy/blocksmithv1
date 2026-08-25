import { loadDesignSystem } from "@/lib/clients/registry";
import type { DocBlockIndex } from "./content";
import {
  persistBlocksForDoc,
  getBlockStoreIndex,
} from "./store";

/** Parse doc from disk and persist blocks — wiki + MCP share the result. */
export function refreshBlocksForDoc(
  docRef: string,
  editedBy: "web" | "ide" | "mcp" | "ingest" = "ingest",
): DocBlockIndex {
  const system = loadDesignSystem(docRef);
  return persistBlocksForDoc(docRef, system, editedBy);
}

/** Ensure blocks exist on disk (MCP cold start without opening wiki). */
export function ensureDocBlocks(docRef: string): DocBlockIndex {
  const index = getBlockStoreIndex();
  if (index.docs[docRef]?.blockCount) {
    return index.docs[docRef];
  }
  return refreshBlocksForDoc(docRef);
}
