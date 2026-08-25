# Security & identity release gate

**Status:** 🔴 **RELEASE BLOCKER** — do not ship to design partners or Fortune 100 pilots until this doc is green  
**Read with:** [GOAL3-TEAM-RBAC.md](./GOAL3-TEAM-RBAC.md) · [SUPABASE.md](./SUPABASE.md) �  
**Production:** https://blocksmith-mocha.vercel.app

---

## Copy-paste prompt for the team (Slack / Notion / standup)

```
MISSION: BlockSmith cannot release while customer design files are readable by strangers.

Right now a person can upload a DESIGN.md from the homepage and anyone with the URL
can browse their wiki — tokens, components, governance notes, the lot. There is no
visible Sign in / Create account on the main upload path. RBAC exists in code but is
not enforced end-to-end and is invisible in the product.

This is not a polish item. It is a P0 security sprint that BLOCKS public release,
design-partner onboarding, and any Fortune 100 conversation.

NON-NEGOTIABLES (ship nothing else until these pass):

1. IDENTITY BEFORE DATA
   - No upload, no wiki read, no Pipeline, no promote, no pull for private docs
     without authentication — except explicitly marked public demo content.
   - Homepage hero (paste / drop .md) must require sign-in BEFORE the file is accepted.
   - Show Sign in with GitHub (or email) in global chrome — header on / and /wiki.

2. DEFAULT DENY
   - Unregistered documents must NOT be world-readable. Today canAccessDocument()
     returns true when no registry row exists — that is a critical hole.
   - GET /api/wiki/import must not list other people's uploads.
   - Every wiki page route and every /api/wiki/* + /api/v1/* route must gate on ownership
     or org membership — audit the full surface, not just finalize/promote.

3. RBAC THAT USERS CAN SEE
   - Wiki → Sync → Team workspace must work on production (schema-orgs.sql applied).
   - Roles enforced in UI: viewer cannot promote; member cannot invite; admin/owner can.
   - Errors must say: "Sign in" / "Ask your admin for access" — never silent 404 alone.

4. PRODUCTION CONFIG IS PART OF SECURITY
   - Supabase Auth (GitHub OAuth) configured on Vercel with correct callback URLs.
   - schema.sql + schema-orgs.sql applied; storage bucket private; service role server-only.
   - BLOCKSMITH_SAAS_STRICT must be ON in production (default when NODE_ENV=production).
   - Never deploy with saasStrict off unless it is localhost.

5. VERIFY BEFORE MERGE
   npm run verify:saas-acl
   npm run verify:org-rbac
   npm run verify:governance-e2e
   npm run verify:production-goals
   + manual "stranger security test" (below) recorded by someone who did NOT write the code.

MERGE GATE: All verify scripts green + stranger security test checklist signed by two people.

If your PR does not close a box in this doc → do not merge.
Feature freeze on Pipeline polish, landing copy, and new wiki pages until identity is done.
```

---

## Why this blocks release

BlockSmith hosts **proprietary design systems** — color palettes, component specs, governance rules, agent instructions. Our buyers will be design leads and eng leads at companies where a leaked wiki URL is a **data exposure incident**, not a UX bug.

A stranger must never be able to:

- Open another team's wiki by guessing `/wiki?doc=upload:…`
- List recent uploads from the homepage API
- Promote, edit, or pull a document they do not own
- Read a GitHub scan doc belonging to another org

We already tell investors and design partners that we have **RBAC and audit**. The product must match that claim before anyone uploads real IP.

---

## Honest current state (Feb 2026)

We are **not starting from zero**. Substantial backend work exists. The problem is **incomplete enforcement**, **missing product UX**, and **gaps that fail open**.

### What exists (keep and harden)

| Layer | Location | Notes |
|-------|----------|-------|
| Strict mode toggle | `src/lib/cloud/saas.ts` | On when `NODE_ENV=production` unless `BLOCKSMITH_SAAS_STRICT=0` |
| Wiki read gate (uploads only) | `src/lib/cloud/wiki-access.ts` → `assertWikiDocAccess()` | Called from wiki page; 404 if denied |
| API write/read gate | `src/lib/cloud/access.ts` → `requireDocumentAccess()` | Used on promote, finalize, pipeline, source, lock, pull, etc. |
| RBAC model | `src/lib/cloud/rbac.ts` | owner / admin / member / viewer + `canPerform()` |
| Orgs + invites | `src/lib/cloud/orgs.ts`, `supabase/schema-orgs.sql` | API: `/api/v1/orgs/me`, invite, remove member |
| Team UI | `src/components/wiki/TeamPanel.tsx` on Sync page | Hidden unless user finds Sync; no homepage sign-in |
| GitHub OAuth | `ScanWorkspaceCard.tsx`, `/auth/callback` | Works for **repo scan** path; not wired to homepage upload hero |
| Upload auth (API) | `POST /api/wiki/import` | 401 in strict mode without session |
| Verification | `npm run verify:saas-acl`, `verify:org-rbac` | Unit-level; not full route audit |

