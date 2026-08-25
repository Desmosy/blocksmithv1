/**
 * Test AI Lab step 02 — parser assist.
 * Usage: npm run ai-lab:normalize -- path/to/file.md
 *        npm run ai-lab:normalize -- upload:design-xxx.md
 */
import { readFileSync, existsSync, writeFileSync } from "fs";
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

import { isApolloStructuredMarkdown } from "../../src/lib/parser/generic";
import { loadDocForAiLab, resolveDocMarkdownPath } from "../../src/ai-lab/shared/load-doc";
import { normalizeMarkdownWithAi } from "../../src/ai-lab/02-parser-assist/normalize";
import { parseApolloMarkdown } from "../../src/lib/parser/apollo";

const arg = process.argv[2];
if (!arg) {
  console.error("Usage: npm run ai-lab:normalize -- <file.md|upload:file.md>");
  process.exit(1);
}

async function main() {
  let raw: string;
  let docRef: string;

  if (arg.startsWith("upload:")) {
    docRef = arg;
    raw = readFileSync(resolveDocMarkdownPath(docRef), "utf-8");
  } else {
    const path = arg.startsWith("/") ? arg : join(process.cwd(), arg);
    docRef = `test:${path}`;
    raw = readFileSync(path, "utf-8");
  }

  console.log(`[ai-lab:02] Source: ${docRef} (${raw.length} bytes)`);
  console.log(`[ai-lab:02] Structured already? ${isApolloStructuredMarkdown(raw)}`);

  const { markdown, model } = await normalizeMarkdownWithAi(raw, docRef);
  console.log(`[ai-lab:02] Model: ${model}`);
  console.log(`[ai-lab:02] Normalized structured? ${isApolloStructuredMarkdown(markdown)}`);

  const outPath = join(process.cwd(), ".blocksmith/ai-lab/normalized/_test-output.md");
  writeFileSync(outPath, markdown, "utf-8");
  console.log(`[ai-lab:02] Wrote ${outPath}`);

  const system = parseApolloMarkdown(markdown, outPath);
  console.log(
    `[ai-lab:02] Parsed: ${system.colors.length} colors, ${system.typography.length} fonts, ${system.components.length} components`,
  );
}

main().catch((err) => {
  console.error("[ai-lab:02] failed:", err);
  process.exit(1);
});
