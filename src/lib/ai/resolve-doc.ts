import { join, basename, normalize, relative } from "path";

const DESIGNS_ROOT = join(process.cwd(), "docs/designs.md");

export function safeResolveDocPath(fileName: string): string {
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

export function validateDocFileName(fileName: unknown): string {
  if (typeof fileName !== "string" || !fileName.trim()) {
    throw new Error("doc is required");
  }
  return basename(fileName.trim());
}
