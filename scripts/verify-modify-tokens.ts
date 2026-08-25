/**
 * verify:modify-tokens — unit coverage for the token + introduction writeback
 * handlers added to src/lib/parser/modify.ts (Phase 2/3 of the wiki edit track).
 *
 * Strategy: take the bundled apollo.md, run modifyMarkdownBlock for each new
 * blockId, re-parse with parseApolloMarkdown, and assert the parsed system now
 * reflects the edit. This proves the round-trip the wiki finalize path relies on.
 *
 * Usage: npm run verify:modify-tokens
 */
import { readFileSync } from "fs";
import { join } from "path";
import { modifyMarkdownBlock } from "../src/lib/parser/modify";
import { parseApolloMarkdown } from "../src/lib/parser/apollo";
import {
  getSectionBody,
  replaceSectionBody,
  sectionSlug,
} from "../src/lib/parser/sections";

const APOLLO = join(process.cwd(), "docs/designs.md/apollo.md");
const md = readFileSync(APOLLO, "utf-8");
const errors: string[] = [];

function check(label: string, cond: boolean, detail = "") {
  if (!cond) errors.push(`${label}${detail ? ` — ${detail}` : ""}`);
}

// 1. Color token — change Canvas hex + role, keep the CSS var identity.
{
  const out = modifyMarkdownBlock(md, "token:color:canvas", {
    name: "Canvas",
    value: "#fafafa",
    role: "Primary page background (edited)",
  });
  const system = parseApolloMarkdown(out, APOLLO);
  const canvas = system.colors.find((c) => c.cssVar === "--color-canvas");
  check("color: token found", !!canvas);
  check("color: hex updated", canvas?.value === "#fafafa", canvas?.value);
  check(
    "color: role updated",
    canvas?.role === "Primary page background (edited)",
    canvas?.role,
  );
  // Other rows untouched.
  const gold = system.colors.find((c) => c.cssVar === "--color-apollo-gold");
  check("color: siblings intact", gold?.value === "#ebf212", gold?.value);
}

// 2. Spacing token — change a value, keep token.
{
  const out = modifyMarkdownBlock(md, "token:spacing:spacing-8", {
    name: "8",
    value: "10px",
  });
  const system = parseApolloMarkdown(out, APOLLO);
  const s = system.spacing.find((x) => x.token === "--spacing-8");
  check("spacing: token found", !!s);
  check("spacing: value updated", s?.value === "10px", s?.value);
  const s16 = system.spacing.find((x) => x.token === "--spacing-16");
  check("spacing: siblings intact", s16?.value === "16px", s16?.value);
}

// 3. Typography token — change substitute + role, keep CSS var.
{
  const out = modifyMarkdownBlock(md, "token:typography:season-mix", {
    name: "Season Mix",
    substitute: "Poppins",
    weights: "600",
    sizes: "48px, 64px",
    lineHeight: "1.1",
    letterSpacing: "-0.01em",
    role: "Display headlines (edited)",
  });
  const system = parseApolloMarkdown(out, APOLLO);
  const f = system.typography.find((t) => t.name === "Season Mix");
  check("type: family found", !!f);
  check("type: substitute updated", f?.substitute === "Poppins", f?.substitute);
  // The CSS var stays in the heading tail (parser folds it into role) — assert
  // on the raw markdown that it survived the rewrite exactly once.
  // CSS var must survive untouched — same count as the source (heading + the
  // two @font-face/:root blocks lower in the doc), no loss or duplication.
  const srcCount = md.match(/--font-season-mix/g)?.length ?? 0;
  check(
    "type: cssVar preserved",
    out.match(/--font-season-mix/g)?.length === srcCount,
    `${out.match(/--font-season-mix/g)?.length} vs ${srcCount}`,
  );
  check(
    "type: role updated",
    !!f && f.role.includes("Display headlines (edited)"),
    f?.role,
  );
  // Type scale table survived (it lives in the same section).
  check("type: scale intact", system.typeScale.length > 0);
  // Other family intact.
  const soehne = system.typography.find((t) => t.name === "Soehne");
  check("type: siblings intact", soehne?.substitute === "Inter", soehne?.substitute);
}

// 4. Introduction — change name / tagline / overview.
{
  const out = modifyMarkdownBlock(md, "page:introduction", {
    name: "Apollo Next",
    tagline: "A brighter spotlight.",
    overview: "Apollo Next is a refreshed take on the system.",
  });
  const system = parseApolloMarkdown(out, APOLLO);
  check("intro: name updated", system.name === "Apollo Next", system.name);
  check(
    "intro: tagline updated",
    system.tagline === "A brighter spotlight.",
    system.tagline,
  );
  check(
    "intro: overview updated",
    system.overview.includes("refreshed take"),
    system.overview.slice(0, 60),
  );
  // Tokens still parse after a header rewrite.
  check("intro: colors intact", system.colors.length === 12, String(system.colors.length));
}

// 4b. Universal section editor — replace the Imagery section body, parse it back.
{
  const slug = sectionSlug("Imagery");
  check("section: slug stable", slug === "imagery", slug);
  const body = getSectionBody(md, slug);
  check("section: body read", !!body && body.includes("abstract"), body?.slice(0, 30));

  const out = modifyMarkdownBlock(md, `section:${slug}`, {
    markdown: "Brand-new imagery direction: bold duotone photography only.",
  });
  const system = parseApolloMarkdown(out, APOLLO);
  check(
    "section: imagery updated",
    system.imagery.includes("duotone photography"),
    system.imagery.slice(0, 40),
  );
  // Neighbouring sections must be untouched.
  check("section: colors intact", system.colors.length === 12, String(system.colors.length));
  // layoutNotes is unchanged by an Imagery edit (assert on its real content).
  const baseLayout = parseApolloMarkdown(md, APOLLO).layoutNotes;
  check(
    "section: layout intact",
    system.layoutNotes === baseLayout,
    system.layoutNotes.slice(0, 30),
  );
}

// 4c. replaceSectionBody is level-aware — editing Colors keeps the H3 table that
// follows other sections, and a missing section returns null.
{
  const out = replaceSectionBody(md, "tokens-colors", "| Name | Value | Token | Role |\n|---|---|---|---|");
  check("section: replace returns md", typeof out === "string" && out.includes("## Tokens — Typography"));
  check("section: missing returns null", replaceSectionBody(md, "no-such-section", "x") === null);
}

// 5. Missing target throws.
{
  let threw = false;
  try {
    modifyMarkdownBlock(md, "token:color:does-not-exist", { value: "#000000" });
  } catch {
    threw = true;
  }
  check("missing color throws", threw);
}

if (errors.length) {
  console.error("FAILED — modify token handlers:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("OK — modify token + introduction handlers round-trip through the parser.");
