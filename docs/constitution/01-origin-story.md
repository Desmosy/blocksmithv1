# How The Idea Was Born

**What this chapter covers:** where BlockSmith came from, the specific experience that produced the insight, the shift in the world that made it urgent, and the actual sequence of events from the first commit to today.

**Why it matters:** you cannot make good decisions inside a system whose origin you do not understand. Half the choices in this codebase look arbitrary until you know what problem the founder was staring at when he made them. This chapter gives you that context so the rest of the book reads as consequence rather than as a list of features.

**Read this if:** you just joined and someone told you "we do design governance for AI agents" and you nodded politely without knowing what that meant.

---

## The short version

BlockSmith was born from one observation made twice, five years apart, in two very different worlds.

The first time: inside a real product organization, watching a large distributed team fail to ship cohesive UX, not because anyone was bad at design, but because there was no single place where the design system was true. The fix was not more documentation. The fix was a wiki that centralized what was canonical and linked the workflows together, so that a human could open one page and know what the system said.

The second time: watching AI coding agents arrive and immediately recreate the exact same failure, at ten times the speed, in a new file format. Teams started writing `CLAUDE.md`, `AGENTS.md`, and `DESIGN.md`. These files worked. Agents stopped hallucinating buttons. And then the files grew, and grew, and within months the design system had once again scattered across a dozen markdown documents that no human could hold in their head, except now the drift was invisible because the agents kept happily producing plausible output from stale rules.

The insight is the intersection of those two observations. **A design system needs one source of truth that is simultaneously legible to a human and consumable by a machine, and those two requirements pull in opposite directions.** Long flat markdown is great for an agent and terrible for a person. A beautiful rendered wiki is great for a person and useless to an agent unless something keeps it byte-accurate with the code. Nobody was building the layer that satisfies both at once and keeps them from diverging.

BlockSmith is that layer.

---

## The first observation: a global community product company

The founder worked with the design systems team at a company whose product connects neighbors and communities across the world. The scale was large, the surface area was large, and the teams were distributed.

The visible symptom was that the product did not feel like one product. Different surfaces used different spacing. The same semantic action looked different in three places. Nobody was careless. The problem was structural.

The design system existed, but it existed in fragments:

- Some of it lived in Figma, in files and comments.
- Some of it lived in Notion pages, written at different times by different people, several of them contradicting each other.
- Some of it lived in Slack threads where a decision was made and never written down anywhere else.
- Some of it lived only in the heads of the three engineers who had been there longest.

When a designer asked "what is our canonical primary button", there were four answers and no way to tell which one was current.

The work that actually fixed it had three parts:

1. **Clarify.** Decide, explicitly, what is canonical. Which tokens. Which components. Which workflows. This is a human judgment act, and it is irreducible. No tool decides this for you.
2. **Centralize.** Put the canonical answers in one internal wiki, so there is exactly one place to look.
3. **Link.** Connect the workflows so that design, product, and engineering were all navigating the same map rather than three separate maps that happened to share vocabulary.

It worked. And then the hard part started, which is that the wiki had to **stay current**. A wiki that is accurate on the day it is written and stale three months later is worse than no wiki, because people trust it and are wrong. Every design-system wiki in the industry has this failure mode. The manual refresh cycle is the thing that kills them.

That unsolved problem, keeping a human-legible source of truth automatically synchronized with the code that actually ships, is the seed of BlockSmith.

## The second observation: agent documentation exploded

Then coding agents became genuinely useful, and something new appeared in repositories everywhere: files written by humans, for machines, about design.

`CLAUDE.md`. `AGENTS.md`. `DESIGN.md`. `design.md`. Token dumps pasted from Figma. Component rules. "When building a card, always use the surface token, never a raw hex." Repo-local instruction files tuned for Cursor, for Claude Code, for whatever MCP server the team had wired up.

This was a good development. Agents need structured context or they invent UI, and invented UI is off-brand by default. Every team that wrote one of these files got better output immediately.

But the founder saw the shape of what came next, and made a bet on it:

> These files will keep growing. More rules, more edge cases, more "when building X, do Y". Teams will treat markdown as the default machine-readable design-system brain.

