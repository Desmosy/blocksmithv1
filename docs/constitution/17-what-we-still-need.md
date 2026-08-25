# What We Still Need: Gaps, Gates, And Debt

**What this chapter covers:** everything between the current state of BlockSmith and a product a stranger can pay for. The launch gates that no amount of code can close because they need a human with a browser and a credit card. The engineering debt, ranked by how much damage it does when it fails rather than by how annoying it is. The product gaps a real customer will hit on day one. The proof gaps between what the pitch says and what we can demonstrate live. What the company cannot do because nobody here can do it. What we depend on and what happens when it breaks. Where the licensing boundary is and what still needs a lawyer. And finally, all of it merged into one prioritized table.

**Why it matters:** [Chapter 16](./16-the-plan.md) is what we intend to build. This chapter is what is missing, and the two are different documents on purpose. A plan tends to describe forward motion. A gap list has to describe the things you would rather not think about, which is exactly why it is the more useful of the two when you are deciding what to do on a Tuesday.

**Read this if:** you are about to launch, about to demo, about to hire, about to sign something, or about to tell someone this product is ready.

---

## How to read this chapter

Two conventions run through every section.

**Blocking versus not.** An item is **blocking** if shipping without it either exposes customer data, makes a claim we cannot support, or produces an experience that destroys trust on first contact. Everything else is important but not blocking. Blocking items are not negotiable against a deadline, because the deadline is arbitrary and the exposure is not.

**Effort.** S is under a day. M is one to three days. L is one to two weeks. XL is more than two weeks or genuinely unknown. These are estimates for one person who already knows this codebase, which today means one person exists who can make them.

The status vocabulary is the one in `STYLE.md`: Shipped, Built-unproven, Partial, Planned, Idea.

---

## Part 1: Launch gates that require a human, not code

These cannot be closed by writing software. Every one of them requires a person to log into a dashboard, paste a value, click a button, or sign a document. They are listed roughly in the order they must happen.

### 1.1 Provision Supabase

**What.** Create the project, then run six SQL files in order, create one storage bucket, and configure one auth provider.

```
supabase/setup.sql                     -- private storage bucket `scan-docs`
supabase/schema.sql                    -- blocksmith_documents, blocksmith_api_keys
supabase/schema-orgs.sql               -- organizations, members, org_id on documents
supabase/schema-registry.sql           -- block registry entries, manifest, locks, pipeline runs
supabase/schema-governance-events.sql  -- violation feed
supabase/schema-deviations.sql         -- deviation queue (uncommitted branch)
```

Then, in the dashboard: create the **private** `scan-docs` bucket, and enable **Authentication, Providers, GitHub** with the production callback URL and site URL.

**Why it matters.** Without Supabase the application does not fail. It quietly degrades to a local JSON filesystem store under `data/cloud/` and `data/uploads/`, and on Vercel that filesystem is ephemeral. `instrumentation.ts` (repo root) warns at boot that "PRODUCTION without Supabase" means data persists to an ephemeral filesystem and will be lost. A user would scan a repository, get a wiki, and find it gone after a cold start. `docs/SUPABASE.md` is explicit about the specific consequence of missing `schema-registry.sql`: saves succeed but the Pipeline stays empty on production.

**Who does it.** Founder. It requires the Supabase account and the GitHub OAuth application, neither of which the code can create.

**What breaks without it.** Everything that must survive a serverless cold start: documents, ownership, API keys, orgs, the block registry, locks, and the promote history. This is the root gate. Nothing below matters until it is done.

**Blocking. Effort: M** (mostly waiting and careful checking, not typing).

### 1.2 Set environment variables in Vercel

**What.** The full set is documented in `docs/PRODUCTION-CHECKLIST.md` and partially in `.env.example`. The code reads fifty-eight distinct environment variables; `.env.example` documents fourteen of them. That gap is itself a debt item (see R8).

The minimum for a working multi-tenant deployment:

| Variable | Why |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public, client and server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret, server only. This key bypasses row-level security everywhere |
| `BLOCKSMITH_SAAS_STRICT` | See 1.3 |
| `BLOCKSMITH_ADMIN_SECRET` | Mints admin API keys, which bypass every ownership check |

**Who does it.** Founder, then verified by the cofounder reading the values back.

**What breaks without it.** Silent degradation, which is worse than a crash. The startup warnings in `instrumentation.ts` (repo root) are the only signal, and they appear in a log nobody is watching yet.

**Blocking. Effort: S.**

### 1.3 Set `BLOCKSMITH_SAAS_STRICT=1`

**This is the single most important line in this chapter.**

**What.** One environment variable in Vercel.

**Why it matters.** Read `src/lib/cloud/saas.ts` and then `src/lib/cloud/access.ts`. When strict mode is off, `requireDocumentAccess` does not check anything. It returns success with `userId: null` and `isAdmin: true`. Every ownership check in the product becomes a no-op. Person B can read Person A's design system by guessing a URL.

The default is derived from `NODE_ENV === "production"`, so in principle a production deploy is strict by default. Do not rely on that. Set it explicitly. There are two reasons. First, an explicit value is auditable and a derived one is not. Second, `src/middleware.ts` **re-implements the strict-mode logic by hand**, with a comment explaining that server-only code cannot be imported into middleware. Two copies of a security decision will drift, and when they drift the failure is silent and total.

**Who does it.** Founder sets it. Cofounder verifies it by attempting to read a document they do not own, from a second account, on production.

**What breaks without it.** There is no tenant isolation. This product hosts other companies' proprietary design systems. `docs/SECURITY-RELEASE-GATE.md` is correct to call the security gate a release blocker: a leaked wiki URL here is a data-exposure incident, not a UX bug.

**Blocking, and it is the number one gate. Effort: S** to set, **M** to verify properly.

### 1.4 Run the production build

**What.** `npm run build`, locally, to completion, before deploying.

Two traps. First, `scripts/guard-build.mjs` refuses to build while `npm run dev` is running, because building over an active dev server was producing missing-chunk 500 errors. Stop the dev server first. Second, `font-generator/` is a standalone nested Next.js application in this repository; it must remain excluded from the root `tsconfig`, or `typecheck` and `build` both fail on it. That exclusion is commit `60cdd31` and it is load-bearing.

**Who does it.** Either. It should become a CI step (see R7).

**What breaks without it.** A broken deploy discovered by a user rather than by us. Vercel builds on push, so the first person to find out is whoever visits the site.

**Blocking. Effort: S.**

### 1.5 Add the Sentry DSN and the Upstash keys

