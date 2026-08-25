# The Decision Record: What We Chose And Why

**What this chapter covers:** every consequential architectural, product, and business decision made in BlockSmith so far, written as a numbered record with the situation that forced it, the options that were really on the table, what was chosen, the evidence behind it, and the condition under which it would be right to change.

**Why it matters:** this is the chapter that protects you. A codebase this young with this much surface area accumulates choices that look arbitrary from the outside and are load-bearing from the inside. Without a record, a new cofounder does one of two harmful things: relitigates a settled question and burns a week, or quietly reverts a hard-won choice because the old way looked simpler. Both have already almost happened here. The font-generator engine was rebuilt once because nobody wrote down why the first one was thrown away.

**Read this if:** you are about to change something and you want to know whether you are fixing a mistake or undoing a decision.

---

## How to use this chapter

Each record has a fixed shape. Read the **Do not revert unless** line first. If the condition it names is not true today, stop, and go build something else. If it is true, you have a real case, and you should write a new record superseding the old one rather than editing the old record in place. Decision records are append-only, exactly like block versions in [Chapter 07](./07-design-ir-and-blocks.md). That symmetry is deliberate.

**Status** uses three words only:

| Word | Meaning |
|---|---|
| **Standing** | Currently in force. Code and docs reflect it. |
| **Superseded by D-NN** | Replaced. Kept because the reasoning still explains code you will find. |
| **Under review** | The founder has flagged it, evidence is being gathered, do not build deeply on it. |

Dates are as accurate as the repo allows. Where a decision was recorded in the founder's own memory notes with an explicit date, that date is used. Where it can only be dated by a commit, the commit hash is given. Where it was never dated and only inferred from docs, it says so.

---

## Part I: The shape of the product

### D-01. The wiki is the control plane, not a separate admin app
**Date:** 2026-06-10, formalized in `docs/TEAM-NORTH-STAR.md` and `docs/CEO-DIRECTIVE.md`.

**Status:** Standing.

**Context:** Once block versions, promote, rollback, and lock generation existed, there was an obvious next build: a "Jenkins for design" admin console, separate from the wiki, where release engineers manage the pipeline. It is the shape every CI tool has. Meanwhile the wiki existed and was already the thing customers opened.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| Separate admin app for pipeline and releases | Familiar mental model, clean separation of the "documentation product" from the "release product". But it splits the user's attention across two apps, and it means the block page a designer reads and the block record an engineer promotes are two different objects in two different UIs, which is exactly the divergence BlockSmith exists to prevent. |
| Pipeline UI inside the wiki, on the same pages as the content | One place to be. The component page and the release record are the same page. Costs more design work, because a documentation surface has to also carry state, badges, diffs, and destructive actions without feeling like an admin tool. |
| Wiki for reading, CLI only for promoting | Cheapest. But promote is a human judgment act, and judgment does not happen well in a terminal for a design lead who is not an engineer. |

**Decision:** Everything ships in the wiki first. The pipeline lives at `/wiki/pipeline`, releases at `/wiki/releases`, and the promote and rollback actions are `POST /api/wiki/promote` and `POST /api/wiki/rollback`. CLI, MCP, and CI are consumers of what humans promote in the wiki, never alternative places to promote.

**Why:** The whole thesis of the company is that design truth fragments when it lives in more than one place ([Chapter 02](./02-the-thesis.md)). Shipping a second app to manage the first app would reproduce the disease in our own product. `docs/TEAM-NORTH-STAR.md` states the rule as a table of "do not build / build instead" pairs, and the top row is "separate Jenkins for design admin app" against "pipeline UI inside the wiki". The CEO directive restates it: "The wiki is not a documentation site. It is the operating system where companies live."

**Consequences:**
- Easy: a single mental model for customers. One URL. One nav. A designer and a release lead are looking at the same object.
- Easy: every new capability has an obvious home, because the question "where does this go" always answers "on the block page or in a wiki route".
- Hard: the wiki has to carry heavy state UI. `src/components/wiki/` is large and gets larger. Version badges, lock freshness, conflict resolution, and diff drawers all have to live inside a reading experience without wrecking it.
- Forecloses: selling a standalone "design pipeline" product to a team that does not want a wiki. If a customer ever says "we already have Zeroheight, we just want the promote gate", we currently have no product for them.

**Do not revert unless:** a real paying customer requires the release console to exist outside the wiki, for example because their design system documentation already lives somewhere else and they will not migrate it. Even then, the correct move is a headless API plus an embeddable surface, not a second full app.

---

### D-02. One package per product, not one per user
**Date:** 2026-06-10, `docs/TEAM-NORTH-STAR.md`.

**Status:** Standing.

**Context:** The Pulse compile target emits an importable npm package from a design system. The obvious SaaS instinct is to scope artifacts per account, because accounts are what you bill and authenticate. The question was whether `@blocksmith/<something>` is per user, per org, or per product.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| One package per user | Trivially isolated, no sharing bugs. But it destroys the entire point: two engineers on the same team would import two different packages built from two different graphs, which is drift with extra steps. |
| One package per org | Simple billing story. But a company with three products has three design systems and would be forced into one package or into three orgs. |
| One package per product, where a product is one design document and its block graph | Matches how design systems actually exist. Costs a clear definition of what a "product" is, and requires org membership to grant access to a shared artifact rather than to a personal one. |

**Decision:** One team maps to one design system maps to one package. The unit is the design document (the `docRef`, for example `upload:scan-acme-mobile-app.md`), not the user. Every member of the org sees the same wiki, shares the same promoted graph, and pulls the same `blocksmith.lock`. Roles control **who may promote**, not which artifact you get.

**Why:** Stated directly in `docs/TEAM-NORTH-STAR.md`: "Not one package per user. One released artifact per product the team owns." The reasoning is that a per-user artifact makes the lock file meaningless. A lock exists so that two agents on two machines on two days produce the same UI. If each machine pins a different package, there is nothing to agree on.

**Consequences:**
- Easy: the lock file, the CI gate, and MCP enforcement all have a single unambiguous referent.
- Easy: the RBAC model is small. Roles gate an action, not a resource fork.
- Hard: onboarding a single individual is slightly awkward, because a solo user still gets a "product", and the vocabulary of "org" and "team" is heavy for one person. The dashboard papers over this by calling them projects.
- Forecloses: personal, per-engineer overrides of the design system. There is deliberately no supported way for one engineer to pin a variant graph. That is drift by definition.

**Do not revert unless:** a genuine multi-tenant-inside-a-tenant case appears, for example an agency that maintains fifty client systems under one org and needs per-client isolation. That is solved by more documents, not by per-user packages.

---

### D-03. `design.md` is the universal interchange format every ingest path funnels into
**Date:** Established at project start (2026-06-04 to 2026-06-06, `docs/00-thesis.md`), reinforced for every ingest source added since.

**Status:** Standing.

**Context:** Truth can enter BlockSmith from a repo scan, a pasted markdown file, an uploaded file, a GitHub URL, a Figma file, a screenshot, a prompt, and eventually a live webpage. Each of those has a natural native shape. The question was whether each source gets its own pipeline into the wiki, or whether they all converge on one document format first.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| Each source gets a bespoke path to the wiki | Fastest per source. Each new source is a new renderer, a new governance path, a new MCP shape, and N times the surface area to keep consistent. Governance rules would have to be reimplemented per source. |
| Every source normalizes into `design.md` (workspace-scan markdown), which the wiki, governance, and MCP already understand | One renderer, one parser, one governance model. Costs an adapter per source, and forces some sources into a format that is not their native shape. |
| Every source normalizes directly into the block graph JSON, skipping markdown | Cleaner in theory. But then the document is not human-editable, and the wiki's "edit the source" affordance disappears, along with the ability to paste a design system in by hand. |

**Decision:** Every ingest path produces `design.md`, specifically the workspace-scan markdown shape carrying `blocksmith-source: workspace-scan`. The Figma importer builds a synthetic `WorkspaceScanResult` and runs it through `workspaceScanToMarkdown` precisely so that the wiki, parse, governance, and MCP paths render it for free. The capture path emits the same `data/uploads/design-*.md` format the wiki already renders.

**Why:** The founder's own note on the Figma wedge states the rule as an implementation instruction: reuse the existing scan pipeline, emit tokens as `ScannedCssVar[]` and `ScannedColor[]`, build a synthetic scan result, and let everything downstream work unchanged. This is why Figma import took days instead of weeks. It is also why the screenshot capture path in `src/lib/ingest/capture.ts` needed no wiki work at all.

**Consequences:**
- Easy: adding a source is an adapter, not a feature. The downstream half is already built and already tested.
- Easy: a human can always read and hand-edit what a machine ingested, because it is markdown.
- Hard: some sources lose fidelity on the way in. A Figma component set has structure that markdown headings represent awkwardly, which is why structural data is smuggled through as invisible HTML comments (see D-11).
- Forecloses: source-specific rendering. A Figma-imported system and a scanned repo look the same in the wiki, by design. If a customer wants a Figma-shaped view of a Figma import, we do not have one.

**Do not revert unless:** a source appears whose data cannot survive the markdown round trip at all, and the loss is customer-visible. Even then, extend the round-trip encoding first (D-11 shows how), and only fork the pipeline as a last resort.

---

### D-04. Publish `blocksmith.blocks.v1` as a protocol, not an internal file format
**Date:** 2026-06-06 (`4780e70`, docs) through 2026-06-10 (`51808f8`, durable registry) and the `packages/protocol` package.

**Status:** Standing.

**Context:** The block graph could have stayed a private implementation detail. Making it a public spec costs real work: JSON schemas, a conformance suite, a spec site, a versioning policy, and a commitment not to change hash semantics casually.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| Keep the IR private | No spec maintenance, total freedom to refactor. But then the moat is a product, and products get cloned. |
| Publish the schema as documentation only | Cheap credibility. But nobody can actually verify their emitter, so "open standard" is a claim, not a fact, and the first serious adapter author finds the doc is wrong. |
| Publish schemas plus a zero-dependency package plus a runnable conformance suite | Highest cost. But a third party can install `@blocksmith/protocol`, run the fixtures, and prove their emitter without cloning BlockSmith. |

**Decision:** Ship the full protocol product: four public schemas (`blocksmith.blocks.v1`, `blocksmith.lock.v1`, `blocksmith.registry.v1`, `blocksmith.compile-targets.v1`), a standalone `packages/protocol` workspace package with byte-identical hashing, a conformance suite runnable via `npm run protocol:conformance`, and a `/protocol` spec site.

**Why:** The category claim is "Figma is Ethernet, BlockSmith is TCP/IP". That claim is only defensible if the middle layer is genuinely neutral and independently implementable. `docs/PROJECT-PROTOCOL.md` sets the definition of done as "external repo can `npm install @blocksmith/protocol` and validate a graph, no BlockSmith app clone required". The evidence that this was worth it: the CI drift gate between the app's `src/lib/ir/hash.ts` and the package's hashing already caught a real divergence (a NUL-byte separator difference) that would have silently broken every third-party lock.

