import "server-only";

import { existsSync } from "fs";
import { join } from "path";
import { supabaseStorageEnabled } from "@/lib/supabase/env";

const DESIGNS_ROOT = join(process.cwd(), "docs/designs.md");

/** Enforce auth + doc ownership on mutating routes. Default: strict in production. */
export function saasStrictMode(): boolean {
  if (process.env.BLOCKSMITH_SAAS_STRICT === "0") return false;
  if (process.env.BLOCKSMITH_SAAS_STRICT === "1") return true;
  return process.env.NODE_ENV === "production";
}

/** Postgres tables for ownership + API keys (uses same Supabase project as storage). */
export function saasDbEnabled(): boolean {
  return supabaseStorageEnabled();
}

/** Vercel/serverless has a read-only app filesystem — cloud tables only. */
export function localCloudStoreWritable(): boolean {
  if (process.env.VERCEL === "1") return false;
  return true;
}

export function isPublicDemoDocument(fileName: string): boolean {
  return fileName === "scan-acme-ui-kit.md";
}

/**
 * Bundled sample docs shipped in the repo (docs/designs.md/*, e.g. apollo.md)
 * are public marketing/demo content — never customer IP. Uploads live under
 * data/uploads/ and always carry a hash suffix, so they can never spoof a
 * bundled name.
 */
export function isBundledSampleDoc(fileName: string): boolean {
  const safe = fileName.replace(/[\\/]/g, "");
  if (safe !== fileName) return false;
  if (safe.includes("..")) return false;
  if (!safe.toLowerCase().endsWith(".md")) return false;
  try {
    return existsSync(join(DESIGNS_ROOT, safe));
  } catch {
    return false;
  }
}

/**
 * The only documents readable without authentication: the named demo doc and
 * bundled repo samples. Everything else (uploads, GitHub scans) is private and
 * subject to default-deny ownership checks.
 */
/**
 * A system captured from a public website. It contains only values that site
 * already serves publicly, so viewing one needs no account — and the capture
 * flow is the main thing a first-time visitor comes to try.
 */
export function isCapturedDocument(fileName: string): boolean {
  return /^capture-[a-z0-9-]+\.md$/i.test(fileName);
}

export function isPublicContent(fileName: string): boolean {
  return (
    isPublicDemoDocument(fileName) ||
    isCapturedDocument(fileName) ||
    isBundledSampleDoc(fileName)
  );
}
