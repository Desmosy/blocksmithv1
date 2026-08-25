# The Market, The Competition, And Where We Fit

**What this chapter covers.** The category we claim and why, a competitor-by-competitor map of everything adjacent to us, the line between what is commodity and what is defensible, a skeptical audit of our moat, a threat model for the two players who could erase us, and the timing argument.

**Why it matters.** Category choice determines who takes the meeting, what comparison a buyer runs in their head, and what kind of engineer wants to join. Get it wrong and every conversation starts with you explaining what you are not. Also: most of our differentiation claims are downstream of one specific bet (that governance, not extraction, is the valuable part). If that bet is wrong, we are a commodity token converter. This chapter is where we argue the bet honestly, including the parts that do not favor us.

**Read this if** you are about to write a landing page, take an investor call, write a job description, decide whether to build a feature, or argue that we should pivot. Read it before you write competitive copy, because the repo already contains three different framings of the company and you need to know which one is current.

---

## 1. The category question

### 1.1 Why the question is not academic

A category is a slot in someone's head. When a design-systems lead hears about us, they file us next to something they already know. That filing decides four things:

1. **The comparison.** File us under "design system documentation" and we get compared to Zeroheight on features we do not have (Figma canvas embeds, design-team collaboration, brand portals). File us under "design CI/CD" and we get compared to a linter, which we beat.
2. **The budget line.** Documentation tools come out of a design-ops budget, which is small and often discretionary. Developer tooling and CI come out of an engineering platform budget, which is larger and renews. See [Chapter 05](./05-who-we-sell-to.md) for the budget analysis.
3. **The investor pattern-match.** "Another design system docs tool" is a known-small market. "Infrastructure for the agent-written codebase" is a known-large one, and also a crowded pitch. Neither framing is free.
4. **Hiring.** A compiler-minded engineer joins "design IR and CI/CD for UI." They do not join "a wiki." A product-minded designer joins the wiki story and bounces off the protocol story. We need both kinds of people, which is exactly why the messaging in the repo is inconsistent.

### 1.2 The three candidate categories

| Category | The claim | Who already lives here | Why it tempts us | Why it hurts |
|----------|-----------|------------------------|------------------|--------------|
| **Design systems tooling** | "A better home for your design system" | Zeroheight, Supernova, Knapsack, Storybook, Tokens Studio | Instantly understood; the ICP already has this budget line | Small market, slow buyers, and we lose on breadth of features we will never build |
| **Agent infrastructure** | "Context and guardrails for coding agents" | Cursor Rules, `AGENTS.md`, MCP server ecosystem, context tooling | Big narrative, current, matches where our MCP server actually sits | Extremely crowded, mostly free, and the platform owners (Anthropic, Cursor, OpenAI) can absorb the whole layer |
| **Design CI/CD** | "Staging, promote, pin, and enforce, for design" | Nobody, really. Chromatic and Percy occupy the visual-regression corner of it | It is the only slot that is genuinely open, and it maps exactly to what we built | It requires the buyer to accept a metaphor before they accept the product. Metaphor-first categories are slow |

### 1.3 What we claim

**We claim design CI/CD, in developer language, with the wiki as the front door.**

The precise sentence lives in `docs/PUBLIC-RELEASE-SPRINT.md` and it is the one we should be using:

> Stop AI from inventing your design system. Approve design in the wiki. Pin it in your repo. Agents and CI follow what you approved.

That is a design CI/CD claim. It borrows the vocabulary developers already trust (staging, production, promote, pin, lock, rollback) and applies it to a noun (design) where nobody has applied it. The repo backs the metaphor with real machinery, not just copy: `POST /api/wiki/promote`, `POST /api/wiki/pin-lock`, `POST /api/wiki/rollback`, a lock schema at `packages/protocol/schemas/blocksmith.lock.v1.json`, and a CI job template at `examples/github/blocksmith-governance.yml`.

The other two categories are not discarded; they are **audience-scoped**:

- **Design systems tooling** is how we describe ourselves to a design lead in the first thirty seconds, because it is the only sentence they can parse cold. `docs/CUSTOMER-PITCH-SCRIPTS.md` calls this Path 1 and Path 2.
- **Agent infrastructure** is the substrate story we tell engineering leads and investors, backed by `packages/protocol` and the MCP server in `src/lib/mcp/blocksmith-server.ts`. `docs/PITCH-AND-PRODUCT-MODEL.md` calls this "TCP/IP for design," which is an overclaim we should retire (see 1.5).

### 1.4 The rule for writing copy

One rule, and it is enforceable in review:

> The homepage and the product UI speak **design CI/CD in plain words**. The `/protocol` route (`src/app/protocol/`) and the investor deck speak **infrastructure**. Never mix them on the same screen.

`docs/PUBLIC-RELEASE-SPRINT.md` already codifies this as a language rule: say "Staging, Production, Pin to repo, Pull design into your project"; do not say "official graph, blocks.v1, ingest, IR, draft vN" in customer UI. Follow it. Every time we have violated it, a demo has gone sideways.

### 1.5 The framings we are retiring

Three phrases in the repo are liabilities. They are recorded here so nobody reintroduces them by copying an old doc.

| Phrase | Where it lives | Why it must go |
|--------|----------------|----------------|
| "TCP/IP for design" | `docs/PITCH-AND-PRODUCT-MODEL.md`, `docs/CUSTOMER-PITCH-SCRIPTS.md` | Protocol claims require adoption we do not have. Saying it before three external adopters exist reads as bluster to anyone technical, and means nothing to a designer |
| "UI AI Lab" | `docs/01-vision-and-positioning.md`, `README.md` | A lab is not a company. `docs/PUBLIC-RELEASE-SPRINT.md` already declares "We are product company now, not lab company." Keep the lab name only as an internal research umbrella |
| "Auto-updating wiki" | `docs/02-competitive-landscape.md` | Honest status is that hosted BlockSmith does not run a live file watcher. `docs/CUSTOMER-PITCH-SCRIPTS.md` lists this under honest limits. Say "re-scan" instead of "auto-update" |