**Consequences:**
- Easy: the open-source story (D-26) has something real to open.
- Easy: adapters and compile targets can be written by people who do not work here.
- Hard: hash semantics are now frozen in practice. Changing them is a spec bump with a migration doc, not a refactor.
- Forecloses: fast iteration on the block shape. Minor additions need review; major changes need `blocks.v2`.

**Do not revert unless:** no third party has ever run the conformance suite after a serious attempt to get them to, and the maintenance cost is measurably slowing the product. Even then, keep the schemas and drop the spec site, not the reverse.

---

### D-05. Append-only versions, an `official` pointer, and stale rather than deleted
**Date:** 2026-06-09 to 2026-06-10, implemented in `src/lib/ir/registry.ts`, specified in `docs/PROJECT-PROTOCOL.md`.

**Status:** Standing.

**Context:** When a block changes, you can either mutate it in place or write a new version. When a block's source disappears from the repo, you can either delete it or mark it. Both choices look like storage decisions and are actually trust decisions.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| Mutate blocks in place, latest wins | Smallest storage, simplest reads. But rollback becomes impossible, the lock cannot pin anything meaningful, and an audit trail does not exist. |
| Append-only versions with a mutable `official` pointer | Rollback is a pointer move. History is never lost. Costs storage growth and forces every reader to be explicit about whether it wants latest or official. |
| Delete blocks whose source vanished | Clean graph. But a customer's shipped app may still be importing that component, and the lock still pins it. Deleting it turns a warning into a broken build. |
| Mark vanished blocks `stale`, keep the last official in the lock | The lock stays valid. A human decides when to remove. Costs a `stale` state that every UI has to render. |

**Decision:** Versions are append-only and never deleted. `official` is the production pointer and is the only thing lock-eligible. A block whose source vanished is marked `stale`, and its last official version remains in the lock until a human acts. Cross-source disagreement is marked `conflict`, and promote is blocked until it is resolved.

**Why:** The CEO directive calls these semantics "law, not implementation detail" and specifically names "append-only versions, official pointer, conflict semantics, stale-not-deleted" as the four rules that may not be silently rewritten. The reason is that `blocksmith.lock` is pitched as the thing an enterprise pins in a SOC2 audit. A lock that can point at a deleted block is not auditable.

**Consequences:**
- Easy: rollback is `POST /api/wiki/rollback` moving a pointer. History is intact by construction.
- Easy: the pipeline run log can be append-only too, since nothing it references ever disappears.
- Hard: storage grows monotonically per block. No pruning story exists yet.
- Hard: every consumer must be explicit about official versus latest. Bugs in this area are subtle and look like caching problems.
- Forecloses: a "clean up my graph" feature that actually removes history.

**Do not revert unless:** the professor or protocol review approves a spec bump. This is one of the few decisions with a named external gate on it.

---

### D-06. Scan facts auto-promote, governance edits stay draft until a human promotes
**Date:** 2026-06-09 to 2026-06-10, `docs/TEAM-NORTH-STAR.md`, `docs/PROJECT-PROTOCOL.md`.

**Status:** Standing.

**Context:** Two very different kinds of content live in the same graph. A token's hex value scanned out of code is a fact about what shipped. A component's usage rule written by a design lead is a judgment about what should ship. Treating them identically produces one of two failures: either every code change needs human approval (unusable), or human judgment ships without review (dangerous).

**Options considered:**

