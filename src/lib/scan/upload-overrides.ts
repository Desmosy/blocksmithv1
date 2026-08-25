import "server-only";

import { existsSync, readFileSync, writeFileSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { modifyMarkdownBlock } from "@/lib/parser/modify";
import { hydrateUploadMarkdown } from "@/lib/uploads/persist";
import { resolveUploadPath, safeUploadFileName } from "@/lib/uploads/store";
import { type WikiOverrides, readWikiOverrides } from "./overrides";

const uploadsRoot = () => join(process.cwd(), "data/uploads");

const overrideMemory = new Map<string, WikiOverrides>();

export function uploadOverridesFileName(scanMdFileName: string): string {
  const safe = safeUploadFileName(scanMdFileName);
  return safe.replace(/\.md$/i, ".wiki-overrides.json");
}

function resolveOverridesPath(scanMdFileName: string): string {
  return join(uploadsRoot(), uploadOverridesFileName(scanMdFileName));
}

async function persistOverridesJson(
  scanMdFileName: string,
  overrides: WikiOverrides,
): Promise<void> {
  const safe = safeUploadFileName(scanMdFileName);
  const jsonName = uploadOverridesFileName(safe);
  overrideMemory.set(safe, overrides);

  const body = `${JSON.stringify(overrides, null, 2)}\n`;

  try {
    await mkdir(uploadsRoot(), { recursive: true });
    await writeFile(resolveOverridesPath(safe), body, "utf-8");
  } catch {
    /* Vercel — local mirror optional */
  }

  const { supabaseStorageEnabled } = await import("@/lib/supabase/env");
  if (supabaseStorageEnabled()) {
    try {
      const { supabaseUploadBlob } = await import("@/lib/supabase/storage");
      // Bucket allows text/plain — not application/json (see supabase/setup.sql)
      await supabaseUploadBlob(jsonName, body, "text/plain");
    } catch (err) {
      console.warn("[upload-overrides] Supabase sidecar upload failed:", err);
    }
  }
}

export async function readUploadWikiOverrides(
  scanMdFileName: string,
): Promise<WikiOverrides> {
  const safe = safeUploadFileName(scanMdFileName);
  const cached = overrideMemory.get(safe);
  if (cached) return cached;

  const localPath = resolveOverridesPath(safe);
  if (existsSync(localPath)) {
    try {
      const raw = JSON.parse(readFileSync(localPath, "utf-8")) as WikiOverrides;
      if (raw?.version === 1 && raw.components) {
        overrideMemory.set(safe, raw);
        return raw;
      }
    } catch {
      /* fall through */
    }
  }

  const { supabaseStorageEnabled } = await import("@/lib/supabase/env");
  if (supabaseStorageEnabled()) {
    try {
      const { supabaseDownloadBlob } = await import("@/lib/supabase/storage");
      const jsonName = uploadOverridesFileName(safe);
      const text = await supabaseDownloadBlob(jsonName);
      const raw = JSON.parse(text) as WikiOverrides;
      if (raw?.version === 1 && raw.components) {
        overrideMemory.set(safe, raw);
        return raw;
      }
    } catch {
      /* missing sidecar */
    }
  }

  return { version: 1, components: {} };
}

export async function setUploadComponentOverride(
  scanMdFileName: string,
  componentId: string,
  data: { role: string; description: string },
): Promise<WikiOverrides> {
  const overrides = await readUploadWikiOverrides(scanMdFileName);
  overrides.components[componentId] = {
    role: data.role,
    description: data.description,
    updatedAt: new Date().toISOString(),
  };
  await persistOverridesJson(scanMdFileName, overrides);
  return overrides;
}

/** Re-apply stored overrides into scan markdown body (survives rescan). */
export function applyUploadOverridesToMarkdown(
  markdown: string,
  overrides: WikiOverrides,
): string {
  let md = markdown;
  for (const [id, ov] of Object.entries(overrides.components)) {
    if (!ov.role?.trim() && !ov.description?.trim()) continue;
    try {
      md = modifyMarkdownBlock(md, `component:${id}`, {
        role: ov.role ?? "",
        description: ov.description ?? "",
      });
    } catch {
      /* component section missing after rescan — skip */
    }
  }
  return md;
}

export async function mergeUploadOverridesAfterRescan(
  scanMdFileName: string,
  markdown: string,
  workspaceRoot?: string,
): Promise<string> {
  const cloud = await readUploadWikiOverrides(scanMdFileName);
  let merged = applyUploadOverridesToMarkdown(markdown, cloud);

  if (workspaceRoot) {
    const local = readWikiOverrides(workspaceRoot);
    for (const [id, ov] of Object.entries(local.components)) {
      if (cloud.components[id]) continue;
      if (!ov.role?.trim() && !ov.description?.trim()) continue;
      try {
        merged = modifyMarkdownBlock(merged, `component:${id}`, {
          role: ov.role ?? "",
          description: ov.description ?? "",
        });
      } catch {
        /* skip */
      }
    }
  }

  return merged;
}

export function pullOverridesPayload(
  overrides: WikiOverrides,
): Record<string, { role: string; description: string }> {
  const out: Record<string, { role: string; description: string }> = {};
  for (const [id, ov] of Object.entries(overrides.components)) {
    if (!ov.role?.trim() && !ov.description?.trim()) continue;
    out[id] = {
      role: ov.role?.trim() ?? "",
      description: ov.description?.trim() ?? "",
    };
  }
  return out;
}
