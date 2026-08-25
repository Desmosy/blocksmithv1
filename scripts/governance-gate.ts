/**
 * Governance gate — fail the build/commit when changed UI code introduces
 * colors that are not defined tokens in the design system. This is what turns
 * the wiki from documentation into enforcement: deviations can't land.
 *
 * Usage:
 *   npm run governance:check                              # staged changes (pre-commit)
 *   npm run governance:check -- --all                     # working-tree changes
 *   npm run governance:check -- --range origin/main...HEAD  # CI (a push/PR range)
 *   BLOCKSMITH_DOC=apollo.md npm run governance:check      # pick the source-of-truth doc
 *
 * Only ADDED lines in UI files (.ts/.tsx/.js/.jsx/.css/.scss) are scanned, so
 * it gates new deviations without flagging pre-existing code.
 */
import { execSync } from "child_process";
import { loadDocForAiLab } from "@/ai-lab/shared/load-doc";
import { paletteFromColors, scanLine } from "@/lib/governance/color-lint";

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
  const args = { range: "", all: false, doc: process.env.BLOCKSMITH_DOC || "apollo.md" };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--all") args.all = true;
    else if (argv[i] === "--range") args.range = argv[++i] ?? "";
    else if (argv[i] === "--doc") args.doc = argv[++i] ?? args.doc;
  }
  return args;
}

function diffCommand(args: ReturnType<typeof parseArgs>): string {
  const pathspec = UI_PATHSPEC.map((p) => `'${p}'`).join(" ");
  if (args.range) return `git diff --unified=0 ${args.range} -- ${pathspec}`;
  if (args.all) return `git diff --unified=0 -- ${pathspec}`;
  return `git diff --cached --unified=0 -- ${pathspec}`;
}

/** Walk a unified diff, yielding each added line with its new-file line number. */
function* addedLines(diff: string): Generator<{ file: string; line: number; text: string }> {
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

function main() {
  const args = parseArgs(process.argv.slice(2));

  let palette: Set<string>;
  let docLabel: string;
  try {
    const { system } = loadDocForAiLab(args.doc);
    palette = paletteFromColors(system.colors);
    docLabel = system.name;
  } catch (err) {
    console.error(`[governance] could not load doc "${args.doc}": ${String(err)}`);
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
  console.log(`Governance gate · ${docLabel} · ${palette.size} tokens · ${scope}`);

  if (violations.length === 0) {
    console.log("✅ No off-token colors introduced. On-system.");
    process.exit(0);
  }

  console.error(`\n❌ ${violations.length} off-token color(s) — these deviate from ${docLabel}:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.hex}`);
    console.error(`      ${v.snippet}`);
  }
  console.error(
    `\nUse a defined token (see the wiki palette) or add the color to the design doc first.`,
  );
  console.error(`Override (not recommended): git commit --no-verify\n`);
  process.exit(1);
}

main();
