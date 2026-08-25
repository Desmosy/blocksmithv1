# Glossary: The Words We Use Precisely

**What this chapter covers:** every term of art in BlockSmith, alphabetized, with a one-line definition, a longer explanation where the word carries weight, the exact place it lives in the code, and the thing it is most often confused with.

**Why it matters:** sloppy vocabulary is how a team drifts. This project has several words that mean two different things depending on which file you are in (`drift`, `stale`, `surface`, `check`, `design.md`), and at least one pair of words that sound like synonyms and are not (`finalize` and `promote`). A cofounder who uses these loosely will write correct-sounding sentences that are wrong, and nobody will catch it until a customer does.

**Read this if:** you are reading any other chapter, reviewing a pull request, writing a support answer, or in a meeting where somebody said "the lock is stale" and you are not certain which of the two meanings they meant.

---

## How to read an entry

Each entry gives you four things in this order:

1. **A one-line definition.** If you only read one line, read that one.
2. **An explanation**, where the term is subtle enough to need it.
3. **Where it lives**, as real paths and real symbol names, so you can go look.
4. **Not to be confused with**, when there is a near-miss that has already caused confusion.

Terms marked **Not built yet** or **Planned** follow the status vocabulary in [STYLE.md](./STYLE.md). Cross-references point at other glossary entries in this chapter, or at other chapters by number.

One note on the quoted code. Type definitions and doc comments here are copied from the repository, with one exception: dash punctuation inside quoted comments has been rewritten to a colon or parentheses, per the style contract. The symbol names, field names, and meaning are unchanged. If you diff a snippet against source and the only difference is a colon where the file has a dash, that is why.

---

## A

### Adapter (ingest adapter)
**One line:** A module that reads an external source and emits `blocks.v1` blocks, and nothing else.

An adapter is one half of the protocol's shape: adapters compile **into** the block graph, compile targets compile **out of** it. The contract in `docs/PROJECT-PROTOCOL.md` is four rules. An adapter must output a `BlocksmithGraphV1` or an array of blocks suitable for `recordIngest()`, must set `contentHash` per spec, must pass the conformance fixtures for its output, and must **never write the wiki or Pulse directly**. That last rule is the important one. An adapter that touched the wiki would create a second path to truth, which is the thing the IR exists to prevent.

Shipped adapters: repo scan, markdown paste and upload, governance finalize, Figma, and Storybook.

**Where it lives:** `src/lib/scan/` (scan), `src/lib/figma/` (Figma), `src/lib/ingest/storybook.ts` (Storybook), `src/lib/ingest/capture.ts` (vision capture). The `IngestSource` union in `src/lib/ir/types.ts` names them: `"scan" | "markdown" | "governance" | "figma" | "paste" | "storybook" | "agent-template"`.

**Not to be confused with:** a **compile target**, which reads the graph rather than writing it. And not with `src/lib/figma/adapter.ts`, which is a narrower thing: the seam that flattens messy live Figma payloads before the deterministic import core sees them.

### Advisory tier
See **Governance tier**. Tier 3 in the product vocabulary. It has no representation in the `GovernanceTier` type, which is a real gotcha.

### agent-rule
**One line:** A `BlockType` for guidance written specifically for coding agents rather than for humans.

**Where it lives:** the `BlockType` union in `src/lib/blocks/types.ts` and `packages/protocol/src/types.ts`. Ids are minted as `agent-rule:guide` in `src/lib/blocks/extract.ts`. The payload field on `BlockContent` is `agentHint`.

### Append-only versions
**One line:** The rule that a block's version history is only ever added to, never edited or deleted.

Every change to a block writes a new `BlockVersionRecord`. Nothing is ever mutated in place and nothing is ever removed. Rollback is therefore not an undo, it is a pointer move (see **Official pointer**). This is one of the four constitutional semantics named in `docs/CEO-DIRECTIVE.md` as "law, not implementation detail", alongside the official pointer, conflict semantics, and stale-not-deleted.

**Where it lives:** `src/lib/ir/registry.ts`, storage at `.blocksmith/registry/<docKey>/<blockId>.json`.

---

## B

### Blast radius
**One line:** The copy shown in the promote diff drawer telling a user what else changes when they promote.

Concretely: "Updates lock, 3 compile targets, MCP tools". It exists because promote is a production action whose effects are invisible (a lock file regenerates, agents start behaving differently), and a UI that hides invisible consequences trains people to click without reading.

**Where it lives:** the `PromoteDiffDrawer` component, fed by `GET /api/wiki/pipeline/diff`, specified in `docs/PROJECT-PIPELINE.md` section 3.

### Block
**One line:** The atomic, addressable unit of design truth. The packet on the wire.

A block is one governed thing: a color token, a component, a guideline, a page section, an agent rule. It has a stable id, a type, a monotonic version number, a status, a provenance record, a typed content payload, and a content hash. Everything in BlockSmith is either a block, a container of blocks, or a renderer of blocks.

The type, verbatim from `src/lib/ir/types.ts`:

```ts
/** Atomic unit of design truth: the packet on the wire. */
export interface BlocksmithBlockV1 {
  id: string;
  type: BlockType;
  title: string;
  version: number;
  status: BlockStatus;
  source: { file: string; line?: number; ingest?: IngestSource };
  content: Record<string, unknown>;
  updatedAt: string;
  contentHash: string;
  finalizedAt?: string;
  editedBy?: EditOrigin;
}
```

Block ids follow the pattern `^[a-z0-9][a-z0-9:_-]*$` and are minted with a type prefix: `token:color:<slug>`, `token:typography:<slug>`, `token:spacing:<token>`, `token:surface:<level>`, `component:<id>`, `guideline:dos`, `guideline:donts`, `agent-rule:guide`, `page:introduction`, `page:<section.id>`.

**Where it lives:** `src/lib/ir/types.ts` (protocol shape), `src/lib/blocks/types.ts` (app shape, plus a thinner metadata-only `Block`), `src/lib/blocks/content.ts` (`BlockContent`, `StoredBlock`), `src/lib/blocks/extract.ts` (id minting), `packages/protocol/schemas/blocksmith.blocks.v1.json` (the published schema).

**Not to be confused with:** the marketing use of "block" for a shareable public UI fragment (see **ShareBlockKind**), and not with a "block" in the governance sense, where Tier 1 "block" is a verb meaning "fail the build".

### Block graph
**One line:** All the blocks for one design document, in one container, with a hash over the whole thing.

```ts
/** Graph container: what ingest adapters emit and compile targets read. */
export interface BlocksmithGraphV1 {
  schema: typeof BLOCKS_SCHEMA;
  docRef: string;
  systemId: string;
  contentHash: string;
  blocks: BlocksmithBlockV1[];
}
```

There is one graph per design document. Not per user, not per org (see [Chapter 18](./18-decisions-and-tradeoffs.md) D-02). The published schema describes its role directly: ingest adapters compile into this graph, compile targets compile out of it, one IR, many targets, no competing truths.

**Where it lives:** `src/lib/ir/types.ts`, `packages/protocol/src/types.ts`.

**Not to be confused with:** the **official graph**, which is the subset of the graph containing only promoted versions. Compile targets read the official graph, not the whole graph.

### BlockContent
**One line:** The typed payload stored per block, shared by the wiki and MCP so both read the same shape.

Fields: `summary`, `role`, `description`, `value`, `cssVar`, `group`, `agentHint`, `items`, `text`, `name`, `tagline`, `overview`, `radius`. All optional, because different block types populate different subsets.

**Where it lives:** `src/lib/blocks/content.ts`. `StoredBlock` is the on-disk wire shape that wraps it with `docRef`, `version`, `finalizedAt`, and `editedBy`.

### BlockStatus
**One line:** The four-state lifecycle of a block version: `draft`, `finalized`, `stale`, `conflict`.

From the published schema, in substance: `draft` is staged and never served to agents; `finalized` is promoted official truth; `stale` means the source vanished or the repo changed underneath it; `conflict` means two ingest sources disagree and a human must resolve.

**Where it lives:** `src/lib/blocks/types.ts` and `packages/protocol/src/types.ts`. Note the two copies list the members in a different order, which the CI drift gate does **not** check (it checks hashes and schema files only).

### BlockType
**One line:** The five kinds of block: `page`, `token`, `component`, `guideline`, `agent-rule`.

Only `token` and `component` auto-promote on scan ingest. That set is `SCAN_FACT_TYPES` in `src/lib/ir/registry.ts`, and it is the code expression of the "code wins, judgment waits" rule.

### `blocks.v1` / `blocksmith.blocks.v1`
**One line:** The published schema name for the Design IR graph format.

Constant: `export const BLOCKS_SCHEMA = "blocksmith.blocks.v1" as const;`. It is one of four published schemas, the others being `blocksmith.lock.v1`, `blocksmith.registry.v1`, and `blocksmith.compile-targets.v1`.

**Where it lives:** `packages/protocol/src/types.ts` (constants), `packages/protocol/schemas/*.json` and the byte-mirrored copies in `public/schema/*.json`, spec site at `/protocol`.

**Not to be confused with:** the Design IR as a **concept** (see **Design IR**). `blocks.v1` is the specific wire format that concept currently takes.

### `blocksmith.lock`
**One line:** The file in a customer's repository that pins block ids to promoted versions, exactly the way `package-lock.json` pins npm dependencies.

