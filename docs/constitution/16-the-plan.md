# The Plan: Phases, Streams, And Sequencing

**What this chapter covers:** where BlockSmith actually is today measured against the code and the commit history rather than the planning documents, the three-phase spine the company committed to, the six parallel streams that run underneath it, the single rule that decides what ships, what is explicitly paused, why the order is what it is, and a concrete 30 / 60 / 90 day plan with a proof artifact attached to every deliverable.

**Why it matters:** this repository contains roughly fifty planning documents. Several of them contradict each other, most of them were written at the moment of maximum optimism about the thing they describe, and a few describe work that was later paused without the document being updated. If you read them in the order you find them you will form a picture of the company that is roughly one phase ahead of reality. This chapter is the correction.

**Read this if:** you need to decide what to build next, you need to tell someone outside the company what is real, or you are about to reopen a plan that was closed for a reason.

---

## How this assessment was made

Everything below is grounded in three sources, in this order of authority:

1. **The code.** What is in `src/`, `packages/`, and `scripts/` right now.
2. **The verify scripts.** `package.json` defines about forty `verify:*` entries. A claim covered by a passing verify script is stronger than a claim covered by a document, because the script is executable and the document is not. See [Chapter 15](./15-verification-and-quality.md).
3. **The git history.** `git log --oneline --format='%h %ad %s' --date=short` gives the real build order and the real dates.

Planning documents are used only for intent, never for status. When a document says a thing is done and the code says otherwise, the code wins.

There is one more source that matters and is easy to miss: `git status`. At the time of writing it reports about two hundred modified and untracked paths on the branch `feat/figma-import-and-dashboard`, which has never been pushed. That is not a detail. It is the single most important fact about the current state of the company, and it is covered in its own section below.

---

## Where we are today

### The shape of the timeline

The first commit is dated 2026-06-05. The most recent commit is dated 2026-06-25. That is seventy commits across twenty days. Everything you see in this repository, the scan pipeline, the Design IR, the registry, the lock file, the promote console, the protocol package, the MCP server, the CLI, the governance tiers, the code generator, the device compile target, was built inside that window.

That is the good news and the bad news in one sentence. The good news is that the surface area is unusually large for the elapsed time. The bad news is that almost nothing in it has aged. Very little has been run twice, by two different people, against two different real inputs. The verify scripts are the compensating control, and they are genuinely good, but a verify script proves the system is internally consistent. It does not prove that a stranger can use it.

### The uncommitted branch

Since the last commit, a large body of work has accumulated in the working tree without being committed:

| Area | What is sitting uncommitted |
|---|---|
| Figma connector | `src/lib/figma/rest.ts`, `src/app/api/figma/connect/route.ts`, `src/app/api/figma/webhook/`, `src/app/api/v1/figma/`, `figma-plugin/` |
| Deviation and TTL governance | `src/app/api/v1/deviations/`, `src/lib/cloud/deviations.ts`, `supabase/schema-deviations.sql`, `src/components/wiki/DeviationsQueuePanel.tsx`, `packages/cli/src/fix.ts`, `packages/cli/src/updates.ts` |
| Email delivery | `src/lib/email/send-org-invite.tsx`, `src/emails/OrgInviteEmail.tsx`, the `resend` dependency |
| Dashboard rework | a full shadcn-style component library under `src/components/ui/`, `src/components/app-shell.tsx`, `src/components/app-sidebar.tsx`, `src/app/dashboard/analytics/`, with `src/components/dashboard/DashboardSidebar.tsx` deleted |
| Capture and ingest | `src/app/api/ingest/`, `src/lib/ingest/capture.ts`, `extension/` |
| Pipeline console output | `src/components/wiki/pipeline/RunConsoleDrawer.tsx` |
| A vendored third-party repository | `ui/`, an entire checked-out design-system repo sitting in the working tree |

Read that table as a status, not as a changelog. **Everything in it is Built, unproven at best, and some of it is Partial.** None of it has been through a build, a deploy, or a second pair of eyes. Two of those items, the deviation queue and the email provider, are things this book elsewhere describes as missing. They are not missing. They are written and unlanded, which is a different and in some ways worse problem, because the company does not currently know whether they work.

**The first engineering action after reading this chapter is to land this branch.** Not to extend it. Split it into reviewable commits, get `npm run typecheck` and `npm run verify:software` green, and push. Until that happens every other plan in this chapter is written against a codebase nobody can reproduce.

### Status by area

Using the vocabulary from `STYLE.md`.