---

## 2. The competitive map

Read this section as a set of stopping points. For nearly every tool below, the interesting sentence is not "what they do" but "where they stop," because our entire product is a bet on one specific gap: **nobody owns the maintain-and-audit loop for a design system after the tokens have been extracted.**

### 2.1 Figma (canvas, Dev Mode, Figma Make, Figma MCP)

**What they do.** Figma is where design intent is authored. Dev Mode turns a selected node into inspectable specs, code snippets, and variable references for engineers. Figma Make generates working UI from a prompt or a frame. Figma ships an MCP server so coding agents can read a selected node's design context directly.

**Who buys them.** Everyone. Figma is already in the building, already paid for, and the design org's identity is tied to it. This is not a competitor you displace; it is weather.

**What they are genuinely good at.** Authoring. Collaboration on the canvas. Component libraries and variables as a first-class model. Reach: they are the default surface every designer opens. And with the MCP server, they are now genuinely in the agent loop, which is the part we should take most seriously.

**Where they stop.** Figma's model of truth is Figma. It is authoritative about what was designed and has no opinion about what was shipped. Dev Mode tells an engineer what a node should look like; it does not tell a design lead that the shipped `Button.tsx` drifted from it three sprints ago. Figma Make generates a screen, not a governed system, and generation is a one-shot event with no promotion gate behind it. Figma has no concept of "this version of the design system is pinned for agents until a human promotes the next one."

**Precisely why that is our opening.** Our position, recorded in the `figma-fit-wedge` memory, is deliberate: **BlockSmith does not replace Figma's canvas.** Figma is the design source of truth, the repo is the code source of truth, and `design.md` (the Design IR) is the neutral contract both reconcile against. The thing neither Figma nor the repo can produce alone is the sentence "Figma says X, shipped code says Y." That comparison needs both sides normalized into one representation, which is exactly what `src/lib/figma/normalize.ts`, `src/lib/figma/import.ts`, and the scan pipeline in `src/lib/scan/` produce, and what `src/lib/figma/drift.ts` and `src/lib/figma/component-drift.ts` compute.

One more piece of the opening, and it is practical rather than strategic: the Figma **variables** REST endpoint is Enterprise-only. `src/lib/figma/rest.ts` deliberately recovers tokens from color styles, text styles, raw fills, and component sets with variant properties instead, so `POST /api/figma/connect` works on any Figma plan. And `figmaDesignContextToTokens()` in `src/lib/figma/adapter.ts` recovers tokens from `get_design_context` output for files that have no variables at all, which the memory notes is the common case. Meeting teams where their Figma file actually is, rather than where the tidy documentation assumes it is, is a real advantage over anything that requires a well-structured variable collection.

**Status:** the Figma import and drift path is **Shipped** as verified code (`npm run verify:figma-import`, 49 checks) and **proven live** against real Figma files via the Figma MCP. The REST connector at `POST /api/figma/connect` is **Built, unproven** against a live personal access token as of the memory note; verify before demoing it.

### 2.2 Tokens Studio

**What they do.** A Figma plugin that manages design tokens as structured data, with themes, sets, aliases, and Git sync so tokens can round-trip between Figma and a repo.

**Who buys them.** Design-systems practitioners, usually the same person who would buy us. This is the sharpest overlap in the map on the ICP axis.

**What they are genuinely good at.** Token modeling. They took tokens seriously years before anyone else and their data model (sets, themes, aliases) is better than ours. Their Git sync is real two-way plumbing, not a demo.

**Where they stop.** They stop at the token file. Once tokens land in the repo as JSON, Tokens Studio's job is done. They do not know whether an engineer wrote `#3B82F6` by hand in a component last Tuesday. They have no component-level governance, no prose rules, no agent surface, and no promotion gate.

**Precisely why that is our opening.** Their output is our input. A team that already runs Tokens Studio is a *better* prospect than one that does not, because their tokens are clean and the only thing they are missing is enforcement. Our Tier-1 block lint (`src/lib/governance/color-lint.ts`) is exactly the enforcement layer their output implies but does not provide. We should build a Tokens Studio import path, not compete with them. It is currently listed as out of scope for the public beta in `docs/PUBLIC-RELEASE-SPRINT.md`, which is right for now and wrong for long.

### 2.3 Style Dictionary

**What they do.** An open-source build tool from Amazon that transforms a token source file into platform-specific outputs: CSS variables, iOS, Android, and anything you write a formatter for.

**Who buys them.** Nobody. It is free and it is a build step. Platform engineers adopt it.

**What they are genuinely good at.** Being boring, stable, and unopinionated. It is the de facto standard for the token-to-target compile step and it will outlive most of the tools on this page.

**Where they stop.** It is a compiler with no notion of governance, versioning-with-approval, or drift. It runs when you run it. It has no opinion about whether the token file it consumed was approved by anyone.

**Precisely why that is our opening.** This one deserves care, because Style Dictionary is the strongest argument that **the compile-targets half of our story is commodity**. Our `packages/protocol/compile-targets.v1.json` and the reference emitters (device profile, C header, planned LVGL) occupy ground that Style Dictionary has held for years for free. We should not pitch "one IR, many targets" as differentiation to anyone who knows what Style Dictionary is. Our differentiation is the gate in front of the compile step, not the compile step.

### 2.4 Storybook

**What they do.** A component workbench. Render every component in isolation, in every variant and state, with docs and controls.

