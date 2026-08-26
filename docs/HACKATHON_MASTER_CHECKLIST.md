# Hackathon master checklist — WebMCP Challenge

Single source of truth for the whole submission: every product, every artifact,
what is actually done, and what is not. Status words are used strictly:

| Status | Means |
|---|---|
| **Verified** | An automated check or a manual run proved it, and the evidence is named here |
| **Built** | The code exists and typechecks/builds, but nothing asserts its behaviour |
| **Partial** | Works for the demo path, has a named gap |
| **Missing** | Does not exist |
| **Blocked** | Cannot be finished without the repo owner (account, key, recording) |

Last full pass: 2026-08-26 · commit `30ad4d6` · `npm run typecheck`, `npm run build`,
`npm run verify:webmcp` all green.

> **Rule:** the project is not "ready" while any row in §1–§3 is Missing or
> Blocked. Blocked rows list exactly what the owner must do.

---

## 0. Ground truth — the numbers everything else must agree with

These are measured, not remembered. Any doc that states a different number is a
bug. `npm run verify:webmcp` asserts them.

| Fact | Value | How it was measured |
|---|---|---|
| Tools registered in the page | **13** | 10 dispatched + 3 page-only, `WikiAgentTools.tsx` |
| — server-dispatched | **10** | `WEBMCP_TOOLS` in `src/lib/webmcp/registry.ts` |
| — page-only | **3** | `propose_component`, `propose_design_change`, `get_current_context` |
| Remote MCP server tools | **16** | `BLOCKSMITH_MCP_TOOL_NAMES.length` |
| Presets shipped and publicly reachable | **4** | `PUBLIC_DOC_PARAMS` in `src/middleware.ts` |
| Portfolio components / colors | 11 / 9 | `loadDesignSystem("portfolio.md")` |
| Docs components / colors | 14 / 19 | `loadDesignSystem("docs.md")` |
| SaaS components / colors | 13 / 17 | `loadDesignSystem("saas.md")` |
| Apollo components / colors | 9 / 12 | `loadDesignSystem("apollo.md")` |
| Tool output cap | 1,500 chars | Chrome budget, clamped at 1,498 |

---

## 1. Judge-facing products — these decide the outcome

### 1.1 Design-system wiki (`/wiki`) — **the** demo surface

- **Purpose:** the reference a design team keeps; the page that hands an agent its rules.
- **User:** a judge with no setup, then a designer/engineer.
- **Critical journey:** open `/wiki?doc=portfolio.md` → browse Colour/Type/Spacing/Components → Governance → "Try a typical AI component" → see `REJECTED` with the rule quoted → switch `?doc=saas.md` → same code, different verdict.
- **Status:** **Verified** — builds; governance asserted per preset by `verify:webmcp`.
- **Acceptance:** loads with no auth, no key, no flag; rejection quotes the system's own sentence; switching systems changes the verdict.
- **Evidence:** `verify:webmcp` §"Governance per preset", §"Live tool output".
- **Gaps / risks:** first paint parses the system server-side — cold start on Vercel is the single biggest live-demo risk (§6.1).

### 1.2 In-page WebMCP tool surface — the thing being judged

- **Purpose:** hand the agent the rules as executable tools, bound to the doc on screen.
- **Critical journey:** agent calls `get_governance_rules` → writes a component → `propose_component` renders it on the human's screen and returns the verdict → `fix_violations` self-corrects.
- **Status:** **Verified** for budgets/behaviour; **Blocked** for real-client proof (§6.2).
- **Acceptance:** 13 tools register; every name/description/param inside Chrome's budgets; output clamped under 1,500; `readOnlyHint` on reads; `untrustedContentHint` on `capture_site_design`.
- **Evidence:** `verify:webmcp` §"Tool budgets", §"Output clamping".
- **Gaps:** never exercised in DevTools → Application → WebMCP, nor in ChatGPT's browser. Both are submission requirements.

### 1.3 Governance engine — the substance behind the claim

