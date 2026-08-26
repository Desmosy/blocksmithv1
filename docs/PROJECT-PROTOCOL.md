# Project Protocol — assignment spec

**Status:** ✅ v1 beta shipped — `@blocksmith/protocol` package, four public schemas, conformance suite + CI drift gate, `/protocol` spec site, Storybook adapter, targets manifest, governance doc ([PROTOCOL-GOVERNANCE.md](./PROTOCOL-GOVERNANCE.md)). Remaining: `npm publish` + professor sign-off review.  
**Owner:** Research / platform (professor sign-off on semantics)  
**Read with:** [RESEARCH-INFRA-DESIGN-IR-AND-CICD.md](./RESEARCH-INFRA-DESIGN-IR-AND-CICD.md) · [PROJECT-PIPELINE.md](./PROJECT-PIPELINE.md)

**North star:** **`blocksmith.blocks.v1`** is the TCP/IP of design — a neutral interchange format third parties implement without cloning BlockSmith.

---

## Mission

Publish Design IR as a **protocol product**, not JSON files buried in our repo. BlockSmith wiki + Pipeline remain the **reference implementation** that dogfoods the spec first.

**Investor line:** *We own the interchange layer; the product proves it works.*

---

## What exists today

| Artifact | Status | Location |
|----------|--------|----------|
| `blocksmith.blocks.v1` JSON Schema | ✅ Published | `public/schema/blocksmith.blocks.v1.json` |
| `blocksmith.lock.v1` JSON Schema | ✅ Published | `public/schema/blocksmith.lock.v1.json` |
| TypeScript types | ✅ | `src/lib/ir/types.ts` |
| Reference impl (hash, registry, lock, enforce) | ✅ | `src/lib/ir/` |
| Example graph | ✅ | `examples/graphs/acme-minimal.blocks.v1.json` |
| Closed-loop proof | ✅ | `npm run verify:ir-cicd` |
| `blocksmith.registry.v1` | ✅ Published | `public/schema/blocksmith.registry.v1.json` (manifest + entry; app output validates) |
| `blocksmith.compile-targets.v1` | ✅ Published | `public/schema/…` + manifest `packages/protocol/compile-targets.v1.json` |
| Standalone npm package | ✅ Installable | `packages/protocol/` — zero-dependency types, validators, hashing, fixtures (publish: `npm publish -w @blocksmith/protocol`) |
| Conformance suite for third parties | ✅ | `npm run protocol:conformance` — fixtures, golden vectors, drift gate, `.github/workflows/protocol-conformance.yml` |
| Spec site | ✅ | `/protocol` — overview, blocks.v1, lock.v1, registry.v1, adapters, targets, conformance |
| External ingest adapter | ✅ Storybook | `src/lib/ingest/storybook.ts` + `npm run ingest:storybook` — conflict rule + partial ingest proven |

---

## Protocol stack (name all layers)

```
┌─────────────────────────────────────────────────────────────┐
│  COMPILE TARGETS (outputs)                                   │
│  wiki · pulse-react · mcp · device-sim · c-header · …       │
└───────────────────────────▲─────────────────────────────────┘
                            │ reads official graph only
┌───────────────────────────┴─────────────────────────────────┐
│  blocksmith.lock.v1        — repo pin (agent + CI truth)     │
└───────────────────────────▲─────────────────────────────────┘
                            │ generated on promote
┌───────────────────────────┴─────────────────────────────────┐
│  blocksmith.registry.v1    — version store + official ptr    │
└───────────────────────────▲─────────────────────────────────┘
                            │ ingest writes versions
┌───────────────────────────┴─────────────────────────────────┐
│  blocksmith.blocks.v1      — Design IR graph (the packet)    │
└───────────────────────────▲─────────────────────────────────┘
                            │ adapters compile in
┌───────────────────────────┴─────────────────────────────────┐
│  INGEST ADAPTERS (inputs)                                    │
│  scan · markdown · storybook · figma · tokens-studio · …    │
└─────────────────────────────────────────────────────────────┘
```

