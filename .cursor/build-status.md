# BlockSmith build status (handoff)

Last updated: 2026-06-06 (deploy parked → Phase 2 active)  
**Read this before continuing work.**

**Active track:** Phase 2 `@blocksmith/pulse` codegen — v0 implemented; see `docs/PHASE2-PULSE.md`  
**Parked track:** Vercel deploy + friend beta — see `docs/DEPLOY.md`

---

## Vision (phased)

| Phase | What |
|-------|------|
| **1 — Software** *(now)* | Scan → `.md` → visual wiki → MCP governance. Verifiable. |
| **2 — Library** *(next)* | `.md` → `@blocksmith/<app>` — import `Surface` / `Text` / colors; no hand CSS. |
| **3 — Hardware** *(later)* | Device `.md` → device package; same imports, baked constraints. |

**Paused:** ingest-everything, Quartus/FPGA, social screenshots, public feedback at scale.

## North star (current — phase 1)

```
scan facts → (optional LLM curate) → published .md → wiki parse → visual pages → MCP govern
```

**Three layers — do not mix:**

| Layer | Meaning |
|-------|---------|
| **Inventory** | Every `.tsx`/`.jsx` under scan paths — full coverage |
| **Featured** | Designer-facing components with live previews |
| **Upload wiki** | Comprehensive `.md` (e.g. `d.md`) — separate parser path |

---

## Pipeline (implemented)

```
1. scanWorkspace()           src/lib/scan/extract.ts
2. workspaceScanToMarkdown() src/lib/scan/to-markdown.ts  (+ full inventory section)
3. resolveScanMarkdownForWiki() src/ai-lab/09-scan-curate/resolve.ts
   - LLM polishes tokens + featured prose only (AI_LAB_SCAN_CURATE=1)
   - Inventory ALWAYS re-appended deterministically (mergeInventoryIntoMarkdown)
4. write data/uploads/scan-<id>.md (stable when `workspaceId` in `blocksmith.config.json`)
5. optional: vendor `.blocksmith/scan-snapshot.md` (export unless `exportSnapshot: false`)
6. wiki loads via parseWorkspaceScanMarkdown() → mode: workspace-scan
```

**Vendor config (Goal 1 limitation fixes):**

- `blocksmith.config.json` — `workspaceId`, `scanPaths`, `catalogPaths`, `exportSnapshot`
- `.blocksmith/catalog.json` — `forceFeatured`, `forceInventoryOnly`, `exclude`
- Loader: `src/lib/scan/workspace-config.ts`
- Full write-up: `docs/GOAL1-VENDOR-SCAN.md`

**Distribution (Patterns 2–4 — ship without open repo):**

- API: `/api/v1/me`, `/api/v1/scans`, `/api/v1/auth/keys` (admin secret)
- Remote MCP: `/api/mcp` (Bearer `bs_live_…`)
- Packages: `packages/sdk` (`@blocksmith/sdk`), `packages/cli` (`@block-smith/cli`)
- Docs: `docs/DISTRIBUTION.md`
- Verify: `npm run verify:cloud-api`

**Supabase Storage (free persistence for Vercel):**

- Env: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Bucket: `scan-docs` — run `supabase/setup.sql`
- Uploads/scans → Supabase when service key set; else `data/uploads/` local
- Docs: `docs/SUPABASE.md` · Verify: `npm run verify:supabase`

**Audit copies:**

- Facts: `.blocksmith/scan-facts/scan-*-facts.md`
- Curated cache: `.blocksmith/ai-lab/scan-curated/<doc>/<hash>.md`

---

## Verify before adding features

```bash
npm run verify:software      # ONE command — run before any commit or PR
```

Or step by step:

```bash
npm run scan                 # loads .env.local, may take 30–90s if curate on
npm run scan:verify          # every inventoried React path is in published .md
npm run verify:scan-wiki     # scan ↔ .md ↔ wiki parse consistent
npm run verify:goal1          # fixture + E2E persist + optional external repo
npm run verify:vendor-fixture # scan works on fixtures/vendor-ui (no LLM)
npm run typecheck
npm run verify:wiki          # comprehensive upload wiki (design-163e34fb.md)
```

All should pass. Pre-commit runs `scan:verify`, `verify:scan-wiki`, `verify:vendor-fixture`, `governance:check`.

---

## BlockSmith self-scan numbers (latest)

