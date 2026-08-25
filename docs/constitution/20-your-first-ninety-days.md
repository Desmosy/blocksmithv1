# Your First Ninety Days

**What this chapter covers:** a concrete onboarding path for the technical cofounder. What to read, in what order, what to run, what to break on purpose, what to own, and what to change only after you have earned the context.

**Why it matters:** this repository has a lot of surface area for its age. Wandering into it without a route costs weeks. This chapter is the route.

**Read this if:** you are the person who joined yesterday.

---

## The one thing to understand before anything else

BlockSmith has three planes. Almost every question you will have resolves to "which plane is this in".

| Plane | Job | Honest state |
|---|---|---|
| **Ingest plane** | Get an accurate design system in, from a repo, from Figma, from a paste, from a prompt | Broad and real, with uneven depth per source |
| **Control plane** | Represent it as versioned blocks, govern it, promote it, pin it | The strongest part of the system, and the claimed moat |
| **Output plane** | Emit it as a wiki, an MCP response, a package, generated code, a device profile | The thinnest part, and the one most likely to be your first ownership area |

If you remember nothing else from this book, remember that the control plane is ahead of the output plane, and that the gap between them is where the product currently loses credibility in a demo.

---

## Day one: get it running

Do these in order. Do not read code yet.

```bash
# 1. Install
npm install

# 2. Copy the env template and read every line of it
cp .env.example .env.local

# 3. Start the app
npm run dev
```

Then, in the browser:

1. Open the root URL. Signed out you get the marketing surface, signed in you get the dashboard.
2. Go to the dashboard and open one of the existing projects. There are real scan documents already in `data/uploads/`, so you will see a populated wiki without configuring anything.
3. Click through every tab of the wiki. Do not try to understand the code behind it. Just build a mental picture of what a customer sees.
4. Find the releases page. This is the pipeline console and it is the most conceptually important screen in the product.

Then run the aggregate verification suite:

```bash
npm run verify:software
```

This is the fastest way to learn what the system claims about itself, because every verify script is an executable assertion about real behavior. Read the output carefully. When something fails, that failure is information about the current state, not necessarily a bug you introduced.

## Day two to five: the reading path

Read in this order. The order matters, because each step is a prerequisite for the next one making sense.

| Order | Read | Why here |
|---|---|---|
| 1 | [Chapter 01](./01-origin-story.md) and [Chapter 02](./02-the-thesis.md) | You cannot evaluate a technical decision without knowing what problem it serves |
| 2 | [Chapter 03](./03-what-blocksmith-is.md) | Precise definitions, so you stop guessing what words mean |
| 3 | [Chapter 19](./19-glossary.md) | Skim it, then keep it open in a tab for a month |
| 4 | [Chapter 06](./06-system-overview.md) | The map of the whole repository |
| 5 | [Chapter 07](./07-design-ir-and-blocks.md) | The core. Read this one slowly and with the code open beside it |
| 6 | [Chapter 08](./08-ingestion-how-truth-gets-in.md) | How anything gets into the IR at all |
| 7 | [Chapter 10](./10-governance-and-design-cicd.md) | The claimed differentiator |
| 8 | [Chapter 09](./09-the-wiki-control-plane.md) | The human surface on top of all of it |
| 9 | [Chapter 11](./11-the-handshake-mcp-cli-sdk.md) | How it reaches the customer's repo and agents |
| 10 | [Chapter 12](./12-codegen-pulse-and-compile-targets.md) and [Chapter 13](./13-the-ai-layer.md) | The output plane and the AI boundary |
| 11 | [Chapter 14](./14-platform-tenancy-and-security.md) and [Chapter 15](./15-verification-and-quality.md) | What makes it safe to hand to a stranger |
| 12 | [Chapter 18](./18-decisions-and-tradeoffs.md) | Read this before you propose changing anything |
| 13 | [Chapter 16](./16-the-plan.md) and [Chapter 17](./17-what-we-still-need.md) | What comes next and what is missing |
| 14 | [Chapter 04](./04-market-and-competition.md) and [Chapter 05](./05-who-we-sell-to.md) | Who this is for and who else is trying |

Alongside the reading, do this exercise on day three: **trace one token end to end.** Pick a single color token in one of the scan documents in `data/uploads/`. Find where it was extracted from, where it becomes a block, where it gets a version, what the wiki does with it, what the MCP tool returns for it, what the lint engine does when generated code uses a near-miss of it, and what the generated package emits for it. Write the trace down. That single exercise teaches more than a week of reading, because it forces you through all three planes.

## Week two: break things on purpose

Reading code tells you what it does. Breaking it tells you what it guarantees.

Try each of these, observe the failure, then revert:

1. **Change a color in a scanned fixture component and re-scan.** Watch the block version change and the lock go stale. If nothing happens, you have found a real gap.
2. **Edit a governance rule in the wiki without promoting it.** Then query the MCP tool for the same block. The agent must still see the old official version. If it sees your draft, the enforcement boundary is broken and that is a serious bug.
3. **Write a component that uses a raw hex close to but not equal to a token, and run the CI gate.** Watch which tier fires and what fix it suggests.
4. **Delete a component from the fixture and re-scan.** It should be marked stale rather than silently disappearing from the lock.
5. **Run the code generator against a component whose source is not carried in the IR.** Watch it fall back through the emit tiers. This is the fastest way to feel the output-plane gap in your hands.

Write down every surprise. Surprises in week two are the most valuable artifact a new person produces, and they expire quickly once you acclimate.

## Week three and four: your first real contribution