| Area | Status | What backs the status |
|---|---|---|
| Repo scan to `design.md` | **Shipped** | `npm run verify:goal1`, `verify:github-scan`; proven against a real public repo (`shadcn-ui/ui`) |
| Markdown to visual wiki | **Shipped** | `verify:wiki`, `verify:scan-wiki`; the wiki is the most exercised surface in the product |
| Design IR, registry, append-only versions, lock | **Shipped** | `verify:ir-cicd` runs the closed loop: ingest, promote, lock, rollback |
| Protocol package and public schemas | **Shipped**, not distributed | `npm run protocol:conformance` (fixtures, golden hash vectors, drift gate) plus the `/protocol` spec site. `npm view @blocksmith/protocol` returns 404, and the spec site tells readers to install it |
| Promote, rollback, pin-lock, Pipeline console | **Shipped** with known limits | `/wiki/pipeline`, `POST /api/wiki/{promote,rollback,pin-lock}`. `docs/RELEASE-TEST-PLAN.md` documents accepted races |
| Governance tiers 1, 2, 3 | **Built, unproven** | `verify:governance-tiers` passes. Tier 1 color linting is exact; Tier 2 prose rules are heuristics. Never run on a customer's pull request |
| MCP server, local and remote | **Shipped** | One implementation in `src/lib/mcp/blocksmith-server.ts` exposing sixteen tools and one prompt, served over stdio (`npm run mcp`) and over HTTP (`POST /api/mcp`); `verify:mcp-sync` |
| CLI | **Built, unproven** | `@block-smith/cli@0.1.0` is on npm (the `@blocksmith` scope was unavailable, hence the hyphen). No external use is recorded anywhere in the repository, and the published version predates every commit on the current branch |
| SDK and protocol packages | **Built, not distributed** | `@blocksmith/sdk` and `@blocksmith/protocol` both return 404 on npm. `scripts/publish-packages.mjs` only ever publishes the CLI, which bundles the SDK from source |
| Pulse code generation | **Partial** | `verify:pulse` asserts faithful emit for several component classes, and falls back to a generic stub when the IR lacks structure. Auto-generation on scan does not exist |
| Device profile and `tokens.h` | **Partial** | `npm run compile:device` and `/demo/device` exist. LVGL is a stub entry in the compile-targets manifest |
| Figma import | **Partial** | The MCP path was demonstrated on the founder's own Figma account. The REST connector (`src/lib/figma/rest.ts`) is uncommitted and has never made a live REST call |
| Org, roles, invites | **Shipped in code**, unproven in production | `verify:org-rbac`, `verify:governance-e2e`. Requires `supabase/schema-orgs.sql` applied by hand |
| Tenant isolation | **Built, unproven** | `verify:saas-acl`, `verify:security-gate`. `docs/SECURITY-RELEASE-GATE.md` step S9, the two-person stranger test on production, has never been run |
| Hosted SaaS on Vercel | **Partial** | A deployment exists at the URL in `docs/DEPLOY.md`. Whether the Supabase schemas and the strict-mode flag are actually applied there is not verifiable from the repo |
| Billing | **Not built** | No payment code of any kind exists |
| Browser extension, Figma plugin | **Idea** with skeleton files | `extension/` and `figma-plugin/` are four-file scaffolds, uncommitted |
| OTA, firmware, dev boards, HMI pipelines | **Idea** | Described in `docs/CEO-DIRECTIVE.md` as a five-rung ladder. Rung 1 partially exists. Rungs 3, 4, 5 have no code |

### What is vapor

Being blunt, because the alternative is walking into a customer meeting with a claim you cannot demonstrate. The following appear in company documents in language that implies more than exists:

- **"Design CI/CD" as a customer outcome.** The engine works end to end inside this repository. It has never gated a pull request in a repository we do not own. Until it does, this is a demo, not a product claim.
- **"Enterprise RBAC and audit."** Roles exist and are enforced in code. There is no SSO, no SCIM, no penetration test, no data-retention policy, and no exported audit log. `docs/SECURITY-RELEASE-GATE.md` is explicit that this must not be claimed in live demos until the stranger test passes. It has not passed.
- **"Third parties run our conformance suite."** The suite runs and the fixtures are forkable. No third party has run it, because `@blocksmith/protocol` is not on npm. The `/protocol` spec site instructs readers to `import { validateGraph } from "@blocksmith/protocol"`, which currently 404s. That is worse than not claiming it.
- **"One package per product."** The code generator produces a package into `packages/generated/`. Nothing publishes it, nothing regenerates it when a scan changes, and `POST /api/v1/codegen/pulse` writes into `process.cwd()`, which is read-only on Vercel. The hosted endpoint cannot succeed in production.
- **The homepage social proof.** `src/components/home/HomeStudio.tsx` contains a `TRUSTED_LOGOS` array with ten real company names and ten invented testimonial quotes attributed to them. This is not a roadmap gap, it is a live legal and credibility exposure, and it is treated as a blocking item in [Chapter 17](./17-what-we-still-need.md).

### What is genuinely strong

It would be dishonest in the other direction not to say this. Three things here are better than they have any right to be at this age:

1. **The Design IR and its hashing and versioning semantics.** Append-only versions, an explicit official pointer, stale-not-deleted, conflict blocking promote. There is a CI drift gate that has already caught a real divergence between the application's hash implementation and the package's. That is a serious piece of infrastructure.
2. **The verify culture.** Roughly forty executable assertions, aggregated into `npm run verify:software`. Most companies at this stage have a README and hope.
3. **The promote-then-lock model itself.** It is a clean idea, it is implemented, and it is the thing that makes the rest coherent. See [Chapter 10](./10-governance-and-design-cicd.md).

---

## The three-phase spine

The phase model comes from `docs/00-thesis.md`. It has survived every strategy revision in the repository, which is a good sign. The phases are about **what the same intermediate representation compiles to**, not about calendar time.

### Phase 1: Software truth

**The claim.** Point BlockSmith at a real repository. Get a design document. Get a wiki humans browse. Get governance agents obey through MCP. Prove all of it with `npm run verify:software`.

**Definition of done.** All five of these, not four:

