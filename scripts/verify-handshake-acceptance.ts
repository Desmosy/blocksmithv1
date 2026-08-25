/**
 * Core goal #3 — handshake acceptance (automated checks for 08-web-ide-handshake.md).
 *
 * Usage: npm run verify:handshake-acceptance
 */
import { createHash } from "crypto";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { NextRequest } from "next/server";
import { clearDesignSystemCache, loadDesignSystem } from "../src/lib/clients/registry";
import { refreshBlocksForDoc } from "../src/lib/blocks/refresh";
import {
  handleGetComponentDocs,
} from "../src/mcp/handlers";
import { getWorkspaceScanSyncStatus } from "../src/lib/scan/sync-status";
import { resolveUploadPath } from "../src/lib/uploads/store";
import { readUploadMarkdownContent } from "../src/lib/uploads/persist";
import { POST as finalizePost } from "../src/app/api/wiki/finalize/route";
import { uploadOverridesFileName } from "../src/lib/scan/upload-overrides";

const FIXTURE_ROOT = join(process.cwd(), "fixtures", "vendor-ui");
const BUTTON_PATH = join(FIXTURE_ROOT, "src/components/ui/Button.tsx");
const MARKER = "#fefefe";
const TEST_ROLE = "Handshake acceptance writeback role";
const TEST_DESC = "Written by verify-handshake-acceptance.";

async function ensureWriteback(docRef: string, fileName: string): Promise<void> {
  const baseMd = await readUploadMarkdownContent(fileName);
  const baseHash = createHash("sha256")
    .update(baseMd)
    .digest("hex")
    .slice(0, 16);

  // Save-to-staging + promote in one shot. Under the save≠promote model a bare
  // finalize only stages a DRAFT; agents (MCP) deliberately keep serving the
  // last promoted version until a human promotes. To assert MCP↔wiki parity we
  // must complete the governed loop, so pass `promote: true`.
  const req = new NextRequest("http://localhost/api/wiki/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      doc: docRef,
      blockId: "component:button",
      updatedData: { role: TEST_ROLE, description: TEST_DESC },
      baseContentHash: baseHash,
      promote: true,
    }),
  });

  const res = await finalizePost(req);
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error ?? `Finalize setup failed (${res.status})`);
  }
}

async function main() {
  process.env.BLOCKSMITH_SAAS_STRICT = "0";
  process.env.AI_LAB_SCAN_CURATE = "0";

  const errors: string[] = [];
  const { scanAndPersist } = await import("../src/lib/scan/run");

  console.log("Handshake acceptance verification");

  // --- 1. IDE → Web: file change → rescan → published .md updates ---
  const originalButton = readFileSync(BUTTON_PATH, "utf-8");
  if (!originalButton.includes("#ffffff")) {
    errors.push("Fixture Button.tsx missing #ffffff baseline");
  }

  const mutatedButton = originalButton.replace("#ffffff", MARKER);
  writeFileSync(BUTTON_PATH, mutatedButton, "utf-8");

  try {
    const persisted = await scanAndPersist(FIXTURE_ROOT);
    const publishedPath = resolveUploadPath(persisted.fileName);
    const published = readFileSync(publishedPath, "utf-8");

    if (!published.includes(MARKER)) {
      errors.push(`IDE→Web: published scan missing ${MARKER} after Button change`);
    }

    const sync = getWorkspaceScanSyncStatus(published);
    if (sync.stale) {
      errors.push("IDE→Web: scan should be fresh immediately after rescan");
    }
    if (!sync.publishedFactsHash || !sync.liveFactsHash) {
      errors.push("IDE→Web: missing scan-facts-hash after rescan");
    }
    if (sync.publishedFactsHash !== sync.liveFactsHash) {
      errors.push("IDE→Web: published and live facts hash should match after rescan");
    }

    console.log(`  IDE→Web:     ${MARKER} in published scan — OK`);

    // --- 2. Web → IDE: finalize + overrides (Goal 2, self-contained) ---
    await ensureWriteback(persisted.docRef, persisted.fileName);

    const overridesPath = join(
      FIXTURE_ROOT,
      ".blocksmith",
      "wiki-overrides.json",
    );
    const sidecarPath = join(
      process.cwd(),
      "data/uploads",
      uploadOverridesFileName(persisted.fileName),
    );
    if (!existsSync(overridesPath)) {
      errors.push("Web→IDE: wiki-overrides.json missing after finalize");
    }
    if (!existsSync(sidecarPath)) {
      errors.push("Web→IDE: cloud sidecar missing after finalize");
    }
    if (!existsSync(join(FIXTURE_ROOT, "DESIGN.md"))) {
      errors.push("Web→IDE: DESIGN.md missing after finalize");
    }
    if (!errors.some((e) => e.startsWith("Web→IDE"))) {
      console.log("  Web→IDE:     DESIGN.md + overrides + cloud sidecar — OK");
    }

    // --- 3. MCP matches wiki ---
    const docRef = persisted.docRef;
    clearDesignSystemCache();
    refreshBlocksForDoc(docRef);
    const system = loadDesignSystem(docRef);
    const wikiButton = system.components.find((c) => c.id === "button");
    const mcp = handleGetComponentDocs({ doc: docRef, names: ["button"] });
    const mcpButton = mcp.components.find((b) => b.id === "component:button");

    if (!wikiButton) errors.push("MCP parity: wiki missing button");
    if (!mcpButton) errors.push("MCP parity: MCP missing component:button");
    if (
      wikiButton &&
      mcpButton &&
      mcpButton.content.role !== wikiButton.role
    ) {
      errors.push(
        `MCP parity: role mismatch wiki="${wikiButton.role}" mcp="${mcpButton.content.role}"`,
      );
    }
    if (
      wikiButton &&
      mcpButton &&
      (mcpButton.content.description ?? "") !== (wikiButton.description ?? "")
    ) {
      errors.push("MCP parity: description mismatch");
    }

    console.log(
      `  MCP=Wiki:    button role "${wikiButton?.role ?? "?"}" — OK`,
    );
  } finally {
    writeFileSync(BUTTON_PATH, originalButton, "utf-8");
    await scanAndPersist(FIXTURE_ROOT);
  }

  if (errors.length) {
    console.error("\nFAILED:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log("\nOK — handshake acceptance checks passed (core goal #3).");
  console.log("  Record 30s demo: see .cursor/handshake-demo.md");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
