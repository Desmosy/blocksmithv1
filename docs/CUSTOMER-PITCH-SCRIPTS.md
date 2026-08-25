# BlockSmith — customer pitch scripts

**Use this doc for:** live demos, Loom recordings, investor intros, solo-founder onboarding, and team alignment.

**Production URL:** https://blocksmith-mocha.vercel.app

**Read with:** [PITCH-AND-PRODUCT-MODEL.md](./PITCH-AND-PRODUCT-MODEL.md) · [PUBLIC-RELEASE-SPRINT.md](./PUBLIC-RELEASE-SPRINT.md) · [FRIENDS-ONBOARDING.md](./FRIENDS-ONBOARDING.md)

---

## The one sentence (pick your room)

| Audience | Say this |
|----------|----------|
| **Anyone (10 sec)** | Stop AI from inventing your design system — approve in the wiki, pin it, agents and devs follow what you approved. |
| **UI/UX engineer** | Upload your design markdown once; BlockSmith builds the wiki — your dev team pulls updates instead of chasing the latest `DESIGN.md` in Slack. |
| **Head of UI / design lead** | Pipeline is design CI/CD — you approve what goes to production; agents and engineers only get what you promoted. |
| **Developer / solo builder** | Promote in the wiki, `blocksmith pull`, connect MCP — Cursor reads pinned design, not a stale markdown file from three months ago. |
| **Eng / platform lead** | One design graph powers the wiki, MCP, npm package, and compile targets — one promote, many surfaces, no doc drift. |
| **Investor / professor** | BlockSmith is the wiki product teams use daily, plus Design IR and design CI/CD underneath — TCP/IP for design truth. |

**Sub-line (optional):** Scan or upload → govern in the wiki → promote to production → pull into your repo.

---

## Three ways to use BlockSmith (core product story)

Do **not** lead with “Connect GitHub.” Lead with **role**.

```
┌─────────────────────────────────────────────────────────────────┐
│  PATH 1 — Design publishes                                      │
│  UI/UX uploads design.md → wiki → team browses                  │
├─────────────────────────────────────────────────────────────────┤
│  PATH 2 — Design leads govern                                   │
│  Pipeline: staging → promote → lock → rollback + version history│
├─────────────────────────────────────────────────────────────────┤
│  PATH 3 — Engineering subscribes                                │
│  blocksmith pull + MCP (+ optional repo scan to stay in sync) │
└─────────────────────────────────────────────────────────────────┘
```

**GitHub / repo scan** is Path 3 infrastructure — for devs who want **code ↔ wiki** sync. It is **not** step one for a designer.

---

## Language rules (customer UI)

| ✅ Say | ❌ Avoid (unless technical deep-dive) |
|--------|--------------------------------------|
| Save to staging | Finalize, ingest |
| Promote to production | Official graph, blocks.v1 |
| Pin lock | IR, draft vN |
| Pull design into your repo | Handshake schema |
| Connected doc | workspace-scan metadata |
| Staging / Production | Jenkins, merge (unless they use CI/CD language) |

---

## Who gets “multi-platform” and “less LOC”

### Multi-platform (one graph → many compile targets)

**Say to:** eng leads, agent-heavy devs, embedded/OEM (with honesty), investors.

> “One approved design graph feeds the wiki, Cursor MCP, an npm package, and — on our protocol roadmap — device profiles and embedded headers. You promote once; every surface reads the same version.”

**Targets (honest status):**

| Target | Output | Today |
|--------|--------|-------|
| Wiki | Browser design HQ | ✅ Live |
| MCP | Pinned agent payloads | ✅ Live |
| Pulse (`blocksmith codegen`) | `@blocksmith/<product>` | ⚠️ v0 — demo with `codegen` |
| Device sim | HMI JSON profile | Reference demo |
| C header | `tokens.h` | Reference demo |
| LVGL | Style pack | Planned stub |

**Don’t say to designers:** they hear “iOS/Android support.” Say: **“One wiki the whole team subscribes to.”**

### Less LOC (BlockSmith commands)

**Say to developers and eng leads only** — not pure designers.

You are **not** deleting their app code. You are replacing hand-maintained glue:

| Instead of… | BlockSmith… | Saves |
|-------------|-------------|-------|
| 400-line `DESIGN.md` + `CLAUDE.md` | `blocksmith pull` after promote | Pages of rules in repo |
| Pasting rules into every Cursor session | MCP + pinned lock | Agent prompt bloat |
| Re-implementing tokens/components | `blocksmith codegen` | Boilerplate imports |
| Hand-documenting the repo | `blocksmith scan` | Doc you’d write yourself |

