import { existsSync } from "fs";
import { execSync } from "child_process";

/** Pick where `pull` writes DESIGN.md — explicit flag → scan path → git root → cwd. */
export function resolvePullWorkspace(opts: {
  explicit?: string;
  suggestedFromScan?: string;
}): { path: string; reason: string } {
  if (opts.explicit?.trim()) {
    return { path: opts.explicit.trim(), reason: "--workspace flag" };
  }

  const suggested = opts.suggestedFromScan?.trim();
  if (suggested && existsSync(suggested)) {
    return { path: suggested, reason: "workspace-root from scan doc" };
  }

  try {
    const gitRoot = execSync("git rev-parse --show-toplevel", {
      encoding: "utf-8",
    }).trim();
    if (gitRoot && existsSync(gitRoot)) {
      return { path: gitRoot, reason: "git repository root" };
    }
  } catch {
    /* not in a git repo */
  }

  return { path: process.cwd(), reason: "current directory" };
}