**Rule:** Adapters write **blocks.v1** only. Targets read **official graph** only. Lock pins what agents see.

---

## Task P1 — `@blocksmith/protocol` package

**Deliverable:** Publishable npm package (monorepo `packages/protocol/` ok).

### Contents

```
packages/protocol/
  package.json              # name: @blocksmith/protocol
  README.md                 # 5-minute tutorial
  schemas/
    blocksmith.blocks.v1.json
    blocksmith.lock.v1.json
    blocksmith.registry.v1.json    # NEW — see below
    blocksmith.compile-targets.v1.json
  src/
    types.ts                # generated or hand-synced from schemas
    validate-graph.ts       # Ajv validate against blocks.v1
    validate-lock.ts
    validate-registry.ts
    hash.ts                 # graphHash, blockContentHash — MUST match src/lib/ir/hash.ts
    index.ts
  fixtures/
    acme-minimal.blocks.v1.json
    acme-minimal.lock.v1.json
```

### Public API

```ts
import {
  validateGraph,
  validateLock,
  graphHash,
  blockContentHash,
  BLOCKS_SCHEMA,
  LOCK_SCHEMA,
} from "@blocksmith/protocol";

const { ok, errors } = validateGraph(json);
const hash = graphHash(officialBlocks);
```

### Requirements

- Hash functions **byte-identical** to `src/lib/ir/hash.ts` (shared tests)
- Schemas copied from `public/schema/` + new registry schema
- README: emit valid graph from scratch in <20 lines
- BlockSmith app imports from `@blocksmith/protocol` (or re-exports) — single source of truth

### Definition of done

- [ ] External repo can `npm install @blocksmith/protocol` and validate a graph
- [ ] No BlockSmith app clone required to speak the protocol

---

## Task P2 — Publish `blocksmith.registry.v1` schema

**Deliverable:** `public/schema/blocksmith.registry.v1.json` + inclusion in package.

### Registry manifest (per doc)

```json
{
  "schema": "blocksmith.registry.v1",
  "docRef": "upload:scan-acme-app.md",
  "systemId": "acme-design-system",
  "lastIngestAt": "2026-06-09T12:00:00.000Z",
  "officialGraphHash": "sha256:…",
  "blockCount": 40,
  "promotedCount": 38,
  "draftCount": 2,
  "staleCount": 0
}
```

### Per-block entry (append-only versions + official pointer)

```json
{
  "id": "component:primary-action-button",
  "official": 2,
  "versions": [
    {
      "version": 1,
      "status": "finalized",
      "title": "Primary Action Button",
      "type": "component",
      "content": { },
      "contentHash": "sha256:…",
      "source": { "file": "…", "ingest": "scan" },
      "updatedAt": "…",
      "createdAt": "…",
      "finalizedAt": "…",
      "editedBy": "ingest"
    }
  ]
}
```

### Semantics (constitutional — professor review required)

| Rule | Spec text |
|------|-----------|
| Versions | Append-only; never delete |
| `official` | Production pointer; lock-eligible |
| Auto-promote | `token` + `component` from scan ingest |
| Draft | Governance edits until human promote |
| `stale` | Source vanished; last official remains in lock |
| `conflict` | Cross-source disagreement; promote blocked until resolve |

### Definition of done

- [ ] JSON Schema validates manifest + entry shapes
- [ ] `src/lib/ir/registry.ts` output validates against schema
- [ ] Documented in spec site (P3)

---

## Task P3 — Spec site `/protocol`

**Deliverable:** Human-readable protocol docs inside the app (or static export).

### Pages

| Path | Content |
|------|---------|
| `/protocol` | Overview + TCP/IP analogy diagram |
| `/protocol/blocks.v1` | Block + graph spec, examples |
| `/protocol/lock.v1` | Lock file, staleness, pull flow |
| `/protocol/registry.v1` | Version model, promote semantics |
| `/protocol/adapters` | Ingest adapter registry table |
| `/protocol/targets` | Compile target registry table |
| `/protocol/conformance` | How to run the test suite |

