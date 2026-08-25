# The Platform: Multi-Tenancy, Auth, Storage, And Security

**What this chapter covers:** everything underneath the product. Who a user is, what an organization is, how a document gets owned, how a request gets authorized, where bytes actually live in local mode versus hosted mode, how we stop one person from burning our LLM budget, what security controls exist, what we log, every environment variable, how the thing deploys, and the exact list of launch gates that a human has to close before this can accept a stranger's design system.

**Why it matters:** BlockSmith stores proprietary design systems. Color palettes, component specs, governance rules, agent instructions. Our buyers are design leads and engineering leads at companies where a leaked wiki URL is a data exposure incident, not a UX bug. `docs/SECURITY-RELEASE-GATE.md` opens with the line "BlockSmith cannot release while customer design files are readable by strangers," and it is still marked a release blocker. Every other chapter describes something we want to be true about the product. This chapter describes the machinery that decides whether we are allowed to have customers at all.

**Read this if** you are about to add an API route, add a document creation path, deploy to production, set an environment variable, answer a security questionnaire, or decide whether we can send a link to a design partner. If you write a route handler and skip this chapter, you will almost certainly ship a hole.

---

## 14.1 The one idea that explains all of it: two worlds, one codebase

Nothing in this chapter makes sense until you accept that BlockSmith runs in two very different worlds from the same source tree.

**Local mode** is the founder's laptop and the CI box. There is one user. The filesystem is writable and durable. `data/uploads/*.md` holds design documents, `data/cloud/*.json` holds the ownership registry, org memberships and API keys. Access checks are mostly off because there is nobody to protect anybody from. This is where every verify script runs and where almost all development happens.

**Hosted mode** is Vercel plus Supabase. There are many users who must not see each other. The application filesystem is read only, `/tmp` is small and per invocation, and any given request can land on a cold serverless instance that has never seen your document. Documents live in a private Supabase Storage bucket. Ownership lives in Postgres tables. Access checks are on and default to deny.

Nearly every file in `src/lib/cloud/` and `src/lib/supabase/` exists to make one codebase behave correctly in both worlds. Three predicates in `src/lib/cloud/saas.ts` are the switches:

```ts
saasStrictMode()          // enforce auth + ownership? default: NODE_ENV === "production"
saasDbEnabled()           // are the Postgres tables available? == supabaseStorageEnabled()
localCloudStoreWritable() // may we write data/cloud/*.json? false when VERCEL === "1"
```

Read those three functions before you read anything else. Most of the surprising behavior in this chapter, including the "404 on your own new project" bug described below, is a consequence of one of them being in an unexpected state.

A crucial and non-obvious detail: **strict mode and database mode are independent.** `saasStrictMode()` keys off `NODE_ENV` and `BLOCKSMITH_SAAS_STRICT`. `saasDbEnabled()` keys off whether Supabase credentials are present. You can have strict access checks with no registry to check against (everything denies), or a full registry with no enforcement (everything allows). Both combinations are reachable by misconfiguration, and both are bad. Section 14.3 covers the second one, which is the launch gate.

---

## 14.2 The tenancy model

### 14.2.1 The four entities

| Entity | Where it lives (hosted) | Where it lives (local) | Defined in |
|--------|------------------------|------------------------|------------|
| **User** | Supabase Auth (`auth.users`) | Supabase Auth, or nobody | `src/lib/auth/session.ts` |
| **Organization** | `blocksmith_organizations` | `data/cloud/orgs.json` | `src/lib/cloud/orgs.ts` |
| **Membership** | `blocksmith_org_members` | `data/cloud/orgs.json` | `src/lib/cloud/orgs.ts` |
| **Document** | `blocksmith_documents` | `data/cloud/documents.json` | `src/lib/cloud/documents.ts` |

We do not own the user table. Identity is entirely delegated to Supabase Auth, and a "user id" everywhere in our code is a Supabase auth UUID. That is a deliberate decision: authentication is a solved problem with a large blast radius when done badly, and we have neither the time nor the reason to own password hashing, OAuth token exchange, or session cookie rotation.

**Organizations are automatic, not opt in.** There is no "create a team" flow. The first time a signed in user does anything that needs an org, `ensureDefaultOrg(userId, login)` runs and creates a personal workspace named `` `${login}'s workspace` `` with slug `${login}-workspace`, and inserts the user as its `owner`. A user therefore always has exactly one org unless somebody invited them to another. `listOrgsForUser()` returns an array but every caller in the app uses `existing[0]`, so **multi org membership is representable in the schema and unhandled in the product.** There is no org switcher. If you are invited to a second org, which org you land in depends on row order. Note this as a real gap, not a design.

**Documents are the unit of tenancy.** A document is one design system: one `design.md` equivalent, whether it arrived from a repo scan, a Figma import, an upload, an AI generation, or a screenshot. `DocumentRecord` in `src/lib/cloud/documents.ts` is the registry row:

```ts
type DocumentRecord = {
  fileName: string;       // primary key, e.g. "scan-acme-ui-kit.md"
  docRef: string;         // "upload:scan-acme-ui-kit.md" for uploads, bare name otherwise
  ownerUserId: string;    // Supabase auth uuid of the creator
  orgId?: string;         // the org that actually controls access
  githubRepo?: string;
  scanMode?: string;      // "create" | "ai-generate" | "vision-generate" | "figma" | "github" | ...
  published?: boolean;    // opt-in public read, default false
  createdAt: string;
  updatedAt: string;
};
```

Two things to notice. First, `fileName` is the primary key **globally**, not per org. That is why `registerDocument()` contains a collision guard: if a document with that file name already exists and belongs to a different owner and a different org, registration throws with the message "is owned by another team. Set a unique workspaceId in blocksmith.config.json." Without that guard, two teams scanning a repo that produces the same slug would silently share a document. Verified by `npm run verify:saas-acl`, assertion 6.

Second, `orgId` is the field that actually grants access, and `ownerUserId` is only the fallback. `getUserRoleForDocument(orgId, ownerUserId, userId)` in `src/lib/cloud/orgs.ts`:

```ts
if (!userId) return null;
if (orgId) return getMemberRole(orgId, userId);  // org membership decides
if (ownerUserId === userId) return "owner";       // legacy rows with no org
return null;
```

A document with an org is a **team** document. Every member of that org gets a role on it. That is the entire team sharing story: there is no per document ACL, no per document invite, no "share with these three people." You share a document by being in the org that owns it.

Note the ordering carefully: when `orgId` is set, `ownerUserId` is **never consulted**. So a user who created a document and was then removed from the org loses all access to it, including read. That is arguably correct for a team-owned asset and is certainly surprising. It also means the `ownerUserId` column is, in practice, provenance metadata rather than an access grant.

### 14.2.2 Roles

`src/lib/cloud/rbac.ts` is thirty eight lines and is the whole authorization policy. Four roles, ranked:

| Role | Rank |
|------|------|
| `viewer` | 1 |
| `member` | 2 |
| `admin` | 3 |
| `owner` | 4 |

Five actions, each with a minimum rank:

| Action | Minimum role | What it covers |
|--------|--------------|----------------|
| `read` | viewer | Open the wiki, read the pipeline, pull the doc |
| `write` | member | Finalize an edit, promote, rollback, pin a lock |
| `scan` | member | Re-scan the repo into this document |
| `manage_keys` | member | Mint or revoke an API key |
| `manage_members` | admin | Invite or remove teammates |

`canPerform(role, action)` is a switch statement over `roleAtLeast()`. `default: return false`, which is the right default: a new action added to `DocAction` without a case denies for everybody until somebody writes the rule. That is a small design choice worth preserving.

Note the deliberate asymmetry with the doc: `docs/GOAL3-TEAM-RBAC.md` lists four roles but the invite API refuses to create an `owner` (`inviteOrgMember` throws "Cannot invite another owner, transfer ownership is not supported yet"). There is exactly one owner per org: whoever created it. **Ownership transfer is Not built yet.** If a founder leaves a customer, their org has no path to a new owner short of a database edit.

### 14.2.3 Invites

The invite flow is deliberately email based, and it is a two phase commit across two systems we do not fully control.

1. An owner or admin calls `POST /api/v1/orgs/invite` with `{ email, role }`. Role must be in `ORG_ROLES` and must not be `owner`.
2. `inviteOrgMember()` re-checks the inviter's role server side (the API route does not do the role check itself, the library does), normalizes the email to lowercase, and inserts a member row with `user_id = null` and `invited_email = <email>`. That row is a **pending** membership.
3. `sendOrgInvite()` in `src/lib/email/send-org-invite.tsx` tries to send a Resend email. If `RESEND_API_KEY` is unset it returns `{ delivered: false }` and the route responds with the hint "Invite saved. Configure RESEND_API_KEY to deliver email automatically." **The invite still exists.** Delivery is best effort and non blocking, which is the correct choice: an email outage must not lose a grant.
4. The invitee signs in. `acceptPendingInvites(userId, email)` runs from two places: `/auth/callback` right after the OAuth code exchange, and `assertWikiDocAccess()` on every gated wiki read. It finds member rows where `invited_email` matches and `user_id is null`, sets `user_id` and clears `invited_email`. The membership is now active.

The security property this leans on is that **Supabase owns email verification.** We accept an invite purely on an email string match, so if Supabase ever handed us an unverified email in `user.email`, an attacker could claim an invite for an address they do not control. With the GitHub provider this is safe because we request the `user:email` scope and GitHub returns verified addresses. With password sign up it depends on Supabase's "Confirm email" setting being on. **That setting is a launch gate, and it is not enforced by our code.** It is listed in 14.12.

Verified by `npm run verify:org-rbac`, which asserts the full chain: create org, invite two emails at different roles, accept exactly one invite, confirm the role, then confirm member can write, viewer cannot write, viewer can read, and an outsider is denied.

### 14.2.4 `registerOwnedProject` and the failure mode it prevents

This is the single most important function in the tenancy model, and it is fifteen lines.

```ts
// src/lib/dashboard/ownership.ts
export async function registerOwnedProject(
  fileName: string,
  docRef: string,
  scanMode: string,
): Promise<void> {
  try {
    const md = await readUploadMarkdownContent(fileName);
    await cacheProjectMeta(fileName, parseProjectMeta(fileName, md));
  } catch { /* cache is best-effort */ }

  try {
    const user = await getSupabaseUser();
    if (!user) return;
    const org = await ensureDefaultOrg(user.userId, user.login);
    await registerDocument({ fileName, docRef, ownerUserId: user.userId, orgId: org.id, scanMode });
  } catch (err) {
    console.warn("[ownership] could not register project", err);
  }
}
```

It does two things: denormalize the project's display metadata into the Redis cache (covered in 14.7), and write the ownership row.

**Why every create and import path must call it.** Look again at `canAccessDocument()` in `src/lib/cloud/documents.ts`:

```ts
const doc = await getDocument(fileName);
// DEFAULT DENY: if we cannot answer "who owns this?" from the registry, the
// answer is no, an unregistered private doc is never world-readable.
if (!doc) return false;
```

That line is the fix for gap G2 in `docs/SECURITY-RELEASE-GATE.md`, where `canAccessDocument` used to `return true` for an unregistered document. Closing that hole made the registry load bearing in the opposite direction. Before the fix, forgetting to register a document made it world readable. After the fix, forgetting to register a document makes it **invisible to its own creator.**

That is the failure mode the production checklist calls "404 on your own new project." A signed in user clicks Generate with AI in strict mode. The route generates markdown, persists it, returns a wiki URL, the browser navigates there, `assertWikiDocAccess()` runs, `canAccessDocument()` finds no registry row, returns `false`, and the page calls `notFound()`. The user sees a 404 on a project they created five hundred milliseconds ago. Nothing in the logs looks like an error, because nothing errored. It is the security model working exactly as specified against a document nobody claimed.

The four call sites, all of which are creation paths:

| Path | File | `scanMode` recorded |
|------|------|---------------------|
| Blank create and AI generate | `src/app/api/projects/create/route.ts` | `"create"`, `"ai-generate"` |
| Screenshot to design system | `src/app/api/projects/generate-image/route.ts` | `"vision-generate"` |
| Figma UI connector | `src/app/api/figma/connect/route.ts` | `"figma"` |
| Figma MCP import | `src/app/api/figma/import/route.ts` | `"figma"` |

Repo scans register through a different but equivalent path, `src/lib/cloud/register-scan.ts`, called from the scan service. Uploads register inside `POST /api/wiki/import`.

**The rule, stated once so it can be quoted in code review: any code path that produces a new `fileName` must register it before returning a URL that points at it.** If you add a fifth ingestion path and skip this, your feature will appear to work in local dev (where strict mode is off) and 404 for every user in production. That asymmetry is exactly why this bug shipped once already.

Three honest weaknesses in the current implementation:

