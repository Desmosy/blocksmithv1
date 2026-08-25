import { getDefaultDocFileName, loadDesignSystem } from "@/lib/clients/registry";
import { getWatcherStatus } from "@/lib/sync/watcher";
import type { ComponentDoc } from "@/lib/blocks/types";
import type { StoredBlock } from "@/lib/blocks/content";
import { ensureDocBlocks } from "@/lib/blocks/refresh";
import { getBlockStoreIndex } from "@/lib/blocks/store";
import {
  appendActivity,
  listActivity,
  type ActivityAction,
  type ActivityEntry,
} from "@/lib/activity/store";
import { gitAuthor, gitCommit } from "@/lib/activity/git";
import {
  findOffTokenColors,
  paletteFromColors,
  type OffToken,
} from "@/lib/governance/color-lint";
import { checkGovernanceDiff } from "@/lib/governance/check-diff";
import { appendGovernanceEvent } from "@/lib/cloud/governance-events";
import type {
  GovernanceEventAction,
  GovernanceEventSource,
} from "@/lib/governance/types";
import { getWorkspaceScanSyncStatus } from "@/lib/scan/sync-status";
import type { ScanPersistResult } from "@/lib/scan/run";
import { readUploadMarkdownSync } from "@/lib/uploads/persist";
import { isUploadDocRef, uploadFileNameFromRef } from "@/lib/uploads/store";
import type { PulseCodegenOutput } from "@/lib/codegen/run";
import {
  getLockStatus,
  getRegistrySummary,
  listExcludedBlocks,
  listGovernedBlocks,
  type GovernedBlock,
  type LockStatus,
} from "@/lib/ir/enforce";
import { buildLock, serializeLock } from "@/lib/ir/lock";
import { getBlockHistory } from "@/lib/ir/registry";
import type { BlocksmithLockV1, BlockVersionRecord } from "@/lib/ir/types";

export function resolveDocRef(doc?: string): string {
  return doc?.trim() || process.env.BLOCKSMITH_DOC?.trim() || getDefaultDocFileName();
}

function matchComponents(
  blocks: StoredBlock[],
  names: string[],
): StoredBlock[] {
  if (!names.length) return blocks.filter((b) => b.type === "component");
  const lower = names.map((n) => n.toLowerCase());
  return blocks.filter((b) => {
    if (b.type !== "component") return false;
    const title = b.title.toLowerCase();
    const id = b.id.toLowerCase();
    return lower.some(
      (q) =>
        title.includes(q) ||
        id.includes(q) ||
        id.endsWith(`:${q.replace(/\s+/g, "-")}`),
    );
  });
}

/**
 * LOCK ENFORCEMENT: agent-facing reads resolve through the IR version
 * registry — official (promoted) versions only. Drafts and conflicts never
 * leave the server (research doc §4.6 row 4).
 */
export function handleGetDesignTokens(args: {
  doc?: string;
  category?: string;
}): { docRef: string; tokens: GovernedBlock[] } {
  const docRef = resolveDocRef(args.doc);
  const blocks = listGovernedBlocks(docRef).filter((b) => b.type === "token");
  const cat = args.category?.toLowerCase();
  const filtered = cat
    ? blocks.filter((b) => b.id.startsWith(`token:${cat}:`))
    : blocks;
  return { docRef, tokens: filtered };
}

export function handleGetComponentDocs(args: {
  doc?: string;
  names?: string[];
}): { docRef: string; components: GovernedBlock[] } {
  const docRef = resolveDocRef(args.doc);
  const blocks = listGovernedBlocks(docRef);
  const names = Array.isArray(args.names) ? args.names : [];
  const components = matchComponents(blocks, names) as GovernedBlock[];
  return { docRef, components };
}

export function handleListComponents(args: { doc?: string }): {
  docRef: string;
  components: { id: string; title: string; summary?: string; version?: number }[];
} {
  const docRef = resolveDocRef(args.doc);
  const components = listGovernedBlocks(docRef)
    .filter((b) => b.type === "component")
    .map((b) => ({
      id: b.id,
      title: b.title,
      summary: b.content.role ?? b.content.summary,
      version: b.version,
    }));
  return { docRef, components };
}

