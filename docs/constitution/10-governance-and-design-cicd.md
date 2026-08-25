# Governance And Design CI/CD: The Part Nobody Else Owns

**What this chapter covers.** The mechanism that turns the BlockSmith wiki from documentation into enforcement: the "Jenkins for design" analogy done literally, the block lifecycle (INGEST, DRAFT, PROMOTE, LOCK, DEPLOY), the three governance tiers, the color lint engine that powers all of them, the CI gate that runs inside a customer's repository, sanctioned deviations with a time to live, the governance copilot, roles, and a precise definition of drift.

**Why it matters.** Every competitor can host a design system. Figma can host a design system. A Notion page can host a design system. What nobody owns is the moment where a promoted design decision *stops an engineer or an agent from shipping something else*. That moment is this chapter. If the rest of the product disappeared tomorrow and this survived, we would still have a company. If this disappeared, we would be a prettier README host.

**Read this if** you are about to touch anything under `src/lib/governance/`, `src/lib/ir/`, `scripts/validate-ui.ts`, `packages/cli/src/check.ts`, or any route under `src/app/api/wiki/`. Also read it before you say the word "governance" to a customer, because half of what our own docs claim is planned and this chapter tells you which half.

---

## 1. The core analogy, done carefully

### 1.1 Why the analogy exists at all

Code has a solved problem. You push, something builds, the build produces an artifact, the artifact goes to staging, a human approves, the artifact deploys to production, and a lock file or image digest pins exactly what is running. If production misbehaves you roll back to the previous artifact. Nobody argues about "what version of the code is live" because a machine can answer it.

Design has none of that. The truth lives in a Figma file, a `DESIGN.md`, a Slack thread, and the context window of whichever agent happened to be running. Two agents on two different days follow two different "latest" rules. The designer believes the team agreed on v4 while Cursor is still behaving like v3. There is no artifact, no pin, no promote, and therefore no way to say "you shipped something that is not the approved design" with a straight face.

The whole product thesis is: give design the same five nouns code already has. Build, artifact, staging, promote, deploy. Then the sentence "your PR deviates from the design system" becomes a machine-checkable claim instead of a taste argument.

`docs/TEAM-NORTH-STAR.md` states the mapping. This section reproduces it and then, for every row, tells you the exact code path so you can go read the implementation.

### 1.2 The mapping table

| Jenkins concept | BlockSmith equivalent | Where it lives in code |
|---|---|---|
| Build | Scan or ingest into the Design IR | `scanAndPersist()` in `src/lib/scan/run.ts` calls `persistBlocksForDoc()` in `src/lib/blocks/store.ts`, which calls `recordIngest()` in `src/lib/ir/registry.ts` |
| Artifact | A block at a version, plus the Pulse build | `BlockVersionRecord` in `src/lib/ir/types.ts`; records live at `.blocksmith/registry/<docKey>/<blockId>.json`; the package artifact is `@blocksmith/<product>`, named by `packageNameForDoc()` in `src/lib/ir/releases.ts` |
| Staging | A draft block in the wiki | `recordIngest()` writes `status: "draft"` for any non scan fact edit; `buildReleaseTable()` in `src/lib/ir/releases.ts` computes `draftPending` |
| Approve / merge | Finalize, then promote | `POST /api/wiki/finalize` stages, `POST /api/wiki/promote` promotes via `promoteBlock()` in `src/lib/ir/registry.ts` |
| Production deploy | Regenerate `blocksmith.lock` | `writeReferenceLock()` in `src/lib/ir/lock.ts`, called by the promote, rollback, pin-lock and finalize routes; delivered to the repo by `GET /api/v1/scans/pull` and written by `packages/cli/src/pull.ts` |
| CI gate | `npm run validate:ui` in the customer's repository | `scripts/validate-ui.ts`, workflow template at `.github/workflows/validate-ui.yml`, CLI variant at `examples/github/blocksmith-governance.yml` |
| Rollback | Move the official pointer back | `rollbackBlock()` in `src/lib/ir/registry.ts`, exposed as `POST /api/wiki/rollback` |

### 1.3 Row by row, with the reasons

**Build = scan or ingest into the IR.**

The concept: a build takes messy source and produces a structured, hashable thing. For us the messy source is a repository, an uploaded `DESIGN.md`, a Figma file, or a paste. The structured thing is a set of blocks conforming to `blocksmith.blocks.v1`.

The code: `recordIngest(docRef, systemId, blocks, editedBy, options)` is the single entry point. It is deliberately the only writer of version history. For each incoming block it computes `blockContentHash(id, type, content)` and compares it with the newest recorded version:

- New id becomes version 1.
- Same id with the same content hash is a no operation, recorded in `report.unchanged`. It also clears a previously recorded `stale` status, because the block reappeared.
- Same id with a changed content hash becomes version N+1.
- Any id present in the registry but absent from this ingest pass has its newest version marked `stale`, unless the caller passed `partial: true`.

That last flag matters. A Storybook or Figma adapter contributing alongside a primary repo scan must not mark every block it does not know about as stale. Only a full source of truth scan is allowed to stale things.

The reason ingest is a build and not a save: builds are idempotent and produce a hash. Two ingests of identical content produce zero new versions and an identical graph hash. `npm run verify:ir-cicd` asserts exactly this ("unchanged content does not bump versions").

**Artifact = block at version, plus the Pulse build.**

The concept: an artifact is immutable and addressable. You do not edit build 41; you make build 42.

The code: `BlockRegistryEntry` holds `{ id, official?, versions: BlockVersionRecord[] }`. `versions` is append only. Nothing in `registry.ts` ever removes or rewrites a version record. `official` is a plain integer pointer, exactly like an npm dist-tag. Promote moves the pointer forward, rollback moves it back, and the history under both is untouched. `verify:ir-cicd` asserts "history immutable: both versions still recorded" after a rollback.

Hashing is constitutional. `src/lib/ir/hash.ts` computes `sha256("<id> <type> <canonicalJson(content)>")` and truncates to `sha256:` plus the first 32 hex characters. `graphHash()` sorts `<id>@<version>:<contentHash>` lines, joins with newlines, and digests the result, which makes the graph hash order independent. `docs/PROTOCOL-GOVERNANCE.md` freezes these semantics for v1 and records a real incident: an early app build embedded a NUL byte instead of an ASCII space in the separator, the drift gate caught it on the first run, and the app was corrected to spec rather than the spec being quietly bent to match the app.

**Staging = a draft block in the wiki.**

The concept: staging is a place where a change is real and visible but not yet load bearing.

The code: the status field on the newest version record. `recordIngest()` decides between `finalized`, `draft` and `conflict` using the truth precedence rule:

```ts
const autoPromote =
  (SCAN_FACT_TYPES.has(b.type) && editedBy === "ingest") ||
  (version === 1 && b.status === "finalized");
```

`SCAN_FACT_TYPES` is `token` and `component`. The rule reads: facts that come from code auto promote when code changed them, because the repository is authoritative for what a token actually is. Prose (guidelines, agent rules, page copy) always stages as a draft, because a human wrote it and a human should agree to it. A human editing a token in the wiki also stages a draft, because `editedBy` is then `"web"`, not `"ingest"`.

The visibility rule is enforced in `src/lib/ir/enforce.ts`. `listGovernedBlocks()` skips any block whose status is `draft` or `conflict`. Humans in the wiki can see drafts. Agents cannot. That asymmetry is the entire meaning of "staging".

**Approve = Finalize, then promote.**

There are two distinct steps here and confusing them is the most common mistake on the team.

`POST /api/wiki/finalize` writes the human's prose into the markdown, persists the cloud override sidecar, clears the design system cache, and then calls `refreshBlocksForDoc(doc, "web")`, which re-ingests with `editedBy: "web"` and therefore records a **draft**. The route comment says it plainly: saved edits land in Staging, and Production, the lock, and the agents stay untouched. The response carries `staged: true` and `stagedVersion`. There is an explicit escape hatch, `promote: true` in the body, which promotes and regenerates the lock in one step, but the default is stage only.

`POST /api/wiki/promote` is the actual gate. Body is `{ doc, blockIds, resolveConflicts? }`. It rate limits, checks `requireDocumentAccess(request, fileName, "write")`, hydrates the registry from Supabase, loops `promoteBlock(doc, blockId, "", { deferManifest: true })` over the batch, rebuilds the manifest once, writes the reference lock once, and then awaits `syncRegistryToCloud` and `syncLockToCloud` before responding. `deferManifest` exists because writing the manifest per block was O(N squared) directory scans on a forty block promote.

Two details worth internalising. First, a conflicted block cannot be promoted; `promoteBlock()` returns an error, and only an explicit `resolveConflicts: true` lets the route fall through to `resolveConflict()`. Second, the route records a run either way: a batch where every block failed is appended as a **failed run** with `buildFailedStages("production", ...)`, so failures show up in the Pipeline console instead of only in the browser devtools.

**Production deploy = update `blocksmith.lock`.**

The concept: deploy is when the approved artifact becomes the thing that actually runs.

The code: `buildLock(docRef)` reads `getOfficialBlocks(docRef)`, sorts by id, and pins `{ version, contentHash }` per block plus a top level `contentHash` equal to `graphHash(blocks)`. Sorting is not cosmetic; it makes the serialization deterministic, so two builds of the same official graph produce byte identical locks. `verify:ir-cicd` asserts "deterministic: same graph gives the same lock hash".

`writeReferenceLock()` writes the per doc lock to `.blocksmith/locks/<docKey>.lock`, mirrors it best effort to the legacy single path `.blocksmith/blocksmith.lock`, and fires a Supabase mirror. Per doc locks exist because promoting product A used to clobber product B's pin.

The lock reaches the customer repository in two ways: `GET /api/v1/scans/pull` includes a `lock` field in its response and `packages/cli/src/pull.ts` writes it as `blocksmith.lock` in the workspace root, or `GET /api/v1/lock?docRef=...&format=file` serves it as a download with `Content-Disposition: attachment; filename="blocksmith.lock"`.

**CI gate = `validate:ui` in their repo.**

The concept: the gate is the only place where the whole system acquires teeth. Everything upstream is bookkeeping until a pipeline turns red.

The code: `scripts/validate-ui.ts`, covered in full in section 5.

**Rollback = `rollbackBlock`.**

The concept: production reverts, history does not.

