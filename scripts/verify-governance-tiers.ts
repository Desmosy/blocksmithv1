/**
 * Three-tier governance loop E2E: detect (block + warn) → record event →
 * list in feed → resolve. Exercises POST/GET/PATCH /api/v1/governance/events.
 *
 * Usage: npm run verify:governance-tiers
 */
import { NextRequest } from "next/server";
import { createApiKey } from "../src/lib/cloud/api-keys";
import { createHash } from "crypto";
import {
  GET as eventsGet,
  PATCH as eventsPatch,
  POST as eventsPost,
} from "../src/app/api/v1/governance/events/route";
import { POST as finalizePost } from "../src/app/api/wiki/finalize/route";
import { readUploadMarkdownContent } from "../src/lib/uploads/persist";

const FIXTURE_ROOT = `${process.cwd()}/fixtures/vendor-ui`;

// Governance prose that compiles to warn-tier heuristics (inactive link + old date).
// Targets a component that exists in the vendor fixture (button).
const GOV_COMPONENT = "button";
const GOV_ROLE = "Primary action";
const GOV_DESC =
  "Do not include inactive links or old dates in button copy. Keep labels current.";

// A snippet that trips BOTH tiers: off-token hex (block) + inactive link & stale date (warn).
const BAD_CODE = `
export function Footer() {
  return (
    <footer style={{ color: "#abc123" }}>
      <a href="#">Legacy deals (closed 2019)</a>
    </footer>
  );
}
`;

async function jsonOf(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

async function main() {
  process.env.BLOCKSMITH_SAAS_STRICT = "0";
  process.env.AI_LAB_SCAN_CURATE = "0";
  process.env.BLOCKSMITH_ADMIN_SECRET = "test-admin-secret";

  const { scanAndPersist } = await import("../src/lib/scan/run");
  const persisted = await scanAndPersist(FIXTURE_ROOT);
  const docRef = persisted.docRef;

  // Finalize Footer governance prose so prose rules compile.
  const baseMd = await readUploadMarkdownContent(persisted.fileName);
  const baseHash = createHash("sha256").update(baseMd).digest("hex").slice(0, 16);
  const finReq = new NextRequest("http://localhost/api/wiki/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      doc: docRef,
      blockId: `component:${GOV_COMPONENT}`,
      updatedData: { role: GOV_ROLE, description: GOV_DESC },
      baseContentHash: baseHash,
      force: true,
    }),
  });
  const finRes = await finalizePost(finReq);
  if (!finRes.ok) {
    const body = await jsonOf(finRes);
    throw new Error(`Finalize governance prose failed: ${body.error}`);
  }

  const { key } = createApiKey("verify-governance-tiers");
  const auth = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const errors: string[] = [];

  // 1. Detect (no record).
  const detectRes = await eventsPost(
    new NextRequest("http://localhost/api/v1/governance/events", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        docRef,
        code: BAD_CODE,
        component: GOV_COMPONENT,
        filePath: "src/Button.tsx",
      }),
    }),
  );
  const detect = await jsonOf(detectRes);
  if (!detectRes.ok) errors.push(`Detect failed: ${detect.error}`);
  if ((detect.blockCount as number) < 1) {
    errors.push("Expected a block-tier finding (off-token hex #abc123)");
  }
  if ((detect.warnCount as number) < 1) {
    errors.push("Expected a warn-tier finding (inactive link / old date prose)");
  }
  if (detect.governed !== false) {
    errors.push("Expected governed=false with a blocking finding");
  }
  // Tier-3 prescriptive fix: off-token color finding must suggest a token.
  const findings = (detect.findings as Array<{ ruleId: string; suggestion?: string }>) ?? [];
  const colorFinding = findings.find((f) => f.ruleId === "off-token-color");
  if (!colorFinding?.suggestion || !/replace/i.test(colorFinding.suggestion)) {
    errors.push("Off-token color finding missing a nearest-token suggestion");
  }
  if (detect.event !== null) {
    errors.push("Detect without record must not create an event");
  }

  // 2. Override with reason (record). Block present → action should be a bypass.
  const recordRes = await eventsPost(
    new NextRequest("http://localhost/api/v1/governance/events", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        docRef,
        code: BAD_CODE,
        component: GOV_COMPONENT,
        filePath: "src/Button.tsx",
        record: true,
        source: "git-hook",
        action: "bypass",
        author: "@verify",
        commit: "abc1234",
        overrideReason: "Removing in follow-up PR; legal asked to keep temporarily",
      }),
    }),
  );
  const recorded = await jsonOf(recordRes);
  const event = recorded.event as { id: string; status: string } | null;
  if (!event?.id) errors.push("Record did not return an event id");

  // 3. List the feed — the event should appear, open.
  const listRes = await eventsGet(
    new NextRequest(
      `http://localhost/api/v1/governance/events?docRef=${encodeURIComponent(docRef)}`,
      { headers: auth },
    ),
  );
  const listed = await jsonOf(listRes);
  const events = (listed.events as Array<{ id: string; status: string; overrideReason?: string }>) ?? [];
  const mine = events.find((e) => e.id === event?.id);
  if (!mine) errors.push("Recorded event not found in feed");
  if (mine && mine.status !== "open") errors.push("New event should be open");

  // 4. Resolve it.
  if (event?.id) {
    const patchRes = await eventsPatch(
      new NextRequest("http://localhost/api/v1/governance/events", {
        method: "PATCH",
        headers: auth,
        body: JSON.stringify({ id: event.id, status: "resolved" }),
      }),
    );
    const patched = await jsonOf(patchRes);
    if (!patchRes.ok || patched.status !== "resolved") {
      errors.push("Resolve (PATCH) failed");
    }
  }

  console.log("Governance tiers verification");
  console.log(`  Doc ref:     ${docRef}`);
  console.log(`  Block-tier:  ${detect.blockCount} (off-token color)`);
  console.log(`  Warn-tier:   ${detect.warnCount} (prose rules)`);
  console.log(`  Event:       ${event?.id ?? "(none)"} → recorded → resolved`);

  if (errors.length) {
    console.error("\nFAILED:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log("\nOK — three-tier governance loop passed (detect → capture → feed → resolve).");
}

main().catch((err) => {
  console.error("[verify:governance-tiers] FAIL", err);
  process.exit(1);
});
