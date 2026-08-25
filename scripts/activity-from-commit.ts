/**
 * Record real commit activity after a successful git commit.
 * Called by .githooks/post-commit — one ledger per BLOCKSMITH_DOC (per vendor upload).
 *
 *   BLOCKSMITH_DOC=upload:design-abc.md npm run activity:from-commit
 */
import { execSync } from "child_process";
import { loadDocForAiLab } from "@/ai-lab/shared/load-doc";
import { logActivityFromCommit } from "@/lib/activity/from-commit";
import { gitAuthor, gitCommit } from "@/lib/activity/git";

function sh(cmd: string): string {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

function main() {
  const docRef = process.env.BLOCKSMITH_DOC?.trim() || "apollo.md";
  const commit = gitCommit();
  if (!commit) {
    console.log("[activity] not a git repo — skip");
    process.exit(0);
  }

  const files = sh("git diff-tree --no-commit-id --name-only -r HEAD")
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);

  const uiFiles = files.filter((f) => /\.(tsx?|jsx?|css|scss)$/i.test(f));
  if (!uiFiles.length) {
    process.exit(0);
  }

  const summary = sh("git log -1 --pretty=%B");
  const { system } = loadDocForAiLab(docRef);

  const logged = logActivityFromCommit({
    docRef,
    components: system.components,
    files: uiFiles,
    summary,
    author: gitAuthor(),
    commit,
    contentHash: system.contentHash,
  });

  if (logged.length === 0) {
    console.log(
      `[activity] ${docRef} · commit ${commit} · ${uiFiles.length} UI file(s) — no component match`,
    );
    process.exit(0);
  }

  for (const e of logged) {
    console.log(
      `[activity] ${docRef} · ${e.componentTitle ?? e.componentId} · ${e.author} · ${commit}`,
    );
  }
}

main();
