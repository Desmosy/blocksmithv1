# Production checklist

The single source of truth for taking BlockSmith live. Work top to bottom.
Status legend: ✅ done · ⚠️ needs your action · ⬜ not started.

---

## 1. Environment variables (set in Vercel → Project → Settings → Environment Variables)

### Core / data (required for multi-user)
| Var | What | Notes |
|-----|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key | public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role | **secret** — server only |
| `BLOCKSMITH_SAAS_STRICT` | `1` to enforce tenant isolation | **must be `1` in prod** |
| `BLOCKSMITH_ADMIN_SECRET` | admin/CI key minting | secret |

### Auth
- GitHub OAuth is configured in **Supabase → Authentication → Providers → GitHub**
  (client id/secret), not via app env. Set the callback + Site URL to the prod domain.

### AI (optional — features degrade gracefully if unset)
| Var | What |
|-----|------|
| `NVIDIA_API_KEY` (+ `NVIDIA_API_KEY_FALLBACK`) | NVIDIA inference key(s) |
| `NVIDIA_BASE_URL` | e.g. `https://integrate.api.nvidia.com/v1` |
| `NVIDIA_MODEL_CHROME` / `NVIDIA_MODEL_PARSER` | text models |
| `NVIDIA_MODEL_VISION` | image model (default: `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`) |

### Rate limiting (optional — falls back to in-memory)
| Var | What |
|-----|------|
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | distributed limits across instances |
| `BLOCKSMITH_SCAN_RATE_LIMIT*` / `BLOCKSMITH_AI_RATE_LIMIT*` | tune limits/windows |

> `.env.example` documents all of these. Never commit `.env.local` (gitignored).

---

## 2. Supabase setup ⚠️

- [ ] Create the project; copy URL + anon + service-role keys into Vercel.
- [ ] **Tables:** `blocksmith_documents`, orgs/members, `blocksmith_api_keys`,
      governance events. (See [SUPABASE.md](./SUPABASE.md) for schema.)
- [ ] **Storage bucket:** `scan-docs` (private) — design.md files persist here in
      prod (the local `data/` dir is **ephemeral** on Vercel).
- [ ] **Auth provider:** GitHub enabled; redirect URLs point at the prod domain.
- [ ] Row-level security on tenant tables (defense in depth behind app checks).

---

## 3. Pre-launch flips ⚠️
- [ ] `BLOCKSMITH_SAAS_STRICT=1` — **critical.** Without it, access checks run in
      open/local mode and tenants can read/modify each other's docs.
- [ ] Verify isolation after deploy: sign in as two accounts; confirm neither
      sees the other's projects on `/dashboard`, and delete/rename is owner-only.
- [ ] Custom domain + force HTTPS (HSTS header already set).

---

## 4. Hardened this pass ✅
- ✅ **Distributed rate limiting** via Upstash Redis (fixed-window, fail-open),
      across serverless instances. Verified live.
- ✅ **Dashboard works on serverless** — lists via the storage backend, not the
      ephemeral local filesystem.
- ✅ **Tenant scoping on the dashboard** — org-scoped docs; anonymous users in
      hosted mode see nothing.
- ✅ **Document registration** on every create/generate/Figma path → owned +
      org-scoped + delete/rename ownership checks work.
- ✅ **Security headers** — `nosniff`, `X-Frame-Options`, `Referrer-Policy`,
      `Permissions-Policy`, HSTS; `poweredByHeader: false`.
- ✅ **AI routes gated** — `/api/projects/create` (AI) + `/generate-image`
      require sign-in (strict mode) and are rate-limited (per-user / per-IP) —
      no unbounded LLM spend or anonymous abuse.
- ✅ **Branded 404 + prod-aware error page** (no dev hints leaked to users).
- ✅ **Graceful AI fallbacks** — generation degrades to a blank starter / 503.

- ✅ **Sentry** error monitoring (server/edge/client/boundaries), no-op until DSN set.
- ✅ **First-run onboarding** — guided empty state with one-click examples.
- ✅ **Legal**: `/terms` + `/privacy` starting drafts.
- ✅ **Rich hosted dashboard** via Redis metadata cache (name/kind/counts).
- ✅ **Startup config warnings** (missing Supabase / strict off / no Upstash).
- ✅ **robots.txt** — app + API kept out of search indexes.
- ✅ **Build unblocked** — excluded the nested `font-generator` app from the root
      tsconfig (it was failing `typecheck`/`build`); `verify:software` is green.

### Tenant isolation — verified controls
- ✅ Wiki reads gated by `assertWikiDocAccess` (default-deny, `notFound()`).
- ✅ Dashboard list org-scoped; anonymous = empty in hosted mode.
- ✅ Delete/rename owner-only; figma import/drift gated (write/read).
- ✅ AI routes auth-gated + rate-limited.
- ✅ Created/imported docs registered → owner can view + manage (also fixes a
      "404 on your own new project" bug that strict mode would otherwise cause).

---

## 5. Remaining hardening (prioritized) ⬜
**P1 — before real users**
- [x] ~~Error monitoring~~ — Sentry wired (add `NEXT_PUBLIC_SENTRY_DSN`).
- [x] ~~Onboarding~~ · ~~Legal drafts~~ · ~~Global error/404~~ — done.
- [ ] **Email delivery** for org invites / verification (needs a provider).
- [ ] Finalize the `/terms` + `/privacy` drafts with counsel.

**P2 — scale / polish**
- [x] ~~Denormalize project metadata~~ — Redis cache (rich hosted dashboard).
- [ ] **Content-Security-Policy** (needs nonce wiring; can break Next if rushed).
- [ ] **Sentry source-map upload** (`withSentryConfig` + auth token).
- [ ] **Vision latency** (~60–75s) — lighter model or async job.
- [ ] **Billing** (Stripe) + plan quotas, when you charge.
- [ ] More sign-in options (Google/email) for non-GitHub designers.

---

## 6. Deploy
```bash
# stop `npm run dev` first (guard-build refuses to build over an active dev server)
npm run build          # full production build — must pass clean
```
- Connect the repo to Vercel; set all env vars above; deploy.
- Node runtime routes with long work set `maxDuration` (scan 60s, vision 90s) —
  confirm your Vercel plan allows it (Pro ≥ 60s).

---

## 7. Post-deploy smoke test
- [ ] Sign in with GitHub → land on `/dashboard`.
- [ ] Create (blank), Generate with AI, Generate from screenshot, Upload .md,
      Import from Figma, Scan a repo — each opens a wiki.
- [ ] Rename + delete (with undo); confirm a second account can't touch them.
- [ ] Hit an endpoint repeatedly → 429 with `Retry-After` (rate limit live).
- [ ] `npm run verify:software` green against the build.
