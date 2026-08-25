# Who We Sell To And How We Reach Them

**What this chapter covers.** A full portrait of the person we are building for, the other people in the room, who actually signs, an honest ranking of the pains we address, the wedge and the land-and-expand path mapped step by step to the code that delivers it, every distribution channel we have with a candid assessment of each, the three canonical pitch lengths with the demo each one requires, the state of pricing and packaging (which is: nothing exists in code), and a concrete plan for the first ten customers.

**Why it matters.** Every engineering decision in this repo implicitly bets on a customer. The wiki bets on a design lead who wants to browse. The CLI bets on an engineer who lives in a terminal. The MCP server bets on an agent-heavy team. Those are three different people and we have built for all three, which is why onboarding is confusing and why `docs/CUSTOMER-PITCH-SCRIPTS.md` needs three separate scripts. This chapter says which one is primary and what follows from that.

**Read this if** you are writing onboarding copy, prioritizing a feature, preparing a demo, deciding what to charge, or about to send a cold message to a stranger. Read it with [Chapter 04](./04-market-and-competition.md), which establishes the category and the competitive stopping points this chapter sells against.

---

## 1. The primary ICP

### 1.1 The one-line definition

From `docs/01-vision-and-positioning.md`, and this has been stable since the beginning:

> **Design systems lead or design engineering lead at a product team that has adopted Cursor or Claude Code and keeps a `DESIGN.md`.**

Every clause is load-bearing. Drop "design systems lead" and you get a frontend engineer who does not own the rules. Drop "has adopted Cursor or Claude Code" and the agent half of the pitch is noise. Drop "keeps a `DESIGN.md`" and you are selling the behavior, not the fix, which is a much harder sale.

### 1.2 The portrait

**Title.** Design Systems Lead, Design Engineer, Design Technologist, Staff Frontend Engineer (Design Systems), or occasionally Head of Design Engineering. Sometimes the title is nothing special and the person is simply the one who cares.

**Company shape.** 50 to 500 people. Product company, not agency. One to four product surfaces sharing a component library. Below 50 people, the design system is one person's head and a `DESIGN.md`, and they will not buy a governance tool because there is nothing to govern between people. Above 500, there is a formal design-ops function, an enterprise procurement process, and probably a Zeroheight or Supernova contract, and we are too immature to displace it.

**Team size.** They lead between one and six people. Frequently zero: they are a team of one with a mandate, which is the single most common shape in this ICP and it matters enormously. A team of one has no capacity for a tool that requires operation. Anything that needs weekly babysitting loses to the status quo.

**Reporting line.** Usually into Engineering (a Director of Frontend or VP Eng), sometimes into Design. Which one it is changes the budget answer entirely; see section 3.

**Tooling they already have.** Figma (certain). A component library in React with Tailwind or CSS-in-JS (very likely). Storybook (likely). A `DESIGN.md`, `CLAUDE.md`, or `AGENTS.md` in the repo (definitional). Cursor or Claude Code (definitional). Notion or Confluence with a design-system page that is nine months stale (very likely). Possibly Tokens Studio. Possibly Chromatic.

### 1.3 What their week actually looks like

This is the part that determines whether a feature gets used.

- **Monday.** Review PRs from product engineers who used the component library incorrectly. Leave the same comment they left last month. Approve anyway because the sprint ends Thursday.
- **Tuesday.** A designer asks whether the new spacing scale is "in code yet." The honest answer is "partially, in two of four surfaces." They spend forty minutes finding out which two.
- **Wednesday.** Someone in Slack: "which doc is current?" They paste a link. It is the third link they have pasted this month, and all three were different.
- **Thursday.** They open the component library repo to add a variant and find three off-token hex codes that arrived without a PR comment. Two were written by a coding agent. They fix them silently because raising it feels like policing.
- **Friday.** They update `DESIGN.md`. Nobody reads it. They know nobody reads it. They update it anyway because the agents do read it, and that is now the main reason the file exists.

Two things fall out of that week. First, **they are already the enforcement mechanism, and it is manual and social.** We are not introducing enforcement; we are automating a thing they are doing with their own attention. Second, **their scarce resource is attention, not money.** A tool that adds a review queue they must staff is a tool they will abandon in three weeks. This is why Tier 2 defaults to allow-with-capture in `docs/GOVERNANCE-TIERS.md`: drift is recorded so the lead can see it, without blocking the team and without requiring the lead to be online.

### 1.4 What they are measured on

Rarely anything crisp, which is a problem for our ROI story. In practice:

| Measure | How it shows up | Our relevance |
|---------|-----------------|---------------|
| Adoption of the design system | "What percentage of surfaces use library components?" | High. Drift reports are an adoption metric they do not currently have |
| Consistency and UI quality | Complaints from design leadership, screenshots in Slack | High, but subjective and hard to attribute |
| Velocity of the product teams they support | "Are you unblocking teams or slowing them down?" | Two-edged. A blocking gate cuts against this, which is exactly why Tier 1 is narrow and machine-verifiable |
| Successful migrations | "We moved everyone to v3 of the button" | High. A migration is the sharpest moment of pain and our best entry point |
| Accessibility compliance | Audit findings | We touch it via governance prose. Not a strength today |

**The most useful thing to know:** they are measured on outcomes they cannot currently measure. Nobody at their company can answer "how much of our UI is on-system?" with a number. A drift report that produces a number is politically valuable to them beyond its technical value, because it turns their subjective job into a reportable one. Do not underrate this. It is often the real reason a champion pushes a tool through.

### 1.5 What they complain about, in their own words

Collected from the framing in `docs/01-vision-and-positioning.md`, `docs/PITCH-AND-PRODUCT-MODEL.md`, and `docs/CUSTOMER-PITCH-SCRIPTS.md`:

- "Nobody knows which doc is current."
- "Cursor keeps inventing button variants that do not exist."
- "Design truth is split across Figma, Notion, and the repo, and all three disagree."
- "I write the rules and nobody follows them, and I only find out in code review."
- "Our `DESIGN.md` is 500 lines and I am the only person who has read it this quarter."
- "Design says the palette changed. It changed in Figma. It did not change in code and nobody told me."

Note what is absent from that list: nobody says "I wish I had a design CI/CD pipeline." The category name is ours, not theirs. Our copy has to start from their sentence and arrive at ours.

### 1.6 What budget they control

Usually **none directly**. This is the hardest fact in this chapter and it drives section 3.

Typical authority: they can expense a tool up to a few hundred dollars a month without asking, or they can put a request into their manager's budget with a short justification. They cannot sign a $30,000 annual contract. They can absolutely install a free CLI, add a GitHub Action, and connect an MCP server without asking anyone, and that is the entire reason our wedge is free and self-serve.

---

## 2. Secondary personas

### 2.1 The PM or founder who needs to see the UX rules