**Commands to mention:** `login` · `pull` · `scan` · `codegen` · `mcp-url` · `whoami`

**Developer pitch line:**

> “Stop maintaining a novel in markdown. Promote in the wiki, run `blocksmith pull`, point MCP at BlockSmith — your agent reads pinned design, not notes from last month.”

---

## Pre-call checklist (send 24h before)

```
Subject: BlockSmith demo — 30 min

Hi [Name],

We'll walk through BlockSmith on https://blocksmith-mocha.vercel.app

Please have ready (pick what fits you):
□ A design markdown file (DESIGN.md, tokens doc, agent guidelines) — OR we'll use the demo
□ Optional: your app repo open in Cursor for the last 10 minutes
□ A GitHub account (only if you want to try repo sync — not required for designers)

No BlockSmith repo clone needed.

See you,
[You]
```

---

## Script A — UI/UX engineer (Path 1, ~20 min)

**Goal:** Upload → wiki → edit → share with engineering. **No GitHub on their screen.**

### Open (2 min)

> “You're probably updating `DESIGN.md` or a Notion page and pinging Slack when it changes. BlockSmith turns that file into a **living wiki** — structured colors, typography, components, rules — so engineering doesn't ask ‘which doc is current?’ They **subscribe** to BlockSmith.”

> “Today we'll upload your doc, tour the wiki, make one edit, and I'll show you what your developer does on their side — two commands, not a repo setup for you.”

### Act 1 — Homepage (2 min)

> “Three ways to use BlockSmith — you're Path 1: **publish design**. Developers are Path 3: **subscribe**. Your lead might use Path 2: **Pipeline** to approve what ships.”

- Hero → **Wiki tab**
- Paste or attach `.md`
- Submit → wiki generates

> “Same content you had in markdown — now browsable, searchable, editable in the browser.”

### Act 2 — Wiki tour (5 min)

| Stop | Script |
|------|--------|
| Introduction | “Your system's home page — not a static export.” |
| Foundation → Color | “Tokens from your doc, structured. Click a swatch — you can edit these.” |
| Components / Guidelines | “Rules your agent should follow — but humans can actually maintain them here.” |
| Top bar **Preview** | “Honest label: this doc is design-published. Full promote/lock unlocks when engineering links the team workflow.” |

### Act 3 — One edit (5 min)

> “Pick one thing you'd actually change — a guideline, a token role, a component note.”

1. **Edit**
2. Change one field
3. **Save to staging**

> “Staging is your draft. Production is what developers and agents are allowed to trust. You're not emailing a file — you're staging a change in one place.”

Point to **WikiEditBanner** if it appears.

### Act 4 — Handoff to engineering (3 min)

> “You don't connect GitHub. You send two things:”

1. Wiki URL (`?doc=upload:…`)
2. “Ask your dev to create an API key on **Sync** and run `blocksmith pull`”

Show **Sync** page briefly — copy pull command format.

> “They pull what you published. When you edit again, they pull again. No more ‘did you see my DESIGN.md v4?’”

### Close (2 min)

> “Your loop: **Upload → edit in wiki → dev pulls**. If your lead wants approve gates, they use **Pipeline** — Path 2.”

**Do not:** force Connect GitHub, deep-dive Protocol, or say “multi-platform.”

---

## Script B — Head of UI / design lead (Path 2, ~25 min)

**Goal:** Pipeline as design CI/CD — staging, promote, lock, rollback.

### Open (2 min)

> “Your developers and AI tools shouldn't decide what's official — you do. BlockSmith Pipeline is **staging vs production** for design blocks: like merge to main, but for tokens, components, and governance rules.”

### Setup (5 min)

Use either:
- A **connected scan doc** (best — full Pipeline), or
- Demo wiki + `/demo/investor` if no repo ready

> “Blocks come from a design doc or a code scan. Either way, humans **promote** what agents may use.”

### Act 1 — Wiki edit → staging (5 min)

1. Open **Guidelines** or **Color** or a **component**
2. **Edit** → change something meaningful
3. **Save to staging**

> “This is not live for agents yet. It's in **staging** — your PR queue for design.”

### Act 2 — Pipeline (10 min)

Navigate to **Pipeline**.

| Element | Script |
|---------|--------|
| Staging lane | “Drafts waiting for you.” |
| Production lane | “What's official today — what MCP and pull serve after lock.” |
| Promote | “Review the diff. This is you saying: ship this version.” |
| Lock strip | “Pin production lock — like `package-lock.json` for design. Agents read pinned versions only.” |
| Runs panel | “Audit trail — who promoted what, when. Rollback if needed.” |