### Adapter registry table (living doc)

| Adapter | Input | Status | Owner |
|---------|-------|--------|-------|
| `scan` | Repo workspace | ✅ Reference | BlockSmith |
| `markdown` | Paste / upload `.md` | ✅ Reference | BlockSmith |
| `governance` | Wiki finalize | ✅ Reference | BlockSmith |
| `storybook` | `storybook-static` | ⬜ P4 | — |
| `figma` | Figma export JSON | ⬜ Future | — |
| `tokens-studio` | Tokens Studio JSON | ⬜ Future | — |

### Compile target registry

| Target | Input | Output | Status |
|--------|-------|--------|--------|
| `wiki` | blocks.v1 official | HTML/React wiki | ✅ |
| `pulse-react` | blocks.v1 official | npm package | ✅ v0 |
| `mcp` | blocks.v1 + lock | Tool payloads | ✅ |
| `device-sim` | blocks.v1 official | Browser HMI frames | ✅ |
| `c-header` | blocks.v1 official | `tokens.h` | ✅ |

### Definition of done

- [ ] Investor opens `/protocol` and understands category without a meeting
- [ ] Schema download links + copy-paste examples
- [ ] Links to `@blocksmith/protocol` on npm

---

## Task P4 — Conformance suite

**Deliverable:** `npm run protocol:conformance` in `packages/protocol/`

### Fixture categories

```
packages/protocol/conformance/
  valid/
    minimal-graph.json
    full-acme-graph.json
    fresh-lock.json
  invalid/
    wrong-schema-field.json
    draft-in-official-graph.json
    bad-content-hash.json
    lock-version-mismatch.json
  behavioral/
    graph-hash-deterministic.json      # order-independent
    promote-then-stale-lock.json
    rollback-preserves-history.json
```

### Tests

- Schema validation pass/fail per fixture
- `graphHash()` golden vectors
- `verifyLock()` staleness cases (port from `verify-ir-cicd.ts`)
- Official graph must exclude `draft` and `conflict` blocks

### CI

- GitHub Action: `protocol-conformance.yml` on every PR touching `packages/protocol/` or `src/lib/ir/`
- Badge in README: **blocks.v1 conformance**

### Definition of done

- [ ] Third party can fork fixtures and prove their emitter
- [ ] BlockSmith CI fails if hashes drift from spec

---

## Task P5 — One external ingest adapter

**Deliverable:** Prove neutrality — something **outside** BlockSmith scan compiles to `blocks.v1`.

**Pick one (CEO chooses; default Storybook):**

### Option A — Storybook (recommended)

```bash
blocksmith ingest storybook ./storybook-static --doc upload:my-app.md --out ./out/graph.json
```

- Read `stories.json` / `index.json` from static build
- Emit `component:*` blocks with `source.ingest: "storybook"`
- If scan already has same id with different content → `conflict`

### Option B — Tokens Studio

- Import `tokens.json` → `token:color:*`, `token:spacing:*`

### Option C — Figma export JSON

- Minimal component + paint styles → blocks with `source.ingest: "figma"`

### Adapter contract

Every adapter MUST:

1. Output `BlocksmithGraphV1` or array of blocks for `recordIngest()`
2. Set `contentHash` per spec
3. Pass `protocol:conformance` fixtures for its output
4. Never write wiki or Pulse directly

### Definition of done

- [ ] CLI or library ingest path documented on `/protocol/adapters`
- [ ] Demo: same doc has scan blocks + adapter blocks; conflict visible in Pipeline

---

## Task P6 — Compile target manifest

**Deliverable:** `blocksmith.compile-targets.v1.json`

```json
{
  "schema": "blocksmith.compile-targets.v1",
  "targets": [
    {
      "id": "pulse-react",
      "input": "blocksmith.blocks.v1",
      "officialOnly": true,
      "output": "npm-package",
      "reference": "packages/pulse-react"
    },
    {
      "id": "device-sim",
      "input": "blocksmith.blocks.v1",
      "officialOnly": true,
      "output": "json-profile",
      "reference": "src/lib/ir/targets/device-sim.ts"
    }
  ]
}
```

