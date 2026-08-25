# Governance enforcement — three tiers

BlockSmith governs design drift at three escalating tiers. Not everything should
block; not everything should be silent.

| Tier | What | Where it fires | Outcome |
|------|------|----------------|---------|
| **1 — Block** | Off-token hex, stale/missing lock (machine-verifiable) | pre-commit / CI / `blocksmith check` | **Fails.** Bypass only via `git push --no-verify` (logged) |
| **2 — Warn** | Component prose rules (inactive links, stale dates, …) | pre-push / CI / `blocksmith check` | Yellow warning + **captured** to the wiki. Push proceeds unless `--strict` |
| **3 — Advisory** | Agent-time guidance | MCP `check_governance_diff` before coding | Prescriptive — suggests the nearest token + a prioritized "Next" block so the agent self-corrects |

Tier 2 defaults to **allow-with-capture**: drift is recorded so the design lead
sees it, without blocking the team. Repeated overrides on one rule are the
signal to promote it to Tier 1.

## The loop

```
customer repo  →  blocksmith check  →  POST /api/v1/governance/events  →  Supabase
                                                                            │
                                            wiki → Governance → Violations  ◀┘
```

A violation pushed with a reason shows up in **Component Activity** and the
**Violations** feed where a lead can resolve, request a fix, or escalate.

## Commands

```bash
# Check changed UI files against the promoted rules of a design system
blocksmith check --doc upload:scan-your-kit.md

# Only staged files (what a pre-commit hook sees)
blocksmith check --staged

# CI: diff against the base branch, emit a PR-comment summary
blocksmith check --base origin/main...HEAD --ci --format github

# Push anyway past a Tier-2 warning — reason is captured for review
blocksmith check --staged --reason "Legal asked to keep temporarily; removing next PR"

# Install a pre-push hook (saves the doc ref to .blocksmith/blocksmith.json)
blocksmith setup hooks --doc upload:scan-your-kit.md
# Strict variant — Tier-2 warnings block until a --reason is given
blocksmith setup hooks --doc upload:scan-your-kit.md --strict
```

Exit codes: `0` clean / warn-captured · `1` blocking (or `--strict` warn without
`--reason`) · `2` misconfiguration (no doc ref). The check **fails open** on
network/CLI errors so a flaky connection never bricks a push.

## CI

Copy [`examples/github/blocksmith-governance.yml`](../examples/github/blocksmith-governance.yml)
to `.github/workflows/`. It runs the check against the PR's base branch, posts a
sticky comment ("2 governance warnings in this PR"), and fails the job only on
Tier-1 blocking violations.

## Detection — v1 → v3

- **v1 (today):** heuristics compiled from promoted component prose
  (`src/lib/governance/prose-lint.ts`) — `inactive-link`, `stale-date`,
  `stale-address`. False positives are acceptable at warn tier; the lead triages.
- **v2:** a rule engine driven by the same governance IR that feeds MCP.
- **v3:** optional LLM gate on the diff for nuance (enterprise "strict mode").

Block-tier color linting (`color-lint.ts`) is already exact, not heuristic.