Pick from this list. These are chosen because they are genuinely useful, they are bounded, and each one forces you through a plane boundary.

**Option A: close an output-plane gap.** The generated package is the weakest link in the demo. Find one component class where the emit falls back to a stub and make it faithful. This teaches you the scan IR, the interface extractor, the markdown round trip, and the faithfulness guard in one task.

**Option B: harden a durability boundary.** Several caches and rate limiters are per-instance and in-memory, which is fine locally and wrong in production. Move one of them fully onto the shared backend and extend the verify script that covers it. This teaches you the platform layer and the local versus hosted split.

**Option C: prove an unproven integration.** At least one external integration path has code but has never been run against a live external service. Get a real credential, run it, fix what breaks, and record the result. This is unglamorous and it is worth more than a feature, because "built, unproven" is the most dangerous status in the whole book.

**Option D: extend the drift surface.** Drift is the sharpest demo we have. Add one new kind of drift detection that the system cannot currently express, and surface it in the wiki. This teaches you the IR, the governance engine, and the wiki control plane together.

Whichever you pick, the completion bar is the same: **a verify script that fails before your change and passes after it.** That is the house standard.

## What you should own

The division of labor in a two-person company is mostly a fiction, but it is a useful fiction. Here is the proposed split, which you should push back on if it is wrong.

| Area | Suggested owner | Reasoning |
|---|---|---|
| Design IR semantics, hashing, versioning, lock | Shared, with an explicit review requirement | This is the moat. No one changes it alone |
| Output plane: codegen, package build, compile targets | You | It is the largest gap and it is well-bounded engineering |
| Platform: tenancy, storage, auth, rate limiting, deploy | You | It is the difference between a demo and a company, and it needs one owner |
| Ingest: scan, Figma, adapters | Founder initially, transitioning | It carries the most accumulated context about what customers actually have |
| Wiki UX and visual language | Founder | Taste is a stated product principle and it needs a single authority |
| Verify culture and quality bar | Shared, enforced by both | It only works if nobody is exempt |
| Positioning, pitch, customer conversations | Founder, with you present | You need the customer context to make good technical calls |

The rule that matters more than the table: **whoever owns an area owns its honest status.** If something in your area is "built, unproven", you say so out loud, in the pitch, in the docs, and in this book. The single fastest way to destroy a two-person company is for each person to assume the other person's area works.

## The rules you should not break in your first ninety days

These are not permanent laws. They are the settled decisions where reverting them without full context has a high chance of costing weeks. Chapter 18 explains the reasoning behind each one.

1. **Do not add a second AI vendor.** The stack is deliberately single-vendor with model fallback inside it.
2. **Do not evaluate model-produced JSX on the client.** That is the XSS boundary and it is absolute.
3. **Do not let the AI write CSS or invent tokens.** The LLM selects and arranges within validated constraints. Deterministic composition first, always.
4. **Do not build a second admin surface.** If it helps a team control design truth, it ships in the wiki.
5. **Do not import Figma frames or screens.** Tokens and published components only. Crossing that line puts us in a different company's business.
6. **Do not reintroduce the deleted from-scratch font engine.** That path was tried and judged unusable.
7. **Do not mix the browser-extension story into the design-system pitch.** Different ICP, different meeting.
8. **Do not let a verify script rot.** A stale green check is worse than a red one.

If you want to change one of these, that is legitimate. Write the case, put it in Chapter 18 as a superseding decision record, and get explicit agreement. What is not acceptable is quietly drifting away from one.

## How we work

- **Everything connects to promote-then-lock within two hops.** If a proposed feature cannot be traced to the control plane in two steps, it does not ship. This rule has already killed good ideas, which is what makes it useful.
- **Honesty about status is a hard requirement.** Use the vocabulary in `STYLE.md`. Shipped, Built-unproven, Partial, Planned, Idea. Overclaiming inside the team is how a small company walks into a customer meeting and gets caught.
- **The verify script is the unit of proof.** A claim without one is an opinion.
- **This book is maintained.** When you make a decision, add it to Chapter 18. When you close a gap, update Chapter 17. When you change the architecture, update Chapter 06. A constitution that is not maintained becomes exactly the stale wiki this company exists to prevent, which would be an unusually embarrassing way to fail.

## The ninety day success condition

At the end of ninety days you should be able to do all of the following without help:

1. Take a stranger's repository, scan it, and open a wiki that a design lead would find useful.
2. Connect a Figma file and show that team a real drift between their design source and their shipped code.
3. Explain, at a whiteboard, why the block graph is the moat and where the moat is currently thin.
4. Run the full verification suite, interpret every failure, and say which are real.
5. Ship a change through the whole loop, from scan through promote through lock through an agent consuming the new version.
6. Disagree with the founder about a technical direction and support it with evidence from the code.

That last one is the actual point of hiring a technical cofounder. Everything above it is preparation for it.

---

## Open questions

- Is the ownership split above right, or does the founder need to keep the platform layer to stay close to production reality?
- What is the trigger for revisiting the parked browser extension track, and who decides?
- Should the verify culture be supplemented with real unit tests now, or does that wait until there is a third engineer? See [Chapter 15](./15-verification-and-quality.md).

## Where to look in the code

| Path | Why |
|---|---|
| `package.json` | Every script you will run, all in one place |
| `docs/constitution/` | This book |
| `docs/PRODUCTION-CHECKLIST.md` | The operational runbook |
| `scripts/verify-*.ts` | The executable definition of what the system claims |
| `fixtures/vendor-ui/` | The golden fixture to experiment against safely |
| `data/uploads/` | Real scan documents to trace by hand |
