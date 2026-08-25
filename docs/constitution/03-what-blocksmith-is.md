# What BlockSmith Actually Is

**What this chapter covers:** The definition. What we build, in one sentence, one paragraph, and one page. The four product layers and why they are worth more stacked than separate. The entity model a customer team maps onto. What we are explicitly not. The two product tracks that must never be mixed in one pitch. And the long-term destination.

**Why it matters:** [Chapter 02](./02-the-thesis.md) argued why something like this must exist. This chapter says what the thing *is*. If you cannot explain BlockSmith to an engineer, a designer, and an investor without losing any of them, you cannot recruit, sell, or prioritize. Most confusion about this company comes from people mixing layers, or mixing the near-term wedge with the long-term north star.

**Read this if:** You finish a conversation about BlockSmith and the other person says "so it is like Storybook?" or "so it is like v0?" This chapter contains the precise reasons those are wrong and, more usefully, the reasons someone would think they are right.

---

## 1. The definition, at three lengths

### One sentence

> **BlockSmith is the wiki and handshake that product teams use every day (scan, govern, visualize, finalize), plus the infrastructure underneath (Design IR and design CI/CD) so the same design truth feeds humans, agents, and compile targets without drift.**

Two shorter variants exist for two audiences, and you should know which one you are using:

- **Product framing, for a design lead or engineer:** Scan your repo, get a wiki your team can govern, plus a compile path to importable UI. Same spec for humans and agents.
- **Infrastructure framing, for an investor or a researcher:** TCP/IP for design, plus CI/CD for design blocks. The wiki and the package are compile targets, not competitors to the protocol.

The most common mistake is presenting these as alternatives. They are one system described at two altitudes.

### One paragraph

Teams are accumulating design documentation written for AI coding agents, and that documentation has become unreadable for the humans who are supposed to steer it. BlockSmith ingests those sources (a repo scan, an uploaded markdown file, a Figma file) into a canonical, versioned graph of design **blocks** called the Design IR. From that one graph it compiles several outputs: a rendered wiki where humans browse, govern, and **promote** design decisions; a `DESIGN.md` and a `blocksmith.lock` file written back into the customer's repo; an importable package `@blocksmith/<product>` that agents and engineers build with instead of inventing CSS; MCP tool responses that serve agents only the **promoted** versions; and device compile targets for embedded screens. Humans promote in the wiki. Everything else compiles from the promoted graph. That is the whole product.

### One page

Here is the same thing said slowly, with the mechanism visible.

**The input.** A customer team has design truth scattered across three places: their code (real components, real CSS variables, what actually ships), their Figma file (intent, exploration, often diverging from code), and their markdown (governance prose, agent rules, growing without structure). BlockSmith has **ingest adapters** that read these and write into one format. Repo scan is Shipped (`src/lib/scan/`). Markdown upload is Shipped. Figma import is Shipped and proven against live files (`src/lib/figma/`). Storybook ingest exists as a script (`npm run ingest:storybook`). Adapters only write IR. They never write directly to the wiki or the package, which is what keeps the graph the single source.

**The graph.** Everything lands as blocks in `blocksmith.blocks.v1`. A block is one addressable piece of design truth: a token, a component, a guideline, an agent rule, a page. Each block has an `id`, a `type`, a monotonic `version`, a `status` (`draft`, `finalized`, `stale`, `conflict`), a `source` recording where it came from, a typed `content` payload, and a `contentHash`. Versions are **append-only**. An `official` pointer per block is what "production" means. Types live in `src/lib/ir/types.ts`, the schema is published at `public/schema/blocksmith.blocks.v1.json`, and the version machinery is `src/lib/ir/registry.ts`.

