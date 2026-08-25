# Public release sprint — team prompt

**Status:** Active — this overrides new feature work until stranger-ready ≥75%  
**Production:** https://blocksmith-mocha.vercel.app  
**Read with:** [GOAL-SAAS-STATUS.md](./GOAL-SAAS-STATUS.md) · [PITCH-AND-PRODUCT-MODEL.md](./PITCH-AND-PRODUCT-MODEL.md)

---

## Copy-paste prompt for the team (Slack / Notion / standup)

```
MISSION: Make BlockSmith sellable to the mass public — not more features.

We shipped Pipeline + Protocol. FREEZE new capabilities until a stranger can:
  sign in → scan a repo → browse the wiki → stage a change → promote → pin lock → pull
…on https://blocksmith-mocha.vercel.app in under 10 minutes with ZERO Slack help.

Every PR must answer: "Does this make the core loop clearer, more reliable, or faster
for someone who has never heard of Design IR?"

If no → do not merge.

LANGUAGE RULE (customer UI):
  ✅ Staging · Production · Pin to repo · Pull design into your project
  ❌ official graph · blocks.v1 · ingest · IR · draft vN (except Releases advanced view)

PRIORITY ORDER (nothing else until P0 is green):
  P0 — Core loop works on Vercel every time (onboarding, empty states, Pipeline, lock, pull)
  P1 — Wiki feels like company HQ (strip on all block pages, re-scan → Pipeline, Visualize on prod)
  P2 — Stranger polish (errors that teach, perf, mobile, verify:production-goals always green)

DO NOT BUILD: Protocol npm publish, Figma adapter, OTA, agent drift demo, new wiki pages,
billing, enterprise RBAC, CRDT, Pulse auto-publish — until P0+P1 done.

MERGE GATE: verify:production-goals green + manual stranger test recorded (Loom or checklist).

Ship reliability and clarity. We are product company now, not lab company.
```

---

## What “sellable to mass public” means

Not Fortune 500 contracts yet. Not “perfect every page.”

**A stranger** (design lead or eng lead, no BlockSmith friend) can:

1. Land on the site and understand **what this does in 10 seconds**
2. Sign in with GitHub and **scan a repo** without reading docs
3. **Browse** tokens, components, styles — wiki feels complete, not empty
4. **Edit** one governance field and see it in **Staging** on Pipeline
5. **Promote to Production** (or **Pin lock** if all live) — lock turns green
6. **Copy pull command** on Sync and know what to run locally
7. **Never hit a dead end** (“40 live, no lock”, blank Pipeline, silent failure)

That loop is the product. Everything we built (Pipeline, Protocol, MCP) exists to make **that loop obvious and trustworthy**.

---

## The customer sentence (hero + first screen)

> **Stop AI from inventing your design system.**  
> Approve design in the wiki. Pin it in your repo. Agents and CI follow what you approved.

Sub: *Scan your repo → govern in the wiki → promote to production → pull into Cursor.*

No TCP/IP on the homepage. Protocol lives at `/protocol` for infra buyers.

---

## Priority work (ordered — do not skip)

### P0 — Core loop bulletproof on production

| # | Task | Done when |
|---|------|-----------|
| 0 | **Deploy stays green** | Vercel build passes after every merge; `verify:production-smoke` OK |
| 1 | **Homepage → first scan** | Logged-out visitor sees value prop + “Try demo” + “Connect GitHub” — no wall of jargon |
| 2 | **Post-scan landing** | After scan: banner → “Open Pipeline” + “Browse wiki” — not a blank wiki |
| 3 | **Pipeline on real uploads** | `upload:scan-*` docs: registry hydrates from Supabase; promote + pin-lock work on Vercel |
| 4 | **Empty states teach** | “40 live, no lock” → **Pin production lock** CTA + one-line why. “0 staging” → “Edit a component to stage a draft” |
| 5 | **One language** | Customer UI: **Staging / Production / Promote / Pin to repo**. Hide “Finalize” or rename to “Save to staging” |
| 6 | **Sync = handshake ritual** | Lock card, pull command, link to Pipeline, API key path — one screen, copy buttons |
| 7 | **Stranger checklist** | [GOAL-SAAS-STATUS.md](./GOAL-SAAS-STATUS.md) manual prod checklist — all boxes checked by two people who didn’t build it |
| 8 | **`verify:production-goals`** | Script green on every deploy; fix regressions same day |

### P1 — Wiki feels like company HQ

| # | Task | Done when |
|---|------|-----------|
| 9 | **BlockReleaseStrip everywhere** | Components + tokens + governance pages (not components only) |
| 10 | **Re-scan → Pipeline** | Wiki banner after re-scan: “N blocks bumped — review on Pipeline” |
| 11 | **Visualize on prod** | Apply theme on hosted scan doc — no timeout, no blank preview |
| 12 | **Goal 1 ≥80%** | Featured + Styles populated after GitHub scan on prod |
| 13 | **Goal 2 ≥80%** | Finalize/promote path on upload docs + pull + MCP key without confusion |
| 14 | **Pipeline perf** | Cold load &lt;3s on Vercel (Supabase hydrate); loading skeletons, not spinners forever |
| 15 | **Error messages** | API/UI errors say what to do next (“Sign in”, “Re-scan”, “Pin lock first”) |

### P2 — Public beta polish (after P0+P1)