1. **It swallows its own failure.** The `catch` logs a warning and returns. So a Supabase outage during creation produces an orphaned, permanently inaccessible document rather than an error the user can act on. `docs/SECURITY-RELEASE-GATE.md` item S5 wanted "upload fails if `registerDocument` cannot run"; what we shipped is "strict mode requires a session, and default deny backstops the rest." The document is safe, but it is also lost.
2. **The swallowed errors include the collision guard.** `registerDocument()` throws deliberately when a file name is already owned by another team. `registerOwnedProject` catches that throw and logs it. So the cross-tenant collision that the guard exists to surface **fails silently**, the user gets a wiki URL, and the document still belongs to the other team. The guard protects the data and tells nobody.
3. **It is a no-op for anonymous callers.** `if (!user) return;` is correct in local dev (there is no user, and the dashboard lists all local uploads unfiltered). It is also what makes an ungated creation route in hosted mode produce a document nobody can ever read. See `POST /api/figma/connect` in 14.13.

The scan path has the same shape and the same weakness. `registerScanOwnership()` in `src/lib/cloud/register-scan.ts` returns early for the public demo doc and returns early when the actor has no `userId`, so **an anonymous scan leaves an unregistered document**, which default deny then makes unreadable.

---

## 14.3 `BLOCKSMITH_SAAS_STRICT`, the number one launch gate

### What it does

```ts
// src/lib/cloud/saas.ts
export function saasStrictMode(): boolean {
  if (process.env.BLOCKSMITH_SAAS_STRICT === "0") return false;
  if (process.env.BLOCKSMITH_SAAS_STRICT === "1") return true;
  return process.env.NODE_ENV === "production";
}
```

Three states, and the tri-state is the point: explicit off, explicit on, and "follow `NODE_ENV`." The same logic is duplicated (not imported) in `src/middleware.ts`, because middleware runs on the edge runtime and cannot import a module marked `server-only`. That duplication is a maintenance hazard: if you change the rule, change it in both files. There is no test that asserts they agree.

When strict mode is **on**:

- `requireDocumentAccess()` resolves an actor and runs the ownership check. Without it, the function returns `{ ok: true, userId: null, isAdmin: true }` immediately, before touching the registry.
- `assertWikiDocAccess()` performs its check. Without it, the function returns immediately and every wiki page renders for anybody.
- `middleware.ts` requires a credential on `/api/v1/*`, on mutating `/api/wiki/*`, and on `/api/wiki/import`, and redirects logged out visitors of a private `/wiki` doc to the sign in prompt. Without it, `middleware()` short circuits to `securedNext(request)` and applies only the CSP header.
- `POST /api/wiki/import`, `POST /api/figma/import`, `POST /api/projects/create`, `POST /api/projects/generate-image`, and `POST /api/ingest/capture` return 401 without a session.
- `GET /api/wiki/import` returns 401 and never lists filenames.

### Why it is the number one gate

Because when it is off, **there is no tenant isolation at all.** Not weak isolation. None. `requireDocumentAccess()` returns `ok: true, isAdmin: true` for an anonymous request. `assertWikiDocAccess()` is a no-op. Anyone with a document's file name can read, edit, promote, and roll back any other tenant's design system, and the middleware will not stop them. Every other control in this chapter, the RBAC roles, the org scoping, the default deny registry, is downstream of this one boolean.

The dangerous property is that the failure is **silent and looks like success.** A deploy with strict off passes `verify:production-smoke`, serves pages fine, lets people sign in, and shows the right projects on the dashboard to the right people (because the dashboard scopes on `saasDbEnabled()`, not on strict mode). Nothing is visibly broken. The only symptom is that a stranger who guesses a URL is not stopped.

### The startup warning

Because there is no way to detect this from the outside, `instrumentation.ts` now shouts about it at boot. `warnOnRiskyProdConfig()` runs on the Node.js runtime only, only when `NODE_ENV === "production"`, and emits up to three warnings:

| Condition | Warning |
|-----------|---------|
| No `NEXT_PUBLIC_SUPABASE_URL` or no `SUPABASE_SERVICE_ROLE_KEY` | "[config] PRODUCTION without Supabase, data persists to an ephemeral filesystem and will be lost." |
| Supabase configured **and** `BLOCKSMITH_SAAS_STRICT !== "1"` | "[config] PRODUCTION with BLOCKSMITH_SAAS_STRICT off, tenant isolation is NOT enforced. Set BLOCKSMITH_SAAS_STRICT=1." |
| No `UPSTASH_REDIS_REST_URL` | "[config] No Upstash Redis, rate limits are per-instance only (not distributed)." |

(The exact strings in the file use a dash where this table uses a comma. The condition and the meaning are what matter.)

Two honest caveats about this warning. It is a `console.warn`, so nothing fails, nothing exits, and on Vercel it lands in a log stream nobody reads unless they go looking. And the strict warning is gated on `supabase &&`, so **a production deploy with neither Supabase nor strict mode gets warning one and never gets warning two**, which is the worst configuration and the least warned about. That is worth fixing.

Note also what the warning checks: `BLOCKSMITH_SAAS_STRICT === "1"` literally. In production with the variable unset, `saasStrictMode()` returns `true` (via the `NODE_ENV` fallback) but the warning still fires. That is intentionally conservative: it wants you to be explicit rather than relying on Vercel setting `NODE_ENV` for you.

### What the verify scripts do about it

Every ACL verify script sets the variable itself rather than trusting the ambient environment:

```
scripts/verify-saas-acl.ts       →  process.env.BLOCKSMITH_SAAS_STRICT = "1"
scripts/verify-security-gate.ts  →  process.env.BLOCKSMITH_SAAS_STRICT = "1"
scripts/verify-org-rbac.ts       →  process.env.BLOCKSMITH_SAAS_STRICT = "1"
```

and every handshake or governance script sets it to `"0"` because it is testing the pipeline, not the ACL. That is the correct split, but it means `npm run verify:software` proves the ACL logic is right and proves **nothing** about whether production actually has strict mode on. The only thing that proves that is a human reading the Vercel dashboard, or the stranger security test in `docs/SECURITY-RELEASE-GATE.md`, which has never been run on production.

---

## 14.4 Access control

### 14.4.1 The three layers

There are three enforcement layers, deliberately overlapping.

```
  Request
     │
     ├─ 1. src/middleware.ts        coarse: "is there any credential at all?"
     │                              edge runtime, no database, no doc lookup
     │
     ├─ 2. route handler            requireDocumentAccess() / assertWikiDocAccess()
     │                              resolves actor, checks org role on this doc
     │
     └─ 3. canAccessDocument()      default deny backstop in the data layer
                                    a route that forgets layer 2 still cannot leak
```

Layer 1 exists because of gap G6 in the security gate doc: "no global auth middleware, each route must remember to gate, easy to miss new routes." It is intentionally dumb. It asks only whether the request carries an `Authorization: Bearer` header or a `sb-*-auth-token` cookie. It never asks who you are or what you own, because on the edge runtime it has no Supabase admin client and no registry. Its job is to make "I forgot to gate this route" fail closed for unauthenticated attackers instead of open.

Layer 3 exists because layer 1 is coarse. A signed in attacker passes layer 1 trivially. `canAccessDocument()` is what actually stops them, and it is the only layer that consults org membership.

### 14.4.2 `requireDocumentAccess`

`src/lib/cloud/access.ts`, used by every mutating API route and most reads:

```ts
export async function requireDocumentAccess(
  request: Request,
  fileName: string,
  action: DocAction = "write",
): Promise<{ ok: true; userId: string | null; isAdmin: boolean } | { ok: false; response: Response }>
```

Sequence:

1. If `!saasStrictMode()`, return `{ ok: true, userId: null, isAdmin: true }`. Local dev is wide open by design.
2. `resolveActor(request)` (in `src/lib/cloud/actor.ts`) tries the API key first, then the Supabase session cookie. This ordering matters: a request carrying both is treated as a machine.
3. No actor, return **401** with "Unauthorized, sign in or use an API key to access this document."
4. `canAccessDocument(fileName, userId, { allowAdminKey, action })`.
5. Denied, return **403** with an action specific message: "you do not have access to view this document" for reads, "your team role cannot modify this document (need member or above)" for writes.

The 401 versus 403 split is deliberate and product visible. `docs/SECURITY-RELEASE-GATE.md` non-negotiable 3 says errors must say "Sign in" or "Ask your admin for access" and never a silent 404 alone. On the API surface we honor that. On the wiki page surface we do not, and that is a considered tradeoff: see the next section.

Note the default is `action = "write"`. A route that calls `requireDocumentAccess(request, fileName)` without a third argument is asking for write permission, which will correctly reject a viewer. Read routes must pass `"read"` explicitly. Getting this backwards is an easy mistake in a code review, and there is no lint rule for it.

### 14.4.3 `assertWikiDocAccess` and the default-deny posture

`src/lib/cloud/wiki-access.ts` guards the wiki page itself, which is a React Server Component, not an API route, so it cannot return a status code. It calls `notFound()`.

```ts
export async function assertWikiDocAccess(docRef: string): Promise<void> {
  if (!saasStrictMode()) return;
  const fileName = isUploadDocRef(docRef) ? uploadFileNameFromRef(docRef) : docRef;
  if (isPublicContent(fileName)) return;

  const user = await getSupabaseUser();
  if (user?.email) await acceptPendingInvites(user.userId, user.email);

  const allowed = await canAccessDocument(fileName, user?.userId ?? null, { action: "read" });
  if (!allowed) notFound();
}
```

Three things worth calling out.

**It normalizes both reference shapes.** This closes gap G4. The original gate only handled `upload:` refs, so a document referenced by its bare file name (`scan-something.md`, which is how repo scans and bundled samples are addressed) walked straight past it. The line `isUploadDocRef(docRef) ? uploadFileNameFromRef(docRef) : docRef` is the fix, and `verify:security-gate` asserts specifically that `isPublicContent("upload:scan-acme-ui-kit.md")` is **false** so the prefix cannot be used to smuggle a doc into the public set.

**It accepts invites as a side effect of a read.** That is unusual but correct for the product: an invited teammate clicking a wiki link straight from an invite email would otherwise get a 404 on their first visit because their membership was still pending. Doing it here means the invite link works even if the user was already signed in when the invite was sent.

**It returns 404, not 403.** A signed in user with no access to a document sees "Page not found," not "ask your admin." This is a deliberate choice against the security-gate doc's own guidance, and the reason is enumeration: distinguishing "does not exist" from "exists but not yours" tells an attacker which document names are real. The cost is a genuinely bad experience for a legitimate teammate. Middleware softens the anonymous case (it redirects to sign in rather than 404) but does nothing for the signed in wrong tenant case. **See Open question 1 at the end of this chapter.**

### 14.4.4 What is public, precisely

`isPublicContent(fileName)` in `src/lib/cloud/saas.ts` returns true for exactly two categories:

1. **The named demo doc**, `scan-acme-ui-kit.md`, hardcoded in `isPublicDemoDocument()`.
2. **Bundled sample docs** shipped in the repo under `docs/designs.md/`, checked by `isBundledSampleDoc()` with `existsSync()`. In practice this is `apollo.md`.

`isBundledSampleDoc()` does its own path traversal defense before touching the filesystem: it rejects any name containing a slash, a backslash, or `..`, and requires a `.md` suffix. The comment explains why spoofing is impossible from the other direction too: "Uploads live under `data/uploads/` and always carry a hash suffix, so they can never spoof a bundled name." Every upload file name is `${slug}-${sha256(content).slice(0,8)}.md` (see `saveMarkdownUpload` in `src/lib/uploads/store.ts`), so a user cannot upload a file that lands on the bare name `apollo.md`.

There is a third, opt-in public category that is not part of `isPublicContent`: a document with `published = true`. In `canAccessDocument`:

```ts
const action = opts?.action ?? "read";
if (doc.published && action === "read") return true;
```

Reads only. A published document never becomes writable to strangers. This backs the public org site feature (`/sites/<org-slug>`) and is toggled through `POST /api/wiki/publish`, which requires a session. `registerDocument()` preserves the flag across re-registration (`published: existing?.published ?? false`) so a re-scan cannot silently unpublish a live doc, and equally cannot silently publish one. `verify:security-gate` group 5 asserts the full cycle: unpublished denies anon read, publish allows it, write stays denied, unpublish denies again.

The middleware keeps its own copy of the public list:

```ts
const PUBLIC_DOC_PARAMS = new Set(["apollo.md", "scan-acme-ui-kit.md", "upload:scan-acme-ui-kit.md"]);
// Kept in sync with isPublicContent() in src/lib/cloud/saas.ts.
```

"Kept in sync" by a comment. That is a second place where the edge/server split forces manual duplication, and a second place with no test asserting agreement.

### 14.4.5 Anonymous users in hosted mode

Three different surfaces treat an anonymous hosted visitor three different ways, and the differences are intentional:

