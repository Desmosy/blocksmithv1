#!/usr/bin/env node
/**
 * Return the demo to a known state, then make it fast.
 *
 * Two things go wrong when a demo is run more than once:
 *  1. A component an agent proposed on the last take is still on screen.
 *  2. The first render of a design system is cold, and a judge watches a
 *     spinner. Measured: 7.7s cold, 0.15s warm.
 *
 * This clears the first and removes the second. Run it before every take.
 * See docs/DEMO-SCRIPT.md.
 */

const BASE = process.env.BLOCKSMITH_DEMO_URL ?? "http://localhost:3000";

/** The systems a judge can open with no session — middleware PUBLIC_DOC_PARAMS. */
const DOCS = ["portfolio.md", "saas.md", "docs.md", "apollo.md"];

/** Warmer than this on a re-run and something is still compiling. */
const WARM_BUDGET_MS = 1500;

const ms = (n) => `${n.toFixed(0)}ms`;

async function main() {
  console.log(`demo:reset → ${BASE}\n`);

  // 1. Is anything listening? Failing here with a clear message beats four
  //    identical connection-refused stacks.
  try {
    await fetch(BASE, { method: "HEAD" });
  } catch {
    console.error(`No server at ${BASE}. Start one with \`npm run dev\`.`);
    process.exit(1);
  }

  // 2. Drop staged proposals. The endpoint is development-only by design, so a
  //    404 against a production target is the expected answer, not a failure.
  let cleared = "skipped";
  try {
    const res = await fetch(`${BASE}/api/webmcp/proposal`, { method: "DELETE" });
    if (res.status === 404) {
      cleared = "n/a (production target — proposals expire on their own)";
    } else if (res.ok) {
      cleared = `${(await res.json()).cleared} staged proposal(s)`;
    } else {
      cleared = `unexpected ${res.status}`;
    }
  } catch (err) {
    cleared = `failed — ${err.message}`;
  }
  console.log(`  proposals cleared: ${cleared}\n`);

  // 3. Warm every system the demo visits, and report honestly if one is slow.
  let slow = 0;
  let broken = 0;
  for (const doc of DOCS) {
    const url = `${BASE}/wiki?doc=${doc}`;
    const started = performance.now();
    let status;
    try {
      status = (await fetch(url, { headers: { "cache-control": "no-cache" } })).status;
    } catch (err) {
      console.log(`  ✗ ${doc.padEnd(14)} unreachable — ${err.message}`);
      broken += 1;
      continue;
    }
    const took = performance.now() - started;

    if (status !== 200) {
      console.log(`  ✗ ${doc.padEnd(14)} HTTP ${status}`);
      broken += 1;
    } else if (took > WARM_BUDGET_MS) {
      // First pass on a cold server legitimately takes seconds; the point is to
      // pay that cost now rather than on camera.
      console.log(`  • ${doc.padEnd(14)} ${ms(took)} — was cold, now warm`);
      slow += 1;
    } else {
      console.log(`  ✓ ${doc.padEnd(14)} ${ms(took)}`);
    }
  }

  if (broken) {
    console.error(`\nFAILED — ${broken} system(s) did not load. Do not start the demo.`);
    process.exit(1);
  }

  console.log(
    slow
      ? `\nReady. ${slow} system(s) were cold — run this once more to confirm they stay warm.`
      : `\nReady. All ${DOCS.length} systems warm. Header should read "13 agent tools live on this page".`,
  );
}

main().catch((err) => {
  console.error(`demo:reset failed: ${err.message}`);
  process.exit(1);
});
