import "server-only";

import { getSupabaseAdmin } from "./server";
import { supabaseStorageEnabled } from "./env";

export const SCAN_DOCS_BUCKET = "scan-docs";

export type StoredObjectMeta = {
  fileName: string;
  bytes: number;
  savedAt: string;
};

function storagePath(fileName: string): string {
  return `uploads/${fileName}`;
}

export async function supabaseUploadMarkdown(
  fileName: string,
  markdown: string,
): Promise<StoredObjectMeta> {
  const sb = getSupabaseAdmin();
  const body = Buffer.from(markdown, "utf-8");
  const { error } = await sb.storage
    .from(SCAN_DOCS_BUCKET)
    .upload(storagePath(fileName), body, {
      contentType: "text/markdown",
      upsert: true,
    });
  if (error) throw new Error(`Supabase upload failed: ${error.message}`);
  return {
    fileName,
    bytes: body.length,
    savedAt: new Date().toISOString(),
  };
}

export async function supabaseDownloadMarkdown(fileName: string): Promise<string> {
  return supabaseDownloadBlob(fileName);
}

export async function supabaseDeleteMarkdown(fileName: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.storage
    .from(SCAN_DOCS_BUCKET)
    .remove([storagePath(fileName)]);
  if (error) throw new Error(`Supabase delete failed: ${error.message}`);
}

export async function supabaseUploadBlob(
  fileName: string,
  content: string,
  contentType: string,
): Promise<StoredObjectMeta> {
  const sb = getSupabaseAdmin();
  const body = Buffer.from(content, "utf-8");
  const { error } = await sb.storage
    .from(SCAN_DOCS_BUCKET)
    .upload(storagePath(fileName), body, {
      contentType,
      upsert: true,
    });
  if (error) throw new Error(`Supabase upload failed: ${error.message}`);
  return {
    fileName,
    bytes: body.length,
    savedAt: new Date().toISOString(),
  };
}

export async function supabaseDownloadBlob(fileName: string): Promise<string> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.storage
    .from(SCAN_DOCS_BUCKET)
    .download(storagePath(fileName));
  if (error || !data) {
    throw new Error(`Supabase download failed: ${error?.message ?? fileName}`);
  }
  return data.text();
}

export async function supabaseListMarkdown(): Promise<StoredObjectMeta[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.storage.from(SCAN_DOCS_BUCKET).list("uploads", {
    limit: 500,
    sortBy: { column: "updated_at", order: "desc" },
  });
  if (error) throw new Error(`Supabase list failed: ${error.message}`);
  const rows: StoredObjectMeta[] = [];
  for (const item of data ?? []) {
    if (!item.name.endsWith(".md")) continue;
    rows.push({
      fileName: item.name,
      bytes: item.metadata?.size ?? 0,
      savedAt: item.updated_at ?? item.created_at ?? new Date().toISOString(),
    });
  }
  return rows;
}

export async function supabaseStorageHealth(): Promise<{
  ok: boolean;
  bucket: string;
  message?: string;
}> {
  if (!supabaseStorageEnabled()) {
    return { ok: false, bucket: SCAN_DOCS_BUCKET, message: "env not set" };
  }
  try {
    const sb = getSupabaseAdmin();
    const { error } = await sb.storage.from(SCAN_DOCS_BUCKET).list("uploads", {
      limit: 1,
    });
    if (error?.message?.includes("not found")) {
      return {
        ok: false,
        bucket: SCAN_DOCS_BUCKET,
        message: `Bucket '${SCAN_DOCS_BUCKET}' missing — run supabase/setup.sql`,
      };
    }
    if (error) {
      return { ok: false, bucket: SCAN_DOCS_BUCKET, message: error.message };
    }
    return { ok: true, bucket: SCAN_DOCS_BUCKET };
  } catch (e) {
    return {
      ok: false,
      bucket: SCAN_DOCS_BUCKET,
      message: e instanceof Error ? e.message : "unknown error",
    };
  }
}
