# Goal 4 — Deviation TTL & Pre-Push Governance


**Depends on:** [GOAL1-VENDOR-SCAN.md](./GOAL1-VENDOR-SCAN.md) (scan), [GOAL2-GOVERNANCE-COPILOT.md](./GOAL2-GOVERNANCE-COPILOT.md) (finalize), [GOAL3-TEAM-RBAC.md](./GOAL3-TEAM-RBAC.md) (roles), [08-web-ide-handshake.md](./08-web-ide-handshake.md) (sync)

---

## One sentence

> Warn developers **before** they push UI drift, let intentional deviations through without blocking, and give the design team async pass/rollback with a configurable time-to-live — no synchronous dependency between engineering and design.

---

## The problem

Developers occasionally need to push UI that differs from the wiki-finalized design — urgently, without waiting for UI/UX approval. Blocking them hurts velocity. But letting all drift pass silently means BlockSmith isn't doing its job as a governance layer. The system needs to be **permissive by default for occasional, legitimate changes** and **escalate only when drift becomes a pattern**.

---

## Three-layer architecture

```
Layer 1: Pre-push warning (catches 90% — developer fixes immediately)
Layer 2: TTL deviation queue (handles the intentional 10% — async review)
Layer 3: Progressive escalation (catches repeat offenders — auto-tightens)
```

Each layer catches what the previous one missed. No new vocabulary. No tagging required from designers.

---

## Layer 1 — Pre-push warning

When a developer runs `git push` (via pre-push hook) or `blocksmith check`, BlockSmith compares their changes against `blocksmith.lock` and the finalized wiki blocks.

### What the developer sees

```bash
$ git push origin feature/checkout-redesign

🔍 BlockSmith: checking against design wiki...

⚠️  2 blocks differ from the wiki guidelines:

  button-primary
  ├ Wiki:  border-radius: 8px
  └ Yours: border-radius: 12px

  color-accent
  ├ Wiki:  #FF69B4 (brand-pink)
  └ Yours: #FF0000 (red)

Options:
  [f] Fix — show the wiki guideline for these blocks
  [p] Push anyway — creates a deviation for design review
  [s] Skip check — push without logging (not recommended)

→
```

| Choice | What happens |
|--------|-------------|
| **f** (fix) | Prints the relevant wiki guideline. Developer corrects locally, pushes clean. No deviation created. |
| **p** (push anyway) | Push proceeds. A **deviation record** is created with the developer's conscious acknowledgment. Enters the TTL queue. |
| **s** (skip) | Push proceeds with no record. Logged in activity as `skipped-governance`. Visible to admins on the wiki. |

### Why this works

Most developers will choose **f** when they see the actual diff. The deviation was accidental — they didn't know the wiki said 8px, not 12px. The issue resolves instantly, in their terminal, without ever reaching the design team.

Only **intentional** deviations flow into Layer 2. This keeps the design team's queue clean.

### Hooks into existing system

This extends the existing `blocksmith check` command ([GOVERNANCE-TIERS.md](./GOVERNANCE-TIERS.md)):

- **Tier 1 (Block)** violations still hard-fail (off-token hex, missing lock)
- **Tier 2 (Warn)** violations now show the interactive prompt above
- **Tier 3 (Advisory)** remains MCP-time guidance

Setup: `blocksmith setup hooks --doc upload:scan-your-kit.md` (already exists — adds the interactive prompt to the pre-push hook).

---

## Layer 2 — TTL deviation queue

When a developer chooses **push anyway**, a deviation record enters the async review queue visible on the wiki.

### Deviation lifecycle

```
Developer pushes with deviation
        ↓
Deviation record created (status: pending)
        ↓
TTL countdown starts (default: 24h, team-configurable)
        ↓
Design team sees it in wiki Sync → Deviations Queue
        ↓
    ┌──────────────────────────┐
    │                          │
  Team reviews            No action within TTL
    │                          │
  ┌─┴──┐                  Auto-approves
  │    │                  (lock updates silently)
 Pass  Rollback
  │    │
  │    └─ Developer notified via `blocksmith updates`
  │       with fix suggestion
  │
  └─ Lock updates, deviation resolved
```

