import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
} from "fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { join } from "path";
import { tmpdir } from "os";
import * as tar from "tar";
import { resolveWorkspaceRoot } from "./workspace-root";
import { Octokit } from "@octokit/rest";

export type ParsedGithubRepo = {
  owner: string;
  repo: string;
  branch?: string;
  url: string;
};

export type CloneResult = {
  workspaceRoot: string;
  cleanup: () => void;
  cloneMs: number;
};

const GITHUB_RE =
  /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/([^/]+))?\/?$/i;

const GITHUB_SHORT_RE = /^([^/]+)\/([^/]+)$/;

export function parseGithubUrl(input: string): ParsedGithubRepo {
  const raw = input.trim().replace(/\/$/, "");
  const m = raw.match(GITHUB_RE);
  if (m) {
    return {
      owner: m[1],
      repo: m[2].replace(/\.git$/i, ""),
      branch: m[3],
      url: `https://github.com/${m[1]}/${m[2].replace(/\.git$/i, "")}`,
    };
  }
  const short = raw.match(GITHUB_SHORT_RE);
  if (short && !raw.includes("://") && !raw.startsWith("/")) {
    return {
      owner: short[1],
      repo: short[2],
      url: `https://github.com/${short[1]}/${short[2]}`,
    };
  }
  throw new Error(
    `Invalid GitHub URL: "${input}". Use https://github.com/org/repo or org/repo`,
  );
}

async function resolveArchiveRef(
  parsed: ParsedGithubRepo,
  token?: string,
): Promise<string> {
  if (parsed.branch?.trim()) return parsed.branch.trim();

  const { data } = await new Octokit({ auth: token, userAgent: "BlockSmith" }).rest.repos.get({
    owner: parsed.owner,
    repo: parsed.repo,
  });
  return data.default_branch?.trim() || "main";
}

function extractedRepoRoot(destDir: string): string {
  const entries = readdirSync(destDir);
  if (entries.length !== 1) {
    throw new Error(
      `Unexpected GitHub archive layout (${entries.length} top-level entries)`,
    );
  }
  return join(destDir, entries[0]);
}

async function extractTarball(archive: ArrayBuffer, destDir: string): Promise<string> {
  await pipeline(Readable.from(Buffer.from(archive)), tar.x({ cwd: destDir }));
  return extractedRepoRoot(destDir);
}

/**
 * Download repo via GitHub API tarball — works on Vercel (no git binary required).
 */
export async function cloneGithubRepo(
  parsed: ParsedGithubRepo,
  opts?: { token?: string },
): Promise<CloneResult> {
  const base = join(tmpdir(), "blocksmith-clone-");
  const dir = mkdtempSync(base);
  const startMs = Date.now();

  try {
    const ref = await resolveArchiveRef(parsed, opts?.token);
    const { data } = await new Octokit({ auth: opts?.token, userAgent: "BlockSmith" })
      .rest.repos.downloadTarballArchive({ owner: parsed.owner, repo: parsed.repo, ref });
    const extracted = await extractTarball(data as ArrayBuffer, dir);
    const root = resolveWorkspaceRoot(extracted);
    if (!existsSync(root)) {
      throw new Error(`Extracted repo missing at ${extracted}`);
    }

    return {
      workspaceRoot: root,
      cleanup: () => {
        try {
          rmSync(dir, { recursive: true, force: true });
        } catch {
          /* best-effort */
        }
      },
      cloneMs: Date.now() - startMs,
    };
  } catch (err) {
    rmSync(dir, { recursive: true, force: true });
    throw err;
  }
}
