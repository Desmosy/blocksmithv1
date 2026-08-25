/**
 * Goal 2.5 E2E — governance finalize → pull → DESIGN.md (no LLM required).
 * Usage: npm run verify:governance-e2e
 */
import { createHash } from "crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { NextRequest } from "next/server";
import {
  updateDesignMd,
  updateWikiOverrides,
} from "../packages/sdk/dist/design-md.js";
import { createApiKey } from "../src/lib/cloud/api-keys";
import { POST as finalizePost } from "../src/app/api/wiki/finalize/route";
import { GET as pullGet } from "../src/app/api/v1/scans/pull/route";
import { readUploadMarkdownContent } from "../src/lib/uploads/persist";

const FIXTURE_ROOT = join(process.cwd(), "fixtures", "vendor-ui");
const GOV_ROLE = "Governance E2E — primary CTA only";
const GOV_DESC = "Do: one per view. Don't: stack primary buttons.";

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
      updatedData: { role: GOV_ROLE, description: GOV_DESC },
      baseContentHash: baseHash,
    }),
  });

  const res = await finalizePost(req);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Finalize failed (${res.status})`);
}

async function main() {
  process.env.BLOCKSMITH_SAAS_STRICT = "0";
  process.env.AI_LAB_SCAN_CURATE = "0";

  const { scanAndPersist } = await import("../src/lib/scan/run");
  const persisted = await scanAndPersist(FIXTURE_ROOT);
  const docRef = persisted.docRef;
  const baseMd = await readUploadMarkdownContent(persisted.fileName);

  await callFinalize(docRef, baseMd);

  const { key } = createApiKey("governance-e2e");
  const pullReq = new NextRequest(
    `http://localhost/api/v1/scans/pull?docRef=${encodeURIComponent(docRef)}`,
    { headers: { Authorization: `Bearer ${key}` } },
  );
  const pullRes = await pullGet(pullReq);
  const pullData = await pullRes.json();
  if (!pullRes.ok) throw new Error(pullData.error ?? "Pull failed");

  const workspace = mkdtempSync(join(tmpdir(), "blocksmith-gov-e2e-"));
  try {
    for (const [id, data] of Object.entries(
      pullData.overrides as Record<string, { role: string; description: string }>,
    )) {
      updateDesignMd(workspace, id, data);
    }
    updateWikiOverrides(
      workspace,
      pullData.overrides as Record<string, { role: string; description: string }>,
    );

    const designMd = readFileSync(join(workspace, "DESIGN.md"), "utf-8");
    if (!designMd.includes(GOV_ROLE)) {
      throw new Error("DESIGN.md missing governance role after pull");
    }
    if (!designMd.includes("primary CTA")) {
      throw new Error("DESIGN.md missing governance content");
    }
  } finally {
    if (existsSync(workspace)) rmSync(workspace, { recursive: true, force: true });
  }

  console.log("[verify:governance-e2e] OK");
  console.log("  finalize → pull → DESIGN.md");
}

main().catch((err) => {
  console.error("[verify:governance-e2e] FAIL", err);
  process.exit(1);
});