1. A stranger, with no help, scans their own repository on the hosted product and gets a wiki they consider accurate.
2. That stranger edits one governance rule, promotes it, and pins the lock.
3. They pull the lock into their repository with the published CLI.
4. Their coding agent, through MCP, reads the promoted version and not the draft.
5. Their CI blocks a pull request that violates a Tier 1 rule.

**Current status: Partial, and further from done than the documents suggest.** Steps 1 through 4 work on this machine and are covered by verify scripts. `docs/GOAL-SAAS-STATUS.md` scores the two goals at roughly 76 percent and 66 percent on hosted SaaS, and the stranger-ready number at roughly 58 percent and 52 percent. Those numbers predate the uncommitted branch and were self-assessed.

**What specifically remains:**

- The launch gates in [Chapter 17](./17-what-we-still-need.md) that require a human: Supabase provisioning, `BLOCKSMITH_SAAS_STRICT=1`, a clean production build.
- A CLI release that matches the current code. `@block-smith/cli@0.1.0` exists on npm but predates everything on the current branch, so step 3 today either requires cloning this repository or running a stale client.
- Step 5 has never happened outside our own fixtures. Nothing proves the CI gate on a repository we do not control.
- The two-person stranger security test from `docs/SECURITY-RELEASE-GATE.md`.

### Phase 2: Design as library

**The claim.** The same document that produces the wiki compiles to `@blocksmith/<product>`, so an agent imports `Surface`, `Text`, and `Button` instead of inventing CSS.

**Definition of done.**

1. Scanning or promoting regenerates the package automatically, without a manual script run.
2. The generated components are faithful to the customer's real components, not `<div>` wrappers.
3. The package version is tied to the lock hash, so "which design version is this build against" has one answer.
4. A developer can install it and build a screen with it.

**Current status: Partial.** Point 2 is the one that moved recently and it moved a long way. The original code generator stamped `<div>{children}</div>` for everything except a hand-written `Button`, because the scan IR only captured file paths, exports, and colors. The fix, recorded in the `faithful-codegen-pipeline` memory and in `src/lib/scan/component-interface.ts`, was to extract a real component interface from TSX using the TypeScript syntactic API, carry the verbatim source through the markdown round trip as an encoded comment, and emit in three tiers: verbatim source when the component is exported by name, a synthesized real prop signature from the IR, and a generic stub only as a last resort. `verify:pulse` asserts the faithful tier so it cannot silently regress.

**What specifically remains:** points 1, 3, and 4. Generation is a manual `npm run codegen:pulse`. Nothing binds the package version to the lock. Nothing is installable by anyone.

### Phase 3: Device profiles

**The claim.** The same IR compiles to a watch or HMI simulator, and then to native or LVGL output. Same **contract**, deliberately not the same JavaScript import on a microcontroller. `docs/PITCH-AND-PRODUCT-MODEL.md` is careful about this and you should be too: the promise is one design package with multiple compile targets, not `npm install` on a chip.

**Definition of done.**

1. A component page in the wiki links to a device frame that renders from the promoted graph.
2. `tokens.h` compiles from the official pointer, never from drafts.
3. One real embedded target, LVGL first, emits something that builds.
4. A device artifact is traceable to a lock hash, so you can answer "which promoted version is on that screen".

**Current status: Partial at rung 1, Idea above it.** `npm run compile:device` exists, `/demo/device` exists, and the compile-targets manifest lists `device-sim` and `c-header` as real targets with `lvgl` as a stub. Points 3 and 4 have no code. The OTA ladder in `docs/CEO-DIRECTIVE.md` (dev board profiles, production HMI build farms, signed field artifacts) is a category narrative and should be presented as one.

### The phase table, honestly restated

| Phase | Claim | Definition of done | Status | Largest single gap |
|---|---|---|---|---|
| 1 | Software truth | Stranger completes scan to CI gate unaided | **Partial** | Nothing has ever gated a pull request in a repo we do not own |
| 2 | Design as library | Package auto-builds on promote, faithful, installable, lock-tied | **Partial** | No automation, no distribution |
| 3 | Device profiles | Wiki-linked frame, `tokens.h`, one real embedded target, lock-traceable | **Partial at rung 1** | No real embedded emitter |

---

## The parallel streams

`docs/TEAM-NORTH-STAR.md` and `docs/CEO-DIRECTIVE.md` define six streams. The important structural claim is that they run **at the same time**, with **Stream A as the spine**, and that B through F may only branch from the promoted graph. That is not a scheduling preference. It is what stops a small team from producing six disconnected products.

The reason the spine is A and not something more exciting: every other stream reads from the official pointer. If the control plane is wrong, everything downstream is confidently wrong. A bug in the compile target produces one broken artifact. A bug in the promote semantics produces a fleet of consistent lies.

### Stream A: Control plane

**Mandate.** The wiki as a release console. Badges, the Pipeline view, a durable registry, lock generation, rollback, audit.

**Current state: the strongest stream, and the one with the most dangerous remaining defect.** `/wiki/pipeline` is live with staging and production lanes, a diff drawer, a lock strip, run history, and pin-lock. `docs/RELEASE-TEST-PLAN.md` is unusually honest about what is left: the registry's source of truth is still disk JSON with a cloud mirror, and concurrent promotes across serverless instances can interleave, because a read-modify-write on registry entries has no cross-instance lock. That is accepted at launch scale and it is not acceptable at team scale.