### Critical gaps (why Person Y's file is public)

| # | Gap | Risk | Where |
|---|-----|------|-------|
| G1 | **No sign-in on homepage upload path** | User uploads before identity; feels "public by default" | `HomeStudio.tsx`, `HomeHeroChat.tsx` |
| G2 | **`canAccessDocument`: unregistered doc → allow** | Upload without `registerDocument` row is world-readable even in strict mode | `documents.ts` line ~181: `if (!doc) return true` |
| G3 | **`GET /api/wiki/import` unauthenticated** | Lists all upload filenames + metadata | `import/route.ts` |
| G4 | **Wiki gate only for `upload:` refs** | Scan docs (`scan-*`) may bypass `assertWikiDocAccess` | `wiki-access.ts` |
| G5 | **Local dev defaults to open** | Team tests without strict mode and assumes prod is the same | `saasStrictMode()` off unless production |
| G6 | **No global auth middleware** | Each route must remember to gate — easy to miss new routes | no `middleware.ts` |
| G7 | **Public share links unauthenticated by design** | `/share/[id]` reads block preview without login | `share/[shareId]/page.tsx` — must be opt-in per share |
| G8 | **RBAC UI buried** | Invites only on Sync; no org switcher; no role badges | `TeamPanel.tsx` |
| G9 | **Prod Supabase / schema drift** | ACL tables missing → ownership not persisted | Vercel env + SQL migration checklist |
| G10 | **No account creation UX** | GitHub OAuth only; no email magic link / SSO story for enterprise | product gap for F100 |

---

## Security principles (architecture)

### 1. Default deny

If we cannot answer **"who owns this document?"** from Supabase, the answer is **deny** — not allow. Fix G2 first.

### 2. Identity before bytes

Upload endpoints must reject unauthenticated requests **and** the UI must not send the file until the user is signed in. API-only auth with a permissive UI is not enough.

### 3. One front door

Add `middleware.ts` (or equivalent) that:

- Requires session for `/wiki` (except public demo doc param)
- Requires session for `/api/wiki/*` and `/api/v1/*` (except health, auth callback, public demo)
- Passes through `/share/*` only when share record is explicitly `enabled`

### 4. Org-scoped documents

Every scan and upload registers `owner_user_id` + `org_id` at creation time. Team members inherit access via org role — see [GOAL3-TEAM-RBAC.md](./GOAL3-TEAM-RBAC.md).

### 5. Explicit public content only

Allow unauthenticated read **only** for:

- Marketing pages (`/`, `/protocol`, etc.)
- Named demo doc: `scan-acme-ui-kit.md` (or future `?demo=1` sandbox)
- User-created share links where creator opted in (future: "Anyone with link")

Everything else: authenticated + authorized.

### 6. Fail closed in production

| Env | Expected |
|-----|----------|
| `NODE_ENV=production` | `saasStrictMode() === true`, Supabase configured, schemas applied |
| Local dev | `BLOCKSMITH_SAAS_STRICT=1` required for security testing; document that open mode is dev-only |

---

## Work plan

### P0 — Ship blockers (1 sprint)

Complete before any external user uploads real IP.