> “When a developer ships the wrong button, you don't fix it in Figma comments alone — you see the block, you promote the correct version, they pull.”

### Act 3 — Governance story (3 min)

> “Re-scan from code updates scan facts. Human edits stay in staging until **you** promote. That's the gate investors care about: AI doesn't silently change your design system.”

### Close

> “Your loop: **edit → staging → promote → pin lock**. Engineering pulls; agents use MCP. You own production.”

**Optional:** “Same approval eventually feeds web, npm package, and embedded compile targets — one graph, many surfaces.” (Eng-lead audiences only.)

---

## Script C — Developer / solo full-stack (Path 3, ~35 min)

**Goal:** Full loop — wiki + staging + promote + pull + MCP. Best for solo builders who do UX and code.

### Open (2 min)

> “You wear every hat — design, build, Cursor. BlockSmith gives you one design HQ, a promote gate so you don't gaslight yourself, and **commands + MCP** so you maintain less markdown and your agent stops inventing hex codes.”

> “We'll do all three paths in order: publish, govern, subscribe.”

### Act 1 — Path 1: Upload (8 min)

- Paste `DESIGN.md` (or use demo)
- Tour wiki quickly

> “This replaces the doc you'd email to yourself.”

### Act 2 — Path 2: Promote (8 min)

- Edit one rule or token
- **Save to staging**
- **Pipeline** → promote → **pin lock**

> “Even solo, don't skip promote — otherwise there's no ‘official’ for MCP to read.”

**If upload-only doc blocks promote:** say honestly:

> “Upload gets you the wiki today. Link a repo once — or have the team on a connected scan — to unlock full promote + lock on production. The edit flow is the same.”

### Act 3 — Path 3: Subscribe (12 min)

**Sync page:**

1. **Create API key**
2. Terminal:

```bash
npm install -g @block-smith/cli
blocksmith login --key bs_live_YOUR_KEY --url https://blocksmith-mocha.vercel.app
blocksmith pull --doc upload:YOUR-DOC-REF.md
```

> “Pull writes governance into your repo — what you promoted. Less `DESIGN.md` you maintain by hand.”

3. **MCP in Cursor** — Sync snippet or `blocksmith mcp-url`

> “MCP serves **pinned** blocks only. Your agent reads the lock, not a stale paste.”

4. **Optional — less LOC:**

```bash
blocksmith codegen --doc upload:YOUR-DOC-REF.md
```

> “Generates `@blocksmith/your-product` — import tokens and governed components instead of rewriting CSS.”

5. **Optional — repo sync:**

```bash
blocksmith scan ~/your-app-repo
```

> “Code changes flow into the wiki. Re-scan when you ship UI in the repo.”

### Close — their daily loop

| When | Do |
|------|-----|
| Changed design *intent* | Edit wiki → staging → promote → pull |
| Changed UI in code | Re-scan → check Pipeline |
| Building with AI | MCP + lock |
| Less markdown maintenance | pull + MCP (+ codegen when ready) |

**Multi-platform line (OK here):**

> “Same promoted graph powers wiki, MCP, and codegen — embedded targets are on the protocol roadmap.”

---

## Script D — Eng / platform lead (15 min pitch, no live demo)

**Goal:** Architecture buy-in.

### Hook

> “Your team has Figma, Notion, `DESIGN.md`, and Cursor rules — four truths. BlockSmith is one **versioned block graph** with a human wiki on top and compile targets underneath.”

### Three layers (3 min)

1. **Wiki** — humans browse, edit, promote  
2. **Design CI/CD** — staging → production → `blocksmith.lock`  
3. **Compile targets** — MCP, Pulse npm, device profile, C headers (same graph)

### Proof points (5 min)

- Pipeline console live on SaaS  
- MCP returns pinned versions only  
- `verify:ir-cicd` + published JSON schemas at `/protocol`  
- Pull + scan CLI for repo handshake  

### Ask

> “Pilot one product: one doc, one promote workflow, MCP in Cursor, pull in CI.”

### LOC angle

> “Replace hand-synced governance markdown and ad-hoc agent prompts with pull + MCP + optional codegen — measurable reduction in doc and prompt surface area, not a claim about deleting feature code.”

---

## Script E — Investor / 90-second demo

**Use:** `/demo/investor` or Pipeline with seeded data.

### 0:00–0:15 — Problem

> “AI agents invent design systems. Teams drown in `DESIGN.md`. Nobody knows what's official.”

### 0:15–0:35 — Product

> “BlockSmith: scan or upload → **wiki** humans love → **Pipeline** promote → **lock** in the repo → agents obey.”

