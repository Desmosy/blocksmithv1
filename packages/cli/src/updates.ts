import type { BlockSmith, Deviation } from "@blocksmith/sdk";
import { flagStr, type Flags } from "./args.js";

const COLORS = {
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
};

function formatAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) {
    const mins = Math.max(1, Math.floor(diff / 60000));
    return `${mins}m ago`;
  }
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatTimeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "expiring…";
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function statusIcon(status: string): string {
  switch (status) {
    case "approved":
    case "auto_approved":
      return COLORS.green("✅");
    case "rejected":
      return COLORS.red("❌");
    case "pending":
      return COLORS.yellow("⏳");
    case "resolved":
      return COLORS.dim("🔧");
    default:
      return "  ";
  }
}

function statusLabel(d: Deviation): string {
  switch (d.status) {
    case "auto_approved":
      return COLORS.dim(`Auto-approved · ${formatAgo(d.resolvedAt ?? d.createdAt)}`);
    case "approved":
      return COLORS.green(`Approved by @${d.reviewedBy ?? "?"} · ${formatAgo(d.resolvedAt ?? d.createdAt)}`);
    case "rejected":
      return COLORS.red(`Rejected by @${d.reviewedBy ?? "?"} · ${formatAgo(d.resolvedAt ?? d.createdAt)}`);
    case "pending":
      return COLORS.yellow(`Pending review · auto-approves in ${formatTimeLeft(d.expiresAt)}`);
    case "resolved":
      return COLORS.dim(`Resolved · ${formatAgo(d.resolvedAt ?? d.createdAt)}`);
    default:
      return d.status;
  }
}

/**
 * `blocksmith updates` — list deviation decisions for the current developer.
 */
export async function cmdUpdates(
  client: BlockSmith,
  flags: Flags,
): Promise<void> {
  const pushedBy = flagStr(flags, "user", "u");

  try {
    const result = await client.deviations.list(
      pushedBy ? { pushedBy } : undefined,
    );
    const deviations = result.deviations;

    if (deviations.length === 0) {
      console.log(COLORS.green("✓ No deviation updates."));
      return;
    }

    // Group by status
    const rejected = deviations.filter((d) => d.status === "rejected");
    const pending = deviations.filter((d) => d.status === "pending");
    const approved = deviations.filter(
      (d) => d.status === "approved" || d.status === "auto_approved",
    );
    const resolved = deviations.filter((d) => d.status === "resolved");

    const newCount = rejected.length + approved.length;
    console.log(
      `\n${COLORS.bold("📋  Deviation Updates")}  ${COLORS.dim(`(${newCount} resolved, ${pending.length} pending)`)}`,
    );
    console.log(COLORS.dim("─".repeat(56)));

    // Show rejected first (needs action)
    for (const d of rejected) {
      printDeviation(d);
      if (d.fixSuggestion) {
        console.log(
          `    Fix: ${COLORS.cyan(`"${d.fixSuggestion}"`)}`,
        );
        console.log(
          `    → Run: ${COLORS.bold(`blocksmith fix ${d.blockId}`)}`,
        );
      }
      if (d.rejectionCount >= 2) {
        console.log(
          COLORS.red("    ⚠️  This block is now locked until resolved."),
        );
      }
      console.log("");
    }

    // Pending
    for (const d of pending) {
      printDeviation(d);
      console.log("");
    }

    // Approved
    for (const d of approved) {
      printDeviation(d);
      console.log(
        COLORS.dim("    Lock updated — no action needed."),
      );
      console.log("");
    }

    // Resolved
    for (const d of resolved) {
      printDeviation(d);
      console.log("");
    }

    // Budget summary
    if (pushedBy) {
      try {
        const budget = await client.deviations.budget(pushedBy);
        console.log(
          COLORS.dim("─".repeat(56)),
        );
        console.log(
          `Budget: ${budget.openCount}/${budget.maxOpen} slots used${budget.budgetExceeded ? COLORS.red(" — resolve one before pushing more.") : ""}`,
        );
      } catch {
        /* budget check optional */
      }
    }

    console.log(
      COLORS.dim(`\nRun ${COLORS.bold("blocksmith pull")} to sync approved changes to your lock file.`),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error fetching updates: ${msg}`);
    process.exit(1);
  }
}

function printDeviation(d: Deviation): void {
  const diff = d.deviationDiff;
  console.log(
    `${statusIcon(d.status)}  ${COLORS.bold(d.blockId)}    ${diff.field}: ${diff.wikiValue} → ${diff.pushedValue}`,
  );
  console.log(`    ${statusLabel(d)}`);
}
