# Pitch & product model — single source of truth

**Read this first** for investors, designers, and engineers. Technical details live in linked docs; this file is the **non-confusing** story.

**Team alignment (wiki = control plane, blocks = releases):** [TEAM-NORTH-STAR.md](./TEAM-NORTH-STAR.md) — **read before building features.**

**Production:** https://blocksmith-mocha.vercel.app

---

## One sentence (investor)

> BlockSmith is the **wiki and handshake product teams use every day** — scan, govern, visualize, finalize — **plus** the infrastructure underneath: **Design IR** and **design CI/CD** so the same truth feeds humans, agents, and compile targets without drift.

### Shorter variants

- **Product (today):** Scan → wiki → govern → pull — the human design KB on SaaS.  
- **Infrastructure (category):** TCP/IP for design + CI/CD for blocks — wiki and Pulse are **compile targets**, not replaced by the protocol.

**Important:** Wiki, governance, Visualize, MCP, and Pulse **coexist**. IR and CI/CD **complement** them — they connect wiki edits to agent pins, not substitute for browsing components.

---

## Names

| Name | What it is |
|------|------------|
| **UI AI Lab** | Research umbrella — experiments on human control of UI in the agent era |
| **BlockSmith** | Flagship product — scan/ingest → wiki + compile → handshake with IDE |

BlockSmith is the **wedge**. The lab is the **category bet**.

---

## The problem

Teams are drowning in `DESIGN.md`, `CLAUDE.md`, and scan output. Agents can read it; **humans cannot steer from it**. AI still builds UI by guessing CSS. Design truth is split across Figma, Notion, and the repo.

---

## The solution — wiki **and** infrastructure (both)

BlockSmith is **two things that work together**, not either/or:

| Layer | What users get | Status |
|-------|----------------|--------|
| **Product (human-facing)** | Scan → **wiki** (Featured, Styles, components, Visualize) → govern → finalize → pull | ✅ SaaS ~76% Goal 1 |
| **Product (handshake)** | Web ↔ IDE, API keys, MCP, org ownership | ✅ ~66% Goal 2 |
| **Infrastructure (underneath)** | Design IR + design CI/CD — same graph powers wiki **and** agents **and** Pulse | Spec ✅; lock ⬜ |

We are **not** “only a protocol” and **not** “only a wiki.” The wiki is how humans **live in** the system. IR + CI/CD is how that wiki stays **aligned** with agents and compiled outputs.

```
                    ┌── Wiki (browse · govern · visualize)  ← humans start here
                    │
Figma / scan / .md ─┼── blocksmith.blocks.v1 (Design IR) ──┼── Pulse package (agents)
                    │                                        └── device sim (future)
                    └── blocksmith.lock (pinned versions after Finalize)
```

| Surface | Role | Complements |
|---------|------|-------------|
| **Wiki** | Daily home for designers & leads | Shows blocks; Finalize promotes versions |
| **Handshake / pull** | Repo gets `DESIGN.md` + lock | Wiki decisions become IDE truth |
| **Pulse** | Importable UI from same scan | Agents build without guessing CSS |
| **Design IR** | Glue between all of the above | One graph, no competing truths |
| **Design CI/CD** | Promote + pin | Wiki draft v4 ≠ agent until Finalize |

**Markdown is input.** **Wiki is the human product.** **IR + CI/CD connect** wiki, repo, agents, and compile targets.

---

## Engineer X — the team story

1. **Engineer X** signs in and scans `acme/mobile-app` (or uploads a design `.md`).
2. BlockSmith writes a stable scan doc, e.g. `upload:scan-acme-mobile-app.md`.
3. BlockSmith opens the **wiki** for the team (tokens, featured components, governance).
4. BlockSmith **compiles** `@blocksmith/acme-mobile-app` from that same doc (Pulse).
5. The **team** (same org):
   - **Humans** edit Role / usage rules in the wiki → **Finalize** → `blocksmith pull` → `DESIGN.md` in the repo.
   - **Devs / agents** build new UI with imports — no hand-written token CSS for governed surfaces.
6. Re-scan or governance finalize → same doc slug → **regenerate** the package.

### One package per product (not per person)

| | |
|--|--|
| **One scan doc** | Per repo / `workspaceId` (stable filename) |
| **One package** | `@blocksmith/<slug>` derived from that doc |
| **Owners** | Org + user who registered the scan ([schema.sql](../supabase/schema.sql)) |

BlockSmith **hosts and compiles**; the **customer team owns and governs** the design.

---

## What the package is (and is not)

| ✅ It is | ❌ It is not |
|----------|-------------|
| Generated **UI runtime** from scan + finalized governance | A full mirror of every file in the vendor repo |
| Governed **stubs** (`Button`, `Surface`, `Text`, tokens) | Replacement for the team’s production `Button.tsx` on day one |
| What agents should **import** instead of inventing CSS | A Figma export or Notion clone |

---

## Software vs hardware — same spec, different syntax

**Common confusion:** “Same `import` on web and chip?”

| | Software (web) | Hardware / embedded |
|--|----------------|---------------------|
| **Same input** | Same `.md` / scan doc | Same `.md` / scan doc |
| **Same contract** | `Button`, `Surface`, colors, rules | Same names + tokens |
| **How you use it** | `import { Button } from "@blocksmith/..."` | Generated C / LVGL / config — **not** JavaScript on the MCU |
| **Prototype** | Real React package (`/demo/pulse`) | Browser **device frame** (watch/HMI) from same IR |

**Pitch line:** *One design package, multiple compile targets.*

We do **not** claim firmware on day one. We claim **one IR → web today, device profile tomorrow**.

---

## Visualize style (wiki chrome)