That bet is the foundation of the company. If it is wrong, BlockSmith has no market. So far it has been right, and the growth curve of these files inside real repositories is the single best leading indicator to watch.

Here is why the growth is a problem rather than a success.

| What the agent experiences | What the human experiences |
|---|---|
| Can grep, chunk, and ingest a two thousand line `design.md` without complaint | Opens the file, scrolls, gives up, asks someone in Slack instead |
| Tolerates flat structure, inconsistent headings, and duplicated rules | Cannot find the map, cannot tell which of two contradicting paragraphs is current |
| Does not perceive hierarchy or product tone, so it does not care that there is none | Needs to judge in ten seconds whether the direction still matches the team's taste |
| Applies whatever rule it finds, including the stale one | Cannot audit five hundred lines of markdown weekly, so never notices the stale one |

The failure mode is precise: **too much documentation for agents becomes too messy to control with human eyes.** Governance quietly breaks. Nobody knows which paragraph is canonical. Design drift hides in file seven of twelve. New hires never read the wall of text, and PMs certainly never do.

And the agents keep shipping, confidently, from the stale rules. That is the part that makes this urgent rather than merely annoying. In the pre-agent world, drift was slow because a human had to type every divergence. In the agent world, one wrong line in a `design.md` propagates into hundreds of components in an afternoon.

## The synthesis

Put the two observations together and you get the thesis.

Humans are strong at exactly the things rules compress badly: intuition about what feels right for this product and these users, creativity about novel flows and emotional tone, and direction about what to optimize, what to simplify, and what not to build at all.

Agents are strong at execution inside rules: consistency, speed, and applying a constraint at scale without getting bored.

The interface between those two strengths cannot be a thousand-line markdown file. That interface needs to be:

- **Rendered**, so a human can judge it at a glance.
- **Structured**, so a machine can consume it exactly.
- **Versioned**, so you can tell what changed and when.
- **Two-way**, so a decision made in either place shows up in the other.
- **Auto-updating**, so it never becomes the stale wiki that killed every previous attempt.

That is the whole product. Everything in this repository is an attempt to build that interface and to prove it works.

## The engineering background that shaped the ambition

The founding team are computer engineering majors, not exclusively web developers. That matters for one specific reason: it made the long-term vision go **down the stack** rather than sideways.

Most people who build a design-system tool imagine a bigger design-system tool. The founder imagined the same governed representation compiling to a watch face, an industrial HMI panel, and eventually a device UI layer where a user controls the interface of hardware they own. The phrase used internally is "one design package, multiple compile targets."

This is why you will find `scripts/compile-device.ts` in a repository that is otherwise a Next.js web application. It is not a distraction. It is a deliberate early marker of where the intermediate representation is meant to go, planted so that the design of the IR does not accidentally become web-only and unportable.

The discipline applied on top of that ambition is equally important, and it is stated in `docs/00-thesis.md` as a rule: **ship one correct software loop before hardware or new languages.** The hardware track is real and it is not now.

## The north star, stated plainly

The long-term thesis, in the founder's own framing, is that a sufficiently strong governed UI engine lets a person restyle or restructure anything they encounter, not only documents they upload.

The delivery vehicle for that is a browser extension that applies a user's own design system to live third-party sites. The canonical example used internally is "change Facebook's layout from a prompt." Every user gets independent, personal control over any interface they meet.

The step beyond that is extending the same control down to the hardware UI layer, so that per-user UI control applies below the browser, to device and operating system interfaces. The computer engineering background is the wedge for going below the web stack.

You need to understand two things about this north star.

First, it is genuinely the point. The current product is not a compromise that abandoned the vision. The governed Design IR plus the deterministic-composition-with-validated-AI engine is exactly the substrate the extension would need. The wiki proves the engine on documents that a team owns. The extension is the same engine pointed at the live DOM of arbitrary sites. The faithfulness and governance guarantees, the legibility guardrails, and the no-invented-tokens validation are precisely what make "rewrite any site" trustworthy instead of chaotic.

