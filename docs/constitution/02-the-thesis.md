# The Thesis: Why BlockSmith Has To Exist

**What this chapter covers:** The argument. Why a product like BlockSmith becomes necessary at this exact moment, what specific failure it fixes, what we are betting on, and what would prove us wrong.

**Why it matters:** Everything downstream (the Design IR schema, the promote gate, the lock file, the wiki chrome, even which investor slide goes first) is a consequence of this argument. If you disagree with the thesis, you will disagree with half the codebase and you will be right to. Read it before you read architecture.

**Read this if:** You joined yesterday and someone asked you "so what does your company actually do and why now?" and you gave a vague answer. Also read it before you propose a feature, because the last section of this chapter is the filter every feature has to pass.

Primary sources for this chapter: [`docs/00-thesis.md`](../00-thesis.md), [`docs/01-vision-and-positioning.md`](../01-vision-and-positioning.md), [`docs/PITCH-AND-PRODUCT-MODEL.md`](../PITCH-AND-PRODUCT-MODEL.md), [`docs/RESEARCH-INFRA-DESIGN-IR-AND-CICD.md`](../RESEARCH-INFRA-DESIGN-IR-AND-CICD.md), [`docs/PUBLIC-FEEDBACK.md`](../PUBLIC-FEEDBACK.md), [`docs/CEO-DIRECTIVE.md`](../CEO-DIRECTIVE.md), [`docs/TEAM-NORTH-STAR.md`](../TEAM-NORTH-STAR.md).

---

## 1. The shift: teams are accumulating agent-oriented design documentation

Open any product repo that has adopted Cursor, Claude Code, Copilot Workspace, or an MCP-connected agent in the last eighteen months. You will find files that did not exist in that repo three years ago:

```
repo-root/
  CLAUDE.md              # instructions for Claude Code
  AGENTS.md              # instructions for whatever agent reads this convention
  .cursor/rules/*.mdc    # Cursor-specific rule files
  DESIGN.md              # "here is our design system, agent, please obey"
  docs/design.md         # the same thing, written by a different person
  docs/tokens.md         # a dump of every CSS variable, pasted
  docs/figma-export.md   # a Figma variables export, pasted into markdown
  docs/ui-guidelines.md  # do's and don'ts written after an agent got it wrong
```

This is not a fad and it is not sloppiness. It is a rational response to a real change in how software gets built. Three things happened at roughly the same time.

**First, the agent became a builder, not an autocomplete.** When the model only finished your line, it did not need to know your brand accent color, because you were typing it. When the model writes a whole component, it has to decide the accent color, the radius, the spacing scale, the button hierarchy, and the empty-state copy. If nobody tells it, it invents. And it invents plausibly, which is worse than inventing badly, because plausible wrong output survives review.

**Second, the failure mode is visible and annoying.** An agent that hallucinates a business rule usually fails a test. An agent that hallucinates a shade of orange ships. It ships to staging, a designer sees it in review, and now there is a rework loop. The cheapest local fix a team can make is to write down the rule so the agent stops guessing. So they write it down.

**Third, writing it down is nearly free, and deleting it is not.** Adding a paragraph to `DESIGN.md` costs one minute and zero coordination. Deleting a paragraph requires knowing whether some other rule depends on it, whether some agent behavior was relying on it, and whether the person who wrote it is still on the team. So documentation accretes. Nobody prunes.

Put those three together and you get the acceleration. Each incident where an agent produced off-brand UI generates at least one new rule. Rules are appended, not edited, because appending is safe and editing risks breaking something you cannot see. Every new agent tool that arrives brings its own filename convention, so the same content gets duplicated into a second file rather than referenced. Every new engineer who joins and gets burned adds a rule of their own, phrased their way, in whichever file they happened to have open.

This is exactly the growth curve `docs/00-thesis.md` calls the bet:

> These files will keep growing: more rules, more edge cases, more "when building X, do Y." Teams will treat markdown as the default machine-readable design-system brain.

We think this bet is close to safe. It is the least contested part of our thesis. The interesting part is what happens next.

### Why it accelerates rather than plateaus

There is a natural objection: surely models get better at inferring design intent, so the docs stop growing? We do not think so, for three reasons.

1. **Better models raise the ceiling on what agents are asked to do.** A model good enough to write one component gets asked to write a whole screen, then a whole flow. The surface area over which it can be off-brand grows faster than its accuracy on any single decision.
2. **Design intent is genuinely unstated, not merely unread.** "Use one primary CTA per view" is not derivable from the codebase. It is a taste decision. No amount of model quality extracts a decision that was never made explicit anywhere.
3. **Teams are adding agents, not consolidating them.** A design engineer uses Cursor, a backend engineer uses Claude Code, a PM uses something else, and CI runs a fourth. Each wants context in its own format. The natural equilibrium is more files, not fewer.

