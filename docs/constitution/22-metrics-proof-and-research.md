# Proof: Metrics, Research, And How We Know We Are Winning

**What this chapter covers:** What we measure, what we only believe, what would prove us wrong, and how the research track connects to the product. It contains a full audit of every number this company currently quotes, including the ones that are not real.

**Why it matters:** A company like this fails quietly. Not with a crash, but by believing its own narrative for eighteen months while the market disagrees silently. Every other chapter of this book explains what we built and why. This chapter is the one that asks whether any of it is working, and it is deliberately unkind about the answer.

**Read this if:** You are about to put a number on a slide, write a percentage in a document, add a chart to the product, run a customer study, or argue that something is working. Also read it before you accept any figure produced by another chapter of this book.

---

## 1. The credibility principle

Two sentences, and everything else in this chapter is a consequence of them.

> **A claim without a measurement is an opinion.**
>
> **A measurement produced by asking a model to grade itself is worse than no measurement.**

The first sentence is ordinary discipline. The second is the one that matters for a company built on top of language models, and it is worth being precise about why it is *worse* rather than merely useless.

A model asked "is this output on-brand?" will produce a number. That number has three properties that make it actively harmful. It is **correlated with the thing it grades**, because the same model that wrote the output is judging it, so its blind spots are shared. It is **unfalsifiable in practice**, because there is no way to distinguish a good score from a compliant scorer, and a second model brought in to check the first has the same problem one level up. And it is **socially convincing**, because it is a number with a decimal point in a table, and a decimal point in a table is what people paste into decks. No measurement leaves a gap that someone eventually feels compelled to fill. A model-graded measurement fills the gap with something that looks finished.

The practical rule that follows:

| Tier | What it is | How much weight |
|------|-----------|-----------------|
| **Tier A: deterministic** | A pure function of an artifact. Same input, same number, no model, no human judgement. | Quotable externally |
| **Tier B: human-reported** | A person, ideally not us, states something. Survey, interview, opinion click, purchase order. | Quotable with the N and the method attached |
| **Tier C: model-reported** | A model scored something. | Internal exploration only. Never quoted. Never charted. Never in a deck. |

We currently produce Tier A in exactly one place, produce almost no Tier B, and must resist every temptation toward Tier C.

### 1.1 The one place we earn a real number

The one deterministic quantitative claim in this codebase comes from a ninety-seven line file with no dependencies: `src/lib/governance/color-lint.ts`.

It does one thing. Given a block of text and a set of approved hex colors, it finds every hex literal in the text that is not in the set:

```ts
// src/lib/governance/color-lint.ts
export function findOffTokenColors(text: string, palette: Set<string>): OffToken[]
export function nearestToken(hex: string, colors: TokenColor[]): NearestToken | null
```

The reason this file is our credibility anchor is not that it is clever. It is that **four different surfaces call the same function**, so the number cannot be tuned per audience:

| Surface | Path | What it does with the result |
|---------|------|------------------------------|
| CI gate (customer repo) | `scripts/validate-ui.ts` | Exit code 1, PR fails |
| Pre-commit gate (ours) | `scripts/governance-gate.ts` | Blocks the commit |
| MCP tool (agent, coding time) | `src/mcp/handlers.ts` → `handleValidateUiCode`, `handleCheckGovernanceDiff` | Returns `governed: boolean` and the violation list to the agent |
| Governed-generate drift score | `src/lib/ai/governed-generate.ts` → `scoreDrift` | The `driftCount` shown in the investor demo |

That shared engine is the whole argument. When the demo at `src/components/demo/GovernedAiShowcase.tsx` says the ungoverned agent produced eleven violations and the governed agent produced zero, those two numbers were computed by the identical function that fails a customer's pull request. The comment in `governed-generate.ts` says it plainly, and the comment is accurate:

> Crucially, drift is scored by the SAME color-lint engine the CI gate and the MCP `validate_ui_code` tool use, so the violation counts are real enforcement output, not the model's self-assessment.

Two more properties make it Tier A. There is **no model in the scoring path**: `scoreDrift` calls `paletteFromColors`, `findOffTokenColors`, and `nearestToken`, and nothing else. And the scorer is **symmetric**: `buildOutput` is called with the same arguments for the governed and the ungoverned agent, so we are not applying a lenient rule to ourselves and a strict rule to the baseline. The baseline is also not a strawman, because `runGovernedGenerate` sends both prompts to the same model list in parallel. The only difference is grounding.

### 1.2 Exactly what it measures, and what it does not

Being honest about the scope of the one real number is more valuable than the number.

**What it measures:** the count of hex color literals (`#abc`, `#aabbcc`, `#aabbccdd`) appearing in a text blob, normalized to lowercase six-digit form, that are not present in the design system's color list.

**What it does not measure, at all:**

- Colors written as `rgb()`, `hsl()`, `oklch()`, named CSS colors, or Tailwind utility classes such as `bg-blue-500`. A model that emits `rgb(217, 119, 87)` scores zero violations.
- Spacing, radii, typography, elevation, motion, or any non-color token.
- Component misuse. Importing the approved `Button` and using it as a link is invisible.
- Layout, hierarchy, accessibility, contrast ratios, touch targets.
- Whether the correct token was used. Using `--color-danger` for a success state passes cleanly.
- Anything in a file that is imported rather than pasted.

`nearestToken` uses squared RGB distance, which is not a perceptual color space. It is good enough to point an agent at the intended token, which is what the comment claims, and it is not a similarity metric anyone should quote.

There is a second lint, `src/lib/governance/prose-lint.ts`, which compiles promoted component prose into warn-tier heuristics (inactive links, stale dates). It is Tier A in the sense that it is deterministic, but it is regex heuristics over prose and it is explicitly warn-tier. It should never be counted alongside the color number.

### 1.3 How easily this credibility could be lost

Five specific ways, in rough order of how likely we are to do them by accident.

**One: the governed prompt already knows the rule.** This is the sharpest honest problem with our headline demo, and we should state it before a customer finds it. In `governedMessages`, rule 1 of the system prompt is:

> Colors: use ONLY the CSS variable tokens below via var(--token). NEVER write a raw hex value.

The metric is "count of raw hex values". The instruction and the metric are the same sentence. So `driftCount == 0` on the governed side demonstrates that a model follows an explicit, simple, checkable instruction when you give it one. That is a genuine and non-trivial result, and it is the mechanism we sell. But it is **not** evidence of brand fidelity, and it is not evidence that governed output is better UI. Anyone who reads the prompt and the scorer together will see this in thirty seconds. The correct posture is to disclose it and to widen the metric, not to keep the framing and hope nobody reads the source.

**Two: the second signal is a substring check.** `usesApprovedKit` is literally `code.includes(packageName)`. A model that writes the package name in a comment scores true. This is fine as a demo affordance and must never be described as measured adoption.

**Three: charting fabricated data next to real data.** We already do this. See section 4.2.

**Four: quoting a rate without a denominator.** "Zero violations" is meaningless without "out of N generated components across M prompts". The current demo is single-shot and uncached results live in an in-process `Map` with a ten-minute TTL, so there is no accumulated denominator to quote even if we wanted one.

**Five: letting a model into the scoring path "just for the hard cases".** The moment `scoreDrift` calls a model, every number this company has ever published becomes Tier C retroactively, because nobody outside will bother to work out which numbers came from which era. This is the one line in the codebase that should require two reviewers forever.

---

## 2. Product metrics we should track, and currently do not

Start with the finding, because it is the important part.

> **BlockSmith has no product analytics of any kind. Zero.**

This is not "thin instrumentation" or "we use server logs". A search across `src`, `scripts`, `packages`, `extension`, `figma-plugin`, and every `package.json` for PostHog, Mixpanel, Segment, Amplitude, Plausible, Umami, Google Analytics, `@vercel/analytics`, and Speed Insights returns nothing. `src/app/layout.tsx` contains no script tags. The only `captureException` calls in the codebase are two Sentry calls in `src/app/error.tsx` and `src/app/global-error.tsx`. There is no `events` table, no `usage` table, no metering counter, and no funnel.

To the company's credit, `src/app/privacy/page.tsx` is consistent with this: it lists Supabase, Vercel, Upstash, NVIDIA, Sentry, GitHub, and Figma as processors, and names no analytics vendor, because there is none. If we add one, that page changes in the same commit.

The consequence is worth stating bluntly. **We do not know whether anyone uses this product.** Not how many scans have run in production, not how many wikis have been opened, not whether a single human being outside this company has ever clicked Promote. Every statement in every strategy document about adoption is currently an inference from anecdote.

### 2.1 What we already have that is halfway to measurement

Before proposing new instrumentation, take inventory. Several existing tables are audit trails that happen to be measurement-capable. Reusing them is much cheaper than adding a vendor.

