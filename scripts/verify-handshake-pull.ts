/**
 * Goal 2 — SaaS pull E2E: finalize → pull API payload → DESIGN.md on disk.
 *
 * Usage: npm run verify:handshake-pull
 */
import { createHash } from "crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { NextRequest } from "next/server";
import {
  updateWikiOverrides,
  writeDesignMd,
  writeLock,
} from "../packages/sdk/dist/design-md.js";
import { createApiKey } from "../src/lib/cloud/api-keys";
import { POST as finalizePost } from "../src/app/api/wiki/finalize/route";
import { GET as pullGet } from "../src/app/api/v1/scans/pull/route";
import {
  pullOverridesPayload,
  readUploadWikiOverrides,
} from "../src/lib/scan/upload-overrides";
import { readUploadMarkdownContent } from "../src/lib/uploads/persist";

const FIXTURE_ROOT = join(process.cwd(), "fixtures", "vendor-ui");
const TEST_ROLE = "SaaS pull test role — finalized in cloud";
const TEST_DESC = "Only this component was finalized; pull must not dump catalog defaults.";

async function callFinalize(docRef: string, baseMd: string): Promise<void> {
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
  process.env.BLOCKSMITH_ADMIN_SECRET = "test-admin-secret";

  const { scanAndPersist } = await import("../src/lib/scan/run");
  const persisted = await scanAndPersist(FIXTURE_ROOT);
  const docRef = persisted.docRef;
  const baseMd = await readUploadMarkdownContent(persisted.fileName);

  const beforePull = pullOverridesPayload(await readUploadWikiOverrides(persisted.fileName));
  if (Object.keys(beforePull).length > 0) {
    console.warn("  Note: sidecar had prior overrides; test continues");
  }

  await callFinalize(docRef, baseMd);

  const { key } = createApiKey("verify-handshake-pull");
  const pullReq = new NextRequest(
    `http://localhost/api/v1/scans/pull?docRef=${encodeURIComponent(docRef)}`,
    { headers: { Authorization: `Bearer ${key}` } },
  );
  const pullRes = await pullGet(pullReq);
  const pullData = await pullRes.json();

  const errors: string[] = [];

  if (!pullRes.ok) {
    errors.push(`Pull API failed: ${pullData.error ?? pullRes.status}`);
  }

  if (pullData.finalizedCount !== 1) {
    errors.push(`Pull finalizedCount expected 1, got ${pullData.finalizedCount}`);
  }
  if (pullData.overrides?.button?.role !== TEST_ROLE) {
    errors.push("Pull API missing finalized button role");
  }
  if (Object.keys(pullData.overrides ?? {}).length > 3) {
    errors.push("Pull returned too many components (likely scan defaults leaked)");
  }

  // New: pull must deliver the full design system, not just the delta.
  if (!pullData.fullMarkdown || typeof pullData.fullMarkdown !== "string") {
    errors.push("Pull API missing fullMarkdown (full DESIGN.md export)");
  } else {
    if (!pullData.fullMarkdown.includes(TEST_ROLE)) {
      errors.push("fullMarkdown missing finalized governance (role not merged)");
    }
    if (!/##\s+Components/i.test(pullData.fullMarkdown)) {
      errors.push("fullMarkdown missing Components section");
    }
  }
  if (!pullData.stats || pullData.stats.components < 1) {
    errors.push("Pull API missing stats.components");
  }
  // The full export should carry more components than the single finalized one.
  if (pullData.stats && pullData.stats.components <= 1) {
    errors.push("Full export should include the whole catalog, not one component");
  }
  if (!pullData.lock) {
    errors.push("Pull API missing lock (blocksmith.lock payload)");
  }

  const tempRoot = mkdtempSync(join(tmpdir(), "blocksmith-pull-"));
  try {
    // Mirror the real CLI: full DESIGN.md + lock + overrides sidecar.
    writeDesignMd(tempRoot, pullData.fullMarkdown as string);
    updateWikiOverrides(
      tempRoot,
      pullData.overrides as Record<string, { role: string; description: string }>,
    );
    if (pullData.lock) writeLock(tempRoot, pullData.lock);

    const designMd = join(tempRoot, "DESIGN.md");
    const overridesJson = join(tempRoot, ".blocksmith", "wiki-overrides.json");
    const lockFile = join(tempRoot, "blocksmith.lock");

    if (!existsSync(designMd)) {
      errors.push("CLI pull simulation missing DESIGN.md");
    } else {
      const md = readFileSync(designMd, "utf-8");
      if (!md.includes(TEST_ROLE)) {
        errors.push("CLI pull simulation DESIGN.md missing finalized role");
      }
      if (!/##\s+Components/i.test(md)) {
        errors.push("CLI pull simulation DESIGN.md missing full Components section");
      }
    }
    if (!existsSync(overridesJson)) {
      errors.push("CLI pull simulation missing wiki-overrides.json");
    }
    if (pullData.lock && !existsSync(lockFile)) {
      errors.push("CLI pull simulation missing blocksmith.lock");
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }

  console.log("Handshake pull verification");
  console.log(`  Doc ref:        ${docRef}`);
  console.log(`  Finalized:      ${pullData.finalizedCount}`);
  console.log(`  Pull components: ${Object.keys(pullData.overrides ?? {}).join(", ") || "(none)"}`);
  console.log(`  Full export:    ${pullData.stats?.components ?? 0} components, ${pullData.stats?.colors ?? 0} colors`);
  console.log(`  Lock:           ${pullData.lock ? "present" : "(none)"}`);

  if (errors.length) {
    console.error("\nFAILED:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log("\nOK — SaaS pull E2E passed (Goal 2).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
