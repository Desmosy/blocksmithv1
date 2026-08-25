import "server-only";

import { mkdir, readFile, stat, writeFile } from "fs/promises";
import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { supabaseStorageEnabled } from "@/lib/supabase/env";
import {
  supabaseDeleteMarkdown,
  supabaseDownloadMarkdown,
  supabaseListMarkdown,
  supabaseUploadMarkdown,
} from "@/lib/supabase/storage";
import { rm } from "fs/promises";
import { resolveUploadPath, safeUploadFileName } from "./store";

const UPLOADS_ROOT = join(process.cwd(), "data/uploads");

type CachedUpload = {
  markdown: string;
  mtimeMs: number;
  savedAt: string;
};

/** In-memory layer — required on Vercel where disk is ephemeral */
const memory = new Map<string, CachedUpload>();

export function getUploadMemoryCache(fileName: string): CachedUpload | null {
  return memory.get(safeUploadFileName(fileName)) ?? null;
}

export async function persistUploadMarkdown(
  fileName: string,
  markdown: string,
): Promise<{ bytes: number; savedAt: string; backend: "supabase" | "local" | "both" }> {
  const safe = safeUploadFileName(fileName);
  const savedAt = new Date().toISOString();
  const bytes = Buffer.byteLength(markdown, "utf-8");

  memory.set(safe, { markdown, mtimeMs: Date.now(), savedAt });

  let backend: "supabase" | "local" | "both" = "local";

  if (supabaseStorageEnabled()) {
    await supabaseUploadMarkdown(safe, markdown);
    backend = "supabase";
  }

  try {
    await mkdir(UPLOADS_ROOT, { recursive: true });
    await writeFile(resolveUploadPath(safe), markdown, "utf-8");
    backend = backend === "supabase" ? "both" : "local";
  } catch {
    /* Vercel — local mirror optional */
  }

  return { bytes, savedAt, backend };
}

/** Delete an upload everywhere it lives: memory cache, local mirror, Supabase. */
export async function deleteUploadMarkdown(fileName: string): Promise<void> {
  const safe = safeUploadFileName(fileName);
  memory.delete(safe);
  if (supabaseStorageEnabled()) {
    try {
      await supabaseDeleteMarkdown(safe);
    } catch {
      /* best-effort — record removal hides it from listings regardless */
    }
  }
  try {
    await rm(resolveUploadPath(safe), { force: true });
  } catch {
    /* already gone */
  }
}

/** Ensure upload is in memory (and local cache when possible) before sync reads */
export async function hydrateUploadMarkdown(fileName: string): Promise<void> {
  const safe = safeUploadFileName(fileName);
  if (memory.has(safe)) return;

  const localPath = resolveUploadPath(safe);
  if (existsSync(localPath)) {
    const md = await readFile(localPath, "utf-8");
    const st = await stat(localPath);
    memory.set(safe, {
      markdown: md,
      mtimeMs: st.mtimeMs,
      savedAt: st.mtime.toISOString(),
    });
    return;
  }

  if (supabaseStorageEnabled()) {
    const md = await supabaseDownloadMarkdown(safe);
    memory.set(safe, {
      markdown: md,
      mtimeMs: Date.now(),
      savedAt: new Date().toISOString(),
    });
    try {
      await mkdir(UPLOADS_ROOT, { recursive: true });
      await writeFile(localPath, md, "utf-8");
    } catch {
      /* ignore */
    }
  }
}

export async function readUploadMarkdownContent(fileName: string): Promise<string> {
  await hydrateUploadMarkdown(fileName);
  const cached = memory.get(safeUploadFileName(fileName));
  if (cached) return cached.markdown;
  return readFile(resolveUploadPath(fileName), "utf-8");
}

export function readUploadMarkdownSync(fileName: string): string {
  const safe = safeUploadFileName(fileName);
  const cached = memory.get(safe);
  if (cached) return cached.markdown;
  const localPath = resolveUploadPath(safe);
  if (!existsSync(localPath)) {
    throw new Error(
      `Upload not cached: ${safe}. Call hydrateUploadMarkdown() first (Supabase: ${supabaseStorageEnabled()})`,
    );
  }
  return readFileSync(localPath, "utf-8");
}

export function uploadMtimeMs(fileName: string): number {
  const safe = safeUploadFileName(fileName);
  const cached = memory.get(safe);
  if (cached) return cached.mtimeMs;
  return statSync(resolveUploadPath(safe)).mtimeMs;
}

export async function listUploadMetasFromBackend(): Promise<
  { fileName: string; bytes: number; savedAt: string }[]
> {
  if (supabaseStorageEnabled()) {
    try {
      return await supabaseListMarkdown();
    } catch {
      /* fall through */
    }
  }
  const { readdir } = await import("fs/promises");
  await mkdir(UPLOADS_ROOT, { recursive: true });
  const files = (await readdir(UPLOADS_ROOT)).filter((f) => f.endsWith(".md"));
  const rows = [];
  for (const fileName of files) {
    const st = await stat(join(UPLOADS_ROOT, fileName));
    rows.push({
      fileName,
      bytes: st.size,
      savedAt: st.mtime.toISOString(),
    });
  }
  return rows.sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
  );
}
