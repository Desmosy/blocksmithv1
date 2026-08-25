/**
 * Full local product check — software + storage + cloud modules + pulse demo artifacts.
 * Live HTTP (Patterns 2–4, /demo/pulse): npm run verify:patterns-live (needs dev server).
 */
import { existsSync } from "fs";
import { join } from "path";
import { runPulseCodegen } from "../src/lib/codegen/run";

async function main() {
  const errors: string[] = [];

  const pulse = await runPulseCodegen("upload:scan-acme-ui-kit.md");
  if (pulse.slug !== "acme-ui-kit") {
    errors.push(`expected slug acme-ui-kit, got ${pulse.slug}`);
  }

  const checks: [string, string][] = [
    ["Pulse demo page", join(process.cwd(), "src/app/demo/pulse/page.tsx")],
    ["Pulse demo component", join(process.cwd(), "src/components/demo/PulseDemo.tsx")],
    ["Generated dist", join(process.cwd(), "packages/generated/acme-ui-kit/dist/index.js")],
    ["Pulse runtime dist", join(process.cwd(), "packages/pulse-runtime/dist/index.js")],
    ["Fixture scan snapshot", join(process.cwd(), "fixtures/vendor-ui/.blocksmith/scan-snapshot.md")],
    ["Codegen API route", join(process.cwd(), "src/app/api/v1/codegen/pulse/route.ts")],
  ];

  for (const [label, path] of checks) {
    if (!existsSync(path)) errors.push(`missing ${label}: ${path}`);
  }

  console.log("Workable product check");
  console.log(`  Pulse package: ${pulse.packageName}`);
  console.log(`  Demo route:    /demo/pulse`);
  console.log(`  Import:`);
  for (const line of pulse.importExample.split("\n")) {
    console.log(`    ${line}`);
  }

  if (errors.length) {
    console.error("\nFAILED:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log("\nOK — BlockSmith is workable locally.");
  console.log("  npm run dev");
  console.log("  open http://localhost:3000/demo/pulse");
  console.log("  npm run verify:patterns-live   # with dev running");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