| ID | Task | Done when | Status |
|----|------|-----------|--------|
| S0 | **Fix default-deny** | `canAccessDocument`: unregistered private docs → `false`; demo doc still public | ✅ `documents.ts` + `isPublicContent` |
| S1 | **Gate import list** | `GET /api/wiki/import` returns only current user's org uploads; 401 if logged out in strict mode | ✅ `import/route.ts` |
| S2 | **Homepage sign-in gate** | Paste/drop disabled until GitHub session; clear CTA: "Sign in to upload" | ✅ `HomeStudio.tsx` `blockedBySignIn()` |
| S3 | **Global sign-in chrome** | Header on `/` and wiki shell: avatar, sign out, link to Team | ✅ `AuthChrome` on home + `TopNav` |
| S4 | **Extend wiki read gate** | `assertWikiDocAccess` covers all non-demo doc refs (upload + scan), not only `upload:` | ✅ `wiki-access.ts` |
| S5 | **Register on every upload** | Strict mode: upload fails if `registerDocument` cannot run (no silent unowned files) | ✅ strict requires session; default-deny backstops unregistered |
| S6 | **Route audit** | Spreadsheet of every API + page route with auth column; fix gaps | ✅ table above; closed `POST /api/share` |
| S7 | **Middleware** | Central session check; removes "forgot to call requireDocumentAccess" class of bugs | ✅ `src/middleware.ts` |
| S8 | **Prod migration checklist** | Document + automate: schema.sql, schema-orgs.sql, OAuth URLs, env vars | ⬜ checklist below; **manual on Vercel/Supabase** |
| S9 | **Stranger security test** | Two non-builders pass checklist below on production | 🔴 **manual — not yet run on prod** |
| S10 | **Verify scripts in CI** | `verify:saas-acl`, `verify:security-gate`, `verify:org-rbac`, `verify:production-goals` on every deploy | ✅ scripts exist + in `verify:software`; ⬜ wire into CI workflow |

### P1 — Team productization (same sprint or immediately after P0)

| ID | Task | Done when |
|----|------|-----------|
| T1 | **Team onboarding** | Post sign-in empty state: "Invite your team" → Sync / Team panel |
| T2 | **Role-aware UI** | Promote / Pin lock / Edit hidden or disabled for `viewer`; tooltips explain role |
| T3 | **Share link consent** | Creating `/share/…` requires sign-in + warning: "Public link — anyone can view this block" |
| T4 | **Session expiry UX** | Friendly errors (already started in `friendly-error.ts`) on all gated actions |
| T5 | **Audit log (minimal)** | Promote, rollback, pin-lock, invite → append-only table or activity feed export |

### P2 — Fortune 100 pilot readiness (after P0 green)

Not required for first design partners, **required** before enterprise procurement:

- SSO / SAML (Okta, Azure AD)
- SCIM or admin-provisioned users
- Org-level data isolation review + Supabase RLS audit
- Penetration test / security questionnaire responses
- Data retention + deletion (GDPR/CCPA)
- Optional: customer-managed keys, VPC / single-tenant

Track in sales deck as **roadmap**, not **shipped** — but P0 must be true today.

---

## Route audit checklist

Engineer owning S6 fills this table and attaches PR links. **Every row must be ✅ before release.**

| Route / surface | Auth required | Ownership check | Status |
|-----------------|---------------|-----------------|--------|
| `GET /wiki/*` (private docs) | Session | `assertWikiDocAccess` (upload **+ scan**) | ✅ extended to all non-public refs |
| `POST /api/wiki/import` | Session | registers owner | ✅ 401 in strict mode |
| `GET /api/wiki/import` | Session | org-scoped list | ✅ 401 + org filter (was **open**) |
| `POST /api/wiki/finalize` | Session or API key | `requireDocumentAccess` | ✅ |
| `POST /api/wiki/promote` | Session or API key | `requireDocumentAccess` | ✅ |
| `POST /api/wiki/pin-lock` | Session or API key | `requireDocumentAccess` | ✅ |
| `POST /api/wiki/rollback` | Session or API key | `requireDocumentAccess` | ✅ |
| `GET /api/wiki/pipeline` | Session or API key | `requireDocumentAccess` | ✅ |
| `GET/POST /api/wiki/source` | Session | `requireDocumentAccess` | ✅ |
| `POST /api/v1/scans/pull` | API key | `requireDocumentAccess` | ✅ |
| `GET /api/v1/orgs/me` | Session | self | ✅ |
| `POST /api/v1/orgs/invite` | Session | admin/owner (role check) | ✅ |
| `POST /api/share` | Session | `requireDocumentAccess` on doc | ✅ closed (was **open**) |
| `GET /share/[id]` | Public if enabled | share record | ⬜ by design |
| MCP tools (`get_block`, etc.) | API key | doc scope on key | ⬜ revisit P1 |
| Homepage recent uploads UI | Session | org-scoped | ✅ list now org-scoped |

