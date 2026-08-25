/**
 * Phase 2 verify — codegen + build generated @blocksmith package
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

async function main() {
  process.env.BLOCKSMITH_DOC =
    process.env.BLOCKSMITH_DOC?.trim() || "upload:scan-acme-ui-kit.md";
  process.env.AI_LAB_SCAN_CURATE = "0";

  execSync("npm run codegen:pulse", { stdio: "inherit", cwd: process.cwd() });
  execSync("npm install --ignore-scripts", { stdio: "inherit", cwd: process.cwd() });
  execSync("npm run build -w @blocksmith/pulse-runtime", {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  execSync("npm run build -w @blocksmith/acme-ui-kit", {
    stdio: "inherit",
    cwd: process.cwd(),
  });

  const distIndex = join(
    process.cwd(),
    "packages/generated/acme-ui-kit/dist/index.js",
  );
  const tokensCss = join(
    process.cwd(),
    "packages/generated/acme-ui-kit/src/tokens.css",
  );

  const errors: string[] = [];
  if (!existsSync(distIndex)) errors.push("missing dist/index.js");
  if (!existsSync(tokensCss)) errors.push("missing src/tokens.css");

  const css = readFileSync(tokensCss, "utf-8");
  if (!css.includes("--acme-accent")) errors.push("tokens.css missing --acme-accent");

  const dist = readFileSync(distIndex, "utf-8");
  if (!dist.includes("Button")) errors.push("dist missing Button export");

  // Faithfulness guard: components must reflect their real interface, not the
  // legacy `<div>{children}</div>` stub. Card carries a required `title` prop
  // and renders a <section>; Input renders an <input>. If codegen ever falls
  // back to generic stubs for IR-bearing components, these catch it.
  const compDir = join(
    process.cwd(),
    "packages/generated/acme-ui-kit/src/components",
  );
  const faithful: [string, RegExp, string][] = [
    ["Card.tsx", /title\s*[:?]/, "Card lost its real `title` prop (stub regression)"],
    ["Card.tsx", /<section/, "Card no longer renders <section> (stub regression)"],
    ["Input.tsx", /<input/, "Input no longer renders <input> (stub regression)"],
    ["Badge.tsx", /label\s*[:?]/, "Badge lost its real `label` prop (stub regression)"],
  ];
  for (const [file, re, msg] of faithful) {
    const p = join(compDir, file);
    if (!existsSync(p)) {
      errors.push(`missing generated ${file}`);
      continue;
    }
    if (!re.test(readFileSync(p, "utf-8"))) errors.push(msg);
  }

  console.log("Pulse verify");
  console.log(`  Package: @blocksmith/acme-ui-kit`);
  console.log(`  Dist:    ${distIndex}`);
  console.log(`  Faithful: Card/Input/Badge match scanned interface`);

  if (errors.length) {
    console.error("\nFAILED:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log("\nOK — pulse codegen package builds.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