- **Purpose:** decide accept/reject and name the broken rule and its replacement.
- **Status:** **Verified**.
- **Acceptance:** compliant code passes and the classic AI card fails, per preset; auto-fix never increases violations, never rewrites clean code, is idempotent; composition contracts catch two primaries, self-nesting, missing required label.
- **Evidence:** `verify:webmcp` §"Auto-fix", §"Component contracts", §"Capability matching".
- **Gaps:** the five linters are composed inline inside `check_governance` rather than behind one shared entry point, so the Governance page and the tool can drift. `HACKATHON.md` marks a `runGovernance()` consolidation done; it does not exist. See §5.1.

### 1.4 Preset design systems (portfolio, saas, docs, apollo)

- **Purpose:** the product for anyone with no design system yet.
- **Status:** **Partial** — three verified, `apollo.md` publicly reachable but unguarded.
- **Acceptance:** every preset in `PUBLIC_DOC_PARAMS` is asserted by CI.
- **Evidence:** apollo confirmed working by hand (9 components, 12 colors, 6 violations on the AI card) but absent from the `PRESETS` table in `verify-webmcp.ts`.
- **Risk:** a judge follows TESTING.md, opens `?doc=apollo.md`, and lands on the one system nothing tests. **Fix in §5.2.**

### 1.5 Landing page (`/`)

- **Purpose:** explain the thesis before the judge reaches the wiki.
- **Status:** **Built** — `HomeStudio`, redirects signed-in users to `/dashboard`.
- **Gaps:** not reviewed against the "value in 60 seconds" bar this pass; no first-minute verification.

### 1.6 Submission artifacts

| Artifact | Status | Note |
|---|---|---|
| `README.md` | **Partial** | States "Fourteen tools, not fifteen" — both numbers wrong (13 / 16) |
| `docs/SUBMISSION.md` | **Partial** | Says "One page tool"; there are 3 |
| `JUDGING.md` | **Partial** | Hardcodes "12 agent tools live on this page"; it renders 13 |
| `TESTING.md` | **Partial** | Hardcodes "11 agent tools live on this page"; it renders 13 |
| MIT license, detectable | **Verified** | `LICENSE` present, MIT |
| `registerTool({...})` visible in README | **Verified** | Literal block present |
| Demo video (<3 min, public, audio) | **Blocked** | Owner must record |
| Pitch deck | **Missing** | |
| Demo script | **Missing** | No rehearsed, low-typing sequence exists |
| Live URL | **Blocked** | Not deployed; README says `_TBD_` |

> The four different tool counts are the highest-value fix in this document.
> A judge who reads two of these files finds a contradiction in under a minute,
> and every other number in the submission becomes suspect. **Fix in §5.1.**

---

## 2. Supporting products

| Product | Purpose | Status | Gap |
|---|---|---|---|
| Remote MCP server (`/api/mcp`, stdio) | Same rules in Cursor/Claude Code | **Built** | 16 tools; no count assertion |
| Cloud API (`/api/v1/*`) | Keys, orgs, deviations, scans | **Built** | `verify:cloud-api`, `verify:saas-acl` exist; not run this pass |
| Dashboard | Analytics, API keys, connectors, settings | **Built** | Not manually verified |
| Studio / Playground | Live component editing + governance | **Built** | Referenced in TESTING.md path 1 step 4 |
| Protocol site + `@blocksmith/protocol` | Interchange format | **Built** | `protocol:conformance` not run this pass |
| CLI `@block-smith/cli` | Login, scan, pull, wire MCP | **Built** | Not exercised |
| SDK `@blocksmith/sdk` | HTTP client | **Built** | Not exercised |
| Pulse codegen + runtime | Preset → real npm package | **Built** | `verify:pulse` in `verify:software` |
| Browser extension | Design capture → `/api/ingest/capture` | **Built** | Needs `NVIDIA_API_KEY`; unverified |
| Figma plugin | Variable import / drift | **Built** | Needs `FIGMA_ACCESS_TOKEN`; unverified |
| Share / public site pages | `/share/[id]`, `/sites/[slug]` | **Built** | Unverified |
| Demo routes | `/demo/investor`, `/demo/pulse`, `/demo/device` | **Built** | Unclear whether these are judge-facing or legacy |
| Evals | `evals/webmcp.evals.json` | **Built** | 10 cases, never executed against the CLI |