This is the artifact the whole product converges on. Agents and CI resolve against the lock and never against "latest markdown". Serialization is deterministic (ids sorted) so two builds of the same official graph produce byte-identical locks.

```ts
export interface BlocksmithLockV1 {
  schema: typeof LOCK_SCHEMA;
  docRef: string;
  systemId: string;
  /** Official graph hash at lock time (staleness sentinel). */
  contentHash: string;
  generatedAt: string;
  blocks: Record<string, { version: number; contentHash: string }>;
  package?: { name: string; pulseBuild?: string };
}
```

**Where it lives:** `src/lib/ir/lock.ts` (`buildLock`, `serializeLock`, `writeReferenceLock`, `readLock`, `readReferenceLockForDoc`, `referenceLockPath`, `verifyLock`), schema at `packages/protocol/schemas/blocksmith.lock.v1.json`. Locally, per-document reference locks live at `.blocksmith/locks/<docKey>.lock`, with a legacy single-lock mirror at `.blocksmith/blocksmith.lock`. In a customer repository it is written by `blocksmith pull` (`packages/cli/src/pull.ts`) next to `DESIGN.md`.

**Note the per-document path.** The comment in `lock.ts` explains why: promoting document A must never clobber document B's pin.

**Not to be confused with:** `.blocksmith/blocksmith.json`, which is the small config file `blocksmith setup hooks` writes to remember a document reference. Different file, different job.

---

## C

### Capture / capture draft
**One line:** A design system extracted from screenshots by a vision model, marked as a draft pending human review and never allowed into a lock.

The capture path lets a user screenshot any design in any tool (Canva, Figma, Adobe, a live site) and get a `design.md`. Because vision values are estimates, the resulting document carries a provenance footer and the machine-readable marker `<!-- blocksmith:capture-draft -->`. While that marker is present, the wiki shows a "Captured draft" banner on every page of the document. Confirming strips the marker via `/api/wiki/source`. The lifecycle is: capture, draft project with banner, human edits, confirm, regular project.

**Where it lives:** `src/lib/ingest/capture.ts`, `src/app/api/ingest/capture/route.ts`, the MV3 extension in `extension/`, banner at `src/components/wiki/CaptureDraftBanner.tsx`. Documented in `docs/DESIGN-FIRST-INGEST.md` phase 1.

**Not to be confused with:** the restyle-the-web extension (see **Extension track**). Both are browser extensions and they are different products for different audiences.

### Catalog / catalog category
**One line:** The classifier that decides whether a scanned React component belongs in the design system wiki, and under what heading.

Nine categories: `design_primitive`, `token_showcase`, `design_pattern`, `rendering_infra`, `app_chrome`, `dev_tool`, `utility`, `page_shell`, `unknown`. A scan of a real repository finds hundreds of `.tsx` files, and most of them are not design system components. Without a classifier the wiki would be a file listing.

**Where it lives:** `src/lib/scan/catalog.ts` (`CatalogCategory`, `CatalogDecision`, `classifyComponentForWiki`, `applyCatalogOverrides`, `categoryLabel`), with an additional filter at `src/lib/scan/component-filter.ts` (`isScannableDesignComponent`).

### `blocksmith check`
**One line:** The CLI command that lints changed UI files in a customer repository against the promoted governance rules of a design system.

Runs from a pre-commit hook, a pre-push hook, or CI. Tier 1 findings fail the command. Tier 2 findings warn and are captured to the wiki's Violations feed. Exit codes are `0` for clean or warn-captured, `1` for blocking (or a `--strict` warning with no `--reason`), and `2` for misconfiguration. It **fails open** on network and CLI errors, so a flaky connection never bricks a push.

**Where it lives:** `packages/cli/src/check.ts`, scope resolution in `packages/cli/src/git-files.ts`, server side in `src/lib/governance/check-diff.ts`. Hook installation via `blocksmith setup hooks` in `packages/cli/src/setup-hooks.ts`.

**Not to be confused with:** `npm run governance:check` (`scripts/governance-gate.ts`), which is BlockSmith's own internal gate over its own repository and scans only added lines. Same word, different tool, different repository.

### Compile target
**One line:** A consumer that reads the official graph and emits an artifact: the wiki, an npm package, MCP tool payloads, a device profile, a C header.

The registered targets, from `packages/protocol/compile-targets.v1.json`:

| id | Official only | Output | Reference |
|---|---|---|---|
| `wiki` | no | HTML and React wiki | `src/components/wiki` |
| `pulse-react` | yes | npm package | `src/lib/codegen` |
| `mcp` | yes | tool payloads | `src/lib/ir/enforce.ts` |
| `device-sim` | yes | JSON profile | `src/lib/ir/targets/device-sim.ts` |
| `c-header` | yes | `tokens.h` | `src/lib/ir/targets/c-header.ts` |
| `lvgl` | yes | LVGL style pack | Planned, registered as a stub |

`wiki` is the only target with `officialOnly: false`, and the manifest says why: it is the human console, the only target allowed to preview drafts.

**Where it lives:** `CompileTargetV1` and `CompileTargetsManifestV1` in `packages/protocol/src/types.ts`, manifest at `packages/protocol/compile-targets.v1.json` mirrored to `public/schema/blocksmith.compile-targets.v1.json`.

**Not to be confused with:** an **adapter**, which points the other way.

### `ComponentInterface`
**One line:** The structural description of a component (props, variants, defaults, inherited types, whether it renders children, and its root JSX element) extracted from a `.tsx` file.

This type is the thing that made faithful codegen possible. Before it existed, the scan knew a component's file path and its exports and nothing about its shape, so the generator could only stamp `<div>` stubs.

```ts
export interface ComponentInterface {
  name: string;
  props: PropSpec[];
  extendsTypes: string[];
  hasChildren: boolean;
  propsTypeName?: string;
  rootElement?: string;
}
```

Each `PropSpec` is `{ name, type, optional, default?, variants? }`, where `variants` holds string-literal union members.

**Where it lives:** `src/lib/scan/component-interface.ts`. The extractor uses `ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)`, the TypeScript **syntactic** API, with no type checker and no module resolution. It handles `FC`, `FunctionComponent`, `VFC`, `forwardRef`, `memo`, interface heritage, intersections with HTML attribute types, and default exports. Guarded by `npm run verify:component-interface`.

**Not to be confused with:** `ComponentScanMeta`.

### `ComponentScanMeta`
**One line:** The parse-side twin of a scanned component: what you get back after a scan document has been written to markdown and read again.

Shape: `{ sourceFile, exports[], cssVarsUsed[], colorsUsed[], interface?, source? }`. It hangs off `ComponentDoc.scan`.

**Where it lives:** `src/lib/blocks/types.ts`, **not** `src/lib/scan/types.ts`, which is genuinely surprising and worth remembering.

**Not to be confused with:** `ScannedComponent` in `src/lib/scan/types.ts`, which is the write-side shape produced by the scanner. The two describe the same thing on opposite sides of the markdown round trip.

### Conflict
**One line:** A block status meaning two ingest sources disagree about the same block id, so promote is blocked until a human resolves it.

The canonical example: the Figma file says the accent is `#3B82F6` and the code scan says `#2563EB`. BlockSmith does not pick. It records a conflict and puts a red card in the Pipeline's staging lane. `promoteBlock` refuses with "Block is in conflict, resolve the disagreeing sources before promoting."

**Where it lives:** `resolveConflict()` in `src/lib/ir/registry.ts`, surfaced through `POST /api/wiki/promote` with `resolveConflicts: true`.

### Content hash
**One line:** A deterministic `sha256:`-prefixed digest of a block's id, type, and canonical content, used to detect whether anything actually changed.

`blockContentHash(id, type, content)` produces `sha256:<first 32 hex chars>` over the string `` `${id} ${type} ${canonicalJson(content)}` ``, where `canonicalJson` sorts object keys recursively and preserves array order. Every hash in the system matches `/^sha256:[0-9a-f]+$/`.

**Where it lives:** `src/lib/ir/hash.ts`, mirrored byte-identically in `packages/protocol/src/hash.ts`. The file header marks it `CONSTITUTIONAL: must stay byte-identical`.

**Not to be confused with:** the **graph hash**, which is a digest over the whole graph and is the lock's staleness sentinel. Also not the **scan facts hash**, which is a different digest with a different job.

### Control plane
**One line:** The half of BlockSmith that represents design truth as versioned blocks and governs their promotion: registry, lock, promote, rollback, enforce.

The word comes from networking, and it is used here in the same sense: the control plane decides what is true, the data path carries it. The control plane is the strongest part of the system and the claimed moat. It is deliberately not a separate application (see [Chapter 18](./18-decisions-and-tradeoffs.md) D-01), so it is reached through wiki routes rather than an admin console.

**Where it lives:** `src/lib/ir/`, surfaced at `/wiki/pipeline` and `/wiki/releases` and through `src/app/api/wiki/`.

**Not to be confused with:** the **output plane** (compile targets) and the **ingest plane** (adapters). The three-plane split in [Chapter 20](./20-your-first-ninety-days.md) is the fastest way to locate any question.

### Curate / curated scan
**One line:** An optional LLM pass over a raw scan that improves prose without touching facts.