The result: within two years the average serious product team will hold thousands of lines of design-relevant instruction text that is written for machines, spread across four to twelve files, with no canonical version and no lifecycle.

---

## 2. The core tension: what is good for agents is bad for humans

The documents that make agents behave are the documents that make humans stop reading. This is the central tension of the company, and it is worth being precise about the mechanism instead of hand-waving at "too long."

An agent and a human consume a document in structurally different ways. An agent retrieves. It greps, chunks, embeds, and pulls the three paragraphs relevant to the current task into a context window. It does not care that paragraph 412 contradicts paragraph 88 unless both are retrieved together. It does not need a table of contents, because it does not navigate. Flat is fine. Long is fine. Duplicated is fine, and sometimes actively helpful, because duplication raises the odds that a retrieval hits.

A human reads linearly and builds a mental model. A human needs to know which paragraph is the canonical one, needs hierarchy to know where a rule sits in the system, and needs to be able to answer "did this change since last month?" A human confronted with a 1,400-line markdown file does not skim it. A human closes it.

Here is the table from [`docs/00-thesis.md`](../00-thesis.md), with each row expanded into the concrete scenario that makes it real.

### Row 1: greppable versus overwhelming

| Agent experience | Human experience |
|---|---|
| Can grep, chunk, and ingest a long `design.md` without penalty | Overwhelmed by length and duplication |

**Scenario.** Acme's `DESIGN.md` is 1,800 lines. An agent asked to build a settings page runs a retrieval over it, pulls the 40 lines about form density, surface elevation, and the label token, and produces a correct page in ten seconds. That same afternoon, a new design engineer is told "read `DESIGN.md` to learn our system." She opens it, scrolls for two minutes, sees three sections that all appear to describe buttons, cannot tell which one is current, and gives up. She goes and asks a senior engineer instead, which is exactly the tribal-knowledge failure the document was written to eliminate. The document is simultaneously a success for the machine and a failure for the person. Nothing about the document is broken. The **medium** is wrong for one of its two audiences.

### Row 2: tolerant of flat structure versus needing a map

| Agent experience | Human experience |
|---|---|
| Tolerates flat markdown and inconsistent headings | Loses the map, cannot find the source of truth |

**Scenario.** The accent color appears in four places in Acme's repo: as `--color-accent` in `tokens.css`, as a hex literal in a Figma export pasted into `docs/tokens.md`, as prose in `DESIGN.md` ("our accent is a warm orange"), and as a rule in `CLAUDE.md` ("never use raw hex, always use the token"). Three of those four sources say `#d97757`. One says `#d97050`, because someone updated Figma and pasted a stale export. The agent retrieving "accent color" gets whichever chunk ranks highest that day and is confidently wrong 25% of the time. The human trying to resolve it has no notion of precedence: there is no file that says "when code and Figma disagree, code wins until a human promotes the Figma value." Both audiences are hurt, but only the human is in a position to fix it, and the human is the one who cannot see the conflict because it is spread over four files.

This is why the codebase has an explicit truth-precedence model and a `conflict` block status rather than a "latest write wins" merge. See `src/lib/ir/registry.ts` and the precedence table in [`docs/RESEARCH-INFRA-DESIGN-IR-AND-CICD.md`](../RESEARCH-INFRA-DESIGN-IR-AND-CICD.md) section 4.6.

### Row 3: rules without feel versus judgment that needs feel

| Agent experience | Human experience |
|---|---|
| Does not feel hierarchy or product tone | Cannot quickly judge if direction still matches taste |

**Scenario.** Over six months, Acme's rules drift toward density: three separate incidents produced three separate rules that each shave padding somewhere. Individually each rule is defensible. Collectively the product now feels cramped, and nobody decided that. An agent will never notice, because an agent evaluates each rule against the request in front of it and each one passes. A human would notice in four seconds by looking at the product. But the human is looking at markdown, where "padding: 8px" and "padding: 12px" in two different sections look like harmless detail rather than a direction change. Direction drift is invisible in text and obvious in render. That single sentence is the reason the human product is a rendered wiki and not a nicer markdown viewer.

### The compressed version

**Too much documentation for agents becomes too messy to control with human eyes.**

The consequences are specific, and each one is a thing we have seen or expect:

- **No canonical paragraph.** When two sections disagree, there is no mechanism that declares one official. Precedence lives in someone's head.
- **Drift hides in file 7 of 12.** A rule that no longer matches the shipped product can sit unnoticed indefinitely because no human reads far enough to hit it.
- **New hires and PMs never read the wall.** The people who most need the map are the least likely to grind through it, so the doc fails hardest exactly where it should help most.
- **The agent gets more confident as the human gets less informed.** This is the dangerous asymmetry. Documentation growth improves machine output while degrading human oversight. The system appears to be getting better while governance quietly evaporates.

That last point is the one to internalize. We are not claiming agent docs are bad. They are good, they work, and they are why teams are writing them. We are claiming that the very thing that makes them work for machines removes the human's ability to steer. The gap widens on its own, without anyone making a mistake.

---

## 3. Why humans still win, and why the lab exists to protect that

It would be easy to read the above and conclude "so build better retrieval for humans." That is not the conclusion. The conclusion depends on a claim about where human value actually sits in UI work.

Agents are strong at **execution inside rules**: consistency, speed, applying a known constraint across a hundred files without getting bored. That is genuinely valuable and genuinely superhuman. Humans are strong at the three things rules compress poorly.

**Intuition.** Knowing what feels right for *this* product and *these* users. This is not mysticism. It is a compressed model of thousands of prior observations that has never been written down and mostly cannot be. A designer who says "that gold reads cheap on a finance product" is making a correct prediction from evidence that exists nowhere in the repo.

**Creativity.** Novel flows, brand, emotional tone. Agents interpolate inside the space of things they have seen. The value in a product's UI is frequently in the part that is not an interpolation: a new interaction, a decision to remove a step, an unexpected empty state that makes people smile. Rules describe the boundary of that space. They do not generate the thing inside it.

**Direction.** What to optimize, what to simplify, what not to build. This is the most valuable of the three and the least automatable, because it is not a question with a correct answer discoverable from the codebase. It is a bet about what matters.

The lab does not exist to replace those. It exists to **protect** them, and the protection is mechanical, not sentimental. If a human's only interface to the design system is a markdown file they will not read, then their intuition, creativity, and direction have no channel into what the agents build. The taste still exists in the person's head. It just stops reaching production. Governance does not fail because humans got worse. It fails because the interface between human judgment and agent execution became a file format humans cannot use.

Stated as a single line from [`docs/00-thesis.md`](../00-thesis.md):

> Agents consume docs. Humans set direction. The interface between them cannot be a thousand-line markdown file alone.

The winning layer, then, is not "more design.md" and not "a static export of design.md." It is an **auto-updating, human-grade knowledge base** with a real two-way connection to the code and the agents. That is what BlockSmith is. [Chapter 03](./03-what-blocksmith-is.md) defines it precisely.

### Where this came from (the origin case)

The thesis is not armchair reasoning. It is generalized from concrete work described in [`docs/01-vision-and-positioning.md`](../01-vision-and-positioning.md).

At a global community product company, product teams were trying to connect neighbors worldwide. Cohesive UX was hard for one reason: the design system had no centralized documentation. Truth lived in Figma comments, Slack threads, Notion pages, and engineers' heads. The fix was not "write more docs." It was three steps:

1. **Clarify** what was canonical (which tokens, which components, which workflows).
2. **Centralize** into one internal wiki.
3. **Link** workflows so design, product, and engineering saw the same map.

That worked. It also had a known weakness: the wiki had to stay current as the system evolved, and staying current was manual labor that decayed the moment attention moved elsewhere.

BlockSmith is that same intervention, rebuilt for a world where the scattered layer is `CLAUDE.md` and `DESIGN.md` instead of Slack and Notion, and where the "stay current" problem is solved by scanning the repo rather than by a person remembering. The addition that the original wiki did not have is the **two-way link to the IDE**, so the human surface and the engineering surface cannot silently diverge.

---

## 4. The second pillar: pre-launch feedback is broken

The first pillar is about governance between humans and agents. The second pillar is about a separate, independently real problem, and it matters because it is what turns a governance tool into something a team gets emotionally attached to.

**Design teams almost never get real human signal on specific UI before ship.** Not the kind of signal that predicts "the public will hate this gold" or "this label reads wrong at a glance."

| What teams usually have | What they actually need |
|---|---|
| Internal critique, Figma comments, design review | Reactions from people who are **not** on the team |
| Analytics **after** launch | Opinion on **this button**, **this color pair**, **this copy**, in context |
| A/B tests on the live product (slow, risky, requires traffic) | Safe exposure of **one block** without shipping the whole app |

### Why this is hard today, mechanically

