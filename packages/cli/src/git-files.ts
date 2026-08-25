import { execSync } from "child_process";
import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";

/** UI/source files worth governing — components, styles, markup. */
const UI_FILE_RE = /\.(tsx?|jsx?|mjs|cjs|css|scss|sass|less|html?|vue|svelte|astro)$/i;

const MAX_FILE_BYTES = 512 * 1024;

function git(cmd: string, cwd: string): string {
  return execSync(`git ${cmd}`, { cwd, encoding: "utf-8" }).trim();
}

export function gitRoot(cwd: string): string | null {
  try {
    const root = git("rev-parse --show-toplevel", cwd);
    return root && existsSync(root) ? root : null;
  } catch {
    return null;
  }
}

export function gitCommit(cwd: string): string | undefined {
  try {
    return git("rev-parse --short HEAD", cwd) || undefined;
  } catch {
    return undefined;
  }
}

export function gitBranch(cwd: string): string | undefined {
  try {
    return git("rev-parse --abbrev-ref HEAD", cwd) || undefined;
  } catch {
    return undefined;
  }
}

export type ChangeScope = "staged" | "working" | "range";

/**
 * List changed UI files relative to the git root.
 * - "staged": index vs HEAD (pre-commit)
 * - "working": working tree + staged (default, catches everything local)
 * - "range":  diff against `base` (CI, e.g. origin/main...HEAD)
 */
export function listChangedUiFiles(
  root: string,
  scope: ChangeScope,
  base?: string,
): string[] {
  let out = "";
  try {
    if (scope === "range" && base) {
      out = git(`diff --name-only --diff-filter=ACMR ${base}`, root);
    } else if (scope === "staged") {
      out = git("diff --name-only --cached --diff-filter=ACMR", root);
    } else {
      // working: tracked changes + staged, plus untracked files
      const tracked = git("diff --name-only --diff-filter=ACMR HEAD", root);
      const untracked = git("ls-files --others --exclude-standard", root);
      out = [tracked, untracked].filter(Boolean).join("\n");
    }
  } catch {
    return [];
  }

  const seen = new Set<string>();
  return out
    .split("\n")
    .map((f) => f.trim())
    .filter((f) => f && UI_FILE_RE.test(f))
    .filter((f) => (seen.has(f) ? false : (seen.add(f), true)));
}

export type LoadedFile = { path: string; relPath: string; code: string };

/** Read changed files from disk, skipping deleted/oversized/binary ones. */
export function readFiles(root: string, relPaths: string[]): LoadedFile[] {
  const files: LoadedFile[] = [];
  for (const rel of relPaths) {
    const abs = join(root, rel);
    if (!existsSync(abs)) continue;
    try {
      if (statSync(abs).size > MAX_FILE_BYTES) continue;
      files.push({ path: abs, relPath: rel, code: readFileSync(abs, "utf-8") });
    } catch {
      /* unreadable — skip */
    }
  }
  return files;
}