The code: `rollbackBlock()` finds the highest version strictly below the current `official` that has a `finalizedAt` timestamp, and moves the pointer to it. If there is no earlier finalized version it returns `{ ok: false, error: "No earlier finalized version to roll back to" }`. `POST /api/wiki/rollback` returns 409 on that error, regenerates the lock, syncs to cloud, and appends a run with `buildRollbackStages`. The run log line is written as "official pointer moved vX to vY (history immutable)", which is the sentence you want a customer to read during an incident.

### 1.4 What we deliberately do not build

This is as important as the table. `docs/TEAM-NORTH-STAR.md` carries the do-not-build list, and the reasons are worth stating because each one is a trap somebody will propose again.

**No separate Jenkins instance and no separate admin application.** The wiki *is* the pipeline dashboard. If a governance feature helps a team control design truth, it ships inside the wiki. The CLI, MCP and CI are consumers of what humans promoted in the wiki, never a second control plane. The failure mode we are avoiding is the one every internal tools team hits: you build the "ops app", designers never open it, and the wiki quietly becomes stale documentation again. The Pipeline console at `/wiki/pipeline` and the release console at `/wiki/releases` are wiki pages, not a separate product.

**No job per block.** There is no scheduler, no job definition, no build queue. The pipeline *is* the block lifecycle. A block's state is fully described by its version list plus one integer pointer. Adding a job abstraction would mean maintaining job state that can disagree with the registry state, and then we would need a gate to detect drift between the pipeline and the thing the pipeline is about, which is absurd.

**No second dashboard for blocks.** The component page and the token page *are* the block pages. `BlockReleaseStrip.tsx` puts "live v3, draft v4 waiting" plus a one click promote directly on the component page.

**No per engineer package.** One org, one design doc, one design graph, one `@blocksmith/<product>` package, one lock. Roles decide who may promote. They do not fork the artifact. This is section 8.

**No literal environments in v1.** Staging is `draft`, production is `official` plus the lock. Optional named environments are sketched in the north star as a v2 idea using the same model with a second pointer, and there is no code for it.

---

## 2. The lifecycle: INGEST, DRAFT, PROMOTE, LOCK, DEPLOY

```
INGEST → DRAFT (staging) → PROMOTE (production) → LOCK → DEPLOY (agents / CI)
```

Five stages, four of which are visible in the Pipeline console. `src/lib/ir/pipeline-stages.ts` defines the stage ids the console renders: `"ingest" | "staging" | "production" | "lock"`. Deploy is not a stage in that grid because deploy is passive: it is whatever agents and CI read next, and it happens on their schedule, not ours.

Every run that mutates the pipeline appends to an append only log (`appendRunDurable()` in `src/lib/ir/pipeline-runs.ts`, stored under `.blocksmith/runs/` and mirrored to Supabase) with a per stage result. Durations are measured server side at append time; runs recorded before that existed show honest fallbacks rather than fabricated numbers.

### 2.1 The four day story

Take one team, one product, one accent color and one button. This is the story in `docs/TEAM-NORTH-STAR.md`, expanded with the actual calls and writes.

#### Monday: the team scans the repository

A lead connects the repo and scans it. Nothing has ever been governed before.

What runs:

```
scanAndPersist(workspaceRoot)                    src/lib/scan/run.ts
  └─ persistBlocksForDoc(...)                    src/lib/blocks/store.ts
       └─ recordIngest(docRef, systemId, blocks, "ingest")
                                                 src/lib/ir/registry.ts
```

What is written:

- The canonical markdown for the doc, under the uploads store, giving a `docRef` such as `upload:scan-acme-ui-kit.md`.
- One JSON file per block at `.blocksmith/registry/upload_scan-acme-ui-kit.md/<blockId>.json`. Note the key sanitizer: `safeKey()` replaces every character outside `[a-zA-Z0-9._-]` with an underscore, so `upload:scan-acme-ui-kit.md` becomes the directory `upload_scan-acme-ui-kit.md`.
- `.blocksmith/registry/<docKey>/manifest.json`, holding `officialGraphHash`, `blockCount`, `promotedCount`, `draftCount`, `staleCount`.
- A fire and forget Supabase mirror per entry and per manifest, via `src/lib/ir/cloud-registry.ts`.

The state after ingest: every token and component block is at v1 and already `finalized` (auto promoted, because code is authoritative for code facts). Every governance or agent rule block is at v1 with status `draft`, waiting for a human. `IngestReport.official` records which ids are lock eligible.

Then the lead pins production. The wiki shows "40 live, no lock", which is the dead end `POST /api/wiki/pin-lock` exists to solve: everything is promoted, so there is nothing to click promote on, but agents are still unpinned.

```
POST /api/wiki/pin-lock   { doc: "upload:scan-acme-ui-kit.md" }
  → requireDocumentAccess(..., "write")
  → hydrateRegistryFromCloud(doc)
  → getOfficialBlocks(doc)          409 if empty
  → writeReferenceLock(doc)         .blocksmith/locks/<docKey>.lock
  → syncLockToCloud(doc, lock)
  → appendRunDurable({ action: "pin-lock", stages: buildPinLockStages(...) })
```

Finally the engineer wires their repository:

```bash
blocksmith login --key <key> --url https://…
blocksmith pull --doc upload:scan-acme-ui-kit.md
```

`cmdPull` writes `DESIGN.md`, `.blocksmith/wiki-overrides.json`, and `blocksmith.lock`. If the server had no lock to give, it prints "blocksmith.lock skipped, promote blocks in the Pipeline to pin versions" rather than writing an empty file.

The agent now builds a page. It reads tokens through MCP, which resolves through `listGovernedBlocks()`, which serves official versions only. Button radius is 8px because that is what v1 of the block says.

#### Tuesday: the designer edits the button rule

The designer opens the Button component page in the wiki, clicks edit, and gets `ComponentGovernanceEditPanel`. The panel opens with a banner that says, in effect, this is governance and not Figma: you are setting rules for when and how to use the component, colors and spacing come from code, and saved edits land in Staging.

They change the usage rules and radius guidance and press "Save draft".

```
POST /api/wiki/finalize
  { doc, blockId: "component:button", updatedData: { role, description },
    baseContentHash }
```

What happens inside, in order:

1. Rate limit on `pipeline:write:<ip>`, default 120 actions per 10 minutes, overridable with `BLOCKSMITH_PIPELINE_RATE_LIMIT`.
2. `requireDocumentAccess(request, fileName)` with the default action `"write"`, so a viewer is refused here.
3. Read the current markdown, hash it (sha256, first 16 hex), and compare against `baseContentHash`. A mismatch without `force` returns **409 Conflict** with "This document has been modified in the IDE since you started editing." That is the two way handshake guard: the IDE and the web cannot silently overwrite each other.
4. `modifyMarkdownBlock(currentMd, blockId, updatedData)` rewrites the markdown, and the result is persisted.
5. For workspace scan docs, the prose is also written to the cloud override sidecar (`setUploadComponentOverride`) and, when the server is allowed to touch the local vendor tree, to `setComponentOverride`.
6. `clearDesignSystemCache()`.
7. `refreshBlocksForDoc(doc, "web")` re-ingests. Because `editedBy` is `"web"` and not `"ingest"`, the auto promote condition is false, so the button block records **v2 with status `draft`**.
8. `syncRegistryToCloud(doc)`.

What is written: the markdown file, the sidecar override, the new registry version record, the manifest. What is **not** written: the lock. `writeReferenceLock` is only called on the `promote: true` path.

State: the wiki shows "Live v1, draft v2 waiting". `buildReleaseTable()` sets `draftPending: true` and `canPromote: true` for that row. Agents still read v1. `verifyLock()` still returns `ok: true`, because the official graph did not change. `verify:ir-cicd` asserts precisely this: "lock unaffected by drafts".

This is the separation that is the product. A designer can think out loud in the wiki without moving production.

#### Wednesday: the lead promotes

The lead opens `/wiki/pipeline`, selects the button block, and the `PromoteDiffDrawer` shows a required production versus staging review before confirm. That diff comes from `buildPromoteDiffs()` in `src/lib/ir/diff.ts`, which walks the union of content keys between the official record and the latest record, marks each field `changed`, and flags fields where either side matches `/^#[0-9a-fA-F]{3,8}$/` as `isColor` so the UI can draw swatches instead of printing hex strings at a human.

They confirm.

```
POST /api/wiki/promote   { doc, blockIds: ["component:button"] }
  → rate limit, requireDocumentAccess(..., "write")
  → hydrateRegistryFromCloud(doc)
  → lockBefore = getLockStatus(doc).contentHash
  → promoteBlock(doc, id, "", { deferManifest: true })   status → "finalized",
                                                         finalizedAt set,
                                                         official → 2
  → updateManifest(doc)
  → writeReferenceLock(doc)                              new lock contentHash
  → await Promise.all([syncRegistryToCloud, syncLockToCloud])
  → appendRunDurable({ action: "promote", status: "success",
                       lockBefore, lockAfter, stages: buildPromoteStages(...) })
```

Files written: the block's registry JSON, the manifest, `.blocksmith/locks/<docKey>.lock`, the legacy mirror, the run log, and the Supabase mirrors.

One design decision worth defending: cloud persistence is awaited, not fired and forgotten, because a frozen serverless lambda drops background work and would silently lose a promote. But if Supabase is down, the route does **not** return 500. The promote already succeeded locally, so it degrades loudly instead: the run log records the failure and the response carries `persistenceWarning: "Cloud sync failed, see run console"`. Failing a completed action because the mirror failed would be worse than the mirror failing.

Now the repository's `blocksmith.lock` is stale. Its `contentHash` is the graph hash from Monday; the registry's is Wednesday's. The lead tells the engineer, or the engineer's next PR tells them, and they run `blocksmith pull` again. Agents now read v2.

#### Thursday: an engineer changes the accent in code and the lock goes stale

An engineer edits `--color-accent` in the repository from `#d97757` to `#e0815f` and pushes. A re-scan runs.

```
recordIngest(docRef, systemId, blocks, "ingest")
```

The accent token's content hash changed, so it records **v2**. Because it is a `token` and `editedBy` is `"ingest"`, `autoPromote` is true: `status: "finalized"`, `finalizedAt` set, `entry.official = 2`. Code won, immediately, without a human clicking anything. That is deliberate. A token in the wiki that disagrees with the token in the shipped CSS is a lie, and the repository is the only thing that renders to a user.

The consequence is mechanical. `officialGraphHash(docRef)` changes. The repository's `blocksmith.lock` still carries the old graph hash, so:

```ts
const stale = lock.contentHash !== registryHash;
```

is now true. `verifyLock()` returns `ok: false, stale: true`, plus a `versionMismatches` entry `{ id: "token:color:accent", locked: 1, official: 2 }`.