A scan document produced with curation carries the frontmatter marker `blocksmith-source: workspace-scan-curated` instead of `workspace-scan`. Deterministic sections (the inventory in particular) are explicitly never LLM-edited: the code comment says "deterministic, never LLM-edited". Disabled with `AI_LAB_SCAN_CURATE=0`, which is what `npm run scan:vendor` does.

**Where it lives:** `resolveScanMarkdownForWiki` in the scan run pipeline, `isCuratedWorkspaceScanMarkdown` in `src/lib/scan/parse.ts`, inventory guard in `src/lib/scan/inventory.ts`.

---

## D

### `DESIGN.md` (uppercase)
**One line:** The file BlockSmith **writes into the customer's repository**, carrying the promoted design system for agents that read repo context.

**Where it lives:** written by `src/lib/scan/design-md.ts` (`updateDesignMd`), `packages/sdk/src/design-md.ts` (`writeDesignMd`, `updateWikiOverrides`), `packages/cli/src/pull.ts`, and `src/app/api/v1/scans/pull/route.ts`. The destination is resolved by `packages/cli/src/resolve-workspace.ts`, in the order: explicit flag, then scan path, then git root, then current directory. `blocksmith.lock` is written next to it. It also carries per-component end markers (`<!-- blocksmith-end-<componentId> -->`) so a rewrite can find its own previous output.

**Not to be confused with:** `design.md` (lowercase). These are genuinely different files pointing in opposite directions, and the case difference is the only thing distinguishing them.

### `design.md` (lowercase)
**One line:** The markdown document BlockSmith renders as a wiki, and the universal interchange format that every ingest path funnels into.

Every source (paste, upload, GitHub scan, local scan, Figma, screenshot capture, AI generation) produces one of these. It lives at `data/uploads/design-*.md` or `data/uploads/scan-*.md` locally, and in the private Supabase `scan-docs` bucket when hosted. Its frontmatter declares its origin, most commonly `blocksmith-source: workspace-scan`.

Making every source converge here is the reason Figma import took days rather than weeks: the Figma path builds a synthetic `WorkspaceScanResult` and calls `workspaceScanToMarkdown`, and the wiki, parser, governance, and MCP work on the result unchanged.

**Where it lives:** written by `src/lib/scan/to-markdown.ts`, read by `src/lib/scan/parse.ts`, stored via `src/lib/uploads/store.ts` and `src/lib/uploads/persist.ts`.

**Not to be confused with:** `DESIGN.md`. Also note that a scan **reads** any existing `DESIGN.md`, `design.md`, `DESIGN_SYSTEM.md`, or `docs/DESIGN.md` in the vendor repo and lists them under "Existing design documents" with the explicit note that they are not merged automatically.

### Design IR
**One line:** The neutral, canonical JSON representation of a design system where every source merges and every target reads.

IR means intermediate representation, borrowed from compilers, and the analogy is exact. Figma's file format is one front end. A React repository is another. The wiki, an npm package, MCP tool payloads, and a C header are back ends. The IR is the neutral middle where they meet, and it is deliberately none of them: not how Figma stores a file, not how your repo stores `Button.tsx`, not raw markdown.

The category pitch that follows from this: Figma is Ethernet, BlockSmith is TCP/IP. We do not need to own every design tool. We define what the middle packet looks like.

**Where it lives:** conceptually across `src/lib/ir/`; concretely as `blocks.v1`.

**Not to be confused with:** `design.md`, which is the human-readable document form. The IR is the graph the document compiles into.

### Device profile
**One line:** A compile target output describing a design system as embedded UI constraints for a specific hardware frame: a watch, an HMI panel, a kiosk.

```ts
export interface DeviceProfile {
  schema: "blocksmith.device-sim.v1";
  docRef: string;
  /** Graph hash: must match blocksmith.lock for the build to be trusted. */
  graphHash: string;
  frame: DeviceFrame;
  minTouchPx: number;
  tokens: DeviceToken[];
  widgets: DeviceWidget[];
  constraints: DeviceConstraint[];
  invariants: string[];
}
```

Three frames ship: `watch-240` (240 by 240, round, 7.5 px/mm), `watch-396` (396 by 396, round, 9.8 px/mm), and `hmi-480` (480 by 320, landscape, 6.3 px/mm). Minimum touch target is 9mm physical, converted to pixels per frame.

The point of this target is not the simulator. It is proof that the IR is real for atoms and not only for React, which is the first rung of the hardware ladder in `docs/CEO-DIRECTIVE.md`.

**Where it lives:** `src/lib/ir/targets/device-sim.ts` (`compileDeviceSim`, `deviceCompileLoss`, `DEVICE_FRAMES`), CLI at `npm run compile:device` (`scripts/compile-device.ts`, writing to `.blocksmith/targets/<docKey>/device-<frame>.json`), UI at `/demo/device` and `src/components/demo/DeviceSimDemo.tsx`.

**Not to be confused with:** `tokens.h`, which is a different compile target (`c-header`) for embedded C.

### Doc ref (`docRef`)
**One line:** The stable identifier for one design document, and therefore for one design system, one block graph, one wiki, one package, and one lock.

Format examples: `upload:scan-acme-mobile-app.md`, `upload:scan-figma-5myhpqssth35kakgfgfl4a.md`, `demo:investor.md`. Almost every function in the control plane takes one as its first argument. A `docKey` is the filesystem-safe transform of a `docRef` used for paths like `.blocksmith/locks/upload_scan-acme-ui-kit.md.lock`.

**Not to be confused with:** the `systemId`, which is a human-facing name for the design system, and the Pulse package slug, which is derived from the doc ref (`upload:scan-acme-mobile-app.md` becomes `@blocksmith/acme-mobile-app` via `packageNameForDoc` in `src/lib/ir/releases.ts`).

### Draft
**One line:** A block version that exists in the registry, is visible to humans in the wiki, and is invisible to agents until a human promotes it.

Draft is the staging state of design CI/CD. It is created by governance edits in the wiki, by vision-only claims in the Figma fusion pass, and by any ingest whose block type is not a scan fact. It is never written into a lock and never served by MCP. That exclusion is the enforcement boundary.

**Where it lives:** the `BlockStatus` union; the filter in `listGovernedBlocks()` at `src/lib/ir/enforce.ts`; the staging lane in `src/lib/ir/pipeline.ts`.

**Not to be confused with:** a **capture draft**, which is a whole document marked as provisional, not a block version state.

### Drift
**One line:** Three different things in this codebase. Always say which one.

| Sense | Meaning | Where |
|---|---|---|
| **Lock drift** | Pins in `blocksmith.lock` no longer match the official pointer, or blocks are missing on one side | `LockStatus.drift` in `src/lib/ir/enforce.ts`, `PipelinePayload.driftCount` in `src/lib/ir/pipeline.ts` |
| **Figma drift** | "Figma says X, shipped code says Y", at token and component-variant level | `src/lib/figma/drift.ts`, `src/lib/figma/component-drift.ts`, `POST /api/figma/drift`, MCP `figma_token_drift` |
| **Hash and schema drift** | The app's hashing implementation has diverged from the protocol package's, or the published schemas have diverged from the package's | `packages/protocol/conformance/drift.ts`, run by `npm run protocol:conformance` |

There is a fourth informal usage: "design drift", meaning the general phenomenon the whole company exists to prevent. That one is fine in prose and useless in a bug report.

`driftCount` on the Pipeline payload is computed as `versionMismatches.length + missingInLock.length + missingInRegistry.length`, and it backs the banner copy "N PRs would fail validate:ui".

---

## E

### Enforce / enforcement boundary
**One line:** The filter that decides what an agent is allowed to see: official versions only, drafts and conflicts and stale and never-promoted blocks excluded.

`listGovernedBlocks(docRef)` returns what an agent may execute against. `listExcludedBlocks(docRef)` returns what was withheld and why, with reasons `"draft" | "conflict" | "stale" | "unpromoted"`. That second function exists so the product can explain itself rather than silently omitting things.

**Where it lives:** `src/lib/ir/enforce.ts`. Also `getLockStatus(docRef)` for lock freshness and `getRegistrySummary(docRef)`.

### Extension track
**One line:** The future product where a browser extension analyzes any webpage and emits a `design.md` from the live DOM and CSS.

This is the north-star surface: restyle anything on the internet, then eventually control hardware UI the same way. It is deliberately kept separate from the Figma-fit wedge, because a Figma-centric design-system team does not care that you can scrape someone else's site. See [Chapter 18](./18-decisions-and-tradeoffs.md) D-18.

**Status:** Idea, with the shared engine already built. **Not built yet** as a product.

**Not to be confused with:** the **capture extension** in `extension/`, which is shipped, does screenshots of design tools, and serves the ingest story rather than the restyle story. Two different browser extensions with two different jobs.

---

## F

### Finalize
**One line:** The wiki action that saves a human edit as a new **draft** version, and only promotes it when explicitly asked to.

This is the single most misleading word in the vocabulary. Every strategy document in `docs/` treats "Finalize" as a synonym for "promote", because that is what it meant in the original design. In the shipped code it is not.

`POST /api/wiki/finalize` writes the markdown and overrides, then re-ingests the change as `editedBy: "web"`, which records a new **draft** version. This is the "save to staging" behavior. Passing `promote: true` in the body is described in the route as the explicit one-step escape hatch: it additionally calls `promoteBlock` and `writeReferenceLock`. The route also supports `baseContentHash` and `force` for conflict detection against concurrent edits.

