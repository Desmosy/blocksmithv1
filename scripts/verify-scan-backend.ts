/**
 * Goal 1 backend — unified scan service, path guards, client upload, GitHub parse.
 */
import { join } from "path";
import { parseGithubUrl } from "../src/lib/scan/github";
import {
  isAllowedServerWorkspacePath,
  parseScanRequest,
  runScanService,
  runClientScanExport,
} from "../src/lib/scan/service";
import { parseWorkspaceScanMarkdown } from "../src/lib/scan/parse";
import { resolveUploadPath } from "../src/lib/uploads/paths";
import { readFileSync } from "fs";

async function main() {
  const errors: string[] = [];
  const origin = "http://localhost:3000";
  process.env.AI_LAB_SCAN_CURATE = "0";

  const parsed = parseGithubUrl("https://github.com/acme/widgets");
  if (parsed.owner !== "acme" || parsed.repo !== "widgets") {
    errors.push("parseGithubUrl failed");
  }

  const vendorFixture = join(process.cwd(), "fixtures", "vendor-ui");
  const externalFixture = join(process.cwd(), "fixtures", "external-mini");
  const outside = process.platform === "win32" ? "C:\\Windows" : "/usr";

  if (!isAllowedServerWorkspacePath(vendorFixture)) {
    errors.push("vendor fixture should be allowed on server");
  }
  if (!isAllowedServerWorkspacePath(externalFixture)) {
    errors.push("external-mini fixture should be allowed on server");
  }
  if (isAllowedServerWorkspacePath(outside)) {
    errors.push("random path should be blocked on server");
  }

  try {
    await runScanService(
      parseScanRequest({ workspace: outside }),
      origin,
    );
    errors.push("expected blocked server path scan to throw");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("cannot scan path")) {
      errors.push(`unexpected error for blocked path: ${msg}`);
    }
  }

  const fixtureResult = await runScanService(
    parseScanRequest({ fixture: "vendor" }),
    origin,
  );
  if (fixtureResult.scanMode !== "fixture") {
    errors.push(`fixture scanMode expected fixture, got ${fixtureResult.scanMode}`);
  }

  const payload = await runClientScanExport(externalFixture);
  if (!payload.markdown.includes("external-mini")) {
    errors.push("client export missing project name in markdown");
  }

  const uploadResult = await runScanService(
    { mode: "clientScan", payload },
    origin,
  );
  if (uploadResult.scanMode !== "clientScan") {
    errors.push(`upload scanMode expected clientScan, got ${uploadResult.scanMode}`);
  }

  const published = readFileSync(resolveUploadPath(uploadResult.fileName), "utf-8");
  const system = parseWorkspaceScanMarkdown(published, uploadResult.fileName);
  if (system.mode !== "workspace-scan") errors.push("client upload wiki parse failed");

  console.log("Scan backend verification");
  console.log(`  Fixture scan:   ${fixtureResult.fileName} (${fixtureResult.scanMode})`);
  console.log(`  Client upload:  ${uploadResult.fileName} (${uploadResult.scanMode})`);
  console.log(`  GitHub parse:   ${parsed.owner}/${parsed.repo}`);

  if (errors.length) {
    console.error("\nFAILED:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log("\nOK — unified scan backend (fixture + client upload + guards).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
