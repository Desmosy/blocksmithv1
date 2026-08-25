# Goal 1 & 2 — Public SaaS readiness

Living tracker for **hosted BlockSmith** (Vercel + Supabase). Not billing, not public npm publish of Pulse packages.

**Pitch / product model:** [PITCH-AND-PRODUCT-MODEL.md](./PITCH-AND-PRODUCT-MODEL.md)  
**Production:** https://blocksmith-mocha.vercel.app

---

## Scores (public SaaS)

| Lens | Goal 1 — Scan → wiki | Goal 2 — Handshake + governance | Target |
|------|----------------------|----------------------------------|--------|
| Local dev | ~88% | ~85% | — |
| **Public SaaS (this doc)** | **~76%** ↑ | **~66%** ↑ | **≥80% each** |
| Stranger-ready (no hand-holding) | ~58% | ~52% | ~75% later |

Last updated: unified pitch doc, hybrid Visualize, documents Supabase fix, Pulse product model clarified.

---

## Goal 1 — What works on SaaS

| ✅ | Feature |
|----|---------|
| ✅ | GitHub OAuth → scan private/public repos |
| ✅ | Scan → Supabase upload → workspace-scan wiki |
| ✅ | Try demo (`scan-acme-ui-kit.md`, public) |
| ✅ | Portfolio `src/components/*.tsx` auto-featured |
| ✅ | Foundation → Styles (CSS rules + Tailwind className) |
| ✅ | Re-scan from GitHub (wiki banner + home page) |
| ✅ | API keys (Supabase-backed on Vercel) |
| ✅ | Per-user doc ownership |

## Goal 1 — Gaps to 80%

| Priority | Gap | Status |
|----------|-----|--------|
| P0 | Re-scan on prod after deploy (validates pipeline) | Manual — user action |
| P0 | Tailwind `className` → Styles page | ✅ Shipped |
| P1 | Production verify beyond health curl | ✅ `verify:production-goals` |
| P1 | Friend onboarding without npm | ✅ [FRIENDS-ONBOARDING.md](./FRIENDS-ONBOARDING.md) |
| P2 | Durable rate limits (Redis/Supabase) | Open |
| P2 | Git push webhooks → auto-rescan | Open |
| P3 | LLM scan curate on server | Off by design (`AI_LAB_SCAN_CURATE=0`) |
| — | **Visualize style** | ✅ Hybrid — semantic instant + optional AI refine ([VISUALIZE-AND-API.md](./VISUALIZE-AND-API.md)) |
| P1 | **Pulse package** after scan | v0 local; auto-on-scan ⬜ ([PHASE2-PULSE.md](./PHASE2-PULSE.md)) |
| P3 | Storybook / non-React | Out of scope |

---

## Goal 2 — What works on SaaS

| ✅ | Feature |
|----|---------|
| ✅ | Edit Role / Designer notes on scan component pages |
| ✅ | Save to staging → cloud scan `.md` + overrides sidecar (promote on Pipeline) |
| ✅ | `blocksmith pull` (CLI from local repo — see friends doc) |
| ✅ | Pull hint with copy button + hosted-path clarity |
| ✅ | Remote MCP `/api/mcp` + API key |
| ✅ | `get_sync_status` stale hints |
| ✅ | Governance copilot (local when `NVIDIA_API_KEY` set) |

## Goal 2 — Gaps to 80%

| Priority | Gap | Status |
|----------|-----|--------|
| P0 | Save to staging enabled for all `workspace-scan` uploads (not only local path) | ✅ Shipped |
| P0 | Hosted sync expectations (no IDE watcher on `/tmp` clone) | ✅ Copy + Sync page |
| P1 | Pull onboarding (login + copy command on Sync) | ✅ Shipped |
| P1 | Manual governance path when copilot off on Vercel | ✅ Manual edit works |
| P2 | IDE → Web live watcher on SaaS | **Not planned** — use re-scan / CLI scan |
| P2 | Governance copilot on Vercel | Needs `NVIDIA_API_KEY` (optional) |
| P3 | Multi-user conflict / CRDT | Open |
| P3 | 30s demo video | Open |

---

## Path to ≥80% (no npm publish)

### Goal 1 (+8 pts)

1. ✅ Tailwind utility classes in wiki Styles  
2. ✅ Production goals smoke script  
3. User re-scans portfolio on prod → confirm featured ≥10, Styles populated  
4. Optional next: `tailwind.config` theme token extraction  

### Goal 2 (+18 pts)

1. ✅ Save to staging on hosted upload docs  
2. ✅ Pull hint + friends onboarding  
3. Optional next: `NVIDIA_API_KEY` on Vercel for copilot  
4. Optional next: email/link share for scan wikis within org  

---

## Verify

```bash
# Local (full)
npm run verify:software

# Production
BLOCKSMITH_URL=https://blocksmith-mocha.vercel.app npm run verify:production-smoke
BLOCKSMITH_URL=https://blocksmith-mocha.vercel.app npm run verify:production-goals
```

### Manual prod checklist (Goal 1 + 2)

- [ ] Sign in → scan GitHub repo → wiki shows **Featured** + **Styles**
- [ ] **Re-scan from GitHub** on banner updates featured count
- [ ] Component page → edit Role → **Save to staging** → **Pipeline → Promote** → **Copy pull** works
- [ ] Sync → **Create API key** → `blocksmith login` + `whoami`
- [ ] Team invite (after `schema-orgs.sql`)

---

## Related

- [PITCH-AND-PRODUCT-MODEL.md](./PITCH-AND-PRODUCT-MODEL.md) — investor + team story
- [DEPLOY.md](./DEPLOY.md) — Vercel env + SQL
- [FRIENDS-ONBOARDING.md](./FRIENDS-ONBOARDING.md) — no BlockSmith repo required
- [GOAL1-VENDOR-SCAN.md](./GOAL1-VENDOR-SCAN.md)
- [GOAL2-GOVERNANCE-COPILOT.md](./GOAL2-GOVERNANCE-COPILOT.md)
- [08-web-ide-handshake.md](./08-web-ide-handshake.md)