Named as the secondary persona in `docs/01-vision-and-positioning.md`: someone who needs to **see** UX rules without reading agent context files.

**Who they are.** A product manager, a design-minded founder, or a design director who does not open the repo. At small companies this is frequently the same person who signs.

**What they want.** To look at one page and understand what the product's design rules are. To see, in a browser, that a decision they made is reflected in what the team is building. They will not run a CLI, will not open Cursor, and will bounce off anything that shows them a JSON schema.

**What we give them.** The wiki: Foundation, Styles, components, guidelines, plus the Pipeline view showing staging versus production. `docs/CUSTOMER-PITCH-SCRIPTS.md` Script A and Script B are written for this surface and explicitly instruct the presenter not to put GitHub on screen.

**Their strategic value.** They are the persona most likely to have budget authority and least likely to use the product weekly. That combination makes them the classic **economic buyer with low usage**, which is a risk: tools bought by a non-user churn at renewal. Our defense is that the primary ICP's usage is what renews the account, so the PM should be the co-signer, not the sole champion.

**The trap.** It is tempting to build for this persona because their feedback is enthusiastic and the surface is fun to build (visual, rendered, demo-friendly). `docs/01-vision-and-positioning.md` lists "treating taste as polish" and "building MCP before a wiki humans want to open" among the mistakes to avoid, and both are real. But the inverse mistake is equally real: building wiki polish while the CI gate that creates lock-in stays unpolished. See Open Question 1 in [Chapter 04](./04-market-and-competition.md).

### 2.2 The platform or frontend engineer who owns the component library

**Who they are.** Staff or senior frontend engineer, owns `packages/ui` or the equivalent, reviews every PR that touches it, and maintains the build. Often the design-systems lead's closest collaborator, and at smaller companies, the same person.

**What they want.** Fewer PR comments. A deterministic answer to "is this correct?" that does not require their judgment. Not to be the bottleneck.

**What they care about that nobody else does.**

- **Does it run in CI, and how long does it take?** They will look at `examples/github/blocksmith-governance.yml` before they look at the wiki.
- **What happens when it fails or the network is down?** This is why `blocksmith check` fails **open** on network or CLI errors, documented in `docs/GOVERNANCE-TIERS.md`. Say this in the first two minutes of any engineering conversation. It converts skepticism into interest faster than any feature.
- **What is the exit code contract?** `0` clean or warn-captured, `1` blocking (or `--strict` warn without `--reason`), `2` misconfiguration. Precise exit codes signal that we understand their world.
- **Is it open source?** They will not put a closed binary in a pre-commit hook at a company with a security review. `LICENSING.md` puts `packages/cli`, `packages/sdk`, and `packages/protocol` under MIT for exactly this reason. Note honestly that the extraction work is incomplete: `src/lib/figma`, `src/lib/mcp`, and the `src/lib/scan` parsers are marked "intended open, extraction pending."

**Their strategic value.** They are the **technical gatekeeper**. They cannot buy, but they can kill. Every deal dies here if it dies. Treat their objections as the highest-priority feedback we receive.

### 2.3 Everyone else in the room

| Persona | Role in the deal | What they need |
|---------|-----------------|----------------|
| The designer who works in Figma | Contributes intent, occasionally alarmed by the drift report | To not be blamed by it. Frame drift as a system fact, never as an accusation |
| The VP Engineering | Often the actual signer at 100-plus people | A one-line reason this reduces risk or review load. Nothing else |
| Security and legal | Blocker at 200-plus people | SOC 2, data handling, and what leaves the network. We have none of this. Treat any deal requiring it as out of scope today |
| The solo full-stack builder | Not an enterprise persona at all, but a real early user | The whole loop in one person. `docs/CUSTOMER-PITCH-SCRIPTS.md` Script C is written for exactly this and it is the easiest demo to run |

---

## 3. Buyer versus user, and who signs

### 3.1 The split

| | User | Champion | Technical gatekeeper | Economic buyer |
|--|------|----------|---------------------|----------------|
| **Who** | Design-systems lead, plus every engineer whose commits pass through the check | Design-systems lead | Platform or frontend engineer | Depends on reporting line: VP Eng, Head of Design, or the founder |
| **What they need to believe** | "This saves me review time and shows me drift I could not see" | "This makes my job legible to my leadership" | "This will not break our pipeline or leak our code" | "This reduces a risk or a cost I already care about" |
| **What kills it** | It adds work | It cannot be explained upward in one sentence | It fails closed, or it is closed source in the hook | It is a nice-to-have with no number attached |

### 3.2 Who signs

**Under 50 people:** the founder or the head of product. One conversation, credit card, no procurement. This is where our first ten customers come from, without exception.

**50 to 200 people:** VP Engineering or Director of Frontend if the design-systems lead reports into engineering; Head of Design if into design. The engineering path is materially better for us: the budget is larger, the CI story lands, and the buyer already pays for developer tools. **When we have a choice of which champion to recruit, recruit the one who reports into engineering.**

**Over 200 people:** design-ops budget, annual contract, security review, procurement. We are not ready. Do not chase these; take the meeting for learning and say honestly that we are early.

### 3.3 The practical consequence

The champion cannot sign and the signer will never use the product. That gap is bridged by an artifact, not by a conversation. The artifact is **a drift report on the buyer's own repository with a number in it**: "your codebase contains 34 colors that are not in your palette, across 12 components, and 9 of them were introduced in the last 60 days." That is a sentence a champion can forward to a VP without editing.

Building the "forward this to your boss" artifact is the highest-leverage unbuilt sales feature we have. Today the pieces exist (`blocksmith check`, the violations feed at `POST /api/wiki/governance/violations`, `src/components/wiki/GovernanceViolationsPanel.tsx`) but there is no single shareable summary page. `src/lib/public-share/` and the `/share/[shareId]` route are the closest existing surface and are the natural place to build it. **Status: Planned.**

---

## 4. The pain hierarchy

Ranked sharpest first. The final column is the honest one.

### Rank 1: "The AI wrote UI that does not match our system, and I only find out in code review"

**Sharpness: highest and rising.** It is new, it has a visible cause, it recurs weekly, and it produces a specific artifact (a bad PR) that someone has to deal with. It is also *blameable on a tool rather than a person*, which makes it politically safe to raise, and that matters more than it sounds.

**What we do about it.** All three tiers. Tier 3 prevents it at agent time (`check_governance_diff` over MCP). Tier 1 blocks the machine-verifiable version at commit. Tier 2 captures the rest for the lead.

**Will they pay?** **Yes, probably.** This is the pain most likely to convert. It is new enough that no budget line exists for it, which cuts both ways: no incumbent to displace, but also no pre-approved money.

### Rank 2: "Figma and code disagree and nobody knows until a designer notices"

**Sharpness: high, but episodic.** It is acute during a redesign or a token migration and nearly invisible between them. The pain has spikes, not a baseline.

