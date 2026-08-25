# 10 — Governance copilot

Natural-language → **role** + **description** drafts for component pages. Governance only; scan facts stay read-only.

```bash
# Requires NVIDIA_API_KEY in .env.local
npm run verify:governance-copilot
```

**API:** `POST /api/wiki/governance/draft`

**UI:** `GovernanceCopilotPanel` on workspace-scan component pages.
