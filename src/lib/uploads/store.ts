import { createHash } from "crypto";
import { mkdir } from "fs/promises";
import { basename } from "path";
import { persistUploadMarkdown, listUploadMetasFromBackend } from "./persist";
import {
  UPLOAD_DOC_PREFIX,
  isUploadDocRef,
  resolveUploadPath,
  safeUploadFileName,
  uploadFileNameFromRef,
  uploadsRoot,
} from "./paths";

export {
  UPLOAD_DOC_PREFIX,
  isUploadDocRef,
  resolveUploadPath,
  safeUploadFileName,
  uploadFileNameFromRef,
} from "./paths";

const UPLOADS_ROOT = uploadsRoot();

export interface SavedUpload {
  docRef: string;
  fileName: string;
  label: string;
  bytes: number;
  savedAt: string;
}

async function uploadsDir(): Promise<void> {
  try {
    await mkdir(UPLOADS_ROOT, { recursive: true });
  } catch {
    /* Vercel — markdown persists to Supabase; local dir optional */
  }
}

function sanitizeBaseName(name: string): string {
  const base = basename(name).replace(/\.md$/i, "");
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return slug || "design";
}

export async function saveMarkdownUpload(
  markdown: string,
  preferredName?: string,
): Promise<SavedUpload> {
  if (!markdown.trim()) {
    throw new Error("Markdown is empty");
  }
  if (markdown.length > 2_000_000) {
    throw new Error("File is too large (max 2MB)");
  }

  await uploadsDir();

  const hash = createHash("sha256").update(markdown).digest("hex").slice(0, 8);
  const base = sanitizeBaseName(preferredName ?? "design");
  const fileName = `${base}-${hash}.md`;

  const { bytes, savedAt } = await persistUploadMarkdown(fileName, markdown);

  return {
    docRef: `${UPLOAD_DOC_PREFIX}${fileName}`,
    fileName,
    label: preferredName?.replace(/\.md$/i, "") ?? base,
    bytes,
    savedAt,
  };
}

export async function listUploads(): Promise<SavedUpload[]> {
  const rows = await listUploadMetasFromBackend();
  return rows.map((row) => ({
    docRef: `${UPLOAD_DOC_PREFIX}${row.fileName}`,
    fileName: row.fileName,
    label: row.fileName.replace(/-[a-f0-9]{8}\.md$/i, "").replace(/-/g, " "),
    bytes: row.bytes,
    savedAt: row.savedAt,
  }));
}

export async function readUploadMarkdown(docRef: string): Promise<string> {
  const fileName = uploadFileNameFromRef(docRef);
  const { readUploadMarkdownContent } = await import("./persist");
  return readUploadMarkdownContent(fileName);
}