| Surface | Anonymous behavior | Mechanism |
|---------|-------------------|-----------|
| `/dashboard` | Sees an empty project list | `src/app/dashboard/page.tsx` sets `allowedFileNames = new Set()` when `saasDbEnabled()` and there is no user |
| `/wiki?doc=<private>` | Redirected to `/?auth=required&next=...` | `middleware.ts` |
| `/wiki?doc=<demo>` | Renders | `PUBLIC_DOC_PARAMS` and `isPublicContent()` |
| `POST /api/wiki/*` | 401 JSON | `middleware.ts` mutating method check |
| `GET /api/v1/*` | 401 JSON | `middleware.ts` `isV1` check |

The dashboard case is worth a close read because it keys off the **wrong-looking** predicate:

```ts
if (saasDbEnabled()) {
  if (user) { /* scope to org docs */ }
  else { allowedFileNames = new Set(); }  // hosted + anonymous → nothing
}
```

It is `saasDbEnabled()`, not `saasStrictMode()`. The reasoning is sound: the dashboard can only scope to an org if there is an org registry to scope against, so the presence of the database is the right question. The consequence is that dashboard scoping works even with strict mode off, which is why a strict-off production deploy looks correct on the dashboard while being wide open everywhere else. Good to know when you are debugging; dangerous if you use the dashboard as evidence that isolation works.

### 14.4.6 Full route inventory

There are 58 `route.ts` files under `src/app/api`. This is every one of them with the gate it actually calls. **`MW`** means the coarse middleware credential check also applies in strict mode. **`upload-only`** means the ownership check is wrapped in `if (isUploadDocRef(doc))`, which is a pattern you must understand before reading the table; it is explained immediately after.

**Deliberately public:**

| Route | Methods | Why public |
|-------|---------|------------|
| `/api/ai/status` | GET | Reports whether an AI key is configured; no secrets |
| `/api/auth/github/status` | GET | Reports whether the caller has a GitHub session; used by the sign-in chrome |
| `/api/supabase/health` | GET | Deploy smoke check, required by `verify:production-smoke` |
| `/api/share/[id]` | GET | The public share link itself. The whole point |
| `/api/share/[id]/view` | POST | View counter on a share |
| `/api/share/[id]/opinion` | POST | Approve, unsure, or reject reaction on a share |
| `/api/figma/webhook` | POST | Figma calls it. Authenticated by `timingSafeEqual` against `FIGMA_WEBHOOK_PASSCODE`; with no passcode set it returns 401 to everything, so it fails closed |
| `/api/wiki/pipeline/demo` | POST | Seeds a synthetic `demo:investor.md` pipeline. Real doc names are not reachable. MW still requires a credential in strict mode |
| `/api/sync/events` | GET (SSE) | Local IDE watcher stream; meaningful only in local mode |
| `/api/scan/workspace` (`fixture:vendor` only) | POST | The "Try demo" scan path |

**Gated:**

| Route | Methods | Gate |
|-------|---------|------|
| `/api/auth/github/repos` | GET | `getGithubSession` (session plus a live provider token) |
| `/api/mcp` | POST, GET, DELETE | `requireApiKey` |
| `/api/v1/me` | GET | `requireApiKey` + MW |
| `/api/v1/scans` | POST | `requireApiKey` + per-key scan limit + MW |
| `/api/v1/scans/pull` | GET | `requireApiKey` + `requireDocumentAccess` (upload refs only are accepted at all) + MW |
| `/api/v1/codegen/pulse` | POST | `requireApiKey` + MW |
| `/api/v1/lock` | GET | `requireApiKey` + `requireDocumentAccess` **upload-only** + MW |
| `/api/v1/auth/keys` | POST, GET | `adminSecretOk`, the `BLOCKSMITH_ADMIN_SECRET` header. Unset secret means 403 for everyone + MW |
| `/api/v1/auth/keys/me` | GET, POST, DELETE | `getSupabaseUser` (self-serve keys) + MW |
| `/api/v1/orgs/me` | GET | `getSupabaseUser`. Side effect: may create your org + MW |
| `/api/v1/orgs/invite` | POST | `getSupabaseUser`, plus the owner/admin check inside `inviteOrgMember` (surfaces as 400, not 403) + MW |
| `/api/v1/orgs/members` | DELETE | `getSupabaseUser`, plus the owner/admin check inside `removeOrgMember` + MW |
| `/api/v1/governance/events` | POST | `requireApiKey` **and** `requireDocumentAccess("write")` + MW |
| `/api/v1/governance/events` | GET | `requireApiKey` **and** `requireDocumentAccess("read")` + MW |
| `/api/v1/governance/events` | PATCH | `requireApiKey` **only**. No check on which document the event belongs to |
| `/api/v1/governance/settings` | GET | `getSupabaseUser` + MW |
| `/api/v1/governance/settings` | PATCH | `getSupabaseUser` + `roleAtLeast(role, "admin")` + MW |
| `/api/v1/deviations`, `/[id]`, `/budget` | POST, GET, PATCH | `resolveActor`, but the 401 is **conditional on `saasStrictMode()`**. `orgId` is taken from the request + MW |
| `/api/v1/figma/annotations/propose` | POST | `requireActor` + AI rate limits. Sends `Access-Control-Allow-Origin: *` |
| `/api/wiki/import` | GET | `getSupabaseUser`. Strict + anonymous returns 401; hosted + anonymous returns an empty list; local returns everything + MW |
| `/api/wiki/import` | POST | `saasStrictMode() && !user` returns 401 + MW |
| `/api/wiki/finalize` | POST | pipeline rate limit + `requireDocumentAccess` **upload-only** + MW |
| `/api/wiki/promote` | POST | pipeline rate limit + `requireDocumentAccess` **upload-only** + MW |
| `/api/wiki/rollback` | POST | pipeline rate limit + `requireDocumentAccess` **upload-only** + MW |
| `/api/wiki/pin-lock` | POST | pipeline rate limit + `requireDocumentAccess` **upload-only** + MW |
| `/api/wiki/pipeline`, `/pipeline/diff` | GET | `requireDocumentAccess("read")` **upload-only** |
| `/api/wiki/releases` | GET | `requireDocumentAccess` **upload-only** |
| `/api/wiki/source` | GET, POST | `requireDocumentAccess` **upload-only**. POST returns 409 on a `baseContentHash` mismatch unless `force` + MW |
| `/api/wiki/publish` | GET | `getSupabaseUser` + MW |
| `/api/wiki/publish` | POST | `getSupabaseUser` + `roleAtLeast(role, "admin")` + MW |
| `/api/wiki/governance/draft` | POST | `requireDocumentAccess` when the ref is an upload; otherwise 400 only in strict mode + MW |
| `/api/wiki/governance/violations` | GET, PATCH | `requireDocumentAccess` read / write |
| `/api/projects/create` | POST | `saasStrictMode() && !user` returns 401; AI rate limit on the `useAi` path |
| `/api/projects/generate-image` | POST | `saasStrictMode() && !user` returns 401; AI rate limit; 6 MB data-URL cap |
| `/api/projects/delete` | POST | `requireDocumentAccess("write")`, unconditional (non-upload refs 400 first) |
| `/api/projects/rename` | POST | `requireDocumentAccess("write")`, unconditional |
| `/api/ingest/capture` | POST | `saasStrictMode() && !user` returns 401; AI rate limits; `requireDocumentAccess("write")` **only when `targetDoc` is set** |
| `/api/ai/governed-generate` | POST | `requireDocumentAccess("read")` **upload-only**; AI rate limits |
| `/api/figma/import` | POST | `saasStrictMode() && !getSupabaseUser()` returns 401 |
| `/api/figma/drift` | POST | `requireDocumentAccess("read")` **only when `body.doc` is an upload ref** |
| `/api/scan/workspace` | POST | API key or `getGithubSession` for GitHub scans; local paths 403; scan rate limits per user and per IP |
| `/api/sync/rescan` | POST | `requireDocumentAccess` + `isAllowedServerWorkspacePath` |
| `/api/sync/github-rescan` | POST | `requireDocumentAccess` + `getGithubSession` |
| `/api/share` | POST | `requireDocumentAccess("read")` on the source document |

**Ungated and probably should not be:**

| Route | Methods | Problem |
|-------|---------|---------|
| `/api/wiki/export` | GET | Returns the whole design system as markdown or JSON for any `?doc=` |
| `/api/wiki/activity` | GET | Returns the activity ledger for any `?doc=` |
| `/api/design-system` | GET | Returns the full parsed system plus IR for any `?doc=`, including `upload:` refs |
| `/api/sync/status` | GET | Resolves any `?doc=`, loads the system, returns name, content hash, updated time |
| `/api/sync/scan-status` | GET | Reads any `upload:` doc's markdown and reports scan status |
| `/api/share` | GET | Existence oracle: reveals whether a share exists for any `(doc, blockKind, blockId)` guess and returns the working public URL |
| `/api/ai/layout` | POST | Public, unauthenticated, unlimited, `maxDuration = 120`, and it calls the LLM |

These are analyzed in 14.13. They are listed here rather than buried because a route inventory that hides its own failures is worthless.

### 14.4.7 The `upload-only` gating pattern, and why it matters

Roughly a dozen routes wrap their ownership check like this:

```ts
if (isUploadDocRef(doc)) {
  const access = await requireDocumentAccess(request, uploadFileNameFromRef(doc), "write");
  if (!access.ok) return access.response;
}
// ... proceed
```

The intent is reasonable. Only `upload:` refs correspond to user-created documents in the registry; a bare file name refers to a document bundled in the repository under `docs/designs.md/`, which is our own content and has no owner. Calling `requireDocumentAccess` on it would deny in strict mode and break the demo.

The consequence is that **repository-backed documents are writable through `/api/wiki/source` POST, `/api/wiki/finalize`, `/api/wiki/promote`, `/api/wiki/rollback`, and `/api/wiki/pin-lock` with no per-document authorization at all**, protected only by the coarse middleware check that some credential exists. Any signed-in user, or anyone holding any valid API key, can edit and promote the bundled samples. Today that is our own marketing content, so the blast radius is defacement of a demo rather than a tenant breach. It stops being acceptable the moment any customer content is addressed by a bare file name, and it is exactly the shape of bug that the "one front door" principle was supposed to eliminate.

The clean fix is to make `requireDocumentAccess` itself understand bundled content (return `ok` for `isBundledSampleDoc` reads, deny writes) rather than making every route remember the conditional. That refactor has not happened.

---

## 14.5 Auth

### 14.5.1 Human auth: Supabase Auth, four ways in

All human authentication runs through Supabase Auth. `src/lib/auth/useSupabaseSession.ts` is the single client hook and exposes four entry points:

| Method | Function | Status |
|--------|----------|--------|
| GitHub OAuth | `signInWithGitHub()` | **Shipped**, the primary path |
| Email + password sign in | `signInWithPassword()` | **Built, unproven** on hosted |
| Email + password sign up | `signUpWithPassword()` | **Built, unproven** on hosted |
| Magic link | `sendMagicLink()` | **Built, unproven** on hosted |

`signIn` is aliased to `signInWithGitHub`, which tells you which one the product actually leans on.

**GitHub OAuth is not only sign in, it is a capability grant.** The scope string is `"read:user user:email repo"`, and the code comment explains why `user:email` is mandatory: "Supabase fetches the user's email after the OAuth exchange, and GitHub hides private emails without this scope, omitting it fails sign-in with 'Error getting user profile'." The `repo` scope is what makes repository scanning possible, and it is a genuinely large ask: it grants read and write access to all of the user's private repositories. We only ever read, but the consent screen does not say that. This is a real friction point in the sales motion and it is also why the email paths exist: a designer who is not going to scan a repo should not have to hand us `repo`.

The provider token is where the two get separated. `getSupabaseUser()` in `src/lib/auth/session.ts` returns `{ userId, login, email }` and works for any auth method. `getGithubSession()` in `src/lib/auth/github.ts` additionally requires `session.provider_token` and returns `null` without it. So **a user who signed in with email has an identity, an org, documents, and no ability to scan a repo**, and `POST /api/auth/github/repos` correctly returns 401 for them. That is the right factoring, and it means the email paths are usable for the Figma and upload wedge without a GitHub account.

`login` is derived with a fallback chain: `user_metadata.user_name`, then `user_metadata.preferred_username`, then the local part of the email, then `null`. That matters because `ensureDefaultOrg` uses `login` to name and slug the personal workspace. An email user gets a workspace slugged from their email prefix, which can collide across domains. `blocksmith_organizations.slug` is `unique`, so the second colliding user's `ensureDefaultOrg` throws. **Not handled.** Listed in 14.13.

### 14.5.2 Sessions

Sessions are Supabase SSR cookies, `sb-<project-ref>-auth-token`, possibly chunked with a `.0`, `.1` suffix. Three clients read them:

| Client | File | Key used | Purpose |
|--------|------|----------|---------|
| Browser | `src/lib/supabase/browser.ts` | anon | Sign in, sign out, session state |
| Server (user) | `src/lib/supabase/user-server.ts` | anon | Read the caller's identity from cookies in RSCs and routes |
| Server (admin) | `src/lib/supabase/server.ts` | **service role** | All registry, org, key, and storage operations |

