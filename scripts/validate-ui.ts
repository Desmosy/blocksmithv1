/**
 * validate_ui — the Design CI/CD GATE stage (research doc §6.1, row "Gate").
 *
 * Fails a PR when:
 *   1. blocksmith.lock is missing while a registry exists (unpinned agents)
 *   2. the lock is STALE — its graph hash no longer matches the promoted
 *      official graph (someone finalized newer block versions; re-pull)
 *   3. the diff introduces off-token colors (deviates from locked tokens)
 *
 * Usage:
 *   npm run validate:ui                              # staged changes
 *   npm run validate:ui -- --range origin/main...HEAD  # CI (PR range)
 *   npm run validate:ui -- --all                      # working tree
 *   npm run validate:ui -- --lock path/to/blocksmith.lock
 *   npm run validate:ui -- --allow-stale              # warn instead of fail
 *
 * Exit codes: 0 governed · 1 violations/stale lock · 2 setup error
 */
import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { loadDocForAiLab } from "@/ai-lab/shared/load-doc";
import { paletteFromColors, scanLine } from "@/lib/governance/color-lint";
import { readLock, referenceLockPath, verifyLock } from "@/lib/ir/lock";
import { listRegistryEntries } from "@/lib/ir/registry";

type Violation = { file: string; line: number; hex: string; snippet: string };

const UI_PATHSPEC = ["*.ts", "*.tsx", "*.js", "*.jsx", "*.css", "*.scss"];

function sh(cmd: string): string {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString();
  } catch {
    return "";
  }
}

function parseArgs(argv: string[]) {
  const args = {
    range: "",
    all: false,
    doc: process.env.BLOCKSMITH_DOC || "apollo.md",
    lock: "",
    allowStale: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--all") args.all = true;
    else if (argv[i] === "--range") args.range = argv[++i] ?? "";
    else if (argv[i] === "--doc") args.doc = argv[++i] ?? args.doc;
    else if (argv[i] === "--lock") args.lock = argv[++i] ?? "";
    else if (argv[i] === "--allow-stale") args.allowStale = true;
  }
  return args;
}

function diffCommand(args: ReturnType<typeof parseArgs>): string {
  const pathspec = UI_PATHSPEC.map((p) => `'${p}'`).join(" ");
  if (args.range) return `git diff --unified=0 ${args.range} -- ${pathspec}`;
  if (args.all) return `git diff --unified=0 -- ${pathspec}`;
  return `git diff --cached --unified=0 -- ${pathspec}`;
}

function* addedLines(
  diff: string,
): Generator<{ file: string; line: number; text: string }> {
  let file = "";
  let newLine = 0;
  for (const raw of diff.split("\n")) {
    if (raw.startsWith("+++ b/")) {
      file = raw.slice(6);
    } else if (raw.startsWith("@@")) {
      const m = raw.match(/\+(\d+)/);
      newLine = m ? Number(m[1]) : 0;
    } else if (raw.startsWith("+") && !raw.startsWith("+++")) {
      yield { file, line: newLine, text: raw.slice(1) };
      newLine += 1;
    } else if (!raw.startsWith("-")) {
      newLine += 1;
    }
  }
}

function resolveLockPath(explicit: string, doc: string): string | null {
  const candidates = explicit
    ? [explicit]
    : [
        join(process.cwd(), "blocksmith.lock"),
        referenceLockPath(doc),
        referenceLockPath(),
      ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  let failed = false;

  // ── Stage 1: lock freshness ────────────────────────────────────────────
  const lockPath = resolveLockPath(args.lock, args.doc);
  const lock = lockPath ? readLock(lockPath) : null;
  const registryExists = listRegistryEntries(args.doc).length > 0;

  if (!lock) {
    if (registryExists) {
      console.error(
        `❌ No blocksmith.lock found, but the design registry for "${args.doc}" has promoted blocks.`,
      );
      console.error(
        "   Agents are running unpinned. Pull the lock: blocksmith pull, or MCP get_lockfile.\n",
      );
      failed = true;
    } else {
      console.log("ℹ️  No blocksmith.lock and no registry — lock check skipped.");
    }
  } else {
    const v = verifyLock(lock.docRef, lock);
    if (v.ok) {
      console.log(
        `🔒 Lock fresh — ${Object.keys(lock.blocks).length} blocks pinned at ${v.lockHash} (${lockPath})`,
      );
    } else {
      const headline = v.stale
        ? `Lock is STALE: pinned graph ${v.lockHash} ≠ promoted graph ${v.registryHash}.`
        : "Lock drift detected.";
      const log = args.allowStale ? console.warn : console.error;
      log(`${args.allowStale ? "⚠️ " : "❌"} ${headline}`);
      for (const m of v.versionMismatches) {
        log(`   ${m.id}: locked v${m.locked}, official is v${m.official}`);
      }
      for (const id of v.missingInLock) log(`   ${id}: promoted but not pinned`);
      for (const id of v.missingInRegistry) {
        log(`   ${id}: pinned but no longer promoted (rolled back or removed)`);
      }
      for (const id of v.hashMismatches) {
        log(`   ${id}: contentHash mismatch — lock corrupted or hand-edited`);
      }
      log(
        "   A human promoted newer block versions in the wiki. Re-pull the lock before merging.\n",
      );
      if (!args.allowStale) failed = true;
    }
  }

  // ── Stage 2: off-token colors in the diff ──────────────────────────────
  let palette: Set<string>;
  let docLabel: string;
  try {
    const { system } = loadDocForAiLab(args.doc);
    palette = paletteFromColors(system.colors);
    docLabel = system.name;
  } catch (err) {
    console.error(`[validate_ui] could not load doc "${args.doc}": ${String(err)}`);
    process.exit(2);
  }

  const diff = sh(diffCommand(args));
  const violations: Violation[] = [];
  for (const { file, line, text } of addedLines(diff)) {
    for (const hex of scanLine(text, palette)) {
      violations.push({ file, line, hex, snippet: text.trim().slice(0, 80) });
    }
  }

  const scope = args.range
    ? `range ${args.range}`
    : args.all
      ? "working tree"
      : "staged changes";
  console.log(`validate_ui · ${docLabel} · ${palette.size} tokens · ${scope}`);

  if (violations.length) {
    console.error(
      `\n❌ ${violations.length} off-token color(s) — these deviate from the locked design system:\n`,
    );
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}  ${v.hex}`);
      console.error(`      ${v.snippet}`);
    }
    console.error(
      "\nUse a locked token (see wiki palette / MCP get_design_tokens) or promote the new color in the wiki first.\n",
    );
    failed = true;
  } else {
    console.log("✅ No off-token colors introduced.");
  }

  process.exit(failed ? 1 : 0);
}

main();
