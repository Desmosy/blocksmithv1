/**
 * Goal 2 — Web → IDE writeback for workspace-scan docs.
 * Finalize via HTTP → cloud sidecar + local vendor DESIGN.md survives rescan.
 *
 * Usage: npm run verify:handshake-writeback
 */
import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { NextRequest } from "next/server";
import { scanWorkspace } from "../src/lib/scan/extract";
import { parseWorkspaceScanMarkdown } from "../src/lib/scan/parse";
import {
  readWikiOverrides,
  OVERRIDES_DIR,
  OVERRIDES_FILE,
} from "../src/lib/scan/overrides";
import {
  pullOverridesPayload,
  readUploadWikiOverrides,
  uploadOverridesFileName,
} from "../src/lib/scan/upload-overrides";
import { workspaceScanToMarkdown } from "../src/lib/scan/to-markdown";
import { resolveUploadPath } from "../src/lib/uploads/store";
import { readUploadMarkdownContent } from "../src/lib/uploads/persist";
import { POST as finalizePost } from "../src/app/api/wiki/finalize/route";

const FIXTURE_ROOT = join(process.cwd(), "fixtures", "vendor-ui");
const TEST_ROLE = "Primary CTA for vendor flows (wiki finalized)";
const TEST_DESC = "Use for main actions only. Min width 120px.";

async function callFinalize(
  docRef: string,
  baseMd: string,
): Promise<void> {
  const baseHash = createHash("sha256")
    .update(baseMd)
    .digest("hex")
    .slice(0, 16);

  const req = new NextRequest("http://localhost/api/wiki/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      doc: docRef,
      blockId: "component:button",
      updatedData: { role: TEST_ROLE, description: TEST_DESC },
      baseContentHash: baseHash,
    }),
  });

  const res = await finalizePost(req);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? `Finalize failed (${res.status})`);
  }
}

async function main() {
  process.env.BLOCKSMITH_SAAS_STRICT = "0";
  process.env.AI_LAB_SCAN_CURATE = "0";

  const { scanAndPersist } = await import("../src/lib/scan/run");
  const persisted = await scanAndPersist(FIXTURE_ROOT);
  const docRef = persisted.docRef;
  const baseMd = await readUploadMarkdownContent(persisted.fileName);

  await callFinalize(docRef, baseMd);

  const publishedPath = resolveUploadPath(persisted.fileName);
  const published = readFileSync(publishedPath, "utf-8");
  const errors: string[] = [];

  const cloudOverrides = await readUploadWikiOverrides(persisted.fileName);
  const pullPayload = pullOverridesPayload(cloudOverrides);

  if (Object.keys(pullPayload).length !== 1) {
    errors.push(
      `Expected 1 finalized override in cloud sidecar, got ${Object.keys(pullPayload).length}`,
    );
  }
  if (pullPayload.button?.role !== TEST_ROLE) {
    errors.push("Cloud sidecar missing button role");
  }

  const sidecarPath = join(
    process.cwd(),
    "data/uploads",
    uploadOverridesFileName(persisted.fileName),
  );
  if (!existsSync(sidecarPath)) {
    errors.push(`Missing upload sidecar: ${sidecarPath}`);
  }

  const overridesPath = join(FIXTURE_ROOT, OVERRIDES_DIR, OVERRIDES_FILE);
  if (!existsSync(overridesPath)) {
    errors.push(`Missing vendor override file: ${overridesPath}`);
  }

  const overrides = readWikiOverrides(FIXTURE_ROOT);
  if (overrides.components.button?.role !== TEST_ROLE) {
    errors.push("Override file missing button role");
  }
  if (overrides.components.button?.description !== TEST_DESC) {
    errors.push("Override file missing button description");
  }

  const designMdPath = join(FIXTURE_ROOT, "DESIGN.md");
  if (!existsSync(designMdPath)) {
    errors.push(`Missing DESIGN.md: ${designMdPath}`);
  } else {
    const designMd = readFileSync(designMdPath, "utf-8");
    if (!designMd.includes(TEST_ROLE) || !designMd.includes("## Button")) {
      errors.push("DESIGN.md does not contain finalized role for Button");
    }
  }

  const rescanned = scanWorkspace(FIXTURE_ROOT);
  const { markdown: rescannedMd } = workspaceScanToMarkdown(rescanned);
  const system = parseWorkspaceScanMarkdown(rescannedMd, publishedPath);

  const button = system.components.find((c) => c.id === "button");
  if (!button) {
    errors.push("Rescan parse missing button component");
  } else {
    if (button.role !== TEST_ROLE) {
      errors.push(`Rescan role mismatch: ${button.role}`);
    }
    if (button.description !== TEST_DESC) {
      errors.push(`Rescan description mismatch: ${button.description}`);
    }
  }

  if (!published.includes(TEST_ROLE)) {
    errors.push("Published markdown missing finalized role after HTTP finalize");
  }

  console.log("Handshake writeback verification");
  console.log(`  Workspace:   ${FIXTURE_ROOT}`);
  console.log(`  Doc ref:     ${docRef}`);
  console.log(`  Sidecar:     ${sidecarPath}`);
  console.log(`  Pull count:  ${Object.keys(pullPayload).length}`);
  console.log(`  Button role: ${button?.role ?? "(missing)"}`);

  if (errors.length) {
    console.error("\nFAILED:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log("\nOK — HTTP finalize writeback survives vendor rescan (Goal 2).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