### Deviation record schema

```json
{
  "id": "dev_abc123",
  "block_id": "button-primary",
  "org_id": "org_xyz",
  "pushed_by": "github:alex",
  "deviation_diff": {
    "field": "border-radius",
    "wiki_value": "8px",
    "pushed_value": "12px"
  },
  "commit_ref": "abc1234",
  "pr_url": "https://github.com/acme/app/pull/42",
  "reason": "A/B test for checkout conversion",
  "status": "pending",
  "created_at": "2026-07-02T12:00:00Z",
  "expires_at": "2026-07-03T12:00:00Z",
  "reviewed_by": null,
  "fix_suggestion": null,
  "resolved_at": null
}
```

| Status | Meaning |
|--------|---------|
| `pending` | Waiting for design team review or TTL expiry |
| `auto_approved` | TTL expired, no one reviewed — lock adopts the new value |
| `approved` | Design team explicitly passed |
| `rejected` | Design team rolled back — developer must fix |
| `resolved` | Developer addressed a rejection |

### Wiki UI — Deviations Queue

Lives inside the existing **Sync page** (`/wiki/sync`):

```
┌─────────────────────────────────────────────────────────┐
│  ⚠️  Deviations Queue  (2 pending)                      │
│                                                          │
│  button-primary · @alex · 6h ago                        │
│  border-radius: 8px → 12px                              │
│  Reason: "A/B test for checkout conversion"             │
│  Auto-approves in: 18h 22m                              │
│  [  Pass  ]  [  Rollback  ]                             │
│                                                          │
│  color-accent · @priya · 1h ago                         │
│  #FF69B4 → #FF0000                                      │
│  Reason: "Client requested red for holiday campaign"    │
│  Auto-approves in: 23h 01m                              │
│  [  Pass  ]  [  Rollback  ]                             │
│                                                          │
│  ─── Resolved ───                                       │
│  ✅  nav-spacing · @alex · auto-approved 2d ago         │
│  ❌  card-shadow · @priya · rejected by @sarah 1d ago   │
│                                                          │
│  📊  Design Alignment: 94% this sprint                  │
└─────────────────────────────────────────────────────────┘
```

**Pass** → immediately approves, `blocksmith.lock` adopts the new value  
**Rollback** → rejects, opens a text field for fix suggestion, developer notified via `blocksmith updates`

**Who can Pass/Rollback:** `admin` and `owner` roles only (per [GOAL3-TEAM-RBAC.md](./GOAL3-TEAM-RBAC.md)). `member` and `viewer` can see the queue but not act on it.

### Developer CLI — `blocksmith updates`

The developer checks on their own schedule, from their terminal:

```bash
$ blocksmith updates

📋  Deviation Updates  (2 new since last check)
──────────────────────────────────────────────────────────
✅  button-primary    border-radius 8px → 12px
    Auto-approved · 6h ago
    Lock updated — no action needed.

❌  color-accent      #FF69B4 → #FF0000
    Rejected by @sarah (Design Lead) · 2h ago
    Fix: "Use var(--color-brand-warm) from the palette."
    → Run: blocksmith fix color-accent

⏳  nav-spacing       padding 16px → 20px
    Pending review · auto-approves in 12h
──────────────────────────────────────────────────────────
Run `blocksmith pull` to sync approved changes to your lock file.
```

- **Non-intrusive** — developer checks when they're ready, not mid-focus
- **Actionable** — each rejection surfaces the fix suggestion inline
- **No email fatigue** — one command replaces notification noise

### `blocksmith fix <block-id>`

Optional helper: pulls the current wiki guideline for that block so the developer sees exactly what to change:

