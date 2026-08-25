import "server-only";

import { readFileSync, statSync, readdirSync } from "fs";
import { join, basename, normalize, relative } from "path";
import { createHash } from "crypto";
import type { DesignSystem } from "@/lib/blocks/types";
import { parseApolloMarkdown } from "@/lib/parser/apollo";
import {
  isApolloStructuredMarkdown,
  isComprehensiveWikiMarkdown,
  parseGenericMarkdown,
  type MarkdownSection,
} from "@/lib/parser/generic";
import {
  isWorkspaceScanMarkdown,
  parseWorkspaceScanMarkdown,
} from "@/lib/scan/parse";
import {
  isUploadDocRef,
  uploadFileNameFromRef,
  resolveUploadPath,
  listUploads,
  UPLOAD_DOC_PREFIX,
} from "@/lib/uploads/store";
import {
  hydrateUploadMarkdown,
  readUploadMarkdownSync,
  uploadMtimeMs,
  readUploadMarkdownContent,
} from "@/lib/uploads/persist";
import { resolveMarkdownForParsing } from "@/ai-lab/02-parser-assist/resolve";

const DESIGNS_ROOT = join(process.cwd(), "docs/designs.md");

export type LoadedDesignSystem = DesignSystem & {
  mode: "apollo" | "generic" | "workspace-scan";
  sections?: MarkdownSection[];
};

export interface DocSource {
  id: string;
  fileName: string;
  path: string;
  label: string;
  parser: "apollo" | "generic";
  origin?: "repo" | "upload";
}

type CacheEntry = {
  mtime: number;
  system: LoadedDesignSystem;
};

const cache = new Map<string, CacheEntry>();

/** Clear after parser changes (dev) */
export function clearDesignSystemCache(): void {
  cache.clear();
}

