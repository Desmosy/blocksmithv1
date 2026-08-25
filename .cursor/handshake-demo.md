# 30s handshake demo script

Record screen + terminal. Run `npm run dev` in another terminal.

## Setup (before record)

```bash
npm run scan:vendor
# Wiki doc: upload:scan-acme-ui-kit.md
```

Sign in with GitHub if testing OAuth scan path.

---

## Part A — Scan → wiki (10s)

1. Home → **Connect GitHub** → pick a repo → **Scan → wiki** (or **Try demo**).
2. Wiki opens with components, tokens, live previews.

---

## Part B — Governance copilot → finalize (10s)

1. Wiki → Components → **Button**.
2. **Governance copilot**: *"Primary CTA only, max one per view."* → **Draft rules** → **Apply to draft**.
3. **Save draft** → **Finalize**.
4. Wiki → **Sync** — note `blocksmith pull` hint.

---

## Part C — Web → IDE pull (10s)

Terminal:

```bash
npm run build:packages
blocksmith login --key bs_live_… --url http://localhost:3000
blocksmith pull --doc upload:scan-acme-ui-kit.md --workspace /tmp/my-design-system
```

Show `DESIGN.md` in `/tmp/my-design-system` with Button role.

Optional: MCP `get_component_docs` + `get_sync_status` for same doc.

---

## Verify (off camera)

```bash
npm run verify:governance-e2e
npm run verify:handshake-acceptance
npm run verify:software
```
