import "server-only";
import { listUploads, readUploadMarkdown, type SavedUpload } from "@/lib/uploads/store";
import { supabaseStorageEnabled } from "@/lib/supabase/env";
import { getCachedMetas, type ProjectMeta } from "./meta-cache";
import { parseMarkdownFrontmatter } from "@/lib/markdown/frontmatter";

/**
 * Dashboard project listing. A "project" is one design system (one design.md /
 * upload). Lists through the backend (`listUploads`) so it works on Supabase
 * storage in production — NOT the local filesystem, which is ephemeral on
 * serverless. Scoping to the caller's org is done by the page (tenant safety).
 *
 * Locally we parse each doc for rich names + token/component counts; in hosted
 * mode we stay metadata-only to avoid N storage downloads per dashboard load.
 * (Follow-up: denormalize name/kind/counts into the document registry.)
 */

export type ProjectKind = "Figma" | "Scan" | "Design" | "Sample";

export type DashboardProject = {
  docRef: string;
  fileName: string;
  name: string;
  kind: ProjectKind;
  updatedAt: string;
  tokens: number;
  components: number;
};

function deriveKind(fm: Record<string, string>, fileName: string): ProjectKind {
  const root = fm["workspace-root"] ?? "";
  if (root.startsWith("figma://") || /^scan-figma-/.test(fileName)) return "Figma";
  if (root.startsWith("project://") || /^scan-project-/.test(fileName)) return "Design";
  if (fm["blocksmith-source"]?.startsWith("workspace-scan") || /^scan-/.test(fileName))
    return "Scan";
  if (fileName.startsWith("design-")) return "Design";
  return "Sample";
}

function countTokens(md: string): number {
  return (md.match(/^\|\s*`--[^`]+`/gm) ?? []).length;
}

function countComponents(md: string): number {
  const section = md.match(
    /## [\d.]+\.?\s*Component Library\n([\s\S]*?)(?=\n## |\n---|$)/i,
  );
  if (!section) return 0;
  return (section[1].match(/^### /gm) ?? []).length;
}

function displayName(
  fm: Record<string, string>,
  md: string,
  fileName: string,
): string {
  const raw = fm["project-name"]?.trim() || fm["name"]?.trim();
  if (raw) return raw.replace(/\s*—\s*Workspace Scan$/i, "").trim();

  const heading = md.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading.replace(/\s*—\s*Workspace Scan$/i, "").trim();

  const slug = fileName
    .replace(/^(scan|design)-/, "")
    .replace(/\.md$/, "")
    .replace(/-?[0-9a-f]{8,}$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  if (!slug || /^[0-9a-f]{6,}$/i.test(slug)) return "Untitled project";
  return slug.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Parse a project's display metadata from its markdown — also cached for prod. */
export function parseProjectMeta(fileName: string, md: string): ProjectMeta {
  const fm = parseMarkdownFrontmatter(md);
  return {
    name: displayName(fm, md, fileName),
    kind: deriveKind(fm, fileName),
    tokens: countTokens(md),
    components: countComponents(md),
    updatedAt: (fm["scanned-at"] || new Date().toISOString()).trim(),
  };
}

function coarseProject(u: SavedUpload): DashboardProject {
  return {
    docRef: u.docRef,
    fileName: u.fileName,
    name: displayName({}, "", u.fileName),
    kind: deriveKind({}, u.fileName),
    updatedAt: u.savedAt,
    tokens: 0,
    components: 0,
  };
}

async function richProject(u: SavedUpload): Promise<DashboardProject> {
  try {
    const md = await readUploadMarkdown(u.docRef);
    const meta = parseProjectMeta(u.fileName, md);
    return {
      docRef: u.docRef,
      fileName: u.fileName,
      ...meta,
      updatedAt: meta.updatedAt || u.savedAt,
    };
  } catch {
    return coarseProject(u);
  }
}

/**
 * List projects, newest first. `allowedFileNames` restricts to a tenant's docs
 * (pass an empty set to show nothing); omit it for unscoped local dev.
 *
 * Local: parse each doc's content (rich). Hosted: read denormalized metadata
 * from the cache in one MGET; fall back to a coarse card on a cache miss.
 */
export async function listDashboardProjects(
  allowedFileNames?: Set<string>,
): Promise<DashboardProject[]> {
  let uploads = await listUploads();
  if (allowedFileNames) {
    uploads = uploads.filter((u) => allowedFileNames.has(u.fileName));
  }

  let projects: DashboardProject[];
  if (supabaseStorageEnabled()) {
    const metas = await getCachedMetas(uploads.map((u) => u.fileName));
    projects = uploads.map((u) => {
      const m = metas.get(u.fileName);
      return m
        ? { docRef: u.docRef, fileName: u.fileName, ...m }
        : coarseProject(u);
    });
  } else {
    projects = await Promise.all(uploads.map(richProject));
  }

  return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