| Metric | Value |
|--------|-------|
| Scan paths | `src`, `app`, `packages`, `styles` |
| UI files walked | ~81 |
| React inventory | **81** files |
| Featured components | **7** (+ ScanStaleBanner, ScanConflictHint) |
| Designer color tokens | 8 (from CSS vars in `globals.css`) |
| CSS vars | 14 |

**Test URLs:**

- Wiki intro: `http://localhost:3000/wiki?doc=upload%3Ascan-blocksmith-d9ae1a80.md`
- Full inventory: `/wiki/inventory?doc=...`
- Featured hub: `/wiki/components?doc=...`
- Example component: `/wiki/components/buttonpreview?doc=...`

**MCP env example:**

```json
"BLOCKSMITH_WORKSPACE": "/path/to/vendor-app",
"BLOCKSMITH_DOC": "upload:scan-blocksmith-d9ae1a80.md"
```

---

## Wiki structure (workspace-scan mode)

**Sidebar (intentional — no Explore/Playground/Demo on scan docs):**

- Introduction
- **Foundation** — Color, CSS variables, Surfaces, Spacing
- **Components** — Featured hub + per-component pages
- **Codebase** — Full inventory table
- **System** — Sync, Governance

**Component pages:**

- Live preview first (local React preview when scanning BlockSmith itself; token preview otherwise)
- Scan details collapsed under “for engineers”
- Old `/wiki/doc/<component>` routes redirect to component preview pages

---

## Key files touched this session

| Area | Path |
|------|------|
| Scan core | `src/lib/scan/extract.ts`, `walk.ts`, `catalog.ts`, `inventory.ts`, `parse.ts`, `run.ts` |
| Scan types | `src/lib/scan/types.ts`, `tokens.ts`, `local-preview.ts` |
| LLM curate | `src/ai-lab/09-scan-curate/*` |
| Wiki pages | `ScanInventoryPage`, `ScanComponentsHubPage`, `ScannedComponentLivePreview`, `ComponentDetailPage` |
| Wiki routing | `src/app/wiki/[[...slug]]/page.tsx` |
| Button preview CSS | `src/app/globals.css` (`wiki-cta-primary` in `.design-preview`) |
| Verify scripts | `scripts/verify-scan-coverage.ts`, `scripts/verify-scan-wiki.ts` |
| CLI scan | `scripts/scan-workspace.ts` (loads `.env.local`) |

---

## Fixes applied (chronological themes)

1. **Stopped dumping raw markdown** — doc routes no longer show `Hex | Occurrences` tables for components; Foundation uses visual pages.
2. **Catalog classifier** — excludes rendering infra (`PretextText`, etc.) from featured; not from inventory.
3. **Scan → classify → curate** — LLM writes designer prose; facts stay on disk.
4. **Full inventory** — 79/79 React files in published `.md`; `scan:verify` enforces.
5. **Live previews** — `ScannedComponentLivePreview` for known BlockSmith showcase components; `globals.css` fixes unstyled buttons without Visualize.
6. **Removed misleading nav** — Playground/Demo removed from workspace-scan until scan-backed.
7. **Introduction** — shows coverage stats + links to inventory.

---

## Env (`.env.local`)

```bash
NVIDIA_API_KEY=...
NVIDIA_MODEL_PARSER=openai/gpt-oss-120b
AI_LAB_SCAN_CURATE=1    # 0 = facts-only, no LLM
```

Scan script: `npm run scan` uses `tsx --conditions=react-server` (required for `server-only` in curate store).

---

## Core goals (original thesis — finish in order)

| # | Goal | Status | Command / notes |
|---|------|--------|-----------------|
| **1** | Vendor scan E2E (codebase → .md → wiki) | ✅ | `npm run verify:goal1`, home **Scan → wiki**, `POST /api/scan/workspace` |
| **2** | Two-way handshake on scan docs (Web → IDE finalize) | ✅ | `npm run verify:handshake-writeback` |
| **3** | Handshake acceptance (IDE→Web, MCP=wiki) | ✅ | `npm run verify:handshake-acceptance` |
| **4** | Conflict/stale UX across scan + upload | ✅ | `ScanStaleBanner`, `verify:sync-conflict` |
| **5** | 30s demo recording | ⬜ | `.cursor/handshake-demo.md` (manual) |