**What we do about it.** `POST /api/figma/connect` and `POST /api/figma/drift`, backed by `src/lib/figma/drift.ts` and `src/lib/figma/component-drift.ts`. This is our best *demo*, which is not the same as our best *pain*. Do not confuse the two.

**Will they pay?** **Yes, during a migration. Not otherwise.** This argues strongly for timing outreach to teams currently doing a rebrand, a token migration, or a design-system version bump. Those events are publicly visible in changelogs, release notes, and conference talks.

### Rank 3: "Nobody knows which doc is current"

**Sharpness: moderate, chronic, and thoroughly normalized.** Every team has this and every team has stopped noticing, the way you stop noticing a leaking tap.

**What we do about it.** One promoted source, `blocksmith pull` writing `DESIGN.md`, and MCP serving the same pinned version to agents.

**Will they pay?** **Mostly no.** This is the single most important honest admission in this chapter. Documentation staleness is the pain teams tolerate best, because tolerating it has no immediate cost. It is a *feature* of our product and a *bad lead* for our pitch. Notion is free and already installed. Never open with this.

### Rank 4: "I hand-maintain a 500-line `DESIGN.md`"

**Sharpness: low to moderate, and highly individual.** It annoys exactly one person: the ICP. It costs the company nothing visible.

**What we do about it.** `blocksmith pull` generates the file instead. `docs/CUSTOMER-PITCH-SCRIPTS.md` frames this as "stop maintaining a novel in markdown," which is a good line for the champion and means nothing to the buyer.

**Will they pay?** **Personally yes, corporately no.** Excellent champion-recruitment material. Useless in a budget conversation.

### Rank 5: "Design system adoption is unmeasurable"

**Sharpness: low as felt pain, high as political value.** Nobody loses sleep over it. But it is the pain whose *solution* is most forwardable upward, as covered in section 3.3.

**Will they pay?** **Not for this alone, but it closes deals started by rank 1 or 2.** Treat it as the closing argument, never the opening one.

### Rank 6: "Onboarding a new engineer to the design system takes weeks"

**Sharpness: low and diffuse.** Real, but so slow-moving that it never becomes anyone's priority.

**Will they pay?** **No.** Mention it as a benefit; never build for it.

### The summary table

| Rank | Pain | Pay or tolerate | Lead with it? |
|------|------|-----------------|---------------|
| 1 | Agent writes off-system UI | **Pay** | **Yes** |
| 2 | Figma vs code drift | **Pay during migrations** | **Yes, when the timing is right** |
| 3 | Which doc is current | Tolerate | No |
| 4 | Hand-maintaining `DESIGN.md` | Tolerate (personally painful) | No, but use to recruit the champion |
| 5 | Adoption is unmeasurable | Tolerate | No, but use to close |
| 6 | Slow onboarding | Tolerate | No |

**The rule that follows:** open on rank 1 or rank 2, recruit the champion with rank 4, close the buyer with rank 5, and let ranks 3 and 6 be pleasant surprises during onboarding.

---

## 5. The wedge and the land-and-expand path

### 5.1 The wedge

The wedge is **a drift report on their own material, produced in under five minutes, with no repo access required.**

Two doors, and both are deliberate:

**Door A: Figma import.** Paste a Figma file link and a personal access token at `/figma` (`src/components/figma/FigmaConnectCard.tsx`), and get a governed wiki. `src/lib/figma/rest.ts` recovers tokens from color styles, text styles, raw fills, and component sets with variant properties, so it works on any Figma plan (the variables REST endpoint is Enterprise-only, and we deliberately do not depend on it). `POST /api/figma/connect` handles this; the token is used once and not stored, which is the sentence that gets a security-conscious person to try it.

**Door B: repo scan.** `blocksmith scan ~/their-repo` from their laptop (`packages/cli/src/scan-local.ts`), or `blocksmith scan --github org/repo`, or the GitHub OAuth path in the hosted app. Produces the same `workspace-scan` wiki via `src/lib/scan/run.ts` and `src/lib/scan/to-markdown.ts`.

**Why two doors.** Door A requires no code access, which suits a design lead and clears a security hurdle. Door B produces the far more compelling artifact, because it shows them their own drift. The strongest possible first session runs both and shows the comparison between them. That is the moment the product explains itself.

**Why not lead with the wiki.** Because a wiki generated from their file is impressive for about ninety seconds and then looks like documentation, and they already have documentation. Drift is the thing they cannot get anywhere else. `docs/CUSTOMER-PITCH-SCRIPTS.md` currently leads with upload-then-wiki-tour, which optimizes for a smooth demo rather than a memorable one. Consider revising.

### 5.2 The expansion ladder

Each rung is a separate decision by a different person, which is why the order matters. Nobody adopts rung 4 before rung 2.

| Step | What happens | Who decides | Code path that delivers it |
|------|--------------|-------------|----------------------------|
| **0. Land** | Figma link or repo scan produces a wiki and a drift view | Design-systems lead, alone, no approval needed | `POST /api/figma/connect`, `src/lib/figma/rest.ts`, `POST /api/v1/scans`, `src/lib/scan/run.ts`, `POST /api/figma/drift` |
| **1. Govern** | They edit a component role or a usage rule, save to staging, promote to production, pin the lock | Same person, still alone | `POST /api/wiki/finalize` (save to staging), `POST /api/wiki/promote`, `POST /api/wiki/pin-lock`, `POST /api/wiki/rollback`, `src/components/wiki/pipeline/`, `src/components/wiki/ComponentGovernanceEditPanel.tsx` |
| **2. Serve agents** | An engineer connects Cursor or Claude Code to `/api/mcp` with an API key; the agent reads pinned blocks | One engineer, no team decision | `src/lib/mcp/blocksmith-server.ts`, `src/app/api/mcp/route.ts`, `blocksmith mcp-url`, `blocksmith setup cursor` (`packages/cli/src/cursor-setup.ts`), `src/components/wiki/CursorMcpInstall.tsx` |
| **3. Pull into the repo** | `blocksmith pull` writes `DESIGN.md` and `.blocksmith/wiki-overrides.json` from the promoted version | One engineer, but now a file is committed and the team sees it | `packages/cli/src/pull.ts`, `POST /api/v1/scans/pull`, `src/components/wiki/ScanPullHint.tsx` |
| **4. Local hook** | `blocksmith setup hooks --doc ...` installs a pre-push hook; drift is caught before it leaves the laptop | Individual engineers, opt-in, reversible | `packages/cli/src/setup-hooks.ts`, `packages/cli/src/check.ts`, `packages/cli/src/git-files.ts`, `.blocksmith/blocksmith.json` |
| **5. CI gate** | `blocksmith check --base origin/main...HEAD --ci --format github` runs on every PR; sticky comment; fails only on Tier 1 | **Team decision.** Platform engineer plus the lead. This is the hardest rung and the one that creates lock-in | `examples/github/blocksmith-governance.yml`, `packages/cli/src/check.ts`, `src/lib/governance/color-lint.ts`, `src/lib/governance/prose-lint.ts` |
| **6. Close the loop** | Violations and overrides flow back to the wiki; the lead triages; repeated overrides on one rule signal promotion to Tier 1 | Ongoing, and this is what makes the account renew | `POST /api/v1/governance/events`, `supabase/schema-governance-events.sql`, `src/components/wiki/GovernanceViolationsPanel.tsx`, `src/components/wiki/ComponentActivityPanel.tsx`, `src/app/api/v1/deviations/`, `src/lib/cloud/deviations.ts` |
| **7. Team** | Invite the org, assign roles, multiple people promote | Now a real purchase decision | `POST /api/v1/orgs/invite`, `src/lib/cloud/orgs.ts`, `src/lib/cloud/rbac.ts` (roles: owner, admin, member, viewer), `src/components/wiki/TeamPanel.tsx` |
| **8. Package** | `blocksmith codegen` emits `@blocksmith/<product>`; agents import governed components instead of writing CSS | Optional, and only for teams that want it | `POST /api/v1/codegen/pulse`, `packages/pulse-runtime`, `packages/generated/`, `/demo/pulse`. **Status: Partial (v0).** Say so |