**Hybrid mode (default):** instant **semantic preview** from scan IR; optional **AI refine** in the background. If AI times out, preview stays.

Not “wait 5 minutes or see nothing.” See [VISUALIZE-AND-API.md](./VISUALIZE-AND-API.md).

---

## What we are / are not

### We are

- A **rendered design wiki** teams open daily — scan, Featured, Styles, Visualize, governance  
- **Web ↔ IDE handshake** — finalize in wiki, pull to repo ([08-web-ide-handshake.md](./08-web-ide-handshake.md))  
- **MCP + API keys** — agents read what the wiki shows  
- **Pulse** — same doc compiles to `@blocksmith/<product>` ([PHASE2-PULSE.md](./PHASE2-PULSE.md))  
- **Plus infrastructure:** Design IR ([BLOCKS-V1-SPEC.md](./BLOCKS-V1-SPEC.md)) + design CI/CD ([DESIGN-CICD.md](./DESIGN-CICD.md)) tying it together  

### We are not

- Wiki **or** protocol — we are **wiki plus** protocol underneath  
- A Figma competitor (Figma = reference; **code + blocks = truth**)  
- A generic Notion clone (we **render + sync + compile**, not free-form docs only)  
- “Upload `.md` and it runs on any hardware” without compile targets  

---

## Phases (thesis-aligned)

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **1 — Software truth** | Ingest → IR → wiki → governance → MCP | ~76% public SaaS ([GOAL-SAAS-STATUS.md](./GOAL-SAAS-STATUS.md)) |
| **2 — Design as library** | IR → `@blocksmith/<product>` (Pulse compile target) | v0 local ([PHASE2-PULSE.md](./PHASE2-PULSE.md)) |
| **2b — Design CI/CD** | Block versions + `blocksmith.lock` + `validate_ui` | Spec ✅; impl ⬜ ([DESIGN-CICD.md](./DESIGN-CICD.md)) |
| **3 — Device profiles** | Same IR → watch/HMI simulator → native/LVGL | Planned |

**Investor prototype (next):** upload/scan `.md` → wiki + web demo + **device frame side-by-side** from one spec.

---

## Messaging ladder

### ❌ Too vague

- “We’re an AI lab.”  
- “We generate design.md.”  
- “We’re a design system wiki SaaS.”

### ❌ Overclaim

- “Plug any `.md` into any hardware.”  
- “Same npm `import` on microcontrollers.”  
- “We replace Figma.”

### ✅ Use now (team + early adopters)

> Scan your repo → open the wiki (Featured, Styles, components) → govern in the browser → pull to your repo. Agents use the same truth via MCP.

### ✅ Use for investors (product + category)

> BlockSmith is the design wiki and handshake product on SaaS today — and the reference stack for **Design IR** and **design CI/CD** tomorrow: one block graph powers the wiki humans love, the package agents import, and the lock file that stops drift.

### ✅ After Pulse demo ships

> Each product gets `@blocksmith/<name>` from the same doc as the wiki — agents import surfaces instead of writing CSS.

---

## Hero demos (priority order)

1. **Design CI/CD** — edit block in wiki (v4 draft) → Finalize → `blocksmith.lock` bumps → agent uses v4 only.  
2. **Handshake** — governance finalize → `blocksmith pull` → `DESIGN.md` + lock in repo.  
3. **Pulse** — same IR → `import { Button } from "@blocksmith/..."` → `/demo/pulse`.  
4. **Device frame** — same IR → web + simulated watch/HMI preview.  
5. **Public block feedback** — share one component, collect pre-launch signal ([PUBLIC-FEEDBACK.md](./PUBLIC-FEEDBACK.md)).

**Do not lead investor meetings with:** API keys, org invites, or Styles page checklists alone.

---

## Control & ownership (SaaS)

| Entity | Controls |
|--------|----------|
| **Team / org** | Who can scan, edit governance, pull, invite members |
| **BlockSmith** | Hosting, compile, parsers, MCP — not the customer’s IP |
| **Scan doc** | `blocksmith_documents` + Supabase storage ([schema.sql](../supabase/schema.sql)) |
| **Generated package** | Built from that doc; regenerated on scan/finalize |

---

## Related technical docs

| Topic | Doc |
|-------|-----|
| **Research infra (full brief for mentors)** | [RESEARCH-INFRA-DESIGN-IR-AND-CICD.md](./RESEARCH-INFRA-DESIGN-IR-AND-CICD.md) |
| **Design CI/CD + lock file** | [DESIGN-CICD.md](./DESIGN-CICD.md) |
| **Design IR protocol (TCP/IP)** | [BLOCKS-V1-SPEC.md](./BLOCKS-V1-SPEC.md) |
| Thesis | [00-thesis.md](./00-thesis.md) |
| Vision (short) | [01-vision-and-positioning.md](./01-vision-and-positioning.md) |
| Scan → wiki | [GOAL1-VENDOR-SCAN.md](./GOAL1-VENDOR-SCAN.md) |
| Governance / handshake | [08-web-ide-handshake.md](./08-web-ide-handshake.md), [GOAL2-GOVERNANCE-COPILOT.md](./GOAL2-GOVERNANCE-COPILOT.md) |
| Pulse / codegen | [PHASE2-PULSE.md](./PHASE2-PULSE.md) |
| SaaS readiness | [GOAL-SAAS-STATUS.md](./GOAL-SAAS-STATUS.md) |
| Deploy | [DEPLOY.md](./DEPLOY.md) |
| Onboarding | [FRIENDS-ONBOARDING.md](./FRIENDS-ONBOARDING.md) |

---

*Last updated: Design IR protocol + design CI/CD + block versions vision.*