**Default-deny backstop:** `canAccessDocument()` returns `false` for any
unregistered private doc (`documents.ts`) — so even a route that forgets to gate
cannot serve customer IP. `middleware.ts` adds a coarse credential check on
`/api/v1/*`, mutating `/api/wiki/*`, and `/api/wiki/import`, and redirects
logged-out visitors of private `/wiki` docs to sign-in. Public content is only
the named demo (`scan-acme-ui-kit.md`) and bundled repo samples (`apollo.md`),
defined in `isPublicContent()`.

---

## Manual stranger security test (production)

Run on https://blocksmith-mocha.vercel.app. **Recorder must not be the engineer who implemented ACL.**

Use two browsers (or one normal + one incognito). Person A = signed in. Person B = logged out / different GitHub account.

| Step | Person A | Person B | Pass |
|------|----------|----------|------|
| 1 | Sign in, upload `SECRET-test.md`, open wiki URL | — | ⬜ |
| 2 | — | Open A's wiki URL directly | B sees **404 or sign-in**, not content ⬜ |
| 3 | — | `GET /api/wiki/import` (devtools) | B does **not** see A's filename ⬜ |
| 4 | Invite B as **viewer** on Sync → Team | B accepts (GitHub email match) | ⬜ |
| 5 | — | B opens wiki | B **can read**, cannot promote ⬜ |
| 6 | — | B calls promote API (devtools) | **403** ⬜ |
| 7 | A creates share link for one block | B opens share URL | B sees **only that block**, not full wiki ⬜ |
| 8 | A signs out | B tries A's wiki URL again | Denied ⬜ |

**Pass = all boxes checked.** Attach Loom or signed checklist in Notion.

---

## Verification commands

```bash
# Local — always run with strict mode
BLOCKSMITH_SAAS_STRICT=1 npm run verify:saas-acl
npm run verify:security-gate   # NEW — default-deny + import-list lockdown
npm run verify:org-rbac
npm run verify:governance-e2e

# After deploy
BLOCKSMITH_URL=https://blocksmith-mocha.vercel.app npm run verify:production-smoke
BLOCKSMITH_URL=https://blocksmith-mocha.vercel.app npm run verify:production-goals
```

**`verify:security-gate`** (added, `scripts/verify-security-gate.ts`, wired into
`verify:software`): asserts `GET /api/wiki/import` returns 401 when
unauthenticated, that unregistered docs deny access (anon + signed-in non-owner),
that admin-key bypass is preserved, and that the demo + bundled samples stay
public.

---

## Production deploy checklist (security)

Before marking this doc green:

- [ ] Supabase project: Auth → GitHub provider enabled
- [ ] Redirect URLs include `https://blocksmith-mocha.vercel.app/auth/callback`
- [ ] Vercel env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] SQL: `supabase/schema.sql` applied
- [ ] SQL: `supabase/schema-orgs.sql` applied
- [ ] Storage bucket **private** (see [SUPABASE.md](./SUPABASE.md))
- [ ] `BLOCKSMITH_SAAS_STRICT` **not** set to `0` on Vercel
- [ ] Stranger security test recorded (two sign-offs)

---

## Relationship to other docs

| Doc | Change |
|-----|--------|
| [GOAL-SAAS-STATUS.md](./GOAL-SAAS-STATUS.md) | Track `%` for identity + ACL separately from Pipeline UX |
| [CUSTOMER-PITCH-SCRIPTS.md](./CUSTOMER-PITCH-SCRIPTS.md) | Do not claim "enterprise RBAC" in live demos until stranger test passes |

---

## Definition of done

**This release gate is green when:**

1. Person B **cannot** read Person A's upload or scan wiki without an explicit org invite.
2. Homepage upload **requires** sign-in in the product UI, not only via API error.
3. `GET /api/wiki/import` does not leak cross-tenant metadata.
4. Unregistered documents **deny** access in strict mode.
5. All verify scripts pass on CI/CD for production deploys.
6. Two non-builders sign the stranger security test on production.

Until then: **no design-partner uploads of real design systems. No Fortune 100 pilot. No "we're live" marketing.**

---

## Owner assignment (fill in)

| Area | Owner | Target date |
|------|-------|-------------|
| S0–S2 default deny + import + homepage | | |
| S3–S5 UI chrome + wiki gate | | |
| S6–S7 route audit + middleware | | |
| S8–S10 prod checklist + CI | | |
| Stranger test (QA) | | |
