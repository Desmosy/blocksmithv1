/**
 * verify:ir-cicd — end-to-end proof of the Design CI/CD closed loop
 * (research doc §6.1) against the IR version registry:
 *
 *   INGEST → version 1 records, scan facts auto-promoted, governance staged
 *   BUILD  → official graph + deterministic lock
 *   STAGE  → changed governance becomes draft vN+1, lock untouched
 *   PROMOTE→ official pointer advances, old lock detected STALE
 *   LOCK   → rebuilt lock fresh again
 *   ENFORCE→ agents only ever see official content, never drafts/conflicts
 *   ROLLBACK→ pointer returns to vN-1, lock catches the revert
 *   COMPILE→ device-sim + tokens.h from the same graph, loss measured
 *
 * Runs on a synthetic doc ref so it never pollutes real registries.
 */
import { existsSync, rmSync } from "fs";
import { join } from "path";
import type { StoredBlock } from "@/lib/blocks/content";
import {
  getOfficialBlocks,
  getOfficialGraph,
  getBlockHistory,
  promoteBlock,
  recordIngest,
  rollbackBlock,
} from "@/lib/ir/registry";
import { buildLock, verifyLock } from "@/lib/ir/lock";
import { compileDeviceSim, deviceCompileLoss } from "@/lib/ir/targets/device-sim";
import { emitTokensHeader } from "@/lib/ir/targets/c-header";