/** Serve the lock artifact agents should write to / compare with the repo. */
export function handleGetLockfile(args: { doc?: string }): {
  docRef: string;
  lock: BlocksmithLockV1;
  body: string;
  status: LockStatus;
} {
  const docRef = resolveDocRef(args.doc);
  ensureDocBlocks(docRef);
  const lock = buildLock(docRef);
  return { docRef, lock, body: serializeLock(lock), status: getLockStatus(docRef) };
}

/** Version history for one block id — the CI/CD audit trail. */
export function handleGetBlockVersions(args: {
  doc?: string;
  blockId: string;
}): {
  docRef: string;
  blockId: string;
  official?: number;
  versions: BlockVersionRecord[];
  error?: string;
} {
  const docRef = resolveDocRef(args.doc);
  ensureDocBlocks(docRef);
  const history = getBlockHistory(docRef, args.blockId);
  if (!history) {
    return {
      docRef,
      blockId: args.blockId,
      versions: [],
      error: `No registry entry for "${args.blockId}". Try list_components or get_design_tokens for valid ids.`,
    };
  }
  return { docRef, blockId: args.blockId, ...history };
}

export function handleGetSyncStatus(args: { doc?: string }): Record<string, unknown> {
  const docRef = resolveDocRef(args.doc);
  const watcher = getWatcherStatus();
  const index = getBlockStoreIndex();
  const docEntry = index.docs[docRef];
  let systemHash: string | undefined;
  try {
    const system = loadDesignSystem(docRef);
    systemHash = system.contentHash;
  } catch {
    /* doc missing */
  }

  let workspaceScan: ReturnType<typeof getWorkspaceScanSyncStatus> | null = null;
  if (isUploadDocRef(docRef)) {
    try {
      const md = readUploadMarkdownSync(uploadFileNameFromRef(docRef));
      workspaceScan = getWorkspaceScanSyncStatus(md);
    } catch {
      /* upload not hydrated — call get_component_docs first or scan */
    }
  }

  const mcpNote = workspaceScan?.hostedRefreshOnly
    ? "Hosted scan: refresh via `blocksmith scan /path` or re-scan from GitHub; governance via `blocksmith pull`."
    : workspaceScan?.stale
      ? "Workspace scan is stale — run blocksmith scan or wiki Refresh scan before trusting component facts."
      : "Blocks mirror the wiki. Finalize governance in the browser; pull DESIGN.md with blocksmith pull.";

  // Design CI/CD surface: lock freshness + what the enforcement boundary is
  // currently excluding (drafts, conflicts, stale blocks).
  let lock: LockStatus | null = null;
  let registry: ReturnType<typeof getRegistrySummary> = null;
  let excluded: ReturnType<typeof listExcludedBlocks> = [];
  try {
    lock = getLockStatus(docRef);
    registry = getRegistrySummary(docRef);
    excluded = listExcludedBlocks(docRef);
  } catch {
    /* registry not materialized yet */
  }

  return {
    docRef,
    watcher: {
      active: watcher.active,
      watchedPaths: watcher.watchedPaths,
      lastEvent: watcher.lastEvent,
    },
    blockStore: {
      lastSyncAt: index.lastSyncAt,
      doc: docEntry ?? null,
      systemContentHash: systemHash,
    },
    lock,
    registry: registry
      ? {
          officialGraphHash: registry.officialGraphHash,
          promotedCount: registry.promotedCount,
          draftCount: registry.draftCount,
          staleCount: registry.staleCount,
          lastIngestAt: registry.lastIngestAt,
        }
      : null,
    excludedFromAgents: excluded,
    workspaceScan,
    mcpNote,
  };
}

/** Match a free-text component name/id against the doc's components. */
export function resolveComponent(
  docRef: string,
  query: string,
): ComponentDoc | null {
  const system = loadDesignSystem(docRef);
  const q = query.toLowerCase().trim();
  const slug = q.replace(/\s+/g, "-");
  return (
    system.components.find(
      (c) =>
        c.id === q ||
        c.id === slug ||
        c.id.endsWith(`-${slug}`) ||
        c.id.includes(slug) ||
        c.title.toLowerCase().includes(q),
    ) ?? null
  );
}

