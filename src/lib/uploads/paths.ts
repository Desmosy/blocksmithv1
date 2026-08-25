import { join, basename, normalize } from "path";

export const UPLOAD_DOC_PREFIX = "upload:";

const UPLOADS_ROOT = join(process.cwd(), "data/uploads");

export function isUploadDocRef(docRef: string): boolean {
  return docRef.startsWith(UPLOAD_DOC_PREFIX);
}

export function safeUploadFileName(fileName: string): string {
  const normalized = normalize(fileName).replace(/^(\.\.(\/|\\|$))+/, "");
  if (normalized.includes("..") || normalized.includes("/") || normalized.includes("\\")) {
    throw new Error("Invalid upload file name");
  }
  if (!normalized.toLowerCase().endsWith(".md")) {
    throw new Error("Upload must be a .md file");
  }
  if (!/^[\w.-]+\.md$/i.test(normalized)) {
    throw new Error("File name contains invalid characters");
  }
  return normalized;
}

export function uploadFileNameFromRef(docRef: string): string {
  if (!isUploadDocRef(docRef)) {
    throw new Error("Not an upload doc reference");
  }
  const name = docRef.slice(UPLOAD_DOC_PREFIX.length);
  return safeUploadFileName(name);
}

export function resolveUploadPath(fileName: string): string {
  return join(UPLOADS_ROOT, safeUploadFileName(fileName));
}

export function uploadsRoot(): string {
  return UPLOADS_ROOT;
}
