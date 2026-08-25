/**
 * Storybook → blocks.v1 CLI (PROJECT-PROTOCOL.md P5).
 *
 * Usage:
 *   npm run ingest:storybook -- ./storybook-static --doc upload:my-app.md
 *   npm run ingest:storybook -- ./storybook-static --doc demo:investor.md --out ./out/graph.json
 *   npm run ingest:storybook -- ./storybook-static --graph-only --out graph.json
 *
 * Reads index.json (Storybook 7/8) or stories.json (6.x) from the static
 * build, emits component blocks with source.ingest "storybook", applies the
 * conflict rule against existing scan blocks, and records versions in the
 * registry (unless --graph-only). Adapter contract: writes IR only.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import {
  graphFromStorybook,
  storedBlocksFromStorybook,
} from "@/lib/ingest/storybook";
import { recordIngest } from "@/lib/ir/registry";
import { appendRun } from "@/lib/ir/pipeline-runs";
import { buildIngestStages } from "@/lib/ir/pipeline-stages";

const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith("--"));
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const has = (name: string) => argv.includes(`--${name}`);

const staticDir = resolve(positional[0] ?? "./storybook-static");
const doc = flag("doc") ?? process.env.BLOCKSMITH_DOC ?? "";
const out = flag("out");
const graphOnly = has("graph-only");

const indexPath = ["index.json", "stories.json"]
  .map((f) => join(staticDir, f))
  .find(existsSync);

if (!indexPath) {
  console.error(
    `No index.json or stories.json in ${staticDir} — run \`storybook build\` first.`,
  );
  process.exit(2);
}
if (!graphOnly && !doc) {
  console.error("Missing --doc <docRef> (or pass --graph-only with --out).");
  process.exit(2);
}

const index = JSON.parse(readFileSync(indexPath, "utf-8"));
const systemId = doc
  ? doc.replace(/^upload:/, "").replace(/\.md$/i, "")
  : "storybook";

const graph = graphFromStorybook(index, doc || "storybook", systemId);
console.log(
  `storybook adapter · ${indexPath}\n  components: ${graph.blocks.length} · graph ${graph.contentHash}`,
);

if (out) {
  const outPath = resolve(out);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(graph, null, 2)}\n`, "utf-8");
  console.log(`  graph → ${outPath}`);
}

if (!graphOnly) {
  const blocks = storedBlocksFromStorybook(index, doc);
  const conflicts = blocks.filter((b) => b.status === "conflict");
  // Partial ingest: storybook contributes blocks; it must not stale scan facts.
  const ingestStart = Date.now();
  const report = recordIngest(doc, systemId, blocks, "ingest", { partial: true });
  const ingestDurationMs = Date.now() - ingestStart;
  const touched = [...report.created, ...report.bumped, ...report.conflicts];
  appendRun({
    docRef: doc,
    actor: "ingest",
    action: "ingest",
    summary: `Storybook scan: ${report.created.length} new · ${report.bumped.length} updated · ${report.conflicts.length} conflicts`,
    blocks: touched.map((id) => ({ id, version: report.versions[id] })),
    durationMs: ingestDurationMs,
    stages: buildIngestStages(touched.length, ingestDurationMs),
  });
  console.log(
    `  registry → ${doc}: ${report.created.length} created, ${report.bumped.length} bumped, ${report.conflicts.length} conflicts, ${report.unchanged.length} unchanged`,
  );
  if (conflicts.length) {
    console.log(
      `  ⚠ conflicts (resolve in wiki Pipeline): ${conflicts.map((c) => c.id).join(", ")}`,
    );
  }
}
