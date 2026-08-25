/**
 * Prove workspace-scan works outside BlockSmith itself (no LLM).
 * Usage: npm run verify:vendor-fixture
 */
import { join } from "path";
import { scanWorkspace } from "../src/lib/scan/extract";
import { parseWorkspaceScanMarkdown } from "../src/lib/scan/parse";
import { workspaceScanToMarkdown } from "../src/lib/scan/to-markdown";

const FIXTURE_ROOT = join(process.cwd(), "fixtures", "vendor-ui");

const result = scanWorkspace(FIXTURE_ROOT);
const { markdown, fileName } = workspaceScanToMarkdown(result);
const system = parseWorkspaceScanMarkdown(markdown, "fixtures/vendor-ui/scan.md");

const errors: string[] = [];

if (result.workspaceId !== "acme-ui-kit") {
  errors.push(`Expected workspaceId acme-ui-kit, got ${result.workspaceId ?? "none"}`);
}
if (fileName !== "scan-acme-ui-kit.md") {
  errors.push(`Expected stable filename scan-acme-ui-kit.md, got ${fileName}`);
}

const featuredIds = new Set(result.components.map((c) => c.id));
const inventoryPaths = new Set(result.inventory.map((f) => f.filePath));

const missing = result.inventory.filter((f) => !markdown.includes(f.filePath));
if (missing.length) {
  errors.push(`Markdown missing ${missing.length} inventory path(s)`);
}

if (result.inventory.length < 5) {
  errors.push(`Expected >= 5 inventoried React files, got ${result.inventory.length}`);
}

if (result.components.length < 4) {
  errors.push(`Expected >= 4 featured primitives, got ${result.components.length}`);
}

for (const id of ["button", "card", "badge", "input"]) {
  if (!featuredIds.has(id)) {
    errors.push(`Missing featured component: ${id}`);
  }
}

if (inventoryPaths.has("src/components/ui/Button.tsx") === false) {
  errors.push("Button.tsx not in inventory");
}

const shell = result.inventory.find((f) => f.filePath.includes("AppShell"));
if (!shell) {
  errors.push("AppShell should be inventoried");
} else if (shell.featured) {
  errors.push("AppShell must not be featured (app chrome)");
}

if (result.cssVars.length < 6) {
  errors.push(`Expected >= 6 CSS vars from globals.css, got ${result.cssVars.length}`);
}

if (system.mode !== "workspace-scan") {
  errors.push(`Parse mode should be workspace-scan, got ${system.mode}`);
}

if ((system.scanInventory?.length ?? 0) !== result.inventory.length) {
  errors.push("Parsed inventory count mismatch");
}

if (system.components.length !== result.components.length) {
  errors.push("Parsed featured count mismatch");
}

console.log("Vendor fixture scan verification");
console.log(`  Workspace:  ${FIXTURE_ROOT}`);
console.log(`  Inventory:  ${result.inventory.length} React files`);
console.log(`  Featured:   ${result.components.length} (${[...featuredIds].join(", ")})`);
console.log(`  CSS vars:   ${result.cssVars.length}`);
console.log(`  Colors:     ${result.colors.length}`);

if (errors.length) {
  console.error("\nFAILED:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log("\nOK — vendor fixture scan pipeline is consistent (facts-only, no LLM).");
