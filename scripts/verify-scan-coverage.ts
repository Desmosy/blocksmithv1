/**
 * Verify published scan .md inventory matches deterministic scan facts.
 * Usage: npm run scan:verify
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { scanWorkspace } from "../src/lib/scan/extract";
import { workspaceScanToMarkdown } from "../src/lib/scan/to-markdown";
import { resolveUploadPath } from "../src/lib/uploads/store";

/** Vendor fixture — not BlockSmith's own src/ (see verify-vendor-fixture.ts). */
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
const { fileName } = workspaceScanToMarkdown(result);
const published = readFileSync(resolveUploadPath(fileName), "utf-8");

const missing = result.inventory.filter((f) => !published.includes(f.filePath));
const extra = published.match(/\| `([^`]+\.tsx)` \|/g)?.length ?? 0;

console.log("Scan coverage verification");
console.log(`  Deterministic inventory: ${result.inventory.length} React files`);
console.log(`  Published table rows:    ${extra}`);
console.log(`  Missing from published:  ${missing.length}`);

if (missing.length > 0) {
  console.error("\nMissing paths:");
  for (const m of missing.slice(0, 10)) console.error(`  - ${m.filePath}`);
  process.exit(1);
}

console.log("\nOK — published .md contains every inventoried React file.");