```bash
$ blocksmith fix color-accent

📝  Wiki guideline for color-accent:
    Token:    var(--color-brand-warm)
    Hex:      #FF69B4
    Role:     Primary brand accent — CTAs, active states
    Rule:     Never use raw hex; always reference the token.

    Your code at src/components/Checkout.tsx:42:
      color: #FF0000;
    Suggested:
      color: var(--color-brand-warm);
```

---

## Layer 3 — Progressive escalation

No new concepts for users. The system gets stricter automatically based on behavior — the design team configures two numbers in Team Settings and never thinks about it again.

### Escalation rules

**Rule 1 — Deviation budget:**

Each developer has a maximum number of **open (pending)** deviations at any time. Default: 3. Configurable in Team Settings.

```
Dev pushes deviation #1  → ✅ passes, pending review
Dev pushes deviation #2  → ✅ passes, pending review
Dev pushes deviation #3  → ✅ passes, pending review
Dev pushes deviation #4  → ⛔ pre-push blocks:
   "You have 3 unreviewed deviations. Resolve existing ones
    before pushing more. Run: blocksmith updates"
```

Once existing deviations are approved or resolved, the budget resets. Not a punishment — flow control.

**Rule 2 — Ignored rejections escalate:**

If the design team rejects a deviation and the developer pushes the **same block** again without fixing it:

```
Rejection #1 → Developer notified via `blocksmith updates`
Developer ignores it, pushes same block again...
Rejection #2 (same block) → Pre-push blocks for THAT block only:
   "color-accent has been rejected twice. Please resolve
    before pushing changes to this block."
```

Only the repeatedly-rejected block is locked. Every other component flows freely.

### What the developer sees in their terminal

```bash
$ git push origin feature/new-checkout

🔍 BlockSmith: checking against design wiki...

⛔  Push blocked:

  You have 3 unreviewed deviations (budget: 3).
  Resolve existing deviations before pushing new ones.

  Run: blocksmith updates    (see pending decisions)
  Run: blocksmith pull       (sync approved changes)

  Current deviations:
  ⏳  button-primary  · pending · auto-approves in 4h
  ⏳  nav-spacing     · pending · auto-approves in 18h
  ❌  color-accent    · rejected by @sarah — needs fix
```

---

## AI agent enforcement (MCP)

This is the **other half** of the system. Developers using AI coding agents (Cursor, Claude, etc.) should get compliant UI **by default** — the agent should never invent values when `blocksmith.lock` and the wiki have the answer.

### How agents are governed today

From [MCP.md](./MCP.md) — governance travels **with the connector**, not in repo rule files:

1. `get_governance_rules` → loads palette + do/don't before writing UI
2. `check_component_governance` → pre-flight a specific component change
3. `validate_ui_code` → lint generated code before applying
4. `log_component_work` → record what changed

### What changes with Goal 4

| MCP behavior | Before | After |
|-------------|--------|-------|
| Agent reads design truth from | `.blocksmith/blocks/` (latest) | `blocksmith.lock` (pinned finalized versions) |
| Agent encounters a draft block | Uses it anyway | Skips draft, uses last finalized version |
| Agent produces off-lock UI | `validate_ui_code` warns | `validate_ui_code` refuses + suggests locked value |
| Agent logs deviation | Not tracked | `log_component_work` includes deviation flag if code differs from lock |

### Server instructions update

The MCP `instructions` (delivered on connect) should include:

```
GOVERNANCE RULE: Always read blocksmith.lock before generating UI code.
Use only the pinned (finalized) version for each block. If blocksmith.lock
says button-primary is v4 with border-radius 12px, generate 12px — even
if the draft wiki shows v5 with 16px. Drafts are for human review only.

If the task requires a value not covered by any block, ask the developer
before inventing one. Do not generate raw hex when a token exists.
```

### `validate_ui_code` behavior

```
Agent generates:  border-radius: 16px;
Lock says:        border-radius: 12px;  (button-primary v4)

→ validate_ui_code returns:
  {
    "pass": false,
    "violations": [{
      "block": "button-primary",
      "field": "border-radius",
      "locked": "12px",
      "generated": "16px",
      "fix": "Use 12px per button-primary v4 in blocksmith.lock"
    }]
  }

Agent self-corrects to 12px before applying.
```

