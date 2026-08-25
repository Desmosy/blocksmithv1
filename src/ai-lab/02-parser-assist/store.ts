import "server-only";

import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { join } from "path";

const ROOT = join(process.cwd(), ".blocksmith", "ai-lab", "normalized");

function safeDocKey(docRef: string): string {
  return docRef.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function normalizedPath(docRef: string, contentHash: string): string {
  return join(ROOT, safeDocKey(docRef), `${contentHash}.md`);
}

function metaPath(docRef: string, contentHash: string): string {
  return join(ROOT, safeDocKey(docRef), `${contentHash}.meta.json`);
}

export function loadNormalizedMarkdown(
  docRef: string,
  contentHash: string,
): string | null {
  const path = normalizedPath(docRef, contentHash);
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

export function persistNormalizedMarkdown(
  docRef: string,
  contentHash: string,
  markdown: string,
  meta: { model: string; sourceBytes: number },
): void {
  const dir = join(ROOT, safeDocKey(docRef));
  mkdirSync(dir, { recursive: true });
  writeFileSync(normalizedPath(docRef, contentHash), markdown, "utf-8");
  writeFileSync(
    metaPath(docRef, contentHash),
    JSON.stringify({ ...meta, docRef, contentHash, at: new Date().toISOString() }, null, 2),
    "utf-8",
  );
}

/**
 * Remove every cached AI-normalized rewrite for a doc.
 *
 * Used to self-heal docs that were squashed into the Apollo skeleton by an
 * earlier build before comprehensive-wiki detection existed: the poisoned
 * rewrite must not survive on disk, or a future regression could resurrect it.
 */
export function purgeNormalizedMarkdown(docRef: string): boolean {
  const dir = join(ROOT, safeDocKey(docRef));
  if (!existsSync(dir)) return false;
  try {
    rmSync(dir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

export function loadNormalizedMeta(
  docRef: string,
  contentHash: string,
): { model: string } | null {
  const path = metaPath(docRef, contentHash);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as { model: string };
  } catch {
    return null;
  }
}
