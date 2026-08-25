/**
 * P0 SaaS — document ownership + strict-mode ACL gates.
 * Usage: npm run verify:saas-acl
 */
import { existsSync, rmSync } from "fs";
import { join } from "path";
import { NextRequest } from "next/server";
import {
  registerDocument,
  canAccessDocument,
  getDocument,
} from "../src/lib/cloud/documents";
import { POST as finalizePost } from "../src/app/api/wiki/finalize/route";

const DOCS_STORE = join(process.cwd(), "data", "cloud", "documents.json");

async function main() {
  process.env.BLOCKSMITH_SAAS_STRICT = "1";
  if (existsSync(DOCS_STORE)) rmSync(DOCS_STORE);

  const fileName = "scan-test-acl.md";
  const docRef = `upload:${fileName}`;
  const ownerA = "user-a-11111111-1111-1111-1111-111111111111";
  const ownerB = "user-b-22222222-2222-2222-2222-222222222222";

  await registerDocument({
    fileName,
    docRef,
    ownerUserId: ownerA,
    scanMode: "test",
  });

  const doc = await getDocument(fileName);
  if (!doc || doc.ownerUserId !== ownerA) {
    throw new Error("Document registration failed");
  }

  if (!(await canAccessDocument(fileName, ownerA))) {
    throw new Error("Owner A should have access");
  }
  if (await canAccessDocument(fileName, ownerB)) {
    throw new Error("Owner B should be denied");
  }
  if (!(await canAccessDocument(fileName, ownerB, { allowAdminKey: true }))) {
    throw new Error("Admin key should bypass ACL");
  }

  // Finalize without auth should 401 in strict mode
  const req = new NextRequest("http://localhost/api/wiki/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      doc: docRef,
      blockId: "component:button",
      updatedData: { role: "x", description: "y" },
      baseContentHash: "deadbeef",
      force: true,
    }),
  });
  const res = await finalizePost(req);
  if (res.status !== 401) {
    throw new Error(`Expected 401 finalize without auth, got ${res.status}`);
  }

  // Collision: second owner same filename
  let collisionOk = false;
  try {
    await registerDocument({
      fileName,
      docRef,
      ownerUserId: ownerB,
      scanMode: "test",
    });
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("owned by another team")
    ) {
      collisionOk = true;
    }
  }
  if (!collisionOk) {
    throw new Error("Expected filename collision error for second owner");
  }

  console.log("[verify:saas-acl] OK");
  console.log("  ownership register + ACL deny/allow");
  console.log("  finalize 401 without session");
  console.log("  filename collision guard");
}

main().catch((err) => {
  console.error("[verify:saas-acl] FAIL", err);
  process.exit(1);
});
