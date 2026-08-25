/**
 * Pattern 2/3/4 — cloud API + SDK smoke test (no running HTTP server required).
 */
import { existsSync, rmSync } from "fs";
import { join } from "path";
import { createApiKey, authenticateApiKey } from "../src/lib/cloud/api-keys";
import { runScanApi } from "../src/lib/cloud/scan-api";
import { runPulseCodegen } from "../src/lib/codegen/run";

const STORE = join(process.cwd(), "data", "cloud", "api-keys.json");

async function main() {
  process.env.BLOCKSMITH_ADMIN_SECRET = "test-admin-secret";
  process.env.AI_LAB_SCAN_CURATE = "0";

  if (existsSync(STORE)) rmSync(STORE);

  const { key } = createApiKey("verify-cloud-api");
  const auth = await authenticateApiKey(key);
  if (!auth) {
    console.error("FAILED: could not authenticate created key");
    process.exit(1);
  }

  const result = await runScanApi({ fixture: "vendor" }, "http://localhost:3000");
  const errors: string[] = [];

  if (result.fileName !== "scan-acme-ui-kit.md") {
    errors.push(`expected scan-acme-ui-kit.md, got ${result.fileName}`);
  }
  if (!result.wikiUrl.includes("scan-acme-ui-kit")) {
    errors.push(`wikiUrl missing scan doc: ${result.wikiUrl}`);
  }
  if (result.components < 4) {
    errors.push(`expected >= 4 featured, got ${result.components}`);
  }

  const pulse = await runPulseCodegen(result.docRef);
  if (pulse.slug !== "acme-ui-kit") {
    errors.push(`pulse slug expected acme-ui-kit, got ${pulse.slug}`);
  }
  if (pulse.cssVarCount < 4) {
    errors.push(`pulse expected >= 4 css vars, got ${pulse.cssVarCount}`);
  }
  if (result.scanMode !== "fixture") {
    errors.push(`expected scanMode fixture, got ${result.scanMode}`);
  }

  const sdkDist = join(process.cwd(), "packages", "sdk", "dist", "index.js");
  const sdkOk = existsSync(sdkDist);

  console.log("Cloud API verification");
  console.log(`  API key:    ${auth.prefix}…`);
  console.log(`  Scan doc:   ${result.docRef}`);
  console.log(`  Wiki:       ${result.wikiUrl}`);
  console.log(`  Featured:   ${result.components}`);
  console.log(`  Pulse pkg:  ${pulse.packageName} (${pulse.cssVarCount} vars)`);
  console.log(`  SDK built:  ${sdkOk ? "yes" : "run npm run build:packages"}`);

  if (errors.length) {
    console.error("\nFAILED:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log("\nOK — cloud API modules + scan path work.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