The engineer opens a PR. `validate_ui` runs and fails stage 1:

```
❌ Lock is STALE: pinned graph sha256:… ≠ promoted graph sha256:…
   token:color:accent: locked v1, official is v2
   A human promoted newer block versions in the wiki. Re-pull the lock before merging.
```

The fix is one command, `blocksmith pull`, which rewrites `blocksmith.lock` from the current official graph. The PR goes green.

`verify:ir-cicd` reproduces this whole day as assertions: "token re-scan auto-promotes v2 (code wins until re-scan)" and "v2 lock stale after token promotion".

### 2.2 The two edge states you will meet

**Stale is not deleted.** If a block vanishes from its source, `recordIngest()` marks its newest version `stale` and leaves the lock pinning whatever the last official version was. A human decides in the wiki. `verify:ir-cicd` asserts "stale block still locked at last official version". The reason: a file being temporarily absent from a scan (a branch, a failed parse, a moved directory) must never silently unpin production.

**Conflict blocks promote.** When two sources disagree about the same block id, ingest records `status: "conflict"`. `promoteBlock()` refuses with "Block is in conflict, resolve the disagreeing sources before promoting", and `listGovernedBlocks()` filters conflicts out of agent reads. Only an explicit human decision, `resolveConflicts: true` on the promote route, which calls `resolveConflict()`, breaks the tie by promoting the latest version.

---

## 3. The three governance tiers

`docs/GOVERNANCE-TIERS.md` is the spec. The implementation is `src/lib/governance/types.ts` (which defines only two tiers as data: `"block" | "warn"`) plus the MCP presentation layer, which is where tier 3 actually lives.

Read that carefully, because it explains a confusion you will hit: tier 3 is not a third value of the `tier` field. Tier 3 is *the same findings, rendered prescriptively, at agent time, before the code is written*. The tier field on a finding is only ever `block` or `warn`.

| Tier | What it checks | Where it fires | Outcome |
|---|---|---|---|
| **1, Block** | Off-token hex literals; missing or stale `blocksmith.lock` | pre-commit, CI, `blocksmith check` | Fails. Bypass only via `git commit --no-verify` or `git push --no-verify`, and the bypass is recordable |
| **2, Warn** | Component prose rules compiled from promoted governance text | pre-push, CI, `blocksmith check` | Warning plus capture into the wiki Violations feed. Push proceeds |
| **3, Advisory** | The same findings, plus a nearest token fix and a prioritized "Next" block | MCP `check_governance_diff` and `validate_ui_code`, before the agent writes | Prescriptive. The agent self corrects without a round trip |

### 3.1 Tier 1, block

Two things block.

**Off-token color.** `checkGovernanceDiff()` in `src/lib/governance/check-diff.ts` builds a palette from the design system's colors and pushes one finding per off-token hex:

```ts
findings.push({
  ruleId: "off-token-color",
  tier: "block",
  message: `${v.hex} is not a defined design token.`,
  file: args.filePath,
  line: v.line,
  snippet: v.snippet,
  suggestion,
});
```

**Lock state.** This one is not a `GovernanceFinding` at all; it is stage 1 of `scripts/validate-ui.ts`. It fails when there is no lock while the registry has promoted blocks (agents are running unpinned), or when `verifyLock()` reports stale, version mismatches, blocks promoted but not pinned, blocks pinned but no longer promoted, or a content hash mismatch at the same version (a hand edited or corrupted lock).

Why these two and nothing else: both are exact. There is no judgment call in "is `#3b82f6` in the palette" or "is `sha256:abc…` equal to `sha256:def…`". A gate that blocks on a heuristic trains people to disable the gate.

A real tier 1 firing, from `verify:governance-tiers`, which feeds this snippet through the checker:

```tsx
<footer style={{ color: "#abc123" }}>
  <a href="#">Legacy deals (closed 2019)</a>
</footer>
```

The `#abc123` produces `blockCount: 1`, `governed: false`, and a suggestion naming the nearest palette token. The verify script asserts all three.

### 3.2 Tier 2, warn

Tier 2 is `src/lib/governance/prose-lint.ts`. It exists because most real governance is prose ("primary CTA only on marketing pages", "no inactive links in the footer") and prose cannot be checked exactly. So we do not pretend it can.

`compileProseRules(component)` lowercases `role + "\n" + description` and turns trigger phrases in that blob into executable line tests. There are exactly three rules in v1:

| Rule id | Triggered when the promoted prose contains | What it matches in code |
|---|---|---|
| `inactive-link` | `inactive link`, `dead link`, `href =#`, or the phrase `inactive links` | `href="#"`, `href="javascript:void"`, `href=""`, or a bare `href=#` before `/` or `>` |
| `stale-date` | `old date`, `stale date`, `outdated date`, `old dates` | A four digit year `19xx` or `20[0-2]x` on the line, then a second filter: the year must be older than last year, or the line must carry stale context (`©`, `copyright`, `closed`, `since`, `est.`, `founded`, `until`, `deprecated`, `legacy`, `old`) |
| `stale-address` | `old address`, `stale address`, `inactive address`, `old addresses` | A stale adjective (`old`, `former`, `closed`, `deprecated`, `legacy`, `inactive`) within 48 characters of an address noun (`road`, `street`, `st.`, `avenue`, `ave.`, `office`, `address`, `building`, `hq`, `headquarters`) |

Two consequences follow from the design and you should be able to state both to a customer.

First, **a rule only exists if a human promoted prose that mentions it.** If nobody wrote "no inactive links" into a component's governance, `compileProseRules()` returns an empty array and `scanProseViolations()` short circuits. There is no global list of prose rules. That is deliberate: the rules are the customer's own words, and every finding carries `ruleCitation` quoting them, so the developer sees "your team wrote this", not "some linter says so".

Second, **false positives are acceptable here and the doc says so.** A year on a line near the word "since" is not necessarily a stale date. At warn tier that costs a design lead ten seconds of triage. At block tier it would cost an engineer their afternoon, which is why it is not at block tier.

The escalation path is explicit in the tier doc: repeated overrides on one rule are the signal to promote that rule to tier 1. `docs/GOVERNANCE-TIERS.md` also sketches v2 (a rule engine driven by the same governance IR that feeds MCP) and v3 (an optional LLM gate on the diff for enterprise strict mode). Neither exists.

A real tier 2 firing, again from `verify:governance-tiers`. The script promotes this governance text onto the button component:

> Do not include inactive links or old dates in button copy. Keep labels current.

The blob now contains both `inactive links` and `old dates`, so both rules compile. The snippet above then produces `warnCount >= 1`: `href="#"` trips `inactive-link`, and `closed 2019` trips `stale-date` (2019 is older than last year and the line contains `closed`).

### 3.3 Tier 3, advisory

Tier 3 is the surface that talks to a coding agent. It lives in `src/lib/mcp/blocksmith-server.ts` in the `check_governance_diff` handler, and it is the only place where the findings are rendered rather than counted.

A prescriptive tier 3 response looks like this:

```markdown
# Governance check (upload:scan-acme-ui-kit.md)
**Component:** Footer

**Block-tier:** 1 · **Warn-tier:** 2
❌ Block-tier color violations. Do NOT write/push without fixing.

## Findings
- **[BLOCK] off-token-color** · src/components/Footer.tsx:4
  #abc123 is not a defined design token.
  `<footer style={{ color: "#abc123" }}>`
  → Fix: Replace #abc123 with `--color-accent` (Accent, #d97757).
- **[WARN] inactive-link** · src/components/Footer.tsx:5
  Possible inactive or placeholder link (href="#" or empty).
  `<a href="#">Legacy deals (closed 2019)</a>`
  Rule: "Do not include inactive links or old dates in button copy."

## Next
1. Block-tier: apply the suggested token swaps above, then re-run check_governance_diff. Do NOT write or push this code with off-token colors.
2. Warn-tier: prefer fixing the prose (remove inactive links / stale dates). If the developer insists, re-run with record=true and overrideReason so it lands in the wiki Violations feed.
```

Three mechanics make that work as enforcement rather than advice.

**`isError` is set.** The handler returns `isError: !result.governed || result.warnCount > 0`. An MCP tool result flagged as an error is something an agent is strongly biased to act on rather than narrate.

**The fix is prescriptive, not descriptive.** `→ Fix:` comes from the `suggestion` field, computed by `nearestToken()`. Telling a model "this is wrong" produces an apology. Telling it "replace `#abc123` with `var(--color-accent)`" produces a diff.

**The "Next" block is ordered.** Block tier first, warn tier second, with explicit instructions on what to do in each case including how to record an override. The comment in the source states the intent: tell the agent exactly what to do next, in priority order, so it can self correct without another round trip.

The server instructions delivered on connect reinforce it. The connector tells the agent to call `validate_ui_code` before applying generated UI and to keep re-validating until it returns "Governed", and to treat deviations from the design system as bugs, and when unsure which token to use to call the governance tools rather than inventing a value.

---

## 4. The lint engine: `color-lint.ts` in detail

This file is 97 lines and it is the most important 97 lines in the repository. Read it before you read anything else.

### 4.1 What it does, function by function

**`normalizeHex(hex)`** takes any hex literal and returns a lowercase six digit form, or `null`.

```ts
let h = hex.replace("#", "").toLowerCase();
if (h.length === 3) h = h.split("").map((c) => c + c).join("");
if (h.length === 8) h = h.slice(0, 6);
return h.length === 6 ? `#${h}` : null;
```

Three digit shorthand expands. Eight digit forms drop the alpha channel. Anything that is not then exactly six digits returns `null` and is ignored downstream. Normalisation exists so that `#FFF`, `#ffffff` and `#ffffffff` are all the same token and cannot be used to smuggle a color past the gate through casing or shorthand.

**`paletteFromColors(colors)`** maps the design system's colors through `normalizeHex` and drops the nulls into a `Set<string>`. The palette is a set of normalized hexes, nothing more. It carries no names, no CSS variables, no semantics. That is why it is fast and why the gate can run on every line of a diff.

**`scanLine(line, palette)`** is the primitive.

```ts
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const matches = line.match(HEX_RE);
if (!matches) return [];
for (const raw of matches) {
  if (IGNORE.has(raw.toLowerCase())) continue;
  const hex = normalizeHex(raw);
  if (hex && !palette.has(hex)) out.push(raw);
}
```

Note that it returns the **raw** matched text, not the normalized form, so error messages quote what the developer actually typed.

