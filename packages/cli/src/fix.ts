import type { BlockSmith } from "@blocksmith/sdk";
import { type Flags } from "./args.js";

const COLORS = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
};

/**
 * `blocksmith fix <block-id>` — show the wiki guideline for a rejected block
 * so the developer knows exactly what to change.
 */
export async function cmdFix(
  client: BlockSmith,
  positionals: string[],
  _flags: Flags,
): Promise<void> {
  const blockId = positionals[0];
  if (!blockId) {
    console.error("Usage: blocksmith fix <block-id>");
    console.error("  Shows the wiki guideline for a block so you know what to fix.");
    console.error("\n  Example: blocksmith fix button-primary");
    process.exit(1);
  }

  try {
    // List deviations to find the rejected one for this block
    const result = await client.deviations.list({ status: "rejected" });
    const match = result.deviations.find((d) => d.blockId === blockId);

    console.log(`\n${COLORS.bold(`📝  Wiki guideline for ${blockId}:`)}`);
    console.log(COLORS.dim("─".repeat(56)));

    if (match) {
      const diff = match.deviationDiff;
      console.log(`    Field:    ${diff.field}`);
      console.log(`    Wiki:     ${COLORS.green(diff.wikiValue)}`);
      console.log(`    Yours:    ${COLORS.red(diff.pushedValue)}`);
      console.log("");

      if (match.fixSuggestion) {
        console.log(`    ${COLORS.cyan(`Fix suggestion: "${match.fixSuggestion}"`)}`);
        console.log("");
      }

      console.log(`    ${COLORS.dim("Suggested change:")}`);
      console.log(`    ${COLORS.red(`-  ${diff.field}: ${diff.pushedValue};`)}`);
      console.log(`    ${COLORS.green(`+  ${diff.field}: ${diff.wikiValue};`)}`);
    } else {
      console.log(
        COLORS.dim(`    No active rejection found for "${blockId}".`),
      );
      console.log(
        COLORS.dim("    Run `blocksmith updates` to see all deviations."),
      );
    }

    console.log("");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${msg}`);
    process.exit(1);
  }
}
