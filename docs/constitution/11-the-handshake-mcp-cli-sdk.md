# The Handshake: MCP, CLI, SDK, And Two-Way Sync

**What this chapter covers.** Everything that connects BlockSmith to the world outside its own Next.js app: the customer's git repository, their editor, their coding agents, and their CI. That means the file watcher and the sync bus, the `/api/sync/*` and `/api/v1/*` HTTP surface, the MCP server and all sixteen of its tools, the `@block-smith/cli` npm package, the `@blocksmith/sdk` client, machine authentication with `bs_live_` API keys, the four different things this codebase calls a "conflict", and the open-core packaging boundary.

**Why it matters.** BlockSmith's whole claim is that the wiki and the repo are two views of one truth. If that claim fails, the product degrades into a prettier documentation generator, and documentation generators lose to reality inside a quarter. The handshake is the mechanism that makes the claim true. It is also the only part of the system a customer touches with their own hands: they install a CLI, they paste an MCP config, they run a pull. Everything else they experience through a browser. If the handshake is awkward, nothing else gets a chance.

**Read this if** you are about to change any route under `src/app/api/`, add or rename an MCP tool, ship a new CLI command, publish a package to npm, or explain to a customer on a call how their repo and the wiki stay in agreement.

---

## 1. Why a handshake and not an export

### 1.1 The thing we deliberately did not build

The obvious version of this product is a one-way generator. Point it at a repo, parse the components and tokens, render a pretty documentation site. There are many of those. They all share one failure mode, and it is fatal.

A generated site is a photograph. The moment it is taken it begins to age. A developer adds a `ghost` variant to `Button.tsx` and the site is wrong. A design lead writes "primary CTA only, maximum one per view" into the site and the repo never learns it, so the next agent that writes UI has no idea the rule exists. Both sides drift, and because neither side knows it has drifted, nobody notices until a designer files a bug that turns out to be a documentation bug.

The deeper problem is that the two sides are authoritative about different things, and neither is authoritative about everything:

| Fact | Who is right |
|------|--------------|
| Which props `Button` actually accepts | The repo. Code is the only honest source for structure. |
| What hex `#d97757` is bound to | The repo. Tokens are shipped, not aspirational. |
| Whether `Button` may appear twice in a view | The human. This is judgement, and it lives nowhere in the code. |
| Which version of a rule agents are allowed to act on | The human, explicitly, by promoting it. |

A one-way generator can only carry the first two rows. A one-way authoring tool (write your rules in a web app, hope engineers read them) can only carry the last two. BlockSmith needs all four rows in one graph, which forces a peer relationship: each side writes into the shared graph, each side reads the whole graph back.

`docs/08-web-ide-handshake.md` states the requirement in one line, and it is worth taking literally:

> Any change finalized on either side appears on both.

### 1.2 Why "shows on both sides" is a requirement, not a nicety

Three reasons, in increasing order of importance.

**Trust.** A design system is a coordination artifact. Its value is entirely a function of how much people believe it. The first time an engineer discovers the wiki says one thing and the repo says another, the wiki stops being consulted, permanently. There is no partial credit here.

**Agents.** This is the reason that did not exist five years ago and is now the whole business. A coding agent asked to "add a settings panel" will invent colors unless something authoritative stops it. The only way to stop it is to hand it the design system inside its own tool loop, and the only way that is safe is if what it reads is what a human actually approved. A one-way export cannot do this because it has no notion of approval, only of freshness. See [Chapter 07](./07-design-ir-and-blocks.md) for the block and version model this depends on.

**The lock.** BlockSmith models design the way npm models dependencies: `blocksmith.lock` pins each block id to an exact version and content hash. A lock file is meaningless without a two-way relationship. It only means something if the repo holds a copy, the server holds the reference, and either can detect that the other moved. Half a handshake gives you a lock nobody can verify.

### 1.3 The shape of the peer relationship

There are exactly two directions, and they are not symmetric.

```
IDE ──────────── save / scan ────────────▶ Web
    (facts: components, colors, variants)

Web ─────────── finalize + promote ──────▶ IDE
    (judgement: roles, rules, pinned versions)
```

IDE to Web is automatic and immediate. Code changed, therefore the facts changed, therefore the wiki is wrong until it re-reads. There is no approval step because there is nothing to approve: the code already shipped.

Web to IDE is gated. A human editing prose in a browser produces a draft, and a draft is not truth. The gate is `promote`, and it exists because the alternative (every keystroke in the wiki instantly reaching every agent) is how you ship half-written rules to production. The code comment in `src/app/api/wiki/finalize/route.ts` is blunt about it:

> Production (and the lock, and agents) stay untouched until someone promotes on Pipeline. That separation is the product.

Hold onto that asymmetry. Most of the confusing behaviour in this chapter follows from it.

---

## 2. Vocabulary you need before the call sequences

Five terms. Everything below uses them.

**Doc ref.** The identifier for one design system document. Two shapes exist. A repo doc is a bare filename resolved under `docs/designs.md/`, for example `apollo.md`. An uploaded or scanned doc is prefixed, for example `upload:scan-acme-ui-kit.md`, and resolves under `data/uploads/`. Everything in the handshake that matters (scan, pull, governance check, drift) requires the `upload:` form; several routes reject the bare form explicitly. The resolver is `src/lib/uploads/store.ts` (`isUploadDocRef`, `uploadFileNameFromRef`) and `src/lib/clients/registry.ts`.

**Doc ref resolution order (agent side).** `src/mcp/handlers.ts` exports `resolveDocRef`, which picks, in order: the explicit `doc` argument, then `process.env.BLOCKSMITH_DOC`, then `getDefaultDocFileName()`. This is why the MCP config carries `BLOCKSMITH_DOC` and why an agent can call `get_design_tokens()` with no arguments at all.

**Block.** One addressable unit of the design system: `component:primary-pill-button`, `token:color:accent`. Blocks have a type, a title, a content object, a content hash, a status, and a version.

**Official / promoted.** A block version that a human moved to production. `src/lib/ir/enforce.ts` exports `listGovernedBlocks(docRef)`, which returns official versions only and explicitly drops anything whose status is `draft` or `conflict`. Its header comment names the rule: "Agents never read drafts."

**Lock.** `blocksmith.lock`, built by `src/lib/ir/lock.ts` from the official graph. It maps block id to version plus content hash, and carries a graph-level `contentHash`. The server keeps a reference copy; the customer repo keeps a pulled copy; `verifyLock` compares them and reports drift.

Where the artifacts physically live:

```
BlockSmith server
  data/uploads/<doc>.md                   scanned or imported markdown (the doc)
  data/uploads/<doc>.wiki-overrides.json  human-finalized prose sidecar
  data/cloud/api-keys.json                API keys (local dev / non-Supabase)
  .blocksmith/                            block store, registry, activity, ref lock

Customer repo (written by `blocksmith pull`)
  DESIGN.md                               full design system export, governance merged
  .blocksmith/wiki-overrides.json         structured overrides, survives rescan
  .blocksmith/blocksmith.json             repo config: which doc this repo governs against
  blocksmith.lock                         pinned block versions for CI and agents
  .git/hooks/pre-push                     governance gate (from `setup hooks`)
  .cursor/mcp.json                        MCP transport (from `setup cursor`)

Developer machine
  ~/.blocksmith/config.json               { apiKey, baseUrl }
```

---

## 3. Direction A in detail: IDE to Web

Three transports exist for this direction, because three deployment situations exist. Only one of them is the local file watcher, and on the hosted product the watcher is largely irrelevant. Know all three.

### 3.1 Path A1: the local file watcher (dev machine, `npm run dev`)

`src/lib/sync/watcher.ts` is a chokidar singleton stored on `globalThis` so it survives Next.js hot reloads. It starts lazily: `startWatcher()` is called by `GET /api/sync/status` and by `GET /api/sync/events`, so simply opening the wiki arms it.

It runs two watchers.

The **document watcher** covers `docs/designs.md/` and `data/uploads/`, ignoring everything that is not `.md`, with `awaitWriteFinish` set to a 200 ms stability threshold so a half-written file never triggers a parse. On `add` or `change` it maps the path back to a doc ref (`docRefFromPath`, which refuses `README.md` and refuses nested paths), debounces 300 ms per doc ref, then does three things: `clearDesignSystemCache()`, `loadDesignSystem(docRef)` to force a re-parse, and `syncBus.emitSync({ type: "blocks.updated", docRef, filePath, timestamp })`.

The **workspace watcher** (`startWorkspaceWatcher`) is the interesting one. It resolves the workspace root, takes `defaultScanRoots()` under it, and watches `.tsx`, `.jsx`, `.css`, `.scss`. On any change it debounces 2000 ms and then runs a full `scanAndPersist(workspaceRoot)`, which rewrites the scan markdown, clears the cache, and emits the same `blocks.updated` event. Set `BLOCKSMITH_SCAN_WATCH=0` to disable it. This is the literal "save `Button.tsx`, wiki updates" loop from the pitch.

The event bus is `src/lib/sync/events.ts`. It is deliberately transport-free: a typed wrapper around Node's `EventEmitter` with `setMaxListeners(50)`, again a `globalThis` singleton. `emitSync` does two things, in-process emit and a fire-and-forget publish to Supabase Realtime broadcast on channel `blocksmith:sync` (constant `REALTIME_CHANNEL`), guarded on `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` being present. The second exists because on Vercel each request may be a different lambda, so an in-process EventEmitter reaches nobody. Failures are warned and swallowed.

The browser subscribes over Server-Sent Events at `GET /api/sync/events` (`src/app/api/sync/events/route.ts`, `runtime = "nodejs"`). It emits a `{"type":"connected"}` frame immediately, forwards every `SyncEvent` as a `data:` line, and sends a `: heartbeat` comment every 30 seconds. Headers include `X-Accel-Buffering: no` so nginx-style proxies do not swallow the stream.

Full sequence for a code save on a dev machine:

```
1. developer saves src/components/ui/Button.tsx
2. chokidar (workspace watcher) fires, 2000 ms debounce
3. scanAndPersist(workspaceRoot)
      → rewrites data/uploads/scan-<project>.md
      → new frontmatter: scanned-at, scan-facts-hash, inventory-tsx, featured-components
4. clearDesignSystemCache(); loadDesignSystem(docRef)
5. syncBus.emitSync({ type: "blocks.updated", docRef, filePath, timestamp })
      → in-process listeners  → SSE frame to every open wiki tab
      → Supabase broadcast    → other lambdas / other browsers
6. wiki refetches; the Button page shows the new variant
```

There is no authentication on `GET /api/sync/events` or `GET /api/sync/status`. They are dev-surface routes. Treat that as a known gap, not a design.

### 3.2 Path A2: the CLI upload (customer laptop, hosted server)

The watcher cannot help a hosted deployment, because the server has no access to the customer's disk. `blocksmith scan <path>` closes that gap by doing the scan client-side and uploading only the result.

`packages/cli/src/scan-local.ts` locates a BlockSmith checkout (via `BLOCKSMITH_ROOT`, or by walking up to ten parent directories looking for `scripts/scan-client.ts`), shells out to `npx tsx scripts/scan-client.ts --workspace <abs>` with `AI_LAB_SCAN_CURATE=0`, and parses the last stdout line as JSON. That payload is `ClientScanPayload`:

```jsonc
{
  "markdown": "...",          // the whole scan document
  "fileName": "scan-acme-ui-kit.md",
  "projectName": "acme-ui-kit",
  "workspaceRoot": "/Users/dev/acme",
  "scannedAt": "2026-08-16T...",
  "colors": 24, "components": 11, "reactFiles": 87,
  "filesScanned": 210, "curated": false
}
```

It is then posted:

```
POST /api/v1/scans
Authorization: Bearer bs_live_…
Content-Type: application/json

{ "clientScan": { ...ClientScanPayload } }
```

