/**
 * Team/org RBAC — roles, invites, document access.
 * Usage: npm run verify:org-rbac
 */
import { existsSync, rmSync } from "fs";
import { join } from "path";
import { canPerform } from "../src/lib/cloud/rbac";
import {
  ensureDefaultOrg,
  getMemberRole,
  inviteOrgMember,
  acceptPendingInvites,
} from "../src/lib/cloud/orgs";
import {
  registerDocument,
  canAccessDocument,
} from "../src/lib/cloud/documents";

const ORGS_STORE = join(process.cwd(), "data", "cloud", "orgs.json");
const DOCS_STORE = join(process.cwd(), "data", "cloud", "documents.json");

const OWNER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const MEMBER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const VIEWER = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const OUTSIDER = "dddddddd-dddd-dddd-dddd-dddddddddddd";

async function main() {
  process.env.BLOCKSMITH_SAAS_STRICT = "1";
  if (existsSync(ORGS_STORE)) rmSync(ORGS_STORE);
  if (existsSync(DOCS_STORE)) rmSync(DOCS_STORE);

  if (!canPerform("viewer", "read")) throw new Error("viewer should read");
  if (canPerform("viewer", "write")) throw new Error("viewer should not write");
  if (!canPerform("member", "write")) throw new Error("member should write");

  const org = await ensureDefaultOrg(OWNER, "owner-user");
  await inviteOrgMember(org.id, OWNER, "member@test.com", "member");
  await inviteOrgMember(org.id, OWNER, "viewer@test.com", "viewer");

  const linked = await acceptPendingInvites(MEMBER, "member@test.com");
  if (linked !== 1) throw new Error(`Expected 1 invite accepted, got ${linked}`);

  await acceptPendingInvites(VIEWER, "viewer@test.com");

  const memberRole = await getMemberRole(org.id, MEMBER);
  if (memberRole !== "member") throw new Error(`Expected member role, got ${memberRole}`);

  const fileName = "scan-org-rbac-test.md";
  await registerDocument({
    fileName,
    docRef: `upload:${fileName}`,
    ownerUserId: OWNER,
    orgId: org.id,
    scanMode: "test",
  });

  if (!(await canAccessDocument(fileName, MEMBER, { action: "write" }))) {
    throw new Error("Member should write");
  }
  if (await canAccessDocument(fileName, VIEWER, { action: "write" })) {
    throw new Error("Viewer should not write");
  }
  if (!(await canAccessDocument(fileName, VIEWER, { action: "read" }))) {
    throw new Error("Viewer should read");
  }
  if (await canAccessDocument(fileName, OUTSIDER, { action: "read" })) {
    throw new Error("Outsider should be denied");
  }

  console.log("[verify:org-rbac] OK");
  console.log("  roles + invite-by-email + org document ACL");
}

main().catch((err) => {
  console.error("[verify:org-rbac] FAIL", err);
  process.exit(1);
});
