/**
 * End-to-end checks for workspace-scan wiki correctness.
 * Usage: npm run verify:scan-wiki
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { scanWorkspace } from "../src/lib/scan/extract";
import { parseWorkspaceScanMarkdown } from "../src/lib/scan/parse";
import { workspaceScanToMarkdown } from "../src/lib/scan/to-markdown";
import { resolveUploadPath } from "../src/lib/uploads/store";

/** Vendor fixture — published scan-acme-ui-kit.md is from this workspace. */
const FIXTURE_ROOT = join(process.cwd(), "fixtures", "vendor-ui");

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

loadEnvLocal();

const result = scanWorkspace(FIXTURE_ROOT);
const { fileName, markdown: factsMd } = workspaceScanToMarkdown(result);
const publishedPath = resolveUploadPath(fileName);

if (!existsSync(publishedPath)) {
  console.error(`Missing published scan: ${publishedPath}\nRun: npm run scan`);
  process.exit(1);
}

const published = readFileSync(publishedPath, "utf-8");
const system = parseWorkspaceScanMarkdown(published, publishedPath);

const errors: string[] = [];

if (system.mode !== "workspace-scan") {
  errors.push(`Expected mode workspace-scan, got ${system.mode}`);
}

const invMissing = result.inventory.filter((f) => !published.includes(f.filePath));
if (invMissing.length) {
  errors.push(`Published .md missing ${invMissing.length} inventory path(s)`);
}

if ((system.scanInventory?.length ?? 0) !== result.inventory.length) {
  errors.push(
    `Parsed inventory ${system.scanInventory?.length ?? 0} !== scan ${result.inventory.length}`,
  );
}

if (system.components.length !== result.components.length) {
  errors.push(
    `Parsed featured ${system.components.length} !== scan ${result.components.length}`,
  );
}

for (const c of system.components) {
  if (!c.scan?.sourceFile) {
    errors.push(`Featured component "${c.title}" missing scan metadata`);
  }
}

if (!system.colors.length && result.cssVars.length) {
  errors.push("Parsed zero designer colors despite CSS vars in scan");
}

if (!system.scanCoverage?.reactFiles) {
  errors.push("Missing scanCoverage in frontmatter / parse");
}

console.log("Workspace scan wiki verification");
console.log(`  Published:   ${fileName}`);
console.log(`  Inventory:   ${result.inventory.length} React files`);
console.log(`  Featured:    ${result.components.length}`);
console.log(`  Colors:      ${system.colors.length}`);
console.log(`  CSS vars:    ${system.scanCssVars?.length ?? 0}`);

if (errors.length) {
  console.error("\nFAILED:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log("\nOK — scan, published .md, and wiki parse are consistent.");
