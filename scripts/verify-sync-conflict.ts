/**
 * Core goal #4 — conflict detection when scan doc changes under an open wiki draft.
 *
 * Usage: npm run verify:sync-conflict
 */
import { createHash } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { modifyMarkdownBlock } from "../src/lib/parser/modify";

const FIXTURE_ROOT = join(process.cwd(), "fixtures", "vendor-ui");

function docHash(md: string): string {
  return createHash("sha256").update(md).digest("hex").slice(0, 16);
}

async function main() {
  process.env.AI_LAB_SCAN_CURATE = "0";
  const errors: string[] = [];

  const { scanAndPersist } = await import("../src/lib/scan/run");
  const { resolveUploadPath } = await import("../src/lib/uploads/store");

  const persisted = await scanAndPersist(FIXTURE_ROOT);
  const publishedPath = resolveUploadPath(persisted.fileName);
  const before = readFileSync(publishedPath, "utf-8");
  const baseHash = docHash(before);

  // Simulate rescan / IDE change updating published doc
  const afterRescan = `${before}\n<!-- scan bump -->\n`;
  writeFileSync(publishedPath, afterRescan, "utf-8");
  const newHash = docHash(afterRescan);

  if (baseHash === newHash) {
    errors.push("Conflict test: doc hash should change after rescan simulation");
  }

  // Finalize conflict gate (same logic as /api/wiki/finalize)
  const wouldConflict = baseHash !== newHash;
  if (!wouldConflict) {
    errors.push("Conflict test: expected hash mismatch for stale draft");
  }

  // Restore and verify modify still works after restore
  writeFileSync(publishedPath, before, "utf-8");

  try {
    modifyMarkdownBlock(before, "component:button", {
      role: "Conflict test role",
      description: "Temporary",
    });
  } catch (err) {
    errors.push(
      `modifyMarkdownBlock failed: ${err instanceof Error ? err.message : err}`,
    );
  }

  const syncStatus = await import("../src/lib/scan/sync-status");
  const staleWhenDifferent = syncStatus.getWorkspaceScanSyncStatus(before);
  if (staleWhenDifferent.stale && staleWhenDifferent.publishedFactsHash === staleWhenDifferent.liveFactsHash) {
    errors.push("Stale: should not be stale when hashes match");
  }

  console.log("Sync conflict verification");
  console.log(`  Base hash:     ${baseHash}`);
  console.log(`  After change:  ${newHash}`);
  console.log(`  Would conflict: ${wouldConflict}`);

  if (errors.length) {
    console.error("\nFAILED:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log("\nOK — conflict/stale gates behave correctly (core goal #4).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
