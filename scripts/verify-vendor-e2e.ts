/**
 * Core goal #1 — full vendor scan outside BlockSmith:
 * scanAndPersist → published .md on disk → wiki parse consistent.
 *
 * Usage: npm run verify:vendor-e2e
 * External repo (manual): BLOCKSMITH_WORKSPACE=/path/to/vendor npm run verify:vendor-e2e
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { scanWorkspace } from "../src/lib/scan/extract";
import { parseWorkspaceScanMarkdown } from "../src/lib/scan/parse";
import { resolveUploadPath } from "../src/lib/uploads/store";

const DEFAULT_FIXTURE = join(process.cwd(), "fixtures", "vendor-ui");

function loadEnvLocal() {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  loadEnvLocal();
  process.env.AI_LAB_SCAN_CURATE = "0";

  const workspaceRoot = process.env.BLOCKSMITH_WORKSPACE?.trim() || DEFAULT_FIXTURE;
  const isFixture = workspaceRoot.endsWith("fixtures/vendor-ui");

  const { scanAndPersist } = await import("../src/lib/scan/run");
  const facts = scanWorkspace(workspaceRoot);

  console.log("Vendor E2E scan verification");
  console.log(`  Workspace:  ${workspaceRoot}`);
  console.log(`  Fixture:    ${isFixture ? "yes" : "external"}`);

  const persisted = await scanAndPersist(workspaceRoot);
  const publishedPath = resolveUploadPath(persisted.fileName);

  if (!existsSync(publishedPath)) {
    console.error(`\nFAILED: missing published scan at ${publishedPath}`);
    process.exit(1);
  }

  const published = readFileSync(publishedPath, "utf-8");
  const system = parseWorkspaceScanMarkdown(published, publishedPath);
  const errors: string[] = [];

  const featuredIds = new Set(facts.components.map((c) => c.id));
  const invMissing = facts.inventory.filter((f) => !published.includes(f.filePath));

  if (invMissing.length) {
    errors.push(`Published .md missing ${invMissing.length} inventory path(s)`);
  }

  if (system.mode !== "workspace-scan") {
    errors.push(`Expected workspace-scan mode, got ${system.mode}`);
  }

  if ((system.scanInventory?.length ?? 0) !== facts.inventory.length) {
    errors.push(
      `Parsed inventory ${system.scanInventory?.length ?? 0} !== scan ${facts.inventory.length}`,
    );
  }

  if (system.components.length !== facts.components.length) {
    errors.push(
      `Parsed featured ${system.components.length} !== scan ${facts.components.length}`,
    );
  }

  if (!system.colors.length && facts.cssVars.length) {
    errors.push("Parsed zero designer colors despite CSS vars in scan");
  }

  if (!system.scanCoverage?.reactFiles) {
    errors.push("Missing scanCoverage in parse");
  }

  if (persisted.curated) {
    errors.push("E2E vendor scan must be facts-only (AI_LAB_SCAN_CURATE=0)");
  }

  if (isFixture) {
    if (persisted.fileName !== "scan-acme-ui-kit.md") {
      errors.push(
        `Fixture expects stable filename scan-acme-ui-kit.md (workspaceId), got ${persisted.fileName}`,
      );
    }
    const snapshotPath = join(workspaceRoot, ".blocksmith", "scan-snapshot.md");
    if (!existsSync(snapshotPath)) {
      errors.push(`Missing vendor snapshot at ${snapshotPath}`);
    }
    if (facts.inventory.length < 5) {
      errors.push(`Fixture expects >= 5 React files, got ${facts.inventory.length}`);
    }
    if (facts.components.length < 4) {
      errors.push(`Fixture expects >= 4 featured primitives, got ${facts.components.length}`);
    }
    for (const id of ["button", "card", "badge", "input"]) {
      if (!featuredIds.has(id)) errors.push(`Missing featured: ${id}`);
    }
    const shell = facts.inventory.find((f) => f.filePath.includes("AppShell"));
    if (!shell) errors.push("AppShell should be inventoried");
    else if (shell.featured) errors.push("AppShell must not be featured");
    if (!facts.designDocs.some((d) => d.filePath === "DESIGN.md")) {
      errors.push("DESIGN.md should be discovered");
    }
  } else {
    if (facts.components.length < 1) {
      errors.push("External vendor scan found zero featured components");
    }
    if (facts.inventory.length < 1) {
      errors.push("External vendor scan found zero React inventory");
    }
  }

  console.log(`  Published:  ${persisted.fileName}`);
  console.log(`  Doc ref:    ${persisted.docRef}`);
  console.log(`  Inventory:  ${facts.inventory.length} React files`);
  console.log(`  Featured:   ${facts.components.length} (${[...featuredIds].join(", ")})`);
  console.log(`  Colors:     ${system.colors.length}`);
  console.log(`  CSS vars:   ${system.scanCssVars?.length ?? 0}`);
  console.log(`  Wiki:       http://localhost:3000${persisted.wikiPath}`);

  if (errors.length) {
    console.error("\nFAILED:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log("\nOK — vendor scan persisted and wiki-parse consistent (core goal #1).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
