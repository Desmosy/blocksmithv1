/**
 * Install (or update) the lieflat-charts agent skill for local use.
 *
 * lieflat-charts is a template-driven data-visualization skill
 * (https://github.com/larashero3-dotcom/lieflat-charts). It is licensed
 * PolyForm Noncommercial 1.0.0, which is incompatible with this repo's MIT
 * license — so it is never vendored or committed here. This script clones it
 * into .claude/skills/ (gitignored), where Claude Code discovers its SKILL.md
 * and can use it to draw charts and reports during development.
 *
 * Run: npm run skill:lieflat
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "https://github.com/larashero3-dotcom/lieflat-charts.git";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dest = path.join(root, ".claude", "skills", "lieflat-charts");

const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, stdio: "inherit" });

if (existsSync(path.join(dest, ".git"))) {
  console.log("lieflat-charts already installed — updating…");
  run("git", ["-C", dest, "pull", "--ff-only"]);
} else {
  console.log("Installing lieflat-charts skill (local only, not committed)…");
  run("git", ["clone", "--depth", "1", REPO, dest]);
}
console.log(
  "\nDone. The skill lives at .claude/skills/lieflat-charts (gitignored).\n" +
    "It is PolyForm Noncommercial — keep it out of anything you ship or sell.",
);
