import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import {
  blocksmithWritableRoot,
  skipLocalScanAudit,
} from "@/lib/runtime/writable-root";

function factsRoot(): string {
  return join(blocksmithWritableRoot(), "scan-facts");
}

function curatedRoot(): string {
  return join(blocksmithWritableRoot(), "ai-lab", "scan-curated");
}

export function persistScanFacts(fileName: string, markdown: string): string {
  if (skipLocalScanAudit()) return "";
  try {
    const root = factsRoot();
    mkdirSync(root, { recursive: true });
    const path = join(root, fileName.replace(/\.md$/, "-facts.md"));
    writeFileSync(path, markdown, "utf-8");
    return path;
  } catch {
    return "";
  }
}

export function loadCuratedScan(
  docRef: string,
  contentHash: string,
): string | null {
  if (skipLocalScanAudit()) return null;
  const path = join(curatedRoot(), safeKey(docRef), `${contentHash}.md`);
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

export function persistCuratedScan(
  docRef: string,
  contentHash: string,
  markdown: string,
  meta: { model: string; factsBytes: number },
): void {
  if (skipLocalScanAudit()) return;
  const dir = join(curatedRoot(), safeKey(docRef));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${contentHash}.md`), markdown, "utf-8");
  writeFileSync(
    join(dir, `${contentHash}.meta.json`),
    JSON.stringify({ ...meta, docRef, contentHash, at: new Date().toISOString() }, null, 2),
    "utf-8",
  );
}

function safeKey(docRef: string): string {
  return docRef.replace(/[^a-zA-Z0-9._-]/g, "_");
}