The obstacle is not that teams do not want outside opinion. It is that there is no lightweight artifact to show. Components live inside private repos, behind auth on staging URLs, or inside Figma files that outsiders will never open.

The two available options are both bad:

- **Share the whole app.** Heavy. Requires a deploy, an environment, sometimes credentials, sometimes an NDA. Nobody does this to ask about a button.
- **Share a screenshot.** Loses interactivity, loses the real rendering, loses comparability between variants, and produces feedback that lands in a Slack thread and dies there. The opinion is not attached to anything durable, so it cannot be revisited when the button changes next month.

There is no path from "canonical design block" to "public or semi-public view" to "structured feedback tied back to the block."

### Why block granularity is what makes it possible

Here is the part that is specific to us and not obvious. The wiki is not built from pages. It is built from **blocks**: individual tokens, components, and surfaces, each with an id and a version, living in the Design IR graph.

That granularity is what makes public preview tractable, for four reasons:

1. **A block is small enough to share safely.** Exposing `primary-action-button` plus its hero copy and surface stack reveals almost nothing about the product's strategy, roadmap, or data. Exposing a staging environment reveals all of it. Block granularity is what makes the legal and competitive answer "yes."
2. **A block is self-contained enough to render standalone.** Because the block carries its tokens and its governance content in the IR, a public page can render it truthfully without booting the customer's app. There is no dependency graph to satisfy.
3. **A block has an id and a version, so feedback is addressable.** An opinion attaches to `(doc, blockKind, blockId)` and, in the mature form, to a version. This means "62% said this works" is a fact about button v4, not a fact about a screenshot somebody posted in March. When v5 ships, the old signal does not silently transfer.
4. **A block already round-trips into the repo.** Because the same graph feeds the wiki, the package, and the lock file, feedback collected on a block flows back into the artifact engineers and agents actually read. The loop closes instead of terminating in a Slack thread.

### The loop

1. **Release a block to public view.** From a component or surface page in the wiki, click **Get public link**. One share record per `(doc, blockKind, blockId)`, so reopening returns the same URL.
2. **Collect opinion at the block.** The public page shows the live preview and three choices: Works for me, Not sure, Does not work. Views and reactions are counted per share.
3. **Close the loop.** Signal comes back into the same graph that agents and engineers read, so taste is validated **before** launch, not reconstructed in a post-mortem.

**Status:** Shipped as a local and SaaS-gated flow. `POST /api/share`, `GET /api/share`, `GET /api/share/{id}`, `POST /api/share/{id}/view`, `POST /api/share/{id}/opinion` all exist (`src/app/api/share/`), backed by `src/lib/public-share/store.ts`, and creating a share requires document access via `requireDocumentAccess` so a stranger cannot mint public links to someone else's design IP. The public page is `src/app/share/[shareId]/`. What is **Planned** rather than shipped: tying opinions to block **versions** rather than block ids, variant A/B comparison on the public page, and any analysis beyond raw counts. The runbook is [`docs/PUBLIC-FEEDBACK.md`](../PUBLIC-FEEDBACK.md).

### Why this belongs in the same company as the governance pillar

Because the two pillars answer the same question from opposite directions.

Agents optimize **inside** the rules. The public stress-tests whether the **rules are right**. A governance system with no external signal is a very efficient machine for enforcing a mistake at scale. Pre-launch block feedback is the error-correction term. Humans do not only need to *understand* the system, they need to *test* it with people who are not paid to like it.

---

## 5. What we are claiming, and what would prove us wrong

These are bets, not facts. A cofounder should be able to state each one and state the evidence that would kill it. If you cannot name the disproof, you do not hold a thesis, you hold a slogan.

### Claim 1: Agent design docs will outpace human skim-speed, and this gets worse, not better

**What we assert.** The volume of machine-oriented design instruction per team grows faster than any human's ability to review it, and improving models do not reverse this.

**What would prove it wrong.** Teams two years from now hold roughly the same amount of design instruction text as today, or less, because models infer design intent well enough that explicit rules stop paying for themselves. Concretely: if we survey serious product teams and find `DESIGN.md`-class files shrinking or being deleted rather than growing, the shift we built on is not happening. Also fatal: if a single agent-native convention wins so completely that all design context consolidates into one well-structured, tool-maintained file with its own lifecycle, then the mess we are cleaning up cleans itself.

**Honest read.** This is our strongest claim. We would be surprised to lose it.

### Claim 2: Static wikis and one-way doc generators are insufficient

