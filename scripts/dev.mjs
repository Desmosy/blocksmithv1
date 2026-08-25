#!/usr/bin/env node
/**
 * Safe dev startup — one Next process on port 3000.
 *
 *   npm run dev         → kill stale `next dev`, then start
 *   npm run dev:clean   → same + wipe .next (fixes missing chunk 611.js / 331.js)
 */
import { spawn } from "node:child_process";
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const cwd = process.cwd();
const clean = process.argv.includes("--clean");

function killStaleDevServers() {
  try {
    execSync("pkill -f 'next dev' 2>/dev/null || true", { stdio: "ignore" });
  } catch {
    /* none running */
  }
  for (const port of [3000, 3001]) {
    try {
      const pids = execSync(`lsof -ti:${port} 2>/dev/null || true`, {
        encoding: "utf8",
      }).trim();
      if (!pids) continue;
      for (const pid of pids.split(/\s+/)) {
        if (pid) execSync(`kill -9 ${pid} 2>/dev/null || true`, { stdio: "ignore" });
      }
    } catch {
      /* lsof unavailable */
    }
  }
}

/** Detect webpack chunk refs with no file on disk (causes Internal Server Error). */
function hasStaleWebpackChunks() {
  const chunksDir = join(cwd, ".next/server/chunks");
  if (!existsSync(chunksDir)) return false;

  const onDisk = new Set(
    readdirSync(chunksDir)
      .filter((f) => /^\d+\.js$/.test(f))
      .map((f) => f.replace(/\.js$/, "")),
  );
  if (onDisk.size === 0) return false;

  const scanDirs = [
    join(cwd, ".next/server/app"),
    join(cwd, ".next/server/pages"),
    join(cwd, ".next/server"),
  ];

  const referenced = new Set();
  const refRe = /require\(["']\.\/(\d+)\.js["']\)/g;

  for (const dir of scanDirs) {
    if (!existsSync(dir)) continue;
    walk(dir, referenced, refRe);
  }

  for (const id of referenced) {
    if (!onDisk.has(id)) return true;
  }
  return false;
}

function walk(dir, referenced, refRe) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(full, referenced, refRe);
      continue;
    }
    if (!ent.name.endsWith(".js")) continue;
    let text;
    try {
      text = readFileSync(full, "utf8");
    } catch {
      continue;
    }
    for (const m of text.matchAll(refRe)) {
      referenced.add(m[1]);
    }
  }
}

function wipeCache() {
  console.log("[dev] Removing .next and node_modules/.cache…");
  execSync("rm -rf .next node_modules/.cache", { cwd, stdio: "inherit" });
}

/** `next build` leaves BUILD_ID; running `next dev` on that tree → 500 / missing chunks. */
function hasProductionBuildArtifacts() {
  return existsSync(join(cwd, ".next/BUILD_ID"));
}

async function main() {
  killStaleDevServers();
  await new Promise((r) => setTimeout(r, 900));

  if (clean) {
    wipeCache();
  } else if (hasProductionBuildArtifacts()) {
    console.log(
      "[dev] Production build artifacts in .next (fixes blank pages / Internal Server Error). Cleaning cache…",
    );
    wipeCache();
  } else if (hasStaleWebpackChunks()) {
    console.log(
      "[dev] Stale webpack chunks detected (fixes “Cannot find module './611.js'”). Cleaning cache…",
    );
    wipeCache();
  }

  console.log("[dev] Starting next dev at http://localhost:3000");
  const child = spawn("npx", ["next", "dev"], {
    cwd,
    stdio: "inherit",
    env: process.env,
  });
  child.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error("[dev]", err);
  process.exit(1);
});
