/**
 * Drift gate — BlockSmith-repo-only check (not part of the public package).
 *
 * Fails CI when the app's hash implementation (src/lib/ir/hash.ts) and the
 * protocol package's (src/hash.ts) diverge on golden vectors, or when the
 * published schemas in public/schema/ differ from packages/protocol/schemas/.
 *
 * "No hash semantic drift between app and package" — PROJECT-PROTOCOL.md P7.
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import * as pkg from "../src/hash";
import * as app from "../../../src/lib/ir/hash";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (cond) console.log(`  ✅ ${label}`);
  else {
    failures += 1;
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
  }
};

console.log("\nHASH DRIFT (app vs package)");
const contents: unknown[] = [
  {},
  { value: "#d97757", cssVar: "--color-accent" },
  { b: 2, a: 1, nested: { z: [3, 1, 2], y: null } },
  { text: "unicode ✓ → ∆", items: ["a", "b"] },
];
for (const [i, c] of contents.entries()) {
  ok(
    `blockContentHash vector ${i} identical`,
    pkg.blockContentHash("id:x", "token", c) ===
      app.blockContentHash("id:x", "token", c),
  );
  ok(
    `canonicalJson vector ${i} identical`,
    pkg.canonicalJson(c) === app.canonicalJson(c),
  );
}
const entries = [
  { id: "b", version: 2, contentHash: "sha256:bb" },
  { id: "a", version: 1, contentHash: "sha256:aa" },
];
ok("graphHash identical", pkg.graphHash(entries) === app.graphHash(entries));

console.log("\nSCHEMA SYNC (public/schema vs packages/protocol/schemas)");
for (const name of [
  "blocksmith.blocks.v1.json",
  "blocksmith.lock.v1.json",
  "blocksmith.registry.v1.json",
  "blocksmith.compile-targets.v1.json",
]) {
  const a = readFileSync(join(ROOT, "public", "schema", name), "utf-8");
  const b = readFileSync(join(HERE, "..", "schemas", name), "utf-8");
  ok(`${name} identical`, a === b, "run: npm run protocol:sync-schemas");
}

console.log("\nAPP REGISTRY OUTPUT validates against registry.v1");
const { recordIngest, getRegistryEntry, readManifest } = await import(
  "../../../src/lib/ir/registry"
);
const { validateRegistryEntry, validateRegistryManifest } = await import(
  "../src/validate"
);
const DOC = `verify:protocol-${Date.now().toString(36)}.md`;
recordIngest(DOC, "protocol-check", [
  {
    id: "token:color:x",
    type: "token",
    title: "X",
    source: { file: "x.css", ingest: "scan" },
    updatedAt: new Date().toISOString(),
    contentHash: "",
    status: "finalized",
    docRef: DOC,
    content: { value: "#112233" },
  } as never,
]);
const entry = getRegistryEntry(DOC, "token:color:x");
const entryResult = validateRegistryEntry(entry);
ok(
  "registry entry conforms",
  entryResult.ok,
  entryResult.errors.map((e) => `${e.path}: ${e.message}`).join("; "),
);
const manifest = readManifest(DOC);
const manifestResult = validateRegistryManifest(manifest);
ok(
  "registry manifest conforms",
  manifestResult.ok,
  manifestResult.errors.map((e) => `${e.path}: ${e.message}`).join("; "),
);

console.log(
  failures === 0
    ? "\n🏁 zero drift — app and protocol package agree"
    : `\n❌ drift detected: ${failures} failure(s)`,
);
process.exit(failures === 0 ? 0 : 1);