| Existing store | Path | Measurement value | Limitation |
|---|---|---|---|
| `blocksmith_pipeline_runs` | `supabase/schema-registry.sql`, `src/lib/ir/pipeline-runs.ts` | The richest real time series we have: append-only rows with `actor`, `action` (promote / rollback / pin-lock / ingest / demo-seed), `duration_ms`, `status`, `stages`, `log`, `created_at` | Nothing reads it in aggregate. Local mirror is a disk cap; on serverless the disk copy lands in `/tmp` |
| `blocksmith_governance_events` | `supabase/schema-governance-events.sql`, `src/lib/cloud/governance-events.ts` | The only true event table: `source` (mcp / cli / git-hook / ci), `action` (detected / overridden / bypass), `findings`, `status`, `commit_sha` | File fallback truncates to the newest 500 events, which is lossy. `localCloudStoreWritable()` returns false on Vercel, so the fallback silently no-ops in production |
| `blocksmith_deviations` | `supabase/schema-deviations.sql`, `src/lib/cloud/deviations.ts` | Full funnel shape already: `created_at`, `expires_at`, `resolved_at`, `status` across five states, `rejection_count` | Depends on a pre-push flow that is not shipped in the CLI |
| `blocksmith_api_keys.last_used_at` | `supabase/schema.sql`, `src/lib/cloud/api-keys.ts` | Closest thing to an active-usage signal. Written on every key verification | Last-touch timestamp only. **No counter, so call volume is unrecoverable** |
| `blocksmith_registry_manifest` | `supabase/schema-registry.sql` | Per-doc `block_count`, `promoted_count`, `draft_count`, `stale_count` | State counters, overwritten in place. No history, so no trend |
| `blocksmith_documents` | `supabase/schema.sql` | `created_at`, `updated_at`, `owner_user_id`, `org_id`, `github_repo`, `scan_mode`, `published` | Good enough for activation counting today with a SQL query |
| Rate-limit counters | `src/lib/cloud/rate-limit.ts` | Upstash `INCR` per window on scan and AI generation | `EXPIRE` destroys them every window and nothing reads them. **AI generation, the only per-call cost we carry, is rate-limited but not metered** |

`src/lib/activity/` deserves a separate note because it looks like tracking and is not. It is an append-only JSONL ledger at `.blocksmith/activity/<doc>/activity.jsonl` recording `prompt`, `fix`, `change`, and `note` actions attributed via `git config user.name` and the short HEAD sha (`src/lib/activity/git.ts`). `scripts/activity-from-commit.ts` runs from `.githooks/post-commit`. It is a **human-facing work ledger for a component page**, not telemetry: local disk only, no Supabase mirror, no network egress, and the writer is wrapped in a try/catch that is explicitly best-effort. On Vercel the filesystem is ephemeral, so it does not persist in production at all. The directory `.blocksmith/activity/apollo.md/` exists in this repo and contains no ledger, which means the path has never been exercised.

### 2.2 The metric set we should actually have

Seven metrics. For each: the definition (precise enough to implement), why it matters, where it is instrumented, and how hard it is.

---

**M1. Activation: a team scans a repo and opens the resulting wiki**

*Definition.* Count of distinct `owner_user_id` (or `org_id`) with at least one row in `blocksmith_documents` where `scan_mode` indicates a real scan, **and** at least one subsequent wiki page render for that `doc_ref` by that user. Both halves are required. A scan that nobody looks at is a failed activation, not a success.

*Why it matters.* It is the top of every other metric. If this is small, nothing below it is worth optimizing. It is also the only metric that tells us whether the scan pipeline works on strangers' repositories, which is currently supported only by anecdote and by `fixtures/vendor-ui/`.

*Where it would be instrumented.* The first half is already a SQL query against `blocksmith_documents`, no code change at all. The second half needs one event emitted from the wiki route (`src/app/wiki/[[...slug]]/page.tsx`) or from the document read path.

*Difficulty.* **Low.** The scan half is a query today. The view half is one insert.

---

**M2. Depth: blocks promoted per team per week**

*Definition.* Count of rows in `blocksmith_pipeline_runs` with `action = 'promote'` and `status = 'success'`, grouped by `doc_ref` and ISO week. Report the distribution, not the mean, because one power team will otherwise hide a dead long tail.

*Why it matters.* It is the closest thing to "the control plane is load-bearing for this team". A team that scans and never promotes is using us as a documentation generator, which is exactly the outcome Chapter 02 Claim 2 says would falsify our thesis.

*Where.* Already written. `recordRun` in `src/lib/ir/pipeline-runs.ts` mirrors to `blocksmith_pipeline_runs`. This metric needs a query and a dashboard, and no new instrumentation.

*Difficulty.* **Very low.** This is the single highest-leverage metric available for the least work in the entire repo.

---

**M3. The governance loop closing: drafts that reach promote**

*Definition.* Of blocks that entered `draft` status through a human governance edit, the fraction that reach `official` within 7, 14, and 30 days. Report the time-to-promote distribution alongside it.

*The trap that makes this metric easy to get wrong.* Scan-derived facts **auto-promote**. In `src/lib/ir/registry.ts` the ingest path sets `autoPromote` for token and component blocks from the repo, because code is authoritative, and then sets `entry.official = version` directly. If you naively count "blocks that are official", the number will be near 100% for every team on day one and will mean nothing. The metric must count **only** blocks whose latest version was created by a governance edit (`editedBy` of `web` / `ide` / `mcp` rather than `ingest`), and must measure whether a human then acted on it.

*Why it matters.* This is the mechanism, isolated. Ingest is automatic and proves nothing about human buy-in. The governance edit that a human then promotes is the entire product thesis in one transition.

*Where.* Registry entries already carry `editedBy`, `status`, `finalizedAt`, and version history in `blocksmith_block_registry_entries`. The metric is derivable from what is stored, joined against promote runs.

*Difficulty.* **Low to medium.** No new writes; a moderately careful query, plus care about the auto-promote exclusion.

---

**M4. Lock freshness across customer repos**

*Definition.* For each doc with a promoted graph, whether the customer's `blocksmith.lock` `contentHash` equals the current official graph hash, and if not, how long it has been stale. Report the fraction of docs fresh, and the median staleness age in days.

*Why it matters.* Stale locks are the observable form of "we promoted and nobody pulled", which is the failure mode the whole handshake exists to prevent. It is also the metric most directly tied to enterprise value: an auditor's question is "are your repos pinned to the approved system", and this is the answer.

*Where, and the hard part.* We can compute `verifyLock` server-side against the lock we generated (`src/lib/ir/lock.ts`, mirrored to `blocksmith_block_locks`). **We cannot see the lock file that actually sits in the customer's repository**, which is the one that matters. Closing that gap needs the CLI or the CI action to report back: `blocksmith pull` and `npm run validate:ui` would post the lock hash they observed to an endpoint. That is an outbound telemetry decision with a consent question attached, and it belongs in the privacy page and the CLI's first-run notice, not in a quiet PR.

*Difficulty.* **Medium.** Server-side half is easy. Customer-side half is a product and trust decision before it is an engineering one.

---

**M5. Agent consumption: MCP calls against official versions**

*Definition.* Count of MCP tool invocations per doc per week, broken down by tool (`get_design_tokens`, `get_component_docs`, `get_lockfile`, `validate_ui_code`, and the rest of the sixteen tools registered in `src/lib/mcp/blocksmith-server.ts`), and by whether the caller was pinned to a fresh lock.

*Why it matters.* This is the only metric that shows agents are actually consuming governed truth in someone's real editor. Without it, "agents cannot drift" is an architectural assertion with no usage behind it. It is also the metric that would let us tell a customer "your team's agents made 4,000 calls against your approved system last month", which is the sentence that renews a contract.

*Where.* `src/app/api/mcp` and `src/mcp/handlers.ts`. Every tool call already resolves an API key, and `touchDbKey` already writes `last_used_at` on every verification (`src/lib/cloud/api-keys.ts`). The instrumentation is: replace or supplement that last-touch write with an append to an events table carrying `key_id`, `doc_ref`, `tool`, and `ts`.

*Difficulty.* **Low.** The call site is already there and already writes on every request. This is arguably the second-cheapest high-value metric after M2.

---

**M6. CI gate firing rate in customer repos**

*Definition.* Per customer repo per week: how many `validate:ui` runs executed, how many passed, how many failed on a stale lock, and how many failed on off-token colors. `scripts/validate-ui.ts` already distinguishes these three outcomes internally.

*Why it matters.* A gate that never fails is either perfect adoption or a gate nobody installed, and those two look identical from here. The failure rate is also the honest version of the number that `docs/PROJECT-PIPELINE.md` currently proposes to fake (see section 4.2).

*Where.* The script runs on the customer's machine and exits with a code. Reporting requires the same outbound decision as M4. A reasonable first version is opt-in, org-scoped, and reports only counts and outcome classes, never code or hex values.

*Difficulty.* **Medium**, for the same consent reason as M4, plus distribution: it only measures what we can convince teams to install.

---

**M7. Drift detected versus drift resolved**

*Definition.* From `blocksmith_governance_events`: count by `action` (`detected`, `overridden`, `bypass`) and by `status` (`open`, `acknowledged`, `resolved`), with the age distribution of open events. From `blocksmith_deviations`: created versus approved versus rejected versus auto-approved-on-TTL-expiry, and time-to-resolution.

