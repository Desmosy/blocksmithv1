import { existsSync, readFileSync } from "fs";
import { join } from "path";

export type WorkspaceConfig = {
  workspaceId?: string;
  scanPaths?: string[];
  catalogPaths?: string[];
  /** Write scan snapshot into vendor repo at .blocksmith/scan-snapshot.md */
  exportSnapshot?: boolean;
};

export type LoadedWorkspaceConfig = WorkspaceConfig & {
  /** true when workspaceId came from blocksmith.config.json (not package.json fallback) */
  workspaceIdExplicit: boolean;
};

export type CatalogOverrides = {
  /** Always show in Component Library (design primitives). */
  forceFeatured?: string[];
  /** Inventoried but never featured. */
  forceInventoryOnly?: string[];
  /** Skip entirely (not in inventory). */
  exclude?: string[];
};

const EMPTY_CONFIG: WorkspaceConfig = {};
const EMPTY_OVERRIDES: CatalogOverrides = {};

function readJson<T>(path: string): T | null {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return null;
  }
}

/**
 * Attempt to read package.json "name" as a stable workspace identifier.
 * Only used when no blocksmith.config.json provides an explicit workspaceId.
 */
function packageJsonName(workspaceRoot: string): string | undefined {
  try {
    const raw = readJson<{ name?: string }>(join(workspaceRoot, "package.json"));
    const name = raw?.name?.trim();
    if (!name) return undefined;
    // Strip npm scope (@org/name → name)
    const stripped = name.replace(/^@[^/]+\//, "");
    return stripped || undefined;
  } catch {
    return undefined;
  }
}

export function loadWorkspaceConfig(workspaceRoot: string): LoadedWorkspaceConfig {
  const raw =
    readJson<WorkspaceConfig>(join(workspaceRoot, "blocksmith.config.json")) ??
    readJson<WorkspaceConfig>(join(workspaceRoot, ".blocksmith", "config.json"));
  if (!raw) {
    const fallbackId = packageJsonName(workspaceRoot);
    return {
      ...(fallbackId ? { workspaceId: fallbackId } : {}),
      workspaceIdExplicit: false,
    };
  }
  const explicitId =
    typeof raw.workspaceId === "string" ? raw.workspaceId.trim() : undefined;
  return {
    workspaceId: explicitId || packageJsonName(workspaceRoot),
    workspaceIdExplicit: !!explicitId,
    scanPaths: Array.isArray(raw.scanPaths)
      ? raw.scanPaths.map((p) => String(p).trim()).filter(Boolean)
      : undefined,
    catalogPaths: Array.isArray(raw.catalogPaths)
      ? raw.catalogPaths.map((p) => String(p).trim()).filter(Boolean)
      : undefined,
    exportSnapshot:
      typeof raw.exportSnapshot === "boolean" ? raw.exportSnapshot : undefined,
  };
}

export function loadCatalogOverrides(workspaceRoot: string): CatalogOverrides {
  const raw = readJson<CatalogOverrides>(
    join(workspaceRoot, ".blocksmith", "catalog.json"),
  );
  if (!raw) return EMPTY_OVERRIDES;
  const pick = (key: keyof CatalogOverrides) =>
    Array.isArray(raw[key])
      ? (raw[key] as string[]).map((p) => String(p).trim()).filter(Boolean)
      : undefined;
  return {
    forceFeatured: pick("forceFeatured"),
    forceInventoryOnly: pick("forceInventoryOnly"),
    exclude: pick("exclude"),
  };
}

export function pathPatternFromGlobish(relPath: string): RegExp {
  const escaped = relPath
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\//g, "[/\\\\]");
  return new RegExp(escaped, "i");
}

export function normalizeRelPath(relPath: string): string {
  return relPath.replace(/\\/g, "/");
}

export function pathMatchesList(relPath: string, patterns: string[]): boolean {
  const norm = normalizeRelPath(relPath);
  return patterns.some((p) => {
    const pat = normalizeRelPath(p);
    return norm === pat || norm.endsWith(`/${pat}`) || norm.includes(pat);
  });
}

export function resolveScanRoots(
  workspaceRoot: string,
  config?: WorkspaceConfig,
): string[] {
  const env = process.env.BLOCKSMITH_SCAN_PATHS?.trim();
  if (env) {
    return env.split(",").map((p) => p.trim()).filter(Boolean);
  }
  if (config?.scanPaths?.length) {
    return config.scanPaths.filter((rel) => {
      try {
        return existsSync(join(workspaceRoot, rel));
      } catch {
        return false;
      }
    });
  }
  const candidates = ["src", "app", "components", "packages", "styles"];
  return candidates.filter((rel) => {
    try {
      return existsSync(join(workspaceRoot, rel));
    } catch {
      return false;
    }
  });
}

export function catalogPathPatterns(
  config?: WorkspaceConfig,
): RegExp[] {
  const patterns: RegExp[] = [];
  if (config?.catalogPaths?.length) {
    for (const p of config.catalogPaths) {
      patterns.push(pathPatternFromGlobish(p));
    }
  }
  const env = process.env.BLOCKSMITH_CATALOG_PATHS?.trim();
  if (env) {
    for (const p of env.split(",")) {
      const t = p.trim();
      if (t) patterns.push(pathPatternFromGlobish(t));
    }
  }
  return patterns;
}
