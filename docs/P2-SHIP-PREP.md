# P2 — Ship prep (pre-Stripe, pre-friend-beta)

After P0 (SaaS ACL) and P1 (team RBAC + governance E2E). P2 gets the product **publishable and documentable** without requiring Vercel yet.

---

## Tickets

| # | Item | Status |
|---|------|--------|
| P2-1 | npm publish readiness (`publish:packages`, READMEs, MIT license) | ✅ |
| P2-2 | Docs sync — GOAL1 OAuth, GOAL2 acceptance, DEPLOY refresh | ✅ |
| P2-3 | 30s demo script — SaaS pull + copilot (`.cursor/handshake-demo.md`) | ✅ |
| P2-4 | MCP `get_sync_status` — workspace stale + hosted hints | ✅ |
| P2-5 | `verify:production-smoke` — remote health curl | ✅ |
| P2-6 | `verify:mcp-sync` — MCP sync status fields | ✅ |
| P2-7 | API route note — `/api/scan/workspace` vs `/api/v1/scans` | ✅ |

**Deferred (P3 / deploy day):** Vercel deploy, GitHub OAuth prod URLs, Stripe, 30s video file.

---

## Verify

```bash
npm run verify:mcp-sync
npm run verify:software

# After deploy:
BLOCKSMITH_URL=https://your-app.vercel.app npm run verify:production-smoke
```

---

## npm publish (when ready)

```bash
npm run publish:packages:dry-run
npm run publish:packages
```

See [NPM-PUBLISH.md](./NPM-PUBLISH.md).

---

## API entry points

| Route | Audience | Auth |
|-------|----------|------|
| `POST /api/scan/workspace` | Browser home (GitHub OAuth) | Session or rate limit |
| `POST /api/v1/scans` | CLI / SDK / automation | API key |

Both call `runScanService()` — no consolidation needed; different auth surfaces.