**`findOffTokenColors(text, palette)`** is `scanLine` over a whole block of text, producing `{ hex, line, snippet }` with 1-based line numbers and the trimmed line truncated to 100 characters.

```ts
text.split("\n").forEach((line, i) => {
  for (const hex of scanLine(line, palette)) {
    out.push({ hex, line: i + 1, snippet: line.trim().slice(0, 100) });
  }
});
```

**`nearestToken(hex, colors)`** is the suggestion engine.

```ts
const d =
  (target[0] - cand[0]) ** 2 +
  (target[1] - cand[1]) ** 2 +
  (target[2] - cand[2]) ** 2;
if (!best || d < best.distance) { best = { name, hex, cssVar, distance: d }; }
```

Concretely: **color space is sRGB, on raw 0 to 255 integer channels parsed straight out of the hex, and the metric is squared Euclidean distance.** No square root is taken, because comparing squared distances gives the same ordering and skips the cost. Candidates that fail `normalizeHex` are skipped. The scan is linear over the palette and strictly less than wins, so ties resolve to the earliest color in the system's list.

The returned `NearestToken` carries `name`, normalized `hex`, optional `cssVar`, and the raw squared `distance`. `check-diff.ts` turns it into English, preferring the CSS variable when the token has one:

```
Replace #abc123 with `--color-accent` (Accent, #d97757).
```

### 4.2 Known limitations, stated plainly

Do not let anyone tell a customer this engine is more than it is.

1. **Hex literals only.** `hsl(220 90% 56%)`, `rgb(59 130 246)`, `oklch(...)`, named CSS colors like `rebeccapurple`, and Tailwind classes like `bg-blue-500` are completely invisible. A developer who writes `color: rgb(171, 193, 35)` sails through a gate that would have blocked `#abc123`.

2. **The palette silently shrinks for non hex tokens.** `paletteFromColors` drops any token whose value does not normalize. A design system that defines its tokens as `hsl(var(--primary))` contributes zero entries to the palette, at which point every hex literal in the codebase is off token. This is the most likely cause of a customer reporting "the gate flags everything".

3. **sRGB squared distance is not perceptual.** It is not CIELAB, not deltaE, not OKLab. It over weights green and under weights blue relative to human vision, so the "nearest" token can be visibly wrong for saturated colors. The source comment is honest about the intent: cheap, and good enough to point an agent at the intended token. It is a hint for a machine, not a color science claim.

4. **Four digit RGBA shorthand is skipped entirely.** `#abcd` matches `HEX_RE` (three to eight characters) but `normalizeHex` returns `null` for length 4, so it is neither flagged nor normalized.

5. **The `IGNORE` set is dead code.** It contains `transparent`, `currentcolor`, `inherit`, `none`. None of those can ever appear in a `HEX_RE` match, because every match starts with `#`. It is harmless, and it documents intent, but it does nothing today.

6. **The `distance === 0` branch appears unreachable through `checkGovernanceDiff`.** A zero distance means the candidate token normalizes to exactly the flagged hex, which means the hex was in the palette, which means it would never have been flagged. The "exact token match" suffix in the suggestion is defensive only.

7. **No context.** The engine cannot tell a color inside a comment, a test fixture, a data URI, or a third party vendor file from a color in shipped UI. Path scoping is done crudely by the callers via a file glob.

8. **No numeric or geometry checking at all.** Radius, spacing, font size, shadow, z-index: nothing. `docs/GOAL4-DEVIATION-TTL.md` shows mock terminal output comparing `border-radius: 8px` against `12px`. **No code implements that.** Color is the only property the lint engine understands.

### 4.3 The architectural fact: one engine, three surfaces

This is the part to internalise, and the part to say out loud in a pitch.

| Surface | Entry point | Which functions it uses |
|---|---|---|
| **CI gate** (customer PRs, pre-commit) | `scripts/validate-ui.ts`, `scripts/governance-gate.ts` | `paletteFromColors`, `scanLine` (line level, added diff lines only) |
| **MCP tools** (agent time) | `handleValidateUiCode` and `handleCheckGovernanceDiff` in `src/mcp/handlers.ts`, wired in `src/lib/mcp/blocksmith-server.ts` | `paletteFromColors`, `findOffTokenColors`, `nearestToken` |
| **Governed generate drift score** | `scoreDrift()` in `src/lib/ai/governed-generate.ts` | `paletteFromColors`, `findOffTokenColors`, `nearestToken` |

The file's own header states the contract: shared color governance, used by both the commit and CI gate and the live MCP `validate_ui_code` tool so that coding time and push time enforcement apply the exact same rule, that a color must be a defined token. The governed generate module repeats it: drift is scored by the same color lint engine the CI gate and the MCP tool use, so the violation counts are real enforcement output and not the model's self assessment.

**Why sharing one engine is the whole argument.**

Consider the alternative that every AI design tool ships. The model generates UI. The tool asks the model, or a second model, "does this follow the design system?" The model says yes. The tool prints a compliance score. That number is a claim about a claim. It has no relationship to whether the customer's pipeline will accept the code, and everyone in the room knows it, which is why nobody buys it.

Now consider ours. The investor demo at `/demo/investor` shows two agents answering the same prompt, one ungoverned and one grounded in the tenant's approved tokens. Under each output is a violation count. That count is produced by `findOffTokenColors` against `paletteFromColors(system.colors)`. It is the identical function call, on the identical palette, that `scripts/validate-ui.ts` will make when the customer opens a pull request, and that `handleValidateUiCode` will make when Cursor asks before writing a file.

So the demo number is not a marketing metric. It is a **prediction of the gate**, and it is exact, because it is the gate. If the governed agent scores 0 and the ungoverned agent scores 7, that means the ungoverned agent's PR fails and the governed one merges. Three properties follow, and each of them is load bearing:

- **The number cannot be gamed by prompt engineering.** Changing the system prompt changes the generated code; it does not change the checker.
- **The claim survives contact with the customer's CI.** There is no "our tool says compliant but your linter disagrees" moment, because there is one implementation.
- **Every improvement compounds across all three surfaces.** Add HSL parsing to `normalizeHex` and the CI gate, the agent tool, and the demo score all get more accurate in the same commit, with no risk of the three drifting apart.

That last point is the reason to defend this architecture in code review. The moment somebody writes a second color checker "just for the demo" or "just for MCP", the guarantee is gone and we are selling a claim about a claim like everybody else.

---

## 5. The CI gate in the customer's repository

### 5.1 What `validate:ui` actually runs

`npm run validate:ui` maps to `tsx --conditions=react-server scripts/validate-ui.ts`. It runs two stages and exits.

**Stage 1: lock freshness.**

Lock resolution order, from `resolveLockPath()`:

1. `--lock <path>` if given.
2. `<cwd>/blocksmith.lock`.
3. `referenceLockPath(doc)`, the per doc reference lock.
4. `referenceLockPath()`, the legacy single path.

Then:

- **No lock, and `listRegistryEntries(doc)` is non empty.** Fail. "No blocksmith.lock found, but the design registry has promoted blocks. Agents are running unpinned."
- **No lock, and no registry.** Skip, log an informational line, do not fail. Nothing has been governed yet, so there is nothing to be unfaithful to.
- **Lock present.** Run `verifyLock(lock.docRef, lock)`. On `ok`, print the pinned block count and the graph hash. Otherwise print the headline plus one line per problem: version mismatches, promoted but not pinned, pinned but no longer promoted, content hash mismatch. `--allow-stale` downgrades all of this from `console.error` plus failure to `console.warn` plus continue.

**Stage 2: off-token colors in the diff.**

The scope is chosen by flags:

| Invocation | Diff command |
|---|---|
| default | `git diff --cached --unified=0 -- <pathspec>` |
| `--all` | `git diff --unified=0 -- <pathspec>` |
| `--range <r>` | `git diff --unified=0 <r> -- <pathspec>` |

The pathspec is `*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.css`, `*.scss`. The diff is walked by `addedLines()`, a generator that tracks the current file from `+++ b/` headers, resets the line counter from `@@` hunk headers, and yields only lines starting with a single `+`. **Only added lines are scanned.** That is a deliberate choice: the gate blocks *new* deviation without turning a legacy codebase into an unmergeable wall of pre-existing violations on day one.

The palette comes from `loadDocForAiLab(args.doc).system.colors`. The doc defaults to `process.env.BLOCKSMITH_DOC` and falls back to `"apollo.md"`.

Output on failure:

```
validate_ui · Acme UI Kit · 12 tokens · range origin/main...HEAD

❌ 2 off-token color(s). These deviate from the locked design system:

  src/components/Checkout.tsx:42  #FF0000
      color: #FF0000;
  src/components/Checkout.tsx:58  #ff69b4
      background: #ff69b4;

Use a locked token (see wiki palette / MCP get_design_tokens) or promote the new color in the wiki first.
```

Note the closing sentence. It offers two legitimate exits: conform, or change the system through the proper channel. A gate that only offers "conform" gets disabled the first time the design genuinely needs to change.

**Exit codes.**

| Code | Meaning |
|---|---|
| 0 | Governed. Lock fresh (or absent with no registry), no off-token colors in scope |
| 1 | Violations, or a stale or missing lock without `--allow-stale` |
| 2 | Setup error. `loadDocForAiLab` could not load the configured doc |

The separation of 1 from 2 matters. Exit 1 is "your change is wrong". Exit 2 is "our configuration is wrong". Conflating them teaches teams to ignore red.

`scripts/governance-gate.ts` (`npm run governance:check`) is the older, narrower sibling: identical stage 2, no lock stage, exit 2 on doc load failure, and its failure message ends with `Override (not recommended): git commit --no-verify`.

### 5.2 How it is installed

There are two installation paths and they are different products.

**Path A, the script based gate (this repository, and any customer willing to run our script).** Copy `.github/workflows/validate-ui.yml`. It triggers on pull requests touching UI file extensions or `blocksmith.lock`, checks out with `fetch-depth: 0` so the base branch is diffable, installs with `npm ci --ignore-scripts`, and runs:

```bash
npm run validate:ui -- --range "origin/${{ github.base_ref }}...HEAD"
```

with `BLOCKSMITH_DOC` from a repository variable, defaulting to `apollo.md`.

**Path B, the CLI based gate (what a real customer installs).** Copy `examples/github/blocksmith-governance.yml`. It requires a repository secret `BLOCKSMITH_API_KEY`, created in the wiki under Sync then API keys, and a committed `.blocksmith/blocksmith.json` holding the doc ref. Then:

