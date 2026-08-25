import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { Flags } from "./args.js";
import { flagBool, flagStr } from "./args.js";
import { gitRoot } from "./git-files.js";
import { writeRepoConfig, readRepoConfig } from "./repo-config.js";

const HOOK_MARKER = "# >>> blocksmith governance >>>";
const HOOK_END = "# <<< blocksmith governance <<<";

/**
 * pre-push hook: warn on prose drift (Tier 2, captured), fail on block-tier
 * (Tier 1). `--strict` here would require --reason; default stays friendly.
 * Fails open if the CLI or network is unavailable so pushes are never bricked.
 */
function hookBody(strict: boolean): string {
  return `#!/bin/sh
${HOOK_MARKER}
# Installed by \`blocksmith setup hooks\`. Re-run to update; delete this block to remove.
if command -v blocksmith >/dev/null 2>&1; then
  # Compare commits being pushed vs upstream (not --staged — that is pre-commit only).
  if git rev-parse --abbrev-ref @{u} >/dev/null 2>&1; then
    blocksmith check --base "@{u}..HEAD" --record --hook${strict ? " --strict" : ""}
  else
    blocksmith check --record --hook${strict ? " --strict" : ""}
  fi
  status=$?
  if [ "$status" -ne 0 ]; then
    echo ""
    echo "Push blocked by BlockSmith governance."
    echo "Check the errors above, or re-run interactively to override:"
    echo "  blocksmith check"
    echo "or bypass once:        git push --no-verify"
    exit "$status"
  fi
else
  echo "blocksmith CLI not found on PATH — skipping governance check."
fi
${HOOK_END}
`;
}

/** Insert/replace the BlockSmith block in an existing hook, or create one. */
function mergeHook(existing: string | null, body: string): string {
  if (!existing) return body;
  if (existing.includes(HOOK_MARKER)) {
    const re = new RegExp(`${HOOK_MARKER}[\\s\\S]*?${HOOK_END}\\n?`, "m");
    const inner = body
      .replace(/^#!.*\n/, "")
      .trim();
    return existing.replace(re, `${inner}\n`);
  }
  // Append our block to a user-authored hook, preserving their shebang.
  const inner = body.replace(/^#!.*\n/, "").trim();
  return `${existing.replace(/\n*$/, "")}\n\n${inner}\n`;
}

export function cmdSetupHooks(flags: Flags): void {
  const root = gitRoot(process.cwd());
  if (!root) {
    throw new Error("Not inside a git repository — run this from your repo root.");
  }

  const explicitDoc = flagStr(flags, "doc", "d");
  const docRef = explicitDoc ?? readRepoConfig(root).docRef;
  if (!docRef) {
    throw new Error(
      "Which design system? Pass --doc upload:scan-….md the first time so the\n" +
        "hook knows what to check against.",
    );
  }
  if (explicitDoc) {
    const path = writeRepoConfig(root, { docRef: explicitDoc });
    console.log(`Saved design system to ${path}`);
  }

  const strict = flagBool(flags, "strict");
  const hooksDir = join(root, ".git", "hooks");
  mkdirSync(hooksDir, { recursive: true });
  const hookPath = join(hooksDir, "pre-push");

  const existing = existsSync(hookPath) ? readFileSync(hookPath, "utf-8") : null;
  const merged = mergeHook(existing, hookBody(strict));
  writeFileSync(hookPath, merged, "utf-8");
  chmodSync(hookPath, 0o755);

  console.log(`Installed pre-push hook → ${hookPath}`);
  console.log(`  Design system: ${docRef}`);
  console.log(`  Mode:          ${strict ? "strict (warnings block until --reason)" : "warn + capture (default)"}`);
  console.log("\nTest it now without pushing:");
  console.log("  blocksmith check");
  console.log("  blocksmith check --base @{u}..HEAD   # same as the hook when upstream is set");
}