**Where it lives:** `src/app/api/wiki/finalize/route.ts`.

**Not to be confused with:** `POST /api/wiki/promote`, which is the batch human gate and always promotes. If you are reading a strategy document that says "Finalize is promote", it is describing intent, not the current route behavior. This gap is worth closing.

### Fingerprint / scan facts hash
**One line:** A digest over a scan's factual content only, excluding timestamps and human prose, used to tell whether a re-scan actually found anything different.

`scanResultFingerprint()` hashes inventory, components, CSS vars, CSS rules, utility classes, and colors into a 16-character sha256 slice. It is injected into the scan document's frontmatter as `scan-facts-hash:`.

**Where it lives:** `src/lib/scan/fingerprint.ts`, injected by `injectScanFactsHash` in `src/lib/scan/to-markdown.ts`.

**Not to be confused with:** **content hash** (per block) or **graph hash** (per graph). This one is per scan, and it exists so that a re-scan that changed nothing does not churn versions.

### Figma-fit wedge
**One line:** The chosen go-to-market wedge: import a Figma design system into `design.md`, then reconcile it against code and sell the drift.

The positioning line: BlockSmith does not replace Figma's canvas. Figma is the design source of truth, the repo is the code source of truth, and `design.md` is the neutral contract both reconcile against.

**Where it lives:** `src/lib/figma/`, `docs/FIGMA-IMPORT.md`, and [Chapter 18](./18-decisions-and-tradeoffs.md) D-12 through D-15.

### Fusion
**One line:** The Figma ingest pass that combines the node tree (exact values, no semantics) with vision output (semantics, approximate values).

Figma's tree gives you `#2563EB` and the layer name "Frame 427". Vision gives you "primary action button" and a color that is roughly right. Fusion anchors each vision claim to node ids so every block traces to a `node-id` the way scan blocks trace to `file:line`, then takes names and roles from vision and values from the tree. Tree-backed values ingest like scan facts; vision-only claims stage as drafts.

**Where it lives:** the Figma connector path in `src/lib/figma/rest.ts` plus vision, documented in `docs/DESIGN-FIRST-INGEST.md` phase 2. **Shipped.**

---

## G

### Governance copilot
**One line:** The AI feature that drafts a component's role and usage rules from a prompt, for a human to review and promote.

The doctrine is one line: AI proposes, wiki disposes. The copilot never writes official truth, only drafts.

**Where it lives:** `POST /api/wiki/governance/draft`, `src/components/wiki/GovernanceCopilotPanel.tsx`, verified by `npm run verify:governance-copilot` (which skips itself when `NVIDIA_API_KEY` is unset). Documented in `docs/GOAL2-GOVERNANCE-COPILOT.md`.

### Governance event
**One line:** A recorded violation, pushed from a customer's repository into the wiki's Violations feed.

`GovernanceEvent` carries a status (`open`, `acknowledged`, `resolved`), a source (`mcp`, `cli`, `git-hook`, `ci`), and an action (`detected`, `overridden`, `bypass`). The loop is: customer repo, `blocksmith check`, `POST /api/v1/governance/events`, Supabase, wiki Violations feed.

**Where it lives:** `src/lib/governance/types.ts`, `src/app/api/v1/governance/events/route.ts` (POST, GET, PATCH), feed UI in `src/components/wiki/GovernanceViolationsPanel.tsx`. Verified by `npm run verify:governance-tiers`.

### Governance tier
**One line:** The escalation level of a rule: Tier 1 blocks, Tier 2 warns and captures, Tier 3 advises an agent before it writes code.

There are **two coexisting vocabularies** and you need both.

The product vocabulary, from `docs/GOVERNANCE-TIERS.md`:

| Tier | What | Where it fires | Outcome |
|---|---|---|---|
| 1 Block | Off-token hex, stale or missing lock (machine-verifiable) | pre-commit, CI, `blocksmith check` | Fails. Bypass only via `git push --no-verify`, logged |
| 2 Warn | Component prose rules (inactive links, stale dates) | pre-push, CI, `blocksmith check` | Warning plus capture to the wiki. Push proceeds unless `--strict` |
| 3 Advisory | Agent-time guidance | MCP `check_governance_diff` before coding | Prescriptive: nearest token plus a prioritized next step |

The type vocabulary, from `src/lib/governance/types.ts`:

```ts
/** Machine-verifiable → fail commit/CI. Prose → warn + capture override. */
export type GovernanceTier = "block" | "warn";
```

Tier 1 is `tier: "block"`. Tier 2 is `tier: "warn"`. **Tier 3 is not a `GovernanceTier` value at all.** It is a delivery channel: the `suggestion?: string` field on `GovernanceFinding`, populated by `nearestToken()`. If you go looking for a `"advisory"` member you will not find one, and that is not a bug.

Rule ids in use: `off-token-color` at block tier; `inactive-link`, `stale-date`, `stale-address` at warn tier.

**Where it lives:** `src/lib/governance/types.ts`, `color-lint.ts`, `prose-lint.ts`, `check-diff.ts`, and `packages/sdk/src/types.ts` which duplicates the union.

### Graph hash
**One line:** An order-independent digest over every `(id, version, contentHash)` triple in a graph. The lock stores it, and CI compares it against the live registry.

Lines are formatted `${id}@${version}:${contentHash}`, sorted, joined with newlines, and hashed. Order independence matters because two builds that enumerate blocks in a different order must produce the same lock.

**Where it lives:** `graphHash()` in `src/lib/ir/hash.ts` and `packages/protocol/src/hash.ts`.

### Guideline
**One line:** A `BlockType` for prose rules: the dos and don'ts of a design system. Ids are `guideline:dos` and `guideline:donts`.

---

## H

### Handshake
**One line:** The two-way link between the web wiki and the IDE workspace, so that a change finalized on either side appears on both.

Direction A, IDE to web: a save on `src/components/**`, `tailwind.config.*`, `DESIGN.md`, or `CLAUDE.md` triggers a scan or watcher run, parsers refresh the affected blocks, and the wiki updates. Direction B, web to IDE: a human edits and finalizes in the wiki, and the change writes back into repo files.

In the product UI, the **handshake panel** is the concrete artifact of this: one screen with four steps, so a new team needs zero tribal knowledge.

1. Pull the lock into your repo: `blocksmith pull --doc <doc>`
2. Import the package: `import { Button } from "@blocksmith/<slug>"`
3. Gate CI on the lock: `npm run validate:ui -- --range ...`
4. Point agents at MCP: `/api/mcp` with a `bs_live_` bearer token, tools reading promoted versions only

**Where it lives:** `HandshakePanel` in `src/components/wiki/pages/ReleasesPage.tsx`, embedded in the Pipeline page. Conceptually specified in `docs/08-web-ide-handshake.md`. Verified by `verify:handshake-writeback`, `verify:handshake-pull`, and `verify:handshake-acceptance`.

---

## I

### Ingest
**One line:** Two things: the act of getting design truth into the system, and the registry operation that turns incoming blocks into versions.

As a **stage**, ingest is the first step of design CI/CD: sources become a block graph. As an **operation**, `recordIngest()` applies four rules:

```
- New id                                     → version 1
- Same id, same contentHash                  → no-op
- Same id, changed contentHash               → version N+1
- Id in registry, absent from ingest         → latest marked "stale"
```

That last rule only applies to a full source-of-truth scan. A partial ingest passes `options.partial`, and blocks absent from that pass are **not** staled, because a partial adapter has no authority to declare something gone.

Auto-promote fires when the block type is a scan fact (`token` or `component`) and `editedBy === "ingest"`, or when it is version 1 already marked finalized.

**Where it lives:** `src/lib/ir/registry.ts` (`recordIngest`, `IngestReport` with `created`, `bumped`, `unchanged`, `staled`, `conflicts`, `versions`, `official`). `"ingest"` is also a value of `EditOrigin` and of `PipelineRunAction`.

### Invariant
**One line:** A semantic property a compile target must preserve, recorded on the device profile so that compiling down to hardware can be checked rather than assumed.

**Where it lives:** `DeviceProfile.invariants` and `deviceCompileLoss()` in `src/lib/ir/targets/device-sim.ts`.

---

## L

### Lane
**One line:** One column of the Pipeline console: ingest, build, staging, production, locked, deployed.

In the code, `PipelineLanes` is narrower than the visual design: `staging` (drafts, never-promoted blocks, and conflicts, meaning what promote would ship), `production` (blocks with an active official pointer), and `lockedIds` (block ids pinned in the current reference lock).

**Where it lives:** `src/lib/ir/pipeline.ts`, rendered by `StageLane` and `BlockCard`, fed by `GET /api/wiki/pipeline`.

### Lock staleness
**One line:** The condition where a lock's stored graph hash no longer matches the live official graph, meaning somebody promoted after the lock was written.

The predicate is one line in `src/lib/ir/lock.ts`:

```ts
const stale = lock.contentHash !== registryHash;
```

`verifyLock()` detects four things: a stale lock (graph hash drift), version pins that no longer match the official pointer, blocks promoted but missing from the lock and the reverse, and content hash forgery or corruption. The result type is `LockVerification`, with fields `ok`, `stale`, `missingInLock`, `missingInRegistry`, `versionMismatches`, `hashMismatches`, `lockHash`, `registryHash`.