**Who buys them.** Free and open source. Frontend and platform engineers adopt it; Chromatic is the commercial layer on top.

**What they are genuinely good at.** Being the place a component actually lives and renders. If a team has a design system in code, they very likely have Storybook, and it is the closest thing to a shared truth artifact that engineering already maintains. Its stories are structured, machine-readable, and already in the repo.

**Where they stop.** Storybook documents what exists. It has no view on what *should* exist, no approval flow, and no relationship to Figma other than an addon. It is descriptive, never prescriptive. A wrong component with a story is still a wrong component with a story.

**Precisely why that is our opening.** Storybook proves the component inventory; we govern it. But note the honest risk: for a team that already has good Storybook coverage, a chunk of our wiki's value (browse the components, see the variants) is duplicated. Our answer is that we add governance prose, promotion, the lock, and the agent surface, none of which Storybook has. Note also that `docs/GOAL-SAAS-STATUS.md` lists "Storybook / non-React" as explicitly out of scope at P3, which means we do not read stories today. Reading Storybook stories as a scan input is one of the highest-leverage integrations we are not building.

### 2.5 Zeroheight, Supernova, Knapsack

**What they do.** Design-system documentation platforms. Pull from Figma and from code, publish a branded documentation site, manage tokens, and in Supernova's and Knapsack's case, generate or sync code artifacts.

**Who buys them.** Design-system teams at mid-size to enterprise companies, usually with a design-ops person driving the purchase. Annual contracts. This is the closest thing to a direct competitor set we have.

**What they are genuinely good at.** Polish, breadth, and the enterprise checklist. Branded portals, permissions, versioning of documentation, Figma sync that a designer can operate without an engineer, and a sales motion that already knows how to close this buyer. Supernova in particular has a real code-generation pipeline. Knapsack has a real story about connecting design and code artifacts.

**Where they stop.** They stop at publishing. The artifact is a beautiful site that humans read and, critically, that humans have to *choose* to read. There is no enforcement path back into the repository: no pre-commit hook, no CI gate, no exit code. `docs/02-competitive-landscape.md` puts it as "design-team-centric, weaker on AI agent instructions and live MCP during coding," which is right but understates it. The real gap is that a documentation platform has no mechanism to make non-compliance *fail*.

**Precisely why that is our opening.** Documentation is advisory; we are the first tier that blocks. The three tiers in `docs/GOVERNANCE-TIERS.md` are the whole argument:

- **Tier 1 (block):** off-token hex, stale or missing lock. Machine-verifiable, fires in pre-commit, CI, or `blocksmith check`, and **fails** the build. `src/lib/governance/color-lint.ts`.
- **Tier 2 (warn and capture):** prose rules such as inactive links and stale dates. Yellow warning, push proceeds, and the drift is **captured back to the wiki** where the design lead sees it. `src/lib/governance/prose-lint.ts`, `POST /api/v1/governance/events`, `supabase/schema-governance-events.sql`.
- **Tier 3 (advisory):** agent-time guidance via the MCP tool `check_governance_diff`, which suggests the nearest token so the agent self-corrects before writing.

A documentation platform can build Tier 3 by publishing an MCP server. Building Tier 1 requires them to become a developer tool, ship a CLI, get into a pre-commit hook, and own an exit code. That is a different company shape and a different buyer, and it is why this is a real opening and not wishful thinking.

The counter-argument, stated fairly: Supernova and Knapsack are already partway down this road and are better funded. If either ships a CLI with a blocking check in the next eighteen months, our differentiation narrows to the agent surface and the Figma drift view.

### 2.6 Notion, GitBook, Confluence

**What they do.** General knowledge bases with collaboration, permissions, and in GitBook's case, Git sync.

**Who buys them.** Everyone, already. This is where most design systems actually live today, which makes them the true incumbent by usage.

**What they are genuinely good at.** Being where people already write. Zero adoption friction. Permissions and search that we will not match.

**Where they stop.** Free-form text is not machine-enforceable. A Notion page cannot fail a build, cannot be pinned to a version, cannot be served to an agent as a structured payload, and rots silently because nothing ever tells you it is stale.

**Precisely why that is our opening.** The objection handler in `docs/CUSTOMER-PITCH-SCRIPTS.md` is the right response and worth memorizing: Notion is not machine-enforceable; BlockSmith feeds MCP and pull, so agents read pinned blocks rather than an exported page. But note the honest weakness underneath: replacing a Notion page is a *tolerated* pain, not a sharp one (see the pain hierarchy in [Chapter 05](./05-who-we-sell-to.md)). We should never lead with "better than Notion." We lead with enforcement and let Notion replacement be a side effect.

### 2.7 v0, Lovable, bolt.new (prompt to UI)

**What they do.** Turn a prompt into a working UI, often a full app scaffold, in one shot.

**Who buys them.** Founders, PMs, designers who code a little, and engineers prototyping. Enormous top-of-funnel, self-serve, credit-card purchase.

**What they are genuinely good at.** The zero-to-something moment. They are extremely good demos and genuinely useful for greenfield. They have solved distribution in a way we have not.

**Where they stop.** They generate from a prompt, which means the output is stylistically arbitrary and off-brand by default. The `product-direction` memory states the differentiator precisely: they generate UI from a prompt (random, off-brand); BlockSmith generates from a governed design system, so the output is provably on-brand and consistent. They also have no second act. Once the generated code enters a real repository, the generator has no further relationship with it, and no way to tell you it drifted.

**Precisely why that is our opening.** We are not in the generation race and should stop acting like we might be. Our generation surfaces (`POST /api/ai/governed-generate`, `src/components/demo/GovernedAiShowcase.tsx`, and `blocksmith codegen` via `POST /api/v1/codegen/pulse`) exist to *prove the governance claim*, not to compete on generation quality. The demo that matters is governed output next to ungoverned output from the same prompt, scored by the same engine. That is a comparison we win. A raw generation-quality comparison against v0 is one we lose, and we should never set one up.

