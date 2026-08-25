/**
 * Test AI Lab step 05 — font resolve.
 * Usage: npm run ai-lab:fonts -- upload:design-5852ccbe.md
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";

function loadEnvLocal() {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

import { compileDesignIR } from "../../src/lib/design-ir/compile";
import { listFontsNeedingResolve } from "../../src/lib/fonts/font-resolve";
import { collectWikiFontSpecs } from "../../src/lib/fonts/resolve-wiki-fonts";
import { resolveFontsWithAi } from "../../src/ai-lab/05-font-resolve/match";
import {
  loadDocForAiLab,
  resolveDocMarkdownPath,
} from "../../src/ai-lab/shared/load-doc";

const arg = process.argv[2];
if (!arg) {
  console.error("Usage: npm run ai-lab:fonts -- <file.md|upload:file.md>");
  process.exit(1);
}

async function main() {
  const docRef = arg.startsWith("upload:") ? arg : `test:${arg}`;
  const fullPath = resolveDocMarkdownPath(docRef);
  const { system: parsed, markdown } = loadDocForAiLab(arg);
  const system = {
    ...parsed,
    mode: parsed.mode ?? ("apollo" as const),
    docRef,
    contentHash: "test-font-resolve",
    updatedAt: new Date().toISOString(),
    sourcePath: fullPath,
  };

  const needed = listFontsNeedingResolve(system.typography);
  console.log(`[ai-lab:05] Doc: ${docRef}`);
  console.log(`[ai-lab:05] Typography rows: ${system.typography.length}`);
  console.log(`[ai-lab:05] Need AI resolve: ${needed.length}`);
  for (const f of needed) {
    console.log(`  - ${f.name} (${f.role.slice(0, 60)}…)`);
  }

  if (needed.length === 0) {
    console.log("[ai-lab:05] All fonts resolved deterministically.");
    return;
  }

  const resolutions = await resolveFontsWithAi(needed, docRef, system.name);
  console.log(`[ai-lab:05] Resolved ${Object.keys(resolutions).length} fonts:`);
  for (const [key, res] of Object.entries(resolutions)) {
    console.log(`  ${key} → ${res.googleFamily} [${res.weights.join(",")}]`);
    if (res.reason) console.log(`    ${res.reason}`);
  }

  const ir = compileDesignIR(docRef, system);
  const specsBefore = collectWikiFontSpecs(system.typography);
  const specsAfter = collectWikiFontSpecs(system.typography, resolutions);
  console.log(
    `[ai-lab:05] Google font specs: ${specsBefore.length} → ${specsAfter.length}`,
  );
  console.log(
    `[ai-lab:05] Families: ${specsAfter.map((s) => s.family).join(", ")}`,
  );
}

main().catch((err) => {
  console.error("[ai-lab:05] failed:", err);
  process.exit(1);
});
