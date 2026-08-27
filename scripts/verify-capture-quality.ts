/**
 * How close capture gets to a system a person wrote by hand.
 *
 * fixtures/capture-quality/elevenlabs.hand-written.md lists twelve components
 * for elevenlabs.io. Each row below is one of them, with the names that would
 * count as having found it. The score is hits out of twelve — a number that
 * moves when the detector improves, and the only honest definition of
 * "how good is capture".
 *
 * Run: npm run verify:capture   (needs a browser: local Chromium or
 *      BLOCKSMITH_BROWSER_WS)
 */
import { renderSiteDesign } from "../src/lib/ingest/render-site";

const EXPECT: [string, RegExp][] = [
  ["Filled pill button", /(Filled|Primary|Secondary) Pill Button/],
  // elevenlabs' white pill has no border in computed style (sides 0, shadow
  // transparent); "Surface" is what the page renders. Either name finds it.
  ["White secondary pill button", /Outline Pill Button|Surface Pill Button/],
  ["Ghost / text link", /Text Link|Ghost Pill/],
  ["Tinted feature card", /Tinted.*Card|Feature.*Card|Panel/],
  ["Elevated white card", /Elevated/],
  ["Tab pill group", /Tab Group|Tab Pill/],
  // The 1px stone line is drawn as an edge on some elements and all round on
  // others; either way it is the same token, and finding it counts.
  ["Hairline rule (1px stone)", /Hairline/],
  ["Gradient sphere visual", /Gradient Orb|Gradient Panel/],
  ["Logo wordmark", /^Logo$/],
  ["Top nav bar", /Top Nav Bar/],
  ["Trust logo grid", /Logo Grid/],
  ["Icon", /^Icon$|Icon Button/],
];

async function main() {
  const url = process.argv[2] ?? "https://elevenlabs.io";
  const r = await renderSiteDesign(url);
  if (!r) {
    console.error("no browser available — set BLOCKSMITH_BROWSER_WS or install Playwright's Chromium");
    process.exit(2);
  }
  const names = r.components.map((c) => c.name);
  console.log(`\n${url} — ${names.length} components:\n`);
  for (const c of r.components) console.log(`  ${String(c.count).padStart(3)}×  ${c.name.padEnd(28)} ${c.role}`);
  console.log("\nAgainst the hand-written system:\n");
  let hits = 0;
  for (const [label, re] of EXPECT) {
    const hit = names.some((n) => re.test(n));
    if (hit) hits += 1;
    console.log(`  ${hit ? "✓" : "✗"}  ${label}`);
  }
  const pct = Math.round((hits / EXPECT.length) * 100);
  console.log(`\n  ${hits}/${EXPECT.length} — ${pct}%\n`);
}
main();
