/**
 * Test AI Lab step 01 — chrome compiler.
 * Usage: npm run ai-lab:chrome -- upload:design-dcd1a101.md
 */
import { readFileSync, existsSync } from "fs";
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

import { compileChromeWithAi } from "../../src/ai-lab/01-ai-chrome/compile-chrome";

const docRef = process.argv[2] ?? "apollo.md";

async function main() {
  console.log(`[ai-lab:01] Compiling chrome for ${docRef}…\n`);
  const layout = await compileChromeWithAi(docRef);
  console.log(JSON.stringify(layout, null, 2));
}

main().catch((err) => {
  console.error("[ai-lab:01] failed:", err);
  process.exit(1);
});
