import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

/**
 * Per-repo BlockSmith config (`.blocksmith/blocksmith.json`) — committed to the
 * customer repo so `blocksmith check` and the git hook know which design system
 * to govern against without re-passing --doc every time.
 */
export type RepoConfig = {
  docRef?: string;
};

export function repoConfigPath(workspaceRoot: string): string {
  return join(workspaceRoot, ".blocksmith", "blocksmith.json");
}

export function readRepoConfig(workspaceRoot: string): RepoConfig {
  const path = repoConfigPath(workspaceRoot);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as RepoConfig;
  } catch {
    return {};
  }
}

export function writeRepoConfig(workspaceRoot: string, config: RepoConfig): string {
  const path = repoConfigPath(workspaceRoot);
  mkdirSync(dirname(path), { recursive: true });
  const merged = { ...readRepoConfig(workspaceRoot), ...config };
  writeFileSync(path, `${JSON.stringify(merged, null, 2)}\n`, "utf-8");
  return path;
}

/** Resolve the doc ref to check against: --doc flag → repo config. */
export function resolveDocRef(
  workspaceRoot: string,
  explicit?: string,
): string | undefined {
  if (explicit?.trim()) return explicit.trim();
  return readRepoConfig(workspaceRoot).docRef;
}