```yaml
- run: npm install -g @block-smith/cli
- run: blocksmith login --key "$BLOCKSMITH_API_KEY" --url "$BLOCKSMITH_URL"
- run: |
    blocksmith check \
      --base "origin/${{ github.base_ref }}...HEAD" \
      --ci --format github > governance.md || echo "failed=1" >> "$GITHUB_OUTPUT"
- uses: marocchino/sticky-pull-request-comment@v2
  with: { header: blocksmith-governance, path: governance.md }
- if: steps.check.outputs.failed == '1'
  run: exit 1
```

The `|| true` style capture is intentional: the comment step must still run when the check fails, so warnings and blocks both appear on the PR. The job only fails when the CLI exited non zero.

### 5.3 What a failing PR looks like

The CLI's `--format github` output is Markdown, rendered as a sticky comment so repeated pushes update one comment instead of spamming the thread:

```markdown
### 🧱 BlockSmith governance

**1** blocking · **2** warnings

| File | Line | Tier | Rule |
|------|------|------|------|
| `src/components/Footer.tsx` | 4 | 🔴 block | #abc123 is not a defined design token. |
| `src/components/Footer.tsx` | 5 | 🟡 warn | Possible inactive or placeholder link (href="#" or empty). |
| `src/components/Footer.tsx` | 5 | 🟡 warn | Possible stale year in copy (rule: no old dates). Found: 2019 |

> 🔴 Blocking violations must be fixed before merge.
```

When there are no blocking findings, the footer instead reads that warnings are advisory and a design lead will triage them in the wiki.

### 5.4 The CLI check, precisely

`packages/cli/src/check.ts` is what actually runs in a hook or in CI. Flags: `--doc`, `--base <range>`, `--staged`, `--strict`, `--record`, `--reason <text>`, `--format <text|json|github>`, `--hook`, plus optional explicit paths.

Scope resolution: `--base` gives range mode, `--staged` gives staged mode, otherwise working tree. Explicit path arguments win over any diff. The doc ref comes from `--doc` or from `.blocksmith/blocksmith.json` via `resolveDocRef()`; missing gives **exit 2** with instructions.

For each changed UI file the CLI calls `client.governance.check(...)`, which POSTs to `/api/v1/governance/events` with the file's full contents. Note the difference from `validate:ui`: the CLI sends the whole file, not just added lines, because the server side prose rules need surrounding context to be meaningful.

If `--record` or `--ci` is set, a second call records an event. The action is chosen as:

```ts
const action = opts.reason
  ? (hasBlock ? "bypass" : "overridden")
  : "detected";
```

So: no reason means detected. A reason over warn tier only means overridden, a sanctioned choice. A reason over block tier means bypass, which still fails but is now audited with a name, a commit, a branch and a stated reason. That row appears in `GovernanceViolationsPanel` under Governance then Violations, where a lead can acknowledge or resolve it, and the audit trail stays.

Exit behaviour:

| Situation | Exit |
|---|---|
| No doc ref configured | 2 |
| `--format json` or `github`, any blocking findings | 1 |
| `--format json` or `github`, warnings only or clean | 0 |
| Text mode, blocking findings | 1, with "Blocking violations must be fixed. These never auto-pass." |
| Text mode, deviation budget exceeded | 1 |
| Text mode, user answers `c` at the prompt | 1 |
| Text mode, user answers `p` or `s` | 0, deviations submitted |
| The governance API threw (network, auth, server) | **0** |

That last row is a policy, not a bug. The comment reads: never block a push on infrastructure failure, fail open with a clear message. A governance tool that bricks pushes when our API has a bad afternoon gets uninstalled that same afternoon. `docs/GOVERNANCE-TIERS.md` states the same rule.

**One honest defect.** `--strict` is parsed into `CheckOptions.strict` and is never read anywhere in `check.ts`. `blocksmith setup hooks --strict` faithfully writes `--strict` into the generated hook, the docs describe strict mode as "Tier-2 warnings block until a `--reason` is given", and today the flag does nothing. Fix it or stop documenting it.

### 5.5 The git hooks path

**In this repository**, `.githooks/` holds a pre-commit and a post-commit hook, activated once per clone with `git config core.hooksPath .githooks`. The pre-commit hook runs a chain of verify scripts (`scan:verify`, `verify:scan-wiki`, `verify:vendor-e2e`, `verify:handshake-writeback`, `verify:handshake-acceptance`, `verify:sync-conflict`) and finishes with `governance:check`. Any non zero exit aborts the commit; the governance failure prints the `--no-verify` bypass hint. The post-commit hook appends real commit activity to the ledger via `activity:from-commit`.

**In a customer repository**, `blocksmith setup hooks --doc upload:scan-your-kit.md` installs a **pre-push** hook at `.git/hooks/pre-push`, and saves the doc ref to `.blocksmith/blocksmith.json` so the hook never needs the flag again. The generated body is fenced by markers:

```sh
# >>> blocksmith governance >>>
if command -v blocksmith >/dev/null 2>&1; then
  if git rev-parse --abbrev-ref @{u} >/dev/null 2>&1; then
    blocksmith check --base "@{u}..HEAD" --record --hook
  else
    blocksmith check --record --hook
  fi
  status=$?
  if [ "$status" -ne 0 ]; then
    echo "Push blocked by BlockSmith governance."
    ...
    exit "$status"
  fi
else
  echo "blocksmith CLI not found on PATH, skipping governance check."
fi
# <<< blocksmith governance <<<
```

Four decisions in that snippet are worth understanding:

- **Pre-push, not pre-commit.** The comparison is `@{u}..HEAD`, the commits actually being pushed, which is the right unit of review. Pre-commit is reserved for `--staged`.
- **Marker fenced and idempotent.** `mergeHook()` replaces the region between the markers if it exists, appends the region to a user authored hook if it does not (preserving their shebang), and creates the file if there is none. Re-running the command upgrades the hook. Deleting the block removes it.
- **`command -v blocksmith` guard.** If the CLI is not installed, the hook prints a line and lets the push through. A teammate who has not run `npm i -g` is not blocked from working.
- **The failure message names the three exits**: fix the errors, re-run interactively to override, or bypass once with `git push --no-verify`. Naming the bypass is what stops people from disabling the hook permanently.

---

## 6. Deviation and TTL

`docs/GOAL4-DEVIATION-TTL.md` is 554 lines. Its status table says everything is planned. **That status table is out of date.** A substantial amount of it is built. This section explains the design, then tells you exactly what runs.

### 6.1 Why sanctioned deviation is necessary

A governance system with only two states, compliant and blocked, fails in the field for one reason: real deadlines. An engineer needs to ship a red button for a holiday campaign at 6pm on a Friday. The design lead is offline. There are three possible systems:

1. **Block.** The engineer does not ship, or the engineer uninstalls the hook. In practice, always the second one.
2. **Allow silently.** The drift lands, nobody knows, the wiki becomes fiction, and the product is worthless.
3. **Allow with a record and an expiry.** The engineer ships, the system captures what changed, who changed it, why, and against which commit, and the design team reviews on their own clock.

Option 3 is the only one that survives contact with a real team, and it is what "sanctioned temporary deviation with a TTL" means: the deviation is legitimate, it is on the record, and it has a deadline attached to the *review*, not to the code.

The TTL default is 24 hours, and the default on expiry is **auto approve**, not auto reject. That direction is the important one. Auto reject would mean an unavailable design lead blocks engineering, which recreates option 1 with extra steps. Auto approve means silence is consent, engineering is never blocked by an empty queue, and the design team's attention is spent only on the deviations they actually care about.

### 6.2 The three layers as designed

**Layer 1, pre-push warning.** Catches roughly ninety percent, because most drift is accidental. The developer did not know the wiki said 8px. Shown the diff in their terminal, they fix it locally and no deviation is ever created. Only intentional deviations reach layer 2, which keeps the design team's queue clean.

**Layer 2, the TTL queue.** A conscious "push anyway" creates a deviation record with `status: "pending"` and an `expires_at`. The design team sees it in the wiki. They can Pass (approve), Rollback (reject, with a fix suggestion attached), or do nothing, in which case the TTL expires and it auto approves.

**Layer 3, progressive escalation.** Two numbers, configured once, that make the system tighten automatically on repeat behaviour rather than requiring a human to police anyone:

- **Deviation budget.** A developer may have at most `maxOpenPerDev` pending deviations (default 3). The fourth is refused until earlier ones are resolved. The doc frames this correctly: not a punishment, flow control.
- **Rejection escalation.** After `rejectionsBeforeBlock` rejections on the same block by the same developer (default 2), that one block is locked for them. Every other component keeps flowing.

### 6.3 What is actually built

**Built and wired:**

| Piece | Path |
|---|---|
| Deviation store, both Supabase and a local JSON fallback | `src/lib/cloud/deviations.ts`, local file at `data/cloud/deviations.json` |
| SQL schema | `supabase/schema-deviations.sql`, tables `blocksmith_deviations` and `org_governance_settings`, with indexes on `(org_id, status)`, `(pushed_by, status)`, a partial index on `expires_at where status = 'pending'`, and `(org_id, block_id, status)` |
| Create and list | `POST` and `GET /api/v1/deviations` |
| Review | `PATCH /api/v1/deviations/[id]` with `action` set to `pass`, `rollback` or `resolve`, plus an optional `fixSuggestion` |
| Budget check | `GET /api/v1/deviations/budget?pushedBy=...[&blockId=...]`, returning `openCount`, `maxOpen`, `remaining`, `budgetExceeded`, and when a block is named, `rejections`, `blockLocked`, `rejectionsBeforeBlock` |
| Settings | `GET` and `PATCH /api/v1/governance/settings`, admin or owner only, with bounds (`ttlHours` 1 to 720, `maxOpenPerDev` 1 to 50, `rejectionsBeforeBlock` 1 to 10) |
| Wiki queue UI | `src/components/wiki/DeviationsQueuePanel.tsx`, rendered on the Sync page, with Pass and Rollback buttons and a fix suggestion field |
| Settings UI | `src/components/wiki/GovernanceSettingsPanel.tsx`, also on the Sync page |
| SDK | `client.deviations.create / list / budget` in `packages/sdk/src/client.ts` |
| CLI integration | `packages/cli/src/check.ts` checks the budget before the interactive prompt and creates one deviation per warn tier finding after the user answers |
| Server side budget enforcement | `POST /api/v1/deviations` returns **429** with "You have N unreviewed deviations (max: M)" when `openCount >= settings.maxOpenPerDev` |

**Designed, not built:**