**What we assert.** A generated site that renders `DESIGN.md` nicely does not solve the problem, because the failure is not rendering, it is divergence. Without writeback, the human surface becomes stale and people stop trusting it, which returns them to reading raw files.

**What would prove it wrong.** Teams adopt a one-way generated design site and keep using it after six months without complaining about staleness. Or: teams demonstrate they are happy to maintain the human surface by hand, in which case the auto-update and handshake machinery is expensive engineering solving a problem nobody feels. A concrete negative signal: users of our own product who use the wiki heavily but never once use Finalize or pull. That would mean the read path is the product and the write path is a research hobby.

**Honest read.** This is the claim that most directly justifies the hardest engineering we do (the handshake and the lock). It is also the one where we currently have the least outside evidence.

### Claim 3: The winning layer is an interchange protocol plus a reference pipeline

**What we assert.** Design truth needs a neutral intermediate representation (`blocksmith.blocks.v1`) that many sources compile **into** and many targets compile **out of**, in the way TCP/IP, LLVM IR, Protobuf, and OpenAPI work. The value accrues to whoever defines the packet, and BlockSmith is the reference implementation that dogfoods it.

**What would prove it wrong.** Two distinct failures would kill this. First, if nobody but us ever writes an adapter or a compile target, then it is not a protocol, it is our internal file format with a spec site attached, and the category claim collapses to a product claim. Second, if a large incumbent (Figma, GitHub, or a model vendor) ships an adequate design-context format bundled with a tool teams already have, distribution beats neutrality and we lose the layer even if our schema is better.

**Honest read.** Protocol bets are winner-take-most and slow. This is the highest-variance claim in the list. It is also why [`docs/CEO-DIRECTIVE.md`](../CEO-DIRECTIVE.md) treats publishing the spec, the JSON Schemas, and adapter guides as an asset rather than paperwork. The schemas are real and in the repo at `public/schema/blocksmith.blocks.v1.json` and siblings, with a conformance suite under `packages/protocol/`.

### Claim 4: Teams that nail promote (human) plus pin (agent) own cohesive UX in the agent era

**What we assert.** The specific mechanism that produces cohesive UX under agent development is a human gate on what becomes official, plus a machine-readable pin that agents cannot bypass. Not documentation quality. Not model quality. The **gate plus the pin**.

**What would prove it wrong.** Run the R5 evaluation described in [`docs/RESEARCH-INFRA-DESIGN-IR-AND-CICD.md`](../RESEARCH-INFRA-DESIGN-IR-AND-CICD.md) section 9.2: a real team, two weeks, with and without lock enforcement, measuring fidelity drift in agent-generated UI. If pinned teams drift as much as unpinned teams, the central mechanism does not work and we are selling ceremony. A weaker but still damaging result: pinning works but the drift it prevents is not expensive enough for anyone to pay to prevent.

**Honest read.** This is the most falsifiable claim we have and the one we should be most eager to test, because it is cheap to test and it is load-bearing for everything.

### Claim 5: Block granularity makes pre-launch public feedback possible where whole-app sharing does not

**What we assert.** Teams will share a single component publicly to get outside signal, because it is safe, small, and addressable, even though they will not share a staging environment.

**What would prove it wrong.** Share links get created and never sent. Or they get sent and the responses are too thin or too noisy to change a decision. Or legal and brand teams object to any public exposure regardless of granularity, in which case the safety argument was our theory and not theirs. Concretely: if the median share link collects fewer than a handful of opinions and no team ever cites the result in a design decision, the feature is a demo, not a pillar.

**Honest read.** We believe in the mechanism and have not proven the demand. Treat pillar two as **Built, unproven** at the level of user behavior, even though the code is shipped.

### Claim 6: One semantic spec can compile to many physical runtimes without unacceptable loss

**What we assert.** The same block graph can produce a React package, an MCP tool payload, a CI validator input, and an embedded token header, preserving block ids, versions, token values, governance rules, and content hashes across all of them.

**What would prove it wrong.** A compile target where the semantics genuinely do not survive: the device profile needs constraints the web target cannot express, so the two drift and the "one graph" story becomes two graphs with a shared prefix. Watch specifically for governance rules that are meaningful on web and meaningless on a 240x240 display, and for the temptation to add target-specific fields to blocks. Every such field is evidence against this claim.

**Honest read.** Partially demonstrated. `src/lib/ir/targets/device-sim.ts` and `src/lib/ir/targets/c-header.ts` exist, `npm run compile:device` runs, and `/demo/device` renders. That is a real second and third emitter, which is meaningful. Firmware in the field is **Planned** and we do not claim it. The honest phrasing from [`docs/PITCH-AND-PRODUCT-MODEL.md`](../PITCH-AND-PRODUCT-MODEL.md) is: one IR to web today, device profile tomorrow. Never "upload a `.md` and it runs on any chip."

