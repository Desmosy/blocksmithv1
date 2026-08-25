/**
 * blocks.v1 conformance suite — `npm run protocol:conformance`.
 *
 * Pure-package checks a third party can run after forking the fixtures:
 *   1. valid/   fixtures validate (incl. official-only + hash verification)
 *   2. invalid/ fixtures fail for the DOCUMENTED reason
 *   3. behavioral/ golden hash vectors reproduce byte-for-byte
 *   4. graph hash is order-independent
 *   5. lock verification detects version mismatch + staleness
 *
 * Exit 0 = conformant. Anything else = your emitter does not speak blocks.v1.
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { blockContentHash, graphHash } from "../src/hash";
import {
  validateGraph,
  validateLock,
  validateRegistryEntry,
  validateRegistryManifest,
  validateCompileTargets,
  verifyLockAgainstGraph,
} from "../src/validate";
import type { BlocksmithGraphV1, BlocksmithLockV1 } from "../src/types";

const HERE = dirname(fileURLToPath(import.meta.url));
const load = (rel: string) =>
  JSON.parse(readFileSync(join(HERE, rel), "utf-8"));

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (cond) console.log(`  ✅ ${label}`);
  else {
    failures += 1;
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
  }
};

// ── 1 · valid fixtures ─────────────────────────────────────────────────────
console.log("\nVALID fixtures");
const minimal = load("valid/minimal-graph.json") as BlocksmithGraphV1;
const full = load("valid/full-acme-graph.json") as BlocksmithGraphV1;
const freshLock = load("valid/fresh-lock.json") as BlocksmithLockV1;

ok(
  "minimal graph validates (schema + hashes)",
  validateGraph(minimal, { verifyHashes: true, officialOnly: true }).ok,
);
ok(
  "full graph validates as STAGING (conflict allowed)",
  validateGraph(full, { verifyHashes: true }).ok,
);
ok("fresh lock validates", validateLock(freshLock).ok);
ok(
  "fresh lock is fresh against its graph",
  verifyLockAgainstGraph(freshLock, minimal).ok,
);

// ── 2 · invalid fixtures fail for the right reason ─────────────────────────
console.log("\nINVALID fixtures");
const wrongSchema = validateGraph(load("invalid/wrong-schema-field.json"));
ok(
  "wrong-schema-field rejected",
  !wrongSchema.ok && wrongSchema.errors.some((e) => e.path === "$.schema"),
);

const draftOfficial = validateGraph(load("invalid/draft-in-official-graph.json"), {
  officialOnly: true,
});
ok(
  "draft-in-official-graph rejected (agents never see drafts)",
  !draftOfficial.ok &&
    draftOfficial.errors.some((e) => e.message.includes("official graph")),
);
ok(
  "…but the same graph is fine as staging",
  validateGraph(load("invalid/draft-in-official-graph.json")).ok,
);

const badHash = validateGraph(load("invalid/bad-content-hash.json"), {
  verifyHashes: true,
});
ok(
  "bad-content-hash rejected",
  !badHash.ok && badHash.errors.some((e) => e.message.includes("hash mismatch")),
);

const mismatch = verifyLockAgainstGraph(
  load("invalid/lock-version-mismatch.json") as BlocksmithLockV1,
  minimal,
);
ok(
  "lock-version-mismatch detected as drift + stale",
  !mismatch.ok &&
    mismatch.errors.some((e) => e.message.includes("locked v3")),
);

// ── 3 · golden hash vectors ────────────────────────────────────────────────
console.log("\nGOLDEN vectors");
const vectors = load("behavioral/golden-vectors.json") as {
  blockContentHash: { id: string; type: string; content: Record<string, unknown>; expected: string }[];
  graphHash: { entries: { id: string; version: number; contentHash: string }[]; expected: string }[];
};
for (const v of vectors.blockContentHash) {
  ok(
    `blockContentHash(${v.id}) reproduces`,
    blockContentHash(v.id, v.type, v.content) === v.expected,
    `got ${blockContentHash(v.id, v.type, v.content)}, want ${v.expected}`,
  );
}
for (const v of vectors.graphHash) {
  ok("graphHash reproduces", graphHash(v.entries) === v.expected);
  ok(
    "graphHash is order-independent",
    graphHash([...v.entries].reverse()) === v.expected,
  );
}
ok(
  "canonicalJson ignores key order in content",
  blockContentHash("x", "token", { a: 1, b: 2 }) ===
    blockContentHash("x", "token", { b: 2, a: 1 }),
);

// ── 4 · registry + compile-targets shapes ──────────────────────────────────
console.log("\nREGISTRY + TARGETS");
ok(
  "registry entry append-only rule enforced",
  !validateRegistryEntry({
    id: "x",
    versions: [
      { version: 2, status: "finalized", title: "x", type: "token", content: {}, contentHash: "sha256:ab", source: { file: "f" }, updatedAt: "t", createdAt: "t" },
      { version: 1, status: "draft", title: "x", type: "token", content: {}, contentHash: "sha256:cd", source: { file: "f" }, updatedAt: "t", createdAt: "t" },
    ],
  }).ok,
);
ok(
  "official pointer must reference a recorded version",
  !validateRegistryEntry({
    id: "x",
    official: 5,
    versions: [
      { version: 1, status: "finalized", title: "x", type: "token", content: {}, contentHash: "sha256:ab", source: { file: "f" }, updatedAt: "t", createdAt: "t" },
    ],
  }).ok,
);
ok(
  "valid manifest accepted",
  validateRegistryManifest({
    schema: "blocksmith.registry.v1",
    docRef: "upload:scan-acme-app.md",
    systemId: "acme",
    lastIngestAt: "2026-06-09T12:00:00.000Z",
    officialGraphHash: minimal.contentHash,
    blockCount: 40, promotedCount: 38, draftCount: 2, staleCount: 0,
  }).ok,
);
ok(
  "compile-targets manifest validates",
  validateCompileTargets(load("../compile-targets.v1.json")).ok,
);

// ── Summary ────────────────────────────────────────────────────────────────
console.log(
  failures === 0
    ? "\n🏁 blocks.v1 conformance: PASS"
    : `\n❌ blocks.v1 conformance: ${failures} failure(s)`,
);
process.exit(failures === 0 ? 0 : 1);