**Next three tasks.**

1. **Move the registry source of truth into Postgres**, with transactions and row locking, so two humans promoting the same document in the same second cannot interleave. `docs/RELEASE-TEST-PLAN.md` names this post-release priority number one. Proof: extend `verify:ir-cicd` with a concurrent-promote case that fails on the current implementation.
2. **Apply `supabase/schema-registry.sql` on production and prove lock hydration survives a cold start.** Test 3 in `docs/RELEASE-TEST-PLAN.md` calls this the single most important test before release, because it was the "my lock disappeared overnight" bug. Proof: pin a lock, force a cold instance, reload, hash unchanged.
3. **Land the uncommitted `RunConsoleDrawer` and the run status and log columns**, so every promote, rollback, pin, and ingest leaves an inspectable record with an actor. Proof: a failed promote appears as a red run with the error line, not a 500 in devtools.

### Stream B: Handshake

**Mandate.** MCP enforcement, `validate:ui` in the customer's CI, a hosted package path.

**Current state: Built, unproven.** The MCP server exposes sixteen tools locally and at `POST /api/mcp` with an API key. `enforce.ts` restricts agents to the official graph, and the server instructions state that drafts and conflicted blocks are never served. The `validate-ui.yml` workflow exists and runs against this repository. The CLI implements `login`, `whoami`, `mcp-url`, `codegen`, `pull`, `scan`, `check`, `setup cursor`, and `setup hooks`. Version 0.1.0 is on npm and nobody outside this machine has run it.

**Next three tasks.**

1. **Publish `@blocksmith/protocol`, and cut a CLI release that matches the current code.** The protocol package is the one the spec site tells third parties to install, and it 404s. The CLI is published but stale. Proof: install both on a clean machine, run `blocksmith login` and `blocksmith pull` and get a `DESIGN.md` written, and run the conformance suite out of `node_modules`.
2. **Prove the MCP boundary from the outside.** Point a real Cursor or Claude Code instance at the hosted MCP with an API key, edit a governance rule without promoting, and demonstrate the agent still sees the old official version. Proof: a recording, plus an assertion added to `verify:mcp-sync`.
3. **Run `validate:ui` on a repository we do not own.** This is the single highest-value unproven claim in the company. Proof: a pull request in a friendly external repository that fails the check and then passes after a fix.

### Stream C: Compile targets

**Mandate.** Pulse, the device simulator, `tokens.h`, then real embedded profiles.

**Current state: Partial and thin relative to the control plane.** The imbalance is easy to quantify. The control plane (`src/lib/scan/`, `src/lib/ir/`, `src/lib/cloud/`, `src/lib/figma/`, `src/lib/parser/`, `src/lib/design-ir/`, `src/lib/mcp/`, `src/lib/governance/`) is roughly nineteen thousand lines. The entire output plane, meaning `src/lib/codegen/`, `src/lib/ir/targets/`, `packages/pulse-runtime/`, and the two compile scripts, is roughly nine hundred. The device simulator is two hundred lines with three hardcoded frames. The C header emitter is ninety-three lines and its output has never been compiled by any toolchain in this repository. `packages/pulse-runtime` contains exactly two components, `Surface` and `Text`, despite the MCP `pulse_codegen` tool description promising a `Button`. This is the plane-imbalance that [Chapter 20](./20-your-first-ninety-days.md) names as the likely first ownership area for the technical cofounder.

**Next three tasks.**

1. **Make the hosted code generation endpoint work at all, then auto-generate on promote.** `src/lib/codegen/run.ts` writes into `process.cwd()/packages/generated`, never calls `blocksmithWritableRoot()`, and never mirrors to Supabase, so `POST /api/v1/codegen/pulse` fails with `EROFS` on Vercel. It also silently falls back to a committed fixture (`fixtures/vendor-ui/scan-snapshot.md`) when it cannot resolve the caller's document, which means the endpoint can return a plausible-looking package built from somebody else's design system. Fix both, then trigger generation on promote. Proof: promote a block on the hosted product and get a package whose version derives from the lock hash.
2. **Widen faithful emit coverage.** Find the component classes that still fall through to the generic stub and add IR support for them. Proof: extend `verify:pulse` with the new classes so the faithfulness bar ratchets.
3. **Make one real LVGL emitter**, even a minimal one covering colors, spacing, and one widget style. Proof: `npm run compile:device` produces output that compiles in an LVGL project, and the compile-targets manifest promotes `lvgl` from stub to reference.

### Stream D: Ingest

**Mandate.** Everything that writes `blocks.v1`: scan, upload, Figma, Storybook, webhooks, re-scan intelligence.

**Current state: the broadest stream, with very uneven depth.** Scan is Shipped. The Storybook adapter is Shipped and exists specifically to prove the protocol is not BlockSmith-shaped. Figma is Partial: the transforms are pure and verified by `verify:figma-import`, the MCP path was demonstrated live, and the REST connector has never made a live call. Webhooks are uncommitted skeletons.

**Next three tasks.**

