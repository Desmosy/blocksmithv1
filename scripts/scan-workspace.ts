/**
 * Scan vendor workspace → facts → (optional) LLM curate → wiki .md
 *
 *   npm run scan
 *   BLOCKSMITH_WORKSPACE=/path/to/vendor-app npm run scan
 *   AI_LAB_SCAN_CURATE=1 npm run scan
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";

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

  const { scanCurateEnabled } = await import("../src/ai-lab/09-scan-curate");
  const { scanAndPersist } = await import("../src/lib/scan/run");

  console.log("Scanning workspace (deterministic facts)…");
  if (scanCurateEnabled()) {
    console.log(
      "LLM curation enabled — writing designer .md (typically 30–90s, not instant)…",
    );
  }

  const result = await scanAndPersist();

  console.log("Workspace scan complete");
  console.log(`  Project:    ${result.projectName}`);
  console.log(`  Workspace:  ${result.workspaceRoot}`);
  console.log(`  Doc ref:    ${result.docRef}`);
  console.log(`  Markdown:   data/uploads/${result.fileName}`);
  console.log(
    `  Curated:    ${result.curated ? `yes (${result.curatedModel ?? "cached"})` : `no${result.curateReason ? ` — ${result.curateReason}` : ""}`}`,
  );
  console.log(`  Colors:     ${result.colors}`);
  console.log(`  React:      ${result.reactFiles} inventoried`);
  console.log(`  Featured:   ${result.components}`);
  console.log(`  Files:      ${result.filesScanned}`);
  console.log(`  Wiki:       http://localhost:3000${result.wikiPath}`);
  console.log(
    `  Set BLOCKSMITH_DOC=${result.docRef} in MCP env to govern this workspace.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
