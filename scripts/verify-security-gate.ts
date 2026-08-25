/**
 * P0 Security release gate — default-deny + import-list lockdown.
 * Extends verify:saas-acl: asserts unregistered private docs deny access, that
 * the named demo + bundled samples stay public, and that GET /api/wiki/import
 * refuses to leak metadata to anonymous callers in strict mode.
 *
 * Usage: npm run verify:security-gate
 */
import { existsSync, rmSync } from "fs";
import { join } from "path";
import {
  canAccessDocument,
  registerDocument,
  setDocumentPublished,
} from "../src/lib/cloud/documents";
import { isPublicContent } from "../src/lib/cloud/saas";
import { GET as importGet } from "../src/app/api/wiki/import/route";

const DOCS_STORE = join(process.cwd(), "data", "cloud", "documents.json");

async function main() {
  process.env.BLOCKSMITH_SAAS_STRICT = "1";
  if (existsSync(DOCS_STORE)) rmSync(DOCS_STORE);

  // 1. DEFAULT DENY — an unregistered private doc is never world-readable.
  const orphan = "unregistered-secret-12345678.md";
  if (await canAccessDocument(orphan, null)) {
    throw new Error("Unregistered doc must DENY anonymous read (default deny)");
  }
  if (await canAccessDocument(orphan, "some-signed-in-user")) {
    throw new Error("Unregistered doc must DENY a signed-in non-owner too");
  }
  console.log("  OK unregistered private doc → deny (anon + signed in)");

  // 2. Explicit public content stays readable without a session.
  if (!isPublicContent("scan-acme-ui-kit.md")) {
    throw new Error("Named demo doc must remain public");
  }
  if (!isPublicContent("apollo.md")) {
    throw new Error("Bundled sample apollo.md must remain public");
  }
  if (isPublicContent("upload:scan-acme-ui-kit.md")) {
    throw new Error("upload: refs must not be treated as public");
  }
  if (await canAccessDocument("scan-acme-ui-kit.md", null)) {
    // demo is public → canAccessDocument returns true
  } else {
    throw new Error("Demo doc canAccessDocument should allow anonymous read");
  }
  console.log("  OK demo + bundled samples stay public");

  // 3. Admin key bypass still works for server-trusted infra.
  if (!(await canAccessDocument(orphan, null, { allowAdminKey: true }))) {
    throw new Error("Admin key should bypass ownership");
  }
  console.log("  OK admin API key bypass preserved");

  // 4. GET /api/wiki/import must 401 anonymous in strict mode (no metadata leak).
  const res = await importGet();
  if (res.status !== 401) {
    throw new Error(
      `Expected 401 from anonymous GET /api/wiki/import, got ${res.status}`,
    );
  }
  const body = await res.json();
  if (body.uploads) {
    throw new Error("Anonymous import GET must not return an uploads list");
  }
  console.log("  OK GET /api/wiki/import → 401 anonymous (no cross-tenant list)");

  // 5. Opt-in publishing — published docs are anon-readable, but only for reads,
  // and unpublishing closes access again.
  const pubFile = "published-site-doc-abcdef12.md";
  await registerDocument({
    fileName: pubFile,
    docRef: `upload:${pubFile}`,
    ownerUserId: "owner-pub-33333333-3333-3333-3333-333333333333",
    scanMode: "test",
  });
  if (await canAccessDocument(pubFile, null)) {
    throw new Error("Unpublished doc must deny anonymous read");
  }
  await setDocumentPublished(pubFile, true);
  if (!(await canAccessDocument(pubFile, null))) {
    throw new Error("Published doc must allow anonymous read");
  }
  if (await canAccessDocument(pubFile, null, { action: "write" })) {
    throw new Error("Published doc must still deny anonymous WRITE");
  }
  await setDocumentPublished(pubFile, false);
  if (await canAccessDocument(pubFile, null)) {
    throw new Error("Unpublishing must close anonymous read again");
  }
  console.log("  OK publish → public read; unpublish → deny; write stays denied");

  console.log("[verify:security-gate] OK");
}

main().catch((err) => {
  console.error("[verify:security-gate] FAIL", err);
  process.exit(1);
});