1. **Make one live Figma REST call with a real personal access token** and fix whatever breaks. This converts the largest Built-unproven item in the product to Shipped. Proof: `verify:figma-import` gains a live-mode assertion, and a real file produces a wiki.
2. **Land the Figma webhook so a file change triggers a re-scan** and surfaces drift in the wiki. The moat here is the drift view, not the import; the `figma-fit-wedge` memory is emphatic about that.
3. **Re-scan intelligence.** Prove that changing one component in code bumps exactly one block version and marks nothing else stale. Proof: the ingest run console shows the single bumped block, per test 8 in `docs/RELEASE-TEST-PLAN.md`.

### Stream E: Field and OTA

**Mandate.** Promoted design reaching devices that cannot run `npm install`, with the same version semantics as software.

**Current state: Idea.** There is no code. This is correct and deliberate. It is also the stream most likely to be over-described in a pitch, because it is the most exciting. `docs/CEO-DIRECTIVE.md` argues it is the reason automotive, IoT, and industrial teams pay enterprise prices, and that argument is plausible. It is still an argument, not a product.

**Next three tasks.** All of them are paper, and that is the point.

1. **Write the channel model** on paper: staging channel versus production channel, what a signed artifact contains, how rollback works when the target has no filesystem you can inspect.
2. **Define the traceability requirement**: a device artifact must name the lock hash it was built from. Nothing ships in this stream that cannot answer "which promoted version is on that screen".
3. **Find one design partner with real hardware** before writing a line of firmware code. This stream is demand-gated, not capability-gated.

### Stream F: Proof

**Mandate.** Evaluation, drift metrics, and a public `blocks.v1` that other people can implement against.

**Current state: Partial.** The conformance suite and the CI drift gate are real and good. The evaluation is missing entirely: no external team has used the product for two weeks, no drift has been measured on a real codebase, and no case study exists.

**Next three tasks.**

1. **Publish `@blocksmith/protocol`.** The suite is forkable. It is one `npm publish` from being a claim we can make truthfully, and until then the spec site is pointing people at a package that does not exist.
2. **Instrument drift.** Every `blocksmith check` run already posts to `/api/v1/governance/events`. Turn that into a number a customer sees: violations per week, which rules, which components, trending which way.
3. **Run the two-week study with one real team.** Measure drift before and after. This is the paper, the case study, and the enterprise sales asset, and it is the same artifact.

---

## The rule that keeps focus

> **Everything must connect to promote-then-lock within two hops. Disconnected experiments do not ship.**

The rule comes from `docs/TEAM-NORTH-STAR.md` and `docs/CEO-DIRECTIVE.md`. The phrasing in the directive is worth internalizing: nothing is banned, disconnected work is banned. A team that does not share a loop becomes a set of unrelated startups sharing a repository.

**How to apply it.** Take the proposed feature and ask what it touches. Then ask what that touches. If you have not reached the promoted graph or the lock file in two steps, the feature is not ready to build in its current framing. Reframe it or drop it.

### Things this rule would have killed

These are real. Several are in the working tree right now.

| Thing | Hops to promote-then-lock | Verdict |
|---|---|---|
| `font-generator/`, a nested standalone Next.js app that instances variable fonts from a prompt | None. It does not read or write the block graph | **Would have been killed.** It also broke the root build until it was excluded from `tsconfig` |
| `ui/`, an entire vendored third-party design-system repository in the working tree | None | **Would have been killed.** This is dependency copying, not a feature |
| Browser extension that restyles arbitrary websites | Conceptually two hops (page to IR to wiki) but a completely different buyer | **Correctly parked.** See `extension-restyle-web`. Do not put it in the design-system pitch |
| Prompt-to-UI playground generating three visual variations (`docs/07-experiments-backlog.md`) | None. Output feeds nothing | **Killed.** It is a demo, not a loop |
| Design System Explainer as a separate application | Zero as a separate app, one as a component-block feature | **Correctly merged** into component blocks rather than built standalone |
| Notion import, VS Code extension, multi-repo monorepo support (the icebox in `docs/07-experiments-backlog.md`) | Unclear, unspecified | **Correctly iceboxed** |
| A separate "Jenkins for design" admin application | One, but it duplicates the wiki | **Killed by name** in `docs/TEAM-NORTH-STAR.md`. The pipeline ships inside the wiki |

### Things the rule kept, and why

The rule is only useful if it also lets ambitious work through. Two examples:

- **Governed generation** (`src/lib/ai/governed-generate.ts`) looks like an AI demo. It survives because the drift number it displays is computed by `src/lib/governance/color-lint.ts`, the exact engine the CI gate and the MCP `validate_ui_code` tool use. The output is scored by real enforcement, so it is one hop from the loop, not zero.
- **Figma import** survives because the adapter writes `blocks.v1` and nothing else. It does not write the wiki directly and it does not write Pulse directly. That constraint is written into the adapter contract in `docs/PROJECT-PROTOCOL.md`, and it is what keeps ingest from becoming a second source of truth.

---

## What is explicitly paused, and why

`docs/00-thesis.md` names four pauses. `docs/PUBLIC-RELEASE-SPRINT.md` names more. Consolidated:

| Paused | Why | What would unpause it |
|---|---|---|
| **Ingest everything** (arbitrary sources, generic importers) | Each adapter costs real maintenance and none of them make Phase 1 work for one team | Two design partners asking for the same source |
| **Social screenshots and public block feedback at scale** | It is a second product with a second audience. `docs/PUBLIC-FEEDBACK.md` is a good idea attached to no current customer | A customer asking to test a component with people outside their team |
| **Quartus and FPGA work** | The founders' computer-engineering background makes this tempting. It is four rungs above where the compile ladder actually is | Rungs 2 and 3 of the ladder being real |
| **Real firmware and OTA** | Enormous, and demand-gated. See Stream E | A design partner with hardware and a budget |
| **Publishing every generated package to npm** | One package per customer product on a public registry is a naming, security, and support problem we have not solved | A customer who wants to consume the package the way they consume any other dependency |
| **Billing and Stripe** | Explicitly deferred until the product is stranger-ready. `docs/PUBLIC-RELEASE-SPRINT.md` lists it under do-not-build | Someone trying to pay |
| **Enterprise SSO and SAML** | `docs/SECURITY-RELEASE-GATE.md` puts this in P2, after the P0 identity work | A Fortune 100 procurement conversation |
| **CRDT and multi-user live co-editing** | Research. The current conflict model (`baseContentHash`, 409, force or discard) is sufficient for a small team | Two people editing the same block and complaining |
| **IDE-to-web live file watching on hosted SaaS** | `docs/GOAL-SAAS-STATUS.md` marks this **not planned**. There is no watcher on a serverless clone. Re-scan and CLI scan replace it | Nothing. This one is a permanent architectural decision, not a pause |

Two notes on the pause list. First, a pause is only honest if it is stated in the pitch as a pause. Second, `font-generator/` is not on this list because it was never sanctioned. It is a separate application in a subdirectory, it has its own architecture memory, and it required a `tsconfig` exclusion to stop it breaking the root build. Treat it as a parked side project, not a stream.

---

## Sequencing logic

### Why this order and not another

Three constraints determine the order, and they are hard constraints, not preferences.

**Constraint one: the control plane must be durable before anything reads from it.** Every compile target, every MCP response, and every lock file is a function of the official pointer. If the registry can lose a promote on a cold lambda, then every artifact downstream is a function of an unreliable input. This is why "move the registry into Postgres" outranks every feature in this chapter.

**Constraint two: nothing is proven until it is proven from outside.** The verify scripts are internally consistent, and internal consistency is exactly what a closed system gives you for free. The three things that convert Built-unproven to Shipped all involve an external party: an npm registry, a live Figma token, and a pull request in a repository we do not own. Each of those is cheap. Each is worth more than a feature.

**Constraint three: identity gates everything customer-facing.** `docs/SECURITY-RELEASE-GATE.md` is marked a release blocker for a good reason. This product hosts other companies' proprietary design systems. A leaked wiki URL is a data-exposure incident, not a UX bug. Nothing that invites a stranger to upload real intellectual property ships before that gate is green on production.

### The dependency graph

```
                    [ Land the uncommitted branch ]
                                  |
                                  v
                    [ Supabase provisioned + SAAS_STRICT=1 ]
                                  |
              +-------------------+-------------------+
              |                                       |
              v                                       v
  [ Registry source of truth       ]      [ Stranger security test
    in Postgres (Stream A)         ]        passes on production ]
              |                                       |
              +-------------------+-------------------+
                                  |
                                  v
                    [ Phase 1 loop is trustworthy ]
                                  |
        +-------------------------+-------------------------+
        |                         |                         |
        v                         v                         v
[ Publish CLI + SDK      ]  [ Auto-build package     ]  [ Live Figma REST
  + protocol (Stream B/F) ]    on promote (Stream C) ]    + webhook (Stream D) ]
        |                         |                         |
        v                         v                         |
[ validate:ui gates an   ]  [ Package tied to lock   ]      |
  external PR (Stream B) ]    hash (Stream C)        ]      |
        |                         |                         |
        +-------------------------+-------------------------+
                                  |
                                  v
                    [ Phase 1 done: first external team ]
                                  |
              +-------------------+-------------------+
              |                                       |
              v                                       v
   [ Drift measured on a real     ]      [ LVGL emitter, artifact
     codebase (Stream F)          ]        traceable to lock (C) ]
              |                                       |
              v                                       v
   [ Case study + paying          ]      [ Phase 3 rung 3, only with
     customer                     ]        a hardware design partner ]
                                                      |
                                                      v
                                          [ OTA channel model (E) ]
```

Read the graph as prerequisites, not as a schedule. Everything on one row can happen in parallel. Nothing on a lower row is worth starting before the row above it holds.

### What is a prerequisite for what

| This | Blocks this | Because |
|---|---|---|
| Landing the branch | Everything | Nobody can reproduce the current state |
| Supabase provisioning and `BLOCKSMITH_SAAS_STRICT=1` | Any external user | Without strict mode there is no tenant isolation |
| Registry in Postgres | Any team larger than one promoter | Concurrent promotes interleave |
| A current CLI release plus `@blocksmith/protocol` on npm | Any customer completing the loop, and any third-party protocol implementation | The published CLI predates the current code, and the spec site points at a package that does not exist |
| A live Figma REST call | The Figma wedge as a sales motion | A connector that has never connected is not a connector |
| `validate:ui` on an external PR | The entire design-CI/CD claim | It is the moment the wiki stops being documentation |
| A drift measurement on real code | The pitch, the paper, and enterprise pricing | Every enterprise conversation asks "how much drift did you remove" |

---

## The next 30, 60, and 90 days

