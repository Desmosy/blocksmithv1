/**
 * Phase 2 — generate @blocksmith/<slug> from workspace-scan .md
 *
 *   npm run codegen:pulse
 *   BLOCKSMITH_DOC=upload:scan-acme-ui-kit.md npm run codegen:pulse
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { runPulseCodegen } from "../src/lib/codegen/run";

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
  const result = await runPulseCodegen(process.env.BLOCKSMITH_DOC);

  console.log("Pulse codegen complete");
  console.log(`  Source doc:  ${result.docRef}`);
  console.log(`  Resolved:    ${result.resolvedFrom}`);
  console.log(`  Package:     ${result.packageName}`);
  console.log(`  Output:      ${result.outDir}`);
  console.log(`  CSS vars:    ${result.cssVarCount}`);
  console.log(`  Components:  ${result.componentCount}`);
  console.log("");
  console.log("Import:");
  console.log(result.importExample);
  console.log("");
  console.log("Next:");
  console.log("  npm run build:pulse");
  console.log("  npm run verify:pulse");
  console.log(`  open http://localhost:3000${result.demoUrl}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
