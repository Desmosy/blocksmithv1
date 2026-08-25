import { execSync } from "child_process";

/**
 * Git-linked attribution. The activity ledger defaults to the committer's real
 * git identity (and records the HEAD commit) instead of a self-reported name —
 * so "who did what" is anchored to the repo, not the honor system.
 */

function git(cmd: string): string | null {
  try {
    const out = execSync(`git ${cmd}`, {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    return out || null;
  } catch {
    return null;
  }
}

export function gitAuthor(): string | null {
  const name = git("config user.name");
  const email = git("config user.email");
  if (name && email) return `${name} <${email}>`;
  return name ?? email ?? null;
}

export function gitCommit(): string | null {
  return git("rev-parse --short HEAD");
}
