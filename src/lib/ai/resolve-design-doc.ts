import { readFileSync } from "fs";
import { join, basename, normalize, relative } from "path";
import {
  isUploadDocRef,
  uploadFileNameFromRef,
  resolveUploadPath,
} from "@/lib/uploads/store";
import { loadDesignSystem, type LoadedDesignSystem } from "@/lib/clients/registry";

const DESIGNS_ROOT = join(process.cwd(), "docs/designs.md");

function safeResolveRepoDoc(fileName: string): string {
  const normalized = normalize(fileName).replace(/^(\.\.(\/|\\|$))+/, "");
  if (normalized.includes("..") || normalized.includes("/") || normalized.includes("\\")) {
    throw new Error("Invalid document name");
  }
  if (!normalized.toLowerCase().endsWith(".md")) {
    throw new Error("Only .md files are supported");
  }
  const full = join(DESIGNS_ROOT, normalized);
  const rel = relative(DESIGNS_ROOT, full);
  if (rel.startsWith("..") || rel.includes("..")) {
    throw new Error("Path escapes designs directory");
  }
  return full;
}

/** Repo file name (`apollo.md`) or upload ref (`upload:foo.md`). */
export function validateDocRef(doc: unknown): string {
  if (typeof doc !== "string" || !doc.trim()) {
    throw new Error("doc is required");
  }
  const ref = doc.trim();
  if (isUploadDocRef(ref)) {
    uploadFileNameFromRef(ref);
    return ref;
  }
  return basename(ref);
}

export function resolveDesignMarkdownPath(docRef: string): string {
  if (isUploadDocRef(docRef)) {
    return resolveUploadPath(uploadFileNameFromRef(docRef));
  }
  return safeResolveRepoDoc(docRef);
}

export function loadDesignDocForAi(docRef: string): {
  system: LoadedDesignSystem;
  markdown: string;
} {
  const ref = validateDocRef(docRef);
  const system = loadDesignSystem(ref);
  const markdown = readFileSync(resolveDesignMarkdownPath(ref), "utf-8");
  return { system, markdown };
}
