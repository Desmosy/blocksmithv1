/**
 * Golden checks for Design IR compiler (P1).
 * Run: npm run verify:design-ir
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseApolloMarkdown } from "../src/lib/parser/apollo";
import { compileDesignIR } from "../src/lib/design-ir/compile";

type Case = {
  label: string;
  path: string;
  docRef: string;
  expect: {
    accent: string;
    wikiBg: string;
    wikiText?: string;
    wikiBorder?: string;
    navBg?: string;
    buttonRadius?: string;
    cardRadius?: string;
  };
};

const ROOT = join(process.cwd());

const CASES: Case[] = [
  {
    label: "Designmodo (mixed)",
    path: "data/uploads/design-f37abfd0.md",
    docRef: "upload:design-f37abfd0.md",
    expect: {
      accent: "#27ae60",
      wikiBg: "#f4f7f2",
      wikiText: "#313942",
      wikiBorder: "#e4ebe2",
      navBg: "#0e231c",
      buttonRadius: "999px",
      cardRadius: "32px",
    },
  },
  {
    label: "User Interviews",
    path: "data/uploads/design-c37e5b44.md",
    docRef: "upload:design-c37e5b44.md",
    expect: {
      accent: "#1c5d5f",
      wikiBg: "#f2f8f7",
    },
  },
  {
    label: "Apollo",
    path: "docs/designs.md/apollo.md",
    docRef: "apollo.md",
    expect: {
      accent: "#ebf212",
      wikiBg: "#f7f5f2",
      wikiText: "#1a1a1a",
      wikiBorder: "#e5e7eb",
    },
  },
];

function loadSystemFromFile(relPath: string, docRef: string) {
  const fullPath = join(ROOT, relPath);
  const md = readFileSync(fullPath, "utf-8");
  const system = parseApolloMarkdown(md, fullPath);
  return {
    ...system,
    mode: "apollo" as const,
    docRef,
    contentHash: "test",
    updatedAt: new Date().toISOString(),
  };
}

let passed = 0;
for (const c of CASES) {
  try {
    const system = loadSystemFromFile(c.path, c.docRef);
    const ir = compileDesignIR(c.docRef, system);
    const chrome = ir.wikiChrome.cssVariables;

    assert.equal(
      chrome["--wiki-accent"],
      c.expect.accent,
      `${c.label}: --wiki-accent`,
    );
    assert.equal(chrome["--wiki-bg"], c.expect.wikiBg, `${c.label}: --wiki-bg`);

    if (c.expect.wikiText) {
      assert.equal(
        chrome["--wiki-text"],
        c.expect.wikiText,
        `${c.label}: --wiki-text`,
      );
    }
    if (c.expect.wikiBorder) {
      assert.equal(
        chrome["--wiki-border"],
        c.expect.wikiBorder,
        `${c.label}: --wiki-border`,
      );
    }

    if (c.expect.navBg) {
      assert.equal(
        chrome["--wiki-nav-bg"],
        c.expect.navBg,
        `${c.label}: --wiki-nav-bg`,
      );
    }
    if (c.expect.buttonRadius) {
      assert.equal(
        chrome["--wiki-radius"],
        c.expect.buttonRadius,
        `${c.label}: --wiki-radius`,
      );
    }
    if (c.expect.cardRadius) {
      assert.equal(
        chrome["--wiki-radius-card"],
        c.expect.cardRadius,
        `${c.label}: --wiki-radius-card`,
      );
    }

    assert.equal(ir.preview.accent, c.expect.accent, `${c.label}: preview.accent`);
    assert.ok(ir.colorVariables["--color-sprout"] || ir.tokens.colors.length > 0);

    console.log(`✓ ${c.label}`);
    passed++;
  } catch (err) {
    console.error(`✗ ${c.label}`);
    throw err;
  }
}

console.log(`\n${passed}/${CASES.length} Design IR golden checks passed.`);