function safeResolveRepoDoc(fileName: string): string {
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

function resolveDocFile(docRef: string): { fullPath: string; displayName: string } {
  if (isUploadDocRef(docRef)) {
    const fileName = uploadFileNameFromRef(docRef);
    return {
      fullPath: resolveUploadPath(fileName),
      displayName: fileName,
    };
  }
  return {
    fullPath: safeResolveRepoDoc(docRef),
    displayName: docRef,
  };
}

function detectParser(snippet: string, displayName: string): "apollo" | "generic" {
  if (isWorkspaceScanMarkdown(snippet)) return "generic";
  if (isComprehensiveWikiMarkdown(snippet)) return "generic";
  return isApolloStructuredMarkdown(snippet) ||
    basename(displayName).toLowerCase() === "apollo.md"
    ? "apollo"
    : "generic";
}

function buildSystemFromMarkdown(
  md: string,
  fullPath: string,
  docRef: string,
  mtime: number,
): LoadedDesignSystem {
  const hash = createHash("sha256").update(md).digest("hex").slice(0, 16);
  const displayName = isUploadDocRef(docRef)
    ? uploadFileNameFromRef(docRef)
    : basename(docRef);

  const useApollo =
    !isWorkspaceScanMarkdown(md) &&
    !isComprehensiveWikiMarkdown(md) &&
    detectParser(md, displayName) === "apollo";

  const system: LoadedDesignSystem = isWorkspaceScanMarkdown(md)
    ? parseWorkspaceScanMarkdown(md, fullPath)
    : useApollo
      ? { ...parseApolloMarkdown(md, fullPath), mode: "apollo" }
      : parseGenericMarkdown(md, fullPath, displayName);

  system.updatedAt = new Date(mtime).toISOString();
  system.contentHash = hash;
  system.sourcePath = isUploadDocRef(docRef)
    ? `data/uploads/${displayName}`
    : `docs/designs.md/${displayName}`;

  return system;
}

export function listDocSources(): DocSource[] {
  const repo: DocSource[] = [];
  try {
    const files = readdirSync(DESIGNS_ROOT).filter(
      (f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md",
    );
    for (const fileName of files) {
      const path = join(DESIGNS_ROOT, fileName);
      let parser: "apollo" | "generic" = "generic";
      try {
        const snippet = readFileSync(path, "utf-8").slice(0, 8000);
        parser = detectParser(snippet, fileName);
      } catch {
        /* keep generic */
      }
      repo.push({
        id: fileName.replace(/\.md$/i, ""),
        fileName,
        path: `docs/designs.md/${fileName}`,
        label: fileName.replace(/\.md$/i, ""),
        parser,
        origin: "repo",
      });
    }
  } catch {
    /* no repo docs */
  }

  return repo;
}

export async function listAllDocSources(): Promise<DocSource[]> {
  const repo = listDocSources();
  const uploads = await listUploads();
  const uploadSources: DocSource[] = [];
  for (const u of uploads) {
    let parser: "apollo" | "generic" = "generic";
    try {
      const snippet = (await readUploadMarkdownContent(u.fileName)).slice(0, 8000);
      parser = detectParser(snippet, u.fileName);
    } catch {
      /* generic */
    }
    uploadSources.push({
      id: u.docRef,
      fileName: u.docRef,
      path: `data/uploads/${u.fileName}`,
      label: u.label,
      parser,
      origin: "upload",
    });
  }
  return [...uploadSources, ...repo];
}

export function getDefaultDocFileName(): string {
  const sources = listDocSources();
  const apollo = sources.find((s) => s.fileName === "apollo.md");
  return apollo?.fileName ?? sources[0]?.fileName ?? "apollo.md";
}

/** Resolve doc path + run parser assist when needed (call before loadDesignSystem). */
export async function prepareDesignSystemDoc(docRef: string): Promise<void> {
  let md: string;
  if (isUploadDocRef(docRef)) {
    const fileName = uploadFileNameFromRef(docRef);
    await hydrateUploadMarkdown(fileName);
    md = readUploadMarkdownSync(fileName);
  } else {
    const { fullPath } = resolveDocFile(docRef);
    md = readFileSync(fullPath, "utf-8");
  }
  const { ensureParserAssist } = await import("@/ai-lab/02-parser-assist/resolve");
  await ensureParserAssist(docRef, md);
}

export function loadDesignSystem(
  docRef?: string | null,
): LoadedDesignSystem {
  const doc = docRef?.trim() || getDefaultDocFileName();
  const { fullPath, displayName } = resolveDocFile(doc);

  let mtime: number;
  let md: string;
  if (isUploadDocRef(doc)) {
    const fileName = uploadFileNameFromRef(doc);
    try {
      mtime = uploadMtimeMs(fileName);
      md = readUploadMarkdownSync(fileName);
    } catch {
      throw new Error(
        `Upload ${fileName} not loaded — call prepareDesignSystemDoc() first`,
      );
    }
  } else {
    const stat = statSync(fullPath);
    mtime = stat.mtimeMs;
    md = readFileSync(fullPath, "utf-8");
  }

  const cached = cache.get(doc);
  if (cached && cached.mtime === mtime) {
    return cached.system;
  }
  const parseMd = resolveMarkdownForParsing(doc, md);
  const system = buildSystemFromMarkdown(parseMd, fullPath, doc, mtime);

  cache.set(doc, { mtime, system });

  queuePersistArtifacts(doc, system);

  return system;
}

function queuePersistArtifacts(doc: string, system: LoadedDesignSystem): void {
  const run = () => {
    void import("@/lib/blocks/store")
      .then(({ persistBlocksForDoc }) => persistBlocksForDoc(doc, system))
      .catch((err) => {
        console.error("[blocks] persist failed for", doc, err);
      });
    void import("@/lib/design-ir/store")
      .then(({ persistDesignIRFromSystem }) =>
        persistDesignIRFromSystem(doc, system),
      )
      .catch((err) => {
        console.error("[design-ir] persist failed for", doc, err);
      });
  };
  if (typeof setImmediate === "function") {
    setImmediate(run);
  } else {
    setTimeout(run, 0);
  }
}

export function getClientMeta(docRef: string) {
  const doc = docRef || getDefaultDocFileName();
  if (isUploadDocRef(doc)) {
    const fileName = uploadFileNameFromRef(doc);
    const system = loadDesignSystem(doc);
    return {
      id: doc,
      displayName: system.name,
      sourceLabel: `data/uploads/${fileName}`,
      parser:
        system.mode === "apollo"
          ? "apollo"
          : system.mode === "workspace-scan"
            ? "workspace-scan"
            : "generic",
      origin: "upload" as const,
    };
  }

  const sources = listDocSources();
  const match = sources.find((s) => s.fileName === doc);
  return {
    id: match?.id ?? doc.replace(/\.md$/i, ""),
    displayName: match?.label ?? doc,
    sourceLabel: match?.path ?? `docs/designs.md/${doc}`,
    parser: match?.parser ?? "generic",
    origin: "repo" as const,
  };
}

export { UPLOAD_DOC_PREFIX };
