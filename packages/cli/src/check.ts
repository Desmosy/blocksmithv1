import { readFileSync } from "fs";
import * as readline from "readline";
import type { BlockSmith, GovernanceFinding, DeviationDiff } from "@blocksmith/sdk";
import { flagBool, flagStr, type Flags } from "./args.js";
import {
  gitBranch,
  gitCommit,
  gitRoot,
  listChangedUiFiles,
  readFiles,
  type ChangeScope,
} from "./git-files.js";
import { resolveDocRef } from "./repo-config.js";

type FileFindings = { relPath: string; findings: GovernanceFinding[] };

const COLORS = {
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

function resolveScope(flags: Flags): { scope: ChangeScope; base?: string } {
  const base = flagStr(flags, "base");
  if (base) return { scope: "range", base };
  if (flagBool(flags, "staged")) return { scope: "staged" };
  return { scope: "working" };
}

export type CheckOptions = {
  format: "text" | "json" | "github";
  strict: boolean;
  record: boolean;
  reason?: string;
  source: "cli" | "git-hook" | "ci";
};

/** Collect findings across all changed UI files, optionally recording events. */
async function runCheck(
  client: BlockSmith,
  docRef: string,
  files: { relPath: string; code: string }[],
  meta: { commit?: string; branch?: string },
  opts: CheckOptions,
  pushedBy: string,
): Promise<{
  results: FileFindings[];
  blockCount: number;
  warnCount: number;
}> {
  const results: FileFindings[] = [];
  let blockCount = 0;
  let warnCount = 0;

  for (const file of files) {
    // First pass detects; we record once per file with the right action below.
    const res = await client.governance.check({
      docRef,
      code: file.code,
      filePath: file.relPath,
      source: opts.source,
    });
    if (res.findings.length === 0) continue;

    results.push({ relPath: file.relPath, findings: res.findings });
    blockCount += res.blockCount;
    warnCount += res.warnCount;

    if (opts.record) {
      const hasBlock = res.blockCount > 0;
      // Tier-2 prose drift is captured automatically (allow-with-capture).
      // An explicit --reason marks a human override; a reason over block-tier
      // is a logged bypass (still fails, but audited).
      const action = opts.reason
        ? hasBlock
          ? "bypass"
          : "overridden"
        : "detected";
      await client.governance.check({
        docRef,
        code: file.code,
        filePath: file.relPath,
        record: true,
        source: opts.source,
        action,
        commit: meta.commit,
        branch: meta.branch,
        overrideReason: opts.reason,
      });
    }
  }

  return { results, blockCount, warnCount };
}

function promptInteractive(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    }),
  );
}

async function handleInteractiveDeviations(
  client: BlockSmith,
  results: FileFindings[],
  blockCount: number,
  warnCount: number,
  opts: CheckOptions,
  docRef: string,
  meta: { commit?: string; branch?: string; pushedBy: string },
): Promise<void> {
  if (results.length === 0) {
    console.log(COLORS.green("✓ Governance clean — no violations in changed UI files."));
    process.exit(0);
  }

  for (const { relPath, findings } of results) {
    console.log(`\n${COLORS.bold(relPath)}`);
    for (const f of findings) {
      const tag =
        f.tier === "block"
          ? COLORS.red("BLOCK")
          : COLORS.yellow("WARN ");
      const loc = f.line ? COLORS.dim(`:${f.line}`) : "";
      console.log(`  ${tag} ${f.message}${loc}`);
      if (f.snippet) console.log(`        ${COLORS.dim(f.snippet)}`);
      if (f.ruleCitation) {
        console.log(`        ${COLORS.dim(`rule: ${f.ruleCitation.slice(0, 120)}`)}`);
      }
    }
  }

  console.log("");
  const parts: string[] = [];
  if (blockCount) parts.push(COLORS.red(`${blockCount} blocking`));
  if (warnCount) parts.push(COLORS.yellow(`${warnCount} warning${warnCount > 1 ? "s" : ""}`));
  console.log(parts.join(" · "));

  if (blockCount) {
    console.log(
      COLORS.red(
        "\nBlocking violations must be fixed (off-token colors / lock). " +
          "These never auto-pass.",
      ),
    );
    process.exit(1);
  }

  // Warning tier — interactive prompt
  if (opts.format !== "text") {
    // Non-interactive (CI/JSON), just warn and continue
    process.exit(0);
  }

  // Pre-check budget
  let budget;
  try {
    budget = await client.deviations.budget(meta.pushedBy);
    if (budget.budgetExceeded) {
      console.log(
        COLORS.red(
          `\n❌ Budget exceeded: You have ${budget.openCount} unreviewed deviations (max: ${budget.maxOpen}).`,
        ),
      );
      console.log(
        "Resolve existing deviations before pushing more. Run: " +
          COLORS.bold("blocksmith updates"),
      );
      process.exit(1);
    }
  } catch (err) {
    // If we can't check budget, fail open
  }

  console.log(
    COLORS.yellow(
      "\nThese warnings deviate from the wiki design guidelines.",
    ),
  );

  let ans = "";
  while (true) {
    ans = await promptInteractive(
      "Do you want to Push anyway (p), add a Reason/Fix (s), or Cancel (c)? [p/s/c]: ",
    );
    if (ans === "c" || ans === "p" || ans === "s") break;
  }

  if (ans === "c") {
    console.log("Cancelled.");
    process.exit(1);
  }

  let reason = opts.reason;
  if (ans === "s") {
    reason = await promptInteractive("Reason for deviation: ");
  }

  // Create deviation records for warnings
  if (opts.record) {
    console.log(COLORS.dim("Submitting deviations to the wiki queue..."));
    for (const { relPath, findings } of results) {
      for (const f of findings) {
        if (f.tier === "warn" && f.ruleId) {
          // Parse the message to extract diff.
          // Fallback simple string if we can't parse it well.
          const diff: DeviationDiff = {
            field: f.ruleId,
            wikiValue: f.ruleCitation ?? "guideline",
            pushedValue: f.snippet ?? "current code",
          };
          try {
            await client.deviations.create({
              docRef,
              blockId: f.ruleId,
              pushedBy: meta.pushedBy,
              deviationDiff: diff,
              commitRef: meta.commit,
              reason: reason,
            });
          } catch (err) {
            console.error(COLORS.red(`Failed to submit deviation: ${err instanceof Error ? err.message : String(err)}`));
          }
        }
      }
    }
  }

  if (budget) {
    console.log(
      COLORS.green(
        `\n✓ Deviations pushed to queue (Budget: ${budget.openCount + warnCount}/${budget.maxOpen}).`,
      ),
    );
    console.log(
      `Check status anytime with: ${COLORS.bold("blocksmith updates")}`,
    );
  } else {
    console.log(COLORS.green("\n✓ Deviations pushed to queue."));
  }

  process.exit(0);
}