| Option | Real tradeoff |
|---|---|
| Everything requires human promote | Maximum control. But a re-scan of a repo with 40 blocks produces 40 approval requests for changes the engineer already merged. Nobody would use it. |
| Everything auto-promotes | Zero friction. But then the wiki cannot hold an in-progress design decision, and the promote gate (the product's central idea) has nothing to gate. |
| Split by provenance: facts auto-promote, judgments stay draft | Matches reality. Costs a provenance field on every block and a clear rule about what counts as which. |

**Decision:** Blocks of type `token` and `component` arriving from scan ingest auto-promote, because code already won that argument by being merged. Governance edits made in the wiki create a new draft version that agents cannot see until a human clicks Finalize.

**Why:** `docs/TEAM-NORTH-STAR.md` states it as "code wins" for scan facts, and the conflict rules in `docs/BLOCKS-V1-SPEC.md` make it explicit: scan facts win until re-scan, finalized governance wins over draft. The user story that motivates it is the Monday-to-Thursday walkthrough in the same doc: an engineer changing an accent color in code should see the wiki update without a ceremony, while a designer editing a button rule should not silently change what every agent builds.

**Consequences:**
- Easy: re-scanning is safe and cheap. Teams will actually do it.
- Easy: the promote gate stays meaningful, because only judgment flows through it.
- Hard: it creates a confusing empty state. Right after a first scan, everything is live and there is nothing to promote, which reads as "the product does nothing". `docs/PROJECT-PIPELINE.md` calls this out as a customer confusion problem and answers it with the **Pin production lock** call to action.
- Forecloses: a workflow where a design lead reviews every code-side token change before it appears. Some enterprises will ask for exactly that.

**Do not revert unless:** an enterprise customer requires review-before-visible on scan facts. That is a per-org policy flag, not a change to the default.

---

### D-07. Agents read `official` plus the lock only, never drafts
**Date:** 2026-06-06 onward, enforced in `src/lib/ir/enforce.ts`.

**Status:** Standing.

**Context:** The wiki shows drafts to humans. MCP serves the same graph to coding agents. If agents could see drafts, an unpromoted idea would start appearing in shipped code.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| Agents see the same graph humans see | Simplest code path. But it destroys the promote gate entirely, since anything typed into the wiki immediately becomes agent behavior. |
| Agents see official only | The gate works. Costs a hard filter that must be applied at every agent-facing surface, and a class of bug where a user edits something and the agent "does not see it" and the support answer is "you did not promote". |
| Agents see official by default with an opt-in draft mode | Flexible. But an opt-in that bypasses governance will get turned on and left on. |

**Decision:** MCP tools read official plus lock only. `enforce.ts` is not optional anywhere. Staging drafts are visible in the wiki and enforced as invisible at MCP, CLI, and API.

**Why:** This is the mechanism the entire product sells. The CEO directive puts it as "agents physically unable to hallucinate your design system once a team has promoted". If it is bypassable, the pitch is a suggestion rather than an enforcement.

**Consequences:**
- Easy: a clean, demonstrable investor story (a split view of an agent with and without the lock).
- Hard: support burden. "The agent is not using my change" is going to be the most common confused question, and the answer is a workflow explanation.
- Forecloses: using the wiki as a scratchpad that agents pick up immediately.

**Do not revert unless:** never, as long as the product's claim is enforcement. A per-org "preview channel" for agents is the compatible version of this request.

---

### D-08. Deterministic composition with the LLM constrained, not free-form generation
**Date:** 2026-06-06, recorded in the founder's `product-direction` note.

**Status:** Standing.

**Context:** The obvious way to build a design tool in 2026 is to let a model generate UI from a prompt. That is what v0, Lovable, and bolt do, and it demos beautifully. The founder had already built a chrome compiler and observed how the output behaves.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| Free-form LLM generation | Magical demo, infinite range. Output is random and off-brand, and there is no mechanism to make it provably on-system. Also puts us in direct feature competition with well-funded incumbents. |
| Deterministic composition only, no model | Perfectly reproducible. Feels dead, and cannot handle the open-ended part of the task (what should this page contain). |
| Deterministic base plus a model that selects and arranges within validated constraints | Provably on-system output with real flexibility. Costs a validation layer, a set of curated archetypes, and a much narrower prompt surface for the model. |

**Decision:** Deterministic composition from the IR and its components. The LLM only selects and arranges within validated constraints, exactly as the chrome compiler does: deterministic base, AI refinement, validation against the palette, then legibility guardrails. Curated layout archetypes are preferred over infinite generation.

**Why:** The founder's note states the reasoning: this is how "100 percent accurate" is preserved while still feeling magical. The differentiator against v0 and Lovable is not generation quality, it is that BlockSmith generates **from a governed design system**, so the output is provably on-brand. If the model were free, that claim would be false. `src/lib/ai/governed-generate.ts` is the proof: same model, same prompt, only the governance context differs, and drift goes from 5 off-token colors to 0.

**Consequences:**
- Easy: every AI output can be scored by a deterministic engine, which is what makes the demo credible rather than a claim.
- Easy: model swaps are low-risk, because the model is not carrying the correctness.
- Hard: range is limited by the archetypes we curate. Novel layouts require us to build them.
- Forecloses: competing on "type anything, get anything". We will always look narrower than a free-form generator in a side-by-side.

**Do not revert unless:** a validation layer emerges that can prove arbitrary generated UI is on-system after the fact, at which point the constraint could move from generation time to validation time.

---

### D-09. Direction B for codegen: make codegen real with a richer scan IR
**Date:** 2026-06-22, after a CTO-level deep dive.

**Status:** Standing.

**Context:** A review of the frontend pipeline found that BlockSmith was two planes of very different quality. The control plane (registry, lock, promote, drift in `src/lib/ir/`) was real and strong. The output plane was thin: `src/lib/codegen/pulse.ts` stamped `<div>{children}</div>` stubs for every component except a hand-written `Button`. The root cause was upstream: the scan IR (`ComponentScanMeta`) captured only `{sourceFile, exports, cssVarsUsed, colorsUsed}` and never captured component structure, so faithful codegen was not merely unimplemented, it was impossible.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| **A.** Reposition the control plane as the product and stop claiming codegen | Honest, fast, and plays to the strongest asset. But it drops the "importable package" story from the pitch, and the compile-target ladder (device profiles, `tokens.h`, hardware) loses its first rung. |
| **B.** Make codegen real by enriching the scan IR to capture JSX, props, and variants | Fixes the actual root cause and unblocks every downstream target. Expensive: a new extractor, a new round-trip encoding, and a new class of parse failures. |
| **C.** Ship governed wrappers around the customer's existing components | Cheapest path to something that works. But it is a thin layer that any competitor can copy in a week, and it does not make the IR any richer, so the next target hits the same wall. |

**Decision:** Direction B. Capture component structure in the scan IR and make the generator emit real components.

**Why:** The founder chose B because A and C both leave the IR poor, and the IR is the claimed moat. Every future compile target (device profiles, `tokens.h`, LVGL) reads the same graph, so a graph that does not know what a component looks like caps every target forever. What shipped: `src/lib/scan/component-interface.ts` extracts a `ComponentInterface` (props, variants, defaults, extends, children, root element); scans now carry both `interface` and verbatim `source` per component; `emitComponent()` became three-tier; and `npm run verify:pulse` asserts faithfulness so it cannot silently regress.

**Consequences:**
- Easy: every future compile target inherits structure for free.
- Easy: regressions are caught, because `verify:pulse` asserts that `Card` has a `title` prop and renders `<section>`, `Input` renders `<input>`, and `Badge` has `label`.
- Hard: the scan is now doing real parsing work and can fail on unusual source files. Tier three of `emitComponent` exists precisely for that case.
- Hard: a gotcha that will bite you. Codegen resolves `data/uploads/scan-*.md` (gitignored, local) **before** the committed fixture snapshot. A stale local upload will shadow IR changes. Regenerate it after scanner changes.
- Forecloses: pretending the output plane is finished. It is still the thinnest plane (see [Chapter 12](./12-codegen-pulse-and-compile-targets.md)).

**Do not revert unless:** faithful codegen turns out not to matter to buyers, which would show up as customers using the wiki and MCP heavily and the generated package never.

---

### D-10. Use the TypeScript syntactic API for component interface extraction, with no type checker
**Date:** 2026-06-22, `src/lib/scan/component-interface.ts`.

**Status:** Standing.

**Context:** Having chosen D-09, something had to read a `.tsx` file and report what props a component takes. The TypeScript compiler offers two levels: the syntactic API (parse a file into a syntax tree) and the semantic API (a full type checker with module resolution).

**Options considered:**

| Option | Real tradeoff |
|---|---|
| Full type checker (`ts.createProgram` plus `TypeChecker`) | Resolves imported types, inherited props, and generics correctly. Requires the scanned repo's `node_modules` to be installed and its `tsconfig` to be valid, is slow, and is non-deterministic across environments. A scan running on Vercel against a downloaded tarball has no `node_modules` at all. |
| Syntactic API only (`ts.createSourceFile`) | Fast, deterministic, works on a lone in-memory file even when React's types are not installed. Cannot resolve an imported props type, so `extendsTypes` records raw type text rather than expanded members. |
| A hand-written regex or Babel-based extractor | No TypeScript dependency. Reimplements a parser badly. |

**Decision:** Syntactic API only. The file header states it explicitly: "using the TypeScript compiler's syntactic API only (no type-checker, no module resolution)".

**Why:** The scan has to run in environments where the target repo is not installed, most importantly the serverless GitHub scan path that streams a tarball. A type checker would fail there, and a fallback path would mean two extractors with different results, which is worse than one imperfect one. Determinism also matters because scan output feeds content hashes, and a hash that changes based on whether `node_modules` was present would break the lock.

**Consequences:**
- Easy: scans are fast and run anywhere, including on a tarball with no install step.
- Easy: results are reproducible, so hashes are stable.
- Hard: props inherited from an imported type are recorded as raw text (`ButtonHTMLAttributes<HTMLButtonElement>`) rather than expanded. `rootElement` detection is explicitly best-effort.
- Forecloses: fully accurate prop tables for components that compose types heavily.

**Do not revert unless:** customers report that inherited props matter enough to justify a second, opt-in, install-required deep scan. Add it as a second mode, never as a replacement.

---

### D-11. Carry structural IR through the markdown round trip as invisible HTML comments
**Date:** 2026-06-22, `src/lib/scan/to-markdown.ts` and `src/lib/scan/parse.ts`.

**Status:** Standing.

**Context:** D-03 says everything funnels into `design.md`. D-09 says the scan now carries a `ComponentInterface` and up to 8KB of verbatim component source. Markdown headings and tables cannot represent that, and putting it in visible code fences would wreck the document for the humans who are supposed to read and edit it.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| Store structural IR in a sidecar JSON file next to the markdown | Clean separation. But now a document is two files that can desynchronize, and the "paste a design.md and it works" property is gone. |
| Add YAML front matter fields | Visible, standard. But front matter is a poor fit for per-component payloads, and 8KB of base64 at the top of every document is hostile to the human reading it. |
| Invisible HTML comments inline at the component's own section | The document stays one file, stays human-readable, and structural data stays adjacent to the thing it describes. Costs a custom encoding and a parser that must tolerate absent, malformed, or truncated markers. |

**Decision:** Invisible HTML comments: `<!-- blocksmith:interface … -->` and `<!-- blocksmith:source <base64> -->`, written by `to-markdown.ts` and read by `parse.ts`. The same trick carries the capture draft marker `<!-- blocksmith:capture-draft -->`.

**Why:** The single-file property is what makes `design.md` an interchange format rather than a directory format. A user can paste one file into the dashboard prompt bar and get a working project, and a customer can commit one file to their repo. Both break if the format becomes multi-file.

**Consequences:**
- Easy: `design.md` remains genuinely portable. Round-tripping through a text editor does not destroy structure.
- Easy: markers can be added incrementally without a format version bump, because a parser that does not know a marker ignores it.
- Hard: documents get large. The 8KB per-component source cap exists to bound this.
- Hard: a user editing the markdown by hand can corrupt or delete a marker, and the failure is silent degradation (codegen falls back a tier) rather than an error.
- Forecloses: treating the markdown as fully human-authored. Some of it is machine-owned.

**Do not revert unless:** document size becomes a real problem in production, at which point move the source payload to storage and keep a content-addressed reference in the comment.

---

## Part II: Ingest and the Figma wedge

### D-12. Frame Figma as bidirectional drift, not a one-way import
**Date:** 2026-06-23, founder's `figma-fit-wedge` note.

**Status:** Standing.

**Context:** Design system teams live in Figma. The obvious wedge is "import your Figma tokens into BlockSmith". The problem is that this is a solved, commodity capability: Tokens Studio, Style Dictionary, and Figma's own export all do it.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| Sell the import | Easy to explain, easy to demo, and immediately compared against three free tools that do it as well or better. |
| Sell the drift view: "Figma says X, shipped code says Y" | Nothing else does this, because doing it requires owning both sides. Costs a code scan as a prerequisite, so the setup is heavier. |
| Sell two-way sync that writes back to Figma | Strongest-sounding. Requires a Figma plugin with write access and puts us in the business of mutating the designer's file, which is a trust and support nightmare on day one. |

**Decision:** Build Figma to `design.md` as bidirectional sync **framed as drift**, not a one-way import. Figma is the design source of truth, the repo is the code source of truth, and `design.md` is the neutral contract both reconcile against. BlockSmith does not replace Figma's canvas.

**Why:** The founder's note is explicit: "Token extraction alone is commodity. The moat is everything downstream of `design.md` that already exists: wiki, governance tiers, MCP serving the system to coding agents, and drift detection. The unowned space is maintain and audit." Also: "The wow is the drift view, not the import." The implementation follows: `src/lib/figma/drift.ts` and `component-drift.ts` produce variant-level reconciliation, surfaced as MCP tool `figma_token_drift` and `POST /api/figma/drift`.

**Consequences:**
- Easy: a differentiated demo that no token-export tool can reproduce.
- Easy: positioning that does not threaten Figma, which matters because Figma is the incumbent everyone loves.
- Hard: the drift story needs both a Figma file and a code scan before it works. That is two setup steps before the payoff.
- Forecloses: a fast "just import my tokens" onboarding as the headline. The import exists, but it is not the pitch.

**Do not revert unless:** customer conversations show they will pay for import alone and never reach drift. Then the pitch changes, but the drift engine still ships as the retention mechanism.

---

### D-13. Import the design system, never frames or screens
**Date:** 2026-06-23, founder's `figma-fit-wedge` note and `docs/FIGMA-IMPORT.md`.

**Status:** Standing.

**Context:** Once you can read a Figma file, you can read anything in it, including whole screens. Turning screens into code is the visible, exciting demo. Figma Make already does it.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| Import tokens and the published component library only | Everything imported is a governed asset with a stable identity that can be versioned, promoted, and drifted against code. Less immediately impressive. |
| Import frames and screens too | Spectacular demo. But a screen is an **instance**, not a governed asset. It has no stable identity across edits, it cannot be meaningfully versioned, and it puts us in a head-to-head with Figma Make on their strongest ground. |

**Decision:** Import the design **system**: tokens plus the published component library. Never individual frames or screens.

**Why:** Stated as a scope fence in both the memory note and `docs/FIGMA-IMPORT.md`: "A screen is an instance, not a governed asset. That is design-to-code, which Figma Make already does. We stay the system of record." The deeper reason is that the entire control plane assumes blocks have stable ids across versions. A frame does not.

**Consequences:**
- Easy: everything that enters the graph is promotable, lockable, and driftable.
- Easy: a clean answer to "how are you different from Figma Make", which is the first question every investor asks.
- Hard: the demo is less visually dramatic than a screen turning into a React page.
- Forecloses: design-to-code as a product line.

**Do not revert unless:** never, while positioning is "system of record". Design-to-code is a different company.

---

### D-14. Do not depend on the Enterprise-only Figma variables REST API
**Date:** 2026-06-23, `src/lib/figma/rest.ts` and `src/lib/figma/adapter.ts`.

**Status:** Standing.

**Context:** Figma's variables system is the clean, structured way to get tokens. Its REST endpoint is Enterprise-plan only. Separately, a great many real Figma files, especially older community kits and un-systematized files, do not use variables at all: `get_variable_defs` returns `{}` for them.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| Require Enterprise and use the variables REST API | Clean, exact data. Cuts the addressable market to Enterprise customers and makes self-serve onboarding impossible. |
| Recover tokens from what is available on any plan: color styles, text styles, raw fills, and component sets with variant props | Works for everybody. Data is messier and needs inference (colors by role, radii, a type scale). |
| Only support the agent-side Figma MCP, which can read variables regardless of plan | Works, but only for users already inside a coding agent, which excludes the designers who are the actual buyers. |

**Decision:** Do not depend on the variables REST API. The UI connector (`POST /api/figma/connect`, `src/lib/figma/rest.ts`) reads a file via `GET /v1/files/:key` and recovers tokens from color styles, text styles, and raw fills, plus component sets with variant props. Separately, `figmaDesignContextToTokens()` recovers tokens from `get_design_context` code output for files with no variables at all. When both real variables and inferred tokens are present, real variables win on name collision and inferred tokens fill the gaps.

**Why:** Recorded plainly in the founder's note: "works on any plan (variables REST is Enterprise-only, so we don't depend on it)". Proven live on 2026-06-23 against two real files: Quantro (real variables, imported via `get_variable_defs`) and DashStack (no variables at all, 24 tokens recovered via design-context extraction). The second case is described as "the common case", which is the evidence that matters.

**Consequences:**
- Easy: self-serve works. A designer pastes a link and a personal access token and gets a governed wiki.
- Easy: the same recovery engine is reusable for the webpage extension track (D-18), because both are "infer a system from rendered design".
- Hard: inferred tokens are lower confidence than declared variables, and the source confidence tiering (D-16) has to carry that distinction.
- Forecloses: claiming exactness for files that do not declare variables.

**Do not revert unless:** Figma opens the variables REST endpoint to all plans, at which point prefer it and keep the recovery path as the fallback for files that do not use variables.

---

### D-15. Vision describes, structure governs
**Date:** 2026-06-23, founder's `figma-fit-wedge` note.

**Status:** Standing.

**Context:** A rich wiki needs more than token values. It needs component roles, usage notes, dos and don'ts, imagery guidance. Structured extraction cannot produce that. A multimodal model can, but its numbers are estimates.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| Structured extraction only | Every value is exact and traceable. The wiki reads like a spreadsheet and nobody opens it. |
| Vision extraction for everything | Rich, human prose and plausible values. The values are wrong at the hex level, which breaks drift detection and makes governance meaningless. |
| Structure for values, vision for prose | Both, with a hard line between them. Costs a discipline that has to be enforced in every new ingest path. |

**Decision:** Structured extraction is the governable spine: exact values, traceable, drift-ready. Vision and multimodal output is enrichment for the qualitative prose: component roles, usage notes, imagery style. The rule is five words: **vision describes, structure governs.**