export function handleLogComponentWork(args: {
  doc?: string;
  component: string;
  author?: string;
  action?: ActivityAction;
  prompt?: string;
  summary: string;
  files?: string[];
}): { ok: boolean; docRef: string; entry?: ActivityEntry; error?: string } {
  const docRef = resolveDocRef(args.doc);
  const comp = resolveComponent(docRef, args.component);
  if (!comp) {
    return {
      ok: false,
      docRef,
      error: `No component matched "${args.component}". Try list_components.`,
    };
  }
  let contentHash: string | undefined;
  try {
    contentHash = loadDesignSystem(docRef).contentHash;
  } catch {
    /* hash optional */
  }
  const entry = appendActivity({
    docRef,
    componentId: comp.id,
    componentTitle: comp.title,
    author:
      args.author?.trim() ||
      gitAuthor() ||
      process.env.BLOCKSMITH_AUTHOR?.trim() ||
      "unknown",
    action: args.action ?? "note",
    prompt: args.prompt,
    summary: args.summary,
    files: args.files,
    contentHash,
    commit: gitCommit() ?? undefined,
    source: "mcp",
  });
  return { ok: true, docRef, entry };
}

export function handleGetComponentHistory(args: {
  doc?: string;
  component?: string;
  limit?: number;
}): {
  docRef: string;
  component: ComponentDoc | null;
  entries: ActivityEntry[];
  error?: string;
} {
  const docRef = resolveDocRef(args.doc);
  let component: ComponentDoc | null = null;
  if (args.component) {
    component = resolveComponent(docRef, args.component);
    if (!component) {
      return {
        docRef,
        component: null,
        entries: [],
        error: `No component matched "${args.component}".`,
      };
    }
  }
  const entries = listActivity(docRef, {
    componentId: component?.id,
    limit: args.limit ?? 10,
  });
  return { docRef, component, entries };
}

