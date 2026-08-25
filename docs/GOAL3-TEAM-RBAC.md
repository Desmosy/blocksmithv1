# Goal 3 — Team / org RBAC

Workspace-scoped access for scans and governance docs. No Stripe yet — billing attaches to org later.

---

## Model

| Entity | Purpose |
|--------|---------|
| **Organization** | Auto-created per user (`{login}'s workspace`) |
| **Member** | `user_id` or pending `invited_email` |
| **Document** | `org_id` on `blocksmith_documents` — team shares scans |

## Roles

| Role | Read wiki | Finalize / pull | Invite members |
|------|-----------|-----------------|----------------|
| **viewer** | ✅ | ❌ | ❌ |
| **member** | ✅ | ✅ | ❌ |
| **admin** | ✅ | ✅ | ✅ |
| **owner** | ✅ | ✅ | ✅ |

---

## Invite flow

1. Owner/admin: Wiki → **Sync** → **Team workspace** → invite by email + role
2. Teammate signs in with **GitHub using that email**
3. `auth/callback` runs `acceptPendingInvites` → membership activated

---

## SQL

Run after `schema.sql`:

[`supabase/schema-orgs.sql`](../supabase/schema-orgs.sql)

---

## API

| Route | Purpose |
|-------|---------|
| `GET /api/v1/orgs/me` | Current org + members |
| `POST /api/v1/orgs/invite` | `{ email, role }` |
| `DELETE /api/v1/orgs/members?id=` | Remove member |

---

## Verify

```bash
npm run verify:org-rbac
npm run verify:governance-e2e
```