**Why:** The founder wrote the rule down as a rule precisely because the boundary erodes under pressure. Every time a vision model returns a plausible hex, there is a temptation to just use it. The Figma fusion work in `docs/DESIGN-FIRST-INGEST.md` phase 2 encodes the same principle in code: "vision names, roles, and patterns; tree-exact hex, spacing, and type values", with "exact tree values remain authoritative". The same doc adds the tiering: code scan beats design-tool node tree beats vision capture.

**Consequences:**
- Easy: drift detection stays trustworthy, because the numbers on both sides are structural.
- Easy: the wiki can be rich without the richness contaminating the governance data.
- Hard: two extraction paths per source, and a fusion step that has to anchor vision claims to structural nodes.
- Forecloses: a pure-screenshot product where vision output is treated as truth.

**Do not revert unless:** multimodal models become measurably exact at pixel-level value extraction and can be verified as such. Verify it, do not assume it.

---

### D-16. Captured and vision-derived documents are drafts and never auto-promote into a lock
**Date:** 2026-07-10, `docs/DESIGN-FIRST-INGEST.md` phase 1, `src/lib/ingest/capture.ts`.

**Status:** Standing.

**Context:** The browser-extension capture path lets a user screenshot any design in any tool and get a `design.md`. That is a fast, magical onboarding. It is also the lowest-confidence input BlockSmith accepts.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| Treat capture output like any other ingest | Simplest, and the onboarding feels instant. But an estimated hex would auto-promote (D-06) straight into a lock, and agents would build against a guess. |
| Treat capture output as a draft project pending human review | Preserves the trust model. Costs a lifecycle, a banner, a confirm step, and a marker in the document. |
| Do not ship capture at all until values are exact | Safe and slow, and loses the entire design-first segment. |

**Decision:** Capture is a **draft project pending human review**, never assumed to be the source of truth. Every generated document carries a provenance footer and a machine-readable marker `<!-- blocksmith:capture-draft -->`. While the marker is present, the wiki shows a "Captured draft" banner on every page of the document. Confirming strips the marker via `/api/wiki/source` under the same conflict semantics as any edit. Capture documents never auto-promote into a lock, before or after confirm. Source confidence is explicitly tiered: code scan, then design-tool node tree, then vision capture.

**Why:** `docs/DESIGN-FIRST-INGEST.md` labels this "truth model (non-negotiable)". The reason is that the product's only real asset is that the lock means something. One estimated value in a lock, discovered by a customer, costs more credibility than the capture feature earns.

**Consequences:**
- Easy: an aggressive, delightful onboarding can ship without endangering the governance claim.
- Easy: the lifecycle (capture, draft, edit, confirm, regular project) is explainable in one line.
- Hard: an extra step between "wow" and "usable", which will show up in funnel metrics.
- Forecloses: a fully automatic screenshot-to-production path.

**Do not revert unless:** never for the auto-promote part. The banner and confirm UX can be streamlined.

---

### D-17. The font-generator instances real OFL variable fonts instead of a from-scratch engine
**Date:** 2026-06-17. Reverses an earlier "no Google Fonts, fully original" constraint.

**Status:** Standing. Explicitly flagged in memory as "do not revert to the skeleton engine".

**Context:** The `font-generator` app generates downloadable fonts from an AI prompt. It was originally built as a from-scratch parametric skeleton-stroke engine, which is the intellectually pure approach and produces genuinely original letterforms. It could not produce professional lowercase, numerals, or symbols.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| Keep the skeleton engine and improve it | Fully original output, no licensing questions, a real technical asset. Requires solving type design from first principles, which is a multi-year problem, and in the meantime the output is unusable. |
| Instance real open-licensed variable fonts (pick a base, drive its axes) | Professional output immediately. Gives up the "fully original" claim and depends on OFL and Apache licensed fonts. Range is bounded by the axes the base font exposes. |
| Instance real fonts **and** warp the actual outlines | Professional and genuinely varied per prompt. More complexity, and the export path forks depending on whether edits exist. |

**Decision:** Instance real OFL and Apache variable fonts, and add a generative geometry layer that reshapes the actual curve points. The AI returns `{ familyName, base, axes, tracking }` plus `shape: { slant, width, vstretch, distortion }`. The old `lib/glyphEngine.ts` and `lib/buildFont.ts` skeleton engine stays deleted.

**Why:** The founder judged the scratch output "not professional, can't be used anywhere" and explicitly chose real OFL base fonts plus axis and transform editing over per-node glyph editing. This reversed the earlier no-Google-Fonts constraint because **quality won**. That phrase is the decision. The honest framing is recorded too: this is not a from-scratch engine, it warps real outlines so it stays legible.

The implementation details that encode this and are easy to break:
- Fonts live in `font-generator/public/fonts/*.ttf` (Inter, Space Grotesk, Recursive, Nunito, Fraunces, Playfair Display, Roboto Slab, JetBrains Mono). Recursive is the expressive workhorse because its `MONO`, `CASL`, `slnt`, `CRSV`, and `wght` axes give per-prompt variety.
- `lib/fontCatalog.ts` holds real `fvar` axis ranges and is the single source of truth.
- Preview is `@font-face` plus `font-variation-settings`, and all surfaces share one render path, so the character map matches the preview exactly.
- Export with no edits goes through client-side harfbuzz instancing to a static `.ttf`, which is serverless-safe. Export with edits rebuilds a fresh CFF `.otf` via `buildEditedFont`.
- The per-glyph editor drags nodes on real outlines extracted with opentype.js. opentype.js can read these fonts but cannot re-serialize them (its GSUB writer throws), which is exactly why edits bake by rebuilding rather than round-tripping.

**Consequences:**
- Easy: output is usable in real products on day one.
- Easy: variety per prompt is real, because distortion is seeded from the prompt hash.
- Hard: two export paths (TrueType via harfbuzz, CFF via rebuild) that must stay visually consistent.
- Forecloses: the "fully original typeface" marketing claim.

**Do not revert unless:** never on the direction. If a from-scratch engine is ever attempted again, it ships alongside, and only after it can render professional lowercase, numerals, and symbols side by side with an instanced font in a blind comparison.

---

## Part III: The two product tracks

### D-18. Keep the browser-extension track separate from the Figma-fit wedge
**Date:** 2026-06-22, founder's `extension-restyle-web` note.

**Status:** Standing.

**Context:** The north-star vision is that a user can restyle anything on the internet through a browser extension, and eventually control hardware UI the same way. A near-term version of this exists: an extension that analyzes any webpage and emits a `design.md` from the live DOM and CSS. Meanwhile the Figma-fit wedge targets design-system teams who want their own system enforced. Both use the same engine. It is tempting to pitch them together.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| One pitch covering both ("we turn any surface into a governed design system") | Sounds bigger, covers more ground, and is the natural instinct when the underlying engine really is shared. |
| Two tracks, two ICPs, deliberately not conflated | Each pitch stays sharp. Costs the appearance of a smaller vision in any single conversation. |

**Decision:** Two separate product tracks with separate ideal customer profiles. The Figma to `design.md` import is the Figma-fit play. The webpage to `design.md` extension is the extension play. They reuse the same `design.md` IR, wiki, governance, and MCP pipeline, but they are never sold together.

**Why:** The founder's reasoning is precise and worth quoting in substance: a Figma-centric design-system team does not care that you can scrape Stripe's site. They care that **their own** system is enforced. Leading with "restyle any website" makes the Figma buyer think you are a browser toy. Leading with governance makes the extension audience think you are enterprise software they do not need.

**Consequences:**
- Easy: each pitch is legible to its audience in one sentence.
- Easy: engineering still shares almost everything, because both funnel into `design.md` (D-03).
- Hard: two go-to-market motions eventually means two of everything non-engineering.
- Hard: internal confusion about which track a given piece of work serves. Note that the capture extension (`extension/`) is scoped as design-tool capture for the ingest story, which is a third thing again, and it is easy to conflate it with the restyle-the-web extension.
- Forecloses: a single unified narrative in an investor deck. The north-star vision handles that job instead.

**Do not revert unless:** customer evidence shows the same buyer wants both, which would most likely appear as design-system teams asking to audit their own live production site against their own system. That is genuinely the overlap point.

---

### D-19. Reuse the NVIDIA OpenAI-compatible stack and add no second AI vendor
**Date:** 2026-06-23, founder's `governed-generate-live` note. Vendor stack itself predates it.

**Status:** Standing.

**Context:** BlockSmith already used NVIDIA's OpenAI-compatible inference endpoint for the chrome compiler, scan curation, and the font generator. When the live governed-generate demo was built, adding a second provider was tempting: different models have different strengths, and a fallback vendor is resilience.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| Add a second vendor for the demo | Best model per task, vendor redundancy. Two SDKs, two key management stories, two billing relationships, two sets of rate-limit semantics, and a second thing to configure before the product works. |
| Reuse the existing NVIDIA stack | One client (`openai` SDK pointed at `https://integrate.api.nvidia.com/v1`), one key, one failure mode. Bounded to NVIDIA's model catalog. |
| Build a provider abstraction and support several | The "right" engineering answer. Premature at this stage, and abstractions over LLM providers leak badly. |

**Decision:** Reuse the project's NVIDIA stack. The founder's note says it as an instruction: do **not** add Anthropic or another vendor. Resilience is handled inside the one vendor instead, via `chatWithModels(models, profile, msgs, opts)` in `src/ai-lab/shared/chat.ts`, which falls back across both keys (`NVIDIA_API_KEY`, `NVIDIA_API_KEY_FALLBACK`) and across a model list.

**Why:** Because the endpoint is OpenAI-compatible, the `openai` npm client already in `package.json` works unchanged, so a second vendor buys almost nothing technically while adding a second operational surface. Model diversity is already available within the one vendor: `nvidia/nemotron-3-*` and `openai/gpt-oss-120b` are both reachable through the same client.

**Consequences:**
- Easy: one key to configure. Every AI feature degrades gracefully to 503 when it is missing, rather than half-working.
- Easy: profile-based configuration (`getNvidiaProfile` with `chrome` and `parser` profiles) keeps model choice in one file.
- Hard: a NVIDIA outage takes every AI feature down at once.
- Hard: models are pinned to what NVIDIA hosts.
- Forecloses: using a model only available elsewhere without first making a real vendor decision.

**Do not revert unless:** a capability the product needs is only available from another provider, or NVIDIA reliability becomes a measured problem. Then add a provider deliberately, with an abstraction, not as a one-off in a feature.

---

### D-20. Choose fast models over the largest model for anything a user waits on
**Date:** 2026-06-23, `src/lib/ai/governed-generate.ts`.

**Status:** Standing.

**Context:** The governed-generate demo makes two parallel LLM calls (ungoverned and governed) and shows both results side by side with drift scores. The largest available model, `nvidia/nemotron-3-ultra-550b-a55b`, produces the best prose. It also takes roughly two minutes per call.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| Largest model | Best output quality. Around 120 seconds per call, which is longer than any investor will sit through and longer than the platform's comfortable serverless budget. |
| Fast models | Roughly 13.5 seconds end to end in practice. Slightly weaker prose, which does not matter because the drift number, not the prose, is what the demo proves. |