*Why it matters.* Detection alone is a nag. Detection with a closing rate is a governance system. If detected climbs and resolved is flat, we have built a very efficient way to generate ignored warnings, and the product is failing in the most expensive way possible: quietly, while looking busy.

*Where.* Both tables exist with the right columns. `countOpenViolations` already exists in `src/lib/cloud/governance-events.ts`. What is missing is time series and rollup, not capture.

*Difficulty.* **Low.** Both schemas are already shaped correctly for this.

---

### 2.3 The architectural decision to make first

Six of these seven can be served by SQL over tables that already exist, plus two new insert sites (wiki view, MCP call). That argues strongly for **not** adding an analytics vendor yet.

The concrete recommendation: add one table, `blocksmith_product_events`, append-only, with `org_id`, `user_id` (nullable), `doc_ref` (nullable), `event` (a small closed enum), `properties` jsonb, and `created_at`. Write to it from the five or six paths that matter. Query it with SQL. This has three advantages over a vendor: it inherits the tenancy and RLS model we already enforce, it adds no third-party processor to the privacy page, and it cannot be casually extended into behavioral tracking because every event name has to be added to an enum in a reviewed PR.

The argument against is real too: no vendor means no funnel UI, no retention curves, and someone has to build the dashboards. That is a fair trade at our current stage and stops being fair somewhere around the point where a non-engineer needs to answer their own questions.

Two constraints on whatever we build. **No PII beyond what we already store**, which means GitHub user id and org id, never emails in properties, never prompt text, never code. And **the privacy page changes in the same commit** as the first event write, every time.

---

## 3. The falsification table

[Chapter 02](./02-the-thesis.md) section 5 states seven claims and, for each, what would prove it wrong. That chapter does the argument. This section does the **instrument**: for each claim, what specific observation falsifies it, what would have to exist to produce that observation, whether it exists, and what we are honestly allowed to say today.

There is a second column here that matters as much as the falsifier: the **confirmation trap**. For most of these claims there is an observation that will feel like proof and is not, and naming it in advance is the only defense.

### 3.1 Claim: agent design docs keep growing

**Assertion.** Machine-oriented design instruction per team grows faster than any human can review, and better models do not reverse it.

**Falsifier.** A longitudinal sample of serious product teams shows `DESIGN.md`-class files (agent rule files, design token docs, component conventions) flat or shrinking over a twelve-month window. Or: a single agent-native convention wins so completely that design context consolidates into one tool-maintained file with its own lifecycle, in which case the mess cleans itself.

**Confirmation trap.** Finding lots of large `DESIGN.md` files today. That is a snapshot, not a trend, and it is compatible with a world where the files stopped growing two years ago. The claim is about the derivative, so a single measurement cannot support it.

**Instrument required.** A repeated public-repository survey: sample N repos containing agent instruction files, measure total bytes and file count of that class, repeat at a fixed interval. GitHub code search plus a script would do it. Cost: a few days, once, then a recurring job.

**Instrument status.** **Not built.** Nothing in this repo measures anything about the outside world.

**Honest read today.** Believed on strong qualitative grounds, unmeasured. This is our strongest claim and also the only one we could falsify without a single customer, which makes not having done it slightly embarrassing.

### 3.2 Claim: teams will pay for governance rather than tolerate drift

**Assertion.** Drift between design intent and shipped code is expensive enough that teams will buy a control plane to prevent it, rather than absorbing it as a normal cost of doing business.

**Falsifier.** Teams install BlockSmith, see real detected drift, and do nothing about it. Concretely, and this is measurable with M7: `blocksmith_governance_events` accumulating `detected` rows while `resolved` stays flat, and `blocksmith_deviations` where the dominant terminal state is `auto_approved` on TTL expiry rather than a human `approved` or `rejected`. Auto-approval on expiry means nobody looked. If most deviations expire unreviewed, the design team does not consider this drift worth their time, and no amount of detection quality changes that. The commercial falsifier is blunter: a pipeline of teams who agree drift is real, agree we detect it, and do not buy.

**Confirmation trap.** Enthusiasm in the sales conversation. Every design lead agrees drift is bad. Agreement is free. The only confirmation that counts is a renewal, or a team that changes its workflow without being asked.

**Instrument required.** M7 (detected versus resolved), plus the deviation terminal-state distribution, plus ordinary commercial tracking.

**Instrument status.** **Partial.** Both tables exist with the right columns and nothing aggregates them. The deviation pre-push flow that would populate the first half is not shipped in the CLI (`packages/cli/src/cli.ts` has no `updates` or `fix` command).

**Honest read today.** Unproven in both directions. We have no paying customer and no evidence of a team ignoring us either.

### 3.3 Claim: humans want to promote, rather than have it happen automatically

**Assertion.** The human gate on what becomes official is a feature, not friction. Teams want the merge-to-main moment for design.

This is the claim most at risk of being wrong in a way that is invisible for a long time, because a team that never promotes looks the same as a team that has nothing to promote.

**Falsifier.** Three distinct observations, any of which is damaging:

1. **The gate is never used.** M3 shows governance drafts created and never promoted, at scale, across teams. The wiki gets read, Finalize does not get clicked.
2. **The gate is used as a rubber stamp.** Time-to-promote is consistently near zero and promotes are batched, meaning humans click through without reviewing. A gate that is always approved is a delay, not a decision. `src/lib/ir/diff.ts` exists precisely so promote can be an informed act; if nobody opens the diff, the gate is theatre.
3. **Teams ask us to turn it off.** Requests for auto-promote on governance edits, or for a policy that promotes anything that passes CI. This is the most honest falsifier because it is customers telling us directly that the ceremony is not worth it.

**Confirmation trap.** Our own use of Promote. We built it, we demo it, and `verify:ir-cicd` exercises it on a synthetic doc every run. None of that is evidence about anyone else. Also a trap: high promote counts driven by auto-promoted scan facts, which is why M3's exclusion rule is not a detail.

**Instrument required.** M3, plus promote latency (available today: `created_at` on the promote run minus `updatedAt` on the draft version), plus whether the diff view was opened before the promote.

**Instrument status.** **Partial.** The data to compute the first two exists in `blocksmith_pipeline_runs` and `blocksmith_block_registry_entries`. The diff-viewed signal does not exist and needs one event.

**Honest read today.** Unproven. We should be actively looking for the third falsifier in every customer conversation, because it arrives as a feature request rather than as a complaint, and feature requests are easy to accept without noticing what they mean.

### 3.4 Claim: the protocol can become an interchange standard

**Assertion.** `blocksmith.blocks.v1` becomes the neutral format that many sources compile into and many targets compile out of, the way OpenAPI or Protobuf did, and value accrues to whoever defines the packet.

**Falsifier.** The clean one: **eighteen months after publishing the spec, the conformance suite, and the adapter guide, no organization other than BlockSmith has shipped an adapter or a compile target.** At that point it is our internal file format with a documentation site attached, and the category claim collapses to a product claim. The second falsifier is competitive rather than technical: an incumbent with distribution (Figma, GitHub, or a model vendor) ships an adequate design-context format bundled into a tool teams already have. Distribution beats neutrality, and our schema being better does not matter.

**Confirmation trap, and this one is subtle.** `docs/PROJECT-PROTOCOL.md` marks the project done, including "Third parties run our conformance suite", justified as "truthfully: `npx tsx node_modules/@blocksmith/protocol/conformance/run.ts` works from a clean install". That statement is about **capability**, not adoption. It says the suite is runnable by a third party. It does not say a third party ran it. The Storybook adapter under `src/lib/ingest/storybook.ts` is a genuinely useful proof that the format survives a non-BlockSmith source, and it is also written by us, so it proves neutrality of the *format* and nothing about neutrality of the *ecosystem*. Reading the checked boxes in that document as adoption evidence is exactly the failure this chapter exists to prevent.

**Instrument required.** A public count of external adapters and compile targets registered via PR into `packages/protocol/compile-targets.v1.json` and the `/protocol/adapters` table, plus npm download counts for `@blocksmith/protocol`, plus inbound conformance-suite runs if we ever host it.

**Instrument status.** **Not built, and partly not buildable yet**, because `@blocksmith/protocol` is not published to npm (`docs/PROJECT-PROTOCOL.md` lists `npm publish` as remaining). Download counts require publication. The adapter registry table exists as a document and could hold the count today; it currently lists only our own.

**Honest read today.** External adapter count is **zero**. Say that number out loud in any protocol discussion. It is not a criticism of the work, which is real and good, and it is the number that decides the claim.

### 3.5 Claim: the IR is portable to non-web targets

**Assertion.** The same block graph compiles to a React package, an MCP payload, a CI validator input, and an embedded token header, preserving block ids, versions, token values, governance rules, and content hashes.

**Falsifier.** A target where the semantics do not survive: the device profile needs constraints the web target cannot express, so the two diverge and "one graph" becomes two graphs sharing a prefix. The observable tell is **target-specific fields appearing in the block schema**. Every field added to `BlocksmithBlockV1` that is meaningful for only one target is direct evidence against this claim, and unlike most falsifiers in this table it is visible in a diff.

