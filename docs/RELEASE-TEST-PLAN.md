# Release test plan — pipeline reliability session

**Scope:** every change from the scalability + pipeline-reliability session (June 2026).
**Run against:** production URL (https://blocksmith-mocha.vercel.app) after deploy. Local-only passes do not count (sprint rule #1).
**Before ANY testing:** apply the Supabase migration (§0). Several tests depend on it.

---

## 0. Pre-deploy: Supabase migration (REQUIRED)

`supabase/schema-registry.sql` gained two idempotent columns on `blocksmith_pipeline_runs`:

```sql
alter table blocksmith_pipeline_runs add column if not exists status text not null default 'success';
alter table blocksmith_pipeline_runs add column if not exists log jsonb;
```

**How to apply:** Supabase dashboard → SQL Editor → paste the two lines → Run.

**How to verify:**
```sql
select column_name from information_schema.columns
where table_name = 'blocksmith_pipeline_runs' and column_name in ('status','log');
```
Expected: 2 rows. (If you skip this, runs still record via the legacy-shape fallback, but console logs won't persist across cold starts.)

---

## 1. Pipeline cold-load performance

**What changed:** Pipeline GET no longer writes the whole registry back to Supabase on every view (was N+1 sequential round trips); sync is now one batched upsert and only runs when the registry was rebuilt from markdown.

**How to test:**
1. Deploy, then wait ~15 min (or trigger a fresh deployment) so lambdas are cold.
2. Open `/wiki/pipeline?doc=<your scan doc>` and time first paint of the stage grid (browser devtools → Network → the `/api/wiki/pipeline` request).
3. Reload twice more and note warm timings.

**Expected:** cold `/api/wiki/pipeline` well under 3s (P1 #14 target); warm loads far faster. In Supabase → Logs, viewing Pipeline should produce **no** upserts to `blocksmith_block_registry_entries`.

## 2. Promote survives serverless cold start (durability)

**What changed:** promote/rollback/pin-lock/finalize now `await` registry + lock + run persistence to Supabase before responding (previously fire-and-forget — losable on lambda freeze).

**How to test:**
1. Edit a component's Role → Save to staging.
2. Pipeline → select the staged block → Promote to Production → wait for success.
3. **Force a cold instance:** redeploy on Vercel (or wait ~15+ min idle).
4. Reopen Pipeline on the same doc.

**Expected:** the block is still in Production at the promoted version, lock hash unchanged, and the promote run (with console log) still in run history. Before this fix, step 4 could show the promote silently undone.

## 3. Pinned lock survives cold start (lock hydration)

**What changed:** locks were mirrored to Supabase but never read back — a cold lambda showed "No lock" after you pinned.

**How to test:**
1. On a doc where all blocks are live, click **Pin production lock** → lock strip turns green/fresh.
2. Redeploy (or wait for cold instance).
3. Reopen Pipeline and the Sync page.

**Expected:** lock strip still shows **Fresh** with the same hash. Sync page still shows the lock card. This is the single most important test before release — it was the "my lock disappeared overnight" bug.

## 4. Console output on every run

**What changed:** promote, pin-lock, rollback, and scan runs capture timestamped server-side logs; every run row in the stage grid is clickable.

**How to test:**
1. Promote a staged block.
2. In the Pipeline stage grid, click the run badge (e.g. `#7`) or "Console output".
3. Repeat for a scan run (re-scan the repo first) and a pin-lock run.

**Expected:** drawer opens with status badge (✓ success), actor, duration, block chips, lock before→after, and a dark monospace console showing lines like `Registry hydrated (312ms)`, `component:primary-button: promoted to v3`, `Lock regenerated: sha256:… (40 blocks pinned)`, `Persisted to cloud registry (…ms)`. Scan runs list created/bumped/staled block ids. Esc or backdrop click closes. Old runs (pre-deploy) show an honest "no console log captured" line, not fabricated data.

## 5. Failed runs are recorded and inspectable

**What changed:** failures append a red `failed` run with the error in its log (previously they vanished — only a 500 in devtools).

**How to test (pick one):**
- **Easiest:** POST to the API with a bogus block id:
  ```bash
  curl -X POST https://<prod>/api/wiki/promote \
    -H 'Content-Type: application/json' \
    -b '<your session cookie>' \
    -d '{"doc":"<your doc>","blockIds":["component:does-not-exist"]}'
  ```
- Or in the UI: stage nothing and force a promote of a conflict without resolving.

**Expected:** Pipeline run history shows a **red-badged** run "Promote failed — 0 of 1 blocks promoted"; clicking it opens the console with the ERROR line naming the block. Failed promote runs do **not** offer "Rollback run".

## 6. Rate limits on pipeline writes

**What changed:** promote, pin-lock, rollback, finalize now rate-limited per IP (default 120 actions / 10 min; env `BLOCKSMITH_PIPELINE_RATE_LIMIT`).

**How to test:**
```bash
for i in $(seq 1 130); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<prod>/api/wiki/pin-lock \
    -H 'Content-Type: application/json' -d '{"doc":"<your doc>"}'
done | sort | uniq -c
```

**Expected:** first ~120 return 200/409, remainder return **429** with "Too many pipeline actions — try again in Ns." Normal human clicking never hits it. Requires Upstash Redis env vars in prod for cross-instance enforcement (falls back to per-instance memory otherwise — still fine for launch).

## 7. Batch promote performance (regression check)

**What changed:** batch promote writes the manifest once per batch instead of per block (was O(N²) directory scans).

**How to test:** scan a repo with 30+ blocks where governance blocks are staged; "Promote all waiting". Check the promote run's console duration.

**Expected:** promote stage completes in low hundreds of ms; all blocks land in Production in one run entry; lock pins all of them.

## 8. Scan → ingest run logging

**What changed:** ingest runs carry a console log of created/bumped/staled/conflicted block ids.

**How to test:** re-scan a repo after changing one component in code → open the new scan run's console.

**Expected:** log shows `Version bumped (content changed): component:<the one you changed>` and correct unchanged/production counts. Vanished blocks appear as WARN "marked stale (not deleted)".

## 9. Automated gates (run before calling it done)

```bash
npm run typecheck                      # must be clean
npm run verify:ir-cicd                 # closed loop: ingest→promote→lock→rollback
BLOCKSMITH_URL=https://<prod> npm run verify:production-goals
BLOCKSMITH_URL=https://<prod> npm run verify:production-smoke
```

Plus the manual stranger checklist in PUBLIC-RELEASE-SPRINT.md, executed by **two people who didn't build it** (sprint definition of done).

---

## Release checklist (order matters)

1. ☐ Apply Supabase migration (§0) — before deploy is fine, columns are additive.
2. ☐ Confirm Upstash env vars present in Vercel (rate limits distributed).
3. ☐ Deploy to Vercel; `verify:production-smoke` green.
4. ☐ Run §1–§8 on production (30–40 min total).
5. ☐ `verify:production-goals` green.
6. ☐ Manual stranger test × 2 people, recorded.
7. ☐ Commit note: this session touched only pipeline/IR files — review `git diff` on `src/lib/ir/`, `src/lib/blocks/store.ts`, `src/lib/scan/service.ts`, `src/app/api/wiki/{promote,pin-lock,rollback,finalize}/`, `src/components/wiki/pipeline/`, `src/app/globals.css`, `supabase/schema-registry.sql` separately from the pre-existing WIP in the repo.

## Known limitations (accepted for this release — do not block launch)

- **Concurrent promotes can race** across lambdas (read-modify-write on registry entries has no cross-instance locking). Two humans promoting the same doc in the same second may interleave. Acceptable at launch scale; fix is registry-on-Postgres.
- **Registry source of truth is still disk-JSON + cloud mirror.** Post-release priority #1: move source of truth into Postgres (transactions, `for update` locking). Do NOT attempt this in the release week.
- Ingest runs from background scan contexts remain fire-and-forget mirrors (acceptable: scan itself force-syncs the registry).