### Claim 7: Governed generation beats prompt generation for brand fidelity

**What we assert.** UI generated deterministically from a governed IR, with the model only selecting and arranging inside validated constraints, is provably more on-brand than UI generated from a prompt. This is the differentiator against prompt-to-UI tools.

**What would prove it wrong.** A general model, given a team's raw `DESIGN.md` as context and no IR, produces output as on-brand as our deterministic composition, measured by off-token diff counts and human preference. If raw context is enough, the IR is an unnecessary intermediate step and the moat is a speed bump.

**Honest read.** This is the claim most exposed to model progress. Our defense is that determinism gives guarantees rather than probabilities, and guarantees are what an enterprise buys. But we should keep measuring it, and `npm run validate:ui` plus `scripts/validate-ui.ts` are where the measurement lives.

---

## 6. The principles

These seven principles come from [`docs/00-thesis.md`](../00-thesis.md). They are short enough to memorize and specific enough to settle arguments. For each one: what it means in practice, and what violating it looks like, because a principle you cannot violate is not a principle.

### Principle 1: Humans direct, agents execute

**In practice.** Every mechanism in the system that changes what is official requires a human action. Finalize is a person clicking a button. Promote is a person deciding a draft is ready. The governance copilot drafts language, it does not publish it. AI proposes, the wiki disposes. The knowledge base exists to **elevate human oversight**, not to remove the human from the loop and call it efficiency.

**Violating it looks like.** An "auto-promote everything the copilot suggests" toggle, added because promoting one block at a time is tedious. A background job that resolves conflicts by picking the newer value. An MCP tool that can write to the official graph. Each of these is individually reasonable and collectively fatal, because they convert the human gate into a formality. The one deliberate exception in the current design is that **scan facts auto-promote**, because code that has already shipped is not a proposal, it is a fact. Note that this exception is narrow and is about observed reality, not about generated suggestions.

### Principle 2: Auto-update, not annual refresh

**In practice.** The wiki and the repo are **siblings**, not copies. When code changes, a re-scan produces new block versions without anyone rewriting documentation. The original internal-wiki project this company grew out of died the slow death of manual maintenance, and we designed specifically against repeating that.

**Violating it looks like.** Any workflow whose correctness depends on a human remembering to update the wiki after changing code. A "documentation review" calendar invite. A wiki field that has no ingest path and can only be typed by hand, which means it will be right on day one and wrong forever after. When you add a field to a block, ask immediately: what keeps this current? If the answer is "a person," you have added future staleness.

### Principle 3: Two-way handshake

**In practice.** Web and IDE are **peers**. A change finalized in the browser reaches the repo (`blocksmith pull` writes `DESIGN.md` and the lock). A change made in the repo reaches the wiki (scan and re-scan). Neither surface is a read-only mirror of the other, and any finalized change is visible from both sides without manual copy-paste.

**Violating it looks like.** Shipping a beautiful read-only render of `DESIGN.md` and calling it done, which is exactly the mistake Claim 2 says is fatal. Or the inverse: a wiki edit surface whose changes only exist in our database and never reach the customer's repo, which makes the wiki a second source of truth and reintroduces the drift we exist to remove. The verify scripts that guard this are `npm run verify:handshake-writeback`, `npm run verify:handshake-pull`, and `npm run verify:handshake-acceptance`.

### Principle 4: One block graph

**In practice.** The wiki render, the MCP tool response, the Pulse package, the device profile, and the lock file are all **compile targets of the same graph**. There is exactly one place where a block's content, version, and status live, and everything else derives from it.

**Violating it looks like.** A second block store. A cache that becomes authoritative because it is faster. A wiki page that reads from the parsed markdown while MCP reads from the registry, so the two can disagree. [`docs/TEAM-NORTH-STAR.md`](../TEAM-NORTH-STAR.md) lists "duplicate block stores" under things nobody owns and nobody should build. If you find yourself writing a transform that goes from one derived representation to another derived representation without passing through the IR, stop.

### Principle 5: Taste is a feature

**In practice.** The knowledge base must be pleasant enough to open daily. This is not polish applied at the end. It is the product. We are selling a human surface to people whose entire job is judging human surfaces, in a category where the incumbent alternative is a text file. If our wiki is ugly, the argument that humans need a rendered surface is refuted by our own artifact.