The route (`src/app/api/v1/scans/route.ts`) authenticates the key, applies `scanRateLimitForApiKey(keyId)` (429 with a `Retry-After` header when exceeded), runs `runScanApi(body, origin)`, and then calls `registerScanOwnership(result, actor, scanMode, github)` so the document belongs to the key's user in the multi-tenant document registry. The response is `ScanCreateResponse`: `docRef`, `fileName`, `wikiUrl`, `wikiPath`, `workspaceRoot`, `projectName`, `scannedAt`, counts, `scanMode`, optional `githubUrl`, plus the key prefix.

Note the honest limitation, which the CLI's own error message states: `blocksmith scan <localPath>` requires a BlockSmith checkout on the machine. It is not self-contained. The zero-setup alternatives are `--fixture vendor` (demo, scanned on the server) and `--github org/repo` (server shallow-clones a public repo).

### 3.3 Path A3: server-side rescan

Two routes refresh an existing scan doc in place.

`POST /api/sync/rescan` with `{ "doc": "upload:scan-….md" }` reads the workspace root out of the doc's frontmatter and refuses unless `isAllowedServerWorkspacePath(workspaceRoot)` passes (in practice: fixtures and local dev). Its 403 message is the product's honest answer to "why can't the server just re-read my repo": run `blocksmith scan /path/to/repo` locally, or re-scan from GitHub.

`POST /api/sync/github-rescan` with the same body handles the hosted case. It requires `github-repo` in the doc frontmatter and a live GitHub session (`getGithubSession()`), shallow-clones with the session's provider token, runs `scanAndPersist` with `fileNameOverride` so the doc ref is stable, and cleans up the clone in a `finally`. `maxDuration = 60`.

Both require `requireDocumentAccess(request, fileName)`.

### 3.4 How the wiki knows it is out of date

Staleness is computed, not tracked. `src/lib/scan/sync-status.ts` exports `getWorkspaceScanSyncStatus(publishedMarkdown)`, which returns:

```ts
{
  isWorkspaceScan, workspaceRoot, githubRepo,
  stale,                 // publishedFactsHash !== liveFactsHash
  hostedRefreshOnly,     // server cannot read this path at all
  refreshHint,           // "server-rescan" | "cli-rescan" | "github-rescan" | null
  publishedFactsHash,    // scan-facts-hash from frontmatter
  liveFactsHash,         // scanResultFingerprint(scanWorkspace(root)) right now
  scannedAt, reactFiles, featuredComponents
}
```

The logic branches carefully. If the doc is not a workspace scan, nothing is stale. If there is no workspace root, nothing is stale. If the server cannot rescan that path, `stale` is forced to `false` and `hostedRefreshOnly` is `true`, with `refreshHint` set to `github-rescan` when the doc knows its repo and `cli-rescan` otherwise. Only when the server can actually re-read the directory does it perform a live scan and compare fingerprints. This is why a hosted customer never sees a false "stale" banner they cannot act on.

Three surfaces read this: `GET /api/sync/status?doc=` (watcher plus block store plus system hash plus `workspaceScan`), `GET /api/sync/scan-status?doc=` (just the scan status), and the MCP tool `get_sync_status`, which additionally attaches an `mcpNote` string telling the agent in plain language what to do about it.

---

## 4. Direction B in detail: Web to IDE

This is the half that makes BlockSmith a peer rather than a viewer. It has four steps, and only the first two are usually understood on a first read.

### 4.1 Step 1: finalize (save to staging)

```
POST /api/wiki/finalize
Content-Type: application/json

{
  "doc": "upload:scan-acme-ui-kit.md",
  "blockId": "component:button",
  "updatedData": { "role": "Primary CTA for vendor flows", "description": "Use for main actions only. Min width 120px." },
  "baseContentHash": "a1b2c3d4e5f60718",
  "force": false,
  "promote": false
}
```

`src/app/api/wiki/finalize/route.ts` does the following, in order:

1. Validates `doc`, `blockId`, `updatedData`.
2. Rate limits on `pipeline:write:<clientIp>`, default 120 writes per 10 minutes, tunable with `BLOCKSMITH_PIPELINE_RATE_LIMIT`.
3. For `upload:` docs, `requireDocumentAccess(request, fileName)` (write action).
4. Reads the current markdown and hashes it: sha256, hex, first 16 characters.
5. **The conflict gate.** If `baseContentHash` was supplied and does not match, and `force` is not set, it returns `409` with `{ error: "Conflict", message: "This document has been modified in the IDE since you started editing.", currentHash }`.
6. `modifyMarkdownBlock(currentMd, blockId, updatedData)` and persists.
7. If the block is a component and the doc frontmatter says `blocksmith-source: workspace-scan`, it writes the prose to two sidecars: the cloud sidecar via `setUploadComponentOverride(fileName, componentId, { role, description })`, and, when the workspace path is server-readable, the local vendor sidecar via `setComponentOverride(workspaceRoot, ...)`.
8. `clearDesignSystemCache()`.
9. `refreshBlocksForDoc(doc, "web")`. The `"web"` edit origin is what makes the re-ingest record a **draft** version rather than a promotion.
10. Only if `promote === true`: `promoteBlock(doc, blockId)`, `writeReferenceLock(doc)`, and `await syncLockToCloud(doc, lock)`. The `await` is deliberate: the lock must reach Supabase before the response, because a frozen lambda drops fire-and-forget work.
11. `await syncRegistryToCloud(doc)`.

Response:

```jsonc
{
  "success": true,
  "contentHash": "9f8e7d6c5b4a3928",
  "staged": true,
  "stagedVersion": 4,
  "promotedVersion": null,      // set only when promote: true
  "lockHash": null,             // set only when promote: true
  "stagingError": undefined,
  "pipelineUrl": "/wiki/pipeline?doc=upload%3Ascan-acme-ui-kit.md"
}
```

The markdown on disk is now updated. The block registry has a new draft. Agents still see the previous promoted version. `verify:handshake-acceptance` had to pass `promote: true` explicitly for exactly this reason, and its inline comment says so.

### 4.2 Step 2: promote (the human gate)

```
POST /api/wiki/promote
{ "doc": "upload:scan-acme-ui-kit.md", "blockIds": ["component:button", "token:color:accent"], "resolveConflicts": false }
```

`src/app/api/wiki/promote/route.ts` is the most operationally careful route in the codebase, and it is worth reading in full before you touch it. Highlights:

- It opens a run log (`createRunLog()`) and records a durable pipeline run whether it succeeds or fails, so a failure is inspectable in the Pipeline console rather than being a 500 in someone's devtools.
- `hydrateRegistryFromCloud(doc)` first, so a cold lambda promotes against real state.
- It promotes each block with `{ deferManifest: true }` and calls `updateManifest(doc)` once at the end. The comment explains why: per-block manifest writes are quadratic directory scans on large promotes.
- A block whose status is `conflict` fails unless `resolveConflicts` is set, in which case `resolveConflict(doc, blockId)` promotes the latest version. That flag is an explicit human decision, never a default.
- `writeReferenceLock(doc)` runs once for the whole batch.
- Persistence is `await Promise.all([syncRegistryToCloud(doc), syncLockToCloud(doc, lock)])`, wrapped so that a cloud outage degrades loudly (a `persistenceWarning` in the response, an ERROR line in the run log) instead of turning an already-applied promote into a 500.

Response: `{ promoted: [{id, version}], failed: [{id, error}], lockHash, pinnedBlocks, persistenceWarning? }`.

Two sibling routes complete the pipeline. `POST /api/wiki/pin-lock` with `{ doc }` writes the reference lock from the current official graph without promoting anything, which fixes the "everything is live but there is no lock" dead end that auto-promoting ingest can create. `POST /api/wiki/rollback` with `{ doc, blockId }` moves the official pointer back one finalized version and regenerates the lock. History is never erased; only the pointer moves.

### 4.3 Step 3: pull (the repo catches up)

```
GET /api/v1/scans/pull?docRef=upload:scan-acme-ui-kit.md
Authorization: Bearer bs_live_…
```

`src/app/api/v1/scans/pull/route.ts` requires an API key, rejects any doc ref that is not `upload:`, and then requires `requireDocumentAccess(request, fileName, "write")`. Note that a *read* operation demands *write* access. That is intentional: pulling means taking custody of the design system into a repo, which is a stronger act than viewing it.

Response (`PullOverridesResponse` in `packages/sdk/src/types.ts`):

```jsonc
{
  "docRef": "upload:scan-acme-ui-kit.md",
  "overrides": { "button": { "role": "...", "description": "..." } },
  "finalizedCount": 1,
  "suggestedWorkspace": "/Users/dev/acme",
  "fullMarkdown": "# Acme UI Kit\n\n## Components\n…",
  "systemName": "Acme UI Kit",
  "stats": { "components": 11, "colors": 24, "typography": 6, "surfaces": 3 },
  "lock": { "version": 1, "docRef": "...", "contentHash": "...", "blocks": { } }
}
```

`fullMarkdown` is produced by `generateDesignSystemMarkdown(system, overrides)`, which merges the human governance into the complete export. This matters: an earlier version of `pull` shipped only per-component deltas, and the repo ended up with a `DESIGN.md` that contained three paragraphs about Button and nothing about the other ten components. The CLI still has that delta path as a fallback for older servers (`pull.ts` calls it "delta mode"), but the full export is the intended behaviour, and `verify:handshake-pull` asserts that the export carries more than one component.

The lock is built in a separate try/catch. If the registry has never been materialized, the pull still succeeds and the lock is `null`, and the CLI prints guidance rather than failing.

### 4.4 Step 4: the CLI writes the files

`packages/cli/src/pull.ts`:

1. Bails only if there is neither `fullMarkdown` nor any finalized override.
2. Resolves the target directory with `resolvePullWorkspace`: explicit `--workspace`, then `suggestedWorkspace` from the scan doc if that path exists locally, then the git root, then `process.cwd()`. It prints which rule fired.
3. `writeDesignMd(root, fullMarkdown)` writes `DESIGN.md` wholesale. BlockSmith owns that file as generated output.
4. `updateWikiOverrides(root, overrides)` merges into `.blocksmith/wiki-overrides.json` with an `updatedAt` per component. This sidecar is what survives the next rescan and re-merge.
5. `writeLock(root, lock)` writes `blocksmith.lock`, or prints "lock skipped, promote blocks in the Pipeline to pin versions" when there is no lock.

Then the loop closes: the repo files changed, so if a watcher is running, direction A fires and the wiki confirms the write.

### 4.5 The other lock endpoint

`GET /api/v1/lock?docRef=…` returns `{ lock, pinnedBlocks, fresh }`, and with `&format=file` returns the serialized lock with `Content-Disposition: attachment; filename="blocksmith.lock"`. It is the download-a-file path for people who do not want the CLI. The SDK does not currently wrap it.

---

## 5. The MCP server

This is how coding agents consume the design system, and it is the highest-leverage surface in the codebase.

### 5.1 The core idea: governance travels with the connector

Most attempts to make an agent follow rules put the rules in the repo: a `CLAUDE.md`, an `AGENTS.md`, a `.cursor/rules` file. That approach requires every project to be seeded, keeps drifting, and is trivially ignored.

BlockSmith puts the rules in the MCP server's `instructions`, delivered to every client on connect. Add the connector and you get the governed workflow, with no files in your project. `src/lib/mcp/blocksmith-server.ts` holds the string as `SERVER_INSTRUCTIONS`, also exported as `BLOCKSMITH_MCP_INSTRUCTIONS`. Rendered here with the punctuation rewritten:

> BlockSmith is the source of truth for this project's UI design system.
>
> Every block you read from this server is a PINNED, PROMOTED version (like package-lock.json for design): tool responses show "pinned vN (sha256 ...)". Drafts and conflicted blocks are never served. If a block you expect is missing, a human has not finalized it in the wiki yet; ask them to promote it rather than inventing values. `get_lockfile` returns the blocksmith.lock to keep in the repo; `get_sync_status` tells you if your lock is stale.
>
> For ANY task that adds or changes UI, follow this governed loop:
>
> 1. `get_component_history(component)`: check whether a teammate already worked on this.
> 2. `check_component_governance(component)`: load the authoritative spec, the allowed token palette, and the "Don't" rules.
> 3. Write UI using ONLY defined tokens. Never hardcode a hex color that is not a defined token.
> 4. `validate_ui_code(code)`: lint before applying. Do NOT apply ungoverned code.
> 5. `check_governance_diff(code, component?, filePath?)`: warn-tier prose rules plus block-tier colors, each with a suggested fix and a prioritized "Next" block.
> 6. `log_component_work(component, prompt, summary)`: record what changed.
>
> Treat deviations from the design system as bugs.

There is also one registered prompt, `governed_ui_task`, with optional `task` and `component` arguments, which expands into a user message walking the same five steps. A connector UI exposes it as a slash command or menu item.

### 5.2 Transport

One server factory, `createBlocksmithMcpServer()`, feeds two transports.

**stdio**, for people who have the BlockSmith repo on disk. `src/mcp/server.ts` is a shebang script that wires `StdioServerTransport` and logs readiness to stderr. Started with `npm run mcp`, which is `npx tsx --conditions=react-server src/mcp/server.ts`. The `--conditions=react-server` flag is required because the handlers import server-only modules.

**Streamable HTTP**, for everyone else. `src/lib/mcp/http-handler.ts` uses `WebStandardStreamableHTTPServerTransport` with `sessionIdGenerator: undefined`, which makes it stateless: a fresh `Server` and `Transport` per HTTP request, no session affinity, which is the only pattern that works on serverless. The route is `src/app/api/mcp/route.ts`, exposing `POST`, `GET`, and `DELETE`, every one of them gated by `requireApiKey`. The codebase calls this "Pattern 3" throughout, matching `docs/DISTRIBUTION.md`.

The server identifies itself as `{ name: "blocksmith", version: "0.1.0" }` and declares `tools` and `prompts` capabilities.

### 5.3 The read boundary: which tools are official-only

This distinction is subtle, load-bearing, and currently inconsistent. Read it carefully.

Tools that serve **blocks** go through `listGovernedBlocks(docRef)` in `src/lib/ir/enforce.ts`, which resolves through the registry's official pointers and drops `draft` and `conflict` blocks. Those tools are genuinely official-only, and `formatBlockForAgent` stamps every response with `pinned vN (contentHash)`.