The separation is the security boundary. The user client is bound to the caller's cookie and subject to whatever RLS exists. The admin client bypasses RLS entirely and must never be constructed in anything that ships to the browser. Every module that touches it starts with `import "server-only"`, which turns a mistaken client import into a build error rather than a leaked service role key.

`createUserSupabase()` returns `null` when Supabase env is missing rather than throwing, which is what makes the whole app degrade to single user local mode instead of crashing.

The session cookie write path in server components is wrapped in a `try { } catch { }` with the comment "set from Server Component, ignored." That is required by Next: Server Components cannot set cookies. The consequence is that **token refresh only happens where cookies are writable**, which is the middleware, route handlers, and `/auth/callback`. A long-lived RSC-only browsing session can hold a stale token until it hits a route that can refresh it.

### 14.5.3 The OAuth callback

`src/app/auth/callback/route.ts` is small and worth reading in full because it is the one place where three security-relevant things happen at once.

It defends against open redirect: `safeNextPath()` rejects anything not starting with `/` and anything starting with `//`, falling back to `/`. It handles the Vercel proxy correctly: in production it rebuilds the redirect origin from `x-forwarded-host` so the session cookie is set on the real hostname rather than the internal one. And it accepts pending invites immediately after `exchangeCodeForSession`, so a teammate is a member before their first page render.

Failure modes redirect to `/?auth_error=<reason>&auth_detail=<message>` with the detail truncated to 200 characters. Reasons are `supabase_not_configured` and `github_connect_failed`. Truncating the detail is the right instinct (it is attacker-influenced text rendered on our page), though the underlying protection is that it is rendered as React text, not HTML.

### 14.5.4 Machine auth: API keys

Machine callers (the CLI, the SDK, MCP clients, CI) do not have cookies. They present `Authorization: Bearer bs_live_…`.

Key generation, in `src/lib/cloud/api-keys.ts`:

```ts
const body = randomBytes(24).toString("base64url");   // 192 bits of entropy
const key = `bs_live_${body}`;
const prefix = key.slice(0, 16);                       // "bs_live_" + 8 chars, safe to log
const hash = createHash("sha256").update(key).digest("hex");
```

We store `prefix` and `hash`. The plaintext key is returned exactly once, at creation, and never again. `ApiKeyRecord.hash` carries the comment "sha256 of full secret, never store plaintext after creation."

Authentication is a lookup by hash with a `revoked_at is null` filter, backed by a partial index (`blocksmith_api_keys_hash_idx ... where revoked_at is null`). Note the hash is a plain SHA-256 with no salt and no KDF. For a 192-bit random secret that is fine (there is nothing to brute force), and it is what makes the constant-time-free equality lookup a database index hit rather than a table scan. Do not copy this pattern for passwords.

**How machine auth differs from human auth, precisely:**

| | Human session | API key |
|---|---|---|
| Carrier | `sb-*-auth-token` cookie | `Authorization: Bearer` header |
| Resolved by | `getSupabaseUser()` | `authenticateApiKey()` |
| Expires | Yes, Supabase refresh flow | **Never**, until explicitly revoked |
| Revocable | Sign out, or Supabase | `DELETE /api/v1/auth/keys/me` sets `revoked_at` |
| Scoped to a document | No, scoped to org membership | No, scoped to the bound user's org membership |
| Can be an admin | No | **Yes**, if `userId` is null |
| Order of resolution | Second | **First**, in `resolveActor()` |

That last row of the "admin" line is the sharp edge. `toAuthenticated()` computes:

```ts
isAdmin: !record.userId
```

A key with no bound user is an **admin key**, and `canAccessDocument(..., { allowAdminKey: true })` returns `true` before it ever looks at the registry. These exist for CI and for the original single-tenant cloud API, and they are minted through `POST /api/v1/auth/keys` guarded only by the `BLOCKSMITH_ADMIN_SECRET` header. `createApiKeyForUser()` (the self-serve path used by the wiki Sync panel) always binds a user, so self-serve keys can never be admin.

Two consequences to internalize:

1. `BLOCKSMITH_ADMIN_SECRET` is effectively a **root credential for every tenant's data.** If it leaks, an attacker mints an admin key and reads everything. `adminSecretOk()` compares with `===`, which is not constant time; the timing signal on a long random string is not a practical attack, but it is not free either.
2. The checked-in `data/cloud/api-keys.json` in this repo contains records with `"userId": null`. Those are admin-key records from verify script runs. They are hashes, not secrets, so they cannot be used to authenticate. But it means the local file store's default posture is "admin," and if that file were ever seeded onto a hosted instance where `localCloudStoreWritable()` were true, those rows would be live admin grants for anyone holding the original plaintext.

Also note: `authenticateApiKey()` tries Supabase first, then **falls back to the local file store**. On Vercel `localCloudStoreWritable()` is false so writes are skipped, but `readStore()` still reads. Any `data/cloud/api-keys.json` that ends up in the deployment bundle is a live key list in production.

---

## 14.6 Storage

### 14.6.1 What has to be stored

Four kinds of state, with four different durability stories:

| State | Local | Hosted | Durable on Vercel? |
|-------|-------|--------|--------------------|
| Design markdown | `data/uploads/*.md` | Supabase Storage bucket `scan-docs`, prefix `uploads/` | Yes |
| Ownership, orgs, keys | `data/cloud/*.json` | Postgres tables | Yes |
| Block registry, locks, pipeline runs | `.blocksmith/` | Postgres (`schema-registry.sql`) | Yes |
| Public share records | `data/public-share/*.json` | `data/public-share/*.json` | **No** |

That last row is not a typo and it is covered in 14.13.

### 14.6.2 The markdown storage abstraction

The abstraction is thin and lives in two files.

`src/lib/uploads/persist.ts` is the backend-selecting layer. `persistUploadMarkdown()`:

1. Writes to an in-memory `Map` keyed by file name. Always.
2. If `supabaseStorageEnabled()`, uploads to Supabase with `upsert: true`.
3. Attempts a local file write, in a `try/catch` that swallows the read-only filesystem error on Vercel.
4. Returns `{ bytes, savedAt, backend }` where backend is `"supabase" | "local" | "both"`.

Reads mirror it. `hydrateUploadMarkdown()` checks memory, then the local path, then downloads from Supabase and back-fills both memory and (best effort) the local path. `readUploadMarkdownSync()` exists because the design system parser is synchronous, and it throws a diagnostic error if the doc was never hydrated: "Upload not cached: X. Call hydrateUploadMarkdown() first."

`src/lib/supabase/storage.ts` is the Supabase side. One bucket constant, one path convention:

```ts
export const SCAN_DOCS_BUCKET = "scan-docs";
function storagePath(fileName: string): string { return `uploads/${fileName}`; }
```

Uploads are `text/markdown`, `upsert: true`. Listing is `list("uploads", { limit: 500, sortBy: { column: "updated_at", order: "desc" } })`, filtered to `.md`. **That 500 is a hard ceiling on the entire hosted document count**, across all tenants, with no pagination. It is fine for a design-partner beta and is a real scaling bug the moment it is not.

The bucket is created by `supabase/setup.sql`: private (`public = false`), `file_size_limit` 2097152 (2 MiB), and an allowed MIME list. The app enforces its own 2 MB limit in `saveMarkdownUpload` ("File is too large (max 2MB)") so the two agree. The only storage policy in the repo is commented out; the server uses the service role key which bypasses RLS entirely.

**The memory cache is the interesting part.** It is a module-level `Map`, so it is per serverless instance and unbounded. It is what makes the synchronous parser work on Vercel, and it is also why two different instances can hold two different versions of the same document between a write and the next read. There is no invalidation across instances. For a single editor this is invisible. For two teammates editing the same document it is a genuine consistency hazard, which is one reason `docs/GOAL-SAAS-STATUS.md` lists "Multi-user conflict / CRDT" as an open P3.

### 14.6.3 Path safety

Every file name crosses `safeUploadFileName()` in `src/lib/uploads/paths.ts` before touching a path:

```ts
const normalized = normalize(fileName).replace(/^(\.\.(\/|\\|$))+/, "");
if (normalized.includes("..") || normalized.includes("/") || normalized.includes("\\")) throw
if (!normalized.toLowerCase().endsWith(".md")) throw
if (!/^[\w.-]+\.md$/i.test(normalized)) throw
```

Belt, braces, and a third check. The final regex alone would be sufficient, and the redundancy is intentional. This function is the reason a `docRef` like `upload:../../etc/passwd` cannot escape `data/uploads/`.

### 14.6.4 Why the dashboard had to move off the filesystem

The dashboard originally listed projects by reading `data/uploads/` with `readdir`. On Vercel that directory contains only whatever shipped in the build, and anything written at runtime disappears when the instance recycles. So a user would create a project, see it once, and find an empty dashboard on the next request that landed on a different instance. The project was not lost (it was in Supabase Storage) but it was unreachable, because the only way to find its file name was the listing.

The fix, in `src/lib/dashboard/projects.ts`, is that `listDashboardProjects()` lists through `listUploads()` → `listUploadMetasFromBackend()`, which prefers `supabaseListMarkdown()` and only falls back to `readdir` when Supabase is unconfigured or errors. The header comment states the rule directly: "Lists through the backend (`listUploads`) so it works on Supabase storage in production, NOT the local filesystem, which is ephemeral on serverless."

That fix created a second problem, which produced a second fix. See 14.7.2.

### 14.6.5 The Vercel filesystem constraints, stated plainly

Three separate constraints, often confused:

1. **The application directory is read only at runtime.** Anything under `process.cwd()` cannot be written. This is why `localCloudStoreWritable()` returns `false` when `VERCEL === "1"`, and why `writeFileStore()` in `documents.ts`, `orgs.ts`, and `api-keys.ts` all begin with an early return. Without that guard every registry write would throw `EROFS`.
2. **`/tmp` is writable, small, and per invocation.** `src/lib/runtime/writable-root.ts` handles this: `blocksmithWritableRoot()` returns `join(tmpdir(), "blocksmith")` when hosted and `.blocksmith` locally, and `skipLocalScanAudit()` returns true when hosted with the comment "Goal 1 on Vercel: wiki upload only, no scan-facts / curate cache on /tmp." `src/lib/scan/github.ts` clones repos into `mkdtemp(join(tmpdir(), "blocksmith-clone-"))`, which works precisely because a clone is used and discarded inside one invocation.
3. **Nothing in `/tmp` survives.** This is why `docs/GOAL-SAAS-STATUS.md` marks "IDE to Web live watcher on SaaS" as **Not planned**: there is no persistent working tree to watch on a `/tmp` clone. The hosted handshake story is re-scan and CLI pull, not file watching.

`isServerlessHosted()` checks `VERCEL === "1"` **or** `AWS_LAMBDA_FUNCTION_NAME`, which is a nice touch for portability. `localCloudStoreWritable()` only checks `VERCEL`, which is an inconsistency: on a bare Lambda deploy the registry would attempt filesystem writes.

---

## 14.7 Rate limiting and caching

### 14.7.1 Rate limiting

Everything goes through one function, `checkRateLimit(key, limit, windowMs)` in `src/lib/cloud/rate-limit.ts`. It is a fixed-window counter:

```ts
const count = await redis.incr(redisKey);       // redisKey = `rl:${key}`
if (count === 1) await redis.expire(redisKey, windowSec);
if (count > limit) { let ttl = await redis.ttl(redisKey); ... return { ok: false, retryAfterSec } }
return { ok: true };
```

Three design decisions, all deliberate and all worth knowing:

**Distributed via Upstash, not in process.** `getRedis()` in `src/lib/cloud/redis.ts` is a memoized singleton over `@upstash/redis` (REST, so it works on the edge and in serverless without connection pooling). It returns `null` when `UPSTASH_REDIS_REST_URL` or `UPSTASH_REDIS_REST_TOKEN` is missing, and `checkRateLimit` falls back to a module-level `Map`. **The fallback is per instance, which on Vercel means the effective limit is roughly `limit × instances`.** This is exactly the "Durable rate limits (Redis/Supabase)" gap that `docs/DEPLOY.md` and `docs/GOAL-SAAS-STATUS.md` both list as open; it is now closed in code and open in configuration, because setting the Upstash variables is a human step.

**It fails open.** Any Redis error is caught, logged as `[rate-limit] Redis error, allowing request`, and the request is allowed. The comment says why: "never let a Redis outage block legitimate traffic." That is the right call for a product where the downside of a limiter outage is a bill, not a breach. Know that it means a sustained Redis outage removes all rate limiting.

**Fixed window, not sliding.** A caller can spend the full limit at the end of one window and again at the start of the next, so the true worst case burst is `2 × limit`. Acceptable at these thresholds; not acceptable if you ever tighten one to defend against something sharp.

`clientIp()` reads `x-forwarded-for` (first entry) then `x-real-ip`, falling back to `"local"`. On Vercel `x-forwarded-for` is set by the platform, so it is trustworthy there. Anywhere the app is not behind a trusted proxy, an attacker sets that header themselves and every IP-keyed limit becomes decorative.

**The limiter inventory:**