Every deliverable names the artifact that proves it. A deliverable without a proof artifact is a wish. Where an existing script covers it, the script is named; where one must be written, that script is part of the deliverable.

### Days 1 to 30: make the current state real

The theme is subtraction and proof, not addition. Ship nothing new.

| # | Deliverable | Proof |
|---|---|---|
| 1 | The `feat/figma-import-and-dashboard` branch is split into reviewable commits and pushed | `npm run typecheck` clean and `npm run verify:software` green on the pushed branch |
| 2 | Supabase provisioned: all five SQL files applied, `scan-docs` bucket private, GitHub auth provider configured with production callback URLs | `npm run verify:supabase` and `curl /api/supabase/health` return `serviceRoleSet: true` |
| 3 | `BLOCKSMITH_SAAS_STRICT=1` set in Vercel, plus Sentry DSN and Upstash keys | Startup config warnings from the root `instrumentation.ts` are silent in the production log |
| 4 | A clean production build deploys | `npm run build` passes locally (stop `npm run dev` first, `guard-build` blocks it), then `BLOCKSMITH_URL=… npm run verify:production-smoke` |
| 5 | Every key ever pasted in plaintext is rotated | A written inventory of rotated credentials, checked against `.env.example` |
| 6 | The fabricated homepage testimonials are removed | `TRUSTED_LOGOS` in `src/components/home/HomeStudio.tsx` contains only claims we can defend |
| 7 | The two-person stranger security test passes on production | The signed checklist in `docs/SECURITY-RELEASE-GATE.md`, executed by two people who did not write the access-control code |
| 8 | The full release test plan is executed on production | All nine sections of `docs/RELEASE-TEST-PLAN.md`, especially test 3, lock survives a cold start |
| 9 | `verify:software` and `typecheck` run on every pull request | A GitHub Actions workflow beside the three that already exist |

**The 30-day success condition:** a person who is not us can sign in, scan a repository, browse a wiki, stage a change, promote it, pin a lock, and not see anyone else's data, on the hosted product, without help.

### Days 31 to 60: prove it from outside

| # | Deliverable | Proof |
|---|---|---|
| 10 | A CLI release matching the current code, published | Install globally on a clean machine, `blocksmith login`, `blocksmith pull --doc …`, and confirm `DESIGN.md` is written |
| 11 | `@blocksmith/protocol` published, so the spec site stops pointing at a 404 | `npx tsx node_modules/@blocksmith/protocol/conformance/run.ts` passes from a clean external install |
| 12 | Registry source of truth moved into Postgres with transactional promote | A new concurrent-promote case in `verify:ir-cicd` that fails against the disk-JSON implementation and passes after |
| 13 | One live Figma REST connection with a real personal access token | `npm run verify:figma-import` gains a live-mode path; a real Figma file produces a governed wiki |
| 14 | `validate:ui` blocks a real pull request in a repository we do not own | A link to the failing check, then the passing check after the fix |
| 15 | MCP enforcement demonstrated end to end against a live agent | A recording: draft edit invisible to the agent, promote, agent sees the new version. Assertion added to `verify:mcp-sync` |
| 16 | The Pulse package builds automatically on promote, versioned by lock hash | `verify:pulse` asserts the generated package version matches the current lock hash |
| 17 | Distributed rate limiting and caching verified across instances | Hammer an endpoint from two regions and observe a shared 429 budget, per test 6 in `docs/RELEASE-TEST-PLAN.md` |

**The 60-day success condition:** every headline claim in the pitch has a demonstration that does not run on our laptop.

### Days 61 to 90: first real team, first real number

| # | Deliverable | Proof |
|---|---|---|
| 18 | One external team scans their own repository and uses the wiki for two weeks | A weekly promote count and a login count from their org |
| 19 | Drift measured on their codebase, before and after | A number from `/api/v1/governance/events`: violations per week, by rule, by component, trending |
| 20 | A drift dashboard in the wiki, not a spreadsheet | A wiki view showing violations over time, sourced from the governance events table |
| 21 | The deviation TTL queue landed and used by that team | A deviation created by a real `git push`, reviewed in the wiki, and resolved or auto-approved by TTL |
| 22 | One real LVGL emitter, minimal but building | `npm run compile:device` output compiles in an LVGL project; `lvgl` moves from stub to reference in the compile-targets manifest |
| 23 | A device artifact traceable to a lock hash | The emitted artifact names the lock hash it was built from |
| 24 | The case study written | Team, before number, after number, what broke, what they kept |

**The 90-day success condition:** we can say, with a number and a named team, how much design drift BlockSmith removed. Everything in the pitch is downstream of that sentence.

### What is deliberately not in the 90 days

Billing, SSO, OTA, the browser extension, publishing customer packages, new wiki pages, new ingest adapters, and anything on the icebox. If one of those becomes urgent because a customer asked, that is a good reason to reopen it. Being interesting is not.

---

## The milestones that would change the company

These four are qualitatively different from the deliverables above. Each one converts a belief into a fact, and each one changes what we are allowed to say.

### 1. First external team scans their own repository

**Why it changes things.** Every parser heuristic in `src/lib/scan/` was tuned against fixtures and a small number of public repositories. The first real customer repository will break the classifier in a way we have not imagined. `docs/GOAL1-VENDOR-SCAN.md` already admits the classifier is conservative for repositories without a `blocksmith.config.json`: `shadcn-ui/ui` featured 1 component out of 49.