**The human surface.** The wiki renders the graph. A designer or lead browses tokens, components, and surfaces, uses **Visualize** to feel a change before committing to it, edits governance (a component's role, its usage rules, its do's and don'ts), and sees a version badge on every block telling them whether they are looking at something live, draft, stale, or in conflict. The wiki is not documentation hosting. It is a release console. `/wiki/releases` is the pipeline view: every block, its official version, its last promote, whether the lock is stale, batch promote, history, conflicts.

**The gate.** Editing governance creates a **draft** version. Agents do not see it. Production does not move. A human clicks **Finalize** (which is the same act as **Promote**), and only then does the official pointer advance. `POST /api/wiki/finalize`, `POST /api/wiki/promote`, `POST /api/wiki/rollback`. This is the single most important design decision in the product: draft is free, official requires a person.

**The pin.** On promote, `blocksmith.lock` is regenerated. The customer runs `blocksmith pull` (the CLI in `packages/cli/`), which writes `DESIGN.md` and the lock into their repo. The lock maps block id to version and content hash, and names the package build it corresponds to. From that moment, agents reading through MCP get **official versions only**, enforced in `src/lib/ir/enforce.ts`. CI can gate pull requests with `npm run validate:ui`, which fails on a stale lock or off-token diffs.

**The other outputs.** The same promoted graph compiles to a React package via Pulse (`npm run codegen:pulse`, demo at `/demo/pulse`), to MCP tool payloads for Cursor and Claude, to a device simulator and a C token header (`src/lib/ir/targets/device-sim.ts`, `src/lib/ir/targets/c-header.ts`, `npm run compile:device`, demo at `/demo/device`), and to public share pages for a single block (`/share/{shareId}`).

**The loop, closed.** Engineer changes an accent in code. Re-scan detects it. The token block gets a new version and auto-promotes, because shipped code is a fact rather than a proposal. The wiki shows the new value and the lock goes stale. The lead pulls. Every agent on the team now builds with the new accent. No one copied anything by hand.

If you can say that page, you can explain BlockSmith to anyone.

---

## 2. The layered product stack

BlockSmith is four layers. People get confused because each layer is independently a product someone could sell, and because different audiences care about different layers. Learn all four and learn which one your listener cares about.

| Layer | Name | What a user gets | Status |
|---|---|---|---|
| 1 | **Wiki** (the human product) | Scan, browse Featured and Styles and components, Visualize, edit governance, Finalize | Shipped on public SaaS |
| 2 | **Handshake** (the sync product) | `blocksmith pull`, MCP, API keys, orgs, writeback to `DESIGN.md` | Shipped, roughly two thirds of Goal 2 |
| 3 | **Pulse** (the compile layer) | The same doc compiles to `@blocksmith/<product>` | Shipped locally, hosted publish is Planned |
| 4 | **Design IR + CI/CD** (the infrastructure) | One block graph, versions, promote, `blocksmith.lock`, enforcement, compile targets | Schema and engine Shipped, adoption by third parties is Planned |

Status figures come from [`docs/PITCH-AND-PRODUCT-MODEL.md`](../PITCH-AND-PRODUCT-MODEL.md) and [`docs/GOAL-SAAS-STATUS.md`](../GOAL-SAAS-STATUS.md). Verify the current numbers before quoting them externally, since they move.

### Layer 1: Wiki, the human product

**What it is.** A rendered, auto-updating knowledge base built from the block graph. Tokens grouped and shown as real color, typography with real type, components with live previews and their governance prose, surfaces, do's and don'ts, and version state on every block.

**What it would be worth alone.** Real but modest. This is the "nicer design system docs site" market. Storybook docs, ZeroHeight, Supernova, and a dozen internal builds compete here. Teams pay for it, but it is a known, crowded category, and its central weakness is well known too: the site is only as current as the last person who updated it. Sold alone, we would be one more docs product losing slowly to staleness.

**Why it is layer 1 anyway.** Because it is where humans live, and because Principle 5 says taste is a feature. A protocol nobody can see does not get adopted by design leads, and design leads are the buyer. The wiki is the reason anyone opens BlockSmith on a Tuesday.

### Layer 2: Handshake, the sync product

**What it is.** The two-way link between the wiki and the repo. Pull writes `DESIGN.md` and the lock into the customer repo. Scan and re-scan bring code changes back into the graph. API keys and orgs make it multi-tenant. MCP serves agents.

**What it would be worth alone.** Meaningful but incoherent as a standalone. "A tool that syncs your design doc between a web app and your repo" is a feature, not a company. Nobody wakes up wanting sync. They want the thing sync makes possible.

**Why it is layer 2.** Because it is what makes layer 1 survive contact with time. Every previous internal design wiki this team has seen died of staleness. Handshake is the answer to "who keeps it current," and the answer is "the repo does, automatically." It also converts the wiki from a viewer into a control surface: your click in the browser changes a file in a repo, which means the wiki has actual authority instead of merely describing.

### Layer 3: Pulse, the compile layer

**What it is.** The same scan doc that produced the wiki also compiles to a real React package, `@blocksmith/<product>`, containing governed primitives (`Surface`, `Text`, `Button`) and tokens. Agents import from it instead of writing CSS. Codegen lives in `scripts/codegen-pulse.ts` and `npm run codegen:pulse`, is guarded by `npm run verify:pulse`, and demos at `/demo/pulse`.

**What it would be worth alone.** This one is genuinely attractive standalone, and it is the layer most likely to make an engineer nod. "Turn our design system into an importable package that AI agents use" is a clean pitch. But alone it has an obvious hole: who decides what goes in the package, and how does it stay right? Without layers 1, 2, and 4, Pulse is a code generator whose output nobody governs.

**Why it is layer 3.** It is the artifact that makes design truth **executable**. A rule in a wiki is advice. A rule expressed as a component you must import is a constraint. Pulse is where governance stops being prose and starts being an API surface. It is also the most legible proof that the graph is real: the same input produced a website for humans and a package for machines.

**Important boundary.** The package is generated governed stubs plus tokens, built from the scan and the finalized governance. It is **not** a mirror of every file in the vendor repo, and it is not a day-one replacement for the team's production `Button.tsx`. Overclaiming here is how you lose an engineer's trust in the first ten minutes.

### Layer 4: Design IR and design CI/CD, the infrastructure

**What it is.** Two coupled systems. The **protocol** (`blocksmith.blocks.v1`) is the canonical intermediate representation: a versioned graph that every source compiles into and every target compiles out of. The **pipeline** (design CI/CD) is the lifecycle on top of that representation: ingest, build, staging (draft), promote, lock, deploy, verify, rollback.

**What it would be worth alone.** Potentially the most valuable layer and the hardest to monetize directly. A published spec with no reference implementation is a document. As [`docs/RESEARCH-INFRA-DESIGN-IR-AND-CICD.md`](../RESEARCH-INFRA-DESIGN-IR-AND-CICD.md) puts it: IR without CI/CD is a file format, IR with CI/CD is infrastructure. And infrastructure without a product that dogfoods it is a proposal.

**Why it is layer 4.** Because it is what makes layers 1 through 3 one system instead of three tools that happen to be sold together. The lock is what stops an agent from drifting. The version registry is what makes promote meaningful. The compile-target abstraction is what lets a device profile exist without forking the graph.

### Why the stack is worth more than the sum

Each layer alone has a fatal objection. Stacked, each layer answers the objection against the one above it.

| Layer | Fatal objection if sold alone | Which layer answers it |
|---|---|---|
| Wiki | "It will go stale like every design wiki" | Handshake and re-scan keep it current |
| Handshake | "Sync of what? This is a feature" | Wiki is the thing worth syncing |
| Pulse | "Who governs what goes in the package?" | Wiki promote decides, lock pins it |
| IR + CI/CD | "A spec with no users is a PDF" | Wiki, handshake, and Pulse are three real compile targets that dogfood it |

That mutual-support structure is the actual product argument, and it is why [`docs/PITCH-AND-PRODUCT-MODEL.md`](../PITCH-AND-PRODUCT-MODEL.md) insists on "wiki **plus** protocol" and rejects "wiki **or** protocol." When someone asks you to simplify by dropping a layer, the honest answer is that dropping any one of them reopens a hole in the story.

There is a compounding effect worth naming explicitly. Every new ingest adapter (Figma, Storybook, tokens JSON) makes every existing compile target more valuable, because more truth flows to all of them at once. Every new compile target (device, MCP, a future one) makes every existing adapter more valuable for the same reason. Adapters times targets. Adding one adapter adds N units of value where N is the number of targets. That is the shape of a protocol business, and it is the reason [`docs/CEO-DIRECTIVE.md`](../CEO-DIRECTIVE.md) treats the spec as an asset to publish rather than a secret to keep.

---

## 3. UI AI Lab versus BlockSmith, and where the side projects sit

Two names, and they mean different things.

| Name | Role |
|---|---|
| **UI AI Lab** | The research umbrella. Experiments on human control of UI in the agent era. The category bet. |
| **BlockSmith** | The flagship product. Scan and ingest, wiki plus compile, handshake with the IDE. The wedge. |

The relationship is simple: **BlockSmith is the wedge, the lab is the category bet.** BlockSmith is the specific product a specific customer pays for. The lab is the frame that explains why several apparently different projects belong to the same company. Investors buy the lab story only after BlockSmith is credible. Do not lead with the lab.

The rule that governs the lab, from [`docs/CEO-DIRECTIVE.md`](../CEO-DIRECTIVE.md), is that lab experiments must **feed the flagship** rather than compete with it. Disconnected experiments do not ship.

### Where font-generator sits

`font-generator/` is a real, separate Next.js app in this repository. It generates downloadable fonts from an AI prompt. It works by **instancing real open-licensed variable fonts** (Inter, Space Grotesk, Recursive, Fraunces, and others in `font-generator/public/fonts/`), where the model picks a base family, axis values, tracking, and a geometry-reshaping `shape` payload. It was deliberately pivoted away from a from-scratch parametric glyph engine, because that engine could not produce professional lowercase, numerals, or symbols. Do not reintroduce the skeleton engine; that decision is settled.

**Why it belongs to the lab.** It is the cleanest small proof of the architectural principle that runs through everything else: **deterministic composition with AI selecting inside validated constraints**. The AI does not draw glyphs. It selects a base and axis values, and `sanitizeParams` validates them. That is exactly the same shape as Pulse (the model does not write CSS, it arranges governed primitives) and the same shape as Visualize (deterministic semantic preview first, optional AI refine that can time out without breaking anything).

**What it is not.** It is not a BlockSmith feature and it is not on the BlockSmith roadmap. It is an experiment that validated a principle and produced a usable artifact. Treat it as a sibling app, not a module.

### Where the browser extension sits

The "restyle anything on the internet" browser extension is the **north star surface** and it is currently an **Idea**, not code. An `extension/` directory does exist in the working tree, but it is untracked in git and it is a screenshot capture tool called "BlockSmith Capture" with no content script and no third-party host permissions, so it cannot read or restyle any page. See section 7 for why this track is kept separate, section 8 for what it eventually becomes, and [Chapter 21](./21-the-north-star-tracks.md) for the full track.

---

## 4. The core product motion

Here is the motion, redrawn in plain ASCII.

```
   +------------------------------------------------------+
   |  WEB (the wiki)                                       |
   |  Auto-updating knowledge base for humans              |
   |  Browse . Visualize . edit draft . FINALIZE           |
   +--------------------------+---------------------------+
                              |
                    arrow A   |   arrow B
                  (finalize   |   (render)
                   writeback) |
                              v
   +------------------------------------------------------+
   |  BLOCKS (Design IR, blocksmith.blocks.v1)             |
   |  One graph . append-only versions . official pointer  |
   +--------------------------+---------------------------+
                              ^
                    arrow C   |   arrow D
                   (ingest    |   (lock + MCP +
                    on scan)  |    package)
                              |
   +--------------------------+---------------------------+
   |  IDE (repo + Cursor / Claude via MCP)                 |
   |  Code . DESIGN.md . blocksmith.lock . agents build    |
   +------------------------------------------------------+
```

Four arrows. Each one is a real code path, and each one exists for a reason.

**Arrow A: Web to Blocks, on Finalize.** A human edits a component's role or usage rules in the wiki. That creates a **draft** version in the registry. Nothing downstream moves. When the human clicks Finalize, the official pointer advances and the lock is regenerated. This arrow is the human gate, and it is the only arrow a person operates by hand. Code: `src/app/api/wiki/finalize/route.ts`, `src/app/api/wiki/promote/route.ts`, `src/lib/ir/registry.ts`.

**Arrow B: Blocks to Web, on render.** Every wiki page is a compile of the graph, not a rendering of a markdown file. This is what allows version badges, stale banners, and conflict states to appear inline on the page where the decision is made rather than in a separate admin tool. The wiki can render **draft** versions (humans are allowed to preview), which is precisely what agents cannot do.

**Arrow C: IDE to Blocks, on scan.** The customer's repo is walked, real components and real CSS variables are extracted, and the facts become blocks. Scan facts **auto-promote**, because code that already shipped is not a proposal. A re-scan where nothing changed creates no new version. A re-scan where the accent changed creates a new version and marks the lock stale. Code: `src/lib/scan/` (`walk.ts`, `extract.ts`, `tokens.ts`, `to-markdown.ts`, `run.ts`), plus `npm run scan` and the MCP tool `scan_workspace`.

**Arrow D: Blocks to IDE, on pull and on MCP read.** `blocksmith pull` writes `DESIGN.md` and `blocksmith.lock` into the repo. MCP tools serve agents the official versions from the lock and refuse drafts. CI reads the lock and gates pull requests. Code: `packages/cli/src/pull.ts`, `src/lib/ir/lock.ts`, `src/lib/ir/enforce.ts`, `src/lib/mcp/blocksmith-server.ts`, `scripts/validate-ui.ts`.

**The two things to notice.**

First, **there is no arrow from Web to IDE directly, and none from IDE to Web directly.** Everything passes through the block graph. That is Principle 4 (one block graph) expressed as topology. If you ever find yourself writing a code path from a wiki page straight to a repo file, you are building a second source of truth.

First-time readers often summarize the motion as "IDE to Web: save or scan, blocks update, wiki refreshes. Web to IDE: finalize a human edit, repo files update, the IDE sees the change." That summary is correct as a user experience and misleading as an architecture, because it hides the middle box. The middle box is the company.

Second, **arrows C and A have different trust rules.** Ingest from code auto-promotes. Human governance edits require a gate. That asymmetry is deliberate: we trust observed reality automatically and trust proposals only after a person signs off.

---

## 5. One team = one design system = one package

This is the entity model. Getting it wrong produces a product that fragments truth per user, which is the exact disease we exist to cure. From [`docs/TEAM-NORTH-STAR.md`](../TEAM-NORTH-STAR.md).

| Entity | Example | Notes |
|---|---|---|
| **Org / team** | `acme-design` on BlockSmith | GitHub org, invites, API keys, roles |
| **Design doc** | `upload:scan-acme-mobile-app.md` | Stable slug derived from the repo or `workspaceId` |
| **Design IR graph** | Every block for that doc | Tokens, components, governance rules |
| **Pulse package** | `@blocksmith/acme-mobile-app` | Compiled from **promoted** blocks only |
| **Lock file** | `blocksmith.lock` in the customer repo | Pins block id to version for agents and CI |

Drawn as a tree:

```
Acme Corp (org)
  |
  +-- scan-acme-mobile-app.md          (one design doc, stable slug)
        |
        +-- Wiki                        (humans browse, govern, promote)
        +-- @blocksmith/acme-mobile-app (agents and apps import)
        +-- blocksmith.lock             (pinned in the customer repo)
        +-- device profile / tokens.h   (embedded compile target)
```

**The rule.** Every user on the team sees the **same** wiki, shares the **same** promoted graph, and pulls the **same** lock. Roles (owner, admin, promoter, viewer) control **who may promote**. They do not create separate packages. There is no such thing as "my version of the design system."

### The concrete week

This is the story to tell when someone asks how versioning actually works day to day. It is the Acme walkthrough from [`docs/TEAM-NORTH-STAR.md`](../TEAM-NORTH-STAR.md).

**Monday.** The team scans `acme/app`. The wiki goes live. Blocks are created at v1 and scan facts auto-promote to official. `@blocksmith/acme-app` is built from the official v1 graph. The lock lands in the repo after a pull.

**Tuesday.** A designer edits the button usage rule in the wiki. This creates **draft v2**. The button page shows a Draft badge. Production is unchanged. Every agent on the team still reads v1. This is the part people find surprising and it is the point: a designer cannot accidentally change what agents build.

**Wednesday.** The lead reviews the draft and clicks **Promote**. The official pointer moves to v2, the lock is regenerated, and `blocksmith pull` brings it into the repo. Agents now read v2.

**Thursday.** An engineer changes the accent color in code. A re-scan detects it. The token block auto-promotes to v3, because shipped code wins for facts about shipped code. The wiki shows the new value immediately, and a stale-lock banner appears because the repo's lock no longer matches the official graph hash. The lead pulls the new lock.

That is design CI/CD, without a separate Jenkins instance and without a second admin product. The full event table (what creates a version, who sees it, what happens on rollback and on block removal) is in [`docs/TEAM-NORTH-STAR.md`](../TEAM-NORTH-STAR.md).

### The Jenkins mapping

Engineers get this instantly if you map it to CI they already know.

| Jenkins concept | BlockSmith equivalent | Where it lives |
|---|---|---|
| Build | Scan or ingest into Design IR | Server on scan, `recordIngest()` |
| Artifact | Block at version, plus the Pulse build | Registry, `@blocksmith/...` |
| Staging | **Draft** block in the wiki | Wiki preview |
| Approve / merge | **Finalize** (promote) | Wiki button, `POST /api/wiki/finalize` |
| Production deploy | Update `blocksmith.lock` | Pull API and CLI, into the customer repo |
| CI gate | `npm run validate:ui` | GitHub Actions on **their** repo |
| Rollback | `rollbackBlock()` | Wiki action, `POST /api/wiki/rollback` |

The important part of that table is the last column. The pipeline UI lives **in the wiki**, at `/wiki/releases`. There is no separate ops console, and building one is explicitly on the "do not build" list.

---

## 6. What BlockSmith is NOT

Every one of these comparisons gets made by a smart person in good faith. Know the precise line and know why we drew it there.

### Not a Notion or GitBook clone

**Why people think it.** It is a web app with pages, headings, and prose about design, and you can edit text in it.

**Where the line is.** Notion and GitBook store **free-form documents**. BlockSmith stores **structured blocks with a lifecycle**. A paragraph in Notion has no id, no version, no official pointer, no content hash, no compile targets, and no ability to fail a CI job. A BlockSmith component block has all of those. Our editing surface is deliberately constrained: you edit a component's role and its usage rules, which are fields on a block, not arbitrary rich text.

**Why we drew it there.** Free-form editing is precisely the failure mode from [Chapter 02](./02-the-thesis.md): it produces the unstructured wall of text that nobody can govern. If we let users write anything anywhere, we recreate `DESIGN.md` with better fonts. [`docs/TEAM-NORTH-STAR.md`](../TEAM-NORTH-STAR.md) lists "Notion clone for free-form docs" under things not to build, opposite "structured blocks with a draft to production lifecycle." Also strategic: competing with Notion on collaboration features is a fight we lose, and it is not the fight. We compete on **render plus truth**, which is a surface Notion does not have and would not want.

### Not a Figma competitor

**Why people think it.** We ingest Figma, we show colors and components, and we talk about design systems.

**Where the line is.** Figma is where design **intent** is created and explored. It owns the canvas, and we are not building a canvas. BlockSmith's position is that **code plus promoted governance is truth**, and Figma is a **reference and an ingest source**. When Figma and the code scan disagree on a token value, we do not pick a winner automatically. Both values land in the graph with `status: "conflict"` until a human resolves it in the wiki.

**Why we drew it there.** Three reasons. Design teams are not going to stop using Figma, so a product that requires them to leave it is dead on arrival. The canvas is an enormous, well-defended engineering surface with no strategic upside for us. And most importantly, the interesting problem is not "where do you draw the button," it is "which button definition is official right now, and does the shipped code agree with it." That question is unowned. See [`docs/PITCH-AND-PRODUCT-MODEL.md`](../PITCH-AND-PRODUCT-MODEL.md): "We replace Figma" is on the explicit overclaim list.

### Not v0, Lovable, or bolt (prompt-to-UI)

**Why people think it.** We have AI, we produce UI, and we have a demo where things get generated.

**Where the line is.** Those tools generate UI **from a prompt**. The input is an intention in English and the output is plausible UI, which by construction is off-brand and inconsistent with the team's existing system, because the system was never an input. BlockSmith generates **from a governed design system**. The IR is the input, and the model's job is constrained to selecting and arranging inside validated constraints. The output is provably on-brand, in the specific sense that off-token values are detectable and rejectable (`scripts/validate-ui.ts`).

**Why we drew it there.** Two reasons, one about customers and one about defensibility. On customers: the persona is design-system teams who care about governance, fidelity, and handoff, and that persona's entire complaint about prompt-to-UI tools is that they produce beautiful output that does not match anything. On defensibility: "generate UI from a prompt" is a capability that improves with every model release and belongs to whoever has distribution. "Generate UI that provably conforms to *your* governed system" requires the governed system, which is the artifact we build and own. Curated layout archetypes beat infinite generation, because a guarantee is worth more than a probability.

The one-line version, worth memorizing: **they generate from a prompt, we generate from a system.**

### Not design-to-code from frames

**Why people think it.** We import from Figma, and importing from Figma usually means turning a frame into code.

**Where the line is.** We import the design **system**: variables, color and text styles, and the published component library with variant properties. We deliberately do **not** import frames and screens. A screen is an **instance**, not a governed asset. It has no reusable identity, no version worth pinning, and nothing an agent should conform to next month.

**Why we drew it there.** Frame-to-code is a real product category and it is Figma's own game (Figma Make and similar). Entering it means competing with the platform on its own surface with worse access. More fundamentally, it produces the wrong artifact for our thesis: a converted screen is a one-time output, while a governed component block is a durable asset with a lifecycle. Our moat is downstream of import (wiki, governance tiers, MCP serving agents, drift detection), and none of that moat applies to a converted screen. Token extraction alone is already commodity (Tokens Studio, Style Dictionary, native Figma export). The unowned space is **maintain and audit**, not extract.

### Also not, briefly

- **Not a component library.** We do not ship opinionated UI for you to adopt. We compile *your* system into a package.
- **Not a linter.** `validate:ui` is a gate, but the product is the truth that the gate checks against, not the checking.
- **Not "upload a `.md` and it runs on any hardware."** That is on the overclaim list. We claim one IR to web today, device profile tomorrow, same contract and different syntax.

---

## 7. The two product tracks that must not be conflated

This is the section that saves you from a bad meeting.

There are two ideas in this company that both involve "AI restyles a UI," and they have **different customers, different timelines, and different credibility requirements.** The founder keeps them deliberately separate.

### Track 1: the Figma-fit wedge (idea 1, the near-term commercial play)

**The move.** Fit inside the workflow design teams already have. Figma is the design source of truth. The repo is the code source of truth. `design.md` (the Design IR) is the **neutral contract both reconcile against**. Import the design system from Figma, seed the IR, and let everything downstream (wiki, governance tiers, MCP, drift) work as it already does.

**Why this and not token extraction.** Because token extraction is commodity. The moat is everything downstream of `design.md`. The single highest-value artifact is the **drift view**: "Figma says X, shipped code says Y." That is a question nobody currently answers, and it is only answerable by a system that holds both sources in one graph.

**The framing rule.** Build Figma to `design.md` as **bidirectional sync framed as drift**, not as a one-way import. The wow is the drift view, not the import.

**The architecture rule.** Reuse the existing scan pipeline. Figma tokens are emitted as the same scanned-token shapes with `source: figma:<fileKey>`, assembled into a synthetic workspace scan result, and run through the same markdown conversion, so the wiki, parser, and governance render it for free. The live Figma call stays a thin adapter, and the core transforms (variables to tokens, drift computation) are pure, deterministic, and covered by a verify script.

**Status: Shipped and proven live.** `src/lib/figma/` contains `normalize.ts` and `import.ts` (variables to tokens to `design.md`), `components.ts` (Figma components to scanned-component IR), `drift.ts` and `component-drift.ts` (token-level and variant-level drift), `adapter.ts` (real payload shapes plus recovery of tokens from design-context code for the common case of files with **no** variables), and `rest.ts` (a REST path that recovers tokens from color styles, text styles, raw fills, and component sets with variant props, which works on any Figma plan because the variables REST endpoint is Enterprise-only). Surfaces: MCP tools `import_figma_variables` and `figma_token_drift`, HTTP routes `POST /api/figma/import`, `POST /api/figma/drift`, and `POST /api/figma/connect`, and a paste-a-link UI at `/figma` (`src/components/figma/FigmaConnectCard.tsx`). Guarded by `npm run verify:figma-import`. Runbook: [`docs/FIGMA-IMPORT.md`](../FIGMA-IMPORT.md).

**One decided sub-question, worth knowing.** To build a *rich* wiki (button styles, type styles, component roles, do's and don'ts) you need more than token values. The rule is: **structured extraction is the governable spine** (exact values, traceable, drift-ready), and **vision or multimodal is enrichment for the qualitative prose** (component roles, usage notes, imagery style). Said compactly: **vision describes, structure governs.** Never let a vision pass produce a value that something downstream will treat as authoritative.

### Track 2: restyle-the-web (idea 2, the north star)

**The move.** A browser extension that analyzes **any webpage on the internet** and produces a `design.md` from the live DOM and CSS, extracting tokens, type scale, surfaces, and components. Then, in the fuller form, applies a user's own prompt or design system to third-party sites. The canonical example: change Facebook's layout from a prompt.

**Why it is the north star.** It generalizes the engine from documents a customer uploads to **the entire internet**, and it moves the unit of control from a team to an individual. Each user gets independent, personal control over any UI they encounter. The same governed IR and the same deterministic-composition-with-validated-AI engine are the substrate; the extension is that engine pointed at arbitrary live DOM instead of a clean source doc.

**Status: Idea.** The only extension code in the working tree is an untracked screenshot capture popup that cannot read page structure. The open questions are real and unresolved: per-site DOM to IR extraction from live pages, persistence and sync of per-user overrides, performance on third-party sites, and where the deterministic and validated boundary sits when there is no clean source document to anchor against.

### Why they are kept separate

Because they sell to **different people who want opposite things.**

A Figma-centric design-system lead does not care that you can scrape Stripe's website. They care that **their own** system is enforced inside **their own** team. Demonstrating "look, we restyled Facebook" to that buyer does not read as power. It reads as a company that has not decided what it does, and it raises three objections at once: is this a toy, is this legal, and are you actually going to support my enterprise workflow.

Conversely, pitching bidirectional Figma drift detection to someone excited about consumer UI control reads as narrow enterprise plumbing.

**What happens if a pitch mixes them.** You get the worst of both. The listener cannot identify the customer, so they cannot size the market. The near-term product loses credibility because it appears to be a stepping stone rather than a thing that stands up. And the long-term vision loses credibility because it is being presented before the engine that makes it plausible has been proven on the easier case. The correct sequencing is: prove the engine on the governed, bounded case (Figma and repo), earn the right to the harder case, then talk about the internet.

**The practical rule.** In any given document, deck, or meeting, pick one track and stay in it. If you must mention the other, mention it once, at the end, labeled as the long-term direction, with no implication that it is being built now.

---

## 8. The long-term north star

The eventual destination, stated plainly.

**Per-user control of any UI, extending down to the hardware and device layer.**

Today, the person who decides what an interface looks like is the team that shipped it. You get their choices. The long-term claim is that this is an accident of tooling rather than a law: if there is a governed, machine-readable representation of a UI, and an engine that can recompose that UI faithfully inside validated constraints, then **the user can be the one holding the design system.** Not a team's design system applied to a team's product, but *your* design system applied to whatever is in front of you.

The ladder runs like this. Each rung reuses the same substrate: a Design IR, deterministic composition, and AI constrained to selecting inside validated bounds.

| Rung | Surface | What is controlled | Status |
|---|---|---|---|
| 1 | Documents a team uploads or scans | A team's own product UI | Shipped |
| 2 | Figma plus repo reconciliation | A team's design system across sources | Shipped |
| 3 | Compiled targets (web package, MCP, device sim, `tokens.h`) | The same truth on several runtimes | Shipped for sim and header, firmware Planned |
| 4 | Arbitrary live websites via a browser extension | Any web UI, per user | Idea |
| 5 | Device and OS interfaces, plug and play | UI below the browser | Idea |

Rungs 4 and 5 are honestly Idea-stage and should be labeled that way in every external conversation.

### Why the hardware direction is not a gimmick

Two reasons, one commercial and one about the team.

**The commercial reason.** The customers with the most acute version of the drift problem are the ones whose interfaces reach devices that cannot run `npm install`: automotive clusters, industrial HMIs, kiosks, wearables, medical panels. Their design system has to reach screens through a firmware pipeline, which today means a PDF and a spreadsheet handed to an embedded team, which then diverges permanently. A promoted block graph that emits a token header and widget constraints is a direct answer to a problem those teams already pay people to manage badly. [`docs/CEO-DIRECTIVE.md`](../CEO-DIRECTIVE.md) frames the ladder as: wiki-linked device preview, then style packs for RTOS and LVGL and embedded Linux, then dev board profiles, then production HMI pipelines, then OTA for design, where a promoted token change ships to field devices with the same version semantics as software (staging channel, production channel, rollback, audit).

Every rung on that ladder must trace to `official` versions and lock pins. Field devices do not read draft wiki edits. That constraint is what makes the hardware story an extension of the existing thesis rather than a new company.

**The team reason.** The founders are computer-engineering majors. That matters here specifically. The web layer is well served by people with web backgrounds, and a team of web engineers proposing an embedded compile target is proposing something they will need to hire for. A team that is natively comfortable below the browser (registers, constrained memory, display drivers, RTOS scheduling, the reality that a 240 by 240 panel has no layout engine and no font fallback) can build rung 3 as an ordinary engineering task rather than a research project. The CPE background is the wedge for going below the web stack, and going below the web stack is where the competition thins out dramatically.

The current honest position, and the one to state in public: **we claim semantic portability, not "flash any `.md` to any chip on day one."** Phase 1 is a browser device simulator, which proves semantic compile without firmware risk. Phase 2 is exporting `tokens.h` and LVGL descriptors as generated artifacts that a human integrates. Phase 3, OTA of design blocks to hardware, is industry-partner territory.

---

## Open questions

1. **Does the four-layer stack survive contact with a real buyer, or does one layer dominate the sale?** It is possible that in practice everyone buys layer 1 and tolerates the rest, or that engineers buy layer 3 and never open the wiki. We do not know which layer closes deals, because we have not closed enough deals.
2. **Where exactly does Pulse stop?** Governed stubs today. Does it eventually replace a team's production `Button.tsx`? That would be far more valuable and far more invasive. There is no decision on record.
3. **Is `/wiki/releases` the right home for the pipeline, or does a serious team eventually want a dedicated console?** The current answer is an emphatic no separate console. That answer was decided on principle, not from user evidence.
4. **How do orgs, roles, and promote rights scale?** Owner, admin, promoter, and viewer are named. RBAC on promote is partially implemented (`npm run verify:org-rbac`). What a 200-person design org actually needs is unknown.
5. **Should the Figma track and the extension track eventually share code, and if so where?** Both need "extract an IR from something that was not written for us." Today they are described as separate tracks with a shared engine. Nobody has designed the shared boundary.
6. **What is the first hardware customer?** Rung 3 is Shipped as a simulator and a header emitter with no customer attached. Until one exists, the hardware ladder is a roadmap slide, and it should be presented as one.
7. **Does one graph per design doc hold, or will large orgs need graph composition?** Today: one org, one doc, one package. A company with a core system plus three product-specific extensions does not obviously fit that model.

---

## Where to look in the code

| Concept in this chapter | Path | Notes |
|---|---|---|
| Block and graph types | `src/lib/ir/types.ts` | The shape of everything |
| Published schemas | `public/schema/blocksmith.blocks.v1.json`, `blocksmith.lock.v1.json`, `blocksmith.registry.v1.json`, `blocksmith.compile-targets.v1.json` | The protocol as an artifact |
| Version registry, promote, rollback | `src/lib/ir/registry.ts`, `src/lib/ir/releases.ts` | Append-only versions, official pointer |
| Lock generation and verification | `src/lib/ir/lock.ts` | The pin |
| Agent enforcement | `src/lib/ir/enforce.ts` | Official only, no drafts |
| Pipeline model | `src/lib/ir/pipeline.ts`, `pipeline-stages.ts`, `pipeline-runs.ts` | The CI/CD stages |
| Compile targets | `src/lib/ir/targets/device-sim.ts`, `src/lib/ir/targets/c-header.ts` | Second and third emitters |
| Layer 1, the wiki | `src/app/wiki/`, `src/components/wiki/` | The human product |
| Promote surfaces | `src/app/api/wiki/finalize/route.ts`, `promote/route.ts`, `rollback/route.ts`, `pin-lock/route.ts`, `releases/route.ts` | The human gate |
| Layer 2, the handshake | `packages/cli/src/` (`pull.ts`, `scan-local.ts`, `cursor-setup.ts`), `packages/sdk/src/`, `src/lib/mcp/blocksmith-server.ts` | Pull, MCP, SDK |
| Layer 3, Pulse | `scripts/codegen-pulse.ts`, `npm run codegen:pulse`, `npm run verify:pulse`, `/demo/pulse`, `packages/pulse-runtime/` | The compile layer |
| Layer 4 conformance | `packages/protocol/`, `npm run protocol:conformance`, `npm run verify:ir-cicd` | Evidence the protocol is testable |
| Ingest: repo scan | `src/lib/scan/` (`walk.ts`, `extract.ts`, `tokens.ts`, `to-markdown.ts`, `run.ts`), `npm run scan` | Arrow C |
| Ingest: Figma (Track 1) | `src/lib/figma/` (`normalize.ts`, `import.ts`, `components.ts`, `drift.ts`, `component-drift.ts`, `adapter.ts`, `rest.ts`), `src/app/api/figma/`, `src/app/figma/`, `npm run verify:figma-import` | The wedge |
| Ingest: Storybook | `scripts/ingest-storybook.ts`, `npm run ingest:storybook` | Additional adapter |
| Public block feedback | `src/app/api/share/`, `src/lib/public-share/`, `src/app/share/[shareId]/` | Blocks can go public |
| Device demo | `/demo/device`, `scripts/compile-device.ts`, `npm run compile:device` | Rung 3 |
| font-generator (lab sibling) | `font-generator/` (`lib/fontCatalog.ts`, `lib/instanceFont.ts`, `lib/genShape.ts`, `app/api/generate/route.ts`) | Separate app, same principle |
| CI gate | `scripts/validate-ui.ts`, `npm run validate:ui`, `.github/workflows/validate-ui.yml` | Runs on the customer's repo |

Source documents behind this chapter: [`docs/PITCH-AND-PRODUCT-MODEL.md`](../PITCH-AND-PRODUCT-MODEL.md), [`docs/TEAM-NORTH-STAR.md`](../TEAM-NORTH-STAR.md), [`docs/CEO-DIRECTIVE.md`](../CEO-DIRECTIVE.md), [`docs/01-vision-and-positioning.md`](../01-vision-and-positioning.md), [`docs/RESEARCH-INFRA-DESIGN-IR-AND-CICD.md`](../RESEARCH-INFRA-DESIGN-IR-AND-CICD.md), [`docs/FIGMA-IMPORT.md`](../FIGMA-IMPORT.md), [`docs/PHASE2-PULSE.md`](../PHASE2-PULSE.md), [`README.md`](../../README.md).

Previous: [Chapter 02: The Thesis](./02-the-thesis.md).