export function handleCheckGovernance(args: {
  doc?: string;
  component: string;
  proposedColors?: string[];
}): {
  docRef: string;
  component: ComponentDoc | null;
  palette: { name: string; value: string }[];
  dos: string[];
  donts: string[];
  violations: string[];
  governed: boolean;
  error?: string;
} {
  const docRef = resolveDocRef(args.doc);
  const comp = resolveComponent(docRef, args.component);
  if (!comp) {
    return {
      docRef,
      component: null,
      palette: [],
      dos: [],
      donts: [],
      violations: [],
      governed: false,
      error: `No component matched "${args.component}".`,
    };
  }
  const system = loadDesignSystem(docRef);
  const palette = system.colors
    .filter((c) => c.value.startsWith("#"))
    .map((c) => ({ name: c.name, value: c.value.toLowerCase() }));
  const paletteSet = new Set(palette.map((p) => p.value));

  const proposed = (args.proposedColors ?? [])
    .map((h) => h.toLowerCase().trim())
    .filter((h) => /^#[0-9a-f]{3,8}$/.test(h));
  const violations = proposed
    .filter((h) => !paletteSet.has(h))
    .map((h) => `${h} is not a defined token — deviates from the design system.`);

  return {
    docRef,
    component: comp,
    palette,
    dos: system.dos,
    donts: system.donts,
    violations,
    governed: violations.length === 0,
  };
}

export function handleGetGovernanceRules(args: { doc?: string }): {
  docRef: string;
  systemName: string;
  palette: { name: string; value: string }[];
  dos: string[];
  donts: string[];
  componentCount: number;
} {
  const docRef = resolveDocRef(args.doc);
  const system = loadDesignSystem(docRef);
  return {
    docRef,
    systemName: system.name,
    palette: system.colors
      .filter((c) => c.value.startsWith("#"))
      .map((c) => ({ name: c.name, value: c.value.toLowerCase() })),
    dos: system.dos,
    donts: system.donts,
    componentCount: system.components.length,
  };
}

export function handleValidateUiCode(args: {
  doc?: string;
  code: string;
}): {
  docRef: string;
  governed: boolean;
  violations: OffToken[];
  tokenCount: number;
} {
  const docRef = resolveDocRef(args.doc);
  const system = loadDesignSystem(docRef);
  const palette = paletteFromColors(system.colors);
  const violations = findOffTokenColors(args.code ?? "", palette);
  return {
    docRef,
    governed: violations.length === 0,
    violations,
    tokenCount: palette.size,
  };
}

export async function handleCheckGovernanceDiff(args: {
  doc?: string;
  code: string;
  component?: string;
  filePath?: string;
  record?: boolean;
  author?: string;
  source?: GovernanceEventSource;
  action?: GovernanceEventAction;
  overrideReason?: string;
  commit?: string;
  branch?: string;
}) {
  const docRef = resolveDocRef(args.doc);
  const result = checkGovernanceDiff({
    docRef,
    code: args.code,
    component: args.component,
    filePath: args.filePath,
  });

  let event = null;
  if (args.record && result.findings.length > 0) {
    event = await appendGovernanceEvent({
      docRef,
      componentId: result.component?.id,
      componentTitle: result.component?.title,
      author: args.author ?? process.env.BLOCKSMITH_AUTHOR?.trim() ?? "mcp-agent",
      source: args.source ?? "mcp",
      action: args.action ?? (args.overrideReason ? "overridden" : "detected"),
      findings: result.findings,
      commit: args.commit,
      branch: args.branch,
      overrideReason: args.overrideReason,
    });
  }

  return { ...result, event };
}

export async function handleScanWorkspace(args: {
  workspace?: string;
  github?: string;
  fixture?: string;
}): Promise<
  ScanPersistResult & {
    markdownPath: string;
    scanMode: string;
    githubUrl?: string;
  }
> {
  const { parseScanRequest, runScanService } = await import(
    "@/lib/scan/service"
  );
  const origin = process.env.BLOCKSMITH_PUBLIC_URL?.trim() || "http://localhost:3000";
  const request = parseScanRequest({
    workspace: args.workspace,
    github: args.github,
    fixture: args.fixture,
  });
  const result = await runScanService(request, origin);
  const { loadDesignSystem } = await import("@/lib/clients/registry");
  loadDesignSystem(result.docRef);
  return {
    ...result,
    markdownPath: `data/uploads/${result.fileName}`,
    scanMode: result.scanMode,
    githubUrl: result.githubUrl,
  };
}

export async function handlePulseCodegen(args: {
  doc?: string;
}): Promise<PulseCodegenOutput> {
  const { runPulseCodegen } = await import("@/lib/codegen/run");
  return runPulseCodegen(args.doc);
}

/**
 * Figma-fit wedge: import Figma variables into a governed design.md so the wiki,
 * parser, and governance render them like any workspace scan. The tokens carry a
 * `figma:<fileKey>` source so their origin is traceable.
 */
export async function handleImportFigmaVariables(args: {
  variables?: import("@/lib/figma/types").FigmaVariableDefs;
  designContextCode?: string;
  components?: import("@/lib/figma/components").FigmaComponentInput;
  fileKey?: string;
  fileName?: string;
  projectName?: string;
  markdownAppendix?: string;
}): Promise<{
  docRef: string;
  fileName: string;
  wikiPath: string;
  markdownPath: string;
  summary: import("@/lib/figma/types").FigmaImportSummary;
}> {
  const { importFigmaVariables } = await import("@/lib/figma");
  const { persistUploadMarkdown } = await import("@/lib/uploads/persist");
  const imported = importFigmaVariables({
    variables: args.variables,
    designContextCode: args.designContextCode,
    components: args.components,
    fileKey: args.fileKey,
    fileName: args.fileName,
    projectName: args.projectName,
  });
  await persistUploadMarkdown(
    imported.fileName,
    args.markdownAppendix ? `${imported.markdown.trimEnd()}\n\n${args.markdownAppendix.trim()}\n` : imported.markdown,
  );
  const docRef = `upload:${imported.fileName}`;
  // Hydrate so the design system is immediately queryable by other tools.
  try {
    loadDesignSystem(docRef);
  } catch {
    /* parse hydrates lazily on first wiki/MCP read */
  }
  return {
    docRef,
    fileName: imported.fileName,
    wikiPath: `/wiki?doc=${encodeURIComponent(docRef)}`,
    markdownPath: `data/uploads/${imported.fileName}`,
    summary: imported.summary,
  };
}

/**
 * Reconcile Figma variables against an existing code scan doc — the wedge's
 * payoff: "Figma says X, shipped code says Y." `doc` must be a workspace-scan
 * upload (the result of `blocksmith scan` / scan_workspace).
 */
export async function handleFigmaTokenDrift(args: {
  variables?: import("@/lib/figma/types").FigmaVariableDefs;
  designContextCode?: string;
  components?: import("@/lib/figma/components").FigmaComponentInput;
  doc?: string;
  fileKey?: string;
}): Promise<{
  docRef: string;
  report: import("@/lib/figma/types").TokenDriftReport;
  componentReport?: import("@/lib/figma/types").ComponentDriftReport;
  markdown: string;
  error?: string;
}> {
  const docRef = resolveDocRef(args.doc);
  const emptyToken = { rows: [], matched: 0, mismatched: 0, figmaOnly: 0, codeOnly: 0, inSync: true };
  const {
    figmaVariablesToTokens,
    normalizeFigmaVariables,
    normalizeFigmaComponents,
    figmaDesignContextToTokens,
  } = await import("@/lib/figma");
  const { driftFigmaAgainstScan, renderDriftMarkdown } = await import(
    "@/lib/figma/drift"
  );
  const { driftFigmaComponentsAgainstScan, renderComponentDriftMarkdown } =
    await import("@/lib/figma/component-drift");

  if (!isUploadDocRef(docRef)) {
    return {
      docRef,
      report: emptyToken,
      markdown: "",
      error: `Drift needs a workspace-scan doc (upload:scan-*.md). "${docRef}" is not an upload — run blocksmith scan or scan_workspace first.`,
    };
  }

  let scanMarkdown: string;
  try {
    scanMarkdown = readUploadMarkdownSync(uploadFileNameFromRef(docRef));
  } catch {
    return {
      docRef,
      report: emptyToken,
      markdown: "",
      error: `Could not read scan markdown for ${docRef}. Call get_component_docs or scan_workspace to hydrate it first.`,
    };
  }

  const inferred = args.designContextCode
    ? Object.entries(figmaDesignContextToTokens(args.designContextCode)).map(
        ([name, value]) => ({ name, value }),
      )
    : [];
  const { cssVars } = figmaVariablesToTokens(
    [...normalizeFigmaVariables(args.variables ?? {}), ...inferred],
    `figma:${args.fileKey?.trim() || "file"}`,
  );
  const report = driftFigmaAgainstScan(cssVars, scanMarkdown);
  const sections = [renderDriftMarkdown(report)];

  let componentReport:
    | import("@/lib/figma/types").ComponentDriftReport
    | undefined;
  if (args.components) {
    componentReport = driftFigmaComponentsAgainstScan(
      normalizeFigmaComponents(args.components),
      scanMarkdown,
    );
    sections.push(renderComponentDriftMarkdown(componentReport));
  }

  return { docRef, report, componentReport, markdown: sections.join("\n\n") };
}

export function formatBlockForAgent(block: StoredBlock): string {
  const pin =
    block.version != null
      ? ` — pinned v${block.version} (${block.contentHash})`
      : "";
  const lines = [`## ${block.title} (${block.id})${pin}`, ""];
  if (block.content.role) lines.push(`**Role:** ${block.content.role}`);
  if (block.content.description)
    lines.push(`**Spec:** ${block.content.description}`);
  if (block.content.value) lines.push(`**Value:** ${block.content.value}`);
  if (block.content.cssVar) lines.push(`**Token:** ${block.content.cssVar}`);
  if (block.content.items?.length) {
    lines.push("", ...block.content.items.map((i) => `- ${i}`));
  }
  if (block.content.text) lines.push("", block.content.text);
  if (block.content.agentHint)
    lines.push("", `**Agent hint:** ${block.content.agentHint}`);
  return lines.join("\n");
}
