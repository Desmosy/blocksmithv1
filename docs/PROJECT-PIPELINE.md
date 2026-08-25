# Project Pipeline — assignment spec

**Status:** ✅ Shipped — `/wiki/pipeline` live, investor demo at `/demo/investor`, verified by `/tmp` smoke + `verify:ir-cicd` (see checklist below)  
**Owner:** Product / frontend + platform  
**Read with:** [CEO-DIRECTIVE.md](./CEO-DIRECTIVE.md) · [TEAM-NORTH-STAR.md](./TEAM-NORTH-STAR.md) · [PROJECT-PROTOCOL.md](./PROJECT-PROTOCOL.md)

**North star:** Jenkins-class **visual release console** for design truth — the screenshot on the pitch deck and the 90-second investor demo.

---

## Mission

Build `/wiki/pipeline` — a **visual promote console** where Fortune 100 design ops see staging vs production, promote with diffs, audit every run, and pin `blocksmith.lock` — not a spreadsheet of 40 identical “Live v1” rows.

**Deprecate as primary:** `/wiki/releases` → redirect to Pipeline or tuck under “Table view (advanced)”.

---

## Why this exists

| Today | Problem |
|-------|---------|
| Releases table | Looks like internal admin; no wow |
| Promote hidden when all blocks auto-ingested | Customer confusion (“nothing to click”) |
| No lock until manual promote/finalize | “40 Live, no lock” dead end |
| No visual staging → production | Doesn’t feel like CI/CD |

**Investor demo requirement:** A non-technical person understands *why agents need a human promote gate* without narration.

---

## Route & nav

| Item | Value |
|------|--------|
| **URL** | `/wiki/pipeline` |
| **Nav label** | **Pipeline** (replace or rank above Releases) |
| **Icon tone** | CI/CD / deploy — not “documents” |

---

## UI architecture

### 1. Lock strip (always pinned top)

Persistent bar across Pipeline:

```
[ ● Fresh | ● Stale | ● No lock ]  graph sha256:…  ·  @blocksmith/<product>  ·  N blocks in production
[ Copy lock ] [ Copy pull ] [ View JSON ] [ Pin production lock ]  ← when live but no lock file
```

| State | Copy | Primary CTA |
|-------|------|-------------|
| **No lock** | “Production graph ready — pin your repo to enforce agents” | **Pin production lock** |
| **Stale** | “Promoted after last pull — teams are drifting” | **Copy pull** |
| **Fresh** | “Agents and CI pinned to this graph” | **Copy lock** |

**Pin production lock API:** `POST /api/wiki/pin-lock` — calls `writeReferenceLock(doc)` when all blocks official and no lock exists. Fixes Apollo-style empty state.

---

### 2. Stage swimlanes (hero)

Horizontal lanes left → right:

```
INGEST  →  BUILD  →  STAGING  →  PRODUCTION  →  LOCKED  →  DEPLOYED
```

**Block card** (one per block id):

- Title + type icon (token / component / rule)
- Version badge (`v3` / `v4 draft`)
- Status color (draft / live / stale / conflict)
- Draggable or checkbox-select within Staging

**Lane semantics:**

| Lane | Blocks shown |
|------|----------------|
| **INGEST** | Last ingest run summary (timestamp, N created/bumped/staled) — not every block |
| **BUILD** | Compile artifacts pending (Pulse, device profile) — optional spinner |
| **STAGING** | `draft` or never-promoted blocks; latest > official |
| **PRODUCTION** | `official` pointer active |
| **LOCKED** | Blocks present in current `blocksmith.lock` |
| **DEPLOYED** | Blocks verified by last `validate:ui` or MCP read (future; can show “MCP-enforced” badge) |

**Minimum v1:** Staging + Production + Lock strip. Other lanes can be collapsible ribbons.

---

### 3. Promote gesture (not row action)

**Primary CTA:** `Promote to Production` (sticky bottom or top-right)

Flow:

1. User selects one or more cards in **Staging** (or “Promote all waiting”).
2. **Diff drawer** slides up:
   - Side-by-side: production vs staging per block
   - Token hex, governance text, component role
   - **Blast radius:** “Updates lock · 3 compile targets · MCP tools”
3. Confirm → `POST /api/wiki/promote` (existing) → cards animate to Production lane.
4. Lock strip refreshes; run logged.

**Conflict blocks:** Red card in Staging; promote = “Resolve & promote” (existing `resolveConflicts`).

---

### 4. Pipeline runs (history)

**Runs panel** (right sidebar or bottom drawer):

Each run = one promote, rollback, pin-lock, or ingest-with-auto-promote:

```
Run #42 · Priya · 2026-06-09 14:32
  Promoted 3 blocks: component:primary-action-button v2, …
  Lock: sha256:abc… → sha256:def…
  [ View diff ] [ Rollback run ]
```

**Data model:** `PipelineRun` — append-only log (Supabase table `pipeline_runs` when registry moves to cloud).

**Rollback:** Reuse `POST /api/wiki/rollback`; new run entry, never delete history.

---

### 5. Diff viewer

Component: `PromoteDiffDrawer`

- Input: `{ doc, blockIds[] }`
- Fetches official vs latest content from registry
- Renders human-readable diff (text for rules, swatches for colors, props for components)
- Required before confirm on multi-block promote

---

### 6. Empty & success states

**After scan, all auto-promoted, no lock:**

> Scan complete — **40 blocks in Production**  
> Agents are not pinned until you lock the repo.  
> **[ Pin production lock ]**

**After promote:**

> **3 blocks promoted to Production** — lock fresh  
> Next: `blocksmith pull --doc …` in your repo

No “0 drafts waiting” without explanation.

---

### 7. Handshake panel (embed from Releases)

Keep “Ship this truth” section at bottom:

- Pull command
- `@blocksmith/<package>` import
- `validate:ui` CI snippet
- MCP endpoint
- Links: device preview, blocks.v1 schema, lock.v1 schema

---

## Investor demo mode

**Route:** `/demo/investor` or `?demo=pipeline` on Pipeline

**Pre-seeded state** (scripted, works on Vercel):

| Element | State |
|---------|--------|
| 3 blocks | Draft v2 in Staging |
| Lock | Stale (on purpose) |
| 1 block | Conflict (optional) |

**Scripted walkthrough (90s):**

1. Pipeline opens — staging full, lock stale (visual chaos).
2. Select 3 cards → diff drawer → Promote to Production.
3. Cards animate; lock turns green.
4. Split view link: **agent without lock** (wrong UI) vs **with lock** (enforced).
5. Device frame + package preview refresh (same promote).

**Requirement:** Demo works on production SaaS with Supabase registry — not local disk only.

---

## API contracts

### Existing (wire up)

| Endpoint | Use |
|----------|-----|
| `GET /api/wiki/releases?doc=` | Hydrate lanes until dedicated pipeline API exists |
| `POST /api/wiki/promote` | Promote gesture |
| `POST /api/wiki/rollback` | Run history rollback |
| `GET /api/v1/lock?doc=` | Lock strip |

### New

| Endpoint | Body | Response |
|----------|------|----------|
| `POST /api/wiki/pin-lock` | `{ doc }` | `{ lockHash, pinnedBlocks, path }` |
| `GET /api/wiki/pipeline?doc=` | — | `{ lanes, lock, runs[], packageName, counts }` |
| `GET /api/wiki/pipeline/diff?doc=&blocks=id1,id2` | — | `{ diffs: [{ id, production, staging }] }` |

`GET /api/wiki/pipeline` can initially wrap `buildReleaseTable()` + run log.

---

## Platform dependency (blocking)

**Supabase registry + lock** — Pipeline on Vercel is unreliable until registry is durable.

Mirror `documents.ts` / orgs pattern:

- `block_registry_entries` (doc, block_id, versions jsonb, official int)
- `block_registry_manifest` (doc, official_graph_hash, counts)
- `block_locks` (doc, lock jsonb, content_hash, generated_at)
- `pipeline_runs` (doc, actor, action, payload, lock_before, lock_after, created_at)

See [PROJECT-PROTOCOL.md](./PROJECT-PROTOCOL.md) P3 for schema alignment.

---

## Enterprise hooks (same sprint)

| Feature | Pipeline surface |
|---------|------------------|
| **Audit** | Every run shows actor (GitHub user / API key owner) |
| **RBAC** | Only `releaser` + `admin` see Promote / Rollback / Pin |
| **Drift counter** | Banner: “12 PRs would fail validate:ui” (static ok for demo) |

---

## Design bar

- Reference: Linear deploy UI × Vercel promotions × Jenkins Blue Ocean (lanes, not 2000s tables)
- Motion on promote (cards slide Staging → Production)
- Dark + light wiki theme
- Mobile: lanes stack vertically; promote still works

---

## File checklist (suggested)

```
src/app/wiki/[[...slug]]/page.tsx          — route pipeline
src/components/wiki/pages/PipelinePage.tsx — main console
src/components/wiki/pipeline/
  LockStrip.tsx
  StageLane.tsx
  BlockCard.tsx
  PromoteDiffDrawer.tsx
  PipelineRunsPanel.tsx
src/app/api/wiki/pin-lock/route.ts
src/app/api/wiki/pipeline/route.ts
src/app/api/wiki/pipeline/diff/route.ts
src/lib/ir/pipeline-runs.ts                — run log writer
supabase/schema-registry.sql               — durable storage
```

---

## Definition of done

- [x] `/wiki/pipeline` is default nav for release control (Pipeline ranked above Releases; Releases relabeled "table view" with banner link)
- [x] Staging vs Production lanes with block cards (`StageLane` + `BlockCard`; conflict/stale/draft tones; locked badge; promote highlight animation)
- [x] Promote with diff drawer + blast radius copy (`PromoteDiffDrawer` ← `GET /api/wiki/pipeline/diff`; required before confirm)
- [x] **Pin production lock** when all live, no lock (`POST /api/wiki/pin-lock`; LockStrip primary CTA per state)
- [x] Pipeline run history (promote + rollback + pin + ingest + demo-seed; append-only; `Rollback run` re-uses rollback API; first-ever promotes correctly refuse rollback — no earlier finalized version)
- [x] Works on Vercel (Supabase registry: `supabase/schema-registry.sql` + `cloud-registry.ts` mirror/hydrate, env-gated with disk fallback — **apply the SQL in Supabase to activate**)
- [x] Investor demo mode reproducible without local setup (`/demo/investor` self-seeds via `POST /api/wiki/pipeline/demo`; re-seed on reload)
- [x] 90s Loom recordable without voiceover explaining basics (opening state: 3 drafts staged, 1 conflict, stale lock; promote → diff → lanes drain → lock turns green)

---

## Squad split

| Squad | Owns |
|-------|------|
| **Pipeline UI** | Lanes, cards, diff drawer, lock strip, motion |
| **Pipeline API** | pin-lock, pipeline aggregate, diff endpoint, runs log |
| **Platform** | Supabase registry + lock + runs tables |
| **Demo** | `/demo/investor` seed data + agent drift split view |
| **Compile** | On promote → refresh device iframe + Pulse preview in Pipeline |

---

## Do not

- Spend more time on Releases table polish
- Build per-block Jenkins instances
- Ship Pipeline without Supabase registry on Vercel
- Add features that don’t connect to promote → lock within two hops

---

*Assign by linking PRs to checkboxes above.*