The agent **never produces a deviation** because it reads the lock first and validates before writing. Deviations only come from human developers making conscious choices.

---

## Team Settings (wiki UI)

All configuration lives in the wiki — no code changes, no config files. Only `admin` and `owner` roles can modify.

```
Team Settings → Governance
┌─────────────────────────────────────────────────────────┐
│  Deviation Review                                        │
│  ─────────────────                                       │
│  Auto-approve timeout          [ 24 ] hours              │
│  Max open deviations per dev   [  3 ]                    │
│  Rejections before block       [  2 ] (per block)        │
│                                                          │
│  Notifications                                           │
│  ─────────────                                           │
│  Notify design team on new     [✅] In-wiki + Email      │
│  Notify developer on decision  [✅] CLI (`blocksmith     │
│                                     updates`)            │
│                                                          │
│  Permissions                                             │
│  ──────────                                              │
│  Who can Pass/Rollback         [ Admins & Owners ]       │
│  Allow auto-approve            [✅] On                   │
└─────────────────────────────────────────────────────────┘
```

Stored in Supabase under `org_governance_settings`. Defaults are sane — a team can use the system without changing anything.

---

## Supabase schema

Run after `schema-orgs.sql`:

### `blocksmith_deviations`

```sql
create table blocksmith_deviations (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid references blocksmith_orgs(id) not null,
  doc_ref       text not null,                          -- e.g. upload:scan-acme-ui-kit.md
  block_id      text not null,                          -- e.g. button-primary
  pushed_by     uuid references auth.users(id) not null,
  deviation_diff jsonb not null,                        -- { field, wiki_value, pushed_value }
  commit_ref    text,                                   -- git SHA
  pr_url        text,                                   -- GitHub PR link
  reason        text,                                   -- developer's stated reason
  status        text not null default 'pending'         -- pending | auto_approved | approved | rejected | resolved
    check (status in ('pending','auto_approved','approved','rejected','resolved')),
  reviewed_by   uuid references auth.users(id),
  fix_suggestion text,                                  -- reviewer's message on reject
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,                   -- created_at + TTL
  resolved_at   timestamptz,
  rejection_count int not null default 0                -- for escalation tracking
);

create index idx_deviations_org_status on blocksmith_deviations(org_id, status);
create index idx_deviations_pushed_by  on blocksmith_deviations(pushed_by, status);
create index idx_deviations_expires    on blocksmith_deviations(expires_at) where status = 'pending';
```

### `org_governance_settings`

```sql
create table org_governance_settings (
  org_id                uuid primary key references blocksmith_orgs(id),
  ttl_hours             int not null default 24,
  max_open_per_dev      int not null default 3,
  rejections_before_block int not null default 2,
  allow_auto_approve    boolean not null default true,
  notify_team_email     boolean not null default true,
  notify_team_wiki      boolean not null default true,
  review_roles          text[] not null default '{admin,owner}',
  updated_at            timestamptz not null default now()
);
```

### TTL cron (Supabase pg_cron or edge function)

```sql
-- Run every 15 minutes: auto-approve expired pending deviations
select cron.schedule('auto-approve-deviations', '*/15 * * * *', $$
  update blocksmith_deviations
  set status = 'auto_approved', resolved_at = now()
  where status = 'pending'
    and expires_at <= now()
    and org_id in (
      select org_id from org_governance_settings where allow_auto_approve = true
    );
$$);
```

---

## API

| Route | Method | Purpose |
|-------|--------|---------|
| `POST /api/v1/deviations` | POST | Create deviation record (from CLI pre-push) |
| `GET /api/v1/deviations` | GET | List deviations for org (wiki queue + CLI updates) |
| `PATCH /api/v1/deviations/:id` | PATCH | Pass or rollback (admin/owner only) |
| `GET /api/v1/deviations/budget` | GET | Check developer's open deviation count |
| `GET /api/v1/governance/settings` | GET | Read org governance settings |
| `PATCH /api/v1/governance/settings` | PATCH | Update settings (admin/owner only) |