**What.** `NEXT_PUBLIC_SENTRY_DSN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

**Why it matters.** Sentry is wired across server, edge, client, and error boundaries, and it is a complete no-op until the DSN is set (`enabled: !!dsn`). Without it we have no idea when production breaks. Upstash is what makes rate limiting distributed; without it every serverless instance keeps its own in-memory bucket, so the effective limit is the configured limit multiplied by the number of live instances. It is also what powers the hosted dashboard metadata cache (`src/lib/dashboard/meta-cache.ts`), which degrades silently to coarse project cards when Redis is absent.

**Who does it.** Founder creates the accounts, either sets the values.

**What breaks without it.** We are blind to errors, and the AI endpoints have no meaningful spend ceiling.

**Blocking for Sentry, near-blocking for Upstash. Effort: S.**

### 1.6 Rotate every key that has ever been pasted in plaintext

**What.** An inventory of every credential this project has used, and a rotation of each one that has appeared in a chat window, a commit, a screenshot, or a document.

At minimum: the NVIDIA API key (the `font-generator-architecture` memory records that it was shared in plaintext once and should be rotated), the Supabase service role key, `BLOCKSMITH_ADMIN_SECRET`, any Figma personal access token used in testing, and any Upstash token.

There is a related item that is not a rotation but belongs in the same sweep. `data/cloud/api-keys.json` is **committed to git** and contains API key hashes, alongside `data/cloud/orgs.json` and `data/cloud/documents.json`. Hashes are not secrets in the way keys are, but committed live operational data is a category error and it should come out of the repository before it goes public.

**Who does it.** Founder, because the founder is the only one who knows where things were pasted.

**What breaks without it.** Nothing visible, until it does. `BLOCKSMITH_ADMIN_SECRET` mints API keys with `isAdmin: true`, and an admin key bypasses every ownership check in the product. That single value is equivalent to a master key over every customer's design system.

**Blocking. Effort: M.**

### 1.7 Choose and configure an email provider for invites

**What.** This gate is half-closed and the half that is done is uncommitted.

`src/lib/email/send-org-invite.tsx` uses **Resend**, with a React Email template at `src/emails/OrgInviteEmail.tsx`. It is a soft stub by design: no `RESEND_API_KEY` means it returns `{ delivered: false }` and the invite route tells the user "Invite saved. Configure RESEND_API_KEY to deliver email automatically." Twenty lines of library code, one template, one call site (`POST /api/v1/orgs/invite`).

What is missing is more interesting than the key. **The invite link carries no token and no expiry.** It is a bare `${origin}/?auth=required`. Membership is granted later, by `acceptPendingInvites` matching the GitHub account's email address against the pending invite. That is a design decision with real consequences: anyone who controls an email address at the invited domain can claim the membership, and an invite never expires.

**Who does it.** Founder creates the Resend account and verifies the sending domain (DNS records, so it needs domain access). Cofounder lands the branch and adds tokenised, expiring invites.

**What breaks without it.** Team invites are the only multi-user path in the product. Without delivery, the flow is "invite them, then message them separately and tell them to sign in", which is not a product.

**Blocking for teams, not for a single-user trial. Effort: S** to configure, **M** to make the invite model sound.

### 1.8 Finalize the legal documents with counsel

**What.** `src/app/terms/page.tsx` and `src/app/privacy/page.tsx` exist as drafts, added in commit `b103c82` and labelled as drafts in `docs/PRODUCTION-CHECKLIST.md`. They have not been reviewed by a lawyer.

One specific thing to fix: the terms page states that usage "may be rate-limited and metered". There is no metering code anywhere in this repository. Do not ship a term you do not implement.

Beyond the two pages, counsel is needed for the items in Part 7.

**Who does it.** Founder engages counsel. Nobody here should write this alone.

**What breaks without it.** We host other companies' intellectual property with no reviewed contract governing what we may do with it. That is not survivable in an enterprise conversation and it is not comfortable in any conversation.

**Blocking. Effort: M** of our time, plus counsel's timeline.

### 1.9 Remove the fabricated customer testimonials

**Listing this among the human gates because it is a decision, not a refactor.**

**What.** `src/components/home/HomeStudio.tsx` defines a `TRUSTED_LOGOS` array containing ten real company names (Figma, Linear, Vercel, Notion, Stripe, GitHub, Anthropic, Shopify, Cursor, Hugging Face), each paired with an invented quotation attributed to that company, rendered as a scrolling trust marquee on the public homepage.

**Why it matters.** None of these companies is a customer. None of them said these things. This is fabricated endorsement using third-party trademarks, on a live public site, and it will be the first thing a diligent investor or customer notices. It also undermines every true claim on the same page, which is the more expensive cost.

**Who does it.** Founder decides what replaces it. Cofounder should refuse to demo the site until it is gone.

**What breaks without it.** Credibility, permanently, on discovery. And potentially a trademark or false-advertising exposure that counsel would take seriously.

**Blocking. Effort: S.**

### 1.10 Build billing, which does not exist

**What.** There is no payment code of any kind. No Stripe, no plans, no quotas, no metering, no usage counters. Grepping the codebase for payment terms returns exactly three things: a `"Plan & Billing"` menu item in `src/components/nav-user.tsx` with no handler, a `{ title: "Billing", path: "#/billing" }` dead anchor in `src/components/app-shared.tsx`, and Stripe appearing as a logo in the fabricated trust marquee.

**Why it matters.** It is deliberately deferred (`docs/PUBLIC-RELEASE-SPRINT.md` lists Stripe under do-not-build until stranger-ready), and that deferral is correct. But two dead menu items promising billing is worse than no menu items. Either hide them or build it.

**Who does it.** Cofounder, when someone tries to pay.

**What breaks without it.** No revenue, and no forcing function on pricing. Also no quota system, which means the AI endpoints have an unbounded cost ceiling per user beyond the rate limits.

**Not blocking for launch. Blocking for revenue. Effort: L.**

### 1.11 Two operational gates that are easy to forget

**Apply the pipeline-runs migration.** `docs/RELEASE-TEST-PLAN.md` section 0 requires two additive columns on `blocksmith_pipeline_runs` (`status text not null default 'success'`, `log jsonb`). Without them, run console logs do not survive cold starts. Blocking for the run history feature, effort S.

**Run the two-person stranger security test.** `docs/SECURITY-RELEASE-GATE.md` item S9, an eight-step checklist executed by two people who did not write the access-control code, on production, with two accounts. It has never been run. This is the only thing that converts tenant isolation from Built-unproven to Shipped. Blocking, effort M, and it requires a second human by definition.

---

## Part 2: Engineering debt, ranked by risk

Ranked by the damage done when the thing fails, not by how much it irritates you to read.

### R1. The registry's source of truth is disk JSON with a cloud mirror

**Where.** `src/lib/ir/registry.ts`, `src/lib/ir/lock.ts`, `src/lib/ir/cloud-registry.ts`, `src/lib/runtime/writable-root.ts`.

**What.** Block versions and locks are written to a filesystem root, which is `.blocksmith/` locally and `os.tmpdir()/blocksmith` on Vercel, then mirrored into Supabase. On serverless, `/tmp` is per-instance and disposable, so the mirror is the only durable copy.

**Why it is the top risk.** Three compounding problems.

1. **Concurrent promotes race.** `docs/RELEASE-TEST-PLAN.md` states it plainly under known limitations: read-modify-write on registry entries has no cross-instance locking, so two humans promoting the same document in the same second can interleave. This is accepted at launch scale and it is not acceptable the moment a real team uses it.
2. **The mirror is partly fire-and-forget.** `src/lib/ir/cloud-registry.ts` batches pending entries into a `Map` and flushes on the next tick. A lambda that freezes after returning its response can lose that flush. The June hardening pass made promote, rollback, pin-lock, and finalize `await` persistence before responding, which fixed the worst case, but ingest runs from background scan contexts remain fire-and-forget.
3. **Lock hydration was broken once already.** Locks were mirrored but never read back, so a cold instance reported "No lock" after you had pinned one. `docs/RELEASE-TEST-PLAN.md` calls this "the my-lock-disappeared-overnight bug" and its test 3 the single most important test before release.

**Fix.** Move the source of truth into Postgres, with transactions and `select ... for update`. `docs/RELEASE-TEST-PLAN.md` names this post-release priority number one and explicitly warns against attempting it during a release week.

**Effort: XL. Blocking before the second concurrent promoter exists.**

### R2. `BLOCKSMITH_SAAS_STRICT` is a single point of failure with a duplicated implementation

**Where.** `src/lib/cloud/saas.ts`, `src/lib/cloud/access.ts`, `src/middleware.ts`.

**What.** One environment variable turns the entire authorization model on and off. When off, `requireDocumentAccess` returns admin access to everyone. The middleware cannot import the server-only module, so it re-implements the same logic by hand. Separately, `PUBLIC_DOC_PARAMS` in the middleware is a hardcoded set of three strings that must be kept in sync with `isPublicContent()` in `saas.ts`, and the code says so in a comment.

**Why it is risky.** Two hand-synced copies of a security predicate is a bug waiting for a deadline. And a single boolean that disables all authorization has no defense in depth behind it, because of R3.

**Fix.** Extract the strict-mode and public-content decisions into a single dependency-free module both sides import. Add a verify assertion that the two agree.

**Effort: M. Blocking.**

### R3. Tenant isolation is application code only

**Where.** `supabase/schema-registry.sql` and the other schema files.

**What.** Row-level security is enabled on the tenant tables but has **zero user-facing policies**, deliberately. The comment in the schema says service-role only, no anon or user policies on purpose. All database access goes through the service-role key, which bypasses RLS entirely.

**Why it is risky.** This is a legitimate architecture, but it means there is no second layer. Every isolation guarantee lives in `requireDocumentAccess` and `assertWikiDocAccess`. One forgotten call on one new route is a cross-tenant read. The middleware is a coarse backstop and `canAccessDocument`'s default-deny for unregistered documents is a good one, but neither is the database refusing to return the row.

`docs/PRODUCTION-CHECKLIST.md` already lists "row-level security on tenant tables (defense in depth behind app checks)" as an unchecked item. It is unchecked.

**Fix.** Write real RLS policies keyed on org membership, and make the application use a user-scoped client for reads where possible.

**Effort: L. Blocking before a Fortune 100 conversation, high priority before any customer.**

### R4. Rate limiting is optional, per-instance by default, fails open, and covers a minority of routes

**Where.** `src/lib/cloud/rate-limit.ts`, `src/lib/cloud/redis.ts`.

**What.** Three separate weaknesses stacked.

1. **Optional.** Without both Upstash variables, `getRedis()` returns null and the limiter falls back to a module-level `Map`. Every lambda instance gets its own budget.
2. **Fails open.** Any Redis error is caught and the request is allowed. The header comment is honest about this: a backend hiccup should never brick an endpoint. It also means a Redis outage silently removes all limits.
3. **Coverage.** Nine of the roughly fifty-nine API routes call the limiter: the two scan routes, four AI or ingest routes, and the four pipeline write routes. The rest have none, including `/api/figma/connect` (which makes outbound calls to Figma with a user-supplied token), `/api/wiki/import`, `/api/v1/orgs/invite` (which sends email), `/api/v1/auth/keys`, `/api/share/*`, and `/api/mcp`.

**Why it is risky.** The AI routes are the expensive ones and they are covered, which is the right first choice. But an unlimited invite endpoint is a spam relay, and an unlimited MCP endpoint is an unbounded read amplifier against Supabase.

**Fix.** Make Upstash required in production (fail the boot, not the request). Add limits to the write and outbound routes. Keep fail-open only for read paths.

**Effort: M. Near-blocking.**

### R5. Several stores have no cloud mirror at all, and two bypass the writable-root abstraction

**Where.**

| Store | Root | Mirrored? |
|---|---|---|
| `src/lib/public-share/store.ts` | `process.cwd()/data/public-share` | **No** |
| `src/lib/activity/store.ts` | `process.cwd()/.blocksmith/activity`, via `appendFileSync` | **No**, and it does not call `blocksmithWritableRoot()` |
| `src/lib/design-ir/store.ts` | `process.cwd()/.blocksmith` | **No**, and it does not call `blocksmithWritableRoot()` |

**Why it is risky.** `process.cwd()` is read-only on Vercel. These three write there. Public share links, the component activity feed, and the compiled design IR cache therefore either fail or evaporate in production. The first of those is customer-visible: a share link is something a user hands to someone else.

**Fix.** Route all three through `blocksmithWritableRoot()` and add Supabase mirrors, or delete the features that cannot be made durable.

**Effort: M. Blocking for public share links.**

### R6. The hosted code-generation endpoint cannot work, and fails misleadingly

**Where.** `src/lib/codegen/run.ts`, `src/lib/codegen/pulse.ts`, `src/app/api/v1/codegen/pulse/route.ts`.

**What.** Two independent defects in one path.

1. `CODEGEN_ROOT = join(process.cwd(), "packages", "generated")` and the generator does raw `mkdirSync` and `writeFileSync` into it. On Vercel that is read-only. `POST /api/v1/codegen/pulse` cannot succeed in production. It never calls `blocksmithWritableRoot()` and never mirrors to Supabase, so even if the write succeeded the artifact would vanish.
2. When it cannot resolve the caller's document, `run.ts` silently falls back to a committed fixture (`fixtures/vendor-ui/scan-snapshot.md`). The endpoint can therefore return a successful-looking package generated from **somebody else's design system**.

**Why it is risky.** Defect 2 is the serious one. A silent fixture substitution in a customer-facing endpoint is the kind of thing that gets found in a demo.

**Fix.** Write to the writable root, mirror to Supabase, and make the fixture fallback explicit and development-only.

**Effort: M. Blocking for the Phase 2 story.**

### R7. There is no test framework, and CI does not run the tests that exist

**Where.** `package.json`, `.github/workflows/`.

**What.** No vitest, jest, playwright, or testing-library anywhere. Zero `*.test.*` or `*.spec.*` files. No `npm test`. Verification is forty-one hand-written `tsx` scripts that log and `process.exit(1)`.

That is a defensible choice at this stage, and the scripts are genuinely good. The problem is what runs automatically. There are three CI workflows:

| Workflow | Trigger | What it runs |
|---|---|---|
| `protocol-conformance.yml` | PRs touching `packages/protocol/**`, `src/lib/ir/**`, `public/schema/**` | Conformance suite plus the hash drift gate |
| `validate-ui.yml` | PRs touching UI file types | Off-token color and lock freshness |
| `production-goals.yml` | Push to `main` | Production smoke, and it **exits 0 silently** if `vars.BLOCKSMITH_URL` is unset |

**Nothing in CI runs `npm run typecheck`, `npm run lint`, or `npm run verify:software`.** Worse, `verify:software` itself omits every check that touches a real external vendor: `verify:github-scan`, `verify:figma-import`, `verify:supabase`, `verify:cloud-api`, `verify:ir-cicd`, and `verify:design-ir` are all outside the aggregate.

**Why it is risky.** The company's stated quality bar is "a claim without a verify script is an opinion". That bar is only real if the scripts run without someone remembering to run them.

**Fix.** One workflow that runs `typecheck`, `lint`, and `verify:software` on every pull request. A second, credentialed, nightly workflow that runs the vendor-touching scripts. Make `production-goals.yml` fail loudly rather than skip when unconfigured.

**Effort: M. Blocking.**

### R8. Unmarked debt: 165 swallowed exceptions, no environment validation

**Where.** Everywhere.

**What.** There are **zero** `TODO`, `FIXME`, `HACK`, or `XXX` comments in `src/`, `packages/`, or `scripts/`. Zero `@ts-ignore`. Twelve `: any`. On the surface that reads as a clean codebase. It is not; the debt is simply unlabelled.

The actual markers are 165 `catch { }` blocks and 31 comments containing "best-effort", "optional", or "silently". Those are the FIXMEs. Each one is a decision to continue on failure, and collectively they are why a misconfigured production deploy looks healthy.

Separately, there is no environment validation. Fifty-eight distinct variables are read, with defaults inlined at each call site as `?? 8` and `?? 60`. There is no `env.ts`, no zod parse, no manifest. `.env.example` documents fourteen.

**Fix.** A validated environment module that fails fast at boot on anything required and missing. Then a pass over the catch blocks, converting the ones that hide real failures into logged or surfaced errors.

**Effort: L. Not blocking, high value.**

### R9. The output plane is roughly a twentieth of the control plane

**Where.** `src/lib/codegen/`, `src/lib/ir/targets/`, `packages/pulse-runtime/`.

**What.** Roughly nineteen thousand lines of control plane against roughly nine hundred of output plane. `device-sim.ts` is two hundred lines with three hardcoded frames and one hardcoded constant (`MIN_TOUCH_MM = 9`). `c-header.ts` is ninety-three lines and its output has never been compiled by any toolchain here. `packages/pulse-runtime` contains two components, `Surface` and `Text`, despite the MCP `pulse_codegen` tool description promising a `Button`. The `lvgl` entry in `packages/protocol/compile-targets.v1.json` has `"status": "stub"` and no `reference` field, because there is no file.

**Why it is risky.** This is the gap that costs credibility in a demo. The control plane is genuinely sophisticated and the thing it controls is thin. `/protocol/targets` is admirably candid about this, describing `lvgl` as "stubbed in the manifest and open for a weekend build" and advertising the small line counts as a feature. That candour is right for a spec site and wrong for a pitch, where the two are easily conflated.

**Fix.** See [Chapter 16](./16-the-plan.md), Stream C.

**Effort: XL overall, L for the first meaningful increment.**

### R10. Every vendor-facing code path is unproven against real input

**Where.** `src/lib/figma/rest.ts`, `src/lib/email/send-org-invite.tsx`, `src/lib/cloud/redis.ts`, the Sentry configs.

**What.** Each of these is tested only where it is pure.

- **Figma REST.** `scripts/verify-figma-import.ts` says in its own header that it is pure and deterministic and needs no live Figma credentials. `rest.ts` says the same: `extractFigmaFile` is pure and unit-tested, `fetchFigmaFile` is the thin network layer. The thin network layer has never made a call.
- **Resend.** No script exercises it.
- **Upstash.** No verify script touches it. Its failure mode (fail-open) is by construction untestable from inside.
- **Sentry.** Wired three commits before the last one. No `SENTRY_AUTH_TOKEN`, no source-map upload, no release tagging. Stack traces from production will be minified.

**Why it is risky.** "Built, unproven" is the most dangerous status in the book precisely because it looks identical to "Shipped" from the outside. Each of these is one afternoon and a real credential away from being resolved.

**Fix.** A credentialed nightly workflow (see R7) plus one manual live run of each, recorded.

**Effort: M total. Near-blocking for Figma, which is a stated wedge.**

### R11. The storage abstraction is a copy-paste convention, not an interface

**Where.** `src/lib/cloud/documents.ts`, `api-keys.ts`, `orgs.ts`, `governance-events.ts`.

**What.** Every store repeats the same branch by hand:

```ts
if (saasDbEnabled()) { await upsertDb(record); if (!localCloudStoreWritable()) return record; }
const store = readFileStore(); /* ... */ writeFileStore(store);
```

That pattern appears about six times in `documents.ts` alone. There is no `Store` interface, no shared base, no single place to change the dual-write semantics.

**Why it is risky.** It is the mechanism by which R5 happened: three stores drifted away from the convention because nothing enforced it.

**Fix.** One storage interface with two implementations, and a lint or verify check that no store reaches for `process.cwd()` directly.

**Effort: L. Not blocking.**

### R12. Repository hygiene

**What.** Four items in one bucket, because they share a cause.

- **Two hundred uncommitted paths** on an unpushed branch. Covered at length in [Chapter 16](./16-the-plan.md).
- **`ui/`**, an entire third-party design-system repository checked out into the working tree, complete with its own lockfile, turbo config, and license. This is dependency copying, and it has license-compliance implications (Part 7).
- **`font-generator/`**, a nested standalone Next.js application that must be excluded from the root `tsconfig` or the root build fails.
- **`packages/generated/acme-ui-kit`** is codegen output committed to git and wired into the root `dependencies` as a `file:` reference, with `scripts/ensure-pulse.mjs` running on `postinstall` and before every build. The production build therefore depends on the code generator succeeding.

**Why it is risky.** The last one is the sharp edge: a codegen regression breaks `npm run build`, not just `npm run codegen:pulse`.

**Fix.** Land the branch, remove `ui/`, decide whether `font-generator` belongs in this repository at all, and make `ensure-pulse` tolerant of failure during build.

**Effort: M. Blocking for the branch, S for the rest.**

### R13. Smaller items, listed so they are not lost

| Item | Where | Risk |
|---|---|---|
| Eight identical `react-hooks/exhaustive-deps` suppressions copy-pasted across wiki pages | `src/components/wiki/pages/*.tsx` | Stale closures in edit flows; a real class of subtle bug |
| A deprecated module kept alive for existing imports | `src/lib/ai/nvidia.ts` | Two AI client paths, one marked deprecated |
| A legacy lock path written in parallel with the new one | `src/lib/ir/lock.ts` | Two lock files can disagree |
| The chokidar watcher is started on every SSE connection | `src/lib/sync/watcher.ts`, `/api/sync/events` | Meaningless on serverless (it watches an ephemeral filesystem), and wasteful |
| Governance Tier 2 is heuristics with accepted false positives | `src/lib/governance/prose-lint.ts` | `inactive-link`, `stale-date`, `stale-address`. Fine at warn tier, embarrassing if promoted to block tier without a rule engine |
| No `sitemap.ts` despite `robots.ts` existing | `src/app/` | Minor |
| CSP allows `style-src 'unsafe-inline'` and `img-src https:` | `src/middleware.ts` | Weakens an otherwise good nonce-based policy |
| `manage_keys` requires only the `member` role | `src/lib/cloud/rbac.ts` | A member can mint API keys for the org |

---

## Part 3: Product gaps

What a real customer asks on day one that we cannot answer. Organised by who is asking.

### The design lead asks

| Ask | Our answer today |
|---|---|
| "Can my designers sign in? They do not have GitHub accounts." | **No.** GitHub OAuth is the only provider. `docs/PRODUCTION-CHECKLIST.md` lists more sign-in options as a P2 item. This blocks the primary persona |
| "Can I search the wiki?" | **No.** There is no search |
| "Can I get notified when someone promotes?" | **No.** No email digest, no Slack integration, no webhooks out |
| "Can someone review a promote before it goes live?" | **No.** Promote is a single-actor action gated by role, not an approval workflow |
| "Can I have a staging environment and a production environment?" | **Not yet.** `docs/TEAM-NORTH-STAR.md` describes environment channels as a v2 idea. Today draft and official are the only two pointers |
| "Does this work on my phone?" | **Partially.** Mobile is listed as P2 polish in `docs/PUBLIC-RELEASE-SPRINT.md` |

### The engineering lead asks

| Ask | Our answer today |
|---|---|
| "We are a Vue shop. / We are iOS and Android." | **No.** The scanner reads TSX, JSX, CSS, and SCSS. React is assumed throughout `src/lib/scan/` |
| "Re-scan automatically when we merge to main." | **No.** Git push webhooks are listed as open in `docs/GOAL-SAAS-STATUS.md`. The Figma webhook is uncommitted; there is no GitHub webhook |
| "Our design system spans four repositories." | **No.** Multi-repo support is in the icebox in `docs/07-experiments-backlog.md` |
| "Scan our private repos without giving you a personal token." | **Partially.** There is user OAuth for the browser path and a `GITHUB_TOKEN` server fallback. There is no GitHub App, which is what an enterprise will ask for |
| "Import our Tokens Studio / Style Dictionary output." | **No.** Storybook is the only external adapter. Tokens Studio is listed as future in `docs/PROJECT-PROTOCOL.md` |
| "Can we self-host?" | **Not cleanly.** The open-core split is documented but not extracted; see Part 7 |

### The buyer asks

| Ask | Our answer today |
|---|---|
| "How much does it cost?" | **We do not know.** No pricing, no plans, no billing |
| "SSO with Okta or Azure AD?" | **No.** P2 in `docs/SECURITY-RELEASE-GATE.md` |
| "SOC 2? A completed security questionnaire? A pen test?" | **No, no, and no** |
| "Send me your DPA. What is your data retention and deletion policy?" | **We have none** |
| "What is your uptime SLA? Where is your status page?" | **Neither exists** |
| "Can you delete all our data on request?" | **Not as a supported operation.** Project delete exists; a full-tenant erase does not |
| "Show me the audit log." | **Partially.** Pipeline runs are append-only with an actor, and governance events are recorded. Neither is exportable |

### The honest summary of Part 3

The product today fits one specific customer: a small React team that already uses GitHub, whose design system lives in one repository, who wants governance more than they want reporting, and who is willing to be an early design partner. That is a real customer and it is worth finding. It is also a much narrower customer than the pitch implies.

---

## Part 4: Proof gaps

The difference between a claim and a demonstration. Each row lists what we say, where we say it, whether we can show it live today, and what would have to exist to show it.

| Claim | Where it is made | Can we demo it live? | What would have to be built |
|---|---|---|---|
| "Design CI/CD. The wiki stops being documentation and becomes enforcement." | `docs/DESIGN-CICD.md`, `.github/workflows/validate-ui.yml` | **Only on our own repository.** | A `validate:ui` run that blocks a pull request in a repository we do not own. Requires a design partner and a current CLI release |
| "Agents physically cannot hallucinate your design system once you have promoted." | `docs/CEO-DIRECTIVE.md` | **Partially.** The enforcement code is real (`src/lib/ir/enforce.ts`, MCP serves pinned versions only). It has never been demonstrated against a live external agent | A recorded session: edit a draft, query MCP from Cursor, show the old version, promote, show the new one. Plus an assertion in `verify:mcp-sync` |
| "We removed N percent of design drift." | Implied by the whole governance pitch | **No.** No before-and-after measurement exists on any codebase | Two weeks of `blocksmith check` events from a real team, and a wiki view that renders the trend from `/api/v1/governance/events` |
| "Third parties run our conformance suite." | `docs/PROJECT-PROTOCOL.md`, definition of done | **No.** `@blocksmith/protocol` returns 404 on npm, and `/protocol` tells readers to install it | One `npm publish`, then one external emitter passing or failing the fixtures |
| "One team, one design system, one importable package." | `docs/TEAM-NORTH-STAR.md` | **Locally only.** `POST /api/v1/codegen/pulse` writes to a read-only filesystem on Vercel and can silently substitute a fixture | R6, plus auto-generation on promote, plus a lock-derived version |
| "Same IR compiles to hardware." | `docs/CEO-DIRECTIVE.md` section VI | **A browser div sized 240 by 240.** `tokens.h` is emitted and has never been compiled | An LVGL emitter and one artifact that builds in a real toolchain |
| "Enterprise RBAC and audit." | Sales language, flagged in `docs/SECURITY-RELEASE-GATE.md` as not to be claimed until the stranger test passes | **No.** The test has not been run | The two-person stranger security test, an exportable audit log, and RLS |
| "Multi-tenant, works at 700-engineer scale." | `docs/CEO-DIRECTIVE.md` section VII | **No.** Concurrent promotes race; rate limits are per-instance without Upstash | R1 and R4 |
| "Visualize works on production." | `docs/PUBLIC-RELEASE-SPRINT.md` P1 item 11 | **Unverified.** Vision latency is noted at roughly 60 to 75 seconds in `docs/PRODUCTION-CHECKLIST.md` | A production run inside the Vercel timeout, or an async job model |
| "Governance copilot." | `docs/GOAL2-GOVERNANCE-COPILOT.md` | **Only where `NVIDIA_API_KEY` is set.** `docs/GOAL-SAAS-STATUS.md` marks it optional on hosted | Set the key on Vercel, then verify |
| "Trusted by Figma, Stripe, Anthropic..." | `src/components/home/HomeStudio.tsx` | **This is an anti-proof.** It is fabricated | Deletion. See 1.9 |

**The pattern.** Almost every gap in this table is closed by the same three things: publish the packages, get one external design partner, and set the credentials we already have code for. None of them is a large engineering project. All of them require leaving the building.

---

## Part 5: Team and skills

### What the company cannot currently do

| Capability | Current state | Consequence |
|---|---|---|
| **Production operations** | Nobody owns uptime, on-call, backups, restore drills, or incident response. There is no staging environment | The first outage is discovered by a customer, and the first data-loss event has no recovery procedure |
| **Independent QA** | Every verification is written by the person who wrote the feature. `docs/SECURITY-RELEASE-GATE.md` and `docs/PUBLIC-RELEASE-SPRINT.md` both require sign-off by two people who did not build the thing, and that has never happened because there is only one builder | Blind spots are structural, not occasional |
| **Security review** | No external review, no pen test, no threat model document | We are asserting isolation without an adversarial check |
| **Embedded and RTOS engineering** | The founders have computer-engineering backgrounds, which is why the hardware story is credible as ambition. Nobody here has shipped firmware | Stream E cannot start, correctly |
| **Design partner sales** | No pipeline, no outreach cadence, no CRM. `docs/05-sprint-7-day.md` day 7 called for ten outreach messages. There is no record of the outcome | Every proof gap in Part 4 stays open, because they all need an external team |
| **Legal and finance operations** | The licensor in `LICENSE` is still a placeholder because no legal entity has been formed | Cannot sign a customer contract, cannot take money |
| **Technical writing for external audiences** | The internal documentation is voluminous. Customer-facing documentation is thin, and `docs/PUBLIC-RELEASE-SPRINT.md` P2 item 16 wants the friends guide brought in-app | Onboarding depends on a person being available |

### The first hires, in order

1. **The technical cofounder** (this reader). Not a hire, but the first and most important allocation. See the ownership table below.
2. **A design partner, not an employee.** The single highest-leverage next addition to the company is one real team using the product, not one more person building it. Every item in Part 4 is unblocked by this.
3. **A founding engineer with production platform experience**, when there is revenue. Someone who has run a multi-tenant service and will insist on backups, staging, and on-call before features. This is the gap that most reliably kills a two-person infrastructure company.
4. **An embedded contractor, not a hire**, and only once a hardware design partner exists. Stream E is demand-gated.
5. **Fractional counsel and a fractional accountant now.** These are not hires and they should not wait. Entity formation blocks revenue.

Deliberately not hired early: a designer (taste is a founder responsibility here and it is a stated product principle), a dedicated QA engineer (the verify culture plus a second builder covers it), a growth or marketing hire (there is no product-market fit to amplify yet).

### What the cofounder owns versus what the founder keeps

[Chapter 20](./20-your-first-ninety-days.md) proposes a split and this chapter should not contradict it. Restating it here with the gap list in view, because the gaps sharpen the reasoning:

| Area | Owner | Why, given this chapter |
|---|---|---|
| Platform: tenancy, storage, auth, rate limiting, deploy, CI | **Cofounder** | R1 through R7 are almost all platform. This is the largest concentration of risk and it needs one accountable owner |
| Output plane: codegen, compile targets, device | **Cofounder** | R9 is the largest single credibility gap and it is well-bounded engineering |
| Design IR semantics, hashing, versioning, lock | **Shared, with an explicit review requirement** | This is the moat. `docs/PROJECT-PROTOCOL.md` requires sign-off on hash and status semantics. Nobody changes it alone |
| Ingest: scan heuristics, Figma, adapters | **Founder initially** | It carries the most accumulated context about what real repositories look like |
| Wiki UX, visual language, product copy | **Founder** | Taste is a stated principle and needs a single authority |
| Positioning, pitch, customer conversations | **Founder, with the cofounder present** | The cofounder cannot make good technical calls without customer context |
| Legal, entity, vendor contracts, credentials | **Founder** | Requires accounts and signatures the cofounder does not have |
| Verify culture and the honest-status bar | **Shared, enforced by both** | It only works if nobody is exempt |

**Two things nobody owns today, and one of you must take each.**

- **The document-to-reality gap.** Roughly fifty planning documents, several making claims the code does not support. There is no process that forces a document to be downgraded when its subject slips. Assign an owner and a cadence.
- **The release process.** There is no defined sequence from merge to production to verification. `docs/RELEASE-TEST-PLAN.md` is an excellent one-off; it is not a process.

---

## Part 6: Infrastructure and vendors

### What we depend on

| Vendor | What it does for us | If it disappears for an hour |
|---|---|---|
| **Vercel** | Hosts the entire application | Total outage. No wiki, no API, no MCP |
| **Supabase** | Postgres (documents, orgs, keys, registry, locks, runs, governance events), Storage (`scan-docs` markdown), Auth (GitHub OAuth), Realtime (sync broadcast) | Total functional outage. Nobody signs in, no wiki content loads, no promote persists. **The single largest concentration of dependency in the company** |
| **GitHub** | OAuth identity provider **and** the source of scanned repositories (tarball download via Octokit) | Nobody can sign in, and nobody can scan. Two critical functions on one vendor |
| **NVIDIA (`integrate.api.nvidia.com`)** | Every AI feature: Visualize refinement, governance copilot, project generation from a prompt, vision-based generation from a screenshot, governed generation | Graceful. The code degrades to 503 or to deterministic output. This is the best-handled dependency in the system, with two-key failover and model-list failover |
| **Upstash Redis** | Distributed rate limits, hosted dashboard metadata cache | Silent. Rate limiting falls back to per-instance and fails open; dashboard cards get coarser |
| **Sentry** | Error monitoring | We go blind, and do not notice |
| **Figma REST** | The Figma import connector | The Figma wedge stops working |
| **Resend** | Org invite email | Invites save but do not deliver |
| **npm** | Distribution of the CLI, and eventually the protocol package | Nobody can install the client |

### What it costs

**The honest answer is that this repository does not record what any of it costs, and neither does any planning document.** `docs/06-roadmap.md` budgets exactly two things: LLM API credits at low volume, and a domain at roughly twelve dollars a year. That is the entire recorded cost model. `TODO: verify` the actual invoices and record them here.

What can be said structurally, because it follows from the code rather than from a price list:

- **Vercel plan tier is a hard functional requirement, not an optimisation.** Routes declare long `maxDuration` values: scan at 60 seconds, vision generation at 90, governed generation and AI layout at 120. `docs/PRODUCTION-CHECKLIST.md` notes that a Pro plan or better is needed for durations at or above 60 seconds. A free plan does not merely cost less, it breaks scanning.
- **Supabase cost scales with stored markdown and Postgres rows**, both of which grow linearly with customers and scans.
- **NVIDIA inference is the only genuinely variable cost**, and it is the one with no quota system behind it. Rate limits are the only ceiling, and without Upstash those limits are per-instance. An abusive user's cost is bounded by the limit times the instance count, which is not a number we control.
- **Upstash is pay-per-request**, and the metadata cache means dashboard loads generate requests.

### Single points of failure, ranked

1. **Supabase.** Data, identity, and storage in one vendor. There is no backup we take ourselves, no restore drill, and no export. If a Supabase project were deleted by accident, the company's customer data is gone.
2. **GitHub.** Identity and the primary ingest source. Also, `docs/SECURITY-RELEASE-GATE.md` gap G10 notes that GitHub-only sign-in is itself a product gap for the design persona.
3. **Vercel.** Standard hosting risk, mitigated only by the application being a fairly portable Next.js app.
4. **One person.** Every credential, every vendor account, and every piece of undocumented context sits with one founder. This is the real top-ranked single point of failure and it is why a documented credential inventory (1.6) matters beyond security.

### What we do not have

No backups we control. No restore drill. No staging environment. No status page. No on-call. No incident process. No runbook beyond `docs/PRODUCTION-CHECKLIST.md`, which is a launch checklist rather than an operations manual.

---

## Part 7: Legal, licensing, and open core

### The boundary as written

`LICENSING.md` defines an open-core split and marks its own status as **internal**: the boundary is being established and nothing should be pushed to a public remote or announced until meaningful product progress exists.

**MIT** (`LICENSE-MIT`), chosen because these are the adoption and standardization surfaces:

| Path | What |
|---|---|
| `packages/cli` | The `blocksmith` CLI |
| `packages/sdk` | The workspace SDK |
| `packages/protocol` | The Design IR, lock, and blocks spec plus JSON schemas |

**Intended open, extraction pending.** These are meant to be MIT but still live under `src/` and cannot compile independently of the proprietary application: `src/lib/figma` (import and drift), `src/lib/mcp` and `src/mcp` (the MCP server), `src/lib/scan` parsers, and `src/lib/governance/color-lint.ts` (Tier 1 lint).

**Business Source License 1.1**, converting to Apache-2.0 on the Change Date of 2030-06-23. **The default is proprietary: anything not explicitly listed as open is BSL.**

| Path | What |
|---|---|
| `src/app` | The Next.js application, dashboard, cloud wiki, auth, API routes |
| `src/lib/cloud` | Orgs, RBAC, multi-tenancy, document registry, rate limits |
| `src/lib/ai` | Governed generation, curation, drift scoring |
| `packages/pulse-runtime`, `packages/generated/*` | Runtime and generated kits |

The BSL Additional Use Grant permits production use except offering BlockSmith to third parties as a competing hosted or managed service.

**The reasoning, which is worth keeping.** The moat is intended to be a standard rather than a secret: if `design.md` plus the MCP becomes the interchange format for design governance, the ecosystem is the moat, and that requires the spec and the client to be freely adoptable. Developers will not trust a closed tool that sits in their repository and inside their AI loop. Willingness to pay lives in the hosted, collaborative, governed layer, which the BSL protects.

### What is still open in the rollout

From `LICENSING.md`, unchecked:

- Physically extract the intended-open libraries into `packages/*` so the open tree compiles standalone.
- Decide the repository strategy: split public and private repositories, or a monorepo with a filtered public mirror.
- Add SPDX headers (`MIT` on open paths, `BUSL-1.1` on proprietary).
- Consider Apache-2.0 rather than MIT for `packages/protocol`, because the patent grant matters more for a spec than for a client.
- A contributor policy, CLA or DCO, before accepting external contributions.
- Replace the licensor placeholder once a legal entity exists.

### What needs a lawyer

Ranked by exposure.

1. **The fabricated testimonials.** Ten real company names and trademarks paired with invented endorsements on a live public site. This is the item counsel will care about most and it should be removed before the conversation, not during it. See 1.9.
2. **Entity formation.** The BSL licensor is a placeholder. No entity means no enforceable license, no contract, and no revenue.
3. **Terms of service and privacy policy.** Drafts exist. They contain at least one claim we do not implement (metering). They govern the hosting of other companies' intellectual property.
4. **A data processing agreement, retention policy, and deletion policy.** Required by any customer with a compliance function, which is most of them.
5. **Third-party logo usage generally.** Even after the fake quotes are removed, displaying customer logos requires permission.
6. **The vendored `ui/` repository.** A full third-party repository with its own `LICENSE.md` sits in the working tree. Whatever its license, copying a project wholesale into a proprietary repository has obligations. Remove it or comply with it.
7. **The open-core split itself.** Whether the BSL Additional Use Grant is drafted the way we think it is, whether MIT or Apache-2.0 is right for the protocol, and what happens to contributions.
8. **Customer intellectual property handling.** What we may do with scanned design systems, whether we may use them to improve models or heuristics, and what the answer is in the terms today.

---

## Part 8: The prioritized backlog

One table, everything above, ordered. **Effort:** S under a day, M one to three days, L one to two weeks, XL more than two weeks. **Owner:** F founder, C cofounder, S shared, L counsel.

### P0: blocking launch

| # | Item | Why it matters | Effort | Owner | Blocking |
|---|---|---|---|---|---|
| 1 | Land the uncommitted branch, split into reviewable commits, typecheck and `verify:software` green | Nobody can reproduce the current state. Everything else is written against an unknown codebase | L | C | Yes |
| 2 | Provision Supabase: six SQL files, private `scan-docs` bucket, GitHub auth provider with production URLs | Without it, data lives on an ephemeral filesystem and disappears on cold start | M | F | Yes |
| 3 | Set all environment variables in Vercel | The app degrades silently rather than failing | S | F | Yes |
| 4 | **Set `BLOCKSMITH_SAAS_STRICT=1`** | Off means `requireDocumentAccess` grants admin to everyone. No tenant isolation at all | S | F | Yes |
| 5 | Remove the fabricated `TRUSTED_LOGOS` testimonials | Fabricated endorsement using real trademarks on a live public site | S | F | Yes |
| 6 | Run a clean `npm run build` and deploy | Otherwise a user finds the broken deploy first | S | S | Yes |
| 7 | Rotate every credential ever pasted in plaintext; remove `data/cloud/*.json` from git | `BLOCKSMITH_ADMIN_SECRET` is a master key over every tenant | M | F | Yes |
| 8 | Add `NEXT_PUBLIC_SENTRY_DSN` | We are blind to production errors without it | S | F | Yes |
| 9 | Add Upstash keys and make them required in production | Rate limits are per-instance and fail open without them | S | F | Yes |
| 10 | Apply the `blocksmith_pipeline_runs` status and log migration | Run console logs do not survive cold starts | S | F | Yes |
| 11 | Run the two-person stranger security test on production | The only thing that converts tenant isolation from Built-unproven to Shipped | M | S | Yes |
| 12 | Execute all nine sections of `docs/RELEASE-TEST-PLAN.md` on production, especially test 3 (lock survives cold start) | This was a real, previously-shipped data-loss bug | M | S | Yes |
| 13 | CI workflow running `typecheck`, `lint`, and `verify:software` on every PR | The quality bar is only real if it runs unattended | M | C | Yes |
| 14 | Fix the public-share, activity, and design-IR stores writing to `process.cwd()` | Read-only on Vercel. Share links are customer-visible | M | C | Yes |
| 15 | Finalize terms and privacy with counsel; remove the metering claim | We host customer intellectual property under unreviewed terms | M + counsel | F, L | Yes |
| 16 | Form the legal entity, replace the licensor placeholder | No entity means no enforceable license and no revenue | XL (external) | F, L | Yes |

### P1: before real users trust us with anything

| # | Item | Why it matters | Effort | Owner | Blocking |
|---|---|---|---|---|---|
| 17 | Extract strict-mode and public-content into one module both `saas.ts` and `middleware.ts` import | Two hand-synced copies of a security predicate will drift | M | C | No |
| 18 | Rate-limit the write and outbound routes: invite, import, keys, figma/connect, share, mcp | An unlimited invite endpoint is a spam relay | M | C | No |
| 19 | Write real Supabase RLS policies keyed on org membership | Today isolation has exactly one layer and no backstop in the database | L | C | No |
| 20 | Fix `POST /api/v1/codegen/pulse`: writable root, Supabase mirror, and make the fixture fallback development-only | The endpoint cannot succeed on Vercel and can return somebody else's design system | M | C | No |
| 21 | Configure Resend and add tokenised, expiring invites | Invite links today have no token and no expiry | M | S | No |
| 22 | Publish `@blocksmith/protocol`; cut a CLI release matching current code | `/protocol` instructs readers to install a package that 404s | S | C | No |
| 23 | One live Figma REST call with a real token, then a credentialed nightly verify workflow | The stated wedge has never touched the live API | M | C | No |
| 24 | Credentialed nightly CI for the vendor-touching verify scripts (`github-scan`, `figma-import`, `supabase`, `cloud-api`, `ir-cicd`, `design-ir`) | `verify:software` omits every check that touches a real vendor | M | C | No |
| 25 | Sentry source-map upload and release tagging | Production stack traces are minified and useless | S | C | No |
| 26 | Environment validation module that fails fast at boot | Fifty-eight variables, no schema, fourteen documented | M | C | No |
| 27 | Remove `ui/`; decide whether `font-generator/` belongs here; make `ensure-pulse` build-tolerant | A codegen regression currently breaks `npm run build` | M | C | No |
| 28 | `validate:ui` blocks a real pull request in a repository we do not own | The single highest-value unproven claim in the company | M + partner | S | No |
| 29 | Live MCP enforcement demo against a real agent, plus an assertion in `verify:mcp-sync` | The enforcement boundary has never been shown from outside | M | C | No |
| 30 | Non-GitHub sign-in (Google or email link) | The primary persona is designers, who often have no GitHub account | M | C | No |
| 31 | Documented credential inventory and vendor account list | Every account sits with one person. This is the top operational single point of failure | S | F | No |

### P2: scale, durability, and the next customer

| # | Item | Why it matters | Effort | Owner | Blocking |
|---|---|---|---|---|---|
| 32 | Move the registry source of truth into Postgres with transactions and row locking | Concurrent promotes interleave. Unacceptable the moment two people promote | XL | C | No |
| 33 | Auto-generate the package on promote, versioned by lock hash | Phase 2's definition of done | L | C | No |
| 34 | Widen faithful codegen coverage; extend `verify:pulse` each time | Closes the largest demo credibility gap | L | C | No |
| 35 | A real LVGL emitter; promote `lvgl` from stub to reference | The manifest currently advertises a target with no file | L | C | No |
| 36 | Drift dashboard in the wiki from `/api/v1/governance/events` | Turns enforcement into a number a customer will pay for | L | C | No |
| 37 | Git push webhook, auto re-scan | Listed open in `docs/GOAL-SAAS-STATUS.md`; every customer expects it | M | C | No |
| 38 | Storage interface replacing the copy-paste dual-write branch | The mechanism by which item 14 happened | L | C | No |
| 39 | Audit log export | Every buyer with a compliance function asks | M | C | No |
| 40 | Backups we control, plus a restore drill; a staging environment | We have no recovery procedure for our largest dependency | L | C | No |
| 41 | Wiki search | Asked on day one by every design lead | M | C | No |
| 42 | Sweep the 165 swallowed catch blocks; surface the ones hiding real failures | This is where the unmarked debt lives | L | C | No |
| 43 | Content-Security-Policy tightening (`style-src`, `img-src`) | Weakens an otherwise good nonce policy | S | C | No |
| 44 | Fix the eight copy-pasted `exhaustive-deps` suppressions in wiki pages | A real class of stale-closure bug in the edit flows | M | C | No |
| 45 | Complete the open-core extraction: move `figma`, `mcp`, `scan` parsers, `color-lint` into `packages/*`; add SPDX headers; decide repo strategy | The open tree cannot compile standalone, so the open-core claim is not yet true | L | C | No |
| 46 | Decide MIT versus Apache-2.0 for `packages/protocol` | The patent grant matters more for a spec than for a client | S + counsel | F, L | No |
| 47 | DPA, data retention, and deletion policy; tenant-wide erase as a supported operation | Required by any buyer with compliance | M + counsel | F, L | No |
| 48 | Billing, plans, and quotas | No revenue and no cost ceiling without it | L | C | No |
| 49 | SSO and SCIM | Enterprise procurement gate | XL | C | No |
| 50 | Async job model for vision generation (currently 60 to 75 seconds) | Sits uncomfortably close to the platform timeout | M | C | No |

### How to use this table

Do items 1 through 16 in order and do not start item 17 until they are done. That block is roughly two to three weeks of work and it is entirely unglamorous. It is also the difference between a repository and a company.

---

## Open questions

- **Is the fixture fallback in `src/lib/codegen/run.ts` a bug or an intentional demo affordance?** If intentional, it must be explicit and development-only. Right now it is silent and reachable in production, and it is the kind of thing that only becomes visible in front of a customer.
- **Should Upstash become a hard requirement in production, or should rate limiting fail closed instead of open?** Fail-open protects availability and removes the ceiling on spend. Fail-closed protects spend and can brick an endpoint on a Redis hiccup. There is no free answer, and the current one was chosen implicitly.
- **Does the open-core split survive contact with reality?** The extraction is unfinished and the intended-open libraries are entangled with the proprietary application. If extraction turns out to be a multi-week project, is the standard still the strategy?
- **What is the actual monthly infrastructure cost?** Nobody has written it down. Until someone does, pricing is guesswork.
- **Is GitHub-only authentication a temporary gap or a positioning choice?** It filters out exactly the persona the product is aimed at. It also keeps the identity story simple. Choose deliberately.
- **Who signs off that a claim may be made publicly?** Several claims in circulation are ahead of the code. There is no gate on this today, and this chapter is not a substitute for one.
- **When does the registry move to Postgres relative to the first external team?** [Chapter 16](./16-the-plan.md) leans toward before. Reasonable people would argue after, to learn faster. Decide it once and write it down.

## Where to look in the code

| Path | Why it matters to this chapter |
|---|---|
| `docs/PRODUCTION-CHECKLIST.md` | The canonical launch runbook. Part 1 of this chapter is an annotated version of it |
| `docs/SECURITY-RELEASE-GATE.md` | The release blocker, the route audit table, and the stranger security test |
| `docs/RELEASE-TEST-PLAN.md` | The most honest document in the repository. Read "known limitations" first |
| `LICENSING.md`, `LICENSE`, `LICENSE-MIT` | The open-core boundary and its unfinished rollout checklist |
| `src/lib/cloud/saas.ts` and `src/middleware.ts` | The strict-mode switch, and its hand-duplicated second copy |
| `src/lib/cloud/access.ts`, `src/lib/cloud/documents.ts` | `requireDocumentAccess` and the default-deny backstop |
| `src/lib/cloud/rate-limit.ts`, `src/lib/cloud/redis.ts` | The dual-mode limiter and its fail-open behavior |
| `src/lib/runtime/writable-root.ts` | The serverless filesystem abstraction, and the three stores that ignore it |
| `src/lib/ir/cloud-registry.ts` | The registry mirror, the batching, and the durability boundary |
| `src/lib/codegen/run.ts` | `CODEGEN_ROOT` under `process.cwd()`, and the silent fixture fallback |
| `src/components/home/HomeStudio.tsx` | `TRUSTED_LOGOS`. Delete before demoing |
| `src/lib/email/send-org-invite.tsx` | The Resend stub and the tokenless invite link |
| `.github/workflows/` | The three gates that exist, and by omission the ones that do not |
| `supabase/*.sql` | Six migrations, applied by hand, in order |
| `.env.example` | Fourteen of fifty-eight variables |

---

**Previous:** [Chapter 16](./16-the-plan.md) is the plan this chapter is measured against. **Next:** [Chapter 18](./18-decisions-and-tradeoffs.md) records why the settled decisions were settled, which is what you should read before proposing to reverse one of them.