Second, it must never be the pitch to a design-system buyer. A Figma-centric design-system lead does not care that you can restyle a stranger's website. They care that their own system is enforced. Mixing the two stories in one meeting makes the near-term product sound unserious. This separation is a standing decision, recorded in [Chapter 18](./18-decisions-and-tradeoffs.md), and it is not negotiable in customer-facing material.

## The pre-launch feedback pillar

There is a second, less obvious pillar of the thesis that is easy to miss because it is smaller in the code today.

Design teams almost never get real human signal on specific UI before they ship. They get internal critique, Figma comments, and design review, all from people who are already inside the bubble. They get analytics after launch, which is too late and too coarse. They occasionally get an A/B test on the live product, which is slow and risky.

What they do not get is a stranger's honest opinion on **this button**, **this color pair**, **this label**, in context, before the thing ships.

The reason nobody gets that today is structural. Components live inside private repos, staging URLs, and Figma files that outsiders never see. Sharing the whole app is heavy. Sharing a screenshot loses the interactivity and the comparability. There is no lightweight path from "canonical design block" to "public or semi-public view" to "structured feedback tied back to that block."

BlockSmith has an accidental advantage here, because the wiki is already built out of blocks. Tokens, components, and surfaces are addressable, versioned objects. That granularity is exactly what makes it possible to release one block to public view without exposing the product, collect opinion attached to a specific block ID and version, and feed the result back into the same graph that agents and engineers read.

This is why you will find share routes and an opinion panel in the codebase. It is a real pillar, currently the least built of the three.

## What actually happened, in order

The repository history is short and dense. The first commit is dated 2026-06-05. Here is the real sequence, because knowing what was tried and abandoned is more useful than knowing only what survived.

**Week one, early June 2026. Getting truth in and out.**
The first working loop was paste and scan. Point BlockSmith at a repository, walk the code, extract CSS variables, colors, Tailwind utilities, components, and sections, and write a scan markdown document. Render that document as a wiki. Almost immediately the deployment reality of Vercel forced a series of corrections that still shape the code: git clone does not work on serverless, so GitHub scans stream a tarball through the API and extract with node tar. The filesystem is read-only except for `/tmp`, so audit paths and disk writes had to move. Documents cannot be written back to a JSON file in the repository on a serverless host, so cloud storage became Supabase-only in hosted mode.

**Also week one. Visualize, and a hard lesson about AI.**
An early version rendered a preview using semantic guesses. It was replaced with an AI-only ensemble, then corrected again, because a five minute wait with nothing on screen is a worse product than an instant approximate preview. The resolution was the hybrid that survives today: an instant deterministic semantic preview from the scan IR, with an optional AI refinement that arrives in the background and is discarded if it times out. This is the first appearance of the pattern that later became the core architectural principle of the whole system, deterministic composition first with AI constrained on top.

**Mid June 2026. The protocol turn.**
On 2026-06-09 and 2026-06-10 the project acquired its spine: a Design IR and design CI/CD reference implementation, built in collaboration with a professor, followed by a durable IR registry, the wiki Pipeline console, and the `@blocksmith/protocol` package. This is the moment BlockSmith stopped being a documentation renderer and became infrastructure. The framing that came out of it, that the block graph is to design what TCP/IP is to networking and that the wiki and the package are compile targets rather than competing truths, is the framing the company still uses.

**Mid June 2026. Distribution and the release surface.**
The CLI was bundled into a single zero-dependency npm package and published, deliberately, so that adoption never requires a dependency negotiation inside a customer's repo. A security gate, email auth, and the publish foundations followed. Then three-tier governance landed, with block-level and warn-level checks, a violations feed, and prescriptive Tier 3 fixes surfaced through MCP so an agent can be told not only that it is wrong but exactly what to write instead.

**Late June 2026. The Figma wedge and the dashboard.**
On 2026-06-23 two things landed together: Figma import with a connector, and a projects dashboard. The dashboard mattered because until then there was no home base. Projects were scattered across scans and uploads with no interface to see them. The Figma import mattered for a different reason: it is the commercial wedge. Design-system teams live in Figma. Meeting them there and then showing them drift between what Figma says and what their shipped code says is the sharpest demo the product has.