**Violating it looks like.** Treating design work as a follow-up ticket. Shipping a control plane that is functionally complete and visually indifferent. Also, subtly: adding capability faster than coherence, so the wiki becomes a pile of panels rather than a place. [`docs/01-vision-and-positioning.md`](../01-vision-and-positioning.md) lists "treating taste as polish" as one of five named mistakes to avoid.

### Principle 6: Ship the loop

**In practice.** The demo that matters is a full circuit: IDE save leads to wiki update, **and** wiki finalize leads to a file change. Half a loop is not half a product, it is a different and less interesting product. This principle is why the CEO directive says every stream must connect to promote and lock within two hops, and why disconnected work is banned even when it is good work.

**Violating it looks like.** A sprint that improves ingest quality without touching what happens after ingest. An impressive AI feature whose output does not feed the draft or official path. A new page that is neither control plane, onboarding, nor adoption narrative. The test question before merging, taken verbatim in spirit from [`docs/CEO-DIRECTIVE.md`](../CEO-DIRECTIVE.md): does this make promoted design truth more visible, more enforceable, or more deployable, for humans, agents, apps, or devices?

### Principle 7: Blocks can go public

**In practice.** Any block can be exposed for real human feedback before full launch, and opinions attach to block ids and versions rather than to loose screenshots. This is pillar two operationalized, and it is a first-class capability of the graph rather than a bolted-on sharing feature.

**Violating it looks like.** Building a general "share this page" feature that shares arbitrary wiki chrome rather than a specific block, which loses addressability and leaks more than intended. Or collecting feedback into a separate analytics silo that never rejoins the graph, so the loop does not close. Or, on the safety side, allowing share creation without a document-access check, which would let anyone mint public links to someone else's design system. That check is why `src/app/api/share/route.ts` calls `requireDocumentAccess` before creating a share.

---

## 7. What success looks like

### One sentence

> Open the wiki to understand the system. Change something in the IDE or finalize something in the browser. Both sides show the same truth without manual copy-paste.

That is the version from [`docs/00-thesis.md`](../00-thesis.md), and it is the one to say out loud.

### The measurable version

The sentence above is a feeling. Here is the same claim in numbers a skeptic could check. None of these are currently instrumented end to end, so treat the metric set as **Planned** even where the underlying mechanism is Shipped.

| Claim in the sentence | Measurable form | Where it would be measured |
|---|---|---|
| "Open the wiki to understand the system" | A design lead new to the system finds a component's canonical usage rule in under 10 seconds, measured in a moderated task | R5 team evaluation |
| "Understand" is durable, not one-time | Weekly active wiki opens per team member stays flat or rises over 8 weeks rather than decaying after onboarding | Product analytics |
| "Change something in the IDE" | Time from repo commit to the wiki showing the new block version, target under one re-scan cycle with zero manual steps | Scan pipeline timing |
| "Finalize in the browser" | Time from Finalize to the customer repo's `blocksmith.lock` reflecting the new official version after a pull, and the count of teams who complete this at least once | Promote and pull audit trail |
| "Both sides show the same truth" | Lock staleness: percentage of active docs where the repo lock content hash matches the official graph hash. Target is high and rising | `npm run validate:ui`, lock verification in `src/lib/ir/lock.ts` |
| "Without manual copy-paste" | Count of design values in agent-generated PRs that are off-token, before and after lock enforcement. Target is a large reduction | `scripts/validate-ui.ts` off-token diff |

If you want a single north-star number: **off-token design values in agent-authored UI changes, per team, per week, trending to near zero after the team's first promote.** That number is the physical manifestation of the entire thesis. It is what "cohesive UX in the agent era" reduces to when you stop using adjectives.

---

## Open questions

These are genuinely open. Do not assume someone senior has already resolved them privately.

