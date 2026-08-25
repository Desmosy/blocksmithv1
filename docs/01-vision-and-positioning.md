# Vision & Positioning

**Pitch (start here):** [PITCH-AND-PRODUCT-MODEL.md](./PITCH-AND-PRODUCT-MODEL.md) — investor + team story without confusion.  
**Thesis:** [00-thesis.md](./00-thesis.md) — why `design.md` growth makes a human UI layer necessary.

---

## What this is

A **UI AI Lab** exploring one problem:

> Agent-oriented design docs will keep growing. Humans still win on intuition, creativity, and direction—but only if they have a **rendered** source of truth, not a markdown wall.

**BlockSmith** (flagship experiment): **auto-updating design wiki** for humans + **web ↔ IDE handshake** + infrastructure underneath (Design IR, design CI/CD) that keeps wiki, agents, and Pulse aligned.

See [08-web-ide-handshake.md](./08-web-ide-handshake.md) · [BLOCKS-V1-SPEC.md](./BLOCKS-V1-SPEC.md) · [DESIGN-CICD.md](./DESIGN-CICD.md).

### Product stack — wiki first, infrastructure connects

| Layer | What it is |
|-------|------------|
| **1. Wiki (product)** | Scan → browse Featured/Styles → Visualize → govern → finalize ([GOAL1-VENDOR-SCAN.md](./GOAL1-VENDOR-SCAN.md)) |
| **2. Handshake (product)** | Pull, MCP, API keys, orgs ([08-web-ide-handshake.md](./08-web-ide-handshake.md)) |
| **3. Pulse (compile)** | Same doc → `@blocksmith/<product>` ([PHASE2-PULSE.md](./PHASE2-PULSE.md)) |
| **4. IR + CI/CD (infrastructure)** | One block graph + version pins — **complements** 1–3, does not replace the wiki ([BLOCKS-V1-SPEC.md](./BLOCKS-V1-SPEC.md), [DESIGN-CICD.md](./DESIGN-CICD.md)) |

**Per product:** one scan doc → **wiki + package** for that team. Humans start in the wiki; IR connects wiki edits to agent behavior.

**Not building yet:** real firmware / LVGL ship path, public npm publish of every generated package, ingest-the-internet.

**End state:** One Design IR → **web `import`** today; **device compile target** tomorrow (same API contract, different syntax on embedded — see [PITCH-AND-PRODUCT-MODEL.md](./PITCH-AND-PRODUCT-MODEL.md)).

---

## The problem (sharpened)

| Today | Tomorrow (without a UI layer) |
|-------|-------------------------------|
| Teams add `design.md` for Cursor/Claude | Files become huge, duplicated, stale |
| Agents improve at using context | Humans stop reading docs; drift goes unnoticed |
| Design system “exists” in Figma + Notion + repo | No single place to **direct** UX |

**Pain in one line:** Cohesive UX fails when design systems lack a **human-legible** source of truth—even if agents have plenty of text.

---

## Origin (why this is personal)

At a **global community product company**, teams worked to connect neighbors worldwide. Cohesive UX was hard because design systems had **no centralized documentation**. Work with the design systems team focused on:

- Clarifying canonical tokens, components, and workflows  
- Building an **internal wiki** that linked workflows in one place  
- Giving humans a map—not more scattered files  

That was pre-agent-docs. Now `CLAUDE.md` and `DESIGN.md` are the new scattered layer unless something **renders** them for human judgment.

BlockSmith is that render layer, born from the same “source of truth” work, updated for AI-native teams.

---

## Human vs agent (positioning)

| | Humans | Agents |
|---|--------|--------|
| **Strength** | UI/UX intuition, creativity, product direction | Consistency, speed, applying rules at scale |
| **Needs** | Wiki UI, hierarchy, examples, do/don’t at a glance | Structured `design.md`, MCP, props, tokens |
| **Fails when** | Asked to audit 500-line markdown weekly | Given vague or conflicting rules |
| **BlockSmith job** | **Rendered wiki** | **Same blocks** → MCP (roadmap) |

We do not compete with “more design.md.” We make existing docs **governable by human eyes**.

---

## What this is / is not

### You are

- A **human-facing render layer** on agent design documentation  
- A **source-of-truth wiki** (portfolio piece + real tool)  
- Proof of **taste** in documentation UI—product feel applied to docs  
- Small lab shipping weekly-scale experiments  

### You are not (yet)

- Replacing human design judgment  
- Declaring “AI will own UX”  
- A generic Notion/GitBook clone  
- A company with funding on day one  

---

## Names

| Name | Role |
|------|------|
| **UI AI Lab** | Umbrella — experiments on docs, design systems, rendered UI |
| **BlockSmith** | Repo + product — paste/render wiki, then MCP |
| Koshish UI Lab / Rendered Lab | Personal brand options for site |

---

## Messaging ladder

Full ladder (investor + anti-confusion): [PITCH-AND-PRODUCT-MODEL.md](./PITCH-AND-PRODUCT-MODEL.md#messaging-ladder).

### ✅ Thesis-aligned (use now)

> Scan your repo → wiki your team can govern + a compile path to importable UI (`@blocksmith/<product>`). Same spec for humans and agents.

### ✅ Investor / category

> BlockSmith ships the wiki and handshake **now** — and builds the Design IR + CI/CD layer so that wiki, agents, and importable UI stay one system. Product and protocol coexist.

---

## Target user

**Primary:** Design systems / design engineering lead at a product team adopting Cursor and `DESIGN.md`.

**Secondary:** PM or founder who needs to **see** UX rules without reading agent context files.

**Buyer story:** Same as internal wiki project—*“We need one place that links workflows and design truth.”* Now with agent docs as input.

---

## Lab website (minimal v1)

**Hero:**  
Human-readable design truth for the age of agent documentation.

**Subtitle:**  
Paste your Claude.md and design docs. Get a wiki your team uses for direction—while agents keep structured rules underneath.

**Sections:** Experiments · Notes · Demos · Contact

**Per experiment:** problem → GIF → screenshot → what I learned → links

---

## First experiment (BlockSmith)

| Phase | Deliverable |
|-------|-------------|
| v0 | Knowledge base UI (paste bootstrap) |
| v1 | **IDE → Web** auto-update on save |
| v2 | **Web → IDE** finalize writeback |
| v3 | MCP; same blocks in Cursor and wiki |

UI quality wins trust; **handshake** wins truth. Not a static renderer—a **living KB**.

---

## Mistakes to avoid

1. Optimizing for **longer** `design.md` instead of **legible** oversight  
2. Building MCP before a wiki humans want to open  
3. Treating taste as polish (it is the product)  
4. Competing with Notion on collaboration instead of **render + truth**  
5. Announcing a lab before one rendered demo exists  

---

## Success

A design lead opens the wiki, finds component + workflow in 10 seconds, and says: *“I can direct the team from this—not from twelve markdown files.”*

That is believable lab + company story.