### 5.3 Reading the ladder correctly

Three observations that should change how we prioritize.

**Rung 5 is the whole business.** Steps 0 through 4 are all individual, reversible, and free. Nothing before rung 5 is worth money and nothing before rung 5 is sticky. The moment `blocksmith check` runs in CI, three things become true at once: removing us breaks a build, a second person has had to agree we should exist, and the violation record starts accumulating. **Every onboarding decision should be evaluated by whether it shortens the path to rung 5.**

**Rung 6 is why they renew.** Rung 5 makes us load-bearing; rung 6 makes us useful to the person who championed us. Without the violations feed being genuinely worth opening, we are a linter, and linters do not renew as SaaS.

**Rung 8 is optional and we should stop implying it is not.** `docs/PUBLIC-RELEASE-SPRINT.md` puts Pulse auto-publish out of scope and `docs/CUSTOMER-PITCH-SCRIPTS.md` marks codegen as v0. Presenting the package step as part of the standard path sets an expectation the product does not meet.

---

## 6. Distribution channels

Assessed honestly. "Status" describes what exists in the repo today, not what we hope for.

### 6.1 Open-source CLI and npm packages

**What it is.** `@block-smith/cli` and `@blocksmith/sdk` on npm, MIT-licensed per `LICENSING.md`, installable with one command.

**Why it is our best channel.** It is the only channel where the ICP can adopt without asking anyone. It removes the closed-binary-in-a-hook objection. And the CLI is the thing that reaches rung 5.

**Status: Planned, blocked.** Both packages are at `0.1.0` with `file:` workspace dependencies. `docs/NPM-PUBLISH.md` documents the publish flow (`npm run publish:packages`, SDK first, then CLI with the workspace dependency temporarily rewritten). The blockers are real: the npm scope has not been claimed, `license` is still `UNLICENSED` in package metadata, and `LICENSING.md` explicitly holds public release until the "intended open" libraries (`src/lib/figma`, `src/lib/mcp`, `src/lib/scan` parsers, `color-lint.ts`) are physically extracted into `packages/*` so the open tree compiles independently.

**Honest assessment.** Highest-leverage channel we have and it is not switched on. Every week it stays unpublished, the friends-onboarding path in `docs/FRIENDS-ONBOARDING.md` requires people to clone our monorepo and `npm link`, which is a conversion killer. **This is the first thing to unblock.**

### 6.2 The MCP server listing ecosystem

**What it is.** MCP directories and registries where a developer browses available servers and connects one. Our remote MCP is a URL plus a bearer token, which is the easiest possible install.

**Why it fits us.** The audience is exactly our ICP's engineers, the install is a JSON snippet documented in `docs/FRIENDS-ONBOARDING.md` and rendered in-product by `src/components/wiki/CursorMcpInstall.tsx`, and being listed alongside established servers is free credibility.

**Status: Shipped (the server), Planned (the listings).** `/api/mcp` works with `Authorization: Bearer bs_live_…`. `blocksmith mcp-url` prints the config. We are listed nowhere.

**Honest assessment.** Cheap, fast, and underexploited. The catch is that MCP directory traffic converts into *tool-connected* users, not customers, and a user who only connects MCP is at rung 2 of eight. Good top of funnel, weak on its own, and worth doing this month because it costs a day.

### 6.3 The Figma plugin

**What it is.** `figma-plugin/` contains BlockSmith Annotate: it turns our visual and structural analysis into native Figma annotations across Figma's Development, Interaction, Accessibility, and Content categories, and can pin supported node properties. It connects with a `bs_live_…` key stored in Figma's private `clientStorage`, and it exports up to four small previews for analysis.

**Why the channel is attractive.** The Figma Community is a genuine distribution surface where the designer half of our audience already browses, and a plugin is the only way to be present inside the tool they live in.

**Status: Built, unproven.** It runs as a development plugin imported from `manifest.json`. It has not been submitted to the Figma Community, and community submission has review requirements and a quality bar we have not tested against.

**Honest assessment.** Real potential, wrong sequencing for now. A plugin reaches designers, and designers are the secondary persona who cannot install a CLI or approve a CI job. Publishing it before the CLI is published would be optimizing for the softer half of the funnel. Revisit after 6.1 ships.

### 6.4 The browser extension

**What it is.** `extension/` contains BlockSmith Capture: capture up to four views of any design surface (Canva, Figma, Adobe XD, or any website), run vision extraction via `POST /api/ingest/capture`, and get a `design.md` in the wiki. Captures are explicitly stored as **draft projects** with a "Captured draft" banner until a human confirms them, and they never auto-promote into a lock. Exact values from a code scan or a Figma node tree always outrank capture values.

**Why it matters.** It is the lowest-friction possible input: no repo, no Figma token, no account setup beyond signing in. It also connects to the longer-term `extension-restyle-web` direction.

**Status: Built, unproven as a channel.** Unpacked install only. Requires `NVIDIA_API_KEY` on the server.

**Honest assessment.** A great demo and a poor channel for the current ICP. Chrome Web Store review is slow, the capture path produces estimated values rather than exact ones (which is why the draft model exists), and our ICP has better inputs available. Keep it as a demo device and as a research track. Do not build a go-to-market on it.

### 6.5 Content and demos

**What it is.** The recorded comparison. `docs/02-competitive-landscape.md` proposed the exact experiment two years of product ago and it is still the right one: record a Cursor session on the same prompt, without MCP and with BlockSmith MCP, side by side. We now also have `POST /api/ai/governed-generate` and `src/components/demo/GovernedAiShowcase.tsx`, which score governed against ungoverned output with the real CI engine, plus `/demo/investor`.