/** Markdown summary for a CI PR comment. */
function printGithub(
  results: FileFindings[],
  blockCount: number,
  warnCount: number,
): void {
  const lines: string[] = ["### 🧱 BlockSmith governance"];
  if (results.length === 0) {
    lines.push("\n✅ No governance violations in changed UI files.");
    console.log(lines.join("\n"));
    return;
  }
  lines.push(
    `\n**${blockCount}** blocking · **${warnCount}** warning${warnCount === 1 ? "" : "s"}\n`,
  );
  lines.push("| File | Line | Tier | Rule |");
  lines.push("|------|------|------|------|");
  for (const { relPath, findings } of results) {
    for (const f of findings) {
      const tier = f.tier === "block" ? "🔴 block" : "🟡 warn";
      lines.push(
        `| \`${relPath}\` | ${f.line ?? "—"} | ${tier} | ${f.message.replace(/\|/g, "\\|")} |`,
      );
    }
  }
  if (blockCount) {
    lines.push("\n> 🔴 Blocking violations must be fixed before merge.");
  } else {
    lines.push("\n> 🟡 Warnings are advisory — a design lead will triage in the wiki.");
  }
  console.log(lines.join("\n"));
}

export async function cmdCheck(
  client: BlockSmith,
  positionals: string[],
  flags: Flags,
): Promise<void> {
  const cwd = process.cwd();
  const root = gitRoot(cwd) ?? cwd;

  const docRef = resolveDocRef(root, flagStr(flags, "doc", "d"));
  if (!docRef) {
    console.error(
      "No design system configured. Pass --doc upload:scan-….md or run\n" +
        "  blocksmith setup hooks --doc upload:scan-….md\n" +
        "to save it in .blocksmith/blocksmith.json.",
    );
    process.exit(2);
  }

  const format = (flagStr(flags, "format") as CheckOptions["format"]) ?? "text";
  const opts: CheckOptions = {
    format,
    strict: flagBool(flags, "strict"),
    record: flagBool(flags, "record") || flagBool(flags, "ci"),
    reason: flagStr(flags, "reason"),
    source: flagBool(flags, "ci")
      ? "ci"
      : flagBool(flags, "hook")
        ? "git-hook"
        : "cli",
  };

  // Explicit file paths win; otherwise diff against the chosen scope.
  let files: { relPath: string; code: string }[];
  if (positionals.length > 0) {
    files = positionals
      .map((p) => {
        try {
          return { relPath: p, code: readFileSync(p, "utf-8") };
        } catch {
          return null;
        }
      })
      .filter((f): f is { relPath: string; code: string } => f !== null);
  } else {
    const { scope, base } = resolveScope(flags);
    const changed = listChangedUiFiles(root, scope, base);
    files = readFiles(root, changed).map((f) => ({ relPath: f.relPath, code: f.code }));
  }

  if (files.length === 0) {
    if (format === "json") console.log(JSON.stringify({ ok: true, results: [] }));
    else if (format === "github") printGithub([], 0, 0);
    else console.log(COLORS.green("✓ No changed UI files to check."));
    return;
  }

  const pushedBy = process.env.USER || "local-dev";
  const meta = { commit: gitCommit(root), branch: gitBranch(root), pushedBy };

  let summary: { results: FileFindings[]; blockCount: number; warnCount: number };
  try {
    summary = await runCheck(client, docRef, files, meta, opts, pushedBy);
  } catch (err) {
    console.error(`Governance check failed: ${err instanceof Error ? err.message : err}`);
    // Never block a push on infra failure — fail open with a clear message.
    process.exit(0);
  }

  const { results, blockCount, warnCount } = summary;

  if (format === "json") {
    console.log(JSON.stringify({ docRef, blockCount, warnCount, results }, null, 2));
    if (blockCount > 0) process.exit(1);
    process.exit(0);
  } else if (format === "github") {
    printGithub(results, blockCount, warnCount);
    if (blockCount > 0) process.exit(1);
    process.exit(0);
  } else {
    // Interactively handle deviations (this function will process.exit())
    await handleInteractiveDeviations(client, results, blockCount, warnCount, opts, docRef, meta);
  }
}