- **The TTL clock never ticks.** `autoApproveExpired()` exists in `src/lib/cloud/deviations.ts` and is correct. Nothing calls it. There is no cron, no scheduled function, no route, and no `pg_cron` job in `supabase/schema-deviations.sql` despite the doc showing one. Every pending deviation therefore stays pending forever. **This is the single most important gap in the chapter**, because "auto approves in 18h" is a promise the product currently makes in the UI and does not keep.
- **The interactive prompt is not the designed one.** The doc specifies `[f] fix / [p] push anyway / [s] skip`. The implementation asks "Push anyway (p), add a Reason/Fix (s), or Cancel (c)". There is no `f` branch that prints the wiki guideline, and no `s`-as-skip that records `skipped-governance`.
- **Approving a deviation does not touch the lock.** `approveDeviation()` flips a status column. It does not regenerate `blocksmith.lock`, does not promote a block, and does not write anything to the registry. The doc's promise that "the lock adopts the new value" is not implemented anywhere.
- **The deviation diff is a stand in.** `check.ts` builds `{ field: f.ruleId, wikiValue: f.ruleCitation ?? "guideline", pushedValue: f.snippet ?? "current code" }`. It is a rule id and a code snippet, not a real field level before and after. The doc's `{ field: "border-radius", wiki_value: "8px", pushed_value: "12px" }` requires numeric property extraction that does not exist (see section 4.2, limitation 8).
- **Rejection escalation is not enforced at push time.** The budget endpoint computes `blockLocked`, but `check.ts` calls `client.deviations.budget(pushedBy)` without a `blockId`, so the per block lock is never consulted.
- **`blocksmith updates` and `blocksmith fix <block-id>` do not exist.** The command list in `packages/cli/src/cli.ts` is `login`, `whoami`, `mcp-url`, `codegen`, `pull`, `scan`, `check`, `setup cursor`, `setup hooks`. Yet `check.ts` prints "Check status anytime with: blocksmith updates" after submitting deviations. We are telling users to run a command that is not there.
- **None of the `verify:deviation-*` scripts exist.** `docs/GOAL4-DEVIATION-TTL.md` lists `verify:deviation-ttl`, `verify:deviation-budget` and `verify:deviation-cli`. None are in `package.json`.

---

## 7. The governance copilot

### 7.1 What it does

`docs/GOAL2-GOVERNANCE-COPILOT.md` names the job: help design leads and product managers write governance prose in natural language, then finalize it into `DESIGN.md`. It is a writing assistant for policy, not a design generator.

The flow:

1. Open a scanned component page in the wiki, for example Button from `upload:scan-acme-ui-kit.md`.
2. Type intent in plain language into `GovernanceCopilotPanel`: "Primary CTA only on marketing pages, never two per view."
3. `POST /api/wiki/governance/draft` returns `{ role, description, rationale }`.
4. The panel shows the suggested role and rules plus a "Why" line, and an **Apply to draft** button, which only appears when the suggestion actually differs from the current governance. If it matches, the panel says so instead of offering a no-op.
5. Applying fills the fields in `ComponentGovernanceEditPanel`, which shows a live component preview from the repo scan on one side and a `DESIGN.md` preview of the section after save on the other.
6. Save draft goes through `POST /api/wiki/finalize`, which stages a draft. Promote is a separate human action on the Pipeline.
7. `blocksmith pull` writes the promoted text into `DESIGN.md` in the repo, which is what Cursor and other agents read.

The model call lives in `src/ai-lab/10-governance-copilot/draft.ts`, using the shared `parser` profile via `chatJsonWithProfile`, the same NVIDIA stack as scan curation. No new vendor.

### 7.2 What it is allowed to change

This is the guardrail table, and it is the reason the feature is defensible.

| Field | Copilot | Source of truth |
|---|---|---|
| Role (when to use) | May draft | Human finalizes |
| Description (do's and don'ts) | May draft | Human finalizes |
| Tokens, colors, CSS variables | Read only | Repository scan |
| Source file path, exports | Read only | Repository scan |
| Component variants and props | Read only | Repository scan |

### 7.3 The guardrails, in order of strength

**Structural.** The API returns exactly three string fields. `parseGovernanceDraft()` reads `role`, `description` and `rationale`, coerces each to a trimmed string or empty, and throws "Model returned empty role and description" if both are blank. There is no field in the response that could carry a hex value, a file path or a variant name into the system. Even a fully compromised model cannot change a token, because there is no channel for it to travel through. This is the guardrail that actually holds.

**Prompt level.** `GOVERNANCE_DRAFT_SYSTEM` in `src/ai-lab/10-governance-copilot/prompt.ts` states: you may only write governance; never invent or change code facts; do not invent CSS variables, hex colors, file paths, exports or variant names; if scan context is provided you may reference tokens and paths only when they appear in that context. Scan facts are injected under an explicit "read-only, do not contradict or invent beyond this" header, and they are truncated (12 CSS variables, 8 colors) to keep the prompt bounded.

**Access level.** The route calls `requireDocumentAccess(request, uploadFileNameFromRef(docRef))` with the default write action for upload docs. In strict mode, a request without a valid `upload:` docRef is rejected outright with 400. So the copilot cannot be used to probe another tenant's system.

**Availability level.** `governanceCopilotEnabled()` returns `isAiLabConfigured()`. With no `NVIDIA_API_KEY` the route returns **503** with a message naming the missing variable, and the wiki still allows manual editing. The AI is an accelerator, never a dependency.

**Process level.** The copilot never promotes. Its output lands in an edit field a human has to read, then in a draft a human has to promote. The stated non-goals are explicit: no editing Figma, no generating mockups, no changing scan facts, no multi-turn memory, and no auto-finalize without human review.

`npm run verify:governance-copilot` exercises the real model path with real scan context and asserts a non empty role and description, skipping cleanly with exit 0 when the key is absent. `npm run verify:governance-e2e` proves the rest of the loop without any model at all: finalize, pull, and assert the governance text appears in `DESIGN.md`.

---

## 8. Roles, and who may promote

### 8.1 The model

`src/lib/cloud/rbac.ts` is 37 lines.

```ts
export type OrgRole = "owner" | "admin" | "member" | "viewer";
const ROLE_RANK: Record<OrgRole, number> = { viewer: 1, member: 2, admin: 3, owner: 4 };
export function roleAtLeast(role: OrgRole, minimum: OrgRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}
```

`canPerform(role, action)` maps actions to minimum ranks:

| Action | Minimum role |
|---|---|
| `read` | viewer |
| `write` | member |
| `scan` | member |
| `manage_keys` | member |
| `manage_members` | admin |

### 8.2 How that gates promotion

Every mutating pipeline route funnels through `requireDocumentAccess(request, fileName, action)` in `src/lib/cloud/access.ts`, whose action defaults to `"write"`. `POST /api/wiki/promote`, `POST /api/wiki/rollback`, `POST /api/wiki/pin-lock` and `POST /api/wiki/finalize` all use it. `requireDocumentAccess` resolves the actor (session or API key), then calls `canAccessDocument(fileName, userId, { allowAdminKey, action })`, which:

1. Returns true for explicitly public content (`isPublicContent()`, the named demo plus bundled repo samples).
2. Returns true for a server trusted admin API key.
3. **Default denies** when no registry row answers "who owns this document".
4. Returns true for a published document, but only when the action is `read`.
5. Requires a `userId`, resolves the org role, and finishes with `canPerform(role, action)`.

Net effect: **a viewer can read the wiki and cannot promote.** The 403 message is written for a human: "Forbidden, your team role cannot modify this document (need member or above)."

Deviation review has its own, higher bar. `PATCH /api/v1/deviations/[id]` reads `settings.reviewRoles` (default `["admin", "owner"]`) and derives a minimum role, so Pass and Rollback are admin or owner by default while `resolve` is not gated. `PATCH /api/v1/governance/settings` requires `roleAtLeast(role, "admin")` unconditionally, with the message "Only admins and owners can change governance settings."

### 8.3 The rule that matters

From `docs/TEAM-NORTH-STAR.md`:

> Every user on the team sees the same wiki, shares the same promoted graph, pulls the same lock. Roles control who may promote, not separate packages.

Say that sentence to yourself before designing anything permission shaped. There is exactly **one** design graph per product, **one** `@blocksmith/<product>` package, and **one** `blocksmith.lock`. Roles decide who may move the official pointer. They never fork the artifact.

The alternative, per user or per role packages, is the seductive wrong answer, because it looks like a feature ("give designers a sandbox package"). It destroys the entire value proposition. The whole reason a lock is worth anything is that everyone resolves to the same pin. Two packages means two truths means drift, and we would have rebuilt the exact problem we sell the cure for.

### 8.4 Two honest caveats

**Local development bypasses everything.** `requireDocumentAccess` returns `{ ok: true, isAdmin: true }` immediately when `saasStrictMode()` is false, which is the default outside production. Never conclude "roles work" from a local test. Set `BLOCKSMITH_SAAS_STRICT=1` first.

**API key actors skip the deviation role check.** In `PATCH /api/v1/deviations/[id]`, the role branch only runs when `actorUserId(actor)` resolves to a user. An API key actor has no user id, so it passes through and can Pass or Rollback regardless of `reviewRoles`. Whether that is correct for CI automation is an open question; today it is unstated behaviour, which is worse than either answer.

The wider security picture, including the default deny fix, the middleware, and the route audit table, is in `docs/SECURITY-RELEASE-GATE.md`. `npm run verify:security-gate` asserts the load bearing parts: unregistered private docs deny for both anonymous and signed-in non-owners, the demo and bundled samples stay public, admin key bypass is preserved, `GET /api/wiki/import` returns 401 anonymously, and publish then unpublish opens and closes anonymous read while never opening write.

---

## 9. Drift as a first class concept

### 9.1 The definition

**Drift is a disagreement between two representations of the same design fact, where at least one of them is being used as truth by somebody.**

The last clause is what separates drift from a difference. A branch that has not been merged is not drift. A Figma frame nobody references is not drift. Drift is when an agent, a build, a CI gate or a human is *acting* on one representation while another representation says something else.

Three canonical sentences, each mapping to a different mechanism:

1. **"Figma says X, code says Y."** Ingest side drift. Two sources disagree about a fact.
2. **"Official says X, draft says Y."** Lifecycle drift. A change is staged but not promoted, so humans and agents are looking at different things on purpose.
3. **"Lock says X, registry says Y."** Deploy side drift. Production moved and a consumer has not caught up.

The system's job is to make all three visible, and to make the third one fail a build.

### 9.2 Every kind of drift we can detect today