The protocol package carries a twin, `verifyLockAgainstGraph`, whose failure message reads "lock is STALE: pinned X, graph is Y".

**Where it lives:** `src/lib/ir/lock.ts`, `packages/protocol/src/validate.ts`.

**Not to be confused with:** a **stale block**. Both use the word "stale" and they are unrelated conditions. A stale block means its source vanished. A stale lock means somebody promoted since you last pulled.

### Lock strip
**One line:** The persistent bar at the top of the Pipeline console showing lock state and the one action that state calls for.

Three states with three different primary actions: **no lock** ("Production graph ready, pin your repo to enforce agents" with a **Pin production lock** button), **stale** ("Promoted after last pull, teams are drifting" with **Copy pull**), and **fresh** ("Agents and CI pinned to this graph" with **Copy lock**).

**Where it lives:** `LockStrip` in the Pipeline components, specified in `docs/PROJECT-PIPELINE.md` section 1.

---

## M

### MCP (Model Context Protocol)
**One line:** The protocol coding agents use to call BlockSmith's tools, and the surface where the enforcement boundary is applied to agents.

BlockSmith runs an MCP server two ways: over stdio for a local IDE (`npm run mcp`, `src/mcp/server.ts`) and over HTTP for hosted use (`POST /api/mcp`, stateless, one server and transport per request). The server is named `"blocksmith"`.

**Sixteen tools are registered.** In declaration order:

| Tool | Purpose |
|---|---|
| `scan_workspace` | Scan a vendor repo (github, fixture, or workspace) and refresh the wiki |
| `import_figma_variables` | Import a Figma library into a governed `design.md` |
| `figma_token_drift` | Reconcile Figma tokens against a code scan |
| `get_design_tokens` | Colors, type, spacing, surfaces |
| `get_component_docs` | Component specs by name |
| `list_components` | All components with short summaries |
| `get_sync_status` | Watcher state, block index, content hash, scan staleness |
| `get_component_history` | Shared work log per component |
| `log_component_work` | Append to the activity ledger |
| `check_component_governance` | Pre-flight spec, palette, dos and don'ts, proposed color |
| `get_governance_rules` | Allowed palette, guidelines, component count |
| `pulse_codegen` | Generate the `@blocksmith/<slug>` package |
| `get_lockfile` | Return `blocksmith.lock` and report staleness |
| `get_block_versions` | Version history per block id |
| `validate_ui_code` | Lint code the agent is about to write, returning off-token colors |
| `check_governance_diff` | Tier 2 prose plus Tier 1 color check, optionally recording a violation |

One prompt is registered: `governed_ui_task`, with optional `task` and `component` arguments.

**Where it lives:** definitions and dispatch in `src/lib/mcp/blocksmith-server.ts`, implementations in `src/mcp/handlers.ts`, HTTP transport in `src/lib/mcp/http-handler.ts` and `src/app/api/mcp/route.ts`, Cursor deeplink helper in `src/lib/cursor/mcp-deeplink.ts`, probe at `npm run mcp:probe`.

**Documentation warning:** `docs/MCP.md` describes nine to ten tools and is out of date. Six tools registered in code are missing from it: `import_figma_variables`, `figma_token_drift`, `pulse_codegen`, `get_lockfile`, `get_block_versions`, and `check_governance_diff`. Trust the code.

---

## N

### Nearest token
**One line:** Given an off-palette hex, the closest approved token by squared RGB distance, used to turn a violation into a prescriptive fix.

This is the mechanism behind Tier 3. Telling an agent "that color is wrong" produces another guess. Telling it "use `--color-accent` (#2563EB)" produces a correction. A distance of zero is reported as an exact token match.

**Where it lives:** `nearestToken()` in `src/lib/governance/color-lint.ts`, returning `{ name, hex, cssVar?, distance }`.

---

## O

### Official / official pointer
**One line:** The per-block integer pointing at the promoted version. It is the definition of "production", and it is the only version a lock may pin or an agent may read.

```ts
export interface BlockRegistryEntry {
  id: string;
  /** Version number currently promoted (lock-eligible). Absent = never promoted. */
  official?: number;
  versions: BlockVersionRecord[];
}
```

Absent means never promoted, and the published schema is explicit that agents must not consume such a block. The protocol validator refuses a pointer that references a version not present in `versions`.

Promote advances the pointer. Rollback moves it back to the highest earlier version that has a `finalizedAt`. Neither ever deletes anything.

**Where it lives:** `src/lib/ir/types.ts`, `src/lib/ir/registry.ts`, `packages/protocol/schemas/blocksmith.registry.v1.json`.

### Official graph
**One line:** The subset of a block graph containing only promoted versions. What compile targets and agents read.

Validation with `officialOnly: true` rejects any graph containing `draft` or `conflict` blocks, with the message that an official graph must not contain them because agents and compile targets read promoted versions only.

**Where it lives:** `getOfficialBlocks()` and `getOfficialGraph()` in `src/lib/ir/registry.ts`, `officialGraphHash()`, and `GraphValidationOptions.officialOnly` in `packages/protocol/src/validate.ts`.

### Off-token color
**One line:** A hex color in code that is not a defined token in the design system. The canonical Tier 1 violation.

Detected exactly, not heuristically. The lint ignores `transparent`, `currentcolor`, `inherit`, and `none`. Findings carry a hex, a 1-indexed line number, and a snippet capped at 100 characters.

**Where it lives:** `findOffTokenColors()` in `src/lib/governance/color-lint.ts`, whose header states the point: the commit and CI gate and the live MCP `validate_ui_code` tool apply the exact same rule, so coding-time and push-time enforcement agree.

### Open core
**One line:** The licensing model: MIT for the CLI, SDK, and protocol spec; Business Source License 1.1 for the hosted application, converting to Apache-2.0 on 2030-06-23.

The default is proprietary. Anything not explicitly listed as open is BSL. Status is **internal**: the boundary exists in files, and nothing has been pushed publicly.

**Where it lives:** `LICENSING.md`, `LICENSE` (BSL), `LICENSE-MIT`, and per-package `LICENSE` files under `packages/cli`, `packages/sdk`, `packages/protocol`.

### Org
**One line:** The tenant: a team on BlockSmith that owns documents, holds members with roles, issues API keys, and scopes every access check.

Roles are ordered, and `roleAtLeast(role, "admin")` is the comparison used at gates such as publishing a document publicly. Membership grants access to a shared artifact; it does not fork one (see [Chapter 18](./18-decisions-and-tradeoffs.md) D-02).

**Where it lives:** `src/lib/cloud/orgs.ts`, `src/lib/cloud/rbac.ts`, `src/lib/cloud/access.ts`, `src/lib/cloud/wiki-access.ts` (`assertWikiDocAccess`, default-deny), invite route at `src/app/api/v1/orgs/invite/route.ts`.

### Output plane
**One line:** The half of the system that emits artifacts from the graph: the wiki, Pulse packages, MCP payloads, device profiles, `tokens.h`.

Honest state: the thinnest of the three planes, and the one most likely to be a new cofounder's first ownership area.

**Not to be confused with:** the **control plane**, which decides what is true, and the **ingest plane**, which gets truth in.

---

## P

### Pin lock
**One line:** The action that writes a lock from the current official graph when everything is already promoted and no lock exists.

This exists to fix a specific dead end. Because scan facts auto-promote, a fresh scan leaves forty blocks live, nothing in staging, and no lock. The Pipeline would otherwise show a user nothing to do while their agents remain unpinned. `POST /api/wiki/pin-lock` is the answer, and **Pin production lock** is the lock strip's primary call to action in that state.

**Where it lives:** `src/app/api/wiki/pin-lock/route.ts`, calling `writeReferenceLock(doc)` and logging a pipeline run.

### Pipeline
**One line:** The wiki's release console, and the name for the whole design CI/CD loop.

As a **loop**: `INGEST → BUILD → STAGING (draft) → PROMOTE → LOCK → DEPLOY → VERIFY → (ROLLBACK)`.

As a **screen**: `/wiki/pipeline`, with a persistent lock strip, staging and production lanes of block cards, a promote gesture through a diff drawer, and a run history panel. It is ranked above `/wiki/releases` in navigation, and Releases is relabeled as the table view.

**Where it lives:** `src/components/wiki/pages/PipelinePage.tsx` and `src/components/wiki/pipeline/*`, `GET /api/wiki/pipeline`, `GET /api/wiki/pipeline/diff`, payload types in `src/lib/ir/pipeline.ts`. Specified in `docs/PROJECT-PIPELINE.md`.

### Pipeline run
**One line:** One append-only audit entry recording a promote, rollback, pin-lock, ingest, or demo seed.

```ts
export type PipelineRunAction = "promote" | "rollback" | "pin-lock" | "ingest" | "demo-seed";
export type PipelineRunStatus = "success" | "failed";
```

A run carries `runNumber`, `actor`, `lockBefore`, `lockAfter`, `durationMs`, a capped log (200 lines), and stage results. Runs themselves are capped at 200 per document.

**Where it lives:** `src/lib/ir/pipeline-runs.ts`, stored at `.blocksmith/runs/<docKey>.json` and mirrored to the Supabase table `blocksmith_pipeline_runs`.