**Decision:** Use fast models for generation: `nvidia/nemotron-3-super-120b-a12b` then `openai/gpt-oss-120b`, overridable via `NVIDIA_MODEL_GENERATE`. The 550B model is explicitly not used here. The same instinct shows up in `getNvidiaProfile("chrome")`, which drops to the 120B model when `VERCEL === "1"`.

**Why:** Measured, not assumed: live latency is about 13.5 seconds, and the demo's proof (drift going from 5 to 0 with the same model and prompt, only governance context differing) holds regardless of model size. The thing being demonstrated is enforcement, and enforcement is scored by a deterministic engine (D-28), not by the model. Paying two minutes for prose quality buys nothing and costs the demo.

**Consequences:**
- Easy: the showcase is live-demoable. `maxDuration = 120` on the route is a ceiling, not a target.
- Easy: cost per generation is lower.
- Hard: generated prose is visibly less polished than a frontier model would produce, which a sophisticated viewer may notice.
- Forecloses: using output quality as the demo's proof point. That was never the plan.

**Do not revert unless:** the largest model becomes fast enough to stay inside the interaction budget, or a use case appears where a user is willing to wait (an async job, not a live view).

---

### D-21. Never evaluate LLM-produced JSX on the client
**Date:** 2026-06-23, `src/components/demo/GovernedAiShowcase.tsx`.

**Status:** Standing.

**Context:** The governed-generate showcase displays code a model just wrote. The most impressive version renders it live, so the viewer sees the ungoverned UI look wrong and the governed UI look right, side by side, as actual pixels.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| Evaluate and render the generated JSX in the browser | The best possible demo. It is also arbitrary code execution driven by a user-supplied prompt, in a page served from our origin. That is a cross-site scripting vector with extra steps, and no sandbox story exists in this codebase. |
| Render generated code as syntax-highlighted text plus a deterministic drift score | Safe, and the drift score is the actual proof anyway. Less visually dramatic. |
| Render in a sandboxed iframe with a strict CSP | The eventual right answer for a live preview. Requires a CSP that does not exist yet (it is still an open P2 item in `docs/PRODUCTION-CHECKLIST.md`) and careful origin isolation. |

**Decision:** Never evaluate or render the LLM's code. The showcase shows code and drift columns only. The file states it as a comment: "We never eval/render the LLM's code (XSS-safe)."

**Why:** The prompt is user-editable and the endpoint is public-facing and multi-tenant. Evaluating model output in that context is an unbounded risk for a demo enhancement. The drift columns carry the proof regardless, because they come from the same lint engine the CI gate uses (D-28), which makes them evidence rather than decoration.

**Consequences:**
- Easy: no sandbox, no CSP dependency, no XSS class of bug in the highest-traffic marketing surface.
- Easy: the fallback path (a safe static sample rendered from a real generated kit, shown on 503 or error) is trivially safe too, so the demo never looks broken.
- Hard: the demo is code and numbers rather than pixels, which is less visceral.
- Forecloses: live preview of generated UI until a sandboxed renderer is built properly.

**Do not revert unless:** a properly sandboxed preview is built (separate origin, strict CSP, no access to session), reviewed as a security change, and covered by the security gate.

---

## Part IV: Engineering practice

### D-22. Verify scripts as the primary quality strategy, instead of unit tests
**Date:** From project start (2026-06-06 onward). No test framework has ever been added.

**Status:** Standing.

**Context:** There is no Jest, no Vitest, no Mocha, and no `test` script in `package.json`. There are 32 files matching `scripts/verify-*.ts` and a composite `npm run verify:software` that chains eighteen of them behind a typecheck. This is unusual enough that a new engineer's first instinct is to "fix" it by adding a test runner.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| Conventional unit tests | Familiar, fast, good IDE integration, isolates failures precisely. Tests units, and almost every real failure in this system is an integration failure across scan, markdown round trip, registry, lock, and MCP. Unit tests of a markdown parser would have caught none of the bugs that actually happened. |
| End-to-end verify scripts that run real pipelines against real fixtures | Catch the failures that occur. Slower, coarser, harder to debug when red, and they need fixtures maintained. |
| Both | Correct eventually. Doubles the maintenance surface at a stage where there is one engineer. |

**Decision:** Verify scripts are the quality strategy. Each one runs a real path end to end against a real fixture and asserts on the output. `npm run verify:software` is the gate that must be green. Adding a capability means adding or extending a verify script (`verify:figma-import` runs 49 checks, `verify:governance-tiers` was wired into `verify:software` when tiers shipped, `verify:pulse` asserts codegen faithfulness).

**Why:** The system's value is a chain: repo to scan to markdown to graph to registry to lock to MCP to agent. Every part can be individually correct while the chain is broken, and the chain breaking is what a customer experiences. The concrete evidence is D-09: codegen was emitting `<div>` stubs while every individual module worked, and the fix included `verify:pulse` asserting specific structural facts so it "can't silently regress to stubs". A unit test would not have expressed that assertion.

**Consequences:**
- Easy: high confidence that the actual product works. `verify:software` green means the loop runs.
- Easy: verify scripts double as executable documentation of what a subsystem promises.
- Hard: slow. The full chain takes minutes, not seconds.
- Hard: a red verify script tells you a stage broke, not which line. Debugging is bisection.
- Hard: fixtures (`fixtures/vendor-ui/`, `data/uploads/`) need maintaining, and a stale local upload can shadow the committed fixture (see the D-09 gotcha).
- Forecloses: test-driven development at the unit level, and fast feedback loops on pure functions.

**Do not revert unless:** a pure-logic module appears that is complex enough to deserve unit tests (the hashing and validation code in `packages/protocol` is the leading candidate, and its golden-vector conformance fixtures are already effectively that). Add unit tests **alongside** verify scripts for such modules. Do not replace the verify layer.

---

### D-23. Dual local and hosted storage, so the product works with no Supabase
**Date:** From early (2026-06-06 onward), `src/lib/cloud/saas.ts`, `src/lib/supabase/env.ts`.

**Status:** Standing.

**Context:** BlockSmith is a hosted multi-tenant SaaS and also a tool a developer runs against their own repo on their own machine. Requiring a Supabase project before anything works would make the local developer experience miserable and would make the open-source client story (D-26) incoherent.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| Cloud-only, always requires Supabase | One code path, no divergence. Nobody can try it in five minutes, and contributors need credentials to run anything. |
| Local-only, no hosted mode | Simple, and not a business. |
| Both, selected by whether credentials are present | Works everywhere. Costs a storage abstraction and a real risk of the two paths diverging in behavior. |