### “Build a target in a weekend” doc

- Input: official `BlocksmithGraphV1`
- Output: artifact + content hash
- Must not read drafts
- Register in manifest PR

### Definition of done

- [ ] Manifest published in package + spec site
- [ ] Third compile target stub documented (even if not implemented)

---

## Task P7 — Wire BlockSmith to the package

**Deliverable:** App uses protocol package as single source of truth.

- `src/lib/ir/hash.ts` → re-export from `@blocksmith/protocol` or delete duplicate
- `verify:ir-cicd` imports validators from package
- `public/schema/*.json` generated from `packages/protocol/schemas/` (one copy)

### Definition of done

- [ ] No hash semantic drift between app and package
- [ ] Professor reviews any schema bump PR

---

## Versioning & governance

| Change type | Process |
|-------------|---------|
| Patch (docs, examples) | Team merge |
| Minor (new block types, optional fields) | Professor + platform review |
| Major (hash algorithm, status enum) | Spec bump `blocks.v2`, migration doc |

Publish `docs/PROTOCOL-GOVERNANCE.md` with:

- Schema version policy
- Conformance required for adapter listing
- Reference implementation vs spec (BlockSmith may ship features before spec — spec catches up or feature flags)

---

## Supabase alignment (shared with Pipeline)

When registry moves to cloud, stored JSON **must validate** against `blocksmith.registry.v1`:

```sql
-- illustrative; final in supabase/schema-registry.sql
block_registry_manifest (
  doc_ref text primary key,
  manifest jsonb not null,  -- validates against registry.v1 manifest
  ...
);
block_registry_entries (
  doc_ref text,
  block_id text,
  entry jsonb not null,     -- validates against registry.v1 entry
  primary key (doc_ref, block_id)
);
```

---

## Investor / F100 narrative (use in deck)

> **Figma is Ethernet. BlockSmith is TCP/IP.**  
> Any tool compiles into `blocksmith.blocks.v1`. Any consumer compiles out — wiki, npm, agents, firmware headers.  
> `blocksmith.lock` pins production in every repo. Fortune 100 gets audit, RBAC, and Pipeline promote gates on top.

---

## Squad split

| Squad | Owns |
|-------|------|
| **Protocol package** | P1, P2, P4, P7 |
| **Spec site** | P3 |
| **External adapter** | P5 (Storybook default) |
| **Targets manifest** | P6 |
| **Professor** | Registry semantics, schema sign-off, governance doc |

---

## Definition of done (project)

- [x] `@blocksmith/protocol` on npm (or installable monorepo package) — installable workspace package, `npm publish`-ready
- [x] Three public schemas: blocks, lock, registry — plus compile-targets (four)
- [x] Conformance suite + CI badge — 20 checks; badge in package README; `protocol-conformance.yml` on PRs touching protocol/IR/schemas
- [x] `/protocol` spec site live — 7 pages, schema downloads, copy-paste examples
- [x] One external adapter shipping valid graphs — Storybook: graph validates with `verifyHashes` + `officialOnly`; conflict vs scan demonstrated; partial-ingest semantics added to `recordIngest`
- [x] Compile targets manifest published — 5 reference targets + `lvgl` stub, validated by the suite
- [x] BlockSmith app dogfoods package with zero hash drift — drift gate enforced in CI (and it already caught + fixed a real NUL-byte separator divergence)
- [x] Deck can say: *“Third parties run our conformance suite”* — truthfully: `npx tsx node_modules/@blocksmith/protocol/conformance/run.ts` works from a clean install, fixtures forkable

---

## Do not

- Rewrite hash semantics without professor sign-off
- Claim “open standard” before conformance + adapter ship
- Build adapters that bypass blocks.v1 into wiki/Pulse directly
- Fork protocol types in app and package

---

*Assign by linking PRs to checkboxes above.*