**Status:** `blocksmith codegen` and the Pulse runtime are **Partial**. `docs/CUSTOMER-PITCH-SCRIPTS.md` marks Pulse as v0 and says explicitly not to promise an enterprise npm SLA. Repeat that limitation out loud in demos; it buys credibility for the claims that are solid.

### 2.8 Chromatic and Percy (visual regression)

**What they do.** Screenshot every component or page on every commit, diff against a baseline, and require a human to approve visual changes before merge.

**Who buys them.** Frontend and QA leads, on an engineering budget, per snapshot or per seat. Chromatic sits on top of Storybook.

**What they are genuinely good at.** This is the closest existing thing to "design CI/CD" and the comparison a technical buyer will make. They have solved the hard parts: CI integration, a review UI, baselines, flake management, and a business model that works. Anyone claiming a CI-for-design category has to explain themselves relative to Chromatic.

**Where they stop.** They diff **pixels against the previous commit**, not **implementation against the design system's rules**. Chromatic tells you "this component looks different than it did yesterday." It cannot tell you "this hex is not in your palette," "this component violates the usage rule your design lead wrote," or "your Figma library moved and your code did not." Its baseline is history; ours is intent. And approval in Chromatic is per-diff and disposable; there is no durable, versioned, pinnable artifact that other systems (agents, other repos, other targets) can consume afterward.

**Precisely why that is our opening.** The distinction to state in one line: *Chromatic catches unintended change; BlockSmith catches unapproved change.* They are complementary, and a team can run both. In fact the healthiest positioning is "we sit next to Chromatic in your pipeline," because it teaches the buyer where we go without asking them to displace anything.

The honest risk: Chromatic is the incumbent most naturally positioned to add token linting and design-system rule checks, since they already own the CI integration and the review UI. Adding a rules engine is a smaller leap for them than adding CI is for Zeroheight.

### 2.9 Cursor Rules, `CLAUDE.md`, `AGENTS.md`, and the "just write a bigger design.md" baseline

This is the real competitor. Every other entry on this page is a company; this one is a habit, it is free, it is already installed, and it is what our prospects are doing on the day we call them.

**What it does.** A markdown file in the repo that the agent reads. It costs nothing, requires no vendor, no account, and no meeting.

**Who "buys" it.** Everyone in our ICP. By definition: our ICP is defined as teams that keep a `DESIGN.md`.

**What it is genuinely good at.** Zero friction, total control, no dependency, and it works well enough at small scale. For a five-person team with one product, a 200-line `DESIGN.md` is genuinely a good solution and we should say so rather than pretending otherwise.

**Where it stops.** Four failure modes, all of which show up as the team grows and all of which are documented in `docs/01-vision-and-positioning.md`:

1. **It grows.** Files become huge, duplicated, and stale. Nobody audits a 500-line markdown file weekly.
2. **It is advisory only.** The agent reads it and complies approximately. Nothing fails when it does not comply. There is no exit code.
3. **It has no version and no approval.** Anyone who can commit can change the design system's rules, silently. There is no staging, no promote, no rollback, no record of who decided what.
4. **It is one-way.** It does not know what shipped. It cannot compare itself against the code or against Figma.

**Precisely why that is our opening.** Our claim is not "delete your `DESIGN.md`." It is "stop hand-maintaining it." `blocksmith pull` writes the file from a promoted, versioned source (`packages/cli/src/pull.ts`, `POST /api/v1/scans/pull`); MCP serves the pinned version to the agent (`src/lib/mcp/blocksmith-server.ts`, `/api/mcp`); and `blocksmith check` gives the file an exit code it never had (`packages/cli/src/check.ts`).

**Do not underestimate this baseline.** In a competitive loss post-mortem, the most likely answer to "who did we lose to" is "nobody, they kept their markdown file." The way we beat a habit is not with a feature comparison. It is by making the first five minutes produce something the markdown file cannot: a drift report showing a real mismatch in their real repo.

### 2.10 ESLint, Stylelint, and design-token lint plugins

Worth naming because a technical buyer will name it. Stylelint plus a custom rule can already fail a build on an off-token hex. This is Tier 1, for free, today.

**Where they stop.** The rule set is hand-written and hand-maintained, disconnected from any design source, has no notion of an approved version, and covers exactly one tier. Nobody writes a Stylelint rule that knows a designer changed the palette in Figma last week.

**Our opening.** We generate the rules from the promoted design system and we keep them current. The pitch to this objection is: "you can absolutely write that rule, and then you own it forever, and it will be wrong the first time the palette changes." That is a fair, honest answer and it lands.

### 2.11 The rest of the adjacent map

`docs/02-competitive-landscape.md` catalogues several more that are worth one line each so nobody rediscovers them:

| Tool | Category | Why they are not really a competitor |
|------|----------|--------------------------------------|
| **Gamma** | AI deck and doc rendering | One-shot beautification, no continuous sync from a repo, no IDE relationship |
| **Scribe** | Workflow documentation | Different input entirely: user actions, not code plus design files |
| **DocuWriter.ai** and similar AI code-doc tools | Repo-wide technical docs | Aimed at APIs, Swagger, and tests. Design tokens and usage rules are not first-class |
| **Context.dev-style `design.md` generators** | Agent context generation | The mirror image of us: they end where we begin. Their output is our input. If this category consolidates, we buy or integrate rather than fight |

### 2.12 The map in one table