**Why it works for us.** Our claim is inherently visual and comparative. "The agent invented a button" versus "the agent used your button" is a screenshot, not an argument.

**Status: Partial.** The demo surfaces exist. No public content has been produced.

**Honest assessment.** The best fit between what we can produce and what the audience shares. A thirty-second GIF of governed versus ungoverned generation is the single highest-return artifact we are not making. Cost: an afternoon. Requires that `/demo/investor` and the governed-generate path are reliably green on production first.

### 6.6 Founder-led sales

**What it is.** Direct outreach, a personal demo, and hands-on onboarding for every early customer.

**Why it is unavoidable.** The category is new, the metaphor needs explaining, and the wedge (a drift report on their material) requires us to actually run it with them the first time. `docs/CUSTOMER-PITCH-SCRIPTS.md` exists because this is the primary motion, and its pre-call checklist asks them to bring a design markdown file to the call.

**Status: Shipped as documentation, unexercised in practice.** Five complete scripts (A through F) exist for different audiences and lengths. No external customer call has been run against them.

**Honest assessment.** This is the channel for the first ten customers and it does not scale past roughly twenty. The critical discipline is `docs/CUSTOMER-PITCH-SCRIPTS.md`'s "honest limits" section: state the five known limitations proactively (the sample wiki is read-only, upload-only docs may not get full promote until a repo is linked, Pulse is v0, embedded is research, and hosted BlockSmith runs no live file watcher). Volunteering limitations early is what makes the strong claims believable.

### 6.7 Design-system communities

**What it is.** The Design Systems Slack, Friends of Figma groups, design-engineering Discords, Storybook and Tokens Studio communities, and the relevant conference circuit.

**Why it fits.** It is where the ICP concentrates, and it is a community that historically rewards free tools and open specifications.

**Status: Not started.**

**Honest assessment.** High-fit, slow-burning, and reputation-sensitive. These communities punish anything that reads as a product pitch and reward genuine contribution. The right entry is a useful free artifact (the drift check, or a written piece on measuring design-system adoption), not an announcement. Realistic payoff horizon is months, so start now precisely because it is slow.

### 6.8 The channel scorecard

| Channel | Fit with ICP | Cost to activate | Status | Priority |
|---------|:------------:|:----------------:|--------|:--------:|
| Open-source CLI and npm | Very high | Medium (licensing extraction) | Planned, blocked | **1** |
| Content and demos | High | Low | Partial | **2** |
| MCP listings | High | Low | Server shipped, unlisted | **3** |
| Founder-led sales | Very high | High per customer | Documented, unexercised | **4** |
| Design-system communities | High | Low money, high time | Not started | **5** |
| Figma plugin | Medium (designer half) | Medium (community review) | Built, unproven | 6 |
| Browser extension | Low for this ICP | High (store review) | Built, unproven | 7 |

---

## 7. The pitch, at three lengths

Distilled from `docs/CUSTOMER-PITCH-SCRIPTS.md`. Each version names the demo that has to be live for it to land, because a pitch that outruns the demo is how trust is lost.

### 7.1 The 30-second version

> Teams keep their design rules in a `DESIGN.md` that nobody reads and nothing enforces, so coding agents invent button variants that do not exist in your system.
>
> BlockSmith turns your design system into something you approve and pin, like a package lock. You promote a version in the browser; your agents read that version over MCP, and a check in CI fails the build when code drifts off it.
>
> The wedge is one thing you cannot get anywhere else: we show you where your Figma file and your shipped code already disagree.

**What has to be live.** Nothing. This version is deliverable cold, in a message or a hallway.

**Variants by room.** `docs/CUSTOMER-PITCH-SCRIPTS.md` has one-liners per audience and they are good. The most reusable: *"Stop AI from inventing your design system. Approve in the wiki, pin it, agents and devs follow what you approved."*

**What not to say in thirty seconds.** No "Design IR." No "TCP/IP for design." No "compile targets." No "one graph, many surfaces." Every one of those is a second sentence at best, and in thirty seconds you do not get a second sentence.

### 7.2 The 2-minute version

**0:00 to 0:20, the problem.** Their design truth lives in three places (Figma, a Notion page, a `DESIGN.md`) and they disagree. Agents now write a growing share of the UI and they read only the third one, which is stale. Nobody finds out until code review, if ever.

**0:20 to 0:50, the loop.** Four verbs, in this order: **scan or import**, **govern**, **promote and pin**, **enforce**. Show the Pipeline: a staging lane, a production lane, a promote button, and a lock strip that turns green. This is the ninety seconds that `docs/CUSTOMER-PITCH-SCRIPTS.md` Script E is built around and it is correct.

**0:50 to 1:30, the payoff.** Two screens. The MCP-connected agent using the promoted button because it read the pinned version. And the CI check: a PR that introduced an off-token hex, failing, with a sticky comment naming the nearest approved token.

**1:30 to 2:00, the differentiator.** The drift view: Figma says X, shipped code says Y. Then the honest note that the three tiers are deliberately graded, because a governance tool that blocks everything gets uninstalled: Tier 1 blocks only machine-verifiable violations, Tier 2 warns and captures, Tier 3 advises the agent before it writes.

**What has to be live.**

- The Pipeline promote and pin flow on production (`POST /api/wiki/promote`, `POST /api/wiki/pin-lock`), reliably, on a real document, not only the demo one.
- Either the MCP-connected agent session or the governed-versus-ungoverned comparison at `src/components/demo/GovernedAiShowcase.tsx`. A recording is acceptable; a broken live attempt is not.
- The CI check output. A terminal running `blocksmith check` against a seeded violation is enough.
- The drift view on a real Figma file (`POST /api/figma/drift`).

If any of those four are red, cut the section rather than describing it. `/demo/investor` exists as the seeded fallback.

### 7.3 The 10-minute version

The structure is the customer's own loop, and the demo must be run on **their** material if at all possible. Roughly:

**Minutes 0 to 1, their week.** Say it back to them: PR comments repeating the same correction, "which doc is current," a designer noticing a spacing change that never landed in two of four surfaces. If they nod, you have the meeting. If they do not, you have the wrong prospect and should find out now.

**Minutes 1 to 3, land.** Import their Figma file at `/figma` or scan their repo. Wiki appears: Foundation, Styles, Featured components. Say the honest thing here, because they will notice: this part is a rendered version of what they already have. The value is the next eight minutes.

**Minutes 3 to 5, the drift moment.** Show the comparison. This is the emotional center of the demo. Slow down. Let them read it. Expect them to argue with a specific finding, which is a good sign, and be ready with how the comparison was computed.

**Minutes 5 to 7, govern.** Edit one component's role or usage rule. Save to staging. Show that it is not live for agents yet, which is the point. Go to Pipeline, review the diff, promote, pin the lock. Narrate it in developer language: staging is a PR queue for design; production is what agents and CI are allowed to trust; the lock is `package-lock.json` for your design system.