**Decision:** Storage backend is selected at runtime. `supabaseStorageEnabled()` returns true only when both `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set. With no Supabase, documents live on disk under `data/uploads/*.md` and the dashboard lists from there (`listDashboardProjects()` in `src/lib/dashboard/projects.ts` was written specifically so it works locally without Supabase). With Supabase, documents live in the private `scan-docs` bucket and org-scoped tables. Access enforcement is separately gated: `saasStrictMode()` defaults to strict in production and can be forced with `BLOCKSMITH_SAAS_STRICT`.

**Why:** The local path is not a fallback, it is a supported mode, because the CLI and MCP server are meant to run against a developer's machine. The hosted path is not optional either, because Vercel's filesystem is ephemeral. `localCloudStoreWritable()` returns false when `VERCEL === "1"` precisely to prevent a whole class of "it worked locally" bugs, and there is a commit (`2fcd631`) that exists because the app was writing `documents.json` on Vercel.

**Consequences:**
- Easy: `npm run dev` and a scan work with zero external accounts.
- Easy: the open-source client tree does not need a cloud dependency.
- Hard: two paths means bugs that appear in only one. This has already happened repeatedly: the dashboard listing from the ephemeral filesystem, `/tmp` writes on serverless (`81e2dbf`), GitHub scan needing a tarball stream instead of a clone (`b7c9f90`, `04c5649`, `7c6a23a`).
- Hard: a real footgun. `BLOCKSMITH_SAAS_STRICT` off in a hosted deployment means **no tenant isolation**. Startup config warnings now exist for this reason.
- Forecloses: assuming a database in any code path that must also run locally.

**Do not revert unless:** the local mode stops being used, which would mean the CLI and MCP story died. That would be a much bigger problem than the storage abstraction.

---

### D-24. Supabase, Vercel, and Upstash as the vendor stack
**Date:** Supabase and Vercel from 2026-06-06. Upstash added 2026-06-23 (`b4ff051`). Sentry added 2026-06-24 (`9fe6668`). Resend for invite email.

**Status:** Standing.

**Context:** A one-engineer team building a multi-tenant SaaS has to decide how much infrastructure to own. Every self-hosted component is a thing that pages you.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| Own the infrastructure (Postgres, object storage, auth, Redis, hosting) | Full control, no vendor lock, cheaper at scale. Requires operations work nobody here has time for, and delays every product decision. |
| Managed services chosen for overlap: Supabase (Postgres plus storage plus auth in one), Vercel (Next.js native), Upstash (serverless-native Redis over HTTP) | Fastest path to a real multi-tenant product. Lock-in, per-request cost at scale, and platform constraints leaking into the code. |

**Decision:** Supabase for everything that must survive serverless (documents, orgs, API keys, registry, lock, promote audit, plus GitHub OAuth and the private `scan-docs` bucket). Vercel for hosting. Upstash Redis for distributed rate limiting and the dashboard metadata cache. Sentry for error monitoring, no-op until `NEXT_PUBLIC_SENTRY_DSN` is set. Resend for transactional invite email.

**Why:** Supabase collapses three vendors into one, and it was already the auth provider, so the marginal cost of using its Postgres and storage was near zero. Upstash was chosen because it speaks HTTP, which is what a serverless function can actually use; a classic Redis connection pool does not work on Vercel's model. Every vendor after the first two is optional by design: rate limiting falls back to in-memory, Sentry no-ops, AI features return 503, and email invites are saved without delivery. That optionality is what makes D-23 possible.

**Consequences:**
- Easy: a working multi-tenant SaaS built by one person in weeks.
- Easy: local development needs none of it.
- Hard: platform constraints are now design constraints. Vercel's read-only filesystem forced `/tmp` writes and the storage abstraction. Serverless instance isolation is why in-memory rate limits were insufficient and Upstash was needed.
- Hard: `maxDuration` limits shape route design (scan 60s, vision 90s, governed-generate 120s), and require a Vercel plan that allows them.
- Forecloses: on-premise deployment for an enterprise that requires it. That is a real enterprise blocker and is listed as an open question.

**Do not revert unless:** an enterprise deal requires self-hosting, or costs at scale become material. The storage abstraction (D-23) is the thing that would make a migration survivable, which is another reason to keep it.

---

### D-25. Exclude the nested `font-generator` app from the root tsconfig
**Date:** 2026-06-25, commit `60cdd31`.

**Status:** Standing.

**Context:** `font-generator/` is a standalone Next.js application living inside the BlockSmith repository. It has its own dependencies, its own tsconfig, and its own build. The root `tsconfig.json` includes `**/*.ts` and `**/*.tsx`, so it was pulling the nested app's source into the main typecheck, where its dependencies do not resolve. `npm run build` and `npm run typecheck` both failed on it.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| Move `font-generator` out to its own repository | Cleanest separation. Costs a repository split, a second deployment, and loses the convenience of one checkout while the app is still exploratory. |
| Make the root tsconfig understand it via project references | Correct TypeScript answer. Requires composite projects and build ordering for a nested app that does not need to participate in the root build at all. |
| Exclude it from the root tsconfig | One line. The nested app typechecks itself with its own config. The main build stops failing. |

**Decision:** Add `font-generator` to the root `tsconfig.json` `exclude` array, alongside `node_modules`, `packages/cli`, and `packages/sdk` (which are excluded for the same reason: they build independently with their own configs).

**Why:** The nested app is not part of the BlockSmith build graph. It is a separate experiment that happens to share a checkout. Including it in the root typecheck asserted a relationship that does not exist. This was recorded as a **critical build fix** in the production-readiness notes, because it was blocking the production build outright.

**Consequences:**
- Easy: `npm run build` and `npm run typecheck` are green.
- Easy: `font-generator` can use whatever TypeScript settings and dependencies it wants.
- Hard: it is now genuinely unchecked by the root gates. Nothing in `verify:software` covers it. If it breaks, you find out by running it.
- Hard: a new engineer will "helpfully" remove the exclusion at some point and reintroduce the failure. That is why this record exists.
- Forecloses: shared types between the main app and the font generator.

**Do not revert unless:** `font-generator` moves into `packages/` as a proper workspace with its own build script wired into the root, or moves out to its own repository. Either is fine. Removing the exclusion without doing one of those breaks the build.

---

### D-26. Open-core licensing boundary: MIT client and spec, BSL 1.1 hosted app
**Date:** 2026-06-23, commit `a9c87ae`, documented in `LICENSING.md`.

**Status:** Standing, and explicitly marked **internal**. Do not push to a public remote or announce the split yet.

**Context:** The moat is supposed to be a standard (D-04). A standard nobody can freely adopt is not a standard. But the business is a hosted multi-tenant product, and a fully open repository invites a larger player to run it as a competing service.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| Fully closed | Protects everything. But developers will not trust a closed tool that sits inside their repository and their AI loop, and the protocol play dies. |
| Fully open (MIT everything) | Maximum adoption. A cloud provider can host it competitively on day one, and there is no defensible business. |
| Open core: MIT the adoption surfaces, source-available the hosted product | Adoption where it matters, protection where the revenue is. Costs a boundary that must be maintained, physically enforced by extraction, and explained to contributors. |

**Decision:** Open core.

| Tier | License | Paths |
|---|---|---|
| Open | MIT (`LICENSE-MIT`) | `packages/cli`, `packages/sdk`, `packages/protocol` |
| Intended open, extraction pending | MIT once moved into `packages/` | `src/lib/figma`, `src/lib/mcp` and `src/mcp`, `src/lib/scan` parsers, `src/lib/governance/color-lint.ts` |
| Source-available | BSL 1.1 (`LICENSE`), converts to Apache-2.0 on 2030-06-23 | `src/app`, `src/lib/cloud`, `src/lib/ai`, `packages/pulse-runtime`, `packages/generated/*` |

The default is proprietary: anything not explicitly listed as open is BSL. The BSL Additional Use Grant permits production use except offering BlockSmith to third parties as a competing hosted service.

**Why:** Three reasons, recorded in `LICENSING.md`. First, the moat is a standard, not a secret, and a standard requires the spec and client to be freely adoptable and inspectable. Second, agents and developers will not trust a closed tool inside their repository and their AI loop, so openness on the client side is adoption fuel. Third, willingness to pay lives in the cloud and team layer, which the BSL protects.

**Consequences:**
- Easy: a coherent answer to "is this open source" that does not require hedging.
- Easy: the CLI can be inspected by a security-conscious enterprise before installation.
- Hard: the "intended open" libraries still live under `src/` and must be physically extracted into `packages/` before the open tree can compile independently. Until that happens, the boundary is a document, not a fact.
- Hard: outstanding rollout work, all unchecked in `LICENSING.md`: extraction, repository strategy (split repositories or a filtered public mirror), SPDX headers, a possible switch to Apache-2.0 for `packages/protocol` because the patent grant matters more for a spec, a contributor policy, and replacing the licensor placeholder once a legal entity exists.
- Forecloses: relicensing the hosted app openly later without a real decision, and taking outside contributions before a CLA or DCO exists.

**Do not revert unless:** legal counsel advises differently, or the extraction work proves impossible. Note the standing hold: **no public push or announcement** until the rollout checklist and our own product progress are ready.

---

### D-27. No gradients, no AI-slop visual language for BlockSmith's own UI
**Date:** 2026-06-23, stated explicitly by the founder while building the dashboard.

**Status:** Standing.

**Context:** BlockSmith sells taste in design systems. Its own product is therefore an argument. The default aesthetic of AI-built products in 2026 is immediately recognizable: purple-to-blue gradients, glassmorphism, glow effects, emoji headers. It reads as generated.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| Follow the prevailing AI-product aesthetic | Fast, familiar, looks modern to a casual viewer. Signals "built by an LLM with no art direction", which is fatal for a product whose pitch is governance and taste. |
| A restrained, tool-grade visual language modeled on Canva and Figma | Credible with the actual buyer (a design-system lead). Slower, requires real decisions, and looks plainer in a screenshot. |

**Decision:** No gradients and no AI-slop. The dashboard is modeled on Canva and Figma: left sidebar, prompt bar, project grid. The palette is defined as tokens in `src/app/globals.css` under `@theme` and is deliberately small: `ink-black #000000`, `paper-white #ffffff`, `faint-slate #f8fafc` for page background, `lavender-mist #e2e9f3` for borders, `graphite #686562` for muted text, `signal-orange #ff4500` for errors. Typography is Inter for body via `font-sans` and JetBrains Mono via `font-gtstandardmono` for uppercase labels. The same instinct appears earlier in `docs/WIKI-EDIT-MODE-BUILD-ORDER.md`: "hairline border, no emoji, no green gradients."

**Why:** The thesis document lists "taste is a feature" as a stated principle, and `docs/01-vision-and-positioning.md` lists "treating taste as polish (it is the product)" as a mistake to avoid. A design governance tool that looks generated cannot be sold to people whose job is preventing generated-looking output. The founder was explicit about this, which is why it is recorded as a decision rather than left as a style preference.

**Consequences:**
- Easy: the product is credible with the buyer in the first five seconds.
- Easy: a small token palette means new surfaces are fast to build and consistent by default.
- Hard: restraint takes longer than a gradient. Every screen needs actual design thought.
- Hard: it looks less exciting in a marketing screenshot next to competitors.
- Forecloses: quick visual wins from trendy effects.

**Do not revert unless:** never, while taste is part of the pitch. If a surface needs more visual energy, earn it with typography, spacing, and motion.

---

### D-28. One color-lint engine shared across the CI gate, MCP validate, and the governed-generate drift score
**Date:** Engine from 2026-06-13 (`29b993d`, governance tiers). Shared into governed-generate 2026-06-23.

**Status:** Standing.

**Context:** Three different surfaces need to answer the same question: does this code use colors that are not in the approved system. The CI gate needs it to fail a pull request. The MCP `validate_ui_code` tool needs it so an agent can self-correct. The governed-generate demo needs it to put a number on the difference between governed and ungoverned output.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| A separate implementation per surface, tuned to each | Each is optimal for its context. Three implementations drift, and the CI gate and the agent hint eventually disagree, which destroys trust in both. |
| One engine, three callers | Guaranteed agreement. The engine has to be general enough for all three, and a change affects all three at once. |

**Decision:** One engine: `src/lib/governance/color-lint.ts`, exposing `findOffTokenColors` and `nearestToken`. Its callers are `scripts/validate-ui.ts` (the CI gate), `scripts/governance-gate.ts`, `src/lib/governance/check-diff.ts` (what `blocksmith check` runs), `src/mcp/handlers.ts` (the MCP validate tool), and `src/lib/ai/governed-generate.ts` (the drift score).

**Why:** Recorded in the founder's note on governed-generate: drift is scored by the **same** engine the CI gate and MCP validate use, so "numbers are real enforcement, not model claims". That sentence is the whole point. If the demo's drift number came from a separate scorer, it would be marketing. Because it comes from the engine that will fail the customer's build, it is a prediction. The tiers doc reinforces the split: color linting is exact, not heuristic, which is why it is Tier 1 (blocking) while prose rules are Tier 2 (warn).

**Consequences:**
- Easy: the demo's claim is verifiable. A viewer can run `npm run validate:ui` and get the same answer.
- Easy: `nearestToken` gives every surface the same prescriptive suggestion, which is what makes Tier 3 advisory output useful to an agent.
- Hard: any change to the engine changes behavior in five places simultaneously.
- Forecloses: surface-specific tuning, for example a looser lint in the demo to make numbers look better. That would be exactly the wrong thing.

**Do not revert unless:** never. If a surface needs different strictness, add a configuration parameter to the one engine.

---

### D-29. Three governance tiers, and the check fails open
**Date:** 2026-06-13, commits `29b993d` and `922b441`, documented in `docs/GOVERNANCE-TIERS.md`.

**Status:** Standing.

**Context:** A governance tool that blocks everything gets uninstalled in a week. A governance tool that blocks nothing is a linter nobody reads. The question is what blocks, what warns, and what merely advises.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| Block on every violation | Maximum enforcement, immediate revolt. Prose rules are heuristic (v1 uses compiled heuristics in `src/lib/governance/prose-lint.ts`) and produce false positives, so blocking on them would block on guesses. |
| Warn on everything | Nobody revolts, nobody complies. |
| Tier by confidence: block only what is machine-verifiable, warn and capture what is heuristic, advise agents before they write code | Enforcement where we are certain, visibility where we are not. Costs a tier model that every check has to be classified into. |

**Decision:** Three tiers.

| Tier | What | Where | Outcome |
|---|---|---|---|
| 1 Block | Off-token hex, stale or missing lock (machine-verifiable) | pre-commit, CI, `blocksmith check` | Fails. Bypass only via `git push --no-verify`, which is logged |
| 2 Warn | Component prose rules (inactive links, stale dates) | pre-push, CI, `blocksmith check` | Yellow warning, captured to the wiki. Push proceeds unless `--strict` |
| 3 Advisory | Agent-time guidance | MCP `check_governance_diff` before coding | Prescriptive: suggests the nearest token so the agent self-corrects |

Tier 2 defaults to allow-with-capture. Repeated overrides on one rule are the signal to promote it to Tier 1. Exit codes are `0` clean or warn-captured, `1` blocking, `2` misconfiguration. Critically, the check **fails open** on network and CLI errors, so a flaky connection never bricks a push.

**Why:** The tiering follows confidence, not severity. Color linting is exact so it blocks. Prose linting is heuristic so it warns, and false positives are explicitly declared acceptable at warn tier because the lead triages. The fail-open rule exists because the fastest way to get a tool banned is to break someone's push when your server is down.

**Consequences:**
- Easy: teams will actually leave the hook installed.
- Easy: the violations feed gives a design lead evidence about which rules matter, which is the input to promoting a rule to Tier 1.
- Hard: fail-open means a determined violator can bypass by going offline. Accepted.
- Hard: Tier 2 requires someone to actually look at the violations feed. If nobody does, Tier 2 is decoration.
- Forecloses: claiming hard enforcement of prose rules. Only Tier 1 is enforcement.

**Do not revert unless:** an enterprise requires hard-fail on everything, which is what the planned "strict mode" and the v3 LLM gate on the diff are for. Make it opt-in per org.

---

### D-30. Phase ordering: software truth before hardware
**Date:** 2026-06-06, `docs/00-thesis.md`. Reaffirmed in `docs/CEO-DIRECTIVE.md` with the compile ladder.

**Status:** Standing.

**Context:** The founding team are computer engineering majors, and the long-term vision runs below the web stack into device and OS interfaces. Hardware is the differentiated ambition and the emotionally compelling part. It is also the part with no customers yet.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| Hardware first, because it is the defensible ground | Genuinely differentiated. Sales cycles are years, the tooling is unfamiliar, and there is no proof the IR is right before it is compiled to a chip. |
| Software first, hardware as proof of the IR's generality | Faster feedback, real users, revenue plausible. Risks looking like a web tool and losing the hardware narrative. |
| Both at once | With one engineer, neither finishes. |

**Decision:** Software truth first. The thesis names three phases: phase 1 software truth (scan repo to markdown to wiki to MCP governance, verifiable via `npm run verify:software`), phase 2 design as a library (`@blocksmith/<project>`), phase 3 device profiles (same IR to a watch or HMI simulator to native or LVGL). Explicitly paused until phase 1 is solid in the wild: ingest-everything, social screenshots, Quartus and FPGA work, and public block feedback at scale.

**Why:** The hardware rungs (dev board profiles, HMI pipelines, firmware OTA for design) all read the promoted graph. If the graph is wrong, every rung is wrong, and you discover it late and expensively. The device work that does exist (`npm run compile:device`, the `tokens.h` emitter at `src/lib/ir/targets/c-header.ts`, `/demo/device`) exists as **proof the IR is real for atoms, not just React**, which is the correct amount of hardware work at this stage: enough to validate the abstraction, not enough to become the product.

**Consequences:**
- Easy: fast iteration against real repositories and real Figma files.
- Easy: the hardware story stays in the deck as a roadmap with one working rung, which is more credible than a slide with none.
- Hard: BlockSmith looks like a web tool to anyone who does not read the roadmap.
- Forecloses: early automotive, IoT, and industrial deals, which is where enterprise pricing actually lives.

**Do not revert unless:** a hardware customer with budget appears before phase 1 is solid. Even then, take the deal and treat the compile target as an extension of the same graph, not a fork.

---

### D-31. Pipeline lanes replace the releases table as the primary release surface
**Date:** `docs/PROJECT-PIPELINE.md`, shipped.

**Status:** Standing.

**Context:** `/wiki/releases` was built first: a table of blocks with official version, last promote, and lock staleness. It worked and it was unusable as a demo. After a first scan, everything auto-promotes (D-06), so the table shows forty identical "Live v1" rows and nothing to click.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| Polish the releases table | Cheap. It remains a table, and a table cannot show a non-technical viewer why agents need a human promote gate. |
| Build stage swimlanes (ingest, build, staging, production, locked, deployed) with block cards, a diff drawer, and a persistent lock strip | Visually communicates the pipeline without narration. Much more work, and motion and state that must survive on serverless. |

**Decision:** `/wiki/pipeline` is the primary release console, ranked above Releases in navigation. Releases is relabeled as a table view with a banner link. The lock strip is always pinned at the top with three states (no lock, stale, fresh), each with its own primary call to action. Promote is a selection gesture into a diff drawer with blast-radius copy, not a row action.

**Why:** `docs/PROJECT-PIPELINE.md` sets the requirement bluntly: "A non-technical person understands why agents need a human promote gate without narration." It also names the specific dead end the table produced: "40 Live, no lock", which is why `POST /api/wiki/pin-lock` exists at all. The **Pin production lock** call to action is the fix for the empty state D-06 creates.

**Consequences:**
- Easy: a recordable ninety-second demo with no voiceover explaining basics.
- Easy: pipeline runs give an append-only audit surface that maps directly to the enterprise ask.
- Hard: two release surfaces to maintain, and the table is now the advanced view rather than deleted.
- Hard: the Pipeline depends on a durable registry, so it is unreliable on Vercel until the Supabase registry SQL is applied.
- Forecloses: nothing much. The table still exists.

**Do not revert unless:** users consistently navigate to the table view, which would mean the lanes are not carrying their weight.

---

### D-32. Publish the CLI as a single zero-dependency bundle, under the `@block-smith` scope
**Date:** 2026-06-12, commits `f6c0697` (bundling) and `87f8a47` (scope).

**Status:** Standing.

**Context:** The CLI (`packages/cli`) depends on the workspace SDK (`packages/sdk`). Publishing both means two packages, version skew between them, and a `file:` dependency that cannot be published as-is.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| Publish CLI and SDK separately | Conventional. Users can install the SDK independently. Version skew becomes a support problem, and the install is two packages. |
| Bundle the SDK into the CLI at build time | One package, no peers, no skew, tiny tarball. The SDK is not independently installable. |

**Decision:** Bundle `@blocksmith/sdk` from source into a single `dist/cli.js` via esbuild (`packages/cli/build.mjs`), so the published tarball has zero runtime dependencies (three files, roughly 6 kB). Argument parsing is a zero-dependency parser in `args.ts`. `--version` is injected at build time. `--url` defaults to the hosted SaaS, and login verifies the key against the server before persisting it. The published name is `@block-smith/cli` because the npm organization is `block-smith`; the internal `@blocksmith/sdk` workspace package is unchanged and never published.

**Why:** The CLI sits in a customer's repository and a customer's CI. Every runtime dependency is a supply-chain question they have to answer, and every peer package is a version they can get wrong. Zero dependencies makes `npm i -g @block-smith/cli` boring, which is the goal for a tool that must be trusted inside someone else's build.

**Consequences:**
- Easy: install is one command with no peer resolution.
- Easy: a security review of the CLI has a small surface.
- Hard: the naming is genuinely confusing. The published CLI is `@block-smith/cli`, the protocol package is `@blocksmith/protocol`, the internal SDK is `@blocksmith/sdk`, and generated packages are `@blocksmith/<product>`. Expect to explain this.
- Forecloses: consumers importing the SDK directly from npm.

**Do not revert unless:** a customer needs the SDK as a library. Then publish it separately **and** keep the CLI bundled.

---

### D-33. Storybook as the first external ingest adapter, to prove neutrality
**Date:** `docs/PROJECT-PROTOCOL.md` task P5, shipped as `src/lib/ingest/storybook.ts` and `npm run ingest:storybook`.

**Status:** Standing.

**Context:** Claiming a neutral interchange format while the only adapter is your own scanner is not a claim anyone believes. Something outside BlockSmith's scan had to compile into `blocks.v1`.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| Storybook (read `stories.json` or `index.json` from a static build) | Widely deployed, static output, no API keys, no auth. Emits component blocks only, no tokens. |
| Tokens Studio (`tokens.json` to token blocks) | Emits tokens, which are the more common ask. Smaller install base. |
| Figma export JSON | Highest strategic value. Overlaps entirely with the Figma wedge, so it proves nothing about neutrality. |

**Decision:** Storybook, as the recommended default. It emits `component:*` blocks with `source.ingest: "storybook"`, and if the scan already holds the same id with different content the result is a `conflict` block that the human resolves in the wiki.

**Why:** The point was to prove that adapters can be written by someone who is not us, against the published contract, without touching the wiki or Pulse. Storybook is the cleanest test because its output is a static file with no credentials involved. The conflict case was the real prize: it demonstrated cross-source disagreement working end to end, and it forced partial-ingest semantics into `recordIngest()`, which the scan path alone would never have exercised.

**Consequences:**
- Easy: the deck can truthfully say third parties can run the conformance suite.
- Easy: the conflict path has real coverage rather than a synthetic test.
- Hard: another adapter to maintain against Storybook's evolving output formats.
- Forecloses: nothing.

**Do not revert unless:** Storybook adoption collapses, in which case replace it with a different external adapter rather than dropping the category.

---

### D-34. Hash and version semantics change only through protocol review
**Date:** `docs/PROJECT-PROTOCOL.md` and `docs/PROTOCOL-GOVERNANCE.md`.

**Status:** Standing.

**Context:** `graphHash` and `blockContentHash` determine whether a lock is fresh, whether a block changed, and whether two implementations agree. They are three lines of code that everything depends on.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| Treat hashing as ordinary code | Fast iteration. Any change silently invalidates every customer's lock and every third-party implementation. |
| Gate hash and status-enum changes behind review, with a version policy | Slow for those files. Everything else stays fast. |

**Decision:** A three-level change policy. Patch changes (docs, examples) merge on the team. Minor changes (new block types, optional fields) need professor and platform review. Major changes (hash algorithm, status enum) require a spec bump to `blocks.v2` with a migration document. The `Do not` list in `docs/PROJECT-PROTOCOL.md` opens with "Rewrite hash semantics without professor sign-off". A CI drift gate enforces that `packages/protocol` hashing stays byte-identical to `src/lib/ir/hash.ts`.

**Why:** Not theoretical. The drift gate already caught a real NUL-byte separator divergence between the app and the package. Without the gate, every lock produced by one side would have failed verification against the other, and the failure would have looked like a staleness bug rather than a hashing bug.

**Consequences:**
- Easy: locks are portable and third-party implementations are viable.
- Easy: the drift gate makes divergence a CI failure rather than a mystery.
- Hard: an external review dependency on a small set of files.
- Forecloses: opportunistic improvements to the hash, for example switching to a faster algorithm.

**Do not revert unless:** never without the review the policy names. That is the whole decision.

---

### D-35. Tenant isolation is on by default in production
**Date:** 2026-06-24 and 2026-06-25 hardening pass, `src/lib/cloud/saas.ts`.

**Status:** Standing, with an outstanding launch gate.

**Context:** The dual storage model (D-23) means the app runs in an open local mode and a strict hosted mode. Whether access checks are enforced is a single flag. Getting the default wrong in either direction is bad: default-off means a production deployment leaks tenant data, default-on means local development requires auth for everything.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| Default off, opt in for production | Frictionless locally. One forgotten environment variable is a data breach. |
| Default on always | Safe. Local development becomes annoying enough that people disable it and forget. |
| Default derived from `NODE_ENV`, overridable explicitly | Safe where it matters, easy where it does not. Requires the derivation to be correct and visible. |

**Decision:** `saasStrictMode()` returns false if `BLOCKSMITH_SAAS_STRICT === "0"`, true if `=== "1"`, and otherwise defaults to `process.env.NODE_ENV === "production"`. Wiki reads are gated by `assertWikiDocAccess` with default-deny and a `notFound()` response. The dashboard list is org-scoped, and anonymous users see nothing in hosted mode. Delete and rename are owner-only. Every create and import path calls `registerOwnedProject`.

**Why:** Default-deny is the only defensible default for a multi-tenant product. The `registerOwnedProject` requirement is subtle and was learned the hard way: without it, strict mode produces a "404 on your own new project" bug, because a document created by a user is not owned by anyone. Startup configuration warnings were added in `instrumentation.ts` specifically because the failure mode of a missing flag is silent.

**Consequences:**
- Easy: local development is open and fast.
- Easy: a production deployment is safe unless someone actively sets the flag to `0`.
- Hard: two behaviors to reason about in every access-control code path.
- Hard: an open launch gate. `BLOCKSMITH_SAAS_STRICT=1` is named the number one pre-launch flip in `docs/PRODUCTION-CHECKLIST.md`, and the verification step (sign in as two accounts and confirm neither sees the other's projects) has not been run against production yet.

**Do not revert unless:** never. If local friction becomes a problem, fix it with better local seeding, not by weakening the default.

---

### D-36. The production build refuses to run while the dev server is running
**Date:** `scripts/guard-build.mjs`, wired into `npm run build`.

**Status:** Standing.

**Context:** Running `next build` while `next dev` is active corrupts `.next` and produces missing-chunk errors and internal server errors in the browser. The symptom appears later, in an unrelated place, and looks like a code bug.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| Document it and rely on discipline | Zero code. It will happen anyway, and cost an hour each time. |
| Guard the build with a process check | One small script. Adds a build step that can false-positive on machines where `pgrep` behaves differently. |

**Decision:** `npm run build` runs `node scripts/guard-build.mjs` first. If `pgrep -fl 'next dev'` finds a running dev server, the build exits 1 with an explanatory message. The guard skips itself when `VERCEL === "1"` or `CI === "true"`, because `pgrep` can false-positive on build machines, and it allows the build if `pgrep` is missing entirely.

**Why:** This is a small decision recorded for a specific reason: it is the kind of guard that looks like unnecessary friction and gets deleted. The failure it prevents is expensive because it is misattributed. The production checklist even has to tell you about it ("stop `npm run dev` first, guard-build refuses to build over an active dev server"), which is evidence it fires in practice.

**Consequences:**
- Easy: a whole class of confusing local failures does not happen.
- Hard: one more thing between you and a build.
- Forecloses: building and developing simultaneously in the same checkout. Use a second checkout if you need that.

**Do not revert unless:** Next.js stops sharing `.next` between dev and build in a way that makes the conflict impossible.

---

### D-37. A "project" is one design system, which is one document
**Date:** 2026-06-23, dashboard work, founder's `dashboard-home` note.

**Status:** Standing.

**Context:** Before the dashboard, projects were scattered across scans and uploads with no UI to see them. Building a home base required deciding what a project **is** in the data model.

**Options considered:**

| Option | Real tradeoff |
|---|---|
| Introduce a new Project entity with its own table | Room to grow: multiple documents per project, project-level settings, project members. A new entity to keep in sync with documents, orgs, and the registry. |
| A project **is** a document record | Zero new entities. Everything that already works on documents (ownership, org scoping, the registry, the wiki) works on projects for free. Caps a project at one design system. |

**Decision:** A project is one design system is one upload or `DocumentRecord`. `listDashboardProjects()` in `src/lib/dashboard/projects.ts` reads `data/uploads/*.md` so it works locally with no Supabase, and hosted multi-tenant mode merges org-scoped documents into the same list. A project card links to `/wiki?doc=<docRef>`, which is the wiki that already existed. Signed-in users are redirected from `/` to `/dashboard`; signed-out users get the marketing page.

**Why:** It is consistent with D-02, where the unit of everything is the design document. Inventing a Project entity would have created a second identity for the same thing, and every ownership, access, and registry check would have needed to resolve between them. The founder's note frames the card click as opening "the same setup we already had", which is the intent: the dashboard is navigation over existing objects, not a new layer.

**Consequences:**
- Easy: the dashboard shipped quickly and inherits tenancy and access control unchanged.
- Easy: no migration, no new table, no new sync path.
- Hard: a project cannot contain multiple design systems. A company with a web system and a mobile system has two projects with no parent.
- Forecloses: project-level settings distinct from document-level settings, until a real entity is introduced.

**Do not revert unless:** customers need to group design systems, for example a design system family with shared foundations. That is a real grouping entity, and it should be added above documents rather than replacing them.

---

## Still open: decisions that should be made deliberately, not by drift

These are unresolved. Each one is currently being answered by default rather than by choice, which is the failure mode this chapter exists to prevent. If you find yourself building past one of these, stop and write a decision record first.

**Where the output plane goes.** [Chapter 20](./20-your-first-ninety-days.md) names the control plane as ahead of the output plane, and D-09 fixed the worst of codegen without deciding how far it goes. Is the generated package a real deliverable customers import in production, or is it a demo artifact proving the IR compiles? The answer changes how much work `packages/generated/*` deserves.

**Whether the extension track gets engineering time this year.** D-18 kept it separate. It did not decide when it starts. The north-star note lists the unanswered prerequisites: per-site DOM to IR extraction from live pages, persistence and sync of per-user overrides, performance on third-party sites, and where the deterministic and validated boundary sits when there is no clean source document.

**Multi-instance durability for rate limits and caches.** Upstash covers rate limiting, but the governed-generate cache and some limiter state remain in-memory and therefore per-instance. That is the same durability boundary as the scan limiter. It works and it is not correct.

**On-premise or self-hosted enterprise deployment.** D-24 chose managed vendors. No decision exists about what happens when an enterprise requires self-hosting, which is a common requirement in exactly the automotive and industrial segments D-30 points at.

**Billing.** There is none. No plan structure, no quotas, no Stripe. `docs/PRODUCTION-CHECKLIST.md` lists it under P2. Pricing shapes packaging, and packaging shapes the org and document model, so this is not purely commercial.

**Content Security Policy.** Listed as an open P2 item because it needs nonce wiring and can break Next.js if rushed. It also gates any future sandboxed preview of generated UI (D-21).

**Environment channels (staging versus production pointers).** `docs/TEAM-NORTH-STAR.md` sketches a v2 model with separate pointers per environment. Nothing is built. If an enterprise asks for it, the registry shape has to support it, and retrofitting pointers is harder than designing for them.

**The completion of the open-core extraction.** D-26 drew the boundary. The libraries marked "intended open" still live under `src/`, so the open tree cannot compile independently. Until that is done, the licensing position is a document rather than a fact, and the repository stays private.

**Whether the professor and platform review gate scales.** D-34 depends on an external reviewer for protocol semantics. That works at the current pace. It is not obvious it survives contact with a second engineer shipping daily.

**Sign-in beyond GitHub.** Auth is GitHub OAuth via Supabase. The buyer persona is a design-system lead, and not every designer has or wants a GitHub account. Listed as P2 in the production checklist, but it is a positioning question as much as an auth question.

---

## Open questions

1. Should decision records live in this chapter forever, or move to a lightweight ADR directory (`docs/decisions/NNNN-*.md`) once there are more than fifty? The current format is readable as a book chapter and will not stay that way.
2. Who has authority to supersede a record? Today it is the founder for everything and the professor for protocol semantics (D-34). A second engineer needs a written answer before their first disagreement, not after.
3. Several records here are grounded in the founder's memory notes rather than in a repository artifact (D-08, D-17, D-18, D-19, D-20). Those notes live outside the repository. Should they be copied into `docs/` so the reasoning survives independently of one machine?
4. D-06 and D-31 interact in a way nobody has fully worked through: auto-promote empties the staging lane, and the Pipeline's whole visual argument depends on the staging lane having something in it. The `/demo/investor` route seeds drafts artificially. What does a real customer's Pipeline look like on day two?
5. What is the actual revert cost of D-24? Nobody has estimated how long a migration off Supabase would take, which means "vendor lock-in is acceptable" is an assumption rather than a measured risk.

---

## Where to look in the code

| What | Path |
|---|---|
| Control plane: registry, lock, promote, rollback, enforce, hashing | `src/lib/ir/` (`registry.ts`, `lock.ts`, `enforce.ts`, `hash.ts`, `pipeline.ts`, `pipeline-runs.ts`) |
| Protocol package, schemas, conformance | `packages/protocol/`, `public/schema/*.json`, `npm run protocol:conformance` |
| Wiki control-plane routes | `src/app/api/wiki/` (`promote`, `rollback`, `finalize`, `pin-lock`, `pipeline`, `releases`, `source`) |
| Scan and component interface extraction | `src/lib/scan/` (`component-interface.ts`, `to-markdown.ts`, `parse.ts`) |
| Codegen and the three-tier emitter | `src/lib/codegen/pulse.ts`, guarded by `npm run verify:pulse` |
| Figma import, drift, REST connector | `src/lib/figma/` (`adapter.ts`, `normalize.ts`, `import.ts`, `components.ts`, `drift.ts`, `component-drift.ts`, `rest.ts`) |
| Vision capture ingest | `src/lib/ingest/capture.ts`, `src/app/api/ingest/capture/route.ts`, `extension/` |
| Shared color-lint engine and its five callers | `src/lib/governance/color-lint.ts`, `scripts/validate-ui.ts`, `scripts/governance-gate.ts`, `src/lib/governance/check-diff.ts`, `src/mcp/handlers.ts`, `src/lib/ai/governed-generate.ts` |
| Governed generation and the AI vendor seam | `src/lib/ai/governed-generate.ts`, `src/ai-lab/shared/chat.ts`, `src/ai-lab/shared/nvidia-profiles.ts` |
| Storage mode and tenancy gating | `src/lib/cloud/saas.ts`, `src/lib/supabase/env.ts`, `src/lib/cloud/wiki-access.ts`, `src/lib/dashboard/projects.ts` |
| Build guard and tsconfig exclusion | `scripts/guard-build.mjs`, `tsconfig.json` (`exclude`) |
| Licensing boundary | `LICENSING.md`, `LICENSE` (BSL 1.1), `LICENSE-MIT`, `packages/*/LICENSE` |
| Visual language tokens | `src/app/globals.css` (`@theme` block) |
| The founding documents these records interpret | `docs/CEO-DIRECTIVE.md`, `docs/TEAM-NORTH-STAR.md`, `docs/PROJECT-PROTOCOL.md`, `docs/PROJECT-PIPELINE.md`, `docs/00-thesis.md`, `docs/GOVERNANCE-TIERS.md`, `docs/FIGMA-IMPORT.md`, `docs/DESIGN-FIRST-INGEST.md`, `docs/PRODUCTION-CHECKLIST.md` |

Related chapters: [Chapter 07](./07-design-ir-and-blocks.md) for what a block is, [Chapter 08](./08-ingestion-how-truth-gets-in.md) for the ingest paths, [Chapter 10](./10-governance-and-design-cicd.md) for the promote and lock loop, [Chapter 15](./15-verification-and-quality.md) for the verify scripts, [Chapter 17](./17-what-we-still-need.md) for the gaps, and [Chapter 19](./19-glossary.md) for the vocabulary used throughout.