The second falsifier is quantitative: compile loss that grows with graph size rather than staying proportional to the categories we know do not travel (prose pages).

**Confirmation trap.** `npm run compile:device` producing output. Output is not fidelity. A target that drops 80% of the graph and emits the remaining 20% still "works".

**Instrument required.** `deviceCompileLoss` in `src/lib/ir/targets/device-sim.ts` already returns `{ carried, dropped[] }` with a reason per dropped block. Tracked over time across real graphs, it is a genuine loss metric. What is missing is (a) running it on real customer graphs rather than fixtures, and (b) a semantic version of it, because block counts are a crude proxy: carrying a block while silently discarding half its content counts as carried.

**Instrument status.** **Partial and real.** This is the second-best instrument in the repo after `verifyLock`. It is coarse, it is honest about being coarse, and nobody is watching its trend.

**Honest read today.** Two additional emitters exist (`device-sim.ts`, `c-header.ts`), `npm run compile:device` runs, and `/demo/device` renders. That is a meaningful partial demonstration. Firmware in the field is **Planned** and we do not claim it. The research brief's own phrasing is the right one to reuse: we claim semantic portability, not "flash any markdown to any chip".

### 3.6 The other three claims from Chapter 02, with instruments

| Claim | Falsifying observation | Instrument | Status |
|---|---|---|---|
| Static wikis and one-way generators are insufficient | Our own users read the wiki heavily and never use Finalize or pull | M3 (promote rate) plus M4 (pull / lock freshness). Both derivable from stores we have | **Partial** |
| Block granularity makes public pre-launch feedback possible | Median share link collects a handful of opinions and no team cites the result in a decision | Share stats in `src/lib/public-share/store.ts`, which as built cannot produce this (section 7) | **Broken as an instrument** |
| Governed generation beats prompt generation for fidelity | A model given raw `DESIGN.md` and no IR produces output as on-brand as our composition, by off-token count and human preference | The color-lint score can produce the first half today. The second half needs a human preference protocol we do not have | **Partial, and narrow** (section 1.2) |

### 3.7 What this table says overall

Of eight claims, we can currently measure **zero of them end to end**. We can partially measure four using data that already sits in Supabase and that nothing queries. That is the actual state, and it is better than it sounds, because the gap is mostly dashboards rather than architecture.

---

## 4. The trust audit of our own status claims

### 4.1 The percentages

`docs/GOAL-SAAS-STATUS.md` opens with this table:

| Lens | Goal 1 scan to wiki | Goal 2 handshake and governance | Target |
|------|---------------------|--------------------------------|--------|
| Local dev | ~88% | ~85% | |
| Public SaaS | ~76% | ~66% | at least 80% each |
| Stranger-ready | ~58% | ~52% | ~75% later |

Six numbers. They also appear in `docs/DEPLOY.md` line 20 and, more consequentially, in `docs/PITCH-AND-PRODUCT-MODEL.md`, which is an investor-facing document, in three places.

**How they are produced.** By hand. There is no formula, no denominator, no script, and no definition of what 100% would be. Searching the repository for anything that computes them returns nothing. The closest artifact is `npm run verify:production-goals`, and reading `scripts/verify-production-goals.ts` settles the question: it is 66 lines, it makes three assertions (the public demo wiki loads, a route returns JSON, the API keys route behaves when unauthenticated), and its final line is:

```
[verify:production-goals] OK, run manual checklist in docs/GOAL-SAAS-STATUS.md
```

The script explicitly defers to a human checklist. So the percentage is a human summarizing a human checklist.

**What they actually mean.** Read honestly, "~76%" means: *the author's confidence, at the time of writing, that a competent stranger could complete the scan-to-wiki flow on production without help.* That is a legitimate and useful internal signal. It is a project manager's gut, which is often the best available estimate and is exactly the kind of thing you want a founder to have.

**How much weight to put on them.** Internally: some. They are directionally informative and they were written by someone who knows the system. Externally: **none**, and they should not appear in `PITCH-AND-PRODUCT-MODEL.md`. A number with a percent sign implies a measurement, and an investor is entitled to ask what the denominator is. "It is a feeling, expressed as a percentage" is a bad answer to give in a room, and it is the true answer.

### 4.2 The two failure directions, both present

The reason to distrust these numbers is not that self-assessment is dishonest. It is that self-assessment drifts in **both** directions, and this repo demonstrates both.

**Overstatement.** `src/app/dashboard/analytics/page.tsx` is a live, signed-in page titled "Analytics" with the subtitle "Overview of your design systems and governance health". It renders `src/components/dashboard.tsx`, which renders five panels. Every one of them is hardcoded:

- `src/components/stats.tsx`: "Design Systems 12", "Active Components 1,248", "**Governance Score 94%**", "Open Deviations 34", each with a fake delta.
- `src/components/governance-health-chart.tsx`: seven days of invented deviation counts, with a comment reading `/** Demo: last 7 days deviations found vs fixed. */`.
- `src/components/component-usage-chart.tsx`: a hardcoded array with the comment `/** Demo Data. */` and dates in March 2026.
- `src/components/active-deviations.tsx`: fictional deviations for "Acme UI Kit", "Marketing Site", "Internal Dashboard".
- `src/components/recent-scans.tsx`: fictional activity items.

A "Governance Score" of 94% is precisely the Tier C artifact section 1 warns about, except worse, because it is not even model-generated. It is a literal in a TypeScript file, shown to a signed-in user, on a page called Analytics. If a customer ever screenshots that number, we have shipped a false claim about their system.

`docs/PROJECT-PIPELINE.md` makes the same move deliberately, in the enterprise hooks table: **"Drift counter | Banner: '12 PRs would fail validate:ui' (static ok for demo)"**. The parenthetical is at least honest, and the pattern is the problem. Static-for-demo numbers survive into production because nobody remembers which ones were placeholders.

**Understatement.** `docs/GOAL4-DEVIATION-TTL.md` ends with a status table where all fourteen rows are marked planned, including `blocksmith_deviations` Supabase table, `org_governance_settings` Supabase table, and the pass/reject actions. Meanwhile: `supabase/schema-deviations.sql` defines both tables in full, `src/lib/cloud/deviations.ts` implements `createDeviation`, `listDeviations`, `countOpenDeviations`, `countBlockRejections`, `approveDeviation`, `rejectDeviation`, `resolveDeviation`, `autoApproveExpired`, and settings read/write, and four API routes exist under `src/app/api/v1/deviations/` and `src/app/api/v1/governance/settings/`. The doc understates reality substantially. Parts genuinely are missing, notably the CLI commands, and the table does not distinguish.

Both directions of error in the same repository is the diagnostic. If the numbers were computed, they would be wrong in only one direction at a time.

### 4.3 What should replace them

Three changes, in increasing order of value.

**One: a visible denominator, immediately.** Every goal document already contains checklists. Convert the percentage into `n/m checklist items complete`, printed by a script that counts checked boxes in the markdown. It is a crude metric and it is honest, reproducible, and impossible to nudge without editing a checkbox. A twenty-line `scripts/verify-status.ts` would do it.

**Two: replace percentages with the status vocabulary.** `STYLE.md` already defines Shipped, Built-unproven, Partial, Planned, Idea, with Shipped defined as covered by a verify script or manually proven. A table of features against those five words carries more information than "~76%" and cannot be misread as a measurement. This is what the constitution uses and the goal docs should follow.

**Three: bind Shipped to a script.** We have thirty-one `verify:*` scripts (`verify:ir-cicd`, `verify:governance-e2e`, `verify:handshake-pull`, `verify:saas-acl`, and the rest). A feature marked Shipped should name the verify script that covers it. Then "how much is done" becomes "how many verify scripts pass against production", which is Tier A and computable in CI. That is the number worth putting on a slide.

**And one rule, which is the whole section compressed:**

> **No percentage appears in a document a customer or investor can read unless a script in this repo prints it.**

The corresponding rule for the product: **no chart ships with hardcoded data.** If the real number is not available, show an empty state that says so. An empty state that says "no governance events yet" is credible. A fake 94% is a liability the first time it is believed.

---

## 5. The research track

The research brief is `docs/RESEARCH-INFRA-DESIGN-IR-AND-CICD.md`, 602 lines, written for academic mentors and thesis reviewers. It is the most rigorous document in the repository and it is worth summarizing accurately, because the version of it that circulates verbally is usually vaguer than the document itself.

### 5.1 The question it poses

Two coupled systems, and the honest framing is that the second is the hard one:

| Layer | Name | Question |
|---|---|---|
| Protocol | Design IR (`blocksmith.blocks.v1`) | What is the minimal canonical representation of design truth that survives ingest from many incompatible sources and compiles out to many physical runtimes without semantic loss? |
| Pipeline | Design CI/CD | What is the correct lifecycle (ingest, build, stage, promote, lock, deploy, rollback) for design truth under continuous change, with concurrent human, agent, and machine writers? |