**Minutes 7 to 9, enforce.** Terminal. `blocksmith pull` writes `DESIGN.md`. MCP config into Cursor. `blocksmith check --staged` against a file with an off-token hex, failing with the nearest approved token named. Then the CI template. Say out loud that the check **fails open** on network errors, because the platform engineer in the room is waiting for that answer.

**Minutes 9 to 10, the limits and the ask.** State three limits unprompted (Pulse codegen is v0; hosted BlockSmith does not run a live file watcher, so re-scan is manual; upload-only documents may need a linked repo for the full promote path). Then ask for one thing: pilot one product, one document, one promote, MCP in one editor, and the check in one CI job.

**What has to be live.**

- Everything in 7.2, plus:
- Import or scan on **their** repository or **their** Figma file, working on the first try. This is the biggest risk in the demo. Pre-run it before the call if they send the material in advance, which is what the pre-call checklist in `docs/CUSTOMER-PITCH-SCRIPTS.md` is designed to obtain.
- `blocksmith pull` and `blocksmith check` working from a clean machine against production. This requires the CLI to be installable, which requires 6.1. Until npm publish ships, this segment depends on a locally linked build and cannot be reproduced by the customer afterward, which is a serious problem for a ten-minute pitch that ends in an ask.

---

## 8. Pricing and packaging

### 8.1 What exists in code today

**Nothing.** This is the honest and complete answer, and it is deliberate.

A search of `src/`, `packages/`, `supabase/`, and `scripts/` for Stripe, checkout, billing, subscriptions, plans, quotas, or seats turns up exactly two hits, and both are dead UI:

- `src/components/nav-user.tsx` has a "Plan & Billing" dropdown item with no handler.
- `src/components/app-shared.tsx` has a nav entry pointing at `#/billing`, which routes nowhere.

There is no payment provider, no plan table in `supabase/schema.sql`, no entitlement check anywhere in the API routes, and no usage metering. `docs/PUBLIC-RELEASE-SPRINT.md` lists "Billing / Stripe" under explicitly out of scope, and `docs/GOAL-SAAS-STATUS.md` opens by stating the tracker is "not billing."

What does exist and is adjacent:

- **API keys** (`src/lib/cloud/api-keys.ts`, `POST /api/v1/auth/keys`) with `bs_live_…` prefixes. This is the natural attachment point for entitlements later.
- **Org roles** (`src/lib/cloud/rbac.ts`: owner, admin, member, viewer) and invites (`POST /api/v1/orgs/invite`). This is the seat model, unpriced.
- **Rate limiting** (`src/lib/cloud/rate-limit.ts`, `src/lib/cloud/redis.ts`). Abuse prevention, not metering, and `docs/GOAL-SAAS-STATUS.md` still lists durable rate limits as open at P2.

Not having billing is currently correct. We have no paying customer, no proven willingness to pay, and a public-release sprint that says reliability outranks features. But note the consequence for planning: **the gap between "someone says yes" and "we can take their money" is measured in weeks, not hours.** Do not discover that during a first close.

### 8.2 The open-core boundary

`LICENSING.md` draws the line, and pricing has to live on the correct side of it.

**MIT, free forever, per `LICENSING.md`:**

| Path | What |
|------|------|
| `packages/cli` | The `blocksmith` CLI, including `check` |
| `packages/sdk` | The workspace SDK |
| `packages/protocol` | The Design IR, lock, blocks spec and JSON schemas |

**Intended open, extraction pending** (still under `src/` and must move into `packages/*` before the open tree stands alone): `src/lib/figma` (import and drift), `src/lib/mcp` and `src/mcp` (the MCP server), `src/lib/scan` parsers, and `src/lib/governance/color-lint.ts` (Tier 1 lint).

**BSL 1.1, converting to Apache-2.0 on 2030-06-23** (`LICENSE`), with an Additional Use Grant permitting production use except offering BlockSmith to third parties as a competing hosted service:

| Path | What |
|------|------|
| `src/app` | The Next.js app: dashboard, hosted wiki, auth, API routes |
| `src/lib/cloud` | Orgs, RBAC, multi-tenancy, document registry, rate limits |
| `src/lib/ai` and the generation and curation surfaces | Governed generation, drift scoring |
| `packages/pulse-runtime`, `packages/generated/*` | The proprietary runtime and generated kits |

**What this means for pricing, stated as a rule:** we can never charge for the CLI, the check, the schemas, or (once extracted) the MCP server and the Tier-1 lint. The rationale in `LICENSING.md` is that willingness to pay lives in the cloud and team layer: hosted wiki, collaboration, RBAC, AI, and enterprise governance. So the paid product is **the hosted place where decisions are made, recorded, and shared across a team**, and the free product is **everything that runs on the developer's machine.**

That is a coherent boundary and it has a sharp implication worth stating plainly: **a sufficiently determined single developer can get most of the value for free.** That is fine. Single developers were never the buyer. The moment a second person needs to see what the first person approved, the hosted layer becomes necessary, and that is the moment to charge.

### 8.3 Pricing hypotheses to test

None of these are decided. Each is written with the specific question it would answer.

**Hypothesis A: per-seat on the governance surface.**
Free for one governing user and unlimited read-only viewers. Paid per additional user who can promote, edit governance, or manage the org. Roughly $20 to $40 per governing seat per month.
*Fits* the existing RBAC model with almost no new machinery: gate on `owner`, `admin`, and `member` in `src/lib/cloud/rbac.ts`, leave `viewer` free.
*Tests* whether the promotion gate is worth money to a team.
*Risk:* the governing population is tiny (often one or two people), so revenue per account is small.

**Hypothesis B: per design system.**
Flat monthly fee per governed design system (per connected document or repository), unlimited users. Roughly $200 to $500 per month.
*Fits* our actual unit of value. `docs/PITCH-AND-PRODUCT-MODEL.md` already establishes "one scan document per repository, one package per product," so the pricing unit matches the product model.
*Tests* whether a governed design system is a budget line at all.
*Risk:* teams with several products will consolidate to one document to avoid paying twice, which distorts the product.

**Hypothesis C: free until CI.**
Everything free for individuals, including the wiki, promote, and MCP. Payment begins when `blocksmith check` runs in CI against a hosted document, or above a threshold of checks per month.
*Fits* the ladder in 5.2 exactly: rung 5 is where the value crosses from personal to organizational.
*Tests* the cleanest possible value hypothesis, and the paywall lands precisely where a second person had to agree.
*Risk:* the check is MIT-licensed and runs locally, so this is enforceable only through the hosted document it checks against, and it invites self-hosting the whole loop. It also charges at the exact moment we most want adoption, which may suppress the rung we care about most.