---

## CLI commands

| Command | Purpose |
|---------|---------|
| `blocksmith check` | Existing — now with interactive pre-push prompt (Layer 1) |
| `blocksmith updates` | List deviation decisions since last check |
| `blocksmith pull` | Existing — now also syncs approved deviations into lock |
| `blocksmith fix <block-id>` | Show wiki guideline + suggested code fix for a rejected block |

---

## Implementation status

| Piece | Status |
|-------|--------|
| Pre-push interactive prompt (Layer 1) | ⬜ planned |
| `blocksmith_deviations` Supabase table | ⬜ planned |
| `org_governance_settings` Supabase table | ⬜ planned |
| Wiki Deviations Queue panel (Sync page) | ⬜ planned |
| Team Settings UI (governance config) | ⬜ planned |
| Pass / Rollback actions + fix suggestion | ⬜ planned |
| TTL cron (auto-approve expired) | ⬜ planned |
| `blocksmith updates` CLI command | ⬜ planned |
| `blocksmith fix <block-id>` CLI helper | ⬜ planned |
| Progressive escalation (budget + reject count) | ⬜ planned |
| MCP reads `blocksmith.lock` (pinned versions) | ⬜ planned |
| `validate_ui_code` refuses off-lock values | ⬜ planned |
| MCP server instructions update | ⬜ planned |
| Design Alignment % metric | ⬜ planned |

---

## Verification

```bash
npm run verify:deviation-ttl       # full flow: push → deviation → approve/reject → lock update
npm run verify:deviation-budget     # escalation: budget limit + rejection escalation
npm run verify:deviation-cli        # blocksmith updates + blocksmith fix
npm run verify:governance-e2e       # existing — extended with TTL scenarios
```

---

## Complete flow (visual summary)

```
Developer codes UI
        ↓
Pre-push: `blocksmith check` (automatic via hook)
        ↓
No drift? ─────────────────────────→ Push goes through silently ✅
        ↓
Drift detected → Interactive prompt
        ├── [f] Fix → developer corrects locally (90% of cases) ✅
        ├── [s] Skip → push without record (logged as skipped) ⚠️
        └── [p] Push anyway → conscious deviation created
                ↓
        Deviation enters wiki queue with TTL countdown
                ↓
        Design team sees it on Sync page →
        ├── [Pass] → lock updates, done ✅
        ├── [Rollback] → developer notified with fix suggestion ❌
        └── [No action] → auto-approves after TTL ✅
                ↓
        Developer: `blocksmith updates` → sees all decisions
        Developer: `blocksmith fix <block>` → sees what to change
        Developer: `blocksmith pull` → syncs approved changes to lock
```

```
AI agent (Cursor / Claude via MCP):
        ↓
Reads `blocksmith.lock` (not raw wiki drafts)
        ↓
Generates UI using only finalized, locked values
        ↓
`validate_ui_code` → refuses off-lock values
        ↓
Agent self-corrects before writing to disk
        ↓
Result: agent NEVER produces a deviation ✅
```

---

## Investor line

> **Non-blocking governance with a conscience:** developers push freely, the system captures drift, the design team reviews async — and AI agents follow the lock so they never deviate in the first place.

---

## Related

- [GOVERNANCE-TIERS.md](./GOVERNANCE-TIERS.md) — Block / Warn / Advisory tiers (this system extends Tier 2)
- [DESIGN-CICD.md](./DESIGN-CICD.md) — `blocksmith.lock`, block versions, pipeline
- [08-web-ide-handshake.md](./08-web-ide-handshake.md) — finalize writeback, sync engine
- [GOAL3-TEAM-RBAC.md](./GOAL3-TEAM-RBAC.md) — roles controlling who can Pass/Rollback
- [MCP.md](./MCP.md) — governed agent workflow, server instructions
