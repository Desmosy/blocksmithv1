# End-to-end test guide — the FULL pipeline

Tests the complete product loop, both sides of the handshake:

```
DESIGN SIDE                          DEVELOPER SIDE
capture / scan → wiki → stage        CLI pull → DESIGN.md + blocksmith.lock
→ promote → pin lock          ⇄      → MCP agents governed → validate:ui in CI
                                     → blocksmith check → Pulse package
```

Budget **2.5–3 hours** for the full pass. Do it in order — later parts depend on
earlier state (you can't test pull before something is promoted and pinned).

**Companions:** [RELEASE-TEST-PLAN.md](./RELEASE-TEST-PLAN.md) (reliability-fix detail) · [FRIENDS-ONBOARDING.md](./FRIENDS-ONBOARDING.md) · [MCP.md](./MCP.md) · [DISTRIBUTION.md](./DISTRIBUTION.md)

---

## Part 0 — Prerequisites (~20 min, one-time)

### 0.1 Supabase migration ⚠️ REQUIRED

SQL Editor → run:

```sql
alter table blocksmith_pipeline_runs add column if not exists status text not null default 'success';
alter table blocksmith_pipeline_runs add column if not exists log jsonb;
```

### 0.2 Environment

`.env.local` (and Vercel for prod): Supabase URL + **current** publishable key +
**current** secret key (see the API-key incident — copy from dashboard, don't
trust old values), `NVIDIA_API_KEY`, `BLOCKSMITH_ADMIN_SECRET`, Upstash vars.

### 0.3 Build everything once

```bash
npm install
npm run typecheck            # clean
npm run build:packages       # builds @block-smith/cli + @blocksmith/sdk
npm link -w @block-smith/cli # `blocksmith` now on your PATH
blocksmith --help            # sanity
```

### 0.4 A consumer repo

You need a **second repo** (any React project you own — NOT the BlockSmith
monorepo) to play the customer: it will receive `DESIGN.md`, the lock, and CI
gates. Call it `~/consumer-app` below.

### 0.5 Extension

`chrome://extensions` → Developer mode → Load unpacked → `extension/` folder.

### 0.6 Start local

```bash
npm run dev   # http://localhost:3000
```

---

## Part 1 — Design side: scan → wiki → promote → lock (~15 min)

| # | Step | Expected |
|---|------|----------|
| 1.1 | Sign in with GitHub | Lands signed in (post key/scope fixes) |
| 1.2 | Scan a repo (Connect GitHub or Try demo) | Wiki: Featured components, Foundation → Color/Styles populated |
| 1.3 | Component page → edit **Role** → Save to staging | Staged, not live |
| 1.4 | **Pipeline** | Staged edit in Staging lane; scanned blocks in Production |
| 1.5 | Select → **Promote** → diff drawer → confirm | Card moves to Production; lock hash in success message |
| 1.6 | Click the run badge in the stage grid | Console drawer: per-block log, lock before→after, "Persisted to cloud registry" |
| 1.7 | **Pin production lock** (if lock strip shows none) | Lock Fresh; pin-lock run logged with console |
| 1.8 | **Sync** page | Lock card + pull command + **Create API key** button visible |

## Part 2 — Failure visibility + rate limits (~10 min)

| # | Step | Expected |
|---|------|----------|
| 2.1 | `curl -X POST localhost:3000/api/wiki/promote -H 'Content-Type: application/json' -d '{"doc":"<doc>","blockIds":["component:nope"]}'` | Red **failed** run on Pipeline; console shows ERROR naming the block; no Rollback button on it |
| 2.2 | Loop a pin-lock curl ~130× | ~120 × 200/409 then **429** "Too many pipeline actions" |
| 2.3 | Re-scan after changing one component in code → open scan run console | "Version bumped (content changed): …" names exactly that component |

## Part 3 — Developer handshake: CLI → pull → lock in repo (~30 min)

**This is the product's other half. Nothing below is optional.**

### 3.1 API key

Wiki → Sync → **Create API key** (or admin path: `POST /api/v1/auth/keys` with
`X-BlockSmith-Admin-Secret`). Copy the `bs_live_…` value — shown once.

### 3.2 Login

```bash
blocksmith login --key bs_live_YOUR_KEY --url http://localhost:3000
blocksmith whoami
```

**Expected:** whoami prints your key's identity. Config lands in `~/.blocksmith/config.json`.

### 3.3 Pull into the consumer repo

```bash
cd ~/consumer-app
blocksmith pull --doc upload:scan-YOUR-PROJECT.md   # exact ref from wiki URL or Sync page
```

**Expected — check all three:**
- `DESIGN.md` written (promoted design truth as readable rules)
- `.blocksmith/wiki-overrides.json` (your finalized component overrides — the Role you edited in 1.3)
- `blocksmith.lock` — **only because you pinned in 1.7.** If you skip pinning, the CLI must print "lock skipped — promote blocks in the Pipeline to pin versions" instead of writing a lock. Test both branches.

### 3.4 The staleness loop (core trust mechanic)

1. Back on the wiki: edit + promote one more block (lock regenerates).
2. In `~/consumer-app`: your local `blocksmith.lock` is now **behind**.
3. Wiki Sync page / `get_sync_status` should indicate drift ("promoted after last pull").
4. `blocksmith pull` again → lock updates → fresh.

**Expected:** at no point does anything silently rewrite your lock — only pull moves it.

### 3.5 `blocksmith check` — off-token gate in the repo

```bash
cd ~/consumer-app
echo 'export const Bad = () => <div style={{ color: "#ff00aa" }} />;' > src/bad.tsx
git add src/bad.tsx
blocksmith check --staged
```

**Expected:** a finding flagging the off-token hex `#ff00aa` against your doc's
palette; exit non-zero with `--strict`. Remove the file, re-run → clean.

### 3.6 CI gate — validate:ui with the lock

From the BlockSmith repo (or CI):

```bash
npm run validate:ui -- --lock ~/consumer-app/blocksmith.lock --all
```

**Expected:** off-token colors in changed UI files fail the run; clean tree passes. This is the customer's GitHub Action.

### 3.7 Client-side scan upload

```bash
blocksmith scan ~/consumer-app
```

**Expected:** new `upload:scan-…` doc appears on the wiki under your account; Pipeline hydrates for it.

## Part 4 — MCP: agents physically governed (~20 min)

### 4.1 Remote MCP in Cursor

```bash
blocksmith mcp-url   # prints url + header
```

`.cursor/mcp.json` in the consumer repo:

```json
{ "mcpServers": { "blocksmith": {
    "url": "http://localhost:3000/api/mcp",
    "headers": { "Authorization": "Bearer bs_live_YOUR_KEY" } } } }
```

Restart Cursor MCP.

### 4.2 The governed loop (in Cursor chat)

| # | Prompt | Expected |
|---|--------|----------|
| a | "Use BlockSmith `get_governance_rules`" | Palette, do/don't rules, component count — matching the wiki |
| b | "Call `validate_ui_code` on: `<div style={{color:'#ff00aa'}}/>`" | Violation: off-token color, suggests nearest token |
| c | "Run the `governed_ui_task` prompt to update the primary button" | Agent follows: history → rules → build with tokens → validate → log |
| d | "Call `log_component_work` for the button describing the change" | Entry appears on the wiki component page **Activity** section |
| e | **Enforcement check:** stage (don't promote) a draft change on the wiki, then ask MCP for that component's docs | Agent sees the **promoted** version only — drafts are invisible to agents |

Step (e) is the thesis of the product. If an agent can see a draft, that's a release blocker.

### 4.3 Local stdio (maintainer path)

`cp .cursor/mcp.json.example .cursor/mcp.json` in the BlockSmith repo, set
`BLOCKSMITH_DOC`, restart Cursor → same tools work without the hosted URL.

## Part 5 — IDE ↔ Web live sync, local (~10 min)

| # | Step | Expected |
|---|------|----------|
| 5.1 | With `npm run dev` running, edit `docs/designs.md/apollo.md` (change a color name), save | Wiki auto-refreshes via SSE within ~2s — no manual reload |
| 5.2 | On the wiki, edit a component's governance text → Save to staging → promote | The `.md` file on disk updates (Web → IDE writeback) |
| 5.3 | Edit the same block in both places to conflict | Conflict surfaces (409 / conflict state), not a silent overwrite |

## Part 6 — Pulse package (~10 min)

```bash
blocksmith codegen --doc upload:scan-YOUR-PROJECT.md
```

**Expected:** `@blocksmith/<product>` generated from **promoted blocks only**;
version aligns with the lock. Preview at `/demo/pulse` locally. (Auto-publish is
out of scope — manual path only per sprint.)

## Part 7 — Capture extension: draft → review → confirm (~15 min)

| # | Step | Expected |
|---|------|----------|
| 7.1 | Popup → Server = `http://localhost:3000`; open a Canva/Figma design; capture 2 views | Thumbnails, count "2 captures", max 4 |
| 7.2 | **Generate design.md** (10–30s) | "Draft created … (visual estimates)"; wiki opens on the doc |
| 7.3 | The doc | **"Captured draft — not confirmed truth yet"** banner on every page; provenance footer in Source |
| 7.4 | **Review & edit source** → fix one value → save | Edit persists |
| 7.5 | **Confirm as design.md** | Banner clears permanently; marker gone from Source |
| 7.6 | Quality: compare 2–3 captures vs source designs | Sensible role names, no invented components; if poor → pin `NVIDIA_MODEL_VISION` |
| 7.7 | Signed-out capture (strict mode) | Clear "Sign in to BlockSmith" error, not a silent failure |

## Part 8 — Production pass (~30 min)

Deploy first (with the env fixes from Part 0.2), then repeat the critical subset
on https://blocksmith-mocha.vercel.app:

| # | Test | Why |
|---|------|-----|
| 8.1 | Part 1 full loop on prod | Stranger path hosted |
| 8.2 | **Cold-start durability:** promote + pin → redeploy (or 15 min idle) → reopen Pipeline | Promote still live, lock still Fresh, run consoles intact — validates the biggest fixes; DO NOT SKIP |
| 8.3 | Pipeline cold load < 3s (devtools on `/api/wiki/pipeline`) | P1 #14 |
| 8.4 | Part 3 (CLI login/pull/check) against the prod URL | The handshake is what customers run against prod |
| 8.5 | Part 4.2 with prod MCP URL | Remote MCP is Pattern 3 |
| 8.6 | Part 7 with extension Server = prod URL | Capture hosted |

## Part 9 — Automated suites (~15 min)

```bash
npm run verify:software      # typecheck + scan + wiki + handshake pull/writeback/acceptance
                             # + sync-conflict + ACL + security gate + RBAC + governance
                             # + mcp-sync + pulse — the whole local product
BLOCKSMITH_URL=https://blocksmith-mocha.vercel.app npm run verify:production-goals
BLOCKSMITH_URL=https://blocksmith-mocha.vercel.app npm run verify:production-smoke
```

All green, or the failure names the broken surface.

---

## Sign-off checklist

- [ ] 0.1 migration applied; env keys are **current** (dashboard-copied)
- [ ] Part 1 loop passes local + prod
- [ ] Failed runs visible + inspectable (2.1)
- [ ] `blocksmith pull` writes DESIGN.md + overrides + lock; **no-lock branch prints guidance** (3.3)
- [ ] Staleness loop: promote → drift visible → re-pull → fresh (3.4)
- [ ] `blocksmith check` catches off-token hex (3.5); `validate:ui --lock` gates CI (3.6)
- [ ] MCP: rules/validate/log loop works; **drafts invisible to agents** (4.2e)
- [ ] IDE↔Web sync both directions + conflict surfaces (Part 5)
- [ ] Pulse codegen from promoted blocks only (Part 6)
- [ ] Capture → draft → edit → confirm (Part 7)
- [ ] Cold-start durability on prod (8.2)
- [ ] `verify:software` + both production verifies green
- [ ] Manual stranger test by 2 non-builders (PUBLIC-RELEASE-SPRINT)

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Sign-in fails "Invalid API key" | Re-copy publishable + secret keys from Supabase dashboard; restart dev / redeploy |
| Sign-in fails "Error getting user profile" | Scopes must include `user:email` (fixed in code — confirm deployed) |
| `blocksmith` not found | `npm run build:packages && npm link -w @block-smith/cli` |
| `pull` "not found" | Use the full ref: `upload:scan-….md` (from wiki URL `?doc=`) |
| Pull writes no lock | Expected until you **Pin production lock** / promote on Pipeline |
| API key creation fails | Run `schema.sql` in Supabase SQL editor |
| MCP tools missing in Cursor | Restart MCP (Settings → MCP → refresh); check Bearer header |
| Agent sees draft content (4.2e) | RELEASE BLOCKER — file it, do not ship |
| Capture 503 / 401 / poor quality | `NVIDIA_API_KEY` missing / sign in / pin `NVIDIA_MODEL_VISION` |
| Runs missing console logs on prod | Migration 0.1 not applied |
| 429 during test loops | Raise `BLOCKSMITH_PIPELINE_RATE_LIMIT` / `BLOCKSMITH_AI_RATE_LIMIT` temporarily |