### Pipeline stage
**One line:** One of four recorded phases within a run: `ingest`, `staging`, `production`, `lock`.

Statuses: `success`, `failed`, `active`, `skipped`, `waiting`, `empty`.

**Where it lives:** `src/lib/ir/pipeline-stages.ts` (`PIPELINE_STAGE_IDS`, `buildIngestStages`, `buildPromoteStages`, `buildPinLockStages`, `buildRollbackStages`, `stagesForRun`, `averageStageDurationMs`).

### Promote
**One line:** The human gate. Advancing a block's official pointer to its latest version, which is what makes a change real for agents, CI, and every compile target.

Promote is the product's central act. Everything upstream exists to prepare a promote decision, and everything downstream exists to carry it. It can be per block or batched, it regenerates the reference lock once for the whole batch, and it logs a pipeline run. It refuses conflicted blocks.

**Where it lives:** `promoteBlock()` in `src/lib/ir/registry.ts`, `POST /api/wiki/promote`, UI in the Pipeline's promote gesture and the block-page release strip.

**Not to be confused with:** **Finalize**, which despite the documentation is a different endpoint that stages a draft by default.

### Prose lint
**One line:** The Tier 2 rule engine that reads promoted component prose and flags heuristic violations in changed files.

Version 1 ships three heuristics: `inactive-link`, `stale-date`, `stale-address`. False positives are explicitly acceptable at warn tier, because the design lead triages. Version 2 is planned as a rule engine driven by the same governance IR that feeds MCP; version 3 as an optional LLM gate on the diff for enterprise strict mode.

**Where it lives:** `src/lib/governance/prose-lint.ts` (`ProseRule`, `compileProseRules`, `scanProseViolations`).

**Not to be confused with:** **color lint**, which is exact rather than heuristic, and therefore blocks rather than warns.

### Pulse
**One line:** The codegen compile target that turns a design system into an importable npm package, `@blocksmith/<slug>`.

A generated package contains `package.json`, `tsconfig.json`, `src/tokens.css` (a `:root {}` block), `src/tokens.ts` (`cssVars`, `colors`, and a `CssVarName` type), `src/index.ts`, and one `src/components/<Title>.tsx` per component. It depends on `@blocksmith/pulse-runtime`, which re-exports `Surface` and `Text`.

The generator is three-tier, and the tiers matter because they encode how faithful the output actually is:

```
1. verbatim scanned source     (faithful by construction)
2. IR-synthesized prop signature (faithful interface)
3. generic stub                 (no IR available; legacy or unparseable source)
```

The implementation is literally `sourceComponent(comp) ?? (comp.scan?.interface ? synthesizedComponent(comp) : genericStub(comp))`. Tier 1 only fires when the carried source exports the component by name, so that `index.ts` stays valid. Tier 3 emits a `<div data-blocksmith-component="...">` stub, which is what every component used to get before the D-09 rewrite.

**Where it lives:** `src/lib/codegen/pulse.ts` (`generatePulsePackage`, `emitComponent`), `src/lib/codegen/run.ts`, `scripts/codegen-pulse.ts`, `scripts/verify-pulse.ts`, `scripts/ensure-pulse.mjs`, runtime at `packages/pulse-runtime`, sample output at `packages/generated/acme-ui-kit`, API at `POST /api/v1/codegen/pulse`, demo at `/demo/pulse`. Documented in `docs/PHASE2-PULSE.md`.

**Not to be confused with:** the `pulse-runtime` package, which is the small hand-written runtime the generated code imports, not generated code itself.

---

## R

### Registry
**One line:** The artifact store of design CI/CD: append-only version records per block, plus the official pointer, plus a manifest.

The lifecycle comment in the file is the clearest statement of the whole control plane:

```
INGEST   → recordIngest()      new/changed content becomes a new version
STAGING  → status "draft"      visible in wiki preview, never in the lock
PROMOTE  → promoteBlock()      human Finalize; pointer advances
LOCK     → lock.ts             pins { id → official version, contentHash }
ROLLBACK → rollbackBlock()     pointer returns to version N-1
```

The `RegistryManifest` carries `officialGraphHash` (compared against the lock to detect staleness) plus counts: `blockCount`, `promotedCount`, `draftCount`, `staleCount`.

**Where it lives:** `src/lib/ir/registry.ts`. Storage at `.blocksmith/registry/<docKey>/<blockId>.json` plus `manifest.json`, mirrored to Supabase by `src/lib/ir/cloud-registry.ts`. Schema at `packages/protocol/schemas/blocksmith.registry.v1.json`.

**Not to be confused with:** the **block store** at `.blocksmith/blocks/<docKey>/<id>.json` (`src/lib/blocks/store.ts`), which is the wiki and MCP read model rather than the version history. Two directories, two jobs.

### Release table
**One line:** The read model behind the Releases screen: one row per block with its official version, latest version, whether a draft is waiting, and whether it is stale, conflicted, promotable, or rollbackable.

`ReleaseTable.counts` gives `total`, `live`, `draftsWaiting`, `stale`, `conflicts`, and `neverPromoted`. Rows are sorted conflicts first, then drafts waiting, then stale, then live, alphabetically within each group, because the sort order is a priority list for a human.

**Where it lives:** `src/lib/ir/releases.ts` (`ReleaseRow`, `ReleaseTable`, `buildReleaseTable`, `getBlockRelease`, `packageNameForDoc`), `GET /api/wiki/releases`.

### Rollback
**One line:** Moving a block's official pointer back to the previous finalized version. Production reverts, history is kept.

It picks the highest version below the current official that has a `finalizedAt`, and errors with "No earlier finalized version to roll back to" when there is none. That case is real: a block's first-ever promote has nothing behind it, and the Pipeline correctly refuses.

**Where it lives:** `rollbackBlock()` in `src/lib/ir/registry.ts`, `POST /api/wiki/rollback`, logged as a pipeline run.

---

## S

### SaaS strict mode
**One line:** The flag that turns on tenant isolation. Default: on in production.

```ts
export function saasStrictMode(): boolean {
  if (process.env.BLOCKSMITH_SAAS_STRICT === "0") return false;
  if (process.env.BLOCKSMITH_SAAS_STRICT === "1") return true;
  return process.env.NODE_ENV === "production";
}
```

With it off, access checks run in open local mode and tenants can read each other's documents. It is named the number one pre-launch flip in `docs/PRODUCTION-CHECKLIST.md`, and startup configuration warnings fire when it is off in a hosted deployment.

**Where it lives:** `src/lib/cloud/saas.ts`, alongside `saasDbEnabled()`, `localCloudStoreWritable()`, `isPublicDemoDocument()`, `isBundledSampleDoc()`, and `isPublicContent()`.

### Scan
**One line:** A deterministic read of a vendor's repository producing facts: CSS variables, hex colors, CSS rules, utility classes, React components, and a full file inventory.

The word "vendor" is load-bearing. A scan reads **their** repo, not BlockSmith's. The pipeline, from the module's own README: UI files under scan paths, then scan (deterministic facts plus full React inventory), then an optional LLM curator, then the inventory appended deterministically, then the wiki. The curator is a black box in the middle of two deterministic halves, which is the pattern everywhere in this codebase.

Limits: files above 512,000 bytes are skipped; component source is carried up to 8,000 bytes, above which codegen falls back to IR synthesis.

**Where it lives:** `src/lib/scan/extract.ts` (`scanWorkspace`), `src/lib/scan/run.ts` (`scanWorkspaceToPayload`, `persistClientScan`, `scanAndPersist`), `src/lib/scan/service.ts` (`runScanService`, modes `fixture | github | workspace | clientScan`), `src/lib/scan/walk.ts`, `src/lib/scan/github.ts`.

Environment variables that shape it: `BLOCKSMITH_WORKSPACE`, `BLOCKSMITH_SCAN_PATHS` (defaults `src`, `app`, `packages`, `styles`), `BLOCKSMITH_CATALOG_PATHS`, `BLOCKSMITH_SCAN_ALLOW_PATHS`, `BLOCKSMITH_SCAN_WATCH`, `AI_LAB_SCAN_CURATE`.

### Scan doc
**One line:** The markdown artifact of a scan, at `data/uploads/scan-<slug>.md`, with frontmatter `blocksmith-source: workspace-scan`.

Its section layout is fixed: frontmatter, then a title, then scan metadata, then optionally existing design documents, then design tokens (CSS variables, colors, utility classes, CSS classes and styles), then the component library, then catalog exclusions, then the codebase inventory.

**Where it lives:** written by `workspaceScanToMarkdown` in `src/lib/scan/to-markdown.ts` (with `stableDocFileName` producing the name), read by `parseWorkspaceScanMarkdown` in `src/lib/scan/parse.ts`.

**Not to be confused with:** the **scan snapshot** at `<vendorRoot>/.blocksmith/scan-snapshot.md`, which is a copy written into the scanned repo, and the committed fixture at `fixtures/vendor-ui/scan-snapshot.md`.

### ShareBlockKind
**One line:** The three kinds of block that can be published to a public share page: `component`, `surface`, `color`.

This supports the pre-launch feedback thesis: release one block to public view and collect opinion tied to a block id and version, without exposing the whole product.

