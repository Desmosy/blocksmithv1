/**
 * Compile the official Design IR graph to embedded targets:
 *   .blocksmith/targets/<docKey>/device-<frame>.json   (device-sim profile)
 *   .blocksmith/targets/<docKey>/tokens.h               (C header, Phase 2)
 *
 * Same graph the wiki renders and the lock pins — different emitter.
 *
 * Usage:
 *   npm run compile:device                       # default doc, watch-240
 *   npm run compile:device -- --doc apollo.md --frame hmi-480
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { ensureDocBlocks } from "@/lib/blocks/refresh";
import {
  compileDeviceSim,
  deviceCompileLoss,
  DEVICE_FRAMES,
} from "@/lib/ir/targets/device-sim";
import { emitTokensHeader } from "@/lib/ir/targets/c-header";
import { getOfficialGraph } from "@/lib/ir/registry";
import { buildStyleDictionaryTargets } from "@/lib/design-tokens/style-dictionary";

function arg(flag: string, fallback: string): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
}

async function main() {
const doc = arg("--doc", process.env.BLOCKSMITH_DOC || "apollo.md");
const frame = arg("--frame", "watch-240");

if (!DEVICE_FRAMES.some((f) => f.id === frame)) {
  console.error(
    `Unknown frame "${frame}". Available: ${DEVICE_FRAMES.map((f) => f.id).join(", ")}`,
  );
  process.exit(2);
}

ensureDocBlocks(doc);
const graph = getOfficialGraph(doc);
if (!graph.blocks.length) {
  console.error(`No promoted blocks for "${doc}" — open the wiki and Finalize first.`);
  process.exit(1);
}

const profile = compileDeviceSim(graph, frame);
const loss = deviceCompileLoss(graph, profile);
const header = emitTokensHeader(graph);

const outDir = join(
  process.cwd(),
  ".blocksmith",
  "targets",
  doc.replace(/[^a-zA-Z0-9._-]/g, "_"),
);
mkdirSync(outDir, { recursive: true });
const profilePath = join(outDir, `device-${frame}.json`);
const headerPath = join(outDir, "tokens.h");
writeFileSync(profilePath, `${JSON.stringify(profile, null, 2)}\n`, "utf-8");
writeFileSync(headerPath, header, "utf-8");
await buildStyleDictionaryTargets(graph, outDir);

console.log(`device-sim compile · ${doc} → ${profile.frame.label}`);
console.log(`  graph:       ${graph.contentHash} (${graph.blocks.length} promoted blocks)`);
console.log(`  tokens:      ${profile.tokens.length}`);
console.log(`  widgets:     ${profile.widgets.length} (min touch ${profile.minTouchPx}px)`);
console.log(`  constraints: ${profile.constraints.length}`);
console.log(
  `  semantic loss: ${loss.dropped.length} block(s) dropped (${loss.dropped
    .map((d) => d.id)
    .slice(0, 5)
    .join(", ")}${loss.dropped.length > 5 ? ", …" : ""})`,
);
console.log(`  → ${profilePath}`);
console.log(`  → ${headerPath}`);
console.log(`  → ${join(outDir, "tokens.css")} (Style Dictionary)`);
console.log(`  → ${join(outDir, "tokens.json")} (Style Dictionary)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