Tools that serve **system-level facts** (the color palette, the do and don't lists, the component count) call `loadDesignSystem(docRef)`, which parses the markdown file on disk. Since `finalize` writes the markdown immediately, a saved-but-unpromoted prose edit is visible through those tools even though it is invisible through the block tools.

| Tool | Reads through | Official-only |
|------|---------------|---------------|
| `get_design_tokens` | `listGovernedBlocks` | Yes |
| `get_component_docs` | `listGovernedBlocks` | Yes |
| `list_components` | `listGovernedBlocks` | Yes |
| `get_lockfile` | `buildLock` over the official graph | Yes |
| `get_block_versions` | registry history | Shows all versions, marks which is official |
| `check_component_governance` | `loadDesignSystem` | No |
| `get_governance_rules` | `loadDesignSystem` | No |
| `validate_ui_code` | `loadDesignSystem` palette | No |
| `check_governance_diff` | `checkGovernanceDiff` over the doc | No |
| `get_component_history` | activity ledger | Not applicable |
| `get_sync_status` | watcher, store, registry, lock | Reports the boundary, including `excludedFromAgents` |

The `docs/E2E-TEST-GUIDE.md` step 4.2e names the block-serving case a release blocker if it ever leaks a draft. The system-level case has no equivalent test and is listed in Open questions below.

### 5.4 Every MCP tool

Sixteen tools are registered in `ListToolsRequestSchema`. Handlers live in `src/mcp/handlers.ts`. Note that `docs/MCP.md` documents only ten of them and its verification section still says "9 tools"; that document is stale.

---

#### `scan_workspace`

**Input:** `{ github?: string, fixture?: string, workspace?: string }`, all optional.
**Does:** Scans a vendor repo into canonical markdown plus a wiki doc. Three modes: a GitHub URL or `org/repo` (server shallow-clones), a demo fixture name such as `vendor`, or a server-local path (fixtures and dev only, defaulting to `BLOCKSMITH_WORKSPACE`).
**Output:** A markdown summary with scan mode, project name, workspace root, doc ref, markdown path, wiki path, counts of colors, components and files, whether AI curation ran, and the line `Set BLOCKSMITH_DOC=<docRef> in MCP env to govern this vendor.`
**For:** Onboarding a codebase from inside the agent loop.
**Official-only:** Not applicable, it writes rather than reads.
**Caveat, stated in the tool description itself:** for a repo on a developer's laptop, use `blocksmith scan /path` instead. The server cannot see your disk.

#### `import_figma_variables`

**Input:** `{ variables?: object|array, designContextCode?: string, components?: array, fileKey?: string, fileName?: string, projectName?: string }`.
**Does:** Imports a Figma library into a governed `design.md`. `variables` accepts either Figma's `{ name: value }` map (for example `"Color/Text/Primary": "#1A1A1A"`) or an array of `{ name, value, type }`. When the file has no Figma variables at all, pass the raw `get_design_context` output as `designContextCode` and de-facto tokens (colors, radii, type sizes) are recovered from the design code; real variables win on collision. `components` accepts Figma's raw `componentPropertyDefinitions` or pre-normalized `{ name, variants, booleanProps, textProps, instanceProps }`.
**Output:** Project name, Figma file key, token counts split into colors and dimensions, component count, skipped-variable count, doc ref, markdown path, wiki path, and a pointer to run `figma_token_drift` next.
**For:** The Figma-fit wedge. Figma stays the design source of truth; this seeds the BlockSmith IR so the wiki and Component Library can render the library. Tokens carry a `figma:<fileKey>` source label so their origin stays traceable.
**Official-only:** Not applicable, it writes.

#### `figma_token_drift`

**Input:** `{ variables?, designContextCode?, components?, doc?, fileKey? }`.
**Does:** Reconciles a Figma library against an existing **code scan**. `doc` must be an `upload:scan-*.md` produced by `blocksmith scan` or `scan_workspace`; anything else returns an error telling you to scan first. Produces token-level drift ("Figma says X, shipped code says Y") and, when `components` is passed, component-level drift such as "this Figma component has a `size=lg` variant your code does not".
**Output:** Rendered drift markdown. Sets `isError: true` when either the token report or the component report is out of sync, so the agent treats drift as a failure condition rather than an FYI.
**For:** The payoff of the wedge. This is the single tool most likely to be the reason a customer keeps BlockSmith.
**Official-only:** Reads scan markdown directly, not the block registry.

#### `get_design_tokens`

**Input:** `{ doc?: string, category?: string }` where category is one of `color`, `typography`, `spacing`, `surface`.
**Does:** Returns token blocks, filtered by `token:<category>:` prefix when a category is given.
**Output:** Each block formatted by `formatBlockForAgent`, joined with `---`. Every entry is stamped `pinned vN (hash)` and includes role, spec, value, CSS var, list items, free text, and any agent hint.
**For:** The first call any UI-writing agent should make.
**Official-only:** **Yes.**

#### `get_component_docs`

**Input:** `{ doc?: string, names?: string[] }`. Empty `names` returns all components. Matching is fuzzy: title substring, id substring, or id ending in `:<slug>`, so `button` and `primary-pill` both work.
**Does:** Returns component blocks with role, description, and agent hints.
**Output:** Same `formatBlockForAgent` rendering. Falls back to "Try list_components" when nothing matches.
**For:** Reading the spec before writing a component.
**Official-only:** **Yes.** This is the tool `verify:handshake-acceptance` uses to assert MCP and wiki parity.

#### `list_components`

**Input:** `{ doc?: string }`.
**Does:** Lists every component with id and a short summary (role, falling back to summary).
**Output:** A markdown bullet list headed `# Components (<docRef>)`.
**For:** Discovery, and recovering from a failed fuzzy match.
**Official-only:** **Yes.**

#### `get_sync_status`

**Input:** `{ doc?: string }`.
**Does:** The agent's situational awareness call. Returns raw JSON (not prose) containing the watcher state (`active`, `watchedPaths`, `lastEvent`), the block store index and system content hash, the `LockStatus` (present, fresh, pinned block count, and a `drift` object listing version mismatches and blocks missing from either side), a registry summary (official graph hash, promoted / draft / stale counts, last ingest time), `excludedFromAgents` (every block the enforcement boundary is hiding, with a reason of `draft`, `conflict`, `stale`, or `unpromoted`), the `workspaceScan` status object from section 3.4, and an `mcpNote` string.
**Output:** `JSON.stringify(status, null, 2)`.
**For:** Detecting mid-session that a human promoted something and your truth went stale.
**Official-only:** It is the tool that *reports* the boundary.

The `mcpNote` is one of three strings, chosen by situation: hosted-refresh-only tells you to run `blocksmith scan /path` or re-scan from GitHub; stale tells you not to trust component facts until a rescan; otherwise it tells you blocks mirror the wiki and to pull with `blocksmith pull`.

#### `get_component_history`

**Input:** `{ doc?: string, component?: string, limit?: number }`, default limit 10. Omit `component` for a doc-wide feed.
**Does:** Reads the shared activity ledger.
**Output:** Dated bullets with author, short commit, action, and summary, plus indented prompt and file lists.
**For:** The instructions say to call this first, always. It is how two agents (or one agent and one human) avoid undoing each other's fix.
**Official-only:** Not applicable.

#### `log_component_work`

**Input:** `{ doc?, component (required), author?, action?, prompt?, summary (required), files? }`. `action` is one of `prompt`, `fix`, `change`, `note`, defaulting to `note`.
**Does:** Appends to the ledger. Author resolution order is the explicit argument, then `gitAuthor()`, then `BLOCKSMITH_AUTHOR`, then `unknown`. It also attaches the design system content hash and the current git commit, and stamps `source: "mcp"`.
**Output:** A confirmation naming the component, author, and action.
**For:** Closing the loop so the wiki component page's Activity section shows real work by real people. `docs/MCP.md` is emphatic that activity is never seeded with mock users.
**Official-only:** Resolves the component through `loadDesignSystem`, so it can log against a component that exists in markdown but is not promoted.

#### `check_component_governance`

**Input:** `{ doc?, component (required), proposedColors?: string[] }`.
**Does:** Pre-flight. Resolves the component, builds the allowed palette from every system color whose value starts with `#`, and flags any proposed hex not in that set.
**Output:** A governed / deviation verdict, the authoritative role and spec, the full allowed palette with names and values, and the system's Don't rules. Returns `isError: true` when any proposed color is off-token.
**For:** Step 2 of the governed loop.
**Official-only:** **No.** Reads the parsed markdown.

#### `get_governance_rules`

**Input:** `{ doc?: string }`.
**Does:** Loads the whole system's constraints in one call: system name, component count, allowed color tokens, Do list, Don't list.
**Output:** Markdown, ending with an explicit reminder of the loop order.
**For:** The cheap "load the constraints" call at the start of any UI task.
**Official-only:** **No.**

#### `pulse_codegen`

**Input:** `{ doc?: string }`, expected to be an `upload:scan-*.md`.
**Does:** Generates an importable `@blocksmith/<slug>` npm package from the scan: `tokens.css` plus `Surface`, `Text`, and `Button` components.
**Output:** Package name, output directory, doc ref, CSS var and component counts, demo URL, a fenced `tsx` import example, and the build command.
**For:** Turning a scanned design system into something you can actually `npm install`. Demo lives at `/demo/pulse`.
**Official-only:** Not applicable.

#### `get_lockfile`

**Input:** `{ doc?: string }`.
**Does:** Builds `blocksmith.lock` from the official graph and reports whether the server's reference lock is fresh.
**Output:** Graph hash, pinned block count, freshness verdict ("fresh" or "STALE, versions were promoted after it was written", or "not written yet"), the instruction to write the file at the repo root next to `DESIGN.md`, and the full serialized JSON in a fenced block.
**For:** Letting an agent materialize the pin file without the CLI.
**Official-only:** **Yes.**

#### `get_block_versions`

**Input:** `{ doc?, blockId (required) }`, for example `component:primary-pill-button` or `token:color:accent`.
**Does:** Full version history for one block.
**Output:** Which version is official (or "Never promoted, agents cannot use this block yet"), then every version newest-first with status, date, content hash, and the edit origin, with the official one marked.
**For:** Auditing when a token changed and what the lock should be pinning. Errors helpfully when the block id is unknown, pointing at `list_components` and `get_design_tokens`.
**Official-only:** Shows everything, and labels what is official.

#### `validate_ui_code`

**Input:** `{ doc?, code (required) }`.
**Does:** Lints a code string against the palette using `findOffTokenColors`.
**Output:** On success, a governed message with the palette size. On failure, one line per violation as `line N: <hex>  ->  <snippet>`, prefixed with an instruction not to apply the code as-is, and `isError: true`.
**For:** Step 4 of the loop, the gate between "the model generated something" and "it hit the disk".
**Official-only:** **No.** Its own description tells the agent to call `get_lockfile` first so it is building against pinned versions.

#### `check_governance_diff`

**Input:** `{ doc?, code (required), component?, filePath?, record?, author?, overrideReason?, action?, commit?, branch? }`. `component` is inferred from `filePath` when omitted. `action` is `detected`, `overridden`, or `bypass`.
**Does:** The full two-tier check. **Block tier** is off-token colors, which never auto-pass. **Warn tier** is component prose rules, for example inactive links or stale dates. With `record: true` and findings present, it appends a governance event to the cloud feed that the design lead sees under Governance and then Violations.
**Output:** Counts per tier, a per-finding block with rule id, file and line, message, snippet, a `Fix:` suggestion, and a truncated rule citation, followed by a prioritized `## Next` section that tells the agent exactly what to do first: fix block-tier and re-run, then handle warn-tier or record an override with a reason. Returns `isError: true` when block-tier findings exist **or** any warn-tier findings remain.
**For:** Pre-commit and pre-push time. The `## Next` block exists so the agent can self-correct without another round trip; that was the "Tier-3 agent-time" change in commit `922b441`.
**Official-only:** **No.**

### 5.5 How a customer installs it

**Cursor, one click.** Create an API key on the wiki Sync page. `src/components/wiki/ApiKeysPanel.tsx` shows the key exactly once and immediately renders `CursorMcpInstall` beneath it. That component (`src/components/wiki/CursorMcpInstall.tsx`) builds two things from `src/lib/cursor/mcp-deeplink.ts`:

- A **deeplink**: `cursor://anysphere.cursor-deeplink/mcp/install?name=blocksmith&config=<base64>`, where the payload is `{ url: "<origin>/api/mcp", headers: { Authorization: "Bearer <key>" } }`. It renders as Cursor's official light and dark install badges served from `cursor.com`.
- A **copyable `.cursor/mcp.json`** produced by `buildMcpJsonConfig`, for people who prefer to paste.

It also prints the CLI equivalent: `blocksmith login --key … --url <origin>` followed by `blocksmith setup cursor`.

**Cursor, via the CLI.** `blocksmith setup cursor` (`packages/cli/src/cursor-setup.ts`) reads `~/.blocksmith/config.json`, targets `~/.cursor/mcp.json` with `--global` or `<workspace>/.cursor/mcp.json` otherwise, **merges** into any existing `mcpServers` map rather than clobbering it (falling back to replacement only if the file is unparseable), writes it, and prints the deeplink as well.

**Cursor, by hand.** `.cursor/mcp.json.example` in this repo shows both shapes side by side:

```jsonc
{
  "mcpServers": {
    "blocksmith-remote": {
      "url": "http://localhost:3000/api/mcp",
      "headers": { "Authorization": "Bearer bs_live_YOUR_KEY" }
    },
    "blocksmith-local": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/absolute/path/to/BlockSmith",
      "env": {
        "BLOCKSMITH_WORKSPACE": "${workspaceFolder}",
        "BLOCKSMITH_DOC": "upload:design-xxxx.md",
        "BLOCKSMITH_AUTHOR": "your-name"
      }
    }
  }
}
```

The checked-in `.cursor/mcp.json` in this repo is the local stdio form, pointing at `upload:design-163e34fb.md` with author `koshish`.

**Claude and other MCP clients.** Identical. Remote clients take the URL plus the `Authorization` header; local clients take the same stdio command shape. On connect they receive the server instructions automatically, which is the entire point of putting governance in the connector.

**Restart.** Cursor needs Settings, then MCP, then refresh after any config change. That is the single most common support answer.

### 5.6 Verifying the connector

`npm run mcp:probe` runs `scripts/mcp-probe-connector.ts`, which spawns the stdio server as a subprocess with a real MCP `Client`, and asserts: the instructions arrive on connect and contain the phrase "governed loop"; ten named tools are present; the `governed_ui_task` prompt is registered; `get_governance_rules` returns a payload containing "Allowed color tokens"; and `validate_ui_code` flags `#ff00ff` as an error. Run it against a specific doc with `BLOCKSMITH_DOC=upload:… npm run mcp:probe`.

`scripts/verify-mcp-accept.ts` is a live-server check: it mints a key, posts a JSON-RPC `initialize` to `http://localhost:3000/api/mcp` with Cursor-style `Accept: application/json, text/event-stream` headers, and fails unless the body mentions `blocksmith`. It is **not** wired into `package.json`; run it with `npx tsx scripts/verify-mcp-accept.ts` while `npm run dev` is up.

`npm run verify:mcp-sync` runs `scripts/verify-mcp-sync-status.ts`, which scans the vendor fixture and asserts that `get_sync_status` returns a `workspaceScan` object with boolean `stale` and `hostedRefreshOnly` fields plus a non-empty `mcpNote`. It is part of `verify:software`.

---

## 6. The CLI

### 6.1 Identity

The published name is **`@block-smith/cli`** (hyphenated scope), and the binary it installs is `blocksmith`. The SDK is `@blocksmith/sdk` (unhyphenated). The scope split is real and deliberate, from commit `87f8a47`, "chore(cli): publish under @block-smith scope". Any documentation that says `@blocksmith/cli` is wrong.

Version `0.1.0`, license MIT (`packages/cli/LICENSE`), `engines.node >= 18`, one runtime dependency (`commander@13.1.0`), `files: ["dist", "README.md"]`, `publishConfig.access: public`.

The default host is baked in: `DEFAULT_BASE_URL = "https://blocksmith-mocha.vercel.app"` in `packages/cli/src/cli.ts`, overridable with `--url`.

### 6.2 Every command

| Command | Flags | What it does |
|---------|-------|--------------|
| `login` | `-k, --key` (required), `-u, --url` | Rejects anything not starting with `bs_live_`, calls `client.me()` to verify against the server **before** persisting, then writes `~/.blocksmith/config.json` and prints the key label, prefix, server, and config path. |
| `whoami` | none | Prints the `GET /api/v1/me` response as JSON. |
| `mcp-url` | none | Prints `<baseUrl>/api/mcp` plus a reminder to add the `Authorization: Bearer` header in Cursor. |
| `codegen` | `-d, --doc` | Calls `POST /api/v1/codegen/pulse`, prints package name, output dir, doc ref, demo URL, the import example, and the server's `nextSteps`. |
| `pull` | `-d, --doc` (required), `-w, --workspace` | Section 4.4. |
| `scan [path]` | `--fixture`, `--github` | With a path, scans locally and uploads `clientScan`. Without, sends `fixture` or `github` for the server to run. |
| `check [paths...]` | `--doc`, `--base`, `--staged`, `--strict`, `--record`, `--reason`, `--format`, `--hook` | Section 6.4. |
| `setup cursor` | `-g, --global`, `-w, --workspace` | Section 5.5. |
| `setup hooks` | `-d, --doc`, `--strict` | Section 6.5. |
| `--version`, `-v` | | Prints `__CLI_VERSION__`, injected at build time. |

Two source files implement commands that are **not registered**: `packages/cli/src/updates.ts` (`blocksmith updates`, a deviation inbox with status icons, time-to-auto-approve, budget summary, and fix suggestions) and `packages/cli/src/fix.ts` (`blocksmith fix <block-id>`, printing the wiki guideline and a diff-style suggested change). Both are fully written. Neither appears in the `program.command(...)` list in `cli.ts`, and `check.ts` prints "Run: `blocksmith updates`" to users who cannot run it. Wiring them up is a two-line change and an obvious next task.

### 6.3 Authentication

`packages/cli/src/config.ts` is thirty lines: `~/.blocksmith/config.json` holding `{ apiKey, baseUrl }`, read with a try/catch that treats a corrupt file as absent, written with `mkdirSync(..., { recursive: true })`. There is no keychain integration and no file mode hardening; the key sits in plaintext at 0644. `requireClient()` in `cli.ts` fails with an actionable message pointing at "Sync, then API keys" in the wiki. The top-level error handler adds an extra hint whenever the error text matches `/401|403|unauthor|api key|invalid key/i`.

There is a second, per-repo config: `.blocksmith/blocksmith.json`, holding `{ docRef }`, managed by `packages/cli/src/repo-config.ts`. It is meant to be **committed** to the customer repo so `blocksmith check` and the git hook know which design system to govern against without repeating `--doc` every time. `resolveDocRef(root, explicit)` prefers the flag and falls back to the file.

### 6.4 `check`

`packages/cli/src/check.ts` is the pre-push and CI gate.

**File selection.** Explicit positional paths win. Otherwise `packages/cli/src/git-files.ts` picks a scope: `--base <range>` gives `range` (`git diff --name-only --diff-filter=ACMR <base>`), `--staged` gives `staged` (`--cached`), and the default `working` combines tracked changes against HEAD with untracked non-ignored files. It filters to a UI extension set (`ts`, `tsx`, `js`, `jsx`, `mjs`, `cjs`, `css`, `scss`, `sass`, `less`, `htm`, `html`, `vue`, `svelte`, `astro`), deduplicates, skips files over 512 KB, and skips anything unreadable.

**The check itself.** For each file it calls `client.governance.check({ docRef, code, filePath, source })`, which is `POST /api/v1/governance/events`. When `--record` is set it makes a **second** call per file with `record: true` and a computed action: `detected` with no reason, `overridden` when a reason is given and there are no block-tier findings, `bypass` when a reason is given over block-tier findings. A bypass still fails; it is simply audited.

**Output formats.** `--format json` prints `{ docRef, blockCount, warnCount, results }` and exits 1 on any block-tier finding. `--format github` prints a markdown table suitable for a PR comment, with a bold summary line and a blocking or advisory footer, same exit rule. The default `text` format goes to the interactive path.

**The interactive path.** Findings print per file with colored `BLOCK` and `WARN` tags, snippets, and rule citations. Block-tier findings print "Blocking violations must be fixed (off-token colors / lock). These never auto-pass." and exit 1 immediately. Warn-tier findings first check `client.deviations.budget(pushedBy)`; if the budget is exceeded the push is refused with a count. Otherwise it prompts `Do you want to Push anyway (p), add a Reason/Fix (s), or Cancel (c)?`, loops until a valid answer, and on `p` or `s` creates one deviation record per warn-tier finding via `POST /api/v1/deviations`, mapping `ruleId` to `blockId` and the citation and snippet into `deviationDiff`.

**Fail-open.** If `runCheck` throws (network down, server 500), the CLI prints the error and calls `process.exit(0)`. The comment is explicit: "Never block a push on infra failure." That is the right default for adoption and worth remembering when someone asks why a broken server did not stop a bad push.

**Two flags that do not work.** `--strict` is parsed into `CheckOptions.strict` and then never read anywhere in `check.ts`. And `flagBool(flags, "ci")` is consulted in two places to set `record` and `source: "ci"`, but `--ci` is never declared as a commander option on the `check` command, so passing it errors as an unknown option. Both are real, both are small, neither is currently covered by a test.

**Identity.** `pushedBy` is `process.env.USER` or the literal `local-dev`. Commit and branch come from `git rev-parse --short HEAD` and `--abbrev-ref HEAD`.

### 6.5 `setup hooks`

`packages/cli/src/setup-hooks.ts` installs a **pre-push** hook, not pre-commit. It requires being inside a git repo, requires a doc ref (from `--doc` or the committed `.blocksmith/blocksmith.json`, saving it when passed explicitly), creates `.git/hooks/`, and writes a `pre-push` file chmod 0755.

The hook body is delimited by markers so it can be updated or removed cleanly and can coexist with a hook the customer already wrote:

```sh
#!/bin/sh
# >>> blocksmith governance >>>
# Installed by `blocksmith setup hooks`. Re-run to update; delete this block to remove.
if command -v blocksmith >/dev/null 2>&1; then
  if git rev-parse --abbrev-ref @{u} >/dev/null 2>&1; then
    blocksmith check --base "@{u}..HEAD" --record --hook
  else
    blocksmith check --record --hook
  fi
  status=$?
  if [ "$status" -ne 0 ]; then
    echo ""
    echo "Push blocked by BlockSmith governance."
    echo "Check the errors above, or re-run interactively to override:"
    echo "  blocksmith check"
    echo "or bypass once:        git push --no-verify"
    exit "$status"
  fi
else
  echo "blocksmith CLI not found on PATH, skipping governance check."
fi
# <<< blocksmith governance <<<
```

`mergeHook` replaces the marked region if present, otherwise appends the block to the existing hook while preserving the user's shebang. Three design choices deserve naming. It compares against the upstream branch rather than the index, because a pre-push hook checking `--staged` would check the wrong thing. It exits cleanly when the CLI is not on PATH, so a teammate without the CLI is never blocked. And it advertises `git push --no-verify` in its own failure message, because a gate you cannot escape gets deleted.

`--strict` writes `--strict` into the hook invocation, which currently does nothing (see 6.4).

### 6.6 The single-file bundle, and why it matters

`packages/cli/build.mjs` runs esbuild with `bundle: true`, `platform: node`, `format: esm`, `target: node18`, output `dist/cli.js`, then `chmodSync(outfile, 0o755)`. It deletes `dist/` first so only the one file ships. Two details carry weight:

```js
alias: { "@blocksmith/sdk": join(here, "../sdk/src/index.ts") },
define: { __CLI_VERSION__: JSON.stringify(pkg.version) },
```

The SDK is bundled **from TypeScript source**, not consumed as a published package. That is why `@blocksmith/sdk` appears under `devDependencies` in the CLI's `package.json` rather than `dependencies`, and why `scripts/publish-packages.mjs` publishes only the CLI. The version string is compile-time injected rather than read from `package.json` at runtime, so the bundle needs no file access to know what it is.

`commander` is `external`, with a comment explaining why: it is ESM-aware at runtime and externalizing avoids esbuild wrapping its Node built-in imports in a dynamic require shim. So the honest description is **one bundled file plus exactly one runtime dependency**, not literally zero. The build comment and the README both say "zero-dependency", which is a small overstatement.

Why this matters for adoption, in order:

1. **Install is one command with no peer decisions.** `npm install -g @block-smith/cli` and you are done. Every extra package is a chance for a version conflict on a machine you do not control.
2. **The SDK never has to be published for the CLI to work.** That removes an entire release-coupling problem: no "CLI 0.2 requires SDK 0.2" support tickets, no dependency range to get wrong.
3. **The install is auditable.** One readable file, roughly 34 KB, that a security-conscious engineer can skim before letting it near their repo. The CLI writes to `DESIGN.md`, `.blocksmith/`, `blocksmith.lock`, `.git/hooks/pre-push`, and `.cursor/mcp.json`. Anything that installs a git hook should be inspectable.
4. **It fits the open-core story.** The CLI is the MIT half. A single-file MIT artifact is trivially forkable, which is the point.

One artifact of the approach: `packages/cli/src/args.ts` is a hand-rolled zero-dependency argv parser whose header comment explains that keeping it in-house avoids a runtime dependency. `commander` later replaced it for command dispatch, so `parseArgs` is now dead code; only its `flagStr` and `flagBool` helpers survive, adapting commander's options object.

---

## 7. The SDK

`@blocksmith/sdk`, version `0.1.0`, MIT, ESM only, `exports` for `.` and `./design-md`, `files: ["dist", "README.md"]`, `publishConfig.access: public`. It has **no dependencies at all**, not even commander: it is `fetch` and `node:fs`.

### 7.1 The client

`packages/sdk/src/client.ts` exports one class. `new BlockSmith({ apiKey, baseUrl })` throws on either being empty and strips a trailing slash from the base URL. The private `request<T>` helper sets `Content-Type: application/json`, attaches `Authorization: Bearer <apiKey>` (or, when `adminSecret` is passed, `X-BlockSmith-Admin-Secret` **instead of** the bearer), parses JSON with a `{}` fallback, and throws `new Error(data.error ?? "HTTP <status>")` on a non-2xx. That single unwrapping is why CLI errors read like server messages.

| Method | Route | Namespaced as |
|--------|-------|---------------|
| `me()` | `GET /api/v1/me` | |
| `createScan(input)` | `POST /api/v1/scans` | `scans.create` |
| `pullOverrides(docRef)` | `GET /api/v1/scans/pull?docRef=` | `scans.pull` |
| `codegenPulse(input)` | `POST /api/v1/codegen/pulse` | `codegen.pulse` |
| `checkGovernance(input)` | `POST /api/v1/governance/events` | `governance.check` |
| `createDeviation(input)` | `POST /api/v1/deviations` | `deviations.create` |
| `listDeviations(opts)` | `GET /api/v1/deviations` | `deviations.list` |
| `checkBudget(pushedBy, blockId?)` | `GET /api/v1/deviations/budget` | `deviations.budget` |
| `mcpUrl()` | local string builder | |
| `BlockSmith.createApiKey(baseUrl, adminSecret, label?)` | `POST /api/v1/auth/keys` | static |

The namespaced aliases exist for readability at call sites (`client.scans.pull(doc)` beats `client.pullOverrides(doc)`), and the flat methods remain for anyone who prefers them.

`createApiKey` is `static` deliberately: minting a key needs the server admin secret, not a user API key, so it must be callable without an authenticated client instance.

### 7.2 The types

`packages/sdk/src/types.ts` is the honest contract for the whole machine-facing API. It is worth reading start to finish as a spec: `ClientScanPayload`, `ScanCreateInput` / `ScanCreateResponse`, `PullOverridesResponse`, `GovernanceTier` (`"block" | "warn"`), `GovernanceFinding` (with `ruleId`, `tier`, `message`, `ruleCitation`, `file`, `line`, `snippet`, and the prescriptive `suggestion`), `GovernanceCheckInput` / `Response`, `PulseCodegenInput` / `Response`, `CreateKeyResponse`, and the deviation family (`DeviationDiff`, `DeviationStatus` of `pending | auto_approved | approved | rejected | resolved`, `Deviation`, `CreateDeviationInput` / `Response`, `ListDeviationsResponse`, `DeviationBudgetResponse` with `budgetExceeded` and `blockLocked`).

### 7.3 The filesystem half

`packages/sdk/src/design-md.ts` is the only part of the SDK that touches disk, and it is what makes the SDK usable for writing a pull-equivalent yourself:

- `writeDesignMd(root, markdown)` overwrites `DESIGN.md` wholesale, ensuring a trailing newline. Its comment states the ownership rule: BlockSmith owns that file as generated output.
- `writeLock(root, lock)` writes pretty-printed `blocksmith.lock`.
- `updateWikiOverrides(root, map)` merges per-component overrides into `.blocksmith/wiki-overrides.json` with `version: 1` and an `updatedAt` per entry, tolerating a corrupt existing file by starting fresh.
- `updateDesignMd(root, componentId, data)` is the legacy per-component delta writer. It finds `## <componentId>`, replaces up to a `<!-- blocksmith-end-<id> -->` marker (or the next `##`, or end of file), and appends if absent. Kept as the fallback path for servers that do not return `fullMarkdown`.

### 7.4 CLI versus SDK: who each is for

| | CLI | SDK |
|---|-----|-----|
| **User** | A developer at a terminal, in their repo | A program: CI job, internal automation, a script |
| **Auth** | Persisted in `~/.blocksmith/config.json` by `login` | Explicit `{ apiKey, baseUrl }` per instantiation, typically from env |
| **Interactivity** | Prompts, colors, exit codes, a git hook | None. Returns values or throws |
| **Filesystem** | Owns it: writes `DESIGN.md`, lock, hooks, `.cursor/mcp.json` | Optional helpers only, called explicitly |
| **Distribution** | Bundled single file, installed globally | Imported as a library |
| **Published** | Yes, `@block-smith/cli` (see section 9) | Bundled into the CLI, not separately published today |

The blunt version: the CLI *is* the SDK plus opinions about your filesystem and your terminal. If you find yourself adding a flag to the CLI that changes an HTTP payload, the capability belongs in the SDK first.

Note two documentation bugs in `packages/sdk/README.md`: it shows `import { createClient }` and `createClient({...})`, but the export is the `BlockSmith` class; and it shows `client.scans.pull({ docRef })`, but `pull` takes a bare string.

---

## 8. API keys and auth for machines

### 8.1 Minting

`src/lib/cloud/api-keys.ts`, `buildApiKeyRecord`:

```
id      = randomUUID()
body    = randomBytes(24).toString("base64url")
key     = "bs_live_" + body
prefix  = key.slice(0, 16)          // "bs_live_" plus 8 chars
hash    = sha256(key), hex
record  = { id, userId, prefix, hash, label, createdAt }
```

The plaintext key is returned exactly once and never stored. Only the hash and the prefix persist. The prefix exists so the UI can show a recognizable stub in a list without holding the secret.

### 8.2 Two ways to mint one

**Self-serve, session-authenticated** (`POST /api/v1/auth/keys/me`). Requires a signed-in GitHub user via `getSupabaseUser()`. Default label is `<login>-key`. The response includes `hint: "Copy now, shown once. Use: blocksmith login --key <key> --url <your-app>"`. The same route serves `GET` (list your keys plus your login) and `DELETE?id=` (revoke, scoped to your user id). This is the path real customers use.

**Admin-secret** (`POST /api/v1/auth/keys`). Requires header `X-BlockSmith-Admin-Secret` matching `BLOCKSMITH_ADMIN_SECRET`; `adminSecretOk` returns `false` when the env var is unset, so an unconfigured server cannot be tricked into minting. `GET` on the same route lists key prefixes. This is the operator and test path, and the one `docs/DISTRIBUTION.md` documents with a `curl`.

### 8.3 Storage

Dual, chosen by `saasDbEnabled()`:

- **Supabase** table `blocksmith_api_keys` with columns `id`, `user_id`, `prefix`, `hash`, `label`, `created_at`, `last_used_at`, `revoked_at`. `createApiKeyForUser` writes here directly on hosted deployments and never touches disk.
- **Local file** `data/cloud/api-keys.json` (`{ version: 1, keys: [] }`), guarded by `localCloudStoreWritable()` so a read-only serverless filesystem is a no-op rather than a crash.

Lookups try Supabase first and fall through to the file, so local development works with no database and hosted works with no disk.

### 8.4 Verification

`src/lib/cloud/auth.ts` is deliberately tiny. `bearerFromRequest` pulls the `authorization` header, requires a case-insensitive `bearer ` prefix, and returns the remainder. `requireApiKey` calls `authenticateApiKey`, which rejects anything not starting with `bs_live_` before hashing, looks the hash up (Supabase first, unrevoked only, then file), stamps `lastUsedAt`, and returns an `AuthenticatedKey`:

```ts
{ id, userId: string | null, prefix, label, isAdmin: !record.userId }
```

**`isAdmin` is derived from the absence of a user id.** Admin-minted keys have no owner and are therefore admin. That is compact and it works, but it means the privilege model has exactly two levels with no way to express a scoped machine key. Named again in Open questions.

On failure `requireApiKey` returns `{ ok: false, response }` with a 401 whose body is `"Unauthorized. Provide Authorization: Bearer bs_live_…"`, so every route can early-return uniformly.

### 8.5 The second gate: document access

An API key proves *who you are*, not *what you may touch*. Every route that reads or writes a specific document also calls `requireDocumentAccess(request, fileName, action)` from `src/lib/cloud/access.ts`. It short-circuits to allow-all when `saasStrictMode()` is off (local dev), otherwise resolves an actor from either a session or an API key, and calls `canAccessDocument(fileName, userId, { allowAdminKey, action })`. Failures are 401 when there is no actor and 403 when the actor exists but the team role is insufficient, with distinct read and write messages.

### 8.6 What accepts what

| Route | Auth |
|-------|------|
| `POST/GET/DELETE /api/mcp` | API key |
| `GET /api/v1/me` | API key |
| `POST /api/v1/scans` | API key, plus per-key scan rate limit |
| `GET /api/v1/scans/pull` | API key, plus document access (write) |
| `GET /api/v1/lock` | API key, plus document access on upload docs |
| `POST /api/v1/codegen/pulse` | API key |
| `POST/GET/PATCH /api/v1/governance/events` | API key, plus document access (write on POST, read on GET) |
| `POST /api/v1/auth/keys` | Admin secret header |
| `GET/POST/DELETE /api/v1/auth/keys/me` | GitHub session |
| `POST/GET /api/v1/deviations`, `GET /api/v1/deviations/budget` | Either, via `resolveActor`; only enforced under `saasStrictMode` |
| `POST /api/v1/orgs/invite`, `GET /api/v1/orgs/me`, `DELETE /api/v1/orgs/members` | GitHub session |
| `GET/PATCH /api/v1/governance/settings` | GitHub session |
| `POST /api/wiki/finalize`, `/promote`, `/rollback`, `/pin-lock` | Document access plus IP rate limit |
| `GET /api/sync/status`, `GET /api/sync/events`, `GET /api/sync/scan-status` | **None** |
| `POST /api/sync/rescan`, `POST /api/sync/github-rescan` | Document access; github-rescan also needs a GitHub session |

`POST /api/v1/orgs/invite` is worth a sentence since it is the only human-to-human route in this chapter. It requires a session, defaults `role` to `member`, rejects any role outside `ORG_ROLES` and specifically rejects `owner` (you cannot mint a second owner by invitation), calls `ensureDefaultOrg(userId, login)` so a solo user gets an org lazily, records the member, and attempts email delivery via `sendOrgInvite`. The response carries a `delivery` object and a `hint` that degrades gracefully: when email is not configured it says the invite was saved and points at `RESEND_API_KEY`. The invited person gains access when they sign in with GitHub using that email.

### 8.7 Rate limiting

Three distinct limiters, all in `src/lib/cloud/rate-limit.ts`:

- `scanRateLimitForApiKey(keyId)` on `POST /api/v1/scans`, keyed by API key, returning 429 with `Retry-After`.
- `checkRateLimit("pipeline:write:<ip>", ...)` on finalize, promote, rollback, and pin-lock: default 120 per 10 minutes, configurable with `BLOCKSMITH_PIPELINE_RATE_LIMIT`.
- An AI limiter referenced as `BLOCKSMITH_AI_RATE_LIMIT` in the test guide.

---

## 9. Conflict handling

The word "conflict" does four different jobs in this codebase. Confusing them is the fastest way to write a wrong fix, so here they are separated.

### 9.1 Document-level optimistic concurrency (the 409)

**Question answered:** did the underlying markdown change while a human had an editor open?

**Mechanism:** the wiki reads a document, computes `sha256(markdown).slice(0, 16)`, and sends it back as `baseContentHash` on `POST /api/wiki/finalize`. The route recomputes the hash of what is on disk now. Mismatch, and no `force`, yields:

```
HTTP 409
{ "error": "Conflict",
  "message": "This document has been modified in the IDE since you started editing.",
  "currentHash": "9f8e7d6c5b4a3928" }
```

**Resolution:** the user reloads and reapplies, or resubmits with `"force": true`. There is no automatic merge. That is a deliberate choice: `modifyMarkdownBlock` operates on markdown structure, and silently merging two structural edits is how you lose a paragraph.

**Who is right in this model:** whoever changed the file most recently wins by default, and the human with the stale editor must decide consciously to overwrite them.

### 9.2 Scan staleness (the repo moved under the wiki)

**Question answered:** does the published scan still describe the code?

**Mechanism:** section 3.4. `scan-facts-hash` in the frontmatter versus a live `scanResultFingerprint`. Facts-based, not timestamp-based, so a rebuild that changes nothing does not report stale.

**Resolution:** rescan. Which rescan depends on `refreshHint`: `server-rescan` means the wiki's Refresh button (`POST /api/sync/rescan`), `github-rescan` means `POST /api/sync/github-rescan`, `cli-rescan` means the customer must run `blocksmith scan /path` themselves.

**Surfaced by:** the wiki banner on workspace-scan docs, `GET /api/sync/scan-status`, and `get_sync_status`'s `mcpNote`.

### 9.3 Block-level registry conflict

**Question answered:** did the same block get edited from two origins between promotions?

**Mechanism:** a block version can carry `status: "conflict"` in the IR registry. `listGovernedBlocks` filters those out, so a conflicted block simply disappears from agent view. `listExcludedBlocks` reports it with reason `conflict` in `get_sync_status`, so the agent is told *why* a block it expected is missing rather than silently getting nothing.

**Resolution:** `POST /api/wiki/promote` with `resolveConflicts: true` calls `resolveConflict(doc, blockId)`, which promotes the latest version. That is an explicit human decision, logged in the run console as a warning line.

### 9.4 Lock drift

**Question answered:** is the pinned truth in the repo still the promoted truth on the server?

**Mechanism:** `verifyLock(docRef, lock)` in `src/lib/ir/lock.ts`, surfaced through `getLockStatus` as `{ present, fresh, drift: { versionMismatches, missingInLock, missingInRegistry } }`.

**Resolution:** `blocksmith pull` again. `docs/E2E-TEST-GUIDE.md` step 3.4 calls this "the core trust mechanic" and states the invariant plainly: at no point does anything silently rewrite your lock; only `pull` moves it.

**Enforced by:** `npm run validate:ui`, which fails a PR when the lock is missing while a registry exists, when the lock is stale, or when the diff introduces off-token colors. Exit codes are 0 governed, 1 violations or stale lock, 2 setup error. `--allow-stale` downgrades staleness to a warning.

### 9.5 What `verify:sync-conflict` actually proves

`scripts/verify-sync-conflict.ts`, run as `npm run verify:sync-conflict` and included in `verify:software`. Be precise about its scope, because its name promises more than it delivers.

It does prove:

1. Scanning the vendor fixture and appending a marker to the published markdown **changes** the 16-character document hash, so a stale base hash is detectable at all.
2. The comparison the finalize route performs (`baseHash !== newHash`) evaluates to a conflict for that stale hash.
3. `modifyMarkdownBlock` still parses and rewrites the restored document afterwards, so the conflict path leaves no corruption.
4. `getWorkspaceScanSyncStatus` does not report stale when published and live fingerprints match.

It does **not** prove:

- That `POST /api/wiki/finalize` returns 409. The script reimplements the hash comparison inline with the comment "same logic as /api/wiki/finalize" rather than importing the route the way `verify-handshake-pull.ts` and `verify-handshake-writeback.ts` do. A refactor that changed the gate in the route would leave this test green.
- Anything about `force: true`.
- Anything about registry-level `conflict` status or `resolveConflicts`.

Calling the route directly is a small, obvious improvement, and the sibling scripts already show how.

### 9.6 What the other handshake verifiers prove

| Script | npm script | Asserts |
|--------|-----------|---------|
| `scripts/verify-handshake-pull.ts` | `verify:handshake-pull` | Scans the fixture, calls the real finalize route, mints a key, calls the real pull route, and checks: `finalizedCount === 1`; the finalized role is present; no more than three components leaked; `fullMarkdown` exists, contains the finalized role, and has a Components section; `stats.components > 1`; `lock` is present. Then it runs the SDK's writers into a temp directory and asserts `DESIGN.md`, `.blocksmith/wiki-overrides.json`, and `blocksmith.lock` all land with the right content. |
| `scripts/verify-handshake-writeback.ts` | `verify:handshake-writeback` | Finalize over HTTP, then: the cloud sidecar holds exactly one override with the right role; the upload sidecar file exists; the local vendor `.blocksmith/wiki-overrides.json` exists with the role and description; `DESIGN.md` contains the role under `## Button`; and, crucially, a **fresh rescan and reparse** still yields that role and description, proving the human prose survives a code-side rescan. |
| `scripts/verify-handshake-acceptance.ts` | `verify:handshake-acceptance` | All three legs. IDE to Web: mutates `#ffffff` to `#fefefe` in the fixture's `Button.tsx`, rescans, and asserts the marker reaches the published scan and that published and live facts hashes match. Web to IDE: finalizes **with `promote: true`** and asserts the overrides file, cloud sidecar, and `DESIGN.md` all exist. MCP parity: refreshes blocks and asserts `handleGetComponentDocs` returns exactly the wiki's role and description for `component:button`. It restores the fixture and rescans in a `finally`. |
| `scripts/verify-cloud-api.ts` | `verify:cloud-api` | The Pattern 2/3/4 smoke test with no HTTP server: deletes the local key store, mints and authenticates a key, runs a fixture scan through `runScanApi`, checks the file name, wiki URL and component count, runs Pulse codegen and checks slug and CSS var count, and reports whether the SDK `dist` is built. |

---

## 10. The published packages

### 10.1 What exists

| Package | Version | Private | License | Publishable | On npm today |
|---------|---------|---------|---------|-------------|--------------|
| `@block-smith/cli` | 0.1.0 | no | MIT | yes, `publishConfig.access: public` | the only target of `publish:packages` |
| `@blocksmith/sdk` | 0.1.0 | no | MIT | yes, `publishConfig.access: public` | not published by the script; bundled into the CLI |
| `@blocksmith/protocol` | 0.1.0 | no | MIT | yes, `publishConfig.access: public` | not in the publish script |
| `@blocksmith/pulse-runtime` | 0.1.0 | no | UNLICENSED | technically, but unlicensed | no |
| `@blocksmith/pretext-components` | 0.1.0 | **yes** | none | no | no |
| `@blocksmith/acme-ui-kit` | 0.1.0 | **yes** | none | no, generated output | no |
| `blocksmith` (root) | 0.1.0 | **yes** | BUSL-1.1 | never | no |

### 10.2 Be honest about "published"

There is **no evidence in this repository that anything has actually been published to npm**. No git tags exist. There is no `.npmrc`. `docs/NPM-PUBLISH.md` still frames publishing as a future step ("When ready to ship"). The correct statement to a customer is: the CLI is packaged and ready to publish, and the install instructions in `packages/cli/README.md` are the instructions that will work once it is. Verify with `npm view @block-smith/cli` before repeating anything stronger.

Today's actual install path, and the one `docs/E2E-TEST-GUIDE.md` step 0.3 uses, is local:

```bash
npm run build:packages          # builds @blocksmith/sdk then @block-smith/cli
npm link -w @block-smith/cli    # puts `blocksmith` on PATH
blocksmith --help
```

### 10.3 The publish script

`scripts/publish-packages.mjs` is short and does exactly one thing:

```
1. npm run build -w @block-smith/cli        (explicit, so build failures surface before publish)
2. npm publish -w @block-smith/cli --access public [--dry-run] [--otp <code>]
```

Its header comment states the reason the SDK is absent: the CLI bundles the SDK from source, so the published tarball is a single dependency-free file and the SDK does not need publishing separately. `npm run publish:packages:dry-run` previews the tarball and publishes nothing. `npm run publish:packages -- --otp 123456` handles 2FA-enforced accounts.

**`docs/NPM-PUBLISH.md` is stale.** It says the script "publishes SDK first, temporarily sets CLI's `@blocksmith/sdk` to `^0.1.0` for the tarball, then restores `file:../sdk` for local dev". The current script does none of that. Fix the doc or restore the behaviour, but do not trust the doc.

### 10.4 Versioning

There is no versioning scheme yet. Every package sits at `0.1.0`, there are no tags, and nothing bumps automatically. The CLI's `--version` reads `__CLI_VERSION__`, injected from `package.json` at build time, so the version is at least honest about which source built the bundle. Choosing a scheme (independent semver per package, or lockstep) is an open decision.

### 10.5 The open-core boundary

`LICENSING.md` at the repo root defines it, and its status line is unambiguous: **internal**, do not push to a public remote or announce the split yet.

**MIT** (`LICENSE-MIT`, plus per-package `LICENSE` files): `packages/cli`, `packages/sdk`, `packages/protocol`. The argument is that these are adoption and standardization surfaces; the more widely they are inspected and built on, the stronger the ecosystem position.

**BSL 1.1** (`LICENSE`, root `package.json` declares `"license": "BUSL-1.1"`), converting to Apache-2.0 on **2030-06-23**: `src/app`, `src/lib/cloud`, `src/lib/ai`, `packages/pulse-runtime`, `packages/generated/*`, and by default anything not explicitly listed as open. The Additional Use Grant permits production use except offering BlockSmith to third parties as a competing hosted or managed service.

**Intended open, extraction pending.** Three directions still live under `src/` and must move into `packages/` before an open tree could compile standalone: `src/lib/figma` (import and drift), `src/lib/mcp` plus `src/mcp` (the MCP server agents connect to), and `src/lib/scan` parsers plus `src/lib/governance/color-lint.ts`. **The MCP server is on this list.** It is the surface most likely to drive adoption and it is currently entangled with the proprietary app. That extraction is the single most consequential piece of packaging work outstanding.

### 10.6 `@blocksmith/protocol`, the piece nobody remembers

Worth knowing because it is the standardization play. `packages/protocol` publishes `blocksmith.blocks.v1`: TypeScript types, validators, canonical hashing, four JSON Schemas (`blocksmith.blocks.v1.json`, `blocksmith.lock.v1.json`, `blocksmith.registry.v1.json`, `blocksmith.compile-targets.v1.json`), and conformance fixtures. Its `exports` map includes `./schemas/*` so consumers can load the raw schemas.

`npm run protocol:conformance` runs two scripts. `conformance/run.ts` is the public suite a third party can run after forking the fixtures: valid fixtures validate (including official-only and hash verification), invalid fixtures fail for the **documented** reason (`bad-content-hash`, `draft-in-official-graph`, `lock-version-mismatch`, `wrong-schema-field`), golden hash vectors reproduce byte for byte, graph hashing is order-independent, and lock verification detects version mismatch and staleness. Exit 0 means your emitter speaks blocks.v1.

`conformance/drift.ts` is BlockSmith-repo-only and explicitly not part of the public package: it imports both `packages/protocol/src/hash.ts` and the app's `src/lib/ir/hash.ts` and fails CI if they disagree on golden vectors, or if `public/schema/` diverges from `packages/protocol/schemas/`. `npm run protocol:sync-schemas` (`scripts/sync-protocol-schemas.mjs`) is the corresponding sync step. Without this gate, the published spec and the running server would quietly drift apart, which for a standard is the worst possible failure.

---

## 11. The end-to-end demo script

Two scripts exist. Use the short one on a call, the long one before a release.

### 11.1 The 30-second version (`.cursor/handshake-demo.md`)

Before recording, with `npm run dev` running in another terminal:

```bash
npm run scan:vendor        # produces upload:scan-acme-ui-kit.md
```

**Part A, scan to wiki (about 10s).** Home, then Connect GitHub, pick a repo, then "Scan to wiki". Or click "Try demo". The wiki opens with components, tokens, and live previews.

**Part B, governance to finalize (about 10s).** Wiki, Components, Button. In the Governance copilot type *"primary CTA only, max one per view"*, click Draft rules, then Apply to draft. Save draft, then Finalize. Open Sync and point at the `blocksmith pull` hint.

**Part C, web to IDE (about 10s).**

```bash
npm run build:packages
blocksmith login --key bs_live_… --url http://localhost:3000
blocksmith pull --doc upload:scan-acme-ui-kit.md --workspace /tmp/my-design-system
```

Open `/tmp/my-design-system/DESIGN.md` and show the Button role you just wrote in the browser.

Optional closer: call `get_component_docs` and `get_sync_status` from Cursor against the same doc, showing identical content.

### 11.2 The full customer-call version

This is the sequence that demonstrates every claim in this chapter. Roughly fifteen minutes at a comfortable pace.

```bash
# ── 0. setup (before the call) ────────────────────────────────────────────
npm run dev                       # http://localhost:3000
npm run build:packages
npm link -w @block-smith/cli
blocksmith --help                 # sanity
# have a second, real React repo ready: ~/consumer-app
```

**1. Onboard a codebase.** Sign in with GitHub. Scan a repo (Connect GitHub, or Try demo). The wiki opens with Featured components and Foundation populated. Say out loud: nothing here was written by hand; it was read out of the code.

**2. Add human judgement.** Open a component page. Edit the Role. Save to staging. Open Pipeline: the edit sits in the Staging lane while the scanned blocks sit in Production. Say out loud: this is a draft, and no agent can see it yet.

**3. Promote.** Select the block, click Promote, confirm in the diff drawer. The card moves to Production and the success message carries the lock hash. Click the run badge to open the console drawer: per-block log lines, lock before and after, and "Persisted to cloud registry". If the lock strip shows none, click Pin production lock.

**4. Mint a key.** Wiki, Sync, Create API key. Copy the `bs_live_…` value; it is shown once. The Add to Cursor button appears directly underneath.

```bash
# ── 5. the developer half ─────────────────────────────────────────────────
blocksmith login --key bs_live_YOUR_KEY --url http://localhost:3000
blocksmith whoami

cd ~/consumer-app
blocksmith pull --doc upload:scan-YOUR-PROJECT.md
```

Show all three artifacts: `DESIGN.md` (the full system, with your Role merged in), `.blocksmith/wiki-overrides.json`, and `blocksmith.lock`.

**6. The staleness loop, which is the moment that lands.** Back in the wiki, promote one more block. The server lock regenerates. In `~/consumer-app` the local lock is now behind, and `get_sync_status` or the Sync page says so. Run `blocksmith pull` again and it is fresh. Say out loud: nothing ever rewrites your lock silently; only `pull` moves it.

```bash
# ── 7. the repo gate ──────────────────────────────────────────────────────
cd ~/consumer-app
echo 'export const Bad = () => <div style={{ color: "#ff00aa" }} />;' > src/bad.tsx
git add src/bad.tsx
blocksmith check --staged            # flags the off-token hex
rm src/bad.tsx && blocksmith check --staged   # clean

blocksmith setup hooks --doc upload:scan-YOUR-PROJECT.md
# now `git push` runs the same check automatically
```

**8. The agent gate, which is the reason the product exists.**

```bash
blocksmith mcp-url          # prints the URL and the header
blocksmith setup cursor     # writes .cursor/mcp.json
# restart Cursor MCP: Settings, MCP, refresh
```

In Cursor chat, in order:

| Ask | Show |
|-----|------|
| "Use BlockSmith `get_governance_rules`" | Palette and rules identical to the wiki |
| "Call `validate_ui_code` on `<div style={{color:'#ff00aa'}}/>`" | Rejected as off-token |
| "Run the `governed_ui_task` prompt to update the primary button" | The agent walks history, rules, tokens, validate, log by itself |
| "Call `log_component_work` for the button" | The entry appears on the wiki component page under Activity |
| **Stage a wiki edit without promoting, then ask MCP for that component** | The agent still sees the promoted version. Drafts are invisible to agents. |

That last row is the thesis. `docs/E2E-TEST-GUIDE.md` calls it step 4.2e and says that if an agent can see a draft, that is a release blocker, not a bug.

**9. Off camera, prove it.**

```bash
npm run verify:software
BLOCKSMITH_URL=https://blocksmith-mocha.vercel.app npm run verify:production-goals
BLOCKSMITH_URL=https://blocksmith-mocha.vercel.app npm run verify:production-smoke
```

`verify:software` chains typecheck, scan coverage, wiki parse, both vendor suites, all three handshake verifiers, sync-conflict, ACL, security gate, org RBAC, governance end-to-end, governance tiers, mcp-sync, component interface, and pulse.

---

## 12. Status of every handshake capability

Vocabulary per [STYLE.md](./STYLE.md): **Shipped** means built and covered by a verify script or manually proven; **Built, unproven** means the code exists but has never run against a real external input; **Partial** means some paths work and others are stubs; **Planned** means designed but not coded; **Idea** means not yet designed.

### Direction A, IDE to Web

| Capability | Status | Evidence |
|-----------|--------|----------|
| Document file watcher (`docs/designs.md/`, `data/uploads/`) | Shipped | `src/lib/sync/watcher.ts`; E2E guide 5.1 |
| Workspace code watcher with debounced rescan | Shipped | `startWorkspaceWatcher`; `verify:handshake-acceptance` leg 1 |
| SSE push to open wiki tabs | Shipped | `src/app/api/sync/events/route.ts`; manual, no verify script |
| Supabase Realtime cross-instance broadcast | Built, unproven | `publishToRealtime` in `src/lib/sync/events.ts`; failures are swallowed and no test asserts delivery |
| `POST /api/v1/scans` with `clientScan` upload | Shipped | `verify:cloud-api`; E2E guide 3.7 |
| `blocksmith scan <path>` local scan | Partial | Requires a BlockSmith checkout plus `BLOCKSMITH_ROOT`; `packages/cli/src/scan-local.ts` |
| `blocksmith scan --github` / `--fixture` | Shipped | `verify:github-scan`, `verify:cloud-api` |
| `POST /api/sync/rescan` (server-local) | Shipped | Path-restricted by design |
| `POST /api/sync/github-rescan` | Built, unproven | No verify script; needs a live GitHub session |
| Facts-hash staleness detection | Shipped | `verify:mcp-sync`, `verify:sync-conflict` |
| Auth on `/api/sync/*` read routes | **Not built** | `status`, `events`, `scan-status` are unauthenticated |

### Direction B, Web to IDE

| Capability | Status | Evidence |
|-----------|--------|----------|
| `POST /api/wiki/finalize` writes markdown plus both sidecars | Shipped | `verify:handshake-writeback` |
| Save-to-staging (draft, not promoted) | Shipped | `refreshBlocksForDoc(doc, "web")`; asserted implicitly by acceptance needing `promote: true` |
| `promote: true` one-step escape hatch | Shipped | `verify:handshake-acceptance` |
| `POST /api/wiki/promote` batch plus lock regeneration | Shipped | E2E guide 1.5 and 1.6; durable run logs |
| `POST /api/wiki/pin-lock` | Shipped | E2E guide 1.7 |
| `POST /api/wiki/rollback` | Built, unproven | No verify script found |
| `GET /api/v1/scans/pull` full markdown plus lock | Shipped | `verify:handshake-pull` |
| `blocksmith pull` writes DESIGN.md, overrides, lock | Shipped | `verify:handshake-pull` simulates the exact writer calls |
| Delta-mode fallback for older servers | Built, unproven | `updateDesignMd`; no test exercises the fallback branch |
| `GET /api/v1/lock?format=file` | Built, unproven | No verify script; not wrapped by the SDK |
| Human prose survives a code rescan | Shipped | `verify:handshake-writeback` reparse assertion |

### MCP

| Capability | Status | Evidence |
|-----------|--------|----------|
| stdio transport | Shipped | `npm run mcp`; `npm run mcp:probe` |
| Remote Streamable HTTP at `/api/mcp` | Shipped | `scripts/verify-mcp-accept.ts` (manual, not in package.json) |
| Server instructions delivered on connect | Shipped | `mcp:probe` asserts the phrase "governed loop" |
| `governed_ui_task` prompt | Shipped | `mcp:probe` |
| Official-only reads for block-serving tools | Shipped | `enforce.ts`; `verify:handshake-acceptance` parity check |
| Official-only reads for palette and rules tools | **Not built** | `check_component_governance`, `get_governance_rules`, `validate_ui_code` read parsed markdown |
| `scan_workspace`, `get_design_tokens`, `get_component_docs`, `list_components`, `get_sync_status`, `get_component_history`, `log_component_work`, `check_component_governance`, `get_governance_rules`, `validate_ui_code` | Shipped | Each asserted or exercised by `mcp:probe` / `verify:mcp-sync` |
| `get_lockfile`, `get_block_versions` | Built, unproven | No verify script covers them |
| `check_governance_diff` with tiered findings and `## Next` | Shipped | `verify:governance-tiers`, `verify:governance-e2e` |
| `pulse_codegen` | Shipped | `verify:pulse`, `verify:cloud-api` |
| `import_figma_variables` | Shipped | `verify:figma-import` |
| `figma_token_drift` (tokens and components) | Shipped | `verify:figma-import` |
| Cursor one-click deeplink | Shipped | `CursorMcpInstall.tsx`; manually proven |
| `blocksmith setup cursor` merge-not-clobber | Built, unproven | No test covers the merge branch |
| `docs/MCP.md` documents all sixteen tools | **Stale** | Documents ten; the verify section still says nine |

### CLI and SDK

| Capability | Status | Evidence |
|-----------|--------|----------|
| Single-file esbuild bundle | Shipped | `packages/cli/build.mjs`; `dist/cli.js` is one 34 KB file |
| `login` / `whoami` / `mcp-url` | Shipped | E2E guide 3.2 |
| `pull` | Shipped | `verify:handshake-pull` |
| `scan` (three modes) | Partial | Local mode needs a BlockSmith checkout |
| `codegen` | Shipped | `verify:cloud-api` |
| `check` (text, json, github formats) | Shipped | E2E guide 3.5 |
| `check --strict` | **Not built** | Parsed, never read |
| `check --ci` | **Not built** | Read by the code, never declared as an option |
| `setup hooks` pre-push installer | Shipped | Idempotent marker merge; manually proven |
| `updates` and `fix` commands | Built, unregistered | Full implementations in `updates.ts` and `fix.ts`, absent from `cli.ts` |
| SDK client and types | Shipped | Bundled into the CLI and exercised by every CLI test |
| SDK filesystem writers | Shipped | Called directly by `verify:handshake-pull` |
| SDK README accuracy | **Stale** | Documents a `createClient` export that does not exist |

### Auth, conflicts, packaging

| Capability | Status | Evidence |
|-----------|--------|----------|
| `bs_live_` key mint, hash-at-rest, show-once | Shipped | `verify:cloud-api`, `verify:saas-acl` |
| Self-serve key panel plus revoke | Shipped | `ApiKeysPanel.tsx`; E2E guide 3.1 |
| Admin-secret key mint | Shipped | `docs/DISTRIBUTION.md` curl path |
| Supabase and local-file dual storage | Shipped | `verify:supabase`, `verify:cloud-api` |
| Scoped or expiring machine keys | **Not built** | `isAdmin` is derived from `!userId`; no scopes, no expiry |
| Document ACL on machine routes | Shipped | `verify:saas-acl`, `verify:org-rbac` |
| Rate limits on scans and pipeline writes | Shipped | E2E guide 2.2 |
| Document conflict 409 | Shipped, weakly tested | Route implements it; `verify:sync-conflict` reimplements rather than calls it |
| Conflict merge UI | Planned | `docs/08-web-ide-handshake.md` describes "UI shows diff; user picks or merges" |
| Registry conflict exclusion plus `resolveConflicts` | Shipped | `enforce.ts`, `promote` route |
| Lock drift detection plus `validate:ui` gate | Shipped | `scripts/validate-ui.ts`; E2E guide 3.6 |
| `@block-smith/cli` published to npm | **Not done** | No tags, no `.npmrc`; script exists and is ready |
| `@blocksmith/sdk` published separately | Deliberately not | Bundled into the CLI |
| `@blocksmith/protocol` published | **Not done** | Package is complete with a conformance suite |
| Protocol hash-drift gate | Shipped | `npm run protocol:conformance` |
| Open-core extraction of `src/lib/mcp` and `src/lib/scan` into packages | Planned | `LICENSING.md` rollout checklist, unchecked |
| Public repo split | Planned, on hold | `LICENSING.md` says explicitly: no public push or announcement yet |

---

## Open questions

1. **Should the palette and rules tools be official-only?** `check_component_governance`, `get_governance_rules`, and `validate_ui_code` read parsed markdown, so a saved-but-unpromoted prose edit reaches agents through them while `get_component_docs` correctly withholds it. Either the enforcement boundary should cover them, or the product should say plainly that prose is advisory and only block content is pinned. Right now it says neither.

2. **Should `verify:sync-conflict` call the finalize route?** It reimplements the hash comparison inline. `verify-handshake-pull.ts` imports the real route handler. Aligning them is small and closes a real hole.

3. **What is the machine-key privilege model?** `isAdmin: !record.userId` gives two levels and no scopes, no expiry, and no per-document restriction beyond the document ACL. A CI key that can only pull is a very common enterprise ask and is currently unexpressible.

4. **Where does `blocksmith scan <localPath>` live long term?** Requiring a BlockSmith checkout plus `BLOCKSMITH_ROOT` for the local path is the single sharpest edge in the CLI. Either the scan engine gets bundled (bigger artifact, better story) or the local-path mode should be deprecated in favour of `--github` and a future git-hosted-agnostic ingest.

5. **Ship `updates` and `fix`, or delete them?** Both are complete and unreachable, and `check` already tells users to run one of them. Dead code that appears in user-facing output is worse than no code.

6. **When does `src/lib/mcp` move into `packages/`?** The MCP server is on the intended-open list and is the highest-leverage adoption surface, yet it is entangled with the proprietary app. Nothing about the open-core story is real until that extraction happens.

7. **Should `/api/sync/status` and `/api/sync/events` require auth?** They are unauthenticated today. On the hosted product they leak watcher paths and doc metadata to anyone who guesses a doc ref.

8. **What is the versioning scheme?** Everything is 0.1.0, there are no tags, and nothing bumps. Independent semver per package or lockstep, decided before the first publish, not after.

9. **Does the conflict UI ship?** `docs/08-web-ide-handshake.md` promises "UI shows diff; user picks or merges". Today the answer is a 409 and a `force` flag. That is defensible for one developer and untenable for a team of ten.

10. **How does a customer discover their doc ref?** Every CLI command that matters takes `--doc upload:scan-….md`, which the user copies out of a URL. `.blocksmith/blocksmith.json` fixes this for `check` but not for `pull`. A `blocksmith docs` listing command, or making `pull` default to the repo config, would remove a paper cut that hits on the very first use.

---

## Where to look in the code

**MCP**
- `src/lib/mcp/blocksmith-server.ts`: the server factory, `SERVER_INSTRUCTIONS`, all sixteen tool schemas, every tool response renderer, the `governed_ui_task` prompt
- `src/lib/mcp/http-handler.ts`: stateless Streamable HTTP transport
- `src/mcp/server.ts`: stdio entrypoint (`npm run mcp`)
- `src/mcp/handlers.ts`: every tool handler, `resolveDocRef`, `formatBlockForAgent`
- `src/app/api/mcp/route.ts`: remote MCP route, `POST` / `GET` / `DELETE`, all key-gated
- `src/lib/ir/enforce.ts`: `listGovernedBlocks`, `listExcludedBlocks`, `getLockStatus`; the official-only boundary

**Sync**
- `src/lib/sync/watcher.ts`: chokidar singleton, document and workspace watchers, debounce windows
- `src/lib/sync/events.ts`: typed `syncBus`, Supabase Realtime broadcast
- `src/lib/scan/sync-status.ts`: `getWorkspaceScanSyncStatus`, the staleness model
- `src/app/api/sync/{status,events,scan-status,rescan,github-rescan}/route.ts`

**Web to IDE**
- `src/app/api/wiki/finalize/route.ts`: conflict gate, sidecars, save-to-staging
- `src/app/api/wiki/promote/route.ts`: the human gate, batch promote, durable run logs
- `src/app/api/wiki/{pin-lock,rollback}/route.ts`
- `src/app/api/v1/scans/pull/route.ts`: the pull payload
- `src/app/api/v1/lock/route.ts`: lock as JSON or as a download

**CLI**
- `packages/cli/src/cli.ts`: command registration, `DEFAULT_BASE_URL`, error hints
- `packages/cli/src/pull.ts`: the three-artifact write
- `packages/cli/src/check.ts`: tiers, deviations, formats, fail-open
- `packages/cli/src/setup-hooks.ts`: the pre-push hook body and marker merge
- `packages/cli/src/cursor-setup.ts`: `.cursor/mcp.json` writer and deeplink
- `packages/cli/src/{config,repo-config,resolve-workspace,git-files,scan-local,args}.ts`
- `packages/cli/src/{updates,fix}.ts`: implemented, unregistered
- `packages/cli/build.mjs`: the single-file bundle
- `packages/cli/package.json`: `@block-smith/cli`, bin `blocksmith`

**SDK**
- `packages/sdk/src/client.ts`: the `BlockSmith` class
- `packages/sdk/src/types.ts`: the machine-facing API contract
- `packages/sdk/src/design-md.ts`: `writeDesignMd`, `writeLock`, `updateWikiOverrides`, `updateDesignMd`

**Auth**
- `src/lib/cloud/api-keys.ts`: mint, hash, store, authenticate, revoke
- `src/lib/cloud/auth.ts`: `bearerFromRequest`, `requireApiKey`
- `src/lib/cloud/access.ts`: `requireDocumentAccess`
- `src/app/api/v1/auth/keys/route.ts`: admin-secret mint
- `src/app/api/v1/auth/keys/me/route.ts`: self-serve mint, list, revoke
- `src/components/wiki/ApiKeysPanel.tsx` and `src/components/wiki/CursorMcpInstall.tsx`
- `src/lib/cursor/mcp-deeplink.ts`: transport config, `.cursor/mcp.json` shape, deeplink
- `src/components/wiki/pages/SyncPage.tsx`: where the panels render

**Packages**
- `packages/protocol/`: `blocks.v1` spec, schemas, conformance suite, drift gate
- `packages/pulse-runtime/`, `packages/pretext-components/`, `packages/generated/acme-ui-kit/`
- `scripts/publish-packages.mjs`
- `LICENSING.md`, `LICENSE` (BSL 1.1), `LICENSE-MIT`

**Verification**
- `scripts/verify-handshake-pull.ts`, `verify-handshake-writeback.ts`, `verify-handshake-acceptance.ts`
- `scripts/verify-sync-conflict.ts`, `verify-mcp-sync-status.ts`, `verify-mcp-accept.ts`
- `scripts/verify-cloud-api.ts`, `scripts/mcp-probe-connector.ts`, `scripts/validate-ui.ts`

**Docs (read with a skeptical eye, several are stale)**
- `docs/08-web-ide-handshake.md`: the original handshake spec and acceptance checklist
- `docs/MCP.md`: connector setup; documents ten of sixteen tools
- `docs/DISTRIBUTION.md`: Patterns 2, 3, 4 and the v1 API reference
- `docs/NPM-PUBLISH.md`: stale relative to `scripts/publish-packages.mjs`
- `docs/E2E-TEST-GUIDE.md`: the authoritative manual test pass
- `.cursor/handshake-demo.md`, `.cursor/mcp.json.example`