**Where it lives:** `src/lib/public-share/types.ts`, share routes under `src/app/share/[shareId]/`.

### Stale block
**One line:** A block whose source vanished from a full scan. Marked, never deleted, and its last official version stays in the lock until a human acts.

This is one of the four constitutional semantics. The reasoning: a customer's shipped application may still import that component, and their lock still pins it. Deleting would turn a warning into a broken build.

**Where it lives:** the `BlockStatus` union; set by `recordIngest()` in `src/lib/ir/registry.ts` on a full (non-partial) ingest.

**Not to be confused with:** **lock staleness**. Same adjective, unrelated condition. Say "stale block" or "stale lock", never just "stale".

### Staging
**One line:** The set of block versions that are drafted, conflicted, or never promoted. What promote would ship.

**Where it lives:** `PipelineLanes.staging` in `src/lib/ir/pipeline.ts`.

### Storybook adapter
**One line:** The first external ingest adapter, proving that something outside BlockSmith's own scanner can compile into `blocks.v1`.

It reads `stories.json` or `index.json` from a static Storybook build and emits `component:*` blocks with `source.ingest: "storybook"`. When the scan already holds the same id with different content, the result is a `conflict`. That conflict case is the real value: it exercised cross-source disagreement end to end and forced partial-ingest semantics into `recordIngest()`.

**Where it lives:** `src/lib/ingest/storybook.ts`, `scripts/ingest-storybook.ts`, `npm run ingest:storybook`.

### Surface
**One line:** Two unrelated meanings. Be careful.

1. **A design token kind.** `SurfaceRow { level, name, value, purpose }` describes background and elevation layers. Block ids are minted as `token:surface:<level>`. It appears as `DeviceToken.kind === "surface"` in device profiles and as `BS_SURFACE_*` defines in the generated C header. `Surface` is also one of the two components `@blocksmith/pulse-runtime` exports.
2. **Informal English** for "a place the product is exposed", as in "MCP tool surface" or "the Figma import has three surfaces". There is no type by that name.

**Where it lives:** meaning 1 at `src/lib/blocks/types.ts` (`SurfaceRow`, `DesignSystem.surfaces`), `src/lib/blocks/extract.ts`, `src/lib/ir/targets/device-sim.ts`, `src/lib/ir/targets/c-header.ts`, `packages/pulse-runtime`.

### Sync
**One line:** The wiki page and the underlying status that tell a team whether the wiki, the repo, and the lock currently agree.

Server-side there is an honest constraint: the server cannot read a customer's machine, so a local workspace scan can only be refreshed via the CLI or by re-scanning from GitHub. The status model says so rather than pretending.

**Where it lives:** `src/lib/scan/sync-status.ts`, MCP tool `get_sync_status`, `src/app/api/sync/github-rescan/route.ts`. Verified by `npm run verify:mcp-sync` and `npm run verify:sync-conflict`.

---

## T

### Token
**One line:** A named design value: a color, a spacing step, a type entry, a surface level, a radius. The smallest governed unit.

Tokens are blocks of type `token`, so they auto-promote on scan ingest, they are pinned in the lock, and they are what the Tier 1 color lint checks code against. Ids: `token:color:<slug>`, `token:typography:<slug>`, `token:spacing:<token>`, `token:surface:<level>`.

On the way in, a token can arrive as a `ScannedCssVar` (a CSS custom property with a value and a source) or a `ScannedColor` (a token name, a hex, and a source). Figma-imported tokens carry `source: figma:<fileKey>` so provenance survives.

**Where it lives:** `src/lib/scan/types.ts`, `src/lib/scan/tokens.ts`, `src/lib/blocks/extract.ts`, `src/lib/figma/normalize.ts` (`figmaNameToCssVar` turns "Color/Text/Primary" into `--color-text-primary`).

### `tokens.h`
**One line:** The C header compile target: every token as a `#define`, each one traceable back to a block at a version with its hash.

**Where it lives:** `src/lib/ir/targets/c-header.ts`, registered as compile target `c-header`.

---

## U

### UI AI Lab
**One line:** The umbrella brand for the experiments; BlockSmith is the flagship.

Its stated remit: experiments where human understanding keeps pace with agent documentation. In practice the lab's outputs are BlockSmith itself, the `blocks.v1` protocol, design CI/CD, the web and IDE handshake, the font generator, and the public block preview idea.

**Not to be confused with:** BlockSmith, which is the product and the repository. The two names are used interchangeably in older documents and should not be.

---

## V

### `validate:ui`
**One line:** The CI gate a customer runs in their own repository. It fails a pull request on Tier 1 violations, a missing lock, or a stale lock.

Three failure conditions: `blocksmith.lock` is missing while a registry exists; the lock is stale, meaning its graph hash no longer matches the promoted official graph; or the diff introduces off-token colors. Flags: `--range`, `--all`, `--lock <path>`, `--allow-stale`. Exit codes: `0` governed, `1` violations or stale lock, `2` setup error.

**Where it lives:** `scripts/validate-ui.ts`, run as `npm run validate:ui`. It is described in its own header as the GATE stage of design CI/CD. A copyable GitHub Actions template lives at `examples/github/blocksmith-governance.yml`.

**Not to be confused with:** the MCP tool `validate_ui_code` (agent-time, advisory, before the code is written) or `blocksmith check` (the CLI, hook-driven). Three tools, one shared lint engine, three moments in time. And note that `validate:ui` is a **repo npm script**, not a CLI subcommand: there is no `blocksmith validate` command.

### `validate_ui_code`
**One line:** The MCP tool an agent calls before writing UI, returning off-token colors as deviations.

**Where it lives:** registered in `src/lib/mcp/blocksmith-server.ts`, implemented as `handleValidateUiCode` in `src/mcp/handlers.ts`, backed by `findOffTokenColors` in `src/lib/governance/color-lint.ts`.

### Verify script
**One line:** An end-to-end script that runs a real pipeline against a real fixture and asserts on the output. BlockSmith's primary quality strategy, in place of unit tests.

There is no test framework in this repository: no Jest, no Vitest, no `test` script. There are 32 files matching `scripts/verify-*.ts`. The composite gate is `npm run verify:software`, which chains a typecheck plus seventeen verify scripts. `npm run verify:workable` is broader still, adding Supabase and cloud API checks plus a full local product check.

The complete list, with what each one guards:

| Script | Guards |
|---|---|
| `verify:design-ir` | Golden checks for the Design IR compiler |
| `verify:wiki` | Wiki markdown parses with doc-driven navigation |
| `verify:modify-tokens` | Token and introduction writeback round trip |
| `scan:verify` | Published scan markdown inventory matches deterministic scan facts |
| `verify:scan-wiki` | End-to-end workspace-scan wiki correctness |
| `verify:vendor-fixture` | Scan works outside BlockSmith itself, with no LLM |
| `verify:vendor-e2e` | Scan, persist, parse consistency (core goal 1) |
| `verify:handshake-writeback` | Finalize writes back to the vendor `DESIGN.md` and survives re-scan |
| `verify:handshake-pull` | Finalize, pull API payload, `DESIGN.md` on disk |
| `verify:handshake-acceptance` | Automated acceptance for the handshake spec |
| `verify:sync-conflict` | Conflict detection when the scan doc changes under an open wiki draft |
| `verify:saas-acl` | Document ownership and strict-mode ACL gates |
| `verify:security-gate` | Default-deny, import-list lockdown, no anonymous metadata leak |
| `verify:org-rbac` | Roles, invites, document access |
| `verify:governance-e2e` | Governance finalize, pull, `DESIGN.md`, with no LLM |
| `verify:governance-tiers` | The three-tier loop: detect, record, list, resolve |
| `verify:mcp-sync` | `get_sync_status` includes scan staleness fields |
| `verify:component-interface` | The extractor across inline types, aliases, intersections, `FC<Props>`, `forwardRef`, `memo`, default exports |
| `verify:pulse` | Codegen faithfulness, then install and build the generated package |
| `verify:governance-copilot` | Copilot drafts role and description (skips without a key) |
| `verify:ir-cicd` | The full closed loop: ingest, build, stage, promote, lock, enforce, rollback, compile |
| `verify:figma-import` | Figma variables to `design.md` round trip plus drift statuses, no credentials needed |
| `verify:github-scan` | Clone, scan, persist, parse against a real public repository |
| `verify:cloud-api` | Cloud API and SDK smoke without a running server |
| `verify:supabase` | Supabase storage smoke (needs credentials) |
| `verify:patterns-live` | Live HTTP test against a running dev server |
| `verify:production-smoke` | Post-deploy smoke (needs `BLOCKSMITH_URL`) |
| `verify:production-goals` | Goal 1 and 2 checks on public routes |
| `verify:workable` | Everything above plus generated package artifacts |

Two scripts have no npm binding: `scripts/verify-mcp-accept.ts` (needs a live server on localhost) and `scripts/_verify-dashboard-tmp.mjs` (a leftover).

**Not to be confused with:** `validate:ui`, which is a gate for the **customer's** repository, and `protocol:conformance`, which is a third-party-facing suite.

### Visualize
**One line:** The wiki feature that re-themes the wiki's own chrome with the design system it is displaying, so a human can feel the system before promoting it.