| Player | Authors intent | Reads shipped code | Human approval gate | Machine enforcement | Serves agents | Drift: design vs code |
|--------|:--------------:|:------------------:|:-------------------:|:-------------------:|:-------------:|:---------------------:|
| Figma + Dev Mode + MCP | Yes | No | No | No | Yes | No |
| Tokens Studio | Partial | No | No | No | No | No |
| Style Dictionary | No | No | No | No | No | No |
| Storybook | No | Yes | No | No | No | No |
| Zeroheight / Supernova / Knapsack | Partial | Partial | Partial (docs versioning) | No | No | No |
| Notion / GitBook | No | No | No | No | No | No |
| v0 / Lovable / bolt | No | No | No | No | No | No |
| Chromatic / Percy | No | Yes (pixels) | Yes (per diff) | Yes (CI) | No | No |
| `DESIGN.md` by hand | No | No | No | No | Yes (weakly) | No |
| **BlockSmith** | No | Yes | Yes | Yes | Yes | Yes |

The last two columns are the whole company. The first column being "No" is deliberate and permanent: we are not building a canvas.

---

## 3. The commodity line

### 3.1 The statement

**Token extraction is a commodity. Everything downstream of `design.md` is where value can accrue.**

This is written down in the `figma-fit-wedge` memory as the founding reason we chose this wedge, and it should be treated as a standing assumption that governs roadmap decisions.

### 3.2 What is commodity, precisely

| Capability | Why it is commodity |
|------------|---------------------|
| Reading Figma variables or styles into tokens | Figma's own REST API and MCP do it. Tokens Studio does it better. A competent engineer builds a working version in a weekend |
| Converting tokens to CSS variables, iOS, Android, C headers | Style Dictionary has done this for free for years, with a plugin ecosystem |
| Scanning a repo for hex codes and CSS custom properties | Regex and an AST walk. `src/lib/scan/` is real engineering, but it is not a barrier |
| Rendering markdown as a documentation site | Every static site generator, plus Zeroheight, GitBook, Notion, and Docusaurus |
| Generating a component from a prompt | v0, Lovable, bolt, Figma Make, and every frontier model directly |
| Publishing an MCP server | The protocol is designed to make this easy. That is the point of it |

If we are ever describing ourselves by a capability in that table, we are describing a commodity. This is why "we import your Figma tokens" is a bad opening line even though it is the first thing the product does.

### 3.3 What is defensible, and why

Everything that requires **a durable record of human decisions over time**, plus **both sides of a comparison**, plus **a place in the developer's blocking path**.

| Capability | Why it can be defensible | Where it lives |
|------------|--------------------------|----------------|
| **Promotion and the lock** | Requires an accumulating history of who approved what, when. That history is customer-specific and cannot be re-derived by a competitor from public inputs | `POST /api/wiki/promote`, `POST /api/wiki/pin-lock`, `POST /api/wiki/rollback`, `packages/protocol/schemas/blocksmith.lock.v1.json` |
| **Drift detection** | Needs both Figma and the repo normalized into the same representation. Figma has one side. The repo has the other. Only a neutral third party naturally has both | `src/lib/figma/drift.ts`, `src/lib/figma/component-drift.ts`, `POST /api/figma/drift` |
| **Tiered enforcement in the blocking path** | Requires a CLI in the pre-commit hook and a job in CI. Getting into the blocking path is an organizational win, not a technical one, and it is sticky once earned | `packages/cli/src/check.ts`, `packages/cli/src/setup-hooks.ts`, `examples/github/blocksmith-governance.yml` |
| **The violation and deviation record** | Every captured Tier-2 warning, every override reason, every deviation with a TTL, accumulates into a picture of the team's real behavior that exists nowhere else | `POST /api/v1/governance/events`, `supabase/schema-governance-events.sql`, `src/app/api/v1/deviations/`, `src/lib/cloud/deviations.ts`, `docs/GOAL4-DEVIATION-TTL.md` |
| **The governed prose layer** | Component roles, usage rules, and do/don't are written by humans and are pure customer IP that no scan or import can regenerate | `POST /api/wiki/finalize`, `src/lib/scan/overrides.ts`, `.blocksmith/wiki-overrides.json` |

The pattern across all five: **defensibility comes from being the place decisions are recorded, not from being the place data is transformed.** Transformation is a function; decisions are a database.

### 3.4 The uncomfortable corollary

The commodity line cuts our own roadmap. Compile targets (device profile, C header, LVGL) sit on the commodity side of the line. They are marvelous demo material and they support the category story, but they are not a moat and they should never displace work on promotion, drift, or enforcement. `docs/PUBLIC-RELEASE-SPRINT.md` already puts new compile targets under "explicitly out of scope," which is correct and should stay correct until the governance loop is producing revenue.

---

## 4. Moat analysis

This section is deliberately skeptical. If you are reading it before an investor meeting, do not read it out loud, but do not lie about it either.

### 4.1 The four candidate moats

**(a) Data.** Does our data compound?

Partly. Governance events, deviation history, override reasons, and promotion history accumulate per customer and get more valuable over time, because "this rule has been overridden eleven times, promote it to Tier 1" is a suggestion only we can make. `docs/GOVERNANCE-TIERS.md` describes exactly this escalation signal.

But there is no *cross-customer* network effect. Acme's violation history does not make Globex's product better. Absent that, this is a switching-cost moat wearing a data costume, and it only starts working after a customer has been live for months.

**Honest verdict: real but slow, and single-tenant.**

**(b) Workflow lock-in.** Do we become load-bearing?

This is our strongest candidate. Once `blocksmith check` runs in a pre-push hook and a CI job, removing us breaks builds and requires a decision by someone senior. Once agents read design context from `/api/mcp`, removing us degrades the output of every AI-assisted UI change. Once `blocksmith pull` writes `DESIGN.md`, the file is generated rather than authored and reverting means someone has to start hand-maintaining it again.