| # | Drift | Detected by | Surfaced where |
|---|---|---|---|
| 1 | Lock graph hash differs from official graph hash (stale lock) | `verifyLock()` sets `stale` when `lock.contentHash !== registryHash` | `validate:ui` stage 1, `getLockStatus()`, `LockStatusCard`, Pipeline `LockStrip`, MCP `get_lockfile` and `get_sync_status` |
| 2 | A pinned block version no longer matches the official pointer | `verifyLock().versionMismatches` | Same, printed as "id: locked vN, official is vM" |
| 3 | A block is promoted but absent from the lock | `verifyLock().missingInLock` | Same, "promoted but not pinned" |
| 4 | A block is pinned but no longer promoted (rolled back or removed) | `verifyLock().missingInRegistry` | Same, "pinned but no longer promoted" |
| 5 | Same version pinned, different content hash (hand edited or corrupt lock) | `verifyLock().hashMismatches` | Same, "contentHash mismatch, lock corrupted or hand-edited" |
| 6 | No lock at all while promoted blocks exist (agents unpinned) | `validate:ui` stage 1 | CI failure, and `POST /api/wiki/pin-lock` is the fix |
| 7 | Off-token color in code versus the promoted palette | `color-lint.ts` | CI gate, MCP `validate_ui_code` and `check_governance_diff`, governed generate score |
| 8 | Prose drift versus promoted component rules | `prose-lint.ts`, three heuristics | CLI warn tier, wiki Violations feed |
| 9 | Draft diverges from official for a block | `buildReleaseTable()` `draftPending`, `buildPromoteDiffs()` field level | Releases table, `BlockReleaseStrip`, `PromoteDiffDrawer` with color swatches |
| 10 | A block vanished from its source | `recordIngest()` marks `stale` | Wiki banner, `listExcludedBlocks()` reason `"stale"`, MCP sync status |
| 11 | Two sources disagree on the same block id | ingest records `status: "conflict"` | Blocks promote, filtered from agent reads, resolvable in the Releases screen |
| 12 | Figma token versus code token, matched by CSS variable name | `computeTokenDrift()` in `src/lib/figma/drift.ts`, classifying each row as `match`, `mismatch`, `figma-only` or `code-only`, with hex and numeric insensitive comparison | Figma drift route and UI |
| 13 | Figma component versus code component, compared by name, variants and props | `src/lib/figma/component-drift.ts`, reading the embedded `<!-- blocksmith:interface {...} -->` IR the scan writes | Figma drift surfaces |
| 14 | Protocol drift: the app's hash implementation or schema copies diverging from the package | `npm run protocol:conformance` (suite plus drift gate) | `.github/workflows/protocol-conformance.yml`, a failing build |
| 15 | Ungoverned versus governed generation | `scoreDrift()` in `governed-generate.ts` | `/demo/investor`, the playground |

### 9.3 What we cannot detect yet

Say these out loud in customer calls before somebody discovers them.

- **Any non color property.** Radius, spacing, typography scale, shadow, z-index, motion. There is no numeric property extractor anywhere. The mock output in `docs/GOAL4-DEVIATION-TTL.md` showing `border-radius 8px → 12px` describes a feature that does not exist.
- **Non hex color syntax.** `hsl()`, `rgb()`, `oklch()`, named colors, and Tailwind utility classes all pass the gate untouched. See section 4.2.
- **File types outside the pathspec.** `validate:ui` and `governance:check` only diff `.ts`, `.tsx`, `.js`, `.jsx`, `.css`, `.scss`. Vue, Svelte, MDX, styled-components in `.mjs`, JSON theme files, and native mobile source are invisible.
- **Pre-existing violations.** The CI gate reads added diff lines only. A codebase that was never governed keeps every legacy violation until somebody touches that line. This is a deliberate adoption tradeoff, not an oversight, but it means "0 violations" does not mean "compliant codebase".
- **Semantic component misuse.** "Never two primary CTAs per view", "primary CTA only on marketing pages": these are exactly the rules customers most want enforced, and `prose-lint.ts` cannot express them. It matches keywords in prose against regexes on single lines. It has no AST, no render tree, and no notion of a view.
- **Rendered drift.** Nothing compares a screenshot, a computed style, or a DOM tree against the design system. All checking is static and textual.
- **Drift inside the lock's own values.** This one is subtle and worth internalising: `validate:ui` stage 2 builds its palette from `loadDocForAiLab(args.doc)`, which is the **current** design system, not the palette implied by the pinned versions in `blocksmith.lock`. So stage 1 can report a stale lock while stage 2 checks colors against the newer palette. The two stages can disagree about which version of truth they are enforcing. Fixing this means resolving the palette from the locked blocks, and nobody has done it.
- **Cross document drift.** Two products in the same org that share a brand color have no relationship in the model. Each doc is an island with its own registry, lock and package.
- **Drift introduced outside git.** Anything applied by a CMS, a feature flag, a runtime theme switch, or a design token pushed straight to a CDN is outside every gate we have.

---

## 10. Honest status table

Vocabulary per `docs/constitution/STYLE.md`: **Shipped** means built, in the repo, and covered by a verify script or manually proven. **Built, unproven** means the code exists but has never run against a real external input. **Partial** means some paths work and others are stubs. **Planned** means designed on paper with no code. **Idea** means not designed, listed so it is not lost.

### 10.1 The engine

| Capability | Status | Evidence |
|---|---|---|
| Append only version registry, official pointer | Shipped | `src/lib/ir/registry.ts`, `npm run verify:ir-cicd` |
| Canonical block and graph hashing | Shipped | `src/lib/ir/hash.ts`, `npm run protocol:conformance` plus drift gate in CI |
| Truth precedence (scan facts auto promote, prose stages) | Shipped | `recordIngest()`, asserted by `verify:ir-cicd` |
| Deterministic `blocksmith.lock` build | Shipped | `buildLock()`, "same graph gives same lock hash" assertion |
| Lock verification (stale, version, missing, hash mismatch) | Shipped | `verifyLock()`, `verify:ir-cicd` |
| Promote, batch promote, conflict resolve | Shipped | `promoteBlock()`, `resolveConflict()`, `POST /api/wiki/promote` |
| Rollback to previous finalized version | Shipped | `rollbackBlock()`, `POST /api/wiki/rollback`, `verify:ir-cicd` |
| Pin lock when everything auto promoted | Shipped | `POST /api/wiki/pin-lock` |
| Agent enforcement (official only, drafts and conflicts filtered) | Shipped | `listGovernedBlocks()`, `listExcludedBlocks()`, `verify:ir-cicd`, `npm run verify:mcp-sync` |
| Append only run log with per stage results | Shipped | `pipeline-runs.ts`, `pipeline-stages.ts`, Pipeline console |
| Supabase mirror and cold start hydration of the registry | Partial | `cloud-registry.ts` is env gated; requires `supabase/schema-registry.sql` to be applied, and promote degrades loudly rather than failing when it is not |
| Per doc reference locks | Shipped | `.blocksmith/locks/<docKey>.lock`, legacy path mirrored |

### 10.2 The lint and gate

| Capability | Status | Evidence |
|---|---|---|
| Off-token hex detection, exact | Shipped | `color-lint.ts`, `verify:governance-tiers` |
| Nearest token suggestion (sRGB squared distance) | Shipped | `nearestToken()`, asserted in `verify:governance-tiers` |
| Prose rules compiled from promoted governance (3 heuristics) | Shipped | `prose-lint.ts`, `verify:governance-tiers` |
| One engine across CI, MCP and generate | Shipped | Import graph: `validate-ui.ts`, `mcp/handlers.ts`, `governed-generate.ts` all import `color-lint.ts` |
| `validate:ui` two stage gate with exit codes | Shipped | `scripts/validate-ui.ts`, `.github/workflows/validate-ui.yml` |
| `governance:check` colour only gate | Shipped | `scripts/governance-gate.ts`, wired into `.githooks/pre-commit` |
| `blocksmith check` against the hosted API | Shipped | `packages/cli/src/check.ts`, `POST /api/v1/governance/events` |
| Pre-push hook installer, marker fenced and idempotent | Shipped | `packages/cli/src/setup-hooks.ts` |
| Customer CI workflow with sticky PR comment | Built, unproven | `examples/github/blocksmith-governance.yml` exists; no evidence in the repo of it running on an external customer repository |
| Governance event capture, feed, acknowledge and resolve | Shipped | `/api/v1/governance/events`, `GovernanceViolationsPanel`, `verify:governance-tiers` |
| `--strict` mode (warnings block until a reason is given) | **Planned** | Flag is parsed and documented; never read in `check.ts` |
| Rule engine driven by governance IR (tiers doc v2) | Planned | Named in `docs/GOVERNANCE-TIERS.md`, no code |
| LLM gate on the diff (tiers doc v3, enterprise strict mode) | Idea | Named, not designed |
| Numeric property checking (radius, spacing, type) | Planned | Required by the deviation design, no code |
| Non hex color syntax support | Idea | Listed here so it is not lost |
| Palette resolved from the lock rather than the live doc | Idea | See section 9.3 |

### 10.3 Deviation and TTL

| Capability | Status | Evidence |
|---|---|---|
| Deviation store, Supabase plus local fallback | Shipped | `src/lib/cloud/deviations.ts`, `supabase/schema-deviations.sql` |
| Create, list, review (pass, rollback, resolve) | Shipped | `/api/v1/deviations`, `/api/v1/deviations/[id]` |
| Budget check endpoint and server side 429 | Shipped | `/api/v1/deviations/budget`, `POST /api/v1/deviations` |
| Org governance settings with bounds and RBAC | Shipped | `/api/v1/governance/settings`, `GovernanceSettingsPanel` |
| Wiki deviations queue with Pass and Rollback | Shipped | `DeviationsQueuePanel` on the Sync page |
| CLI interactive prompt and deviation submission | Partial | Implemented as push / reason / cancel, not the designed fix / push / skip; no `f` branch printing the guideline |
| Budget enforcement at push time | Partial | Open count is enforced; per block rejection lock is computed by the API but never requested by the CLI |
| TTL auto approve on expiry | **Partial** | `autoApproveExpired()` is implemented and **never called**. No cron, no route, no `pg_cron` job. The countdown shown in the UI does not resolve |
| Approving a deviation updates the lock | **Planned** | `approveDeviation()` only flips a status column |
| Field level deviation diff | Planned | Currently rule id plus snippet |
| `blocksmith updates` | **Planned** | Not a command, yet referenced in CLI output |
| `blocksmith fix <block-id>` | Planned | Not a command |
| `verify:deviation-ttl`, `-budget`, `-cli` | Planned | Not in `package.json` |
| Design Alignment percentage metric | Planned | UI mock only |

