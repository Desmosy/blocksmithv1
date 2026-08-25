#!/usr/bin/env node
/**
 * Ensure generated pulse package exists after npm install (CI/Vercel/fresh clone).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const generatedPkg = join(root, "packages/generated/acme-ui-kit/dist/index.js");

if (existsSync(generatedPkg) || process.env.BLOCKSMITH_ENSURE_PULSE === "1") {
  process.exit(0);
}

process.env.BLOCKSMITH_ENSURE_PULSE = "1";
console.log("[ensure-pulse] Generating @blocksmith/acme-ui-kit…");
execSync("npm run build:pulse", { stdio: "inherit", cwd: root, env: process.env });