// Unique per run so re-runs never collide, even when the FS denies deletes.
const DOC = `verify:ir-cicd-${Date.now().toString(36)}.md`;
const SYSTEM = "verify-ir-cicd";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (ok) console.log(`  ✅ ${label}`);
  else {
    failures += 1;
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function mkBlock(partial: Partial<StoredBlock> & { id: string }): StoredBlock {
  return {
    type: "token",
    title: partial.id,
    source: { file: "verify.css" },
    updatedAt: new Date().toISOString(),
    contentHash: "",
    status: "finalized",
    docRef: DOC,
    content: {},
    ...partial,
  } as StoredBlock;
}

// Clean slate (best-effort — DOC is unique per run regardless)
const regDir = join(
  process.cwd(),
  ".blocksmith",
  "registry",
  DOC.replace(/[^a-zA-Z0-9._-]/g, "_"),
);
try {
  if (existsSync(regDir)) rmSync(regDir, { recursive: true });
} catch {
  /* sandboxed FS may deny deletes */
}

const accent = mkBlock({
  id: "token:color:accent",
  title: "Accent",
  content: { value: "#d97757", cssVar: "--color-accent", summary: "CTA" },
});
const button = mkBlock({
  id: "component:button-primary",
  type: "component",
  title: "Primary Button",
  content: { role: "Primary CTA", radius: "12px" },
});
const rule = mkBlock({
  id: "agent-rule:cta-density",
  type: "agent-rule",
  title: "CTA density",
  status: "draft",
  content: { text: "Max one primary CTA per view" },
});

// ── INGEST ────────────────────────────────────────────────────────────────
console.log("\nINGEST");
const r1 = recordIngest(DOC, SYSTEM, [accent, button, rule]);
check("3 blocks created at v1", r1.created.length === 3);
check(
  "scan facts auto-promoted (token+component)",
  r1.official["token:color:accent"] === 1 &&
    r1.official["component:button-primary"] === 1,
);
check(
  "governance staged as draft (not official)",
  r1.official["agent-rule:cta-density"] === undefined,
);

// ── BUILD + LOCK ──────────────────────────────────────────────────────────
console.log("\nBUILD + LOCK");
const lock1 = buildLock(DOC);
check("lock pins exactly the official blocks", Object.keys(lock1.blocks).length === 2);
check("lock fresh after build", verifyLock(DOC, lock1).ok);
const lockAgain = buildLock(DOC);
check(
  "deterministic: same graph → same lock hash",
  lock1.contentHash === lockAgain.contentHash,
);

// ── IDEMPOTENT RE-INGEST ──────────────────────────────────────────────────
console.log("\nRE-INGEST (no changes)");
const r2 = recordIngest(DOC, SYSTEM, [accent, button, rule]);
check(
  "unchanged content does not bump versions",
  r2.unchanged.length === 3 && r2.bumped.length === 0,
);

// ── STAGE: governance edit ────────────────────────────────────────────────
console.log("\nSTAGE (governance edit → draft v2)");
const rule2 = mkBlock({
  ...rule,
  content: { text: "Max one primary CTA per view; ghost buttons for secondary" },
});
const r3 = recordIngest(DOC, SYSTEM, [accent, button, rule2]);
check("edit bumps to v2", r3.versions["agent-rule:cta-density"] === 2);
check("draft v2 is NOT official", r3.official["agent-rule:cta-density"] === undefined);
check("lock unaffected by drafts", verifyLock(DOC, lock1).ok);

// ── ENFORCE: agents never see drafts ──────────────────────────────────────
console.log("\nENFORCE");
const officialNow = getOfficialBlocks(DOC);
check(
  "draft agent-rule absent from official graph",
  !officialNow.some((b) => b.id === "agent-rule:cta-density"),
);

// ── PROMOTE ───────────────────────────────────────────────────────────────
console.log("\nPROMOTE (human Finalize)");
const promo = promoteBlock(DOC, "agent-rule:cta-density", SYSTEM);
check("promote succeeds at v2", promo.ok && promo.version === 2);
const v1Check = verifyLock(DOC, lock1);
check("old lock now STALE", v1Check.stale, `lock=${v1Check.lockHash} reg=${v1Check.registryHash}`);
const lock2 = buildLock(DOC);
check("rebuilt lock fresh, pins 3 blocks", verifyLock(DOC, lock2).ok && Object.keys(lock2.blocks).length === 3);
check(
  "agents now read promoted v2 content",
  getOfficialBlocks(DOC).some(
    (b) =>
      b.id === "agent-rule:cta-density" &&
      b.version === 2 &&
      String(b.content.text).includes("ghost"),
  ),
);

// ── SCAN-FACT CHANGE: code is authoritative ───────────────────────────────
console.log("\nRE-SCAN (token changed in code)");
const accent2 = mkBlock({
  ...accent,
  content: { value: "#e0815f", cssVar: "--color-accent", summary: "CTA" },
});
recordIngest(DOC, SYSTEM, [accent2, button, rule2]);
const accentHistory = getBlockHistory(DOC, "token:color:accent");
check(
  "token re-scan auto-promotes v2 (code wins until re-scan)",
  accentHistory?.official === 2,
);
check("v2 lock stale after token promotion", verifyLock(DOC, lock2).stale);

// ── ROLLBACK ──────────────────────────────────────────────────────────────
console.log("\nROLLBACK");
const rb = rollbackBlock(DOC, "token:color:accent", SYSTEM);
check("rollback returns pointer to v1", rb.ok && rb.version === 1);
check(
  "official content is v1 hex again",
  getOfficialBlocks(DOC).some(
    (b) => b.id === "token:color:accent" && String(b.content.value) === "#d97757",
  ),
);
check(
  "history immutable: both versions still recorded",
  (getBlockHistory(DOC, "token:color:accent")?.versions.length ?? 0) === 2,
);

// ── STALE DETECTION ───────────────────────────────────────────────────────
console.log("\nSTALE (block vanishes from source)");
// Note: re-ingesting the original accent content after rollback correctly
// creates a NEW promoted v3 (history is append-only; code wins on re-scan).
const r6 = recordIngest(DOC, SYSTEM, [accent, rule2]); // button gone
check("re-scan of reverted code promotes v3 (append-only history)", r6.official["token:color:accent"] === 3);
check("vanished block marked stale, not deleted", r6.staled.includes("component:button-primary"));
check(
  "stale block still locked at last official version",
  buildLock(DOC).blocks["component:button-primary"]?.version === 1,
);

// ── CROSS-PLATFORM COMPILE ────────────────────────────────────────────────
console.log("\nCOMPILE (device-sim + tokens.h)");
const graph = getOfficialGraph(DOC, SYSTEM);
check("graph schema is blocksmith.blocks.v1", graph.schema === "blocksmith.blocks.v1");
check(
  "every block carries id+version+contentHash",
  graph.blocks.every((b) => b.id && b.version >= 1 && b.contentHash.startsWith("sha256:")),
);
const profile = compileDeviceSim(graph, "watch-240");
check("device profile carries graph hash", profile.graphHash === graph.contentHash);
check(
  "accent survives as 0xRRGGBB at official v3",
  profile.tokens.some((t) => t.id === "token:color:accent" && t.rgb === 0xd97757 && t.version === 3),
);
check(
  "governance compiled as constraint",
  profile.constraints.some((c) => c.rule.includes("Max one primary CTA")),
);
check(
  "widgets respect min touch target",
  profile.widgets.every((w) => w.minTouchPx >= 60),
);
const loss = deviceCompileLoss(graph, profile);
check("semantic loss measured", loss.carried + loss.dropped.length === graph.blocks.length);
const header = emitTokensHeader(graph);
check(
  "tokens.h traceable to block@version",
  header.includes("BS_COLOR_COLOR_ACCENT 0xD97757u") &&
    header.includes("token:color:accent@v3") &&
    header.includes(graph.contentHash),
);

// ── Summary ───────────────────────────────────────────────────────────────
try {
  rmSync(regDir, { recursive: true, force: true });
} catch {
  /* sandboxed FS may deny deletes — re-run cleans at start */
}
console.log(
  failures === 0
    ? "\n🏁 Design IR + CI/CD closed loop verified — ingest, stage, promote, lock, enforce, rollback, compile."
    : `\n❌ ${failures} check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);
