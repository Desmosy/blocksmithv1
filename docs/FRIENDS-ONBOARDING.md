# Friends onboarding — hosted BlockSmith (no repo clone)

**What BlockSmith is:** [PITCH-AND-PRODUCT-MODEL.md](./PITCH-AND-PRODUCT-MODEL.md) — scan → wiki for your team; Pulse package (`@blocksmith/<product>`) for devs/agents.

Use **https://blocksmith-mocha.vercel.app** (or your team’s URL). You do **not** need the BlockSmith source repo.

---

## UI/UX / PM (browser only)

1. Open the app → **Connect GitHub**
2. Pick your repo → **Scan codebase**
3. Browse the wiki:
   - **Foundation → Color / Styles**
   - **Components → Featured**
   - **Codebase → Full inventory**
4. To refresh after code changes: wiki banner → **Re-scan from GitHub**

---

## Developer (API key + CLI)

### 1. Create a key

Wiki → **Sync** → **Create API key** (after GitHub sign-in). Copy it once.

### 2. Install CLI

**From npm** (when published):

```bash
npm install -g @block-smith/cli
```

**From BlockSmith monorepo** (maintainers only):

```bash
cd /path/to/blocksmith
npm run build:packages
npm link -w @block-smith/cli
```

### 3. Log in (any directory)

```bash
blocksmith login --key bs_live_YOUR_KEY --url https://blocksmith-mocha.vercel.app
blocksmith whoami
```

### 4. Pull governance into **your** project

```bash
cd ~/your-design-repo
blocksmith pull --doc upload:scan-YOUR-PROJECT.md
```

Get the exact `upload:…` ref from the wiki URL (`?doc=upload%3A…`) or Sync page.

Writes `DESIGN.md` and `.blocksmith/wiki-overrides.json` after you **Finalize** component prose on the wiki.

### 5. Optional — scan from laptop

```bash
blocksmith scan ~/your-design-repo
```

Uploads a fresh scan to your account.

### 6. Optional — Cursor MCP

```json
{
  "mcpServers": {
    "blocksmith": {
      "url": "https://blocksmith-mocha.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer bs_live_YOUR_KEY"
      }
    }
  }
}
```

Or after login: `blocksmith mcp-url`

---

## Hosted vs local sync

| | Hosted (Vercel) | Local (`npm run dev`) |
|--|-----------------|----------------------|
| Scan | GitHub OAuth on server | `blocksmith scan /path` or watcher |
| Refresh wiki | **Re-scan from GitHub** | Save files → auto-rescan |
| Wiki → repo | `blocksmith pull` on your machine | `pull` or auto-writeback |

The `/tmp/blocksmith-clone-…` path in scan metadata is **server-only** — ignore it for pull; use your local git repo.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| 0 featured components | Re-scan; portfolio sections under `src/components/` auto-feature |
| Empty Styles | Re-scan after deploy; check **Foundation → Styles** for utility classes |
| API key fails | Run `schema.sql` in Supabase SQL editor |
| Team invite EROFS | Run `schema-orgs.sql`; redeploy after latest `main` |
| Pull not found | Use full doc ref: `upload:scan-….md` |

See [GOAL-SAAS-STATUS.md](./GOAL-SAAS-STATUS.md) for readiness scores.
