import { scanResultFingerprint } from "./fingerprint";
import { scanWorkspace } from "./extract";
import { getWorkspaceRootFromMarkdown } from "./parse";
import { isAllowedServerWorkspacePath } from "./service";
import { parseMarkdownFrontmatter } from "@/lib/markdown/frontmatter";

export type WorkspaceScanSyncStatus = {
  isWorkspaceScan: boolean;
  workspaceRoot: string | null;
  githubRepo: string | null;
  stale: boolean;
  /** Server cannot read customer machine — refresh via CLI or re-scan from GitHub */
  hostedRefreshOnly: boolean;
  refreshHint: "server-rescan" | "cli-rescan" | "github-rescan" | null;
  publishedFactsHash: string | null;
  liveFactsHash: string | null;
  scannedAt: string | null;
  reactFiles: number;
  featuredComponents: number;
};

export function getWorkspaceScanSyncStatus(
  publishedMarkdown: string,
): WorkspaceScanSyncStatus {
  const meta = parseMarkdownFrontmatter(publishedMarkdown);
  const isWorkspaceScan = /workspace-scan/.test(
    meta["blocksmith-source"] ?? "",
  );

  const githubRepo = meta["github-repo"] ?? null;

  if (!isWorkspaceScan) {
    return {
      isWorkspaceScan: false,
      workspaceRoot: null,
      githubRepo,
      stale: false,
      hostedRefreshOnly: false,
      refreshHint: null,
      publishedFactsHash: null,
      liveFactsHash: null,
      scannedAt: meta["scanned-at"] ?? null,
      reactFiles: 0,
      featuredComponents: 0,
    };
  }

  const workspaceRoot = getWorkspaceRootFromMarkdown(publishedMarkdown);
  const publishedFactsHash = meta["scan-facts-hash"] ?? null;

  if (!workspaceRoot) {
    return {
      isWorkspaceScan: true,
      workspaceRoot: null,
      githubRepo,
      stale: false,
      hostedRefreshOnly: false,
      refreshHint: null,
      publishedFactsHash,
      liveFactsHash: null,
      scannedAt: meta["scanned-at"] ?? null,
      reactFiles: Number(meta["inventory-tsx"] ?? 0) || 0,
      featuredComponents: Number(meta["featured-components"] ?? 0) || 0,
    };
  }

  const serverCanRescan = isAllowedServerWorkspacePath(workspaceRoot);
  if (!serverCanRescan) {
    return {
      isWorkspaceScan: true,
      workspaceRoot,
      githubRepo,
      stale: false,
      hostedRefreshOnly: true,
      refreshHint: githubRepo ? "github-rescan" : "cli-rescan",
      publishedFactsHash,
      liveFactsHash: null,
      scannedAt: meta["scanned-at"] ?? null,
      reactFiles: Number(meta["inventory-tsx"] ?? 0) || 0,
      featuredComponents: Number(meta["featured-components"] ?? 0) || 0,
    };
  }

  const live = scanWorkspace(workspaceRoot);
  const liveFactsHash = scanResultFingerprint(live);

  return {
    isWorkspaceScan: true,
    workspaceRoot,
    githubRepo,
    stale: Boolean(
      publishedFactsHash && liveFactsHash !== publishedFactsHash,
    ),
    hostedRefreshOnly: false,
    refreshHint: "server-rescan",
    publishedFactsHash,
    liveFactsHash,
    scannedAt: meta["scanned-at"] ?? null,
    reactFiles: live.coverage.reactFiles,
    featuredComponents: live.coverage.featuredComponents,
  };
}

export function readWorkspaceScanSyncStatusFromDoc(
  docRef: string,
  readMd: (path: string) => string,
  resolvePath: (docRef: string) => string,
): WorkspaceScanSyncStatus {
  try {
    const path = resolvePath(docRef);
    const md = readMd(path);
    return getWorkspaceScanSyncStatus(md);
  } catch {
    return {
      isWorkspaceScan: false,
      workspaceRoot: null,
      githubRepo: null,
      stale: false,
      hostedRefreshOnly: false,
      refreshHint: null,
      publishedFactsHash: null,
      liveFactsHash: null,
      scannedAt: null,
      reactFiles: 0,
      featuredComponents: 0,
    };
  }
}