The catch, and it is significant: **none of this exists at a paying customer today.** Lock-in that has not been installed anywhere is a hypothesis. Also note the safety valve we deliberately built in: `blocksmith check` fails **open** on network or CLI errors, so a flaky connection never bricks a push. That is correct product design and it also means we are, by construction, easy to ignore.

**Honest verdict: the best candidate, entirely unproven.**

**(c) Protocol adoption.** Does `blocksmith.blocks.v1` become a standard?

`packages/protocol` is real: JSON schemas for blocks, lock, registry, and compile targets; a conformance runner (`npm run protocol:conformance`); a public documentation site at `src/app/protocol/`; and MIT licensing per `LICENSING.md` precisely so it can be freely adopted. `LICENSING.md` states the theory plainly: the moat is a standard, not a secret.

The skeptical read: a protocol with one implementation is a file format. Standards emerge when a second party independently implements them because it is in their interest, and we have zero external implementers. `docs/PUBLIC-RELEASE-SPRINT.md` even puts publishing `@blocksmith/protocol` to npm out of scope. The protocol is currently a credibility artifact for investor and academic conversations, and that is a legitimate use, but calling it a moat today is not honest.

**Honest verdict: aspirational. Zero adoption. Do not count it.**

**(d) Switching cost.** What is painful to leave behind?

The governed prose layer: component roles, usage rules, do/don't, and rationale that a human wrote. That is genuine customer IP living in our system. It is real switching cost, and we have partly given it away by design: `blocksmith pull` writes it into their repo as `DESIGN.md` and `.blocksmith/wiki-overrides.json`, and `GET /api/wiki/export` exports it.

That is the right call. A governance tool that holds your rules hostage does not get installed in the first place. It means our switching cost has to come from the *loop*, not the *data*.

**Honest verdict: modest, and intentionally capped.**

### 4.2 The honest summary

> **Today the moat is thin.** What we actually have is a head start on an unowned workflow, a working end-to-end loop that nobody else has assembled, and taste. Every structural moat we can name is either unproven (workflow lock-in), single-tenant and slow (data), or aspirational (protocol).

`docs/02-competitive-landscape.md` reached the same conclusion in fewer words: the moat is weak until usage, and shipping and demos matter more than patents. That was written when this was a side project and it remains true.

### 4.3 What we do about it

Ranked by leverage:

1. **Get into the blocking path fast.** The single most valuable thing an early customer can do is add `blocksmith check` to CI. Optimize onboarding for that step above everything else, including the wiki. A wiki visit is a habit; a CI job is a dependency.
2. **Accumulate governance history.** Every Tier-2 capture and every deviation with a reason is a brick. Make capture the default and make the wiki's violation feed something a lead opens weekly.
3. **Own the drift comparison.** Drift needs both sides. Build the Figma connection into a persistent one (`POST /api/figma/webhook` exists) so the comparison is continuous rather than on demand. Continuous drift is a reason to keep an account open; on-demand drift is a one-time report.
4. **Ship the open client.** Do the `LICENSING.md` rollout work: extract `src/lib/figma`, `src/lib/mcp`, `src/lib/scan` parsers, and `color-lint.ts` into `packages/*` so the open tree compiles on its own, then publish. Adoption of the client is the only path to the protocol becoming real, and it also removes the "we will not put a closed binary in our pre-commit hook" objection, which is a genuine objection.
5. **Do not chase generation quality.** It is a commodity race against better-funded companies with better distribution, and losing it costs us the positioning that actually differentiates us.

---

## 5. Threat model

### 5.1 Figma ships drift detection

**Likelihood: moderate to high over three years.** They have the design side, they have an MCP server, they have every incentive to extend Dev Mode toward "is your code still matching?", and they have already shown appetite for the code side with Dev Mode and Figma Make.

**What it would kill.** Our headline demo. "Figma says X, code says Y" stops being remarkable the day Figma says it themselves, and they would say it inside the tool the designer already has open.

**What it would not kill.** Three things, and they are the durable three:

1. **Figma will compare against Figma.** Their drift story is "your code does not match your Figma file." Ours is "your code does not match what a human *approved*," which may differ from the current Figma file on purpose, because designers explore. The promotion gate is the difference between a diff and a decision.
2. **Figma has no blocking path.** They are not going to ship a CLI that lives in your pre-commit hook and returns exit code 1. That is a developer-tool motion, a different buyer, and a support burden they have no reason to take on.
3. **Figma is one input.** A meaningful share of teams have no usable variables at all (which is why `figmaDesignContextToTokens()` exists), and plenty of design systems are code-first with Figma trailing. Our scan path (`src/lib/scan/`) does not require Figma to exist.

**Our actual response.** Deepen the two things Figma structurally will not do: enforcement in CI, and approval as a first-class versioned object. Reposition the Figma connector from "the wow" to "one of several inputs." And if Figma ships this, say so publicly first and frame it as validation of the category, because a Figma feature launch is the largest free market-education event we will ever get.

### 5.2 Cursor, Claude Code, or a model provider ships a native design-governance layer

**Likelihood: moderate. Timeline: unpredictable, and it could be a single release note.** These platforms are expanding aggressively into repo context, rules, and hooks. A "design rules" primitive is a plausible feature.

**What it would kill.** The advisory tier outright. Tier 3 (`check_governance_diff`, agent-time guidance) is the most easily absorbed thing we have built, because it is fundamentally "put better context in front of the model," which is precisely these platforms' core competency.

**What it would not kill.**

