# Deploy — BlockSmith public SaaS

**Production:** https://blocksmith-mocha.vercel.app  
**Pitch / product model:** [PITCH-AND-PRODUCT-MODEL.md](./PITCH-AND-PRODUCT-MODEL.md)  
**Readiness tracker:** [GOAL-SAAS-STATUS.md](./GOAL-SAAS-STATUS.md) (Goal 1 & 2 → **≥80%** target)  
**Friends guide:** [FRIENDS-ONBOARDING.md](./FRIENDS-ONBOARDING.md) (no BlockSmith repo needed)

---

## Honest state (Jun 2026)

| Works on production | Still open |
|---------------------|------------|
| Vercel deploy + Supabase storage | Durable rate limits (Redis) |
| GitHub OAuth scan → wiki | Git webhooks auto-rescan |
| Portfolio sections + Styles (CSS + Tailwind) | npm publish (deferred) |
| Re-scan from GitHub, API keys, org invites (Supabase) | Stripe billing |
| `verify:production-smoke` + `verify:production-goals` | 30s demo video |

**Goal 1 public SaaS ~76% · Goal 2 ~66%** — see [GOAL-SAAS-STATUS.md](./GOAL-SAAS-STATUS.md) for gap list and path to 80%.

---

## Checklist

### ✅ 1. Vercel project

- Repo: `Desmosy/blocksmith` on `main`
- Framework: Next.js

### ✅ 2. Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | legacy anon JWT if needed |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | service_role |
| `BLOCKSMITH_ADMIN_SECRET` | ✅ | admin API key fallback |
| `AI_LAB_SCAN_CURATE` | ✅ | `0` on Vercel |
| `BLOCKSMITH_SCAN_RATE_LIMIT` | optional | default 8/hour/IP |
| `GITHUB_TOKEN` | optional | private repo clone fallback |
| `NVIDIA_API_KEY` | optional but recommended | AI refine for Visualize + governance copilot; semantic preview works without it |
| `NVIDIA_API_KEY_FALLBACK` | optional | second key if primary rate-limits |
| `NVIDIA_ENSEMBLE` | optional | `1` = slow multi-agent Visualize (not default). Default: hybrid semantic + single LLM refine |
| `NVIDIA_ENSEMBLE_ULTRA` | optional | with `NVIDIA_ENSEMBLE=1`: use 550b ultra as a primary |
| `NVIDIA_MODEL_CHROME_REFINER` | optional | default `openai/gpt-oss-120b` for refiner pass |

### ✅ 3. Supabase SQL (required)

Run in order:

1. [`supabase/setup.sql`](../supabase/setup.sql)
2. [`supabase/schema.sql`](../supabase/schema.sql)
3. [`supabase/schema-orgs.sql`](../supabase/schema-orgs.sql)

### 4. Deploy + verify

```bash
# After deploy
BLOCKSMITH_URL=https://blocksmith-mocha.vercel.app npm run verify:production-smoke
BLOCKSMITH_URL=https://blocksmith-mocha.vercel.app npm run verify:production-goals
```

Manual (Goal 1 + 2): sign in → scan repo → Featured + Styles → Finalize → API key → pull. See [GOAL-SAAS-STATUS.md](./GOAL-SAAS-STATUS.md).

### 5. API keys (self-serve)

Wiki → **Sync** → **Create API key** (GitHub sign-in required).

### 6. Send a friend

Point them to [FRIENDS-ONBOARDING.md](./FRIENDS-ONBOARDING.md) — browser-only or CLI+MCP paths.

---

## Post-deploy: reach 80% (no npm)

| Action | Goal |
|--------|------|
| Re-scan portfolio on prod | Goal 1 — validate featured + Styles |
| Run production-goals verify in CI | Goal 1 — automated proof |
| Finalize + pull on real repo | Goal 2 — handshake |
| Optional: `NVIDIA_API_KEY` on Vercel | Goal 2 — copilot on hosted |

**Deferred:** npm publish, Stripe, webhooks.

---

## Related

- [SUPABASE.md](./SUPABASE.md)
- [DISTRIBUTION.md](./DISTRIBUTION.md)
- [GOAL1-VENDOR-SCAN.md](./GOAL1-VENDOR-SCAN.md)
- [GOAL2-GOVERNANCE-COPILOT.md](./GOAL2-GOVERNANCE-COPILOT.md)
