# Design IR & Design CI/CD — implementation runbook

**Status:** Shipped (reference implementation). This is the engineering companion to
[RESEARCH-INFRA-DESIGN-IR-AND-CICD.md](./RESEARCH-INFRA-DESIGN-IR-AND-CICD.md) — what exists in code,
where it lives, and how to exercise the full closed loop.

**Product alignment:** Pipeline **UI** lives in the wiki ([TEAM-NORTH-STAR.md](./TEAM-NORTH-STAR.md)). This doc is the **engine** under that UI.

---

## Module map

| Layer | File | Role |
|-------|------|------|
| Protocol types | `src/lib/ir/types.ts` | `BlocksmithBlockV1`, `BlocksmithGraphV1`, `BlocksmithLockV1`, registry records |
| Canonical hashing | `src/lib/ir/hash.ts` | Key-order-independent block + graph hashes (`sha256:…`) |
| Version registry | `src/lib/ir/registry.ts` | Append-only versions per block id + `official` release pointer; ingest / promote / rollback / conflict / stale |
| Lock | `src/lib/ir/lock.ts` | Deterministic `blocksmith.lock` build, read, verify (staleness + drift) |
| Enforcement | `src/lib/ir/enforce.ts` | Agent-facing reads resolve to official versions only |
| device-sim target | `src/lib/ir/targets/device-sim.ts` | Graph → device profile (tokens as literals, widgets, constraints, invariants) + loss metric |
| c-header target | `src/lib/ir/targets/c-header.ts` | Graph → `tokens.h` with `block@version (hash)` traceability |
| Published spec | `public/schema/blocksmith.blocks.v1.json`, `public/schema/blocksmith.lock.v1.json` | JSON Schema 2020-12, served at `/schema/…` |
| Example graph | `examples/graphs/acme-minimal.blocks.v1.json` | Worked example incl. a `conflict` block |

## Pipeline wiring (who calls what)

```
scan / upload / parse
   └─ persistBlocksForDoc()            src/lib/blocks/store.ts
        └─ recordIngest()              INGEST: assigns versions, auto-promotes
                                       scan facts, stages governance drafts,
                                       marks vanished blocks stale

wiki Finalize  POST /api/wiki/finalize
   └─ refreshBlocksForDoc() → promoteBlock() → writeReferenceLock()
                                       PROMOTE + LOCK (human gate)

blocksmith pull  GET /api/v1/scans/pull   → response now includes `lock`
explicit lock    GET /api/v1/lock?docRef=…&format=file

agents (MCP)     get_design_tokens / get_component_docs / list_components
   └─ listGovernedBlocks()             DEPLOY: official versions only —
                                       drafts & conflicts never leave server
                 get_lockfile          lock artifact + freshness
                 get_block_versions    per-block audit trail
                 get_sync_status       lock freshness, registry counts,
                                       blocks excluded from agents + why

CI               npm run validate:ui   GATE: fails on stale/missing lock or
                                       off-token colors in the diff
                 .github/workflows/validate-ui.yml
```

## Lifecycle semantics

- **Versions are append-only**; the `official` pointer is the release tag (npm-style — rollback moves the pointer, never rewrites history).
- **Truth precedence (§4.6):** token/component facts from scan auto-promote on ingest (code is authoritative until re-scan). Guideline/agent-rule/page edits stage as `draft` until a human Finalizes. `conflict` blocks cannot be promoted until resolved.
- **Stale ≠ deleted:** a block that vanishes from its source keeps its lock pin; a human decides in the wiki.
- **Lock staleness:** `lock.contentHash` is an order-independent hash of `(id, version, contentHash)` over the official graph. Any promote/rollback after lock generation flips `verifyLock().stale`.

## Control plane (wiki — Stream A)

| Surface | File | Role |
|---------|------|------|
| **Releases screen** | `src/components/wiki/pages/ReleasesPage.tsx` → `/wiki/releases` | Full release console: state table, batch promote, resolve-conflict, rollback, version history, lock banner, handshake panel |
| Block-page strip | `src/components/wiki/BlockReleaseStrip.tsx` | "Live v3 · draft v4 waiting" + one-click promote on component pages |
| Sync lock card | `src/components/wiki/LockStatusCard.tsx` | Lock freshness + pull command on `/wiki/sync` |
| Read model | `src/lib/ir/releases.ts` | `buildReleaseTable()` joins registry + lock into actionable rows |
| Promote API | `POST /api/wiki/promote` | Batch/single promote, optional conflict resolution, lock regen |
| Rollback API | `POST /api/wiki/rollback` | Pointer to previous finalized version, lock regen |
| Releases API | `GET /api/wiki/releases?doc=…[&block=…]` | Table or single row |

Reference locks are now **per doc** (`.blocksmith/locks/<docKey>.lock`, legacy single path mirrored) so promoting one product never clobbers another's pin.

## Pipeline console (PROJECT-PIPELINE.md — shipped)

| Surface | File | Role |
|---------|------|------|
| **Pipeline console** | `src/components/wiki/pages/PipelinePage.tsx` → `/wiki/pipeline` | Hero surface: Staging→Production lanes, ribbons (ingest/build/locked/deployed), promote gesture |
| Lock strip | `src/components/wiki/pipeline/LockStrip.tsx` | No-lock / stale / fresh states, Pin-production-lock CTA, drift counter |
| Block cards / lanes | `pipeline/BlockCard.tsx`, `pipeline/StageLane.tsx` | Status-toned cards, select, locked badge, promote animation |
| Diff drawer | `pipeline/PromoteDiffDrawer.tsx` | Required production-vs-staging review + blast radius before confirm |
| Runs panel | `pipeline/PipelineRunsPanel.tsx` | Append-only audit; Rollback-run |
| Runs log | `src/lib/ir/pipeline-runs.ts` | `.blocksmith/runs/` + Supabase mirror/hydrate |
| Diff engine | `src/lib/ir/diff.ts` | Field-level diff, color-swatch detection |
| Pin lock API | `POST /api/wiki/pin-lock` | Fixes "all live, no lock" dead end |
| Pipeline API | `GET /api/wiki/pipeline` · `GET /api/wiki/pipeline/diff` | One payload for the console; drawer diffs |
| Demo | `/demo/investor` + `POST /api/wiki/pipeline/demo` (`src/lib/ir/demo-seed.ts`) | Self-seeding 90s walkthrough: 3 drafts, 1 conflict, stale lock |
| Durable registry | `supabase/schema-registry.sql` + `src/lib/ir/cloud-registry.ts` | Env-gated Supabase mirror + cold-start hydration (apply SQL to activate) |

## Commands

```bash
npm run verify:ir-cicd     # end-to-end closed-loop proof (ingest→…→compile)
npm run validate:ui        # CI gate: lock freshness + off-token diff
npm run compile:device     # emit device-sim profile + tokens.h for a doc
```

Demo surfaces: `/demo/device` (watch/HMI frames compiled from the promoted graph), `/demo/pulse` (existing Pulse target).

## Research roadmap mapping

| Phase | Deliverable | Status |
|-------|-------------|--------|
| R1 | `blocks.v1` JSON Schema + example graphs | ✅ |
| R2 | Version model + lock spec + reference writer on finalize/pull | ✅ |
| R3 | MCP reads lock only; drift case study | ✅ enforcement shipped; study pending |
| R4 | Second compile target from same graph | ✅ `device-sim` + `c-header` |
| R5 | Two-week team evaluation | ⬜ next |