**Hypothesis D: usage-based on drift.**
Free to import and browse. Paid per repository or Figma file under continuous drift monitoring, since `POST /api/figma/webhook` makes continuous monitoring possible.
*Tests* whether drift is a recurring need or a one-time report, which is the open question from pain rank 2.
*Risk:* if drift really is episodic (spiking during migrations), this produces seasonal revenue and high churn.

**The recommended first test.** A blend of B and C: free for one user and one design system, with the hosted document, promote, lock, and MCP included. Paid above one design system, above five governing users, or when CI checks run against a hosted document. Price the first paid tier low enough that the champion can expense it without approval, because section 1.6 says they control roughly a few hundred dollars a month and nothing more. Getting past the approval threshold on the first sale is worth far more than the revenue we would leave on the table.

**What to do before writing any billing code.** Ask the first five design partners two questions directly: what they currently pay for anything adjacent (Chromatic, Zeroheight, Tokens Studio, Storybook hosting), and what they would have to stop paying for to pay us. The answers are worth more than any amount of internal pricing debate.

### 8.4 What packaging must never do

- **Never gate the CLI or the check.** `LICENSING.md` puts them under MIT and, more importantly, gating them destroys the wedge.
- **Never gate the read-only wiki.** The secondary persona (PM, founder, design director) is the co-signer. Charging them to look at a page removes the person who approves the purchase.
- **Never gate export or pull.** `GET /api/wiki/export` and `blocksmith pull` return the customer's own governance prose. Holding customer IP hostage is how a governance tool fails a security review and a trust test simultaneously.
- **Never meter scans aggressively.** Re-scanning is the behavior that keeps the wiki accurate. Punishing it makes the product wrong.

---

## 9. The first ten customers

Not a growth plan. A list of ten specific acquisitions, in order.

### 9.1 The prerequisites

Three things must be true before outreach starts, and none of them is a feature:

1. **The core loop works on production for a stranger.** `docs/PUBLIC-RELEASE-SPRINT.md` defines this precisely: sign in, scan a repo, browse the wiki, stage a change, promote, pin the lock, pull, in under ten minutes with zero help. The gate is `npm run verify:production-goals` green plus a manual stranger test recorded by two people who did not build it. Current honest state in `docs/GOAL-SAAS-STATUS.md`: Goal 1 around 76%, Goal 2 around 66%, stranger-ready around 58% and 52%, against targets of 80% and 75%.
2. **The CLI installs from npm.** Section 6.1. Without this, the ten-minute demo ends in an ask the customer cannot act on.
3. **One recorded artifact exists.** A thirty-second governed-versus-ungoverned comparison, or a drift report on a real public repository. Outreach without an artifact is a cold pitch; outreach with one is a demonstration.

### 9.2 Customers 1 through 3: people who already trust you

**Who.** Former colleagues from the design-systems work described in `docs/01-vision-and-positioning.md`, and anyone in the current network who leads a design system at a 50-to-500-person product company.

**How.** Direct message, not a pitch: "I built the thing we needed at [company]. Can I run it against your repo and show you where your Figma and your code disagree? Twenty minutes, and I will give you the report whether or not you use it."

**Why this works.** It offers an artifact, not a demo. It is a low, specific ask. And the report is genuinely useful to them regardless of outcome, which makes it easy to say yes to.

**What we want from them.** Not money. We want: does the drift report contain something they did not know? Does the promote metaphor land without explanation? Where does the loop break on real material? `docs/CUSTOMER-PITCH-SCRIPTS.md` Script A or C, depending on whether they code.

### 9.3 Customers 4 through 6: teams currently mid-migration

**Who.** Teams publicly doing a rebrand, a token migration, or a design-system major-version bump. Pain rank 2 is at its sharpest during exactly these events, and only during them.

**How to find them.** Design-system changelogs and release notes on GitHub. Conference talks and blog posts titled "how we migrated to design tokens." Job postings for a design systems engineer, which signal both budget and an active initiative. Figma Community files that were recently republished.

**The message.** "You are moving to [new system]. The hard part is finding which surfaces did not follow. Here is a report of every place your code still uses the old values." Attach the report if the repository is public. Running the scan first and leading with findings converts far better than asking for a call.

**What we want.** The first CI installation (rung 5). A migration is the one moment when a team will accept a blocking check, because during a migration the check is helping them finish rather than policing them.

### 9.4 Customers 7 and 8: from the MCP and open-source funnel

**Who.** Developers who found `@block-smith/cli` on npm or the BlockSmith server in an MCP directory, connected it, and used it without ever speaking to us.

**How to reach them.** They self-identify by creating an API key. Instrument the moment a key is created and the moment MCP is first connected (`src/lib/cloud/api-keys.ts`, `/api/mcp`), then reach out personally within a day: "I saw you connected BlockSmith to Cursor. What are you trying to govern?"

**Why they matter more than their count suggests.** They arrived without persuasion, which means the product explained itself. Their friction points are the most trustworthy product feedback we will ever get, because nothing was smoothed over by a founder on a call.

**What we want.** To learn which rung they stalled at, and why.

### 9.5 Customers 9 and 10: from the community and content channel

**Who.** People who read a written piece or saw the governed-versus-ungoverned comparison in a design-systems community and asked about it.

**How.** Publish two things. First, the comparison artifact. Second, a genuinely useful written piece with no product pitch: how to measure design-system adoption from a repository, which is pain rank 5 and the thing this audience has no method for. Include the free CLI as the tool that produces the number. Post where the ICP already is (Design Systems Slack, design-engineering Discords, the Storybook and Tokens Studio orbits), and follow the community norm of contributing rather than announcing.

**What we want.** Evidence that the pitch works without a founder in the room, which is the precondition for any channel that scales past twenty customers.

### 9.6 How to run all ten

- **Same script every time,** from `docs/CUSTOMER-PITCH-SCRIPTS.md`, so that variance in outcome comes from the prospect and not from us.
- **Run the scan or the import before the call,** using the material requested in the pre-call checklist. A first-attempt failure on their repository costs more than the meeting.
- **State the honest limits unprompted,** all five from `docs/CUSTOMER-PITCH-SCRIPTS.md`. Volunteered limitations are what make the strong claims credible.
- **Ask for the CI gate, not the purchase.** Rung 5 is the real conversion event. Revenue can follow later; a CI installation cannot be retrofitted onto a cold relationship.
- **Write down the loss reason every time.** As noted in Open Question 8 of [Chapter 04](./04-market-and-competition.md), we currently have zero verified competitive losses, which means our entire competitive map is reasoned rather than observed. The first ten conversations are our only chance to fix that cheaply.

---

## Open questions