1. **They will not build the human approval UI.** A promote-and-rollback console for a design lead who does not use an IDE is not a coding-agent company's product. `docs/CUSTOMER-PITCH-SCRIPTS.md` Script B exists because that person is a real buyer with real authority, and they will never open Cursor.
2. **They are per-developer and per-repo.** Governance is per-organization and spans repos, agents, humans, and CI. A rules file scoped to one developer's editor cannot be the org's system of record.
3. **They are agent-only.** Roughly half of design drift is still written by a human typing a hex code. Enforcement has to sit in CI, which is agent-agnostic.
4. **They compete with each other.** Cursor's design rules will not serve Claude Code, and neither will serve the CI job. A neutral layer that all of them read is more valuable the more of them exist, and MCP is exactly the mechanism for being that neutral layer.

**Our actual response.** Be a first-class MCP citizen rather than a competitor to the agent platforms: list on every MCP directory, keep `/api/mcp` clean, and make `blocksmith setup cursor` (`packages/cli/src/cursor-setup.ts`) a ten-second install. If the platforms ship a native rules primitive, we emit *into* it rather than replacing it, the same way we emit `DESIGN.md` today. Our value moves up a layer: we become the thing that decides what goes into the rules file, and the thing that checks whether the result complied.

The strategic principle worth internalizing: **be the source of the rules, not the transport of the rules.** Transport gets absorbed by platforms. Sources do not.

### 5.3 A documentation platform moves downstream

**Likelihood: moderate.** Supernova or Knapsack ships a CLI with a blocking check.

**Why it is survivable.** Their center of gravity is the design org and their revenue is documentation subscriptions. Shipping a CLI into engineering's pre-commit hook demands a developer-tool support posture, developer-tool docs, and a champion in engineering, none of which their motion currently produces. They can build the feature faster than they can build the credibility.

**Our actual response.** Get into engineering repos first and be default-open on the client side per `LICENSING.md`. Openness is exactly the asymmetry a closed enterprise vendor cannot easily match, because their business model depends on the client being part of the paid product.

### 5.4 Tokens Studio moves downstream

**Likelihood: moderate.** They own the token model and have real Git sync, which is most of the plumbing needed for a drift check.

**Our actual response.** Integrate, do not fight. Import their token sets as an input alongside Figma and the repo scan. A team using Tokens Studio and BlockSmith together is a better outcome for us than trying to displace the tool their designer likes.

### 5.5 The models get good enough that governance stops mattering

**Likelihood: low as stated, but a real risk in a weaker form.** Models will get better at following a design system given good context. They will not solve the problem that *the team never agreed what the design system is*, or that *no human approved the change*, or that *Figma and the repo disagree*. Governance is an organizational problem with a software surface, not a model-capability problem.

The weaker form is genuinely dangerous, though: if models get good enough that a well-written `DESIGN.md` produces 95% compliance, the marginal value of our enforcement tiers shrinks and the "just write a bigger design.md" baseline in 2.9 gets stronger. Our hedge is that as agents write more of the UI, the *volume* of changes a human must review grows faster than compliance improves. Higher throughput with high-but-imperfect compliance still produces more absolute drift than low throughput did. That is the bet, and it is a bet.

### 5.6 Someone clones us

**Likelihood: low today, rising with our visibility.** The whole loop is described in public docs and the client will be MIT.

**Why it is survivable.** Cloning the code is a few months of work. Cloning the accumulated governance history of a live customer is impossible, and cloning a position in someone's CI pipeline requires displacing an incumbent, which we would by then be. The BSL on the hosted app (`LICENSE`, converting to Apache-2.0 on 2030-06-23) with an Additional Use Grant that forbids offering BlockSmith as a competing hosted service is the specific defense against the largest and most likely cloner: a bigger player simply reselling our server.

---

## 6. Timing: why now

### 6.1 Why not two years ago

Four preconditions did not exist:

1. **`DESIGN.md` was not a habit.** Our ICP is defined as "teams that keep a design context file." Two years ago that population was tiny. Today it is standard practice at any team running Cursor or Claude Code, and `AGENTS.md`-style conventions have made it near-universal. The wedge requires the habit to already exist, because we are not selling a new behavior, we are selling a fix for an existing one.
2. **MCP did not exist.** Before a standard protocol for serving context to agents, "the agent reads our governed design system" required a bespoke integration per tool. `src/lib/mcp/blocksmith-server.ts` and `/api/mcp` are only possible because a standard emerged. Without MCP, our agent surface would be a per-vendor slog.
3. **Agents were not writing enough UI to create drift at scale.** The pain is proportional to change volume. Two years ago a human wrote every component and the drift rate was human-paced. The whole thesis in `docs/01-vision-and-positioning.md` is that agent-authored context and agent-authored code grow faster than human oversight, and that gap is new.
4. **Design tokens were not standardized enough to lint against.** Widespread CSS custom properties, Tailwind theme configs, and Figma variables gave us something machine-checkable to compare against. `src/lib/scan/tokens.ts`, `src/lib/scan/css-rules.ts`, and `src/lib/scan/tailwind-classes.ts` all depend on conventions that only recently became normal.

### 6.2 Why not two years from now

Three windows are closing:

1. **The category slot gets claimed.** "Design CI/CD" is currently unoccupied, which is why we can claim it. Categories are claimed once. If Chromatic extends into rules, or a documentation platform ships enforcement, we spend our marketing budget explaining our difference instead of defining the space.
2. **The blocking path gets crowded.** Pre-commit hooks and CI jobs are scarce real estate with a real political cost per addition. Nobody adds a fourth blocking check happily. Whoever gets the design-governance slot first tends to keep it, because the second entrant has to justify displacement rather than addition.
3. **Platform absorption.** As noted in 5.2, the advisory layer is absorbable by agent platforms at any time. The window to establish that governance lives at the org level, not the editor level, is open now and narrows as those platforms mature their own primitives.