### 10.4 Copilot, roles, drift

| Capability | Status | Evidence |
|---|---|---|
| Governance copilot draft (role, description, rationale) | Shipped | `src/ai-lab/10-governance-copilot/`, `POST /api/wiki/governance/draft`, `npm run verify:governance-copilot` (skips without a key) |
| Copilot cannot write code facts | Shipped | Three field response contract, enforced by `parseGovernanceDraft()` |
| Copilot to finalize to pull to `DESIGN.md` | Shipped | `npm run verify:governance-e2e`, no model required |
| Copilot graceful degradation without a key | Shipped | 503 with a named variable, manual edit path intact |
| RBAC model and rank comparison | Shipped | `src/lib/cloud/rbac.ts`, `npm run verify:org-rbac` |
| Promote gated on member or above | Shipped | `requireDocumentAccess(..., "write")` on promote, rollback, pin-lock, finalize |
| Deviation review gated on admin or owner | Partial | Enforced for user actors, skipped for API key actors |
| Role aware UI (viewer sees promote disabled with a reason) | Partial | `ReleaseRow.canPromote` is a lifecycle flag (draft pending or conflict), not a permission flag; T2 in `docs/SECURITY-RELEASE-GATE.md` is still open |
| Lock and version drift detection | Shipped | `verifyLock()`, `validate:ui`, `verify:ir-cicd` |
| Figma versus code token and component drift | Built, unproven | `src/lib/figma/drift.ts`, `component-drift.ts`, `npm run verify:figma-import`; no real customer Figma file proven end to end |
| Protocol drift gate | Shipped | `npm run protocol:conformance`, `.github/workflows/protocol-conformance.yml` |
| Governed versus ungoverned drift score | Shipped | `governed-generate.ts`, `/demo/investor` |
| Two week team evaluation (R5) | Planned | `docs/IR-CICD-IMPLEMENTATION.md` marks R5 as next |

---

## Open questions

1. **Who runs the TTL clock?** `autoApproveExpired()` needs a caller. The choices are a `pg_cron` job in Supabase (matching the design doc), a Vercel cron route, or lazy expiry evaluated on every read of the deviations list. Lazy expiry is the cheapest and has no infrastructure dependency, but it means a deviation only auto approves when somebody looks at the queue, which is philosophically wrong for a deadline. Until this is answered, the countdown in the UI is a promise we break.

2. **Should approving a deviation move the official pointer?** Today it flips a status. The design doc says the lock adopts the new value. But the deviation record does not carry enough information to construct a new block version (see the diff limitation), so implementing it honestly means first implementing field level extraction. Is that the next thing to build, or do we redefine Pass as "acknowledged, no code change" and stop promising a lock update?

3. **Which palette should the CI gate check against, the live doc or the lock?** Checking against the live doc means the gate is stricter than the pin and can fail code that is correct for the pinned version. Checking against the lock means a promoted color is not enforceable until every consumer pulls. The current behaviour (live doc) is probably right for adoption and definitely wrong for the claim "your CI enforces exactly what you pinned".

4. **How far do we push prose rules before switching approaches?** Three keyword heuristics cannot express "never two primary CTAs per view". The tiers doc names a rule engine (v2) and an LLM gate (v3). An LLM gate at warn tier is defensible; at block tier it destroys the property that makes the block tier trustworthy, which is exactness. Where is the line?

5. **Should API key actors be allowed to pass or rollback deviations?** Today they can, because the role check only runs for user actors. Either that is a deliberate CI automation affordance and should be documented and scoped per key, or it is a hole.

6. **What is the second property after color?** Radius and spacing are the obvious candidates and both need a parser that understands CSS and inline style objects. Until one lands, every conversation about "design governance" is really a conversation about colors, and a sharp customer will notice within ten minutes.

7. **Do we ever enforce on existing code, not only on added lines?** A "governance debt" report over the whole tree would be a strong onboarding artifact (here are your 412 off-token colors) and a terrible gate. Different feature, same engine, worth building separately.

8. **When does `--strict` become real?** It is documented, installed by the hook installer, and inert. The cheapest honest fix is to delete it from the docs and the installer; the better fix is to implement it.

---

## Where to look in the code

**The lint engine (read first).**

```
src/lib/governance/color-lint.ts     normalizeHex, paletteFromColors, scanLine,
                                     findOffTokenColors, nearestToken
src/lib/governance/prose-lint.ts     compileProseRules, scanProseViolations
src/lib/governance/check-diff.ts     checkGovernanceDiff, combines both tiers
src/lib/governance/types.ts          GovernanceFinding, GovernanceEvent, tiers
```

**The IR and the lifecycle.**

```
src/lib/ir/types.ts                  BlocksmithBlockV1, BlocksmithLockV1, registry records
src/lib/ir/hash.ts                   canonical block and graph hashing
src/lib/ir/registry.ts               recordIngest, promoteBlock, rollbackBlock,
                                     resolveConflict, getOfficialBlocks
src/lib/ir/lock.ts                   buildLock, writeReferenceLock, readLock, verifyLock
src/lib/ir/enforce.ts                listGovernedBlocks, listExcludedBlocks, getLockStatus
src/lib/ir/releases.ts               buildReleaseTable, packageNameForDoc
src/lib/ir/diff.ts                   buildPromoteDiffs (production versus staging)
src/lib/ir/pipeline-runs.ts          append only run log
src/lib/ir/pipeline-stages.ts        stage ids and per action stage builders
src/lib/ir/cloud-registry.ts         Supabase mirror and hydration
```

**Routes.**

```
src/app/api/wiki/finalize/route.ts        stage a draft (409 on content hash conflict)
src/app/api/wiki/promote/route.ts         the human gate, batch, regenerates the lock
src/app/api/wiki/rollback/route.ts        pointer back, lock regenerated
src/app/api/wiki/pin-lock/route.ts        fix the "all live, no lock" dead end
src/app/api/v1/governance/events/route.ts detect, record, list, resolve
src/app/api/wiki/governance/draft/route.ts copilot draft
src/app/api/wiki/governance/violations/route.ts wiki violations feed
src/app/api/v1/deviations/route.ts        create and list deviations
src/app/api/v1/deviations/[id]/route.ts   pass, rollback, resolve
src/app/api/v1/deviations/budget/route.ts budget and rejection escalation
src/app/api/v1/governance/settings/route.ts TTL and budget configuration
src/app/api/v1/lock/route.ts              lock artifact, format=file
src/app/api/v1/scans/pull/route.ts        pull returns DESIGN.md plus lock
```

**Gates and scripts.**

```
scripts/validate-ui.ts               the CI gate: lock freshness plus off-token diff
scripts/governance-gate.ts           colour only pre-commit gate
scripts/verify-ir-cicd.ts            closed loop proof: ingest, stage, promote, lock,
                                     enforce, rollback, stale, compile
scripts/verify-governance-tiers.ts   detect, capture, feed, resolve across both tiers
scripts/verify-governance-e2e.ts     finalize, pull, DESIGN.md (no model needed)
scripts/verify-governance-copilot.ts model path, skips without NVIDIA_API_KEY
scripts/verify-security-gate.ts      default deny, import list lockdown, publish toggle
scripts/verify-modify-tokens.ts      markdown writeback round trip through the parser
```

**CLI and SDK.**

```
packages/cli/src/check.ts            blocksmith check: scope, record, budget, prompts
packages/cli/src/setup-hooks.ts      pre-push hook installer (marker fenced)
packages/cli/src/pull.ts             writes DESIGN.md, wiki-overrides.json, blocksmith.lock
packages/cli/src/cli.ts              the real command list
packages/sdk/src/client.ts           governance.check, deviations.create/list/budget
```

**Agent surfaces.**

```
src/lib/mcp/blocksmith-server.ts     tool definitions, server instructions,
                                     the tier 3 "## Next" renderer
src/mcp/handlers.ts                  handleValidateUiCode, handleCheckGovernanceDiff
src/lib/ai/governed-generate.ts      scoreDrift, the governed versus ungoverned engine
```

**Wiki control plane.**

```
src/components/wiki/GovernanceCopilotPanel.tsx      prompt to draft, apply to draft
src/components/wiki/ComponentGovernanceEditPanel.tsx edit plus live preview plus DESIGN.md preview
src/components/wiki/GovernanceViolationsPanel.tsx   the design lead's feed
src/components/wiki/DeviationsQueuePanel.tsx        pending, pass, rollback, resolved
src/components/wiki/GovernanceSettingsPanel.tsx     TTL, budgets, review roles
src/components/wiki/LockStatusCard.tsx              lock freshness on Sync
src/components/wiki/BlockReleaseStrip.tsx           "live v3, draft v4" on block pages
src/components/wiki/pages/PipelinePage.tsx          the Pipeline console
src/components/wiki/pages/ReleasesPage.tsx          the release console
src/components/wiki/pipeline/PromoteDiffDrawer.tsx  required review before promote
```

**Access control.**

```
src/lib/cloud/rbac.ts                OrgRole, roleAtLeast, canPerform
src/lib/cloud/access.ts              requireDocumentAccess
src/lib/cloud/documents.ts           canAccessDocument (default deny)
src/lib/cloud/deviations.ts          deviation and settings store
src/middleware.ts                    coarse credential check on API surfaces
```

**Automation.**

```
.githooks/pre-commit                 verify chain plus governance:check (this repo)
.github/workflows/validate-ui.yml    the script based gate
.github/workflows/protocol-conformance.yml  hash and schema drift gate
.github/workflows/production-goals.yml      post deploy public route checks
examples/github/blocksmith-governance.yml   the CLI based gate for a customer repo
supabase/schema-deviations.sql       deviation and settings tables
supabase/schema-registry.sql         durable registry mirror
```

**Source documents behind this chapter.**

```
docs/TEAM-NORTH-STAR.md              the alignment contract, the Jenkins mapping
docs/DESIGN-CICD.md                  the pipeline table and the lock sketch
docs/GOVERNANCE-TIERS.md             tier definitions, commands, exit codes
docs/GOAL2-GOVERNANCE-COPILOT.md     copilot scope and guardrails
docs/GOAL4-DEVIATION-TTL.md          deviation TTL design (status table is stale)
docs/PROTOCOL-GOVERNANCE.md          hash law, schema policy, who decides what
docs/IR-CICD-IMPLEMENTATION.md       the engineering runbook for the engine
docs/SECURITY-RELEASE-GATE.md        identity, default deny, route audit
```
