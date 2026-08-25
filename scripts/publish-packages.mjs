#!/usr/bin/env node
/**
 * Publish @block-smith/cli to npm.
 *
 * The CLI bundles @blocksmith/sdk from source (see packages/cli/build.mjs), so
 * the published tarball is a single dependency-free file and the SDK does NOT
 * need to be published separately.
 *
 * Usage:
 *   npm run publish:packages            # publish for real
 *   npm run publish:packages:dry-run    # preview the tarball, publish nothing
 *
 * Requires `npm login` first, and that your npm account owns the @blocksmith scope.
 */
import { execSync } from "child_process";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
// Accounts with 2FA enforced for writes need an OTP at publish time:
//   npm run publish:packages -- --otp 123456
const otpIdx = args.indexOf("--otp");
const otp = otpIdx >= 0 ? args[otpIdx + 1] : undefined;

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: process.cwd() });
}

// prepublishOnly rebuilds the bundle, but build explicitly so failures surface early.
run("npm run build -w @block-smith/cli");
run(
  `npm publish -w @block-smith/cli --access public` +
    `${dryRun ? " --dry-run" : ""}${otp ? ` --otp ${otp}` : ""}`,
);

console.log(dryRun ? "\nDone (dry-run — nothing published)." : "\nPublished @block-smith/cli.");
