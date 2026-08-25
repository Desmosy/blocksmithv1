/**
 * Goal 1 — second vendor repo (always runs on fixtures/external-mini).
 * Optional override: BLOCKSMITH_VENDOR_TEST_WORKSPACE=/real/path
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { scanWorkspace } from "../src/lib/scan/extract";
import { parseWorkspaceScanMarkdown } from "../src/lib/scan/parse";

const DEFAULT_EXTERNAL = join(process.cwd(), "fixtures", "external-mini");

async function main() {
  const root =
    process.env.BLOCKSMITH_VENDOR_TEST_WORKSPACE?.trim() || DEFAULT_EXTERNAL;

  if (!existsSync(root)) {
    console.error(`External vendor verify: path not found: ${root}`);
    process.exit(1);
  }

  process.env.AI_LAB_SCAN_CURATE = "0";
  const { scanAndPersist } = await import("../src/lib/scan/run");
  const { resolveUploadPath } = await import("../src/lib/uploads/paths");

  const facts = scanWorkspace(root);
  const persisted = await scanAndPersist(root);
  const published = readFileSync(resolveUploadPath(persisted.fileName), "utf-8");
  const system = parseWorkspaceScanMarkdown(published, persisted.fileName);
  const errors: string[] = [];

  const usingFixture = root === DEFAULT_EXTERNAL;
  const expectedFile = usingFixture
    ? "scan-external-mini.md"
    : undefined;

  if (expectedFile && persisted.fileName !== expectedFile) {
    errors.push(`expected ${expectedFile}, got ${persisted.fileName}`);
  }
  if (facts.inventory.length < 1) errors.push("zero inventory");
  if (facts.components.length < 1) {
    errors.push(
      "zero featured — add blocksmith.config.json catalogPaths in vendor repo",
    );
  }
  if (system.mode !== "workspace-scan") errors.push("wrong wiki mode");

  console.log("External vendor verify");
  console.log(`  Workspace: ${root}`);
  console.log(`  Fixture:   ${usingFixture ? "external-mini (built-in)" : "custom path"}`);
  console.log(`  Published: ${persisted.fileName}`);
  console.log(`  Inventory: ${facts.inventory.length}`);
  console.log(`  Featured:  ${facts.components.length}`);

  if (errors.length) {
    console.error("\nFAILED:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log("\nOK — external vendor scan E2E passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
