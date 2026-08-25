/**
 * Goal 1 — GitHub scan full E2E: clone → scan → persist → wiki parse.
 *
 *   npm run verify:github-scan
 *   BLOCKSMITH_VERIFY_GITHUB=radix-ui/themes npm run verify:github-scan
 */
import { existsSync, readFileSync } from "fs";
import { parseGithubUrl, cloneGithubRepo } from "../src/lib/scan/github";
import { scanAndPersist } from "../src/lib/scan/run";
import { parseWorkspaceScanMarkdown } from "../src/lib/scan/parse";
import { resolveUploadPath } from "../src/lib/uploads/paths";

const DEFAULT_REPO = "shadcn-ui/ui";

async function main() {
  const repo =
    process.env.BLOCKSMITH_VERIFY_GITHUB?.trim() || DEFAULT_REPO;

  console.log("GitHub scan verification (full persist E2E)");
  console.log(`  Repo: ${repo}`);

  process.env.AI_LAB_SCAN_CURATE = "0";
  const errors: string[] = [];

  const parsed = parseGithubUrl(repo);
  if (!parsed.owner || !parsed.repo) {
    errors.push("parseGithubUrl returned empty owner/repo");
  }
  console.log(`  Parsed: ${parsed.owner}/${parsed.repo} → ${parsed.url}`);

  let cloneResult: Awaited<ReturnType<typeof cloneGithubRepo>>;
  try {
    cloneResult = await cloneGithubRepo(parsed);
  } catch (err) {
    console.error(
      `\nFAILED — clone error: ${err instanceof Error ? err.message : err}`,
    );
    process.exit(1);
  }
  console.log(
    `  Cloned: ${cloneResult.workspaceRoot} (${(cloneResult.cloneMs / 1000).toFixed(1)}s)`,
  );

  try {
    const startPersist = Date.now();
    const persisted = await scanAndPersist(cloneResult.workspaceRoot, {
      githubRepo: `${parsed.owner}/${parsed.repo}`,
      writeSnapshot: false,
    });
    const persistMs = Date.now() - startPersist;

    const uploadPath = resolveUploadPath(persisted.fileName);
    if (!existsSync(uploadPath)) {
      errors.push(`upload missing: ${uploadPath}`);
    }

    const published = readFileSync(uploadPath, "utf-8");
    const system = parseWorkspaceScanMarkdown(published, persisted.fileName);

    console.log(`  Persist: ${persisted.fileName} (${(persistMs / 1000).toFixed(1)}s)`);
    console.log(`  Doc ref: ${persisted.docRef}`);
    console.log(`  Inventory: ${persisted.reactFiles} React files`);
    console.log(`  Featured:  ${persisted.components}`);
    console.log(`  Colors:    ${persisted.colors}`);
    console.log(`  Wiki:      ${system.name}`);

    if (persisted.reactFiles < 1) errors.push("zero inventory after persist");
    if (!persisted.fileName.startsWith("scan-")) {
      errors.push(`unexpected filename: ${persisted.fileName}`);
    }
    if (!published.includes(`github-repo: ${parsed.owner}/${parsed.repo}`)) {
      errors.push("published markdown missing github-repo frontmatter");
    }
    if (system.mode !== "workspace-scan") {
      errors.push(`wiki mode: ${system.mode}`);
    }
    if (!system.nav || system.nav.length < 2) {
      errors.push("wiki nav too small");
    }

    console.log(
      `  Total: clone ${(cloneResult.cloneMs / 1000).toFixed(1)}s + persist ${(persistMs / 1000).toFixed(1)}s`,
    );
  } finally {
    cloneResult.cleanup();
  }

  if (errors.length) {
    console.error("\nFAILED:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`\nOK — GitHub scan full E2E passed (${repo}).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
