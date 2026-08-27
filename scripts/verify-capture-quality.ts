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

const ELEVENLABS: [string, RegExp][] = [
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

/**
 * cohere.com, listed by walking the page: an announcement bar over a
 * transparent nav with the wordmark left and a dark pill right; a hero of two
 * rounded media tiles (3D-orb gradient, photo); a trust row of five logos;
 * three feature columns under line-art icons; a full-bleed dark product band;
 * an industry carousel of image cards with arrow buttons and a scrubber;
 * beige tinted cards; a model list separated by dark rules; a blue gradient
 * developer band; a testimonial card with a 1px dark outline; a purple CTA
 * band with a white pill; a dark six-column footer with social icons.
 */
const COHERE: [string, RegExp][] = [
  ["Top nav bar", /Top Nav Bar/],
  ["Logo wordmark", /^Logo$/],
  ["Dark filled pill button (Request a demo)", /Filled Pill Button|Secondary Pill Button|Primary Pill Button/],
  ["White pill button (CTA band)", /Outline Pill Button|Surface Pill Button|Light .*Pill Button/],
  ["Text link with arrow (Learn more →)", /Text Link/],
  ["Hero media tile / gradient panel", /Gradient Panel|Hero .*Image|Image Grid/],
  ["Trust logo row", /Logo Grid/],
  ["Industry image card carousel", /Card Grid|Media Card|Large Image/],
  ["Beige tinted card", /Tinted Card|Panel/],
  ["Outlined testimonial card", /Outlined Card/],
  ["Dark rule between model rows", /Hairline Divider|Divider/],
  ["Dark product band (North)", /Dark .*Card|Feature Dark/],
  ["Footer", /^Footer$/],
  ["Icon (line-art / social)", /^Icon$|Illustration|Icon Button/],
];

const KEYS: Record<string, [string, RegExp][]> = {
  "elevenlabs.io": ELEVENLABS,
  "cohere.com": COHERE,
};


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
  const host = new URL(url).hostname.replace(/^www\./, "");
  const EXPECT = KEYS[host];
  if (!EXPECT) {
    console.log(`\nNo answer key for ${host} — nothing to score against. Keys exist for: ${Object.keys(KEYS).join(", ")}.\n`);
    return;
  }
  console.log(`\nAgainst the answer key for ${host}:\n`);
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