1. **Is the primary ICP right, or is it actually the platform engineer?** The design-systems lead has the pain and no budget. The platform engineer has the CI authority and cares less. We have written the docs for the former and built the lock-in for the latter. Unresolved, and it affects onboarding, pricing, and the homepage.
2. **Which door converts better, Figma import or repo scan?** Section 5.1 argues for running both. We have no data. This is measurable as soon as we have ten sessions.
3. **Should the demo lead with the wiki or with drift?** `docs/CUSTOMER-PITCH-SCRIPTS.md` leads with the wiki tour. This chapter argues drift is the memorable moment. Someone should A/B this on real calls.
4. **What is the actual trigger for building billing?** Number of design partners? A specific verbal commitment? Currently undefined, and section 8.1 notes the lead time is weeks.
5. **Can we charge for a hosted product when the CLI is MIT?** Hypothesis C in 8.3 has a real enforceability hole. Needs a clear answer before pricing is published.
6. **What does the forwardable artifact look like?** Section 3.3 identifies it as the highest-leverage unbuilt sales feature. Nobody has designed it. Is it a share link (`src/lib/public-share/`, `/share/[shareId]`), a PDF, or a PR comment?
7. **Do we sell to teams without Figma?** The wedge assumes a Figma file exists. Code-first design systems where Figma trails are a real segment and our repo-scan door serves them, but no messaging addresses them.
8. **How do we handle the team that has no design system yet?** They have the most drift and the least ability to act on a report, since there is no approved truth to compare against. Are they a customer or a distraction?
9. **What is the retention story after the first drift report?** The report is a one-time wow. Rung 6 (the violations feed) is what makes the account worth keeping, and it is the least polished surface we have.
10. **Does the ICP have a name for what we do?** Section 1.5 shows they do not use our category words. Until we hear a prospect describe us back to us in their own words, our positioning is untested.

---

## Where to look in the code

**The wedge: land**

| Path | What it delivers |
|------|------------------|
| `src/app/figma/`, `src/components/figma/FigmaConnectCard.tsx` | The paste-a-link Figma entry point |
| `src/app/api/figma/connect/route.ts`, `src/lib/figma/rest.ts` | Figma REST extraction that works on any plan. Token used once, not stored |
| `src/lib/figma/import.ts`, `normalize.ts`, `components.ts`, `adapter.ts` | Figma variables, styles, and design context into tokens and component IR |
| `src/app/api/figma/drift/route.ts`, `src/lib/figma/drift.ts`, `src/lib/figma/component-drift.ts` | "Figma says X, code says Y" |
| `src/app/api/v1/scans/route.ts`, `src/lib/scan/run.ts`, `src/lib/scan/to-markdown.ts` | Repo scan into a `workspace-scan` wiki |
| `packages/cli/src/scan-local.ts`, `src/lib/scan/github.ts` | Scan from a laptop or from a GitHub repository |
| `src/app/api/ingest/capture/route.ts`, `extension/` | Capture any design surface into a draft `design.md` |

**Expand: govern, serve, enforce**

| Path | Ladder rung |
|------|-------------|
| `src/app/api/wiki/finalize/route.ts` | 1. Save to staging |
| `src/app/api/wiki/promote/route.ts`, `pin-lock/route.ts`, `rollback/route.ts` | 1. Promote, pin, roll back |
| `src/components/wiki/pipeline/`, `src/components/wiki/LockStatusCard.tsx`, `BlockReleaseStrip.tsx` | 1. The Pipeline console the design lead operates |
| `src/lib/mcp/blocksmith-server.ts`, `src/app/api/mcp/route.ts` | 2. The agent surface |
| `packages/cli/src/cursor-setup.ts`, `src/components/wiki/CursorMcpInstall.tsx` | 2. The ten-second MCP install |
| `packages/cli/src/pull.ts`, `src/app/api/v1/scans/pull/route.ts` | 3. `DESIGN.md` and `.blocksmith/wiki-overrides.json` in their repo |
| `packages/cli/src/setup-hooks.ts`, `packages/cli/src/check.ts` | 4. Pre-commit and pre-push |
| `examples/github/blocksmith-governance.yml` | 5. The CI gate. The rung that matters |
| `src/app/api/v1/governance/events/route.ts`, `supabase/schema-governance-events.sql`, `src/components/wiki/GovernanceViolationsPanel.tsx` | 6. Violations flowing back to the lead |
| `src/app/api/v1/deviations/`, `src/lib/cloud/deviations.ts`, `src/components/wiki/DeviationsQueuePanel.tsx` | 6. Deviation TTL and budget. See `docs/GOAL4-DEVIATION-TTL.md` |
| `src/app/api/v1/orgs/invite/route.ts`, `src/lib/cloud/orgs.ts`, `src/lib/cloud/rbac.ts`, `src/components/wiki/TeamPanel.tsx` | 7. Team, roles, invites |
| `src/app/api/v1/codegen/pulse/route.ts`, `packages/pulse-runtime/`, `packages/generated/` | 8. The package. Partial, v0 |

**Distribution**

| Path | Channel |
|------|---------|
| `packages/cli/`, `packages/sdk/`, `docs/NPM-PUBLISH.md` | Open-source CLI and SDK. Blocked on the `LICENSING.md` rollout |
| `figma-plugin/` | Figma plugin (BlockSmith Annotate). Built, unproven |
| `extension/` | Browser extension (BlockSmith Capture). Built, unproven |
| `src/app/demo/investor/`, `src/components/demo/GovernedAiShowcase.tsx`, `src/app/api/ai/governed-generate/route.ts` | Demo and content artifacts |
| `src/app/protocol/`, `packages/protocol/` | Credibility surface for infrastructure conversations |
| `src/lib/public-share/`, `src/app/share/[shareId]/` | Closest existing surface for the forwardable artifact from section 3.3 |

**Commercial machinery**

| Path | Reality |
|------|---------|
| `src/lib/cloud/api-keys.ts`, `src/app/api/v1/auth/keys/route.ts` | API keys. The natural attachment point for entitlements. No entitlements exist |
| `src/lib/cloud/rbac.ts` | Roles: owner, admin, member, viewer. The seat model, unpriced |
| `src/lib/cloud/rate-limit.ts`, `src/lib/cloud/redis.ts` | Abuse limits, not metering |
| `src/components/nav-user.tsx`, `src/components/app-shared.tsx` | Dead "Plan & Billing" UI. The only billing artifacts in the repo |
| `LICENSING.md`, `LICENSE`, `LICENSE-MIT` | The open-core boundary that any pricing must respect |

**Readiness and verification**

```bash
npm run verify:production-goals   # the stranger-ready gate; run against the production URL
npm run verify:production-smoke   # deploy health
npm run verify:figma-import       # 49 checks on the wedge
npm run verify:governance-tiers   # the three-tier enforcement model
npm run verify:governance-e2e     # the full governance loop
npm run verify:workable           # full local product check
```

Readiness scores live in `docs/GOAL-SAAS-STATUS.md`. The gate definition lives in `docs/PUBLIC-RELEASE-SPRINT.md`. Update both when a rung of the ladder in section 5.2 moves.