It is a hybrid: an immediate deterministic pass builds `--wiki-*` chrome variables from the compiled IR, and an optional background LLM refine improves the layout if `NVIDIA_API_KEY` is set. The rule from `docs/CEO-DIRECTIVE.md` is that it must never block the promote decision, which is why the deterministic pass renders first and the AI refine is additive.

**Where it lives:** `src/components/wiki/VisualizeStyleButton.tsx`, `src/components/wiki/VisualizeLoadingOverlay.tsx`, `src/hooks/useVisualizeStyle.ts`, wired in `src/components/wiki/WikiShell.tsx`. Preference persisted to `localStorage` under `"blocksmith-visualize"` by `src/lib/visualize-storage.ts`. Preview tokens read only from the compiled IR in `src/lib/visualize/preview-tokens.ts`. Server capability probe at `GET /api/ai/status`, refine at `POST /api/ai/layout`.

**Not to be confused with:** anything in the CLI or MCP. There is no `blocksmith visualize` command. It is a wiki UI feature only.

---

## W

### Wiki
**One line:** The human surface and the control plane: browse a design system, edit governance, visualize, promote, roll back, and pin the lock, all in one application.

The wiki is not a documentation site with a pipeline bolted on. It is the release console, and the pipeline lives inside it by explicit decision (see [Chapter 18](./18-decisions-and-tradeoffs.md) D-01). It is also the only compile target permitted to render drafts.

**Where it lives:** routes under `src/app/wiki/`, components under `src/components/wiki/`, API under `src/app/api/wiki/`.

### Workspace
**One line:** The vendor repository being scanned. Not BlockSmith's own repository.

`resolveWorkspaceRoot(override?)` resolves it in order: explicit override, then `BLOCKSMITH_WORKSPACE`, then the current working directory, then realpath. The `workspaceId` derived from it becomes the stable slug of the resulting document, which is how re-scanning the same repository updates the same document instead of creating a new one.

**Where it lives:** `src/lib/scan/workspace-root.ts`, `src/lib/scan/workspace-config.ts`.

**Not to be confused with:** an npm workspace. This repository is also an npm monorepo with `workspaces: ["packages/*", "packages/generated/*"]`, and the two senses collide constantly in conversation.

### Workspace scan
See **Scan**. The two terms are used interchangeably; "workspace scan" is the formal name that appears in `WorkspaceScanResult` and in the `blocksmith-source: workspace-scan` frontmatter.

### Writable root
**One line:** Where BlockSmith may write files at runtime: `.blocksmith` locally, a temp directory on serverless.

`blocksmithWritableRoot()` returns `.blocksmith` under the project locally, and `os.tmpdir()/blocksmith` on Vercel or Lambda, because the application filesystem is read-only there. Every registry, lock, run, and target path is built on top of it.

**Where it lives:** `src/lib/runtime/writable-root.ts`.

---

## Words that mean two things: a quick reference

Keep this table close. Every row here has already caused a misunderstanding.

| Word | Sense A | Sense B |
|---|---|---|
| **stale** | A block whose source vanished (`BlockStatus`) | A lock whose graph hash no longer matches (`LockVerification.stale`) |
| **drift** | Lock pins disagreeing with official | Figma disagreeing with code. And: app hashing disagreeing with the protocol package |
| **surface** | A design token kind (background, elevation) | Informal English for "an exposed place in the product" |
| **check** | `blocksmith check` in a customer repo | `npm run governance:check` in BlockSmith's own repo |
| **design.md** | The BlockSmith document rendered as a wiki | `DESIGN.md`, the file written back into a customer repo |
| **block** | A unit of design truth | A governance tier meaning "fail the build" |
| **ingest** | The act of getting truth in | `recordIngest()`, the registry operation |
| **workspace** | The vendor repo being scanned | An npm monorepo workspace |
| **finalize** | The word every strategy doc uses for promote | The route that saves a draft, unless `promote: true` |
| **extension** | The shipped capture extension in `extension/` | The planned restyle-the-web extension |
| **tier** | Tier 1, 2, 3 in the product | `GovernanceTier`, which has only two members |

---

## Open questions

1. **Finalize versus promote.** The vocabulary gap between the strategy documents and `src/app/api/wiki/finalize/route.ts` is a live hazard. Should the route be renamed to `save-draft`, should the documents be corrected, or should the two be genuinely unified? Somebody has to decide, because right now a correct sentence in one place is wrong in the other.
2. **`docs/MCP.md` is out of date** by six tools. Should tool documentation be generated from `src/lib/mcp/blocksmith-server.ts` so it cannot drift, the way schemas are mirrored from `packages/protocol`?
3. **Tier 3 has no type.** Should `GovernanceTier` gain an `"advisory"` member so the product vocabulary and the type vocabulary agree, or is the current split (tier is severity, `suggestion` is channel) actually the better model and only the naming is bad?
4. **`ComponentScanMeta` lives in `src/lib/blocks/types.ts`** while its write-side twin `ScannedComponent` lives in `src/lib/scan/types.ts`. Is that a deliberate layering boundary or an accident that should be fixed before more code depends on it?
5. **`BlockType` member order differs** between the app and the protocol package, and the CI drift gate does not check it. Harmless today. Should the gate compare type declarations too, or should the app import the union from `@blocksmith/protocol` and delete its copy?
6. **`BlocksmithLockV1.systemId`** is required in the app's copy of the type and optional in the protocol package's copy and in the JSON Schema. One of the two is wrong.
7. **Two senses of "extension"** will get worse, not better, once the restyle track starts. Rename one of them now, while only one exists in code.
8. **"UI AI Lab" versus "BlockSmith"** are used interchangeably in older documents. Which is the company, which is the product, and which appears on a contract?

---

## Where to look in the code

| Vocabulary area | Path |
|---|---|
| Block, graph, lock, registry types | `src/lib/ir/types.ts`, `packages/protocol/src/types.ts` |
| Block content and store shapes | `src/lib/blocks/content.ts`, `src/lib/blocks/types.ts`, `src/lib/blocks/extract.ts`, `src/lib/blocks/store.ts` |
| Hashing (constitutional) | `src/lib/ir/hash.ts`, `packages/protocol/src/hash.ts` |
| Registry lifecycle | `src/lib/ir/registry.ts`, `src/lib/ir/cloud-registry.ts`, `src/lib/ir/ensure-pipeline-registry.ts` |
| Lock and enforcement | `src/lib/ir/lock.ts`, `src/lib/ir/enforce.ts`, `src/lib/runtime/writable-root.ts` |
| Pipeline vocabulary | `src/lib/ir/pipeline.ts`, `pipeline-runs.ts`, `pipeline-stages.ts`, `releases.ts`, `diff.ts`, `demo-seed.ts` |
| Compile targets | `src/lib/ir/targets/device-sim.ts`, `src/lib/ir/targets/c-header.ts`, `packages/protocol/compile-targets.v1.json` |
| Scan vocabulary | `src/lib/scan/types.ts`, `extract.ts`, `to-markdown.ts`, `parse.ts`, `component-interface.ts`, `catalog.ts`, `fingerprint.ts`, `workspace-root.ts`, `README.md` |
| Codegen | `src/lib/codegen/pulse.ts`, `src/lib/codegen/run.ts`, `packages/pulse-runtime`, `packages/generated/acme-ui-kit` |
| Governance | `src/lib/governance/types.ts`, `color-lint.ts`, `prose-lint.ts`, `check-diff.ts` |
| MCP | `src/lib/mcp/blocksmith-server.ts`, `src/mcp/handlers.ts`, `src/mcp/server.ts`, `src/lib/mcp/http-handler.ts` |
| Figma | `src/lib/figma/` (all nine files) |
| Ingest paths | `src/lib/ingest/capture.ts`, `src/lib/ingest/storybook.ts`, `src/lib/uploads/store.ts`, `src/lib/uploads/persist.ts` |
| Tenancy vocabulary | `src/lib/cloud/saas.ts`, `orgs.ts`, `rbac.ts`, `access.ts`, `wiki-access.ts` |
| CLI vocabulary | `packages/cli/src/cli.ts`, `check.ts`, `pull.ts`, `scan-local.ts`, `setup-hooks.ts`, `resolve-workspace.ts` |
| Published schemas | `packages/protocol/schemas/*.json`, `public/schema/*.json`, spec site at `/protocol` |
| The source documents this glossary formalizes | `docs/BLOCKS-V1-SPEC.md`, `docs/DESIGN-CICD.md`, `docs/GOVERNANCE-TIERS.md`, `docs/MCP.md`, `docs/FIGMA-IMPORT.md`, `docs/DESIGN-FIRST-INGEST.md`, `docs/PROJECT-PROTOCOL.md`, `docs/PROJECT-PIPELINE.md`, `docs/TEAM-NORTH-STAR.md` |

Related chapters: [Chapter 07](./07-design-ir-and-blocks.md) explains the block model in depth, [Chapter 08](./08-ingestion-how-truth-gets-in.md) walks each ingest path, [Chapter 10](./10-governance-and-design-cicd.md) covers promote and lock, [Chapter 11](./11-the-handshake-mcp-cli-sdk.md) covers MCP and the CLI, [Chapter 12](./12-codegen-pulse-and-compile-targets.md) covers Pulse and the compile targets, and [Chapter 18](./18-decisions-and-tradeoffs.md) records why each of these choices was made.
