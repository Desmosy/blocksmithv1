/**
 * Verify comprehensive wiki markdown parses with doc-driven nav (not Apollo skeleton).
 * Usage: npm run verify:wiki -- data/uploads/design-163e34fb.md
 *        npm run verify:wiki -- .cursor/d.md
 */
import { readFileSync } from "fs";
import { basename } from "path";
import {
  isComprehensiveWikiMarkdown,
  parseGenericMarkdown,
} from "../src/lib/parser/generic";
import { needsParserAssist } from "../src/ai-lab/02-parser-assist/needs-assist";

const filePath = process.argv[2] ?? "data/uploads/design-163e34fb.md";
const md = readFileSync(filePath, "utf-8");
const fileName = basename(filePath);

const isWiki = isComprehensiveWikiMarkdown(md);
const needsAssist = needsParserAssist(md);
const system = parseGenericMarkdown(md, filePath, fileName);

const wikiNav = system.nav.find((g) => g.label === "Wiki" || g.label === "Document");
const topLevel = wikiNav?.items ?? [];

console.log("File:", filePath);
console.log("isComprehensiveWiki:", isWiki);
console.log("needsParserAssist:", needsAssist);
console.log("mode:", system.mode);
console.log("sections:", system.sections.length);
console.log("colors:", system.colors.length);
console.log("top-level nav:", topLevel.length);
console.log("nav labels:", topLevel.map((i) => i.label).join(" | "));

const apolloSkeleton = [
  "Layout",
  "Typography",
  "Color",
  "Palette",
  "Guidelines",
  "Imagery",
  "Surfaces",
  "Spacing",
];
const looksLikeApolloOnly =
  topLevel.length <= 12 &&
  apolloSkeleton.every((label) =>
    topLevel.some((i) => i.label.toLowerCase().includes(label.toLowerCase())),
  );

if (!isWiki) {
  console.error("FAIL: document not detected as comprehensive wiki");
  process.exit(1);
}
if (needsAssist) {
  console.error("FAIL: parser assist would rewrite this doc into Apollo format");
  process.exit(1);
}
if (topLevel.length < 10) {
  console.error("FAIL: expected 10+ top-level wiki sections, got", topLevel.length);
  process.exit(1);
}
if (looksLikeApolloOnly && topLevel.length < 15) {
  console.error("FAIL: nav still looks like Apollo mock skeleton");
  process.exit(1);
}

console.log("OK: wiki nav is doc-driven");
