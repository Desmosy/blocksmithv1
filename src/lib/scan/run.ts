/**
 * Scan publish pipeline (order matters):
 * 1. scanWorkspace() — facts on disk
 * 2. workspaceScanToMarkdown() — full facts .md + inventory
 * 3. resolveScanMarkdownForWiki() — optional LLM polish; inventory always re-appended
 * 4. write upload — wiki reads this file only
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { resolveScanMarkdownForWiki, persistScanFacts } from "@/ai-lab/09-scan-curate";
import { canWriteWorkspaceSnapshot } from "@/lib/runtime/writable-root";
import { persistUploadMarkdown } from "@/lib/uploads/persist";
import { scanWorkspace } from "./extract";
import { mergeUploadOverridesAfterRescan } from "./upload-overrides";
import { workspaceScanToMarkdown } from "./to-markdown";
import { loadWorkspaceConfig } from "./workspace-config";

const UPLOAD_PREFIX = "upload:";

export type ClientScanPayload = {
  markdown: string;
  fileName: string;
  projectName: string;
  workspaceRoot: string;
  scannedAt: string;
  colors: number;
  components: number;
  reactFiles: number;
  filesScanned: number;
  curated: boolean;
};

export type ScanPersistResult = {
  docRef: string;
  fileName: string;
  wikiPath: string;
  workspaceRoot: string;
  projectName: string;
  scannedAt: string;
  colors: number;
  components: number;
  reactFiles: number;
  filesScanned: number;
  /** True when LLM curated markdown was published (not raw facts). */
  curated: boolean;
  curatedModel?: string;
  curateReason?: string;
};

async function publishScanMarkdown(
  result: ReturnType<typeof scanWorkspace>,
  factsMarkdown: string,
  fileName: string,
  opts?: { writeUpload?: boolean; writeSnapshot?: boolean },
): Promise<{
  markdown: string;
  curated: boolean;
  curatedModel?: string;
  curateReason?: string;
}> {
  const docRef = `${UPLOAD_PREFIX}${fileName}`;
  persistScanFacts(fileName, factsMarkdown);

  const curated = await resolveScanMarkdownForWiki(
    result,
    factsMarkdown,
    docRef,
  );

  const publishedMarkdown =
    opts?.writeUpload !== false
      ? await mergeUploadOverridesAfterRescan(
          fileName,
          curated.markdown,
          result.workspaceRoot,
        )
      : curated.markdown;

  if (opts?.writeUpload !== false) {
    await persistUploadMarkdown(fileName, publishedMarkdown);
  }

  if (
    opts?.writeSnapshot !== false &&
    canWriteWorkspaceSnapshot(result.workspaceRoot)
  ) {
    const wsConfig = loadWorkspaceConfig(result.workspaceRoot);
    if (wsConfig.exportSnapshot !== false) {
      try {
        const snapshotDir = join(result.workspaceRoot, ".blocksmith");
        const snapshotPath = join(snapshotDir, "scan-snapshot.md");
        mkdirSync(snapshotDir, { recursive: true });
        writeFileSync(snapshotPath, publishedMarkdown, "utf-8");
      } catch (err) {
        console.warn("[scan] snapshot write skipped", err);
      }
    }
  }

  return {
    markdown: publishedMarkdown,
    curated: curated.applied,
    curatedModel: curated.model,
    curateReason: curated.applied ? undefined : curated.reason,
  };
}

function toPersistResult(
  result: ReturnType<typeof scanWorkspace>,
  fileName: string,
  curated: { curated: boolean; curatedModel?: string; curateReason?: string },
): ScanPersistResult {
  const docRef = `${UPLOAD_PREFIX}${fileName}`;
  return {
    docRef,
    fileName,
    wikiPath: `/wiki?doc=${encodeURIComponent(docRef)}`,
    workspaceRoot: result.workspaceRoot,
    projectName: result.projectName,
    scannedAt: result.scannedAt,
    colors: result.colors.length,
    components: result.components.length,
    reactFiles: result.coverage.reactFiles,
    filesScanned: result.scannedFiles,
    curated: curated.curated,
    curatedModel: curated.curatedModel,
    curateReason: curated.curateReason,
  };
}

/** Scan on this machine and return markdown for CLI upload (no server path needed). */
export async function scanWorkspaceToPayload(
  overrideRoot?: string,
): Promise<ClientScanPayload> {
  const result = scanWorkspace(overrideRoot);
  const { markdown: factsMarkdown, fileName } = workspaceScanToMarkdown(result);
  const published = await publishScanMarkdown(result, factsMarkdown, fileName, {
    writeUpload: false,
    writeSnapshot: true,
  });

  return {
    markdown: published.markdown,
    fileName,
    projectName: result.projectName,
    workspaceRoot: result.workspaceRoot,
    scannedAt: result.scannedAt,
    colors: result.colors.length,
    components: result.components.length,
    reactFiles: result.coverage.reactFiles,
    filesScanned: result.scannedFiles,
    curated: published.curated,
  };
}

/** Persist scan markdown uploaded from CLI (client-side scan). */
export async function persistClientScan(
  payload: ClientScanPayload,
): Promise<ScanPersistResult> {
  if (!payload.markdown?.trim()) throw new Error("clientScan.markdown is empty");
  if (!payload.fileName?.trim()) throw new Error("clientScan.fileName is required");

  await persistUploadMarkdown(payload.fileName, payload.markdown);
  const docRef = `${UPLOAD_PREFIX}${payload.fileName}`;

  return {
    docRef,
    fileName: payload.fileName,
    wikiPath: `/wiki?doc=${encodeURIComponent(docRef)}`,
    workspaceRoot: payload.workspaceRoot,
    projectName: payload.projectName,
    scannedAt: payload.scannedAt,
    colors: payload.colors,
    components: payload.components,
    reactFiles: payload.reactFiles,
    filesScanned: payload.filesScanned,
    curated: payload.curated,
  };
}

export type ScanPersistOptions = {
  /** owner/repo — disambiguates filenames for package.json-only repos */
  githubRepo?: string;
  /** Skip vendor snapshot write (e.g. ephemeral GitHub clone dir) */
  writeSnapshot?: boolean;
  /** Re-scan: overwrite this upload filename instead of deriving a new one */
  fileNameOverride?: string;
};

export async function scanAndPersist(
  overrideRoot?: string,
  opts?: ScanPersistOptions,
): Promise<ScanPersistResult> {
  const result = scanWorkspace(overrideRoot);
  if (opts?.githubRepo) result.githubRepo = opts.githubRepo;
  const { markdown: factsMarkdown, fileName: derivedName } =
    workspaceScanToMarkdown(result);
  const fileName = opts?.fileNameOverride?.trim() || derivedName;
  const published = await publishScanMarkdown(result, factsMarkdown, fileName, {
    writeSnapshot: opts?.writeSnapshot !== false,
  });
  return toPersistResult(result, fileName, published);
}
