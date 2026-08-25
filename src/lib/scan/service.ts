/**
 * Goal 1 backend — single scan entry for API, MCP, sync, and CLI upload.
 *
 * Modes:
 * - fixture: server-side demo vendor
 * - github: shallow clone on server, scan, cleanup
 * - workspace: server-local path (fixtures only on hosted; full paths in dev)
 * - clientScan: markdown produced on developer machine, persisted on server
 */
import { join } from "path";
import { clearDesignSystemCache } from "@/lib/clients/registry";
import {
  scanAndPersist,
  scanWorkspaceToPayload,
  persistClientScan,
  type ScanPersistResult,
  type ClientScanPayload,
} from "./run";
import { cloneGithubRepo, parseGithubUrl } from "./github";
import { resolveWorkspaceRoot } from "./workspace-root";

export type ScanRequest =
  | { mode: "fixture"; fixture: "vendor" }
  | { mode: "github"; github: string; token?: string }
  | { mode: "workspace"; workspace: string }
  | { mode: "clientScan"; payload: ClientScanPayload };

export type ScanServiceResult = ScanPersistResult & {
  scanMode: ScanRequest["mode"];
  githubUrl?: string;
  /** Milliseconds for the scan phase (extract + markdown + persist). */
  scanMs?: number;
  /** Milliseconds for git clone (GitHub mode only). */
  cloneMs?: number;
};

const VENDOR_FIXTURE = join(process.cwd(), "fixtures", "vendor-ui");

function fixtureRoot(name: "vendor"): string {
  if (name === "vendor") return VENDOR_FIXTURE;
  throw new Error(`Unknown fixture: ${name}`);
}

/** Hosted-safe: only fixtures unless explicitly allowed. */
export function isAllowedServerWorkspacePath(absPath: string): boolean {
  const cwd = process.cwd();
  const fixturesRoot = join(cwd, "fixtures");
  if (absPath === fixturesRoot || absPath.startsWith(`${fixturesRoot}/`)) {
    return true;
  }
  const extra = process.env.BLOCKSMITH_SCAN_ALLOW_PATHS?.trim();
  if (extra) {
    for (const p of extra.split(",")) {
      const t = p.trim();
      if (t && (absPath === t || absPath.startsWith(`${t}/`))) return true;
    }
  }
  if (process.env.NODE_ENV !== "production") {
    return absPath === cwd || absPath.startsWith(`${cwd}/`);
  }
  return false;
}

export function parseScanRequest(body: {
  fixture?: string;
  github?: string;
  workspace?: string;
  clientScan?: ClientScanPayload;
}): ScanRequest {
  if (body.clientScan?.markdown?.trim()) {
    return { mode: "clientScan", payload: body.clientScan };
  }
  const gh = body.github?.trim();
  if (gh) return { mode: "github", github: gh };

  const fixture = body.fixture?.trim();
  if (fixture === "vendor") return { mode: "fixture", fixture: "vendor" };

  const ws = body.workspace?.trim() || process.env.BLOCKSMITH_WORKSPACE?.trim();
  if (ws) return { mode: "workspace", workspace: ws };

  throw new Error(
    "Scan requires one of: github URL, fixture:vendor, workspace path, or clientScan payload. " +
      "For a repo on your laptop use: blocksmith scan /path/to/repo (scans locally, uploads to server).",
  );
}

export async function runScanService(
  request: ScanRequest,
  origin: string,
): Promise<ScanServiceResult & { wikiUrl: string }> {
  process.env.AI_LAB_SCAN_CURATE = process.env.AI_LAB_SCAN_CURATE ?? "0";

  if (request.mode === "clientScan") {
    const result = await persistClientScan(request.payload);
    clearDesignSystemCache();
    await bootstrapRegistryAfterScan(result.docRef);
    return formatResult(result, "clientScan", origin);
  }

  if (request.mode === "fixture") {
    const startMs = Date.now();
    const result = await scanAndPersist(fixtureRoot(request.fixture));
    clearDesignSystemCache();
    await bootstrapRegistryAfterScan(result.docRef);
    return { ...formatResult(result, "fixture", origin), scanMs: Date.now() - startMs };
  }

  if (request.mode === "github") {
    const parsed = parseGithubUrl(request.github);
    const token = request.token ?? process.env.GITHUB_TOKEN?.trim();
    const { workspaceRoot, cleanup, cloneMs } = await cloneGithubRepo(parsed, {
      token,
    });
    try {
      const startMs = Date.now();
      const result = await scanAndPersist(workspaceRoot, {
        githubRepo: `${parsed.owner}/${parsed.repo}`,
        writeSnapshot: false,
      });
      clearDesignSystemCache();
      await bootstrapRegistryAfterScan(result.docRef);
      return {
        ...formatResult(result, "github", origin),
        githubUrl: parsed.url,
        cloneMs,
        scanMs: Date.now() - startMs,
      };
    } finally {
      cleanup();
    }
  }

  const workspaceRoot = resolveWorkspaceRoot(request.workspace);
  if (!isAllowedServerWorkspacePath(workspaceRoot)) {
    throw new Error(
      `Server cannot scan path "${workspaceRoot}". ` +
        "Use `blocksmith scan /path` from your machine (client scan upload), " +
        "or pass a github URL, or fixture:vendor.",
    );
  }

  const startMs = Date.now();
  const result = await scanAndPersist(workspaceRoot);
  clearDesignSystemCache();
  await bootstrapRegistryAfterScan(result.docRef);
  return { ...formatResult(result, "workspace", origin), scanMs: Date.now() - startMs };
}

function formatResult(
  result: ScanPersistResult,
  scanMode: ScanRequest["mode"],
  origin: string,
): ScanServiceResult & { wikiUrl: string } {
  const base = origin.replace(/\/$/, "");
  return {
    ...result,
    scanMode,
    wikiUrl: `${base}${result.wikiPath}`,
  };
}

/** Bootstrap the version registry after scan so Pipeline is populated on Vercel. */
async function bootstrapRegistryAfterScan(docRef: string): Promise<void> {
  const { ensurePipelineRegistry } = await import("@/lib/ir/ensure-pipeline-registry");
  // forceSync: scan is a write path — the awaited (batched) push guarantees the
  // next cold lambda hydrates this scan's registry from Supabase.
  await ensurePipelineRegistry(docRef, { forceSync: true });
}

/** Local scan for CLI — no server filesystem required on host. */
export async function runClientScanExport(
  workspace: string,
): Promise<ClientScanPayload> {
  process.env.AI_LAB_SCAN_CURATE = process.env.AI_LAB_SCAN_CURATE ?? "0";
  return scanWorkspaceToPayload(resolveWorkspaceRoot(workspace));
}