The founder's explicit constraint on the dashboard is worth recording because it recurs: it should look like Canva or Figma, with no gradients and no AI-slop aesthetics. Taste is a stated product principle, so the product itself has to demonstrate it.

**Late June 2026. The output plane reckoning.**
A deep technical review found something uncomfortable. The control plane, meaning the registry, lock, promote, and drift machinery, was real and solid. The output plane was not. Code generation stamped a `<div>{children}</div>` stub for every component except a single hand-written `Button`. The root cause was that the scan IR captured only file paths, exports, CSS variables used, and colors used. It never captured component structure, so faithful code generation was literally impossible from the data available.

Three options were on the table: reposition the control plane as the whole product, make code generation real by enriching the scan IR, or ship governed wrappers as a middle path. The founder chose to make code generation real. The consequence was a component interface extractor that reads props, variants, defaults, extends clauses, children, and root element from TSX using the TypeScript syntactic API, and a three-tier emit strategy where verbatim source is preferred, an IR-synthesized signature is the fallback, and a generic stub only appears when there is no IR at all. A verify script now asserts faithfulness so the pipeline cannot silently regress.

That episode is the single best lesson in the repository: **the richness of your intermediate representation is a hard ceiling on the quality of everything downstream of it.** When output quality is bad, look at the IR before you look at the generator.

**Late June 2026. The money shot.**
The governed versus ungoverned generation demo went live as a real multi-tenant service rather than a canned demo, at the founder's insistence. One prompt goes to two parallel model calls, one with no context and one grounded in the tenant's approved tokens and components. The drift between them is scored by the same lint engine that powers the CI gate and the MCP validation tool. That last detail is the entire credibility of the demo: the numbers on screen are produced by real enforcement code, not by asking a model to grade itself.

**End of June 2026. Production hardening.**
Distributed rate limiting through Upstash Redis, tenant-scoped dashboard reads off the ephemeral filesystem, ownership registration on every create and import path, security headers, Sentry, a branded error surface, legal drafts, first-run onboarding, and startup configuration warnings. This is the unglamorous work that turns a demo into something you can hand to a stranger.

That is where the repository stands as this book is written. The branch `feat/figma-import-and-dashboard` carries a large amount of this work.

## The three things you should take from this chapter

1. **The problem is old and the urgency is new.** Design systems have always lacked a single source of truth. Agents did not create that problem, they made it expensive enough to be worth a company.

2. **The wiki is not the product and the protocol is not the product. The pair is the product.** Every time someone tries to simplify BlockSmith into one of the two, the value collapses. A wiki without the IR is a Notion clone that goes stale. An IR without the wiki is a schema nobody adopts. The reason to build both is that the synchronization between them is the actual thing customers cannot get anywhere else.

3. **The order of construction was deliberate and it should stay deliberate.** Truth in, then governance, then handshake, then output, then compile targets. When a shortcut is proposed that skips a layer, the layer it skips is usually the one that makes the claim credible.

---

## Open questions

- Does the growth of agent design documentation continue, or do agents get good enough at reading the code directly that the markdown layer disappears? This is the largest single risk to the thesis and it deserves an explicit tracking metric.
- Is the pre-launch feedback pillar a real second product or a feature of the first one? It has been stated as a pillar for months and built the least, which usually means one or the other is not true.
- How long should the browser extension track stay parked? It is the north star and it is currently untouched. There is a real risk that it stays parked until someone else builds it.

## Where to look in the code

| Path | Why it is relevant to this chapter |
|---|---|
| `docs/00-thesis.md` | The original thesis document this chapter expands |
| `docs/01-vision-and-positioning.md` | The origin section and the positioning ladder |
| `docs/PITCH-AND-PRODUCT-MODEL.md` | The canonical non-confusing story for outsiders |
| `docs/TEAM-NORTH-STAR.md` | The alignment contract that turned the thesis into build rules |
| `git log --reverse` | The actual sequence of events described above |
| `src/lib/scan/` | The first working loop, getting truth in |
| `src/lib/ir/` | The protocol turn, mid June |
| `src/lib/codegen/pulse.ts` | The output plane reckoning |
| `src/lib/ai/governed-generate.ts` | The money shot demo |
