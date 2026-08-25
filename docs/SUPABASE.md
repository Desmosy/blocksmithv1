# Supabase setup (free tier)

BlockSmith uses Supabase **Storage** so scan + design `.md` files persist on Vercel (no ephemeral disk).

---

## 1. Create project (done)

You already have:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key)

---

## 2. Add service role key (required)

Dashboard → **Project Settings** → **API** → **service_role** (secret).

Add to `.env.local`:

```bash
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...   # or sb_secret_… format
```

**Not the publishable key** (`sb_publishable_…`) — that is only for `NEXT_PUBLIC_SUPABASE_ANON_KEY`.  
Uploads fail with “row-level security policy” if you paste the wrong key.

**Never commit this key.** Server API routes use it only.

---

## 3. Create storage bucket

Dashboard → **SQL Editor** → paste and run:

[`supabase/setup.sql`](../supabase/setup.sql)

Creates private bucket `scan-docs` for all `upload:*` markdown files.

---

## 4. Verify locally

```bash
npm run dev
# another terminal:
npm run verify:supabase
curl http://localhost:3000/api/supabase/health
```

Expected:

```json
{
  "serviceRoleSet": true,
  "storage": { "ok": true, "bucket": "scan-docs" }
}
```

---

## 5. What uses Supabase

| Action | Behavior |
|--------|----------|
| UX upload `.md` | → `scan-docs/uploads/{file}.md` |
| `scan_workspace` / scan API | → same bucket |
| Wiki read | Hydrates from Supabase → memory cache |
| Finalize edit | Writes back to Supabase |

**Fallback:** If `SUPABASE_SERVICE_ROLE_KEY` is unset, files stay in `data/uploads/` (local dev only).

---

## 6. Deploy to Vercel

Add env vars in Vercel project settings:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BLOCKSMITH_ADMIN_SECRET` (for API keys)

Then deploy — uploads survive across serverless invocations.

---

## 7. SaaS tables (ownership + API keys)

After storage bucket, run [`supabase/schema.sql`](../supabase/schema.sql):

- `blocksmith_documents` — maps `scan-*.md` → GitHub user id
- `blocksmith_api_keys` — self-serve keys from Wiki → Sync

Then run [`supabase/schema-orgs.sql`](../supabase/schema-orgs.sql) for team RBAC:

- `blocksmith_organizations` + `blocksmith_org_members`
- `org_id` on documents

Then run [`supabase/schema-registry.sql`](../supabase/schema-registry.sql) for **Pipeline / staging / promote** on Vercel:

- `blocksmith_block_registry_entries` — block versions (staging vs production)
- `blocksmith_registry_manifest`, `blocksmith_block_locks`, `blocksmith_pipeline_runs`

**Without schema-registry.sql, saves succeed but Pipeline stays empty on production.**

Enable **GitHub** provider in Supabase Auth (Dashboard → Authentication → Providers).

## 8. Next (optional)

- Activity ledger in Postgres
- Team/org sharing

See [DISTRIBUTION.md](./DISTRIBUTION.md) for CLI/MCP.