The brief ranks the pipeline as harder than the protocol, and the reasoning is right: it is distributed-systems behavior, with concurrent writers (a human in the wiki, an engineer in the repo, an agent mid-session), partial failure (finalize succeeded, pull failed, lock stale), long-running agent sessions holding stale versions, re-scan invalidating scan-derived blocks without wiping governance, and serverless hosting that forbids a filesystem watcher, so every transition must be explicit rather than reactive. Its one-line summary is the sharpest sentence in the document:

> IR without CI/CD is a file format. IR with CI/CD is infrastructure.

### 5.2 The contribution it claims

Not "we built a wiki". The claimed contribution is: **a published interchange format plus a lockfile-based enforcement pipeline for design truth, with a reference implementation that dogfoods it, demonstrated across at least two structurally different compile targets.**

Section 8 of the brief lists eleven open research questions in five groups: representation (minimal block type system, conflict representation, schema evolution without breaking locks), synchronization (eventual versus strong consistency, stale detection and repair, whether lockfile semantics can mirror npm's formal properties), agents (does version pinning reduce measurable fidelity drift, and where the enforcement boundary should sit between MCP advisory and CI blocking), cross-platform compile (what semantic invariants every target must preserve, how to quantify compile loss), and scale (ingest strategy that preserves human oversight as agent template files grow).

Question 7, "does version pinning reduce measurable fidelity drift in agent-generated UI", is the one with commercial consequence. It is Chapter 02's Claim 4 in academic clothing.

### 5.3 The evaluation design

Section 9.2 lays out five phases:

| Phase | Deliverable | Status in repo |
|---|---|---|
| R1 | Formalize `blocks.v1` JSON Schema plus three example graphs | **Shipped.** `public/schema/blocksmith.blocks.v1.json`, `examples/graphs/` |
| R2 | Version model plus `blocksmith.lock` spec plus reference writer on finalize/pull | **Shipped.** `src/lib/ir/registry.ts`, `src/lib/ir/lock.ts` |
| R3 | MCP reads lock only, plus a case study measuring agent drift with and without lock | **Half shipped.** `src/lib/ir/enforce.ts` is real. The case study does not exist |
| R4 | Second compile target from the same graph | **Shipped.** `src/lib/ir/targets/device-sim.ts` and `c-header.ts` |
| R5 | Evaluation: a small team using wiki plus lock for two weeks, fidelity and conflict metrics | **Planned.** No team recruited, no protocol document, no logging path |

The engineering is far ahead of the evaluation. R1, R2, and R4 are done and provable: `npm run verify:ir-cicd` exercises ingest, stage, promote, lock, enforce, rollback, stale, and device compile end to end on a synthetic doc, and `npm run protocol:conformance` runs a fixture suite with golden hash vectors and a CI drift gate. **The measurement halves of R3 and R5 are the entire gap.**

### 5.4 What R5 needs from the product, and does not have

This is the practical part, because R5 is currently blocked on product artifacts rather than on research design.

| R5 needs | Do we have it |
|---|---|
| A drift metric wider than color | **No.** `color-lint.ts` is hex-literal only (section 1.2). A two-week study whose only dependent variable is raw hex count will produce a result nobody finds persuasive |
| A logging path from a participant's repo back to us | **No.** Same missing capability as M4 and M6 |
| Session-level agent telemetry (which version an agent held, and when) | **No.** `blocksmith_api_keys.last_used_at` is a timestamp with no call counter |
| A stable, installable client for participants | **Partial.** `packages/cli` and the MCP endpoint exist; onboarding is documented in `docs/FRIENDS-ONBOARDING.md` |
| A control condition | **Design question.** Within-subject (same team, two weeks locked, two weeks unlocked) risks order effects and learning. Between-subject needs more teams than we can plausibly recruit |
| Enough participants for any inferential claim | **No.** Realistically N is one to three teams, which means this is a case study, not a controlled experiment, and should be written as one |

The single highest-value research-enabling engineering task is therefore **widening the deterministic lint beyond color**: spacing tokens, radii, typography scale, and approved-component usage, all checkable without a model. That one change upgrades the drift metric from "hex literals" to "design token compliance", which is a dependent variable worth studying and a product feature worth selling. It does double duty, which is the test `docs/CEO-DIRECTIVE.md` applies to everything.

### 5.5 Division of labor

Two documents define this consistently, which is a good sign. `docs/TEAM-NORTH-STAR.md`:

| Owner | Owns | Does not own |
|---|---|---|
| Product | Wiki UX, scan, SaaS, Sync, Visualize, promote UI | Rewriting IR hash semantics without professor review |
| Professor / research | IR schema, registry, lock, enforce, compile targets, proofs | Wiki styling, GitHub OAuth, billing |
| Shared | Finalize-to-promote wiring, pull returns lock, MCP tools | Duplicate block stores |

`docs/PROTOCOL-GOVERNANCE.md` sharpens it into decision rights: professor decides hash semantics, registry lifecycle law (append-only, official pointer, conflict and stale), and schema major bumps; platform decides schema minor additions, conformance scope, and package publishing; anyone can do patch-level docs, fixtures, and new adapters that meet the listing bar.

The split is clean because it maps to an actual technical boundary. **The research engine is the part where being wrong is expensive and hard to reverse** (a hash semantics change invalidates every lock in the field), and **the product is the part where being wrong is cheap and iterative** (a wiki page can be redesigned on Friday). Putting slow review on the first and none on the second is correct, not bureaucratic.

The governance document also records the one incident that proves the boundary is enforced rather than aspirational: an app build embedded a NUL byte instead of an ASCII space in the hash separator, the CI drift gate caught it on first run, and the app was corrected to spec. That is a real, checkable instance of the protocol being treated as normative, and it is worth more than any statement of intent.

### 5.6 What a publishable result would look like

The realistic target is the one the brief itself names as a starter task: a **workshop paper**, roughly *Design IR as interchange for human-agent UI systems*.

A credible version contains: the formal block and lock model with the append-only and official-pointer semantics; the hash law and its determinism argument; the conformance suite and golden vectors as a reproducibility artifact; a compile-loss analysis across at least two structurally different targets using `deviceCompileLoss`; and an honest case study of one to three teams over two weeks reporting drift incidents, promote latency, lock staleness episodes, and qualitative interviews. It should be explicit that N is small and that the case study is descriptive.

The two artifacts that make it reproducible already exist and are unusual for a startup to have: the published JSON Schemas and the forkable conformance fixtures. That is the part a reviewer can actually check, and it is where the paper is strongest.

### 5.7 Does a publishable result help commercially? The honest answer is: partly, and less than we would like

**The case for:**

- Enterprise procurement in regulated industries treats external validation as a risk-reduction signal. A citable paper and a public spec are cheap credibility that a startup cannot otherwise buy.
- A protocol claim needs a neutral artifact. "Read the spec" is a much stronger position than "trust our product", and papers are how specs acquire the appearance of neutrality.
- It is genuine recruiting leverage for the kind of engineer who would be good at this work.
- The professor relationship is unusually high-leverage per unit of founder time, and the correctness questions being asked (lockfile formal properties, promotion state machine, semantic invariants across targets) are questions we would need answered anyway.

**The case against, stated properly:**

- **A workshop paper does not move a purchase order.** No design lead has ever bought infrastructure because of a citation. The buying decision is made on whether it works in their repo, in their editor, this week.
- **The evaluation is weak by construction.** One to three teams over two weeks cannot support an inferential claim. If we present it as stronger than a case study, a serious reader will discount everything else in the paper, and the credibility we were buying goes negative.
- **Publishing the spec helps competitors implement it.** This is the intended trade in a protocol play, and it is still a real cost, and it only pays if adoption follows. External adapter count is currently zero (section 3.4).
- **Timelines mismatch.** Research runs in quarters and academic review in half-years. Startup runway runs in months. Every week of founder attention on the paper is a week not spent on the activation funnel, which is the thing that is currently unmeasured and probably near zero.
- **It can become a comfortable place to hide.** Research produces legible progress and defers the terrifying question of whether anyone will pay. That is a real organizational risk for a technically strong founder, and naming it is cheaper than discovering it.

**The synthesis.** The research track should continue because the engine work is load-bearing for the product regardless of publication, and because R5 is the only credible path to answering Chapter 02's Claim 4, which is the claim everything else rests on. But **R5 should be run for us first and for the paper second.** Design it as a customer proof-of-value pilot that happens to be rigorous enough to write up, not as a study that happens to involve customers. Same two weeks, same instrumentation, different primary audience, and a much better chance that the output is useful in both directions.

---

## 6. Drift metrics as the shared language

"Drift" is used loosely across our documents to mean four or five different things. It should not be. Each form has a different definition, a different measurement, a different accuracy, and a different owner. Getting a customer or a reviewer to adopt this vocabulary is itself a strategic act, because a category defines itself by the words it makes precise.

### 6.1 The four forms, defined

**Form A: design source versus code.** Figma (or any design source) says a token has value X; the scanned repository says it has value Y. This is the wedge described in [Chapter 08](./08-ingestion-how-truth-gets-in.md).

**Form B: official versus draft.** A human has edited a block in the wiki, producing a draft version N+1, while the official pointer still sits at N. Agents and CI must continue to see N. The gap between them is pending, unpromoted intent.

**Form C: lock versus registry.** A customer repo's `blocksmith.lock` pins a graph hash that no longer equals the promoted official graph hash. Someone promoted and nobody pulled. This is the drift that makes governance a lie in practice: the wiki says v4 and the agents are still building v3.

**Form D: generated output versus governed system.** Code produced by an agent (or a human) contains values that are not in the approved system. This is the form the CI gate catches and the form the demo scores.

A fifth, adjacent: **compile loss**, the semantic content present in the IR that a target cannot express. It is not drift, because nothing disagrees; it is information that did not survive translation. Keep it separate.

### 6.2 What we can actually measure, and how well

| Form | Code | Deterministic | What it actually compares | Accuracy and blind spots | Visible across customers? |
|---|---|---|---|---|---|
| **A: source vs code** | `src/lib/figma/drift.ts` (`computeTokenDrift`), `src/lib/figma/component-drift.ts`, exposed via `figma_token_drift` in `src/mcp/handlers.ts` | Yes | Figma variables against scanned CSS variables, **matched by variable name**, compared with `valuesEqual` (hex-insensitive, px/number-insensitive, else case-insensitive string) | **The name-matching assumption is the whole accuracy story.** If Figma calls it `accent` and code calls it `--color-accent`, every token reports as `figma-only` plus `code-only` and the mismatch count is zero, so the report looks clean while the systems fully disagree. Reports `matched`, `mismatched`, `figmaOnly`, `codeOnly`, and an `inSync` boolean. The counts are exact; the **interpretation** is only as good as the naming convention | Only for docs hosted with us. Needs a Figma connection |
| **B: official vs draft** | `src/lib/ir/diff.ts` (`buildPromoteDiffs`) | Yes | Field-by-field content comparison between the official version record and the latest version record, flagging hex-valued fields for swatch rendering | Exact for blocks that have a registry entry. Compares stringified content, so a reordered array reads as changed. Says nothing about whether the change is good | Yes, server-side, for every hosted doc |
| **C: lock vs registry** | `src/lib/ir/lock.ts` (`verifyLock`) | Yes | Lock `contentHash` against `officialGraphHash(docRef)`, plus per-block version and contentHash comparison | **This is our most trustworthy measurement.** Pure hash comparison, no heuristics, no interpretation. Distinguishes five failure kinds: `stale`, `versionMismatches`, `missingInLock`, `missingInRegistry`, `hashMismatches`. The last one detects a hand-edited lock | Only for the lock **we** generated. **We cannot see the lock file in the customer's repo**, which is the one that decides what their agents actually read. This is the single most important blind spot in the system |
| **D: output vs system** | `src/lib/governance/color-lint.ts` via `validate-ui.ts`, `handleValidateUiCode`, `governed-generate.ts`, `governance-gate.ts` | Yes | Hex literals in a text blob against the approved palette | Exact for what it covers, and what it covers is narrow: hex only, no rgb/hsl/named/Tailwind, no non-color tokens, no component semantics (section 1.2) | Only where the gate is installed and only if it reports back (M6) |
| **Compile loss** | `src/lib/ir/targets/device-sim.ts` (`deviceCompileLoss`) | Yes | Block ids present in the graph against block ids present in the emitted profile, with a reason per dropped block | **Coarse.** Counts blocks, not semantics. A block whose content was half discarded still counts as `carried`. Correctly identifies prose pages as having no device equivalent | Only for graphs we compile |

### 6.3 What this table tells us

Three things worth internalizing.

**Our best measurement is the one nobody thinks of as a metric.** `verifyLock` is a pure hash comparison with zero interpretive freedom. It is the strongest evidence-producing function in the codebase and it is currently used only to print a message in a CI script and a banner in the wiki. Its output is exactly the "are your repos pinned to the approved system" number an enterprise buyer asks for, and it is not aggregated anywhere.

**Every form is deterministic. None is model-scored.** That is a genuinely good architectural position and it should be defended (section 1.3, failure mode five).

**The blind spot is uniform and it is the customer's repository.** Forms C and D and metrics M4 and M6 all fail at the same boundary: we generate and enforce truth, and we cannot see what happens to it after `blocksmith pull`. Every serious measurement gap in this chapter reduces to that one missing channel, which makes the reporting decision (opt-in, org-scoped, counts-and-hashes-only, disclosed in the CLI and the privacy page) the single highest-leverage measurement decision the company has to make.

---

## 7. The pre-launch human signal pillar as a measurement system

`docs/PUBLIC-FEEDBACK.md` describes a feature: open a component page in the wiki, click "Get public link", send the URL to anyone, and they see a live preview and choose **Works for me**, **Not sure**, or **Doesn't work**. Views and reactions come back to the wiki panel.

[Chapter 02](./02-the-thesis.md) makes the argument for why this is a pillar rather than a nicety, and it is the right argument: agents optimize *inside* the rules, and the public stress-tests whether the *rules are right*. A governance system with no external signal is a very efficient machine for enforcing a mistake at scale. That framing makes this feature an **instrument**, not a feedback widget, and it deserves to be evaluated as one.

### 7.1 Why block granularity makes the measurement meaningful

This is the part that is genuinely clever and worth stating precisely.

The unit of feedback equals the unit of governance equals the unit of change. A share record is keyed on `(docFileName, blockKind, blockId)`, which is the same address the registry versions, the lock pins, and the wiki promotes. Four consequences follow, and none of them is available to whole-app feedback:

1. **Attribution is exact.** A reaction is about one component, not about "the app", so you never have to guess which of forty changes drove the response.
2. **Comparison across versions is possible in principle.** `createShare` captures `contentHash` on the record. If reactions were partitioned by the content hash they were collected against, you could ask "did promoting v4 improve or worsen outside reception versus v3?", which is the question that would make this a real instrument.
3. **Sharing is safe enough to actually happen.** A team will not expose a staging environment. Exposing one button is a decision a designer can make alone. The falsifier in Chapter 02 (legal objects to any public exposure regardless of granularity) is precisely a test of this assumption.
4. **The measurement composes with governance.** Feedback attaches to the same block a governance rule attaches to, so "the rule says one primary CTA per view" and "outside users found this confusing" sit on the same page.

What it would measure is not satisfaction. It is **disagreement between the governed system and people outside it**. That is the error-correction term on governance, and it is the only signal in the whole architecture that comes from outside the loop.

### 7.2 What is built today

| Piece | Path | State |
|---|---|---|
| Create / lookup share | `src/app/api/share/route.ts` | Built. One record per `(doc, blockKind, blockId)`; re-requesting returns the same URL |
| Share metadata and stats | `src/app/api/share/[id]/route.ts` | Built |
| View counter | `src/app/api/share/[id]/view/route.ts` | Built |
| Opinion capture | `src/app/api/share/[id]/opinion/route.ts` | Built. Zod-validates `reaction` as one of three values and an optional `comment` up to 500 characters |
| Public preview page | `src/app/share/[shareId]/` | Built |
| Wiki panel | `src/components/share/OpinionPanel.tsx` | Built |
| Storage | `src/lib/public-share/store.ts` | Built, and see below |

The block kinds supported are `component`, `surface`, and `color`. The docs note that color shares work at the API level and the UI is not wired on the Color page.

### 7.3 Where it fails as an instrument, honestly

The feature works. The **instrument** does not, for four specific reasons, and all four are fixable.

**One: it does not persist in production.** `store.ts` writes to `join(process.cwd(), "data/public-share")`. Other subsystems in this repo correctly route disk writes through `blocksmithWritableRoot()` in `src/lib/runtime/writable-root.ts`, which returns a `/tmp` path when `VERCEL === "1"`. The share store does not use it. On Vercel, `process.cwd()` is not writable, so share creation fails on the hosted deployment. **Status: Shipped locally, Built-unproven in production, and most likely broken there.**

**Two: the structured part of "structured opinion" is discarded.** The route accepts and validates a comment. `recordOpinion` in `store.ts` takes `RecordOpinionInput` with an optional `comment`, and then increments a counter and never writes the comment anywhere. The free-text signal, which is the part that would actually change a design decision, is dropped on the floor.

**Three: counters, not rows.** `ShareStats` is `{ views, opinions: { approve, unsure, reject } }`. There are no per-opinion records, which means no timestamps, no ordering, no deduplication, and no session identity. Twenty approvals from one enthusiastic person and twenty from twenty strangers are the same number. There is no way to compute a response rate, because views and opinions are independent counters over unbounded time.

**Four: the contentHash is captured and then ignored.** The share record stores the hash of the block at share time, but stats are not partitioned by it. When the block is promoted to a new version, the old and new feedback merge into one bucket, silently. The single most valuable question this instrument could answer, "did the promote help?", is destroyed by the storage model.

### 7.4 What would make it an instrument

Concretely, and it is not much work:

- Route disk access through `blocksmithWritableRoot()`, or better, move the store to Supabase alongside the other cloud stores in `src/lib/cloud/`. Production persistence is table stakes.
- Store **append-only opinion rows**: `share_id`, `block_content_hash`, `reaction`, `comment`, `created_at`, and a coarse client fingerprint sufficient for deduplication but not for identification.
- Aggregate stats **per contentHash**, so version comparison works.
- Surface, in the wiki panel, the two numbers a designer would actually act on: response rate (opinions divided by views) and the reaction split for **this** version versus the previous one.

Until then, the honest status for Chapter 02's Claim 5 is what that chapter already says: the mechanism is believed, the code is shipped, and the demand is unproven. The addition this chapter makes is that even if teams did use it heavily, **the current storage model could not tell us**.

---

## 8. Observability of the system itself

Separate question from product metrics. This is: when the thing is running in production, what can we see?

### 8.1 What exists

**Sentry.** Three configs, all minimal and all consistent:

| File | DSN | Enabled | `tracesSampleRate` | Notes |
|---|---|---|---|---|
| `sentry.server.config.ts` | `NEXT_PUBLIC_SENTRY_DSN` | only when DSN set | 0.1 | `sendDefaultPii: false` |
| `sentry.edge.config.ts` | same | only when DSN set | 0.1 | `sendDefaultPii: false` |
| `instrumentation-client.ts` | same | only when DSN set | 0.1 | Session Replay off (`0` / `0`), exports `onRouterTransitionStart` |

`instrumentation.ts` registers the server or edge config depending on `NEXT_RUNTIME` and exports `onRequestError = Sentry.captureRequestError`, which captures App Router server errors including route handlers and RSC. Two explicit `captureException` calls exist, in `src/app/error.tsx` and `src/app/global-error.tsx`. Turning PII and replay off is a deliberate cost and privacy choice and is the right default.

**Startup config warnings.** `warnOnRiskyProdConfig()` in `instrumentation.ts` runs only when `NODE_ENV === "production"` on the nodejs runtime and emits three `console.warn` lines:

1. No Supabase configured: "PRODUCTION without Supabase, data persists to an ephemeral filesystem and will be lost."
2. Supabase configured but `BLOCKSMITH_SAAS_STRICT` not `1`: "tenant isolation is NOT enforced."
3. No Upstash: "rate limits are per-instance only (not distributed)."

These are three of the most consequential production conditions in the system. Warning about them at boot is genuinely good practice.

**Pipeline runs.** `src/lib/ir/pipeline-runs.ts` captures per-run `duration_ms`, `status`, per-stage records, and a capped console log (200 lines) for every promote, rollback, pin-lock, and ingest. This is real application telemetry for the one flow that matters most, already mirrored to Supabase.

**Build and commit guards.** `scripts/guard-build.mjs` blocks `next build` while `next dev` is running (skipped on CI and Vercel). `.githooks/pre-commit` runs a scan / wiki / governance verify chain. `.github/workflows/` holds `production-goals.yml`, `protocol-conformance.yml`, and `validate-ui.yml`.

### 8.2 What we cannot see

**Gaps in the Sentry setup specifically:**

- **No `environment` is set** in any of the three configs, so production, preview, and local errors are not separated. This is the most impactful one-line fix on this list.
- **`next.config.ts` does not wrap with `withSentryConfig`**, which means no source map upload, no release tagging, and no tunnel route. Production server stack traces will be minified and largely unreadable, which substantially reduces the value of having Sentry at all.
- No `release`, no `beforeSend`, no custom tags, no user or org context on events, no custom breadcrumbs. An error cannot currently be attributed to a tenant.
- **The three startup warnings are `console.warn` only.** They are not sent to Sentry. In production they land in Vercel logs and nothing alerts on them. It is entirely possible to be running production with tenant isolation off and never find out.

**Gaps in the system view:**

| Question | Can we answer it |
|---|---|
| Did a real user's scan succeed in production today? | **No** |
| How many MCP calls happened this week? | **No.** Only `last_used_at` per key, no counter |
| Has any customer's `validate:ui` ever run? | **No** |
| What did we spend on LLM inference, per tenant? | **No.** Rate limits exist (`src/lib/cloud/rate-limit.ts`) and the counters are destroyed by `EXPIRE`. The one thing with real marginal cost is unmetered |
| Are we silently on the file fallback instead of Supabase? | **Only by reading Vercel logs at boot** |
| Is the rate limiter failing open? | **No.** It logs `[rate-limit] Redis error, allowing request` and continues. Failing open is the right choice; being unable to count how often is not |
| p95 latency of promote? | **The data exists** (`duration_ms` in `blocksmith_pipeline_runs`) and nothing reads it |

### 8.3 The first three dashboards

Chosen so that each is buildable from data that already exists, with no new instrumentation, which is why they come before anything else.

**Dashboard 1: Pipeline health.** Source: `blocksmith_pipeline_runs`. Panels: runs per day by action; success versus failure rate; p50 and p95 `duration_ms` by action; count of docs whose lock is currently stale (from `verifyLock` server-side); the ten most recent failed runs with their captured log. *Why first:* it monitors the one flow that defines the product, it is entirely derivable from an existing table, and it doubles as the customer-facing "Releases" evidence panel.

**Dashboard 2: Activation funnel.** Source: `blocksmith_documents`, `blocksmith_api_keys`, `blocksmith_pipeline_runs`, `blocksmith_governance_events`. Steps: signed in, scanned, wiki opened, first governance edit, first promote, first lock pull, first MCP call. Absolute counts and conversion between adjacent steps, cohorted by signup week. *Why second:* it is the answer to "does anyone use this", and today nobody in the company can answer it. Two of its seven steps (wiki opened, MCP call) need the one-line events described in M1 and M5; the rest are queries today.

**Dashboard 3: Drift ledger.** Source: `blocksmith_governance_events` plus `blocksmith_deviations`. Panels: detected versus resolved versus bypassed over time; breakdown by `source` (mcp / cli / git-hook / ci), which doubles as a per-surface engagement signal; age distribution of open violations; deviation terminal-state mix, with `auto_approved`-on-expiry called out separately because it is the falsifier in section 3.2. *Why third:* it is the metric that decides whether governance is closing loops or generating ignored warnings, and it is the honest version of the fake "Governance Score 94%" currently shipping in `src/components/stats.tsx`.

**And one non-dashboard, which should probably come before all three:** route the three startup warnings to Sentry as messages and set `environment`. That is an afternoon of work and it converts three silent production risks into things somebody finds out about.

---

## 9. The scorecard

One table. A founder should be able to look at this weekly and know whether the company is real. Current values are as of this writing.

| # | Metric | Current value | Target (first milestone) | Source once instrumented | Owner |
|---|---|---|---|---|---|
| 1 | Teams activated (scanned and opened a wiki) | **Not instrumented** | 10 | `blocksmith_documents` + wiki view event | Product |
| 2 | Blocks promoted per active team per week | **Not instrumented** (data exists) | median at least 1 | `blocksmith_pipeline_runs`, `action = promote` | Product |
| 3 | Governance drafts reaching promote within 14 days | **Not instrumented** (data exists) | at least 50% | Registry entries + promote runs, excluding auto-promote | Product |
| 4 | Customer repos with a fresh lock | **Not instrumented** (needs CLI reporting) | at least 80% of pinned repos | `verifyLock` + CLI / CI report-back | Platform |
| 5 | MCP calls per active doc per week | **Not instrumented** | any non-zero external number | MCP route event | Platform |
| 6 | `validate:ui` runs in customer repos per week | **Not instrumented** (needs CI reporting) | any non-zero external number | GitHub Action report-back | Platform |
| 7 | Drift detected vs resolved (ratio and open age) | **Not instrumented** (data exists) | resolved at least 60% within 7 days | `blocksmith_governance_events` | Product |
| 8 | Deviations auto-approved on TTL expiry (nobody looked) | **Not instrumented** (data exists) | under 25% of terminal states | `blocksmith_deviations` | Product |
| 9 | Off-token drift, governed vs ungoverned | **Measurable today**, single-shot only, no denominator | a published run over at least 50 prompts, with method disclosed | `src/lib/ai/governed-generate.ts` | Research |
| 10 | Lint coverage beyond color | **Color only** | color + spacing + radius + type + component usage | `src/lib/governance/` | Research |
| 11 | External adapters or compile targets (not ours) | **0** | 1 | `/protocol/adapters`, targets manifest | Research |
| 12 | `@blocksmith/protocol` npm downloads | **Not published** | published, then any external installs | npm | Research |
| 13 | Compile loss, device target | **Measurable today** (`deviceCompileLoss`), untracked | tracked per release, no upward trend | `src/lib/ir/targets/device-sim.ts` | Research |
| 14 | Public block shares created, and opinions per share | **Not durably recorded** (see 7.3) | median at least 5 opinions per shared block | Rebuilt share store | Product |
| 15 | R5 evaluation | **Planned.** No team, no protocol, no logging | 1 team, 2 weeks, written up | See 5.4 | Research |
| 16 | Production error rate, by environment | **Sentry on, no `environment` tag, no source maps** | separated environments, symbolicated traces | Sentry | Platform |
| 17 | Promote latency p95 | **Not surfaced** (data exists) | under 60s | `duration_ms` in `blocksmith_pipeline_runs` | Platform |
| 18 | Goal completion percentage | **Self-assessed, not computed** (see 4.1) | replaced by checklist `n/m` plus verify-script pass count | `scripts/verify-status.ts` (**does not exist**) | Founder |

Eighteen rows. **Fourteen say "not instrumented" or worse.** Six of those fourteen need only a query against a table that already exists.

That last sentence is the actionable summary of this entire chapter. The gap between what we can prove and what we assert is real and large, and it is mostly a dashboard problem rather than an architecture problem, which is the good version of this situation.

---

## Open questions

1. **Vendor or table?** Do we add one append-only `blocksmith_product_events` table and write our own dashboards, or adopt an analytics vendor and accept a new processor on the privacy page? Section 2.3 argues for the table at our current stage. The answer changes when a non-engineer needs to answer their own questions.

2. **Do we ask customers to let their tooling report back?** Metrics 4 and 6, the R5 evaluation, and the entire "are your repos pinned" enterprise story all depend on the CLI and the CI action reporting a lock hash and an outcome class. It must be opt-in, org-scoped, disclosed in the CLI first-run notice and the privacy page, and never carry code or hex values. That is a founder decision and it gates several other things.

3. **How wide should the deterministic lint get, and who does it?** Color-only is too narrow for R5 and too narrow to sell. Spacing, radii, typography scale, and approved-component usage are all checkable without a model. This is the highest-value shared item between product and research, and the division of labor in `docs/TEAM-NORTH-STAR.md` does not clearly assign it.

4. **Do we keep the governed-versus-ungoverned demo in its current form?** The governed prompt instructs "never write a raw hex" and the metric counts raw hexes (section 1.3). Options: disclose the tautology and keep the demo as a mechanism illustration; widen the metric so the comparison becomes non-trivial; or add a second condition where the governed agent is *not* told the rule and only receives the token context, which would measure grounding rather than instruction-following. The third is the most interesting and the most likely to produce an uncomfortable number.

5. **What is the ethical and legal shape of a two-week study on a customer team?** Participants are professionals doing paid work; the data includes their code diffs. Consent, data retention, and the right to withdraw need answering before recruitment, not after.

6. **When do the fake dashboards come out?** `src/app/dashboard/analytics/page.tsx` and its five hardcoded panels are shipped to signed-in users today. Replace with real queries, replace with empty states, or remove the route. Doing nothing is the only option that is actively harmful.

7. **Is percentage-free status reporting actually adoptable?** Section 4.3 proposes replacing "~76%" with checklist counts and verify-script coverage. Percentages are genuinely useful for compressing status into a board update, and a table of five status words is harder to skim. Is there a compressed form that is both honest and glanceable?

8. **Who owns the scorecard?** A weekly table with no named owner becomes a stale table. Section 9 assigns owners per row and does not assign an owner to the table itself.

---

## Where to look in the code

**The one real measurement**

- `src/lib/governance/color-lint.ts`: the shared engine. `normalizeHex`, `paletteFromColors`, `scanLine`, `findOffTokenColors`, `nearestToken`
- `src/lib/governance/prose-lint.ts`: warn-tier prose heuristics compiled from promoted component rules
- `src/lib/governance/check-diff.ts`: combines both into `checkGovernanceDiff`, returns `blockCount`, `warnCount`, `governed`
- `scripts/validate-ui.ts`: the CI gate. Stage 1 lock freshness, stage 2 off-token colors. Exit codes 0 / 1 / 2
- `scripts/governance-gate.ts`: the pre-commit gate
- `src/mcp/handlers.ts`: `handleValidateUiCode` (line 386), `handleCheckGovernanceDiff` (line 407), `handleFigmaTokenDrift` (line 540)
- `src/lib/ai/governed-generate.ts`: `scoreDrift`, `buildOutput`, `governedMessages`. Read `governedMessages` and `scoreDrift` together, in that order
- `src/components/demo/GovernedAiShowcase.tsx`: where the number is shown

**Drift measurement, all four forms**

- `src/lib/figma/drift.ts`: `computeTokenDrift`, `valuesEqual`. Form A
- `src/lib/figma/component-drift.ts`: component-level form A
- `src/lib/ir/diff.ts`: `buildPromoteDiffs`. Form B
- `src/lib/ir/lock.ts`: `verifyLock`, `buildLock`. Form C, and the most trustworthy function in the repo
- `src/lib/ir/targets/device-sim.ts`: `deviceCompileLoss`. Compile loss

**Stores that are already measurement-capable**

- `supabase/schema-registry.sql`: `blocksmith_pipeline_runs`, `blocksmith_registry_manifest`, `blocksmith_block_registry_entries`, `blocksmith_block_locks`
- `supabase/schema-governance-events.sql`: `blocksmith_governance_events`
- `supabase/schema-deviations.sql`: `blocksmith_deviations`, `org_governance_settings`
- `supabase/schema.sql`: `blocksmith_documents`, `blocksmith_api_keys` including `last_used_at`
- `src/lib/ir/pipeline-runs.ts`: `duration_ms`, `status`, `stages`, `log`
- `src/lib/cloud/governance-events.ts`: `appendGovernanceEvent`, `listGovernanceEvents`, `countOpenViolations`. Note the 500-event file-fallback cap
- `src/lib/cloud/deviations.ts`: the full deviation lifecycle, including `autoApproveExpired`
- `src/lib/cloud/api-keys.ts`: `touchDbKey`, the only per-request write we have
- `src/lib/cloud/rate-limit.ts`, `src/lib/cloud/redis.ts`: counters that are deliberately destroyed

**The human ledger that is not telemetry**

- `src/lib/activity/store.ts`, `git.ts`, `from-commit.ts`
- `scripts/activity-from-commit.ts`, `.githooks/post-commit`
- `src/app/api/wiki/activity/route.ts`

**Public feedback as an instrument**

- `src/lib/public-share/store.ts`: read `recordOpinion` and note the discarded comment; note `process.cwd()` versus `src/lib/runtime/writable-root.ts`
- `src/lib/public-share/types.ts`: `ShareStats` is counters only
- `src/app/api/share/route.ts`, `src/app/api/share/[id]/opinion/route.ts`, `.../view/route.ts`
- `src/components/share/OpinionPanel.tsx`

**Observability**

- `instrumentation.ts`: `register`, `onRequestError`, `warnOnRiskyProdConfig`
- `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation-client.ts`
- `next.config.ts`: note the absence of `withSentryConfig`
- `src/app/error.tsx`, `src/app/global-error.tsx`
- `src/app/privacy/page.tsx`: the processor list, currently accurate

**The fabricated numbers, so you can find and remove them**

- `src/app/dashboard/analytics/page.tsx`, `src/components/dashboard.tsx`
- `src/components/stats.tsx`: "Governance Score 94%"
- `src/components/governance-health-chart.tsx`, `src/components/component-usage-chart.tsx`
- `src/components/active-deviations.tsx`, `src/components/recent-scans.tsx`
- `docs/PROJECT-PIPELINE.md`, enterprise hooks table: "static ok for demo"

**Proof scripts**

- `scripts/verify-ir-cicd.ts`: the closed-loop proof (ingest, build, stage, promote, enforce, rollback, stale, compile)
- `packages/protocol/conformance/`: fixtures, golden hash vectors, drift gate
- `scripts/verify-production-goals.ts`: 66 lines, three assertions, defers to a manual checklist
- `.github/workflows/production-goals.yml`, `protocol-conformance.yml`, `validate-ui.yml`

**Documents this chapter audits**

- `docs/RESEARCH-INFRA-DESIGN-IR-AND-CICD.md`: the research brief. Sections 8 (open questions) and 9.2 (R1 to R5)
- `docs/TEAM-NORTH-STAR.md`: division of labor, Stream F
- `docs/CEO-DIRECTIVE.md`: section VIII, and the sequencing table's Stream F row
- `docs/PROTOCOL-GOVERNANCE.md`: decision rights, the hash law, the NUL-byte incident
- `docs/PROJECT-PROTOCOL.md`: the definition-of-done checkboxes, read with section 3.4 in mind
- `docs/GOAL-SAAS-STATUS.md`: the percentages
- `docs/GOAL4-DEVIATION-TTL.md`: the understated status table
- `docs/PUBLIC-FEEDBACK.md`: the human signal pillar

**Related chapters**

- [Chapter 02](./02-the-thesis.md), section 5: the seven claims and their disproofs. This chapter supplies the instruments
- [Chapter 10](./10-governance-and-design-cicd.md): the governance and CI/CD machinery being measured
- [Chapter 15](./15-verification-and-quality.md): the verify culture, which is the closest thing we have to a working measurement discipline
- [Chapter 17](./17-what-we-still-need.md): the proof gaps listed here belong there too