| Limiter | Key shape | Default limit | Window | Env override |
|---------|-----------|---------------|--------|--------------|
| Scan by IP | `scan:github:{ip}` | 8 | 60 min | `BLOCKSMITH_SCAN_RATE_LIMIT`, `BLOCKSMITH_SCAN_RATE_WINDOW_MIN` |
| Scan by user | `scan:github:user:{userId}` | 12 | 60 min | `BLOCKSMITH_SCAN_RATE_LIMIT_PER_USER` |
| Scan by API key | `scan:apikey:{keyId}` | 24 | 60 min | `BLOCKSMITH_SCAN_RATE_LIMIT_PER_KEY` |
| AI by IP | `ai:gen:ip:{ip}` | 10 | 60 min | `BLOCKSMITH_AI_RATE_LIMIT`, `BLOCKSMITH_AI_RATE_WINDOW_MIN` |
| AI by user | `ai:gen:user:{userId}` | 40 | 60 min | `BLOCKSMITH_AI_RATE_LIMIT_PER_USER` |
| Pipeline writes by IP | `pipeline:write:{ip}` | 120 | 10 min | `BLOCKSMITH_PIPELINE_RATE_LIMIT` |

The window functions clamp to a minimum of 60 seconds (`Math.max(60_000, windowMin * 60_000)`), so a misconfigured `0` cannot produce a zero-length window. The **limits** are not clamped: a non-numeric value such as `BLOCKSMITH_AI_RATE_LIMIT=none` yields `NaN`, `count > NaN` is always false, and that limiter is silently disabled. Also note that the pipeline limiter is not exported from `rate-limit.ts` at all; it is an inline `checkRateLimit` call copy-pasted into four route files, all sharing one bucket key, with the window hardcoded rather than configurable.

The in-memory fallback `Map` is never evicted. Expired buckets are overwritten on the next hit for the same key and otherwise stay forever, so on a long-lived instance without Redis it grows with the number of distinct IPs seen.

**The AI limiters are the ones that matter financially.** Their file comment says it: "tighter, each call is real LLM spend." They are applied on `/api/projects/create`, `/api/projects/generate-image`, `/api/ai/governed-generate`, `/api/ingest/capture`, and `/api/v1/figma/annotations/propose`. The pattern in each is the same and is worth copying: check the IP limit first, and if there is a signed-in user, additionally check the per-user limit. Anonymous callers get the tight IP bucket; signed-in users get a looser personal bucket on top. Combined with the `saasStrictMode() && !user → 401` check on the generation routes, the result is that in production nobody can spend LLM budget anonymously at all.

**Which routes are limited, and which are not.** Limited: the six above. Not limited: everything else, including `POST /api/figma/connect` (which makes multiple Figma REST calls and optionally a vision model call), `POST /api/wiki/import` (an upload), `GET /api/wiki/export`, and the entire share surface (`POST /api/share/[id]/view` and `/opinion` increment a counter and rewrite a JSON file with no limit at all). The last one is a trivially abusable write amplification.

### 14.7.2 The dashboard metadata cache

Moving the dashboard onto the storage backend (14.6.4) fixed correctness and broke performance. A rich project card shows a display name, a kind (Figma, Scan, Design, Sample), a token count and a component count, all of which are parsed out of the markdown. Locally that is N file reads. In hosted mode it is N storage downloads on every dashboard load.

The fix is `src/lib/dashboard/meta-cache.ts`, a denormalized metadata cache in the same Redis:

```ts
const key = (fileName: string) => `pmeta:${fileName}`;
// value: { name, kind, tokens, components, updatedAt }
```

Written by `cacheProjectMeta()` from `registerOwnedProject()` at creation time. Read by `getCachedMetas()` in **one `MGET`** for the whole dashboard. Deleted by `deleteProjectMeta()` on project delete.

`listDashboardProjects()` picks its strategy from `supabaseStorageEnabled()`:

- Hosted: one `MGET`, and any cache miss renders a **coarse card** (name derived from the file name slug, kind derived from the file name prefix, zero counts). Degraded, never broken.
- Local: parse every document for the rich card, because file reads are cheap.

Two honest notes. First, **there is no TTL on `pmeta:` keys.** `redis.set()` is called without an expiry, so a deleted document whose `deleteProjectMeta` failed leaves a key forever. Bounded by document count, so not urgent, but it is unbounded growth by construction. Second, the cache is only written at creation. **Editing a document does not update its cached counts**, so a hosted dashboard card can show stale token and component numbers indefinitely. That is a visible product bug waiting to be reported.

### 14.7.3 The caches and limiters that are still per instance

Stated honestly, because "we have distributed rate limiting" is only two thirds true:

| Thing | Backing | Per instance? | Where it breaks |
|-------|---------|---------------|-----------------|
| Rate limits with Upstash set | Redis | No | Nothing |
| Rate limits without Upstash | `Map` in `rate-limit.ts` | **Yes** | Effective limit multiplies by instance count under load |
| Upload markdown cache | `Map` in `persist.ts` | **Yes** | Instance A serves a stale doc after instance B writes it |
| Design system parse cache | `Map` in `src/lib/clients/registry.ts` | **Yes** | Same, keyed on mtime which is meaningless across instances |
| Dashboard metadata | Redis | No | Silently degrades to coarse cards without Upstash |
| Redis client handle | Module singleton | Yes, by design | Nothing, this is correct |

The pattern to notice: **every in-memory `Map` in this codebase is a correctness compromise made to satisfy a synchronous API or to survive without Redis.** None of them is a considered caching strategy. When you see one, assume it is per instance and reason about what two instances disagreeing would look like.

---

## 14.8 Security posture

### 14.8.1 Headers

Two sources, deliberately split.

**Static headers** in `next.config.ts`, applied to `/:path*`:

| Header | Value | Why |
|--------|-------|-----|
| `X-Content-Type-Options` | `nosniff` | Stops a markdown or JSON response being sniffed as HTML |
| `X-Frame-Options` | `SAMEORIGIN` | Clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Wiki URLs contain document identifiers; do not leak them cross origin |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), browsing-topics=()` | Deny hardware and ad-topic APIs we never use |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Two years, subdomains, preload eligible. Only honored over HTTPS |

Plus `poweredByHeader: false`, which removes `X-Powered-By: Next.js`. That is not a real control, it is hygiene: it removes a free fingerprint that tells an attacker which framework CVEs to try.

**Dynamic header** in `src/middleware.ts`: a per-request Content Security Policy with a fresh nonce.

```
default-src 'self'
script-src 'self' 'nonce-<random>' 'strict-dynamic' [+ 'unsafe-eval' in dev]
style-src 'self' 'unsafe-inline'
img-src 'self' blob: data: https:
font-src 'self' data: https:
connect-src 'self' https://*.supabase.co https://*.upstash.io https://*.sentry.io
            https://api.github.com https://api.figma.com
object-src 'none'
base-uri 'self'
form-action 'self'
frame-ancestors 'self'
[upgrade-insecure-requests in production]
```

Note this directly contradicts `docs/PRODUCTION-CHECKLIST.md` section 5, which still lists "Content-Security-Policy (needs nonce wiring; can break Next if rushed)" as an open P2 item. **The CSP is shipped.** The doc is stale and should be corrected. `object-src 'none'` and `base-uri 'self'` are the two that actually stop injected-content attacks; `script-src` with `strict-dynamic` plus a nonce is the modern correct form. `style-src 'unsafe-inline'` is a concession to Tailwind and inline theme scripts and is the weakest line in the policy.

The nonce is generated with `btoa(crypto.randomUUID())` and set both on the outgoing response and on the forwarded request headers as `x-nonce`, so server components can read it. `securedNext()` is called on **every** middleware exit path, including the non-strict early return, so the CSP applies in local dev too.

### 14.8.2 The XSS boundary: we never evaluate LLM output as code

This is the most important application-level security property in the product, and it is a rule rather than a mechanism, which is why it is stated here explicitly.

BlockSmith asks language models to produce component code. It renders design systems that users uploaded. Neither of those ever becomes executable code in a user's browser.

- **LLM-generated JSX is never evaluated.** The comment in `src/components/demo/GovernedAiShowcase.tsx` states it: "We never eval/render the LLM's code (XSS-safe)." Generated code is displayed as syntax-highlighted text, never mounted.
- **There is no `eval` and no `new Function` anywhere in `src/lib` or `src/components`.** Grep confirms zero occurrences.
- **User markdown is rendered without raw HTML.** `src/components/wiki/MarkdownBody.tsx` uses `react-markdown` with `remarkGfm` and `rehypeShiki` and deliberately does not include `rehype-raw`. Its comment: "Safe GFM rendering for generic docs. Raw HTML is intentionally not enabled." So a `<script>` tag inside an uploaded `DESIGN.md` renders as literal text.
- **Every `dangerouslySetInnerHTML` in the tree takes developer-authored or tool-generated content, never user content.** There are six: a theme script constant, chart CSS, two style constants, one wiki theme block, and Shiki's highlighted HTML in `src/components/ui/code-block.tsx`. Shiki escapes its input; it is a syntax highlighter, not a passthrough.

Previews are rendered by composing our own React components from the parsed Design IR. The IR is data. The renderer is ours. That is the whole reason the deterministic-composition decision in the AI layer is a security property and not only a quality property: **because we compose from IR instead of executing generated code, there is no code path from a model's output to a user's browser.** If somebody proposes a live JSX preview, that proposal is a security review, not a feature ticket.

### 14.8.3 Secret handling

| Secret | Where it may exist | Where it must never exist |
|--------|-------------------|--------------------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env, `.env.local` | Any file imported by client code (enforced by `import "server-only"`) |
| `BLOCKSMITH_ADMIN_SECRET` | Vercel env | Anywhere; it is a cross-tenant root credential |
| `NVIDIA_API_KEY` | Vercel env | Client bundle |
| `RESEND_API_KEY`, `UPSTASH_REDIS_REST_TOKEN` | Vercel env | Client bundle |
| API key plaintext (`bs_live_…`) | The user's clipboard, once | Our database (we store SHA-256 only) |
| Figma personal access token | The request body, for the duration of one request | **Anywhere at rest** |

The Figma one is worth spelling out because it is the pattern we want to repeat. `POST /api/figma/connect` takes `{ figmaUrl, figmaToken }`, uses the token for `fetchFigmaFile()` and `fetchFigmaFrameImages()` inside the request, and then the request ends. The token is not persisted, not logged, and not returned. There is no `figma_tokens` table. A user pastes a token, gets their design system imported, and we hold nothing afterwards. The cost is that they must paste it again next time; the benefit is that a database breach exposes zero Figma tokens.

`FIGMA_ACCESS_TOKEN` as an environment variable exists only for `POST /api/figma/webhook`, where there is no user in the request to supply one.

**The known secret hygiene failure.** `env.txt` is present in the working tree and contains real, live plaintext credentials: two NVIDIA API keys, a Supabase project URL, publishable keys, and a **Supabase service role JWT**. Its own first line says "Local only, never commit (.gitignore)." Whether or not it is gitignored, those values have existed in plaintext on disk and, per the production readiness notes, some were pasted into chat. **Every one of them must be treated as compromised and rotated.** That is launch gate 6 in 14.12, and the service role key is the urgent one: it bypasses RLS on the entire project.

### 14.8.4 The release security gate

`docs/SECURITY-RELEASE-GATE.md` is the standing merge gate and it is still marked **RELEASE BLOCKER**. Its ten P0 items (S0 through S10) are eight shipped and two open:

| ID | Item | Status |
|----|------|--------|
| S0 | Default deny for unregistered docs | Shipped, `documents.ts` + `isPublicContent` |
| S1 | `GET /api/wiki/import` org-scoped and 401 when logged out | Shipped |
| S2 | Homepage upload requires sign-in in the UI | Shipped, `HomeStudio.tsx` `blockedBySignIn()` |
| S3 | Global sign-in chrome | Shipped, `AuthChrome` and `TopNav` |
| S4 | Wiki read gate covers scan docs, not only `upload:` | Shipped, `wiki-access.ts` |
| S5 | Register on every upload | Shipped in effect (strict requires a session, default deny backstops) |
| S6 | Full route audit | Shipped, table reproduced and extended in 14.4.6 |
| S7 | Middleware front door | Shipped, `src/middleware.ts` |
| S8 | Prod migration checklist | **Open**, manual on Vercel and Supabase |
| S9 | Stranger security test on production, by two non-builders | **Open**, never run |
| S10 | Verify scripts in CI on every deploy | Scripts exist and are in `verify:software`; **CI wiring open** |

`npm run verify:security-gate` (`scripts/verify-security-gate.ts`, wired into `verify:software`) is the automated half. It asserts, in strict mode: an unregistered document denies both anonymous and signed-in non-owner reads; the demo doc and bundled samples stay public while `upload:scan-acme-ui-kit.md` does not; admin key bypass still works; anonymous `GET /api/wiki/import` returns 401 and never includes an `uploads` array; and the publish and unpublish cycle behaves. Twelve assertions across five groups.

The gate's own definition of done requires that "two non-builders sign the stranger security test on production." Until that happens the honest status of the whole chapter is: **the controls are built and unit-proven, and nobody has ever tried to break them from the outside.**

---

## 14.9 Observability

### 14.9.1 Sentry

`@sentry/nextjs` is wired into all four surfaces:

| Surface | File | Notes |
|---------|------|-------|
| Server (Node runtime) | `sentry.server.config.ts` | Imported by `instrumentation.ts` `register()` |
| Edge runtime | `sentry.edge.config.ts` | Imported by `register()` when `NEXT_RUNTIME === "edge"` |
| Client | `instrumentation-client.ts` | Also exports `onRouterTransitionStart` |
| Request errors | `instrumentation.ts` | `export const onRequestError = Sentry.captureRequestError` |
| Error boundaries | `src/app/error.tsx`, `src/app/global-error.tsx` | Explicit `Sentry.captureException(error)` |

All four read the same variable, `NEXT_PUBLIC_SENTRY_DSN`, and all four pass `enabled: !!dsn`. **With no DSN set, Sentry is a complete no-op**: no initialization, no network, no cost, no crash. That is why it could be merged before anybody signed up for an account, and it is why adding the DSN in Vercel is a one-variable change with no code deploy.

Settings, identical across all three configs: `tracesSampleRate: 0.1` (ten percent of transactions), `sendDefaultPii: false` with the comment "PII (IPs, request bodies) off by default, opt in deliberately." The client adds `replaysSessionSampleRate: 0` and `replaysOnErrorSampleRate: 0`, Session Replay off "cost/PII."

**Not done:** source map upload. `docs/PRODUCTION-CHECKLIST.md` lists it as an open P2 (`withSentryConfig` plus an auth token). Without it, production stack traces will be minified and close to useless. That is worth closing at the same time as adding the DSN, because a Sentry with unreadable traces is a false sense of coverage.

### 14.9.2 Startup config warnings

Covered in 14.3. Three `console.warn` lines from `instrumentation.ts`, production only, Node runtime only, non fatal.

### 14.9.3 Error pages

**404**, `src/app/not-found.tsx`: a branded static page, "Page not found," with buttons to `/dashboard` and `/`. This replaced the default Next 404 which leaked nothing dangerous but looked like an unfinished project. Reached by `notFound()` from the wiki access gate, so **a denied wiki read renders this page**.

**Route error boundary**, `src/app/error.tsx`: production aware. `isDev = process.env.NODE_ENV === "development"` controls three things. In dev it detects stale chunk errors (`"Cannot find module"`, `"Loading chunk"`, a `.js'` fragment) and tells you to run `npm run dev:clean`. In production it shows "An unexpected error occurred. Try again, or head back to your dashboard." The raw `error.message` and `error.digest` are rendered in a `<pre>` **only when `isDev`**, which is the correct gate: a Next error digest is safe to show but the message can contain internal paths and query fragments.