### 0:35–1:00 — Wow

Show Pipeline: staging → promote → lock turns green.

> “Design CI/CD. Humans approve. Agents pin.”

### 1:00–1:30 — Category (optional)

> “Underneath: Design IR — one graph compiles to wiki, MCP, npm, embedded. We're the reference implementation.”

**Do not:** spend 90s on homepage marquee or Protocol JSON.

---

## Script F — Embedded / OEM (honest vision, ~10 min)

### Hook

> “Web dashboard and factory HMI shouldn't be two design systems. BlockSmith promotes one graph; compile targets emit React, device profiles, and C headers from the same pinned versions.”

### Today vs roadmap

| Today | Roadmap |
|-------|---------|
| Wiki + Pipeline + lock on SaaS | Production HMI pipelines |
| Device-sim + c-header **reference** in repo | LVGL target, signed OTA artifacts |
| Same block ids + hashes | Field devices consume promoted truth |

> “The **governance console** ships now. Embedded compile is protocol + partner targets — we're dogfooding the reference emitters.”

**Do not:** promise self-serve LVGL export on prod today.

---

## Full combined walkthrough (40 min — solo customer, all paths)

| Min | Segment | Path |
|-----|---------|------|
| 0–4 | Intro + homepage (Wiki tab first) | Setup |
| 4–12 | Upload/paste → wiki tour | Path 1 |
| 12–20 | Edit → Save to staging | Path 1→2 |
| 20–28 | Pipeline → promote → pin | Path 2 |
| 28–36 | Sync → pull → MCP (+ codegen if time) | Path 3 |
| 36–40 | Recap + Q&A | All |

### Recap script (make them repeat)

> “Design publishes in the wiki. Leads promote on Pipeline. Developers pull and connect MCP. Repo scan is optional glue for code sync.”

---

## Objection handling

| They say | You say |
|----------|---------|
| “Why not just use Notion?” | “Notion isn't machine-enforceable. BlockSmith feeds MCP and pull — agents read pinned blocks, not a exported PDF.” |
| “We already have Figma.” | “Figma is intent. BlockSmith is what you **approve** for agents and repo — often from code or markdown. Figma adapter is future; scan/upload works today.” |
| “Connect GitHub is too much.” | “Designers don't need to. Upload your doc. Developers connect when they want repo sync.” |
| “Is this only for big teams?” | “Solo builders use all three paths — you're designer, approver, and developer. Same loop, one person.” |
| “Multi-platform?” | “One promote feeds wiki and MCP today; npm via codegen; embedded on the protocol roadmap. What's live for you is wiki + agents + pull.” |
| “Will this delete our codebase?” | “No — it reduces governance markdown, agent rules, and doc drift. Your feature code stays yours.” |
| “Upload vs scan?” | “Upload = design publishes fast. Scan = code and wiki stay linked. Many teams start upload, add scan when eng joins.” |

---

## Honest limits (say these proactively — builds trust)

1. **Sample wiki (`apollo.md`)** is read-only — not the full loop.  
2. **Upload-only docs** may not get full Pipeline promote until team/repo is linked — wiki + edit + pull still work.  
3. **Pulse / codegen** is v0 — demo it, don't promise enterprise npm SLA yet.  
4. **Embedded / LVGL** is research + reference — not self-serve SaaS today.  
5. **Hosted SaaS** doesn't run a live IDE file watcher — re-scan or CLI scan for code updates.

---

## After the call — follow-up email template

```
Subject: Your BlockSmith loop

Thanks for the time today.

Your three paths:
1. Design — upload/edit in the wiki: [WIKI URL]
2. Govern — Pipeline (staging → promote → pin): [PIPELINE URL]
3. Dev — Sync → API key → blocksmith pull + MCP: [SYNC URL]

Quick start for engineering:
  npm install -g @block-smith/cli
  blocksmith login --key … --url https://blocksmith-mocha.vercel.app
  blocksmith pull --doc [YOUR DOC REF]

Docs: FRIENDS-ONBOARDING.md on our repo (no clone needed for hosted use).

Reply if you want a second session on [scan / MCP / Pipeline only].
```

---

## Internal reminder (for you, not the customer)

| Priority | Action |
|----------|--------|
| P0 | Stranger completes upload → edit → promote → pull on prod |
| P1 | Homepage leads with **Upload design.md**, not Connect GitHub |
| P1 | Upload docs get honest promote path (or clear “dev links repo” bridge) |
| P2 | Record Loom per Script A, B, C |

---

*Last updated: customer pitch scripts — three paths, audience-specific multi-platform + LOC, full walkthroughs.*