| # | Task | Done when |
|---|------|-----------|
| 16 | **Friends doc → in-app** | Key steps from [FRIENDS-ONBOARDING.md](./FRIENDS-ONBOARDING.md) in Sync or onboarding modal |
| 17 | **Mobile / share** | Pipeline lanes stack; readable on laptop screen share |
| 18 | **Rate limits** | Basic Supabase-backed limits on scan/promote (no abuse) |
| 19 | **30s product video** | Hosted on site or linked from hero |
| 20 | **Update GOAL-SAAS-STATUS** | Stranger-ready score ≥75% documented |

---

## How to code for public release (rules)

### 1. Production-first

- Test on **https://blocksmith-mocha.vercel.app**, not only `localhost`
- Assume **cold serverless** — registry/lock from Supabase, not disk
- No features that only work with local `BLOCKSMITH_WORKSPACE` without a hosted alternative

### 2. Stranger test every PR

Before merge, author (or reviewer) runs:

```bash
BLOCKSMITH_URL=https://blocksmith-mocha.vercel.app npm run verify:production-goals
```

Plus **one** manual path from the checklist below.

### 3. UI copy is product

- Write for a **design lead who doesn’t know git internals**
- Buttons are verbs: **Promote to production**, **Pin to repo**, **Copy pull command**
- Tooltips explain *why*, not *how the registry works*

### 4. Fail loud, fail helpful

| Bad | Good |
|-----|------|
| Empty Pipeline, no message | “Scan a repo to get started” + CTA |
| `500` in console | “Registry warming up — refresh in a few seconds” or fix hydrate |
| Promote hidden with no explanation | Empty staging copy + link to edit a component |

### 5. Small PRs, one loop per PR

- ✅ “Pin lock empty state on Pipeline”
- ✅ “Rename Finalize → Save to staging on component page”
- ❌ “Pipeline polish + protocol page + new agent demo”

### 6. No new surface area

- Extend **wiki, Pipeline, Sync, component pages**
- Do not add new top-level routes unless P0 checklist requires it

---

## PR checklist (paste in every PR description)

```markdown
## Public release gate

- [ ] Tested on production URL (not only local)
- [ ] Stranger would understand the change without a verbal explanation
- [ ] No new jargon in customer-facing UI
- [ ] `verify:production-goals` green (or N/A with reason)
- [ ] Connects to core loop: scan → wiki → stage → promote → lock → pull
- [ ] Not a new feature (bugfix / polish / onboarding / reliability only)
```

---

## Manual stranger test (run before calling P0 done)

Use a **fresh GitHub account** or teammate who hasn’t dogfooded:

- [ ] Open site → understand offer in 10s
- [ ] Try demo OR connect GitHub → scan small public repo
- [ ] Wiki shows Featured + at least one component with tokens
- [ ] Open **Pipeline** — see Production blocks; pin lock if needed
- [ ] Edit component Role → see **Staging** on Pipeline
- [ ] Promote → lock fresh → copy pull from Sync
- [ ] Create API key → `blocksmith whoami` works (friends doc path)

Record Loom. Store link in team Notion.

---

## Squad focus (no new features)

| Squad | Owns until P0 green |
|-------|---------------------|
| **Onboarding** | Home, post-scan, demo path, empty states |
| **Wiki loop** | Staging/Production language, release strip on all blocks, re-scan banners |
| **Pipeline reliability** | Vercel hydrate, perf, error states, pin-lock on upload docs |
| **Handshake** | Sync page, pull copy, API keys, production-goals script |
| **QA** | Stranger tests, prod verify on every deploy, regression list |

**Protocol squad:** maintenance only — `protocol:conformance` must stay green; no new adapters.

---

## Explicitly out of scope (this sprint)

| Do not build | Why |
|--------------|-----|
| npm publish `@blocksmith/protocol` | Infra story; strangers need wiki loop first |
| Figma / Tokens Studio adapters | P2+ after public beta |
| Agent drift split-screen demo | Nice; investor Loom uses `/demo/investor` |
| Billing / Stripe | After stranger-ready |
| Enterprise SSO / Releaser RBAC | After design partners |
| Pulse auto-on-scan | Document manual path; automate later |
| New compile targets / OTA | Category vision; not public beta |
| CRDT / multi-user conflict | Research |

---

## Definition of done (public beta launch)

- [ ] Stranger-ready score **≥75%** in [GOAL-SAAS-STATUS.md](./GOAL-SAAS-STATUS.md)
- [ ] Goal 1 and Goal 2 each **≥80%** on public SaaS
- [ ] `verify:production-goals` in CI or required before deploy
- [ ] Manual stranger checklist passed by **2** non-builders
- [ ] Homepage hero = customer sentence (not protocol)
- [ ] `/demo/investor` linked from “See how it works” (investors) — not the only entry
- [ ] No P0 bugs open on Pipeline + lock + scan path
- [ ] CEO Loom recorded on **production**

---

## Success metric

> **Time-to-trust:** minutes from sign-up to “I believe agents will use what we approved.”

Not LOC. Not schema count. Not number of blocks ingested.

---

## Links

| Doc | Use |
|-----|-----|
| [GOAL-SAAS-STATUS.md](./GOAL-SAAS-STATUS.md) | Score tracker — update when P0/P1 close |
| [FRIENDS-ONBOARDING.md](./FRIENDS-ONBOARDING.md) | Pull/MCP path to inline in product |
| [PROJECT-PIPELINE.md](./PROJECT-PIPELINE.md) | Shipped — maintain, don’t expand |
| [PROJECT-PROTOCOL.md](./PROJECT-PROTOCOL.md) | Shipped — maintain, don’t expand |
| [PITCH-AND-PRODUCT-MODEL.md](./PITCH-AND-PRODUCT-MODEL.md) | Customer vs investor language |

---

*If your PR doesn’t help a stranger complete the core loop on production, it waits.*