### 6.3 The honest counter-argument to "now"

State it plainly, because a good investor will: the pain is real but it is **not yet acute for most teams**. Most design systems drift and most teams tolerate it, which is why it drifted in the first place. We are early relative to the pain curve, which is the right place to be for a category-defining product and the wrong place to be for quick revenue. The practical consequence is that our first ten customers will be sold on a *demonstrated* drift in their own repository, not on a description of a problem. See [Chapter 05](./05-who-we-sell-to.md), section on the first ten customers.

---

## Open questions

1. **Do we lead with the wiki or with `blocksmith check`?** The wiki is the emotional hook and gets the design lead excited; the check is the lock-in and lands with engineering. The public release sprint optimizes the wiki loop, which may be optimizing the wrong first five minutes for durability. Unresolved.
2. **Is "design CI/CD" a category anyone will search for?** It is a metaphor, not a term of art. Metaphor categories require education spend we do not have. Should we instead borrow an existing search term (for example "design system linting") for acquisition while using design CI/CD for positioning?
3. **How do we price against a free habit?** Our real competitor (2.9) costs zero. Every pricing hypothesis in [Chapter 05](./05-who-we-sell-to.md) is measured against a zero-cost incumbent that is already installed.
4. **Should we integrate with Tokens Studio and Storybook before we are stable?** Both would strengthen the wedge and both are currently out of scope. The cost is scope creep during a reliability sprint. Timing unresolved.
5. **When do we publish `@blocksmith/protocol`?** The protocol moat requires adoption and adoption requires publishing, but `docs/PUBLIC-RELEASE-SPRINT.md` explicitly defers it. What is the trigger condition?
6. **What is our answer if Figma ships drift in the next six months?** Section 5.1 gives a response. It has never been pressure-tested against a customer who has already seen Figma's version.
7. **Is the embedded and device-profile story helping or hurting?** It is compelling to investors and to OEM conversations, and it is a distraction from a governance product with no paying customers. `docs/CUSTOMER-PITCH-SCRIPTS.md` Script F handles it honestly. Should it exist at all right now?
8. **Do we have a single verified competitive loss?** No. Every claim in this chapter is reasoned from product surface area, not from a lost deal. Treat the whole map as a hypothesis until a real prospect chooses someone else and tells us why.

---

## Where to look in the code

**Positioning and pitch source documents**

| Path | What it holds |
|------|---------------|
| `docs/02-competitive-landscape.md` | The original category map. Some entries are stale; this chapter supersedes it |
| `docs/PITCH-AND-PRODUCT-MODEL.md` | The wiki-plus-infrastructure framing, messaging ladder, and what not to claim |
| `docs/01-vision-and-positioning.md` | The origin story and the human-versus-agent framing |
| `docs/PUBLIC-RELEASE-SPRINT.md` | The current customer sentence and the customer-UI language rules |
| `docs/CUSTOMER-PITCH-SCRIPTS.md` | Objection handling and the honest-limits list |
| `docs/GOVERNANCE-TIERS.md` | The three-tier enforcement model that is the core differentiator |
| `LICENSING.md`, `LICENSE` (BSL 1.1), `LICENSE-MIT` | The open-core boundary and the anti-reseller defense |

**The differentiated surfaces**

| Path | Why it matters competitively |
|------|------------------------------|
| `src/lib/figma/drift.ts`, `src/lib/figma/component-drift.ts` | "Figma says X, code says Y." The comparison nobody else can make from one side |
| `src/lib/figma/rest.ts`, `src/lib/figma/adapter.ts` | Token recovery that works on non-Enterprise Figma plans and on files with no variables |
| `src/lib/governance/color-lint.ts` | Tier 1. Exact, not heuristic. The thing that fails a build |
| `src/lib/governance/prose-lint.ts` | Tier 2. Heuristic warn-and-capture |
| `src/lib/governance/check-diff.ts` | Tier 3. Agent-time advisory |
| `packages/cli/src/check.ts`, `packages/cli/src/setup-hooks.ts` | The blocking path: pre-commit, pre-push, CI |
| `examples/github/blocksmith-governance.yml` | The CI job template. This file is the lock-in |
| `src/app/api/wiki/promote/route.ts`, `pin-lock/route.ts`, `rollback/route.ts` | Approval as a first-class versioned object |
| `src/lib/mcp/blocksmith-server.ts`, `src/app/api/mcp/route.ts` | The agent surface and its tool list |
| `src/app/api/v1/governance/events/route.ts`, `supabase/schema-governance-events.sql` | The accumulating record that is our slow-building data asset |
| `src/app/api/v1/deviations/` , `src/lib/cloud/deviations.ts` | Deviation TTL and budget. See `docs/GOAL4-DEVIATION-TTL.md` |

**The commodity surfaces (useful, not defensible)**

| Path | Note |
|------|------|
| `src/lib/scan/` | Repo scanning. Real engineering, replicable |
| `packages/protocol/` | Schemas, conformance runner, fixtures. Credibility artifact; zero external adopters |
| `src/app/protocol/` | The public protocol site |
| `packages/pulse-runtime`, `src/app/api/v1/codegen/pulse/route.ts` | Codegen. v0, and on the commodity side of the line |
| `src/app/api/ai/governed-generate/route.ts`, `src/components/demo/GovernedAiShowcase.tsx` | Governed-versus-ungoverned generation. A proof device, not a generation product |

**Verification**

```bash
npm run verify:figma-import      # 49 checks on import, drift, and the REST connector
npm run verify:governance-tiers  # the three-tier model
npm run verify:governance-e2e    # end-to-end governance loop
npm run protocol:conformance     # schema + drift conformance for packages/protocol
npm run verify:software          # the full local product check
```