1. **Does version pinning actually reduce measurable fidelity drift?** This is Claim 4 and it is the load-bearing empirical question. It has not been tested with a real team over a real period. Design of the study is sketched as R5 in [`docs/RESEARCH-INFRA-DESIGN-IR-AND-CICD.md`](../RESEARCH-INFRA-DESIGN-IR-AND-CICD.md) section 9.2. Nobody has run it.
2. **Where should enforcement sit: MCP advisory or CI blocking?** Blocking in CI is strong but creates adoption friction on day one, when a team's lock is new and their existing code violates it everywhere. Advisory in MCP is friendly and skippable. The current stance is both (`src/lib/ir/enforce.ts` for MCP, `scripts/validate-ui.ts` for CI), but the right default for a new team is unresolved.
3. **What is the minimal block type system?** Today: `component`, `token`, `guideline`, `agent-rule`, `page`. Too few types and governance prose has nowhere structured to live. Too many and the IR turns into a full UI language, which is a different and much harder product. There is no principled answer yet for where to stop.
4. **How does the schema evolve without breaking locks?** `blocks.v1` to `v2` is a real future event. A lock pinned under v1 must remain meaningful. Package managers have prior art here and we have not adopted a position.
5. **What consistency model fits design truth?** Eventual (re-scan reconciles) or strong (finalize acts as a barrier)? The system currently behaves eventually for scan facts and strongly for governance, which is a pragmatic mix rather than a designed model.
6. **Will teams actually share blocks publicly?** Claim 5 is unproven at the level of behavior. The mechanism is shipped, the demand is theory.
7. **Does the "agent docs keep growing" bet survive a consolidation event?** If one convention wins completely, or if a model vendor ships design-context tooling in-band, the shape of the problem changes. We have no contingency written down.
8. **How do you quantify semantic loss when compiling to a device target?** Question 10 in the research doc. We can render a device frame. We cannot yet say how much meaning was dropped getting there.

---

## Where to look in the code

The thesis is an argument, but every part of it has a corresponding artifact. If you want to check whether we actually believe this, read these.

| Claim or principle | Path | What it shows |
|---|---|---|
| Design IR is a real schema, not a slide | `public/schema/blocksmith.blocks.v1.json`, `public/schema/blocksmith.lock.v1.json`, `public/schema/blocksmith.registry.v1.json`, `public/schema/blocksmith.compile-targets.v1.json` | Published JSON Schemas |
| IR types in code | `src/lib/ir/types.ts` | The block and graph types the whole system compiles through |
| Versions, promote, rollback, conflict, stale | `src/lib/ir/registry.ts` | The append-only version registry and official pointer |
| The pin half of "promote plus pin" | `src/lib/ir/lock.ts` | Deterministic lock build and verification |
| Agents cannot read drafts | `src/lib/ir/enforce.ts` | Enforcement of official-only reads for MCP |
| The CI gate | `scripts/validate-ui.ts`, `npm run validate:ui`, `.github/workflows/validate-ui.yml` | Lock staleness and off-token diff detection |
| One graph, many targets | `src/lib/ir/targets/device-sim.ts`, `src/lib/ir/targets/c-header.ts`, `npm run compile:device` | Second and third emitters from the same graph |
| Closed-loop proof | `npm run verify:ir-cicd` (`scripts/verify-ir-cicd.ts`) | Ingest, stage, promote, lock, enforce, rollback, device compile, end to end |
| The two-way handshake | `npm run verify:handshake-writeback`, `npm run verify:handshake-pull`, `npm run verify:handshake-acceptance` | Both directions of the sync, guarded |
| Human gate surfaces | `src/app/api/wiki/finalize/route.ts`, `src/app/api/wiki/promote/route.ts`, `src/app/api/wiki/rollback/route.ts`, `src/app/api/wiki/pin-lock/route.ts` | Where promote actually happens |
| Blocks can go public | `src/app/api/share/route.ts`, `src/app/api/share/[id]/`, `src/lib/public-share/store.ts`, `src/app/share/[shareId]/` | Pillar two, shipped |
| Ingest from code | `src/lib/scan/` (see `run.ts`, `extract.ts`, `to-markdown.ts`) | How a repo becomes IR |
| Ingest from Figma | `src/lib/figma/` (`normalize.ts`, `import.ts`, `drift.ts`, `component-drift.ts`, `rest.ts`), `npm run verify:figma-import` | The wedge described in [Chapter 03](./03-what-blocksmith-is.md) |
| Protocol conformance | `packages/protocol/`, `npm run protocol:conformance` | Evidence the spec is testable by someone other than us |

Source documents behind this chapter: [`docs/00-thesis.md`](../00-thesis.md), [`docs/01-vision-and-positioning.md`](../01-vision-and-positioning.md), [`docs/PITCH-AND-PRODUCT-MODEL.md`](../PITCH-AND-PRODUCT-MODEL.md), [`docs/RESEARCH-INFRA-DESIGN-IR-AND-CICD.md`](../RESEARCH-INFRA-DESIGN-IR-AND-CICD.md), [`docs/PUBLIC-FEEDBACK.md`](../PUBLIC-FEEDBACK.md), [`docs/CEO-DIRECTIVE.md`](../CEO-DIRECTIVE.md), [`docs/TEAM-NORTH-STAR.md`](../TEAM-NORTH-STAR.md).

Next: [Chapter 03: What BlockSmith Actually Is](./03-what-blocksmith-is.md).
