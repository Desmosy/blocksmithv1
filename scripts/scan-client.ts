/**
 * CLI local scan — read vendor repo on developer machine, emit JSON for API upload.
 *
 *   npx tsx scripts/scan-client.ts --workspace /path/to/vendor
 */
import { runClientScanExport } from "../src/lib/scan/service";

async function main() {
  const idx = process.argv.indexOf("--workspace");
  const workspace = idx >= 0 ? process.argv[idx + 1] : process.argv[2];
  if (!workspace?.trim()) {
    console.error("Usage: scan-client.ts --workspace /path/to/repo");
    process.exit(1);
  }

  process.env.AI_LAB_SCAN_CURATE = process.env.AI_LAB_SCAN_CURATE ?? "0";
  const payload = await runClientScanExport(workspace.trim());
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