External repo (manual): `BLOCKSMITH_WORKSPACE=/path/to/vendor npm run verify:vendor-e2e`

---

## Software checklist (honest %)

| Layer | Status | Notes |
|-------|--------|-------|
| **Local pipeline** (`verify:software`) | ✅ ~100% | Scan, wiki, handshake, MCP — all pass locally |
| **Supabase persistence** | ✅ | `verify:supabase` |
| **Patterns 2–4 (local HTTP)** | ✅ | CLI, SDK, remote MCP on localhost |
| **Public internet / friends** | ⬜ 0% | **TODO:** `docs/DEPLOY.md` |
| **npm publish** | ⬜ | CLI/SDK in monorepo only |
| **API keys in cloud DB** | ⬜ | Still `data/cloud/api-keys.json` |
| Goal 5 — 30s demo video | ⬜ | `.cursor/handshake-demo.md` |

**Truth:** Code works on your machine. Product is **not** usable by anyone on the internet until DEPLOY checklist is done.

---

## Parked — ship to internet

Full steps: **`docs/DEPLOY.md`**

1. Vercel deploy + env vars  
2. Prod upload smoke test  
3. Create friend API key  
4. Send wiki URL + MCP config  

---

## Active — Phase 2 `@blocksmith/pulse`

Full plan: **`docs/PHASE2-PULSE.md`**

1. ✅ Token export from scan `.md` (`tokens.ts`, `tokens.css`)  
2. ✅ `Surface`, `Text`, `Button` primitives (CSS vars only)  
3. ✅ `npm run codegen:pulse` + `verify:pulse`  
4. ✅ Demo at `/demo/pulse` + home link  

**Hardware** stays paused until pulse v0 ships.

---

## Core goals (thesis)

| # | Goal | Status | Notes |
|---|------|--------|-------|
| **1** | Vendor scan E2E | ✅ local | `verify:goal1` |
| **2** | Web → IDE writeback | ✅ local | `verify:handshake-writeback` |
| **3** | IDE → Web + MCP | ✅ local | `verify:handshake-acceptance` |
| **4** | Stale/conflict UX | ✅ local | `verify:sync-conflict` |
| **5** | 30s demo | ⬜ | manual |
| **Ship** | Internet + MCP for friends | ⬜ | `DEPLOY.md` |
| **6** | `@blocksmith/pulse` codegen | ✅ local | `verify:pulse`, `/demo/pulse`, MCP `pulse_codegen` |

---

## Build order (updated)

1. ✅ Scan + inventory + verify (Goals 1–4 local)
2. ✅ Supabase + Patterns 2–4 (local)
3. ⬜ **DEPLOY** — `docs/DEPLOY.md` (parked)
4. ✅ **Phase 2 pulse v0** — `docs/PHASE2-PULSE.md` (demo page optional next)
5. ⬜ Phase 3 hardware (paused)

---

## Architecture decisions (locked for now)

- **Facts win over LLM** — hex subset validation; inventory merged after curate.
- **Featured ≠ inventory** — coverage for engineers, previews for designers.
- **No mock activity data** — activity from git/MCP only.
- **Governance in MCP connector** — not repo `CLAUDE.md` files.
- **Software before library/hardware** — phase 1 must pass `verify:software` on fixture + self-scan; then real vendor repo.

---

## Related docs

- `docs/DEPLOY.md` — ship to internet (TODO, parked)
- `docs/PHASE2-PULSE.md` — codegen library (active)
- `docs/SUPABASE.md` — storage
- `docs/DISTRIBUTION.md` — CLI / SDK / remote MCP
- `src/lib/scan/README.md` — scan pipeline
- `src/ai-lab/09-scan-curate/README.md` — black box curate
- `docs/MCP.md` — IDE-first ingest
- `docs/VISUALIZE-ACCURACY-PLAN.md` — Design IR / AI Lab architecture
- `src/ai-lab/README.md` — ai-lab steps 01–09

---

## Quick resume tomorrow

```bash
cd /Users/koshish/BlockSmith
npm run verify:workable         # one command — software + supabase + pulse
npm run dev
open "http://localhost:3000/demo/pulse"
open "http://localhost:3000/wiki?doc=upload%3Ascan-acme-ui-kit.md"
npm run verify:patterns-live    # with dev running
```

**If something feels wrong:** run the three verify commands above before adding code.