---

## 3. Demo reliability

| Requirement | Status | Note |
|---|---|---|
| Works with no auth / key / flag | **Verified** | Public doc allowlist in middleware |
| Deterministic demo account | **Missing** | No seeded account exists |
| Realistic preloaded data | **Partial** | Presets are excellent; cloud data is `data/cloud/*.json` |
| Resettable demo state | **Missing** | No reset script in `scripts/` |
| Graceful external-API failure | **Partial** | AI features hidden without a key; capture path untested offline |
| Backup path if a service fails | **Missing** | |
| Recorded fallback video | **Blocked** | Owner |
| Rehearsed low-typing sequence | **Missing** | |
| Full flow run repeatedly from clean state | **Not done** | |

---

## 4. Security & data integrity

| Item | Status |
|---|---|
| SSRF guard on `capture_site_design` | **Built** — localhost/private/169.254 refused, timeout + byte cap |
| `untrustedContentHint` on third-party content | **Verified** |
| Dispatch route refuses non-read-only tools | **Built** |
| Middleware credential gate + CSP nonce | **Built** |
| Default-deny document access | **Built** — `canAccessDocument` |
| **Supabase service role key rotation** | **Blocked — owner action, still outstanding** |

---

## 5. Backlog, in priority order

### 5.1 P0 — Reconcile every stated tool count, then make drift impossible
Four judge-facing files state four different wrong numbers. Correct them to
13 in-page / 10 server / 3 page / 16 remote, and add an assertion to
`verify-webmcp.ts` that reads the markdown and fails when a documented count
stops matching the registry. Correcting the prose alone re-opens the same hole
the next time a tool is added.

### 5.2 P0 — Guard the fourth preset
Add `apollo.md` to the `PRESETS` table in `scripts/verify-webmcp.ts` so every
publicly reachable system is asserted. Keep the allowlist and the test table in
agreement by deriving one from the other.

### 5.3 P1 — Deploy and put a real URL in the README *(Blocked — owner)*
Nothing in §1 can be judged without it. Everything else is secondary to this.

### 5.4 P1 — Demo script + deterministic reset
A written sequence with near-zero typing, and a script that returns the app to a
known state between run-throughs.

### 5.5 P1 — Prove the tool surface in a real client
DevTools → Application → WebMCP, and ChatGPT's in-app browser. Both are listed
as submission requirements and neither has been done.

### 5.6 P2 — Consolidate the linters behind one entry point
Remove the drift risk between the Governance page and `check_governance`, and
make `HACKATHON.md`'s claim true.

### 5.7 P2 — Run the suites not run this pass
`verify:software` (in flight), `protocol:conformance`, `verify:cloud-api`.

### 5.8 P3 — Decide what `/demo/*` is for
Either fold into the judge path or remove; ambiguity costs nothing to fix.

---

## 6. Risk register

### 6.1 Cold start on the deployed wiki
`/wiki/[[...slug]]` is 133 kB / 461 kB first load and parses the system
server-side. A judge's first impression is a spinner. Mitigate by warming the
route before the demo and pre-rendering the four presets if possible.

### 6.2 No proof the tools work in a real agent client
Everything is asserted through the registry and HTTP dispatch. If Chrome's
surface rejects a schema, no test here catches it. This is the largest gap
between "verified" and "demonstrable".

### 6.3 The submission contradicts itself
See §5.1. Cheapest fix in the list, disproportionate damage if left.

### 6.4 Breadth reads as unfinished
21 products with a verified core and an unverified periphery. A skeptical judge
who opens the CLI or the Figma plugin finds unexercised code. Either exercise
them or state plainly in the README which are hackathon scope and which are
prior work.

---

## 7. Stopping condition

Ready only when: §1 has no Partial/Missing/Blocked · §3 reset + backup path
exist · the flow has been run start-to-finish repeatedly from clean · the live
URL is in the README · the video is public · every number in §0 agrees with
every document.

**Current verdict: NOT READY.** Blocking items are §5.1, §5.2, §5.3, §5.4, §5.5,
and the key rotation in §4.