**What it unlocks.** The right to say "works on real codebases" without a qualifier. It also produces the first honest answer to "how long does setup take", which is the question every design lead asks second.

**How we will know:** an org in `blocksmith_documents` we did not create, with a scan document from a repository we do not own.

### 2. First paying customer

**Why it changes things.** Nothing in this repository has ever been priced. There is no billing code, no plan model, and no quota system. The first payment forces all three to exist and forces the pricing question to be answered with evidence instead of a guess.

**What it unlocks.** The difference between a project and a company. It also changes the engineering priority order permanently: uptime and data durability stop being hygiene and start being contractual.

**How we will know:** money moved. Not a letter of intent, not a pilot agreement.

### 3. First customer CI gate blocking a real pull request

**This is the most important of the four.** Everything in the thesis reduces to one claim: humans promote, agents and CI obey. Until a `validate:ui` run has blocked a merge in someone else's repository, that claim is a diagram.

**Why it changes things.** It is the moment the wiki stops being documentation and becomes enforcement, which is the exact framing in `.github/workflows/validate-ui.yml`. It is also the moment the product becomes hard to remove, because a team that has wired a gate into their merge process has made a commitment.

**What it unlocks.** The enterprise conversation. Audit, RBAC, and procurement all follow from "this blocks merges", and none of them follow from "this renders a wiki".

**How we will know:** a red check on a pull request in a repository we do not control, followed by a green one.

### 4. The protocol adopted by someone outside this repository

**Why it changes things.** `blocks.v1` is the asset the company intends to open-source to own the category. `docs/PROJECT-PROTOCOL.md` states the ambition plainly: Figma is Ethernet, BlockSmith is TCP/IP. That is a strong claim and it is currently unfalsifiable, because nobody outside this repository has ever emitted a `blocks.v1` graph.

**What it unlocks.** Neutrality. As long as we are the only implementation, the protocol is a file format. The moment a second implementation exists, it is an interchange layer, and the strategic position in [Chapter 04](./04-market-and-competition.md) becomes real.

**How we will know:** a third party runs `protocol:conformance` against their own emitter and passes, or opens an issue because they failed. Either is the milestone.

### The order these should arrive in

1 then 3 then 4 then 2 is the natural order and 2 may arrive anywhere. Milestone 3 is the one to optimize for, because it is the hardest to fake, it is the most defensible in a pitch, and it forces the largest number of unproven components to become proven at once.

---

## Open questions

- **Does the registry move to Postgres before or after the first external team?** Moving first is safer and delays the milestone that teaches us the most. Moving after risks losing a real customer's promote. The current lean is before, because losing a promote is unrecoverable trust and a delayed milestone is not.
- **Should the CLI be published before the stranger security test passes?** Publishing is a one-way door on a package name. The test is a prerequisite for inviting uploads, but not obviously for distributing a client.
- **Is Figma the wedge or an adapter?** `figma-fit-wedge` argues the drift view is the product and the import is the on-ramp. `docs/PUBLIC-RELEASE-SPRINT.md` lists Figma adapters as explicitly out of scope. Both cannot be the current plan.
- **What is the trigger to reopen Stream E?** "A design partner with hardware" is the stated bar, but nobody owns finding one, and the CEO directive argues it is where enterprise pricing lives.
- **How much of the phase-2 package story survives if customers only want the governance layer?** If the CI gate is the thing they pay for, the generated package may be a demo asset rather than a product. That would be a significant repositioning and it should be decided with evidence from the first external team, not now.
- **Who owns the pitch-to-reality gap?** Several documents make claims the code does not support. There is currently no process that forces a document to be downgraded when its subject slips.

## Where to look in the code

| Path | Why it matters to this chapter |
|---|---|
| `package.json` | The complete list of verify scripts. This is the executable definition of what is proven |
| `docs/CEO-DIRECTIVE.md` | The full stream model and the ambition ladder, including the OTA rungs |
| `docs/TEAM-NORTH-STAR.md` | The two-hop rule, the division of labor, and the block-version lifecycle table |
| `docs/00-thesis.md` | The original three-phase table and the pause list |
| `docs/RELEASE-TEST-PLAN.md` | The most honest document in the repository. Read the "known limitations" section first |
| `docs/SECURITY-RELEASE-GATE.md` | The release blocker, the route audit, and the stranger security test |
| `docs/PUBLIC-RELEASE-SPRINT.md` | The definition of stranger-ready and the explicit out-of-scope list |
| `docs/PROJECT-PIPELINE.md` and `docs/PROJECT-PROTOCOL.md` | The two completed assignment specs, with their definition-of-done checklists |
| `src/lib/ir/` | The control plane: registry, hashing, lock, enforcement, compile targets |
| `src/lib/codegen/pulse.ts` and `src/lib/scan/component-interface.ts` | The output plane and the three-tier emit that made it faithful |
| `.github/workflows/` | The three CI gates that exist, and by omission the ones that do not |
| `git status` | The two hundred uncommitted paths. Check this before believing anything else |

---

**Next:** [Chapter 17](./17-what-we-still-need.md) turns this plan into a gap list: the launch gates that need a human rather than code, the engineering debt ranked by risk, and the single prioritized backlog.
