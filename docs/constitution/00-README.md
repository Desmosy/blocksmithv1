# The BlockSmith Constitution

This folder is the guiding book for BlockSmith and the UI AI Lab. It explains the company from scratch: where the idea came from, what we are building, how the system actually works, what we decided and why, what the plan is, and what is still missing.


**Treat this as the constitution.** When a document elsewhere in the repository contradicts this book, this book is what we meant, and the other document is what we wrote at some earlier point. When this book is wrong, fix this book rather than working around it.

---

## How to read this

You do not have to read it in order, but the first time through you should.

**If you have one hour:** read Chapter 01, Chapter 03, and Chapter 06. That is the origin, the definition, and the map.

**If you have one day:** add Chapter 02, Chapter 07, and Chapter 10. That is the argument, the core representation, and the differentiator.

**If you are joining the company:** read all of it in order, then follow the path in Chapter 20.

**If you are about to change something:** read Chapter 18 first. It exists so that settled questions stay settled and so that reversing a decision is a deliberate act rather than an accident.

---

## The chapters

### Part I. Why this exists

| Chapter | Title | What it answers |
|---|---|---|
| [01](./01-origin-story.md) | How The Idea Was Born | Where this came from and what actually happened, in order |
| [02](./02-the-thesis.md) | The Thesis: Why BlockSmith Has To Exist | The argument, the falsifiable claims, and the principles |
| [03](./03-what-blocksmith-is.md) | What BlockSmith Actually Is | Precise definitions, the layered stack, and what we are not |
| [04](./04-market-and-competition.md) | The Market, The Competition, And Where We Fit | Category, competitors, moat, threat model, timing |
| [05](./05-who-we-sell-to.md) | Who We Sell To And How We Reach Them | ICP, pains, wedge, distribution, pitch, pricing |

### Part II. How it works

| Chapter | Title | What it answers |
|---|---|---|
| [06](./06-system-overview.md) | The System From Ten Thousand Feet | The map of the entire repository and the three planes |
| [07](./07-design-ir-and-blocks.md) | The Design IR: Blocks, Versions, And The Protocol | The core representation, the claimed moat |
| [08](./08-ingestion-how-truth-gets-in.md) | Ingestion: How Design Truth Gets In | Repo scan, Figma, paste, prompt, vision, adapters |
| [09](./09-the-wiki-control-plane.md) | The Wiki: Where The Company Lives | The human surface and the release console |
| [10](./10-governance-and-design-cicd.md) | Governance And Design CI/CD | Tiers, lint, promote, lock, the CI gate, drift |
| [11](./11-the-handshake-mcp-cli-sdk.md) | The Handshake: MCP, CLI, SDK, And Two-Way Sync | How we reach the customer's repo and their agents |
| [12](./12-codegen-pulse-and-compile-targets.md) | The Output Plane | Faithful codegen, the package, device targets, font-generator |
| [13](./13-the-ai-layer.md) | The AI Layer | Deterministic composition with validated generation |
| [14](./14-platform-tenancy-and-security.md) | The Platform | Tenancy, auth, storage, rate limits, security, deploy |
| [15](./15-verification-and-quality.md) | How We Know It Works | The verify culture and every script in it |

### Part III. What we do next

| Chapter | Title | What it answers |
|---|---|---|
| [16](./16-the-plan.md) | The Plan: Phases, Streams, And Sequencing | Where we are, what order things happen, and why |
| [17](./17-what-we-still-need.md) | What We Still Need | Launch gates, debt, product gaps, proof gaps, hiring |
| [18](./18-decisions-and-tradeoffs.md) | The Decision Record | Every settled choice, with the reasoning preserved |
| [19](./19-glossary.md) | Glossary | The words we use precisely |
| [20](./20-your-first-ninety-days.md) | Your First Ninety Days | The onboarding path for a new cofounder |
| [21](./21-the-north-star-tracks.md) | The North Star Tracks: Restyle The Web, Then The Device Layer | The two parked long-horizon tracks, what exists, and what would unpark them |
| [22](./22-metrics-proof-and-research.md) | Proof: Metrics, Research, And How We Know We Are Winning | What we measure, what would falsify us, and what the research track owes the product |

`STYLE.md` in this folder is the writing contract for the book itself, not a chapter.

---

## A warning about this book's honesty

The chapters were written by reading the code, not by summarizing the older planning documents. That means several of them contradict documents elsewhere in `docs/`, and several of them say uncomfortable things about the current state of the product.

That is deliberate. A constitution that flatters us is worthless. Where a chapter says something is **Partial** or **Built, unproven** and an older doc says it is done, believe the chapter, then go check the code yourself.

The reading pass that produced this book also surfaced a set of concrete defects and inconsistencies in the codebase. They are recorded inside the relevant chapters rather than collected here, because a defect is only actionable next to the explanation of what the thing was supposed to do.

---

## The shortest possible summary

Teams are accumulating design documentation written for AI agents, and that documentation is growing past the point where any human can govern it. What is good for an agent, long flat greppable markdown, is bad for a person. What is good for a person, a rendered browsable wiki, is useless to an agent unless something keeps it byte-accurate with the code that ships.

BlockSmith is the layer that satisfies both at once. It ingests a design system from a repository, from Figma, or from a document. It represents that system as a graph of versioned blocks, which is the Design IR. Humans browse and govern that graph in a wiki, and promote changes the way you merge to main. Agents, packages, and CI gates consume only the promoted version, pinned in a lock file. Drift between what the design source says, what the code says, and what the agents are told becomes visible instead of invisible.

The near-term commercial wedge is Figma. The long-term thesis is that the same governed engine eventually gives any person control over any interface they encounter, first on the web through a browser extension, and later below the browser at the device layer.

The three planes to keep in your head: **ingest** is broad, **control** is strong and is the moat, **output** is the thinnest and is where the next serious work is.

---

## Maintaining this book

This book has the same failure mode as every design-system wiki ever written, which is going stale while everyone still trusts it. That would be a particularly embarrassing way for this company to fail, given what we sell.

The rules:

- When you make a decision that closes an option, add a record to [Chapter 18](./18-decisions-and-tradeoffs.md) in the same change.
- When you close a gap, update [Chapter 17](./17-what-we-still-need.md) in the same change.
- When you change the architecture, update [Chapter 06](./06-system-overview.md) and the specific chapter for that plane.
- Status words are load-bearing. Use the vocabulary in `STYLE.md`: Shipped, Built-unproven, Partial, Planned, Idea. Do not upgrade a status without the evidence to back it.
- No em dashes. See `STYLE.md`.