**Root error boundary**, `src/app/global-error.tsx`: catches failures where the normal boundary cannot render, renders its own `<html>` and `<body>` with inline styles (it cannot rely on the app's CSS having loaded), and reports to Sentry. Note it has **no `NODE_ENV` check**, so its dev-oriented "run npm run dev:clean" copy can be shown to a production user. Minor, but it is the one place the "no dev hints leaked to users" claim in the production checklist is not quite true.

### 14.9.4 Search indexing

`src/app/robots.ts` allows `/` and disallows `/dashboard`, `/api`, `/studio`, and `/wiki`. Marketing is indexable, the application is not. This is defense in depth rather than access control: it stops a leaked wiki URL from becoming a Google result, but it stops nothing on its own.

There is a small tension worth knowing: `/wiki` is disallowed, yet `scripts/verify-production-goals.ts` treats `/wiki?doc=upload%3Ascan-acme-ui-kit.md` as the flagship public demo. Our one public demo surface is deliberately de-indexed. That is probably correct (we do not want a demo doc outranking the marketing site) but it is a decision nobody wrote down. There is **no sitemap** in the repo.

---

## 14.10 Environment variable reference

Every variable read anywhere in `src`, `scripts`, the config files, or the published packages. "Surface that breaks" is what a new cofounder actually needs.

### Required for a hosted deployment

| Variable | Purpose | Surface that breaks without it |
|----------|---------|-------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Everything. No auth (`createUserSupabase` returns null), no storage, no registry. `saasDbEnabled()` false, so ownership rows never persist and default deny 404s every document |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-safe publishable key. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is accepted as an alias | Sign in. `/auth/callback` redirects to `/?auth_error=supabase_not_configured` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key for Storage and all cloud tables | Document persistence and the entire registry. Uploads fall back to the ephemeral Vercel filesystem and vanish |
| `BLOCKSMITH_SAAS_STRICT` | `1` enforces tenant isolation. `0` disables it. Unset follows `NODE_ENV` | Nothing visibly. Off means no isolation at all. **The number one launch gate** |
| `BLOCKSMITH_ADMIN_SECRET` | Header secret for minting admin API keys via `POST /api/v1/auth/keys` | Admin and CI key minting. `adminSecretOk()` returns false for every request when unset, which fails closed |

### Strongly recommended

| Variable | Purpose | Surface that degrades without it |
|----------|---------|----------------------------------|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint | Rate limits become per instance; dashboard cards become coarse (no names or counts) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token | Same; both are required together |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry project DSN | All error monitoring. Sentry is a silent no-op when unset |
| `NVIDIA_API_KEY` | NVIDIA NIM inference key | AI generate, screenshot ingest, governance copilot, Visualize AI refine, Figma visual enrichment. Semantic (non-AI) paths still work |
| `AI_LAB_SCAN_CURATE` | `0` disables LLM curation during scan | Should be `0` on Vercel; leaving it on makes scans slow and expensive |

### Optional, feature scoped

| Variable | Purpose | Default | Notes |
|----------|---------|---------|-------|
| `RESEND_API_KEY` | Transactional email for org invites | unset | Invite is saved either way; only delivery is lost |
| `BLOCKSMITH_EMAIL_FROM` | Invite From address | `BlockSmith <invites@blocksmith.dev>` | Must be a domain verified in Resend |
| `NEXT_PUBLIC_APP_URL` | Public origin for invite links and share URLs | prod URL in email, `http://localhost:3000` in `publicShareUrl` | Wrong value produces invite links to the wrong host |
| `GITHUB_TOKEN` | Fallback token for private repo clone | unset | Only used when the request carries no user token |
| `FIGMA_ACCESS_TOKEN` | Server token for `/api/figma/webhook` resync | unset | The UI connector uses the user's pasted token instead |
| `FIGMA_WEBHOOK_PASSCODE` | Shared secret validating Figma webhooks | `""` | The only auth on that route |
| `NVIDIA_API_KEY_FALLBACK` | Second key used when the primary rate limits | unset | |
| `NVIDIA_BASE_URL` | NIM endpoint | `https://integrate.api.nvidia.com/v1` | |
| `NVIDIA_MODEL_CHROME` | Primary text model | see `src/lib/ai/` | |
| `NVIDIA_MODEL_PARSER` | Parser-assist model | | |
| `NVIDIA_MODEL_VISION` | Vision model for screenshot and Figma frames | `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` per the checklist | |
| `NVIDIA_MODEL_CHROME_REFINER` | Visualize refiner pass | `openai/gpt-oss-120b` | |
| `NVIDIA_MODEL_GENERATE` | Governed-generate model | | `src/lib/ai/governed-generate.ts` |
| `NVIDIA_GENERATE_MAX_TOKENS` | Token ceiling for governed generate | `1600` | Direct cost control |
| `NVIDIA_ENSEMBLE` | `1` enables slow multi-agent Visualize | off | |
| `NVIDIA_ENSEMBLE_ULTRA` | With ensemble on, use the 550b model | off | |
| `AI_LAB_PARSER_ASSIST` | `0`/`false` disables LLM parser assist | on | |
| `AI_LAB_FONT_RESOLVE` | Toggles AI font resolution | | `src/ai-lab/05-font-resolve/ensure.ts` |

### Rate limit tuning

| Variable | Default | Applies to |
|----------|---------|-----------|
| `BLOCKSMITH_SCAN_RATE_LIMIT` | 8 | Scans per IP per window |
| `BLOCKSMITH_SCAN_RATE_LIMIT_PER_USER` | 12 | Scans per signed-in user |
| `BLOCKSMITH_SCAN_RATE_LIMIT_PER_KEY` | 24 | Scans per API key |
| `BLOCKSMITH_SCAN_RATE_WINDOW_MIN` | 60 | Scan window, minimum 1 minute |
| `BLOCKSMITH_AI_RATE_LIMIT` | 10 | AI generations per IP |
| `BLOCKSMITH_AI_RATE_LIMIT_PER_USER` | 40 | AI generations per user |
| `BLOCKSMITH_AI_RATE_WINDOW_MIN` | 60 | AI window |
| `BLOCKSMITH_PIPELINE_RATE_LIMIT` | 120 | Pipeline writes per IP per 10 minutes (window is hardcoded) |

### Local development and tooling

| Variable | Purpose |
|----------|---------|
| `BLOCKSMITH_WORKSPACE` | Path to the workspace to scan |
| `BLOCKSMITH_SCAN_PATHS`, `BLOCKSMITH_CATALOG_PATHS`, `BLOCKSMITH_SCAN_ALLOW_PATHS` | Override scan roots and allowlists |
| `BLOCKSMITH_SCAN_WATCH` | `0` disables the local file watcher |
| `BLOCKSMITH_DOC` | Default document for sync and demo routes |
| `BLOCKSMITH_AUTHOR` | Author string recorded by MCP handlers |
| `BLOCKSMITH_PUBLIC_URL` | Origin used in MCP-generated links (default `http://localhost:3000`) |
| `BLOCKSMITH_ROOT` | Repo root for the CLI (`packages/cli`) |
| `BLOCKSMITH_API_URL` | Base URL for `verify:patterns-live` |
| `BLOCKSMITH_URL` | Base URL for `verify:production-smoke` and `verify:production-goals`. **If unset both scripts print SKIP and exit 0** |
| `BLOCKSMITH_VERIFY_GITHUB` | Repo slug for `verify:github-scan` |
| `BLOCKSMITH_VENDOR_TEST_WORKSPACE` | External vendor fixture path |
| `BLOCKSMITH_ENSURE_PULSE` | Internal flag set by `scripts/ensure-pulse.mjs` |

### Platform provided, do not set by hand

`NODE_ENV`, `VERCEL`, `CI`, `NEXT_RUNTIME`, `AWS_LAMBDA_FUNCTION_NAME`, `USER`.

`.env.example` documents the important subset and is the file to update when you add a variable. It currently omits `BLOCKSMITH_SAAS_STRICT`, which given 14.3 is a documentation bug worth fixing.

---

## 14.11 Deployment

### 14.11.1 Target

Vercel, Next.js 15 App Router, project `Desmosy/blocksmith` on `main`, production at `https://blocksmith-mocha.vercel.app`. Supabase provides Postgres, Auth, and Storage. Upstash provides Redis. Sentry provides error monitoring. Resend provides email. That is the entire vendor list, and keeping it that short is deliberate.

### 14.11.2 The build pipeline

```
npm run build
  → node scripts/guard-build.mjs     # refuse to build over a running dev server
  → node scripts/ensure-pulse.mjs    # generate the Pulse package if missing
  → next build
```

**`guard-build.mjs`** exists for a specific, repeatedly painful failure. Running `next build` while `next dev` is active corrupts `.next`, and the symptom is not a build error, it is `localhost:3000` throwing "Cannot find module" chunk errors afterwards, which looks like a code bug and is not. The guard runs `pgrep -fl 'next dev'` and exits 1 with an explanatory message if anything matches. It exits 0 immediately when `VERCEL === "1"` or `CI === "true"`, because `pgrep` on a build machine can false positive. A thrown `execSync` (no `pgrep`, for example on Windows) is swallowed and the build proceeds.

The practical consequence for you: **you cannot run `npm run build` locally without stopping `npm run dev` first.** That is why "run the production build" is a separate launch gate in 14.12 rather than something that just happens.

**The nested `font-generator` gotcha.** `font-generator/` is a standalone Next application living inside this repository. The root `tsconfig.json` has a very broad `include` (`["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"]`), so `tsc --noEmit` was walking into the nested app, typechecking a project with its own dependencies and its own config, and failing. That broke `npm run typecheck`, which is the first step of `npm run verify:software`, which broke everything downstream including `npm run build`. The fix, in commit `60cdd31`:

```json
"exclude": ["node_modules", "packages/cli", "packages/sdk", "font-generator"]
```

Know two things about this. First, if you ever see a build failing on files you do not recognize, check whether a new nested project needs the same treatment. Second, `packages/cli` and `packages/sdk` are excluded for the same structural reason, which means **`npm run typecheck` does not typecheck the CLI or the SDK**. They are built separately by `npm run build:packages`. That is a real coverage hole in the verify story.

### 14.11.3 Runtime configuration on Vercel

Long-running Node routes set `maxDuration` explicitly: scan is 60 seconds, vision is 90, `POST /api/figma/connect` is 60. Vercel's Hobby tier caps below that, so **a Pro plan is required** for scan and vision to complete rather than time out. `docs/PRODUCTION-CHECKLIST.md` section 6 flags this.

Most API routes set `export const dynamic = "force-dynamic"`, as does `/dashboard`. That is necessary because they read cookies and per-user data; a statically cached dashboard would be a cross-tenant leak.

### 14.11.4 The deploy checklist

The exact sequence, assembled from `docs/DEPLOY.md`, `docs/SUPABASE.md`, `docs/PRODUCTION-CHECKLIST.md`, and `docs/SECURITY-RELEASE-GATE.md`. Do not reorder: the SQL files depend on each other and the env vars must exist before the first request.

```
1. Supabase project
   a. Create the project, copy URL + anon/publishable key + service_role key
   b. SQL Editor, run in this order:
        supabase/setup.sql                  # private bucket scan-docs, 2 MiB limit
        supabase/schema.sql                 # blocksmith_documents, blocksmith_api_keys
        supabase/schema-orgs.sql            # organizations, members, doc.org_id, doc.published
        supabase/schema-registry.sql        # block registry, manifest, locks, pipeline runs
        supabase/schema-governance-events.sql
        supabase/schema-deviations.sql      # deviations + org_governance_settings
   c. Authentication → Providers → enable GitHub, paste the GitHub OAuth app
      client id and secret
   d. Authentication → URL Configuration → Site URL = the prod domain,
      redirect URLs include https://<domain>/auth/callback
   e. Confirm the scan-docs bucket is private

2. Vercel project
   a. Connect the repo, framework Next.js, branch main
   b. Set every required variable from 14.10, plus AI_LAB_SCAN_CURATE=0
   c. Set BLOCKSMITH_SAAS_STRICT=1 explicitly
   d. Confirm the plan allows maxDuration up to 90s

3. Build locally first
   a. Stop npm run dev  (guard-build will refuse otherwise)
   b. npm run build     # must pass clean
   c. npm run verify:software

4. Deploy, then verify
   BLOCKSMITH_URL=https://<domain> npm run verify:production-smoke
   BLOCKSMITH_URL=https://<domain> npm run verify:production-goals
   curl https://<domain>/api/supabase/health
     → { "serviceRoleSet": true, "storage": { "ok": true, "bucket": "scan-docs" } }

5. Manual smoke (checklist section 7)
   Sign in with GitHub → land on /dashboard
   Create blank, Generate with AI, Generate from screenshot, Upload .md,
     Import from Figma, Scan a repo → each opens a wiki
   Rename and delete with undo
   Second account cannot see or touch the first account's projects
   Hammer an endpoint → 429 with a retry hint

6. Stranger security test (SECURITY-RELEASE-GATE.md), recorded by two people
   who did not write the ACL code
```

A warning about step 4. `verify:production-smoke` and `verify:production-goals` both **exit 0 with a SKIP message when `BLOCKSMITH_URL` is unset.** If you wire them into CI without setting that variable, you get a green build that tested nothing. Between them they check: the home page loads, `/wiki` loads, Supabase storage health is ok, the public demo wiki returns 200 with recognizable content, an unauthenticated scan POST returns 401/403/400/429 (never 500, never 200), `/api/mcp` does not 500, and unauthenticated `/api/v1/auth/keys/me` returns exactly 401. That is a genuine smoke test of the auth boundary from the outside, and it is the closest thing we have to automated production security verification.

---

## 14.12 The open launch gates that require a human

These cannot be closed by writing code. Every one of them needs somebody to log into a dashboard, click something, or talk to a professional. They are listed in dependency order and stated exactly.

**1. Provision Supabase.** Create the project. Run all six SQL files in the order in 14.11.4. Create the `scan-docs` bucket (it is created by `setup.sql`, but confirm it is private). Enable the GitHub auth provider with a real GitHub OAuth app, and set the Site URL and redirect URLs to the production domain. If you want the email sign-in paths to be safe, also confirm that "Confirm email" is enabled, because `acceptPendingInvites` trusts the email address Supabase gives us.

**2. Set the environment variables in Vercel.** All five required variables from 14.10, plus `AI_LAB_SCAN_CURATE=0`. Missing any one of the Supabase three degrades the app to a single-tenant toy with ephemeral storage, and the only signal is a `console.warn` in the function logs.

**3. Flip `BLOCKSMITH_SAAS_STRICT=1`.** Set it explicitly rather than relying on the `NODE_ENV` fallback, because explicit is auditable and the fallback is not. This is the number one gate. Off means zero tenant isolation. The startup warning now fires, but nothing enforces it.

**4. Run the production build.** `npm run build` must pass clean locally before deploying, and it cannot run while `npm run dev` is active (`guard-build.mjs` will refuse). This is listed as a gate because it is a step a person has to remember, not because it is difficult.

**5. Add the Sentry DSN and the Upstash keys.** `NEXT_PUBLIC_SENTRY_DSN` requires a Sentry account and project. `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` require an Upstash database. Both features are fully coded and both are inert until these values exist. Without Sentry we are blind to production errors. Without Upstash, rate limits are per instance (so the real limit is unbounded under load) and the hosted dashboard shows coarse cards with no project names or counts.

**6. Rotate every key that has ever been pasted in plaintext.** `env.txt` in this working tree contains live NVIDIA keys and a live Supabase **service role JWT**, and per the production readiness notes some of these were pasted into a chat transcript. Rotate: both NVIDIA keys, the Supabase service role key, the Supabase publishable key if you want to be thorough, and `BLOCKSMITH_ADMIN_SECRET` (which is currently the literal string `dev-admin-secret` in that file). Then delete `env.txt` and confirm it is gitignored. The service role key is the urgent one because it bypasses row-level security on the whole project.

**7. Set up an email provider for invites.** The code is written (`src/lib/email/send-org-invite.tsx`, Resend). What is missing is a Resend account, a verified sending domain, `RESEND_API_KEY`, and `BLOCKSMITH_EMAIL_FROM` pointing at that domain. Until then invites are created but never delivered, and the invitee has to be told out of band. Note this also affects the magic-link and email-confirmation flows, which go through Supabase's own SMTP; Supabase's default sender is heavily rate limited and is not suitable for production.

**8. Finalize the legal documents with counsel.** `/terms` and `/privacy` exist as drafts. They are drafts written by engineers. A product that stores customers' proprietary design systems needs a real data processing story, a real retention policy, and real deletion commitments. This is a P1 in `docs/PRODUCTION-CHECKLIST.md` and it gates design-partner contracts, not the deploy.

**9. Billing does not exist.** There is no Stripe integration, no plan model, no quota enforcement, no usage metering, no invoice. `docs/GOAL3-TEAM-RBAC.md` says "No Stripe yet, billing attaches to org later," and the org model is the right seam for it (an org is the natural billing entity), but none of it is written. **Planned, no code.** Everything in this system is currently free and unmetered, which is survivable for a design-partner beta and not survivable past it, because the AI rate limits are the only thing standing between one enthusiastic user and an unbounded NVIDIA bill.

**10. Run the stranger security test.** Two people who did not write the ACL code, on production, following the eight-step table in `docs/SECURITY-RELEASE-GATE.md`. This is the only gate on this list that produces evidence rather than configuration, and it is the one that the release gate document says must be signed before any design partner uploads real intellectual property.

---

## 14.13 Threats and gaps, honestly

### Security gaps

**G1. Five unauthenticated full-content reads keyed on an attacker-controlled `?doc=`.** `GET /api/wiki/export`, `GET /api/design-system`, `GET /api/wiki/activity`, `GET /api/sync/status`, and `GET /api/sync/scan-status` all resolve an arbitrary `?doc=` parameter and return document content or metadata with no access check. `resolveDocParam` is essentially `decodeURIComponent`, so it happily accepts `upload:<name>.md`. Middleware does not help: it requires a credential only for mutating `/api/wiki/*` and for `/api/wiki/import`, and it does not cover `/api/design-system` or `/api/sync/*` at all.

Two things reduce the practical severity, and neither is a control we should rely on. First, upload file names carry an eight-character content hash suffix, so guessing one requires already having the content. Scan documents named `scan-<slug>.md` have no such protection. Second, `loadDesignSystem()` throws for an `upload:` ref that is not already hydrated in that instance's memory or on its local disk, so a cold Vercel instance returns 404 while a **warm instance that has already served the document** returns the full content to an anonymous caller. In local dev these routes are simply open. **This is the most serious cluster of holes currently in the tree**, and each one is a one-line fix.

**G2. `GET /api/share` has no access check.** Given a `doc`, `blockKind`, and `blockId` it reports whether a share link exists, returns the full record (system name, block title, content hash, view and opinion stats) and a working public URL. An attacker who knows a document name can enumerate which blocks were shared. `POST /api/share` on the same file is correctly gated, which makes this look like an oversight rather than a decision.

**G3. `POST /api/figma/connect` has no authentication and no rate limit.** It accepts a Figma URL and token, makes several Figma REST calls, optionally runs a vision model over rendered frames (real LLM spend), and creates a document with `maxDuration = 60`. In strict mode `registerOwnedProject` no-ops for the anonymous caller, so the created document is orphaned and unreadable: the data is safe, our budget is not. Compare `POST /api/figma/import`, which does gate. The connect route is the UI path and was missed.

**G4. `POST /api/ai/layout` is public, unauthenticated, unrate-limited, and calls the LLM** with `maxDuration = 120`. It is the single cheapest way for a stranger to spend our inference budget.

**G5. The `upload-only` gating pattern leaves repo-backed documents writable.** Explained in 14.4.7. Signed-in users and any valid API key can write and promote bundled sample documents with no per-document authorization.

**G6. `/api/v1/deviations` and friends trust an `orgId` from the request.** The `orgId` arrives in the body or query string and is used verbatim with no membership verification, and their 401 is conditional on `saasStrictMode()`. In `src/lib/cloud/deviations.ts` the approve, reject, and resolve updates match on `id` alone with no `org_id` scoping, so tenant isolation for the deviation surface depends entirely on a route-level check that does not exist. `autoApproveExpired()` also operates globally across every org.

**G7. `PATCH /api/v1/governance/events` authenticates the API key and never checks which document the event belongs to.** POST and GET on the same route both call `requireDocumentAccess`. PATCH does not.

**G8. Row-level security is enabled on four tables and none of the tenant tables.** `supabase/schema-registry.sql` enables RLS on the four registry tables with no policies (deny-all to anon, service role only). `blocksmith_documents`, `blocksmith_api_keys` (including its `hash` column), `blocksmith_organizations`, `blocksmith_org_members`, `blocksmith_governance_events`, `blocksmith_deviations`, and `org_governance_settings` have **no RLS at all**. There are zero `create policy` statements anywhere in the repo; the only one is commented out in `setup.sql`. All tenant isolation lives in application code. `docs/PRODUCTION-CHECKLIST.md` lists "Row-level security on tenant tables (defense in depth behind app checks)" as an unchecked box, and it is correct to.

**G9. `BLOCKSMITH_ADMIN_SECRET` is a cross-tenant root credential** with no rotation story, no audit trail of which admin keys exist, and a non-constant-time `===` comparison in `adminSecretOk()`. Note the inconsistency: the far lower-value Figma webhook uses `timingSafeEqual`, and the key-minting endpoint does not. Every admin key it mints bypasses `canAccessDocument` entirely and never expires.

**G10. `authenticateApiKey()` falls back to the local file store even in hosted mode.** If `data/cloud/api-keys.json` is present in the deployment bundle, its records are live credentials in production.

**G11. `isBundledSampleDoc()` is an `existsSync` allowlist over a directory.** Anything dropped into `docs/designs.md/` becomes world-readable public content. That is fine while only we can commit to the repository, and it is a foot-gun the moment any process writes into that directory at runtime.

**G12. The strict-mode logic and the public-content list are each duplicated in two files** (`src/lib/cloud/saas.ts` and `src/middleware.ts`) with only a comment holding them in sync, and no test asserting agreement. Related: `saasStrictMode()` only recognizes the exact strings `"0"` and `"1"`. Setting `BLOCKSMITH_SAAS_STRICT=true` silently falls through to the `NODE_ENV` default.

**G13. `/api/supabase/health` is public and returns the Supabase project URL**, whether the service role is configured, the bucket name, and raw Supabase error strings. Minor information disclosure, and it is what `verify:production-smoke` depends on, so removing it has a cost.

**G14. IP-based rate limits trust `x-forwarded-for`.** Safe behind Vercel. Not safe on any deployment where the app is directly reachable. Also, a non-numeric value in any rate-limit environment variable produces `NaN`, and `count > NaN` is always false, which **silently disables that limiter**.

**G15. `POST /api/v1/orgs/invite` has no rate limit.** A signed-in user can send unbounded invite emails through our Resend account to arbitrary addresses. That is a spam vector attached to our sending domain reputation.

**G16. `src/app/share/[shareId]/error.tsx` renders `error.message` verbatim** to unauthenticated visitors, unlike `src/app/error.tsx` which correctly gates on `NODE_ENV`.

**G17. No audit log for permission changes.** `docs/SECURITY-RELEASE-GATE.md` T5 wants promote, rollback, pin-lock, and invite recorded in an append-only table. Pipeline runs are recorded (`blocksmith_pipeline_runs`) and governance events are recorded, but **membership and role changes are not.** There is no way to answer "who invited this person, and when."

**G18. No SSO, no SCIM, no data retention or deletion tooling.** All listed as P2 enterprise requirements in the security gate doc and correctly labeled roadmap, not shipped. Relevant here because a Fortune 100 security questionnaire will ask, and the honest answer is no.

**G19. The stranger security test has never been run.** Everything above is reasoning about code. Nobody has attacked this from the outside.

### Reliability gaps

**R1. Public share records are stored on the local filesystem, in both modes.** `src/lib/public-share/store.ts` writes `data/public-share/<id>.json` with no Supabase path at all, and unlike `documents.ts`, `orgs.ts`, and `api-keys.ts` it does not even check `localCloudStoreWritable()`. On Vercel that write either fails or lands on an ephemeral instance. **Public share links do not durably work in production.** They appear to work immediately after creation (same instance) and 404 afterwards. This is the clearest surviving instance of the class of bug the dashboard fix (14.6.4) was supposed to eliminate everywhere.

**R2. `findShareByBlock()` reads every share file on every call.** An O(n) `readdir` plus a read of every share record, to answer "does a share exist," called from both the ungated GET and every create. There is also **no revoke path**: `enabled` is set to `true` at creation and nothing in the codebase ever sets it to `false`, so a published share link cannot be withdrawn. Share ids are 12 hex characters (48 bits), which is fine against guessing and worth knowing.

**R3. `POST /api/share/[id]/opinion` validates a `comment` field and never stores it.** `recordOpinion()` only increments a counter. Any qualitative feedback a viewer types is silently discarded. Both the opinion and view endpoints are unauthenticated read-modify-write cycles over a JSON file with no locking and no rate limit, so counts are trivially inflatable and concurrent writes are last-write-wins.

**R4. Supabase Storage listing caps at 500 objects, unpaginated.** Document 501 becomes invisible to the dashboard, for everybody.

**R5. The dashboard metadata cache is never updated after creation and has no TTL.** Edited documents show stale counts forever; deleted documents can leak keys forever.

**R6. Multi-org membership is representable and unhandled.** `listOrgsForUser()[0]` is used everywhere. No org switcher exists, and `POST /api/v1/orgs/invite` has no `orgId` parameter, so you can only ever invite into your own first org.

**R7. `ensureDefaultOrg()` opens with a guaranteed no-op.** Its first line is `acceptPendingInvites(userId, null)`, and `acceptPendingInvites` returns `0` immediately when the email is falsy. Whatever that call was meant to do, it does nothing. Invite acceptance actually happens in `/auth/callback` and in `assertWikiDocAccess`, both of which pass a real email.

**R8. `listOrgsForUser()` falls back to the local JSON store when the database query returns zero rows**, not only when it errors (`if (!error && data?.length)`). A genuinely org-less user in hosted mode therefore reads a file that, on Vercel, contains whatever shipped in the build.

**R9. Ownership transfer does not exist.** One owner per org, set at creation, permanent. Removing the owner is explicitly blocked, and inviting a second owner throws.

**R10. The deviation backends disagree with each other.** `rejectDeviation()` increments `rejectionCount` in the local store and **not** in the database path, so the progressive-escalation feature behaves differently in local dev and production. `updateGovernanceSettings()` builds a partial row, discards it, and upserts a fully defaulted payload, so a partial settings update **resets every field the caller did not mention** back to `DEFAULT_SETTINGS`.

**R11. Personal workspace slugs can collide.** `blocksmith_organizations.slug` is `unique` and the slug is derived from the GitHub login or the email local part. Two users at different domains with the same local part cause the second `ensureDefaultOrg()` to throw on insert, and the error surfaces as a generic failure.

**R12. In-memory document caches disagree across instances.** Covered in 14.7.3. Two editors on the same document can see different content.

**R13. Rate limiting fails open.** A Redis outage silently removes all limiting, including the AI cost controls.

**R14. `localCloudStoreWritable()` checks only `VERCEL`, while `isServerlessHosted()` also checks `AWS_LAMBDA_FUNCTION_NAME`.** Inconsistent, and a bare Lambda deployment would attempt read-only filesystem writes.

**R15. `verify:production-smoke` and `verify:production-goals` exit 0 when `BLOCKSMITH_URL` is unset.** A CI job that forgets the variable reports green while testing nothing.

**R16. `npm run typecheck` excludes `packages/cli` and `packages/sdk`.** The two artifacts we publish to npm are not covered by the main type check.

---

## Open questions

1. **404 or 403 for a signed-in user with no access?** Today the wiki returns 404 to avoid document-name enumeration, which directly contradicts `docs/SECURITY-RELEASE-GATE.md` non-negotiable 3 ("never a silent 404 alone") and produces a genuinely confusing experience for a teammate who was not invited. Is enumeration resistance worth the support burden, given that our document names are already high-entropy hashes for uploads but low-entropy slugs for scans?

2. **Should `registerOwnedProject` fail loudly?** It currently swallows every error, so a Supabase blip during creation produces a permanently orphaned document. Failing the request would be honest but would also lose work the user already paid for in LLM tokens. Is there a third option, such as returning the document with a "not saved to your workspace" banner and a retry?

3. **When do we enable row-level security on the tenant tables?** It is pure defense in depth today because every query uses the service role key, so it costs almost nothing and buys real protection against a future code path that uses the anon key. The cost is that RLS misconfiguration is a very effective way to break a production app quietly. Before or after the first paying customer?

4. **What is the actual multi-org model?** The schema supports it, the product ignores it. Do we build an org switcher, or do we declare one org per user and move team membership to an invite-into-my-org model permanently? This decision blocks billing, because billing needs to know what a paying entity is.

5. **Is the `repo` OAuth scope acceptable to our buyers?** We request read and write access to all private repositories in order to read a few. A security-conscious enterprise will refuse. Is a GitHub App with fine-grained per-repository permissions worth the implementation cost, and does it change the sales conversation enough to matter?

6. **Where does public sharing actually live?** The `published` flag on a document (Postgres, durable, works) and the share-link store (local filesystem, does not work hosted) are two independent public-read mechanisms with different security models. One of them should probably absorb the other.

7. **What is the retention and deletion story?** A customer will ask "if we leave, what happens to our design systems." Today the honest answer is that `unregisterDocument` and `deleteUploadMarkdown` exist, deletion is best effort across three stores, and nothing guarantees the Supabase Storage object is gone if the delete call failed. That is not an answer we can put in a contract.

8. **Do we ever store a Figma token?** Not storing it is a genuine security win and a real UX cost (paste it every import, no background sync). The webhook path already needs a server-side `FIGMA_ACCESS_TOKEN`, so we have half-committed to the other model. Decide deliberately rather than by accretion.

---

## Where to look in the code

**Tenancy and access control**

| Path | What it is |
|------|-----------|
| `src/lib/cloud/saas.ts` | `saasStrictMode()`, `saasDbEnabled()`, `localCloudStoreWritable()`, `isPublicContent()`. Read this first |
| `src/lib/cloud/documents.ts` | The document registry and `canAccessDocument()`, the default-deny backstop |
| `src/lib/cloud/access.ts` | `requireDocumentAccess()`, the API gate |
| `src/lib/cloud/wiki-access.ts` | `assertWikiDocAccess()`, the page gate |
| `src/lib/cloud/rbac.ts` | Roles, actions, `canPerform()`. The entire authorization policy |
| `src/lib/cloud/orgs.ts` | Orgs, members, invites, `ensureDefaultOrg()`, `acceptPendingInvites()` |
| `src/lib/cloud/actor.ts` | `resolveActor()`, API key first then session |
| `src/lib/dashboard/ownership.ts` | `registerOwnedProject()`. Fifteen lines you must call on every create path |
| `src/middleware.ts` | The coarse front door plus the CSP |

**Auth**

| Path | What it is |
|------|-----------|
| `src/lib/auth/session.ts` | `getSupabaseUser()` |
| `src/lib/auth/github.ts` | `getGithubSession()`, repo listing, `assertRepoAccessible()` |
| `src/lib/auth/useSupabaseSession.ts` | The client hook: GitHub OAuth, password, magic link |
| `src/lib/supabase/env.ts` | The four env accessors and `supabaseStorageEnabled()` |
| `src/lib/supabase/user-server.ts` | Cookie-bound server client (anon key) |
| `src/lib/supabase/server.ts` | Admin client (service role). Never import from client code |
| `src/app/auth/callback/route.ts` | OAuth code exchange, open-redirect defense, invite acceptance |
| `src/lib/cloud/api-keys.ts` | Key minting, hashing, revocation, `adminSecretOk()` |

**Storage**

| Path | What it is |
|------|-----------|
| `src/lib/uploads/persist.ts` | The backend-selecting persistence layer and the memory cache |
| `src/lib/uploads/paths.ts` | `safeUploadFileName()`, the path traversal defense |
| `src/lib/uploads/store.ts` | `saveMarkdownUpload()`, `listUploads()` |
| `src/lib/supabase/storage.ts` | `SCAN_DOCS_BUCKET`, upload, download, list, health |
| `src/lib/runtime/writable-root.ts` | Serverless detection and the `/tmp` policy |
| `src/lib/dashboard/projects.ts` | `listDashboardProjects()` and why it lists through the backend |

**Rate limiting and caching**

| Path | What it is |
|------|-----------|
| `src/lib/cloud/redis.ts` | The shared Upstash client |
| `src/lib/cloud/rate-limit.ts` | `checkRateLimit()` and all six named limiters |
| `src/lib/dashboard/meta-cache.ts` | The `pmeta:` dashboard cache |

**Configuration, security, observability**

| Path | What it is |
|------|-----------|
| `next.config.ts` | Security headers, `poweredByHeader: false` |
| `instrumentation.ts` | Startup config warnings, Sentry registration, `onRequestError` |
| `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation-client.ts` | Sentry init, no-op without a DSN |
| `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/not-found.tsx` | Error boundaries and the branded 404 |
| `src/app/robots.ts` | Index marketing, hide the app |
| `.env.example` | The variable reference we ship |

**Schema**

| Path | What it is |
|------|-----------|
| `supabase/setup.sql` | The private `scan-docs` bucket |
| `supabase/schema.sql` | `blocksmith_documents`, `blocksmith_api_keys` |
| `supabase/schema-orgs.sql` | Organizations, members, `org_id`, `published` |
| `supabase/schema-registry.sql` | Block registry, manifest, locks, pipeline runs. The only file that enables RLS |
| `supabase/schema-governance-events.sql`, `supabase/schema-deviations.sql` | Governance audit and deviation TTL |

**Verification and build**

| Path | What it asserts |
|------|-----------------|
| `scripts/verify-saas-acl.ts` | Ownership, cross-owner denial, admin bypass, 401 on unauthenticated finalize, filename collision |
| `scripts/verify-security-gate.ts` | Default deny, public content set, admin bypass, no import-list leak, publish cycle |
| `scripts/verify-org-rbac.ts` | Role matrix, invite acceptance, member/viewer/outsider access |
| `scripts/verify-supabase.ts` | Live storage roundtrip and the wrong-key-pasted check |
| `scripts/verify-cloud-api.ts` | API key auth plus the scan and Pulse codegen path |
| `scripts/verify-production-smoke.ts` | Home, wiki, Supabase health against a live URL |
| `scripts/verify-production-goals.ts` | Public demo, unauthenticated scan rejection, MCP, 401 on keys/me |
| `scripts/guard-build.mjs` | Refuses a production build while `next dev` runs |
| `tsconfig.json` | The `font-generator` exclusion that unblocked the build |

**Documents**

`docs/SECURITY-RELEASE-GATE.md` (the standing merge gate), `docs/PRODUCTION-CHECKLIST.md` (the runbook), `docs/SUPABASE.md` (schema setup), `docs/DEPLOY.md` (Vercel), `docs/GOAL3-TEAM-RBAC.md` (the team model), `docs/GOAL-SAAS-STATUS.md` (the honest readiness score).

---

Related chapters: [Chapter 06](./06-system-overview.md) for where this plane sits in the whole system, [Chapter 11](./11-the-handshake-mcp-cli-sdk.md) for what API keys are actually used for, [Chapter 13](./13-the-ai-layer.md) for the cost model the AI rate limits defend, [Chapter 15](./15-verification-and-quality.md) for the verify culture these scripts belong to, and [Chapter 17](./17-what-we-still-need.md) for how the launch gates in 14.12 fit the wider gap list.
