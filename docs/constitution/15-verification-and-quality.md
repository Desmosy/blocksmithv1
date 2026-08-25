# How We Know It Works: The Verify Culture

**What this chapter covers:** Why BlockSmith has no unit test suite and instead has 32 executable `verify-*` scripts that assert real end-to-end behavior against real fixtures. The complete catalog of every one of them, what each proves, what each needs to run, and which are wired into the aggregate suite. The golden vendor fixture. The faithfulness guards that stop the codegen from silently degrading into stubs. The tenancy guards that stop one customer's design system from leaking into another's. The typecheck, lint, and build gates. The exact sequence to run before shipping. And a blunt list of what is not tested at all.

**Why it matters:** This is a pipeline product. The input is a repo you do not control, the output is a wiki, a package, and a lock file, and the transformation is a chain of parsers, extractors, mergers, and emitters. The failure mode of a pipeline is almost never a thrown exception. It is a silent degradation: the extractor stops recognizing a component shape, so the generator falls back to `<div>{children}</div>`, so the package still builds, still ships, still imports cleanly, and is worthless. A conventional unit test on `extractComponentInterface` would not have caught that, because the fallback is a legitimate code path. Only an assertion on the *output artifact* catches it. That is what the verify scripts are.

**Read this if:** You are about to write code in `src/lib/scan/`, `src/lib/codegen/`, `src/lib/ir/`, or `src/lib/cloud/`, or you are about to open a pull request, or you are about to ship to production and want to know exactly what to run and in what order.

---

## 1. Why verify scripts instead of unit tests

### 1.1 The honest situation

There is no test runner in this repo. Search for it yourself:

```bash
find src packages scripts fixtures -name "*.test.*" -o -name "*.spec.*"
# (no output)
```

Root `package.json` has no `vitest`, no `jest`, no `@playwright/test`, no `test` script. The only `*.test.ts` files anywhere on disk live in `ui/`, which is an untracked local clone of the shadcn/ui repository that somebody dropped into the working tree for reference. It is not our code. (It also causes a real problem, covered in section 6.3.)

What exists instead is `scripts/verify-*.ts`: 32 TypeScript files run with `tsx`, most of them under `--conditions=react-server` so they can import Next.js server modules and route handlers directly. Seventeen of them are chained into one npm alias, `verify:software`. Alongside them sit four more executable gates that are verify scripts in everything but name: `scripts/validate-ui.ts`, `scripts/governance-gate.ts`, `packages/protocol/conformance/run.ts`, and `packages/protocol/conformance/drift.ts`. Counting those and the four `scripts/ai-lab/` probes, you are looking at roughly forty runnable checks.

### 1.2 The case for

**They assert on artifacts, not on functions.** `verify:pulse` does not check that `generatePulsePackage` returns an object with the right keys. It runs the real codegen, runs `npm install`, builds the generated workspace package, then opens `packages/generated/acme-ui-kit/src/components/Card.tsx` on disk and greps it for `<section` and a `title` prop. That is the only kind of assertion that can tell the difference between "the generator ran" and "the generator produced something a customer would want."

**They catch the failure modes that actually happen here.** Three of them, specifically:

1. *Silent degradation to stubs.* The Pulse codegen has a legitimate fallback for components whose interface cannot be extracted. If extraction regresses, every component silently takes the fallback. Guarded by `verify:component-interface` (five real-world component shapes) and `verify:pulse` (four regex assertions on the generated files).
2. *Coverage loss in a scan.* `scanWorkspace` walks a repo and produces an inventory. If a glob or a classifier changes, files quietly stop appearing, and the published markdown still looks fine. Guarded by `scan:verify`, which recomputes the deterministic inventory and asserts that every single inventoried file path appears in the published `.md`.
3. *Tenant boundary leaks.* Access control here is a set of function calls that individual routes must remember to make. The failure mode is a route that forgets. Guarded by `verify:saas-acl`, `verify:security-gate`, and `verify:org-rbac`, which call the real route handlers and assert on real HTTP status codes.

**They run the real code path.** `verify:handshake-writeback` imports `POST as finalizePost` from `src/app/api/wiki/finalize/route.ts` and calls it with a real `NextRequest`. There is no mock of the finalize endpoint anywhere, because there is no need for one. The same is true for the pull route, the governance events route, and the wiki import route. If a route handler's signature or behavior changes, the verify script breaks at the call site.

**They double as documentation.** Read `scripts/verify-ir-cicd.ts` top to bottom and you have learned the entire Design IR lifecycle: ingest, stage, promote, lock, enforce, rollback, compile. Its comment header is the best one-screen description of that subsystem in the repo. New engineers are pointed at verify scripts before they are pointed at prose.

**They are cheap to write.** Every one is a flat script with a `main()`, an `errors: string[]` array, and `process.exit(1)`. No fixtures framework, no mocking library, no `beforeEach`. A new engineer adds one in twenty minutes.

### 1.3 The case against

Be equally honest here, because all four of these are real and none of them are hypothetical.

**They are slow.** `verify:pulse` alone shells out to `npm run codegen:pulse`, then `npm install --ignore-scripts`, then two workspace builds. `verify:github-scan` clones `shadcn-ui/ui` from the network. `verify:software` starts with a full `tsc --noEmit` over the whole repository. A full `verify:software` pass is minutes, not seconds. Nobody runs it in a watch loop, which means nobody runs it while writing code, which means it is a pre-commit ritual rather than a feedback loop.

**They are not isolated.** They share global mutable state: the same `data/uploads/` directory, the same `data/cloud/*.json` stores, the same `fixtures/vendor-ui/` working tree. `verify:saas-acl` deletes `data/cloud/documents.json` before it runs. `verify:org-rbac` deletes both `documents.json` and `orgs.json`. `verify:cloud-api` deletes `data/cloud/api-keys.json`. `verify:handshake-pull` contains this line, which is an admission in code:

```ts
if (Object.keys(beforePull).length > 0) {
  console.warn("  Note: sidecar had prior overrides; test continues");
}
```

Worse, several of those files are tracked in git. Run `verify:software` and then run `git status`, and you will see `fixtures/vendor-ui/DESIGN.md`, `fixtures/vendor-ui/scan-snapshot.md`, `data/cloud/documents.json`, `data/cloud/orgs.json`, `data/cloud/governance-events.json`, and `data/uploads/scan-acme-ui-kit.wiki-overrides.json` all modified. The committed `fixtures/vendor-ui/DESIGN.md` currently reads:

```markdown
## Button

**Role:** Handshake acceptance writeback role

Written by verify-handshake-acceptance.
```

That is not a fixture somebody authored. That is the residue of the last verify run, committed. The test suite writes to the repository, and the repository records it.

**They do not localize failures.** When `verify:vendor-e2e` prints `Parsed featured 3 !== scan 4`, you know that the scan and the parse disagree. You do not know whether the bug is in `scanWorkspace`, in `workspaceScanToMarkdown`, in `parseWorkspaceScanMarkdown`, or in the override merge that happens between them. Four modules are implicated by one failing assertion. A unit test on the parser would have told you in one line.

**Coverage is unmeasured and unmeasurable.** There is no coverage instrumentation and no way to add it without a runner. Nobody can answer "what percentage of `src/lib/scan/` is exercised." The honest answer is: the paths the vendor fixture happens to hit, and nothing else. The fixture has four primitives, one layout component, and eight CSS variables. Every branch that only triggers on a shape the fixture does not contain is untested by construction.

**They encode the fixture's quirks as requirements.** `verify:vendor-fixture` asserts `result.cssVars.length >= 6` and `featuredIds` containing exactly `button`, `card`, `badge`, `input`. Those numbers are properties of `fixtures/vendor-ui`, not properties of correctness. Change the fixture and you must change the script, which means the script is not independently verifying anything about the fixture.

### 1.4 When to start writing real unit tests

The verify-script strategy is correct for a pipeline whose value is end-to-end fidelity, and it should stay. But it should stop being the *only* strategy the moment any of these become true, and two of them already are:

| Trigger | Status | What to unit test |
|---|---|---|
| A pure module exceeds roughly 300 lines of branching logic | **True now** for `src/lib/scan/component-interface.ts`, `src/lib/parser/modify.ts`, `src/lib/figma/` | The parsers and extractors, directly, with table-driven cases |
| A bug is fixed twice in the same function | **Watch** | A regression case per bug, at the function level |
| A verify script takes more than 60 seconds | **True now** for `verify:pulse` and `verify:github-scan` | Split the fast assertions out of the slow harness |
| Two engineers are committing in parallel | **Not yet** (one builder) | Everything, because shared mutable fixtures will start colliding |
| Anything ships that a customer runs on their own machine | **True now** for `packages/cli/` | The CLI, which is currently excluded from typecheck entirely |

The concrete recommendation: add Vitest, keep every verify script exactly as it is, and write unit tests only for the pure functions in `src/lib/scan/component-interface.ts`, `src/lib/parser/`, `src/lib/figma/`, and `src/lib/ir/hash.ts`. Those four have no I/O, no Next.js dependency, and are where the subtle bugs live. Do not attempt to unit test the route handlers, the registry, or the codegen. The verify scripts already cover those better than mocks would.

---

## 2. The complete catalog

### 2.1 The aggregate suites

There are four aggregate aliases in `package.json`. Learn what each one composes, because the names do not tell you.

**`verify:software`** is the one you run. It is `typecheck` plus 17 verify scripts, in this exact order:

```
npm run typecheck
npm run scan:verify                  → scripts/verify-scan-coverage.ts
npm run verify:scan-wiki             → scripts/verify-scan-wiki.ts
npm run verify:wiki                  → scripts/verify-wiki-parse.ts
npm run verify:vendor-fixture        → scripts/verify-vendor-fixture.ts
npm run verify:vendor-e2e            → scripts/verify-vendor-e2e.ts
npm run verify:handshake-writeback   → scripts/verify-handshake-writeback.ts
npm run verify:handshake-pull        → scripts/verify-handshake-pull.ts
npm run verify:handshake-acceptance  → scripts/verify-handshake-acceptance.ts
npm run verify:sync-conflict         → scripts/verify-sync-conflict.ts
npm run verify:saas-acl              → scripts/verify-saas-acl.ts
npm run verify:security-gate         → scripts/verify-security-gate.ts
npm run verify:org-rbac              → scripts/verify-org-rbac.ts
npm run verify:governance-e2e        → scripts/verify-governance-e2e.ts
npm run verify:governance-tiers      → scripts/verify-governance-tiers.ts
npm run verify:mcp-sync              → scripts/verify-mcp-sync-status.ts
npm run verify:component-interface   → scripts/verify-component-interface.ts
npm run verify:pulse                 → scripts/verify-pulse.ts
```

It is a `&&` chain, so it stops at the first failure and you only ever see one broken thing at a time.

**`verify:workable`** is `verify:software` plus `verify:supabase`, `verify:cloud-api`, and `scripts/verify-workable.ts`. It requires live Supabase credentials, so it is not the default gate.

**`verify:goal1`** is the vendor-scan story: `verify:vendor-fixture`, `verify:vendor-e2e`, `verify-external-vendor.ts`, `verify-scan-backend.ts`. Note that the last two are invoked with a raw `tsx` command inside the alias and have no npm alias of their own.

**`verify:goal1:full`** is `verify:goal1` plus `verify:github-scan`, which needs the network.

### 2.2 Every script

Legend for the last column: **suite** = in `verify:software`; **goal1** = in `verify:goal1`; **workable** = in `verify:workable` only; **standalone** = you must run it by hand.

| Script | npm alias | What it proves | Requires | In aggregate |
|---|---|---|---|---|
| `verify-scan-coverage.ts` | `scan:verify` | Every file in the deterministic scan inventory appears in the published `.md`. Coverage cannot silently shrink. | `data/uploads/scan-acme-ui-kit.md` already on disk (gitignored, produced by `npm run scan:vendor`) | **suite** |
| `verify-scan-wiki.ts` | `verify:scan-wiki` | Scan facts, published markdown, and wiki parse all agree: inventory count, featured count, colors, `scanCoverage` frontmatter, `mode === "workspace-scan"`, every featured component carries scan metadata | Same published `.md`; prints `Run: npm run scan` and exits 1 if absent | **suite** |
| `verify-wiki-parse.ts` | `verify:wiki` | A comprehensive wiki markdown parses with doc-driven navigation, is detected by `isComprehensiveWikiMarkdown`, does not trigger parser assist, and yields 10 or more top-level nav items rather than the Apollo skeleton | `data/uploads/design-163e34fb.md` by default (gitignored) or a path argument | **suite** |
| `verify-vendor-fixture.ts` | `verify:vendor-fixture` | Pure in-memory scan of the vendor fixture: stable `workspaceId` and filename, 5 or more inventoried React files, 4 or more featured primitives (`button`, `card`, `badge`, `input`), `AppShell` inventoried but not featured, 6 or more CSS vars, parse round-trips | `fixtures/vendor-ui/` only. No I/O beyond reads. Fastest script in the repo. | **suite**, **goal1** |
| `verify-vendor-e2e.ts` | `verify:vendor-e2e` | The full persist path: `scanAndPersist` writes a real upload, the wiki parse of that file is consistent, the vendor snapshot lands at `.blocksmith/scan-snapshot.md`, and the scan was facts-only (no LLM curation) | Fixture; writes `data/uploads/` and `fixtures/vendor-ui/.blocksmith/`. Honors `BLOCKSMITH_WORKSPACE` to point at a real vendor repo. | **suite**, **goal1** |
| `verify-handshake-writeback.ts` | `verify:handshake-writeback` | Web to IDE writeback. Calls the real `POST /api/wiki/finalize` handler in process, then asserts the cloud sidecar, the vendor `.blocksmith/wiki-overrides.json`, and `fixtures/vendor-ui/DESIGN.md` all carry the finalized role, and that a rescan does not clobber it | Fixture; writes `DESIGN.md` and both override files | **suite** |
| `verify-handshake-pull.ts` | `verify:handshake-pull` | SaaS pull. Finalize, mint an API key, call `GET /api/v1/scans/pull`, assert `finalizedCount === 1`, that the payload does not leak catalog defaults, that `fullMarkdown` carries the whole catalog and the finalized governance, that `lock` is present, then replay the CLI writes into a temp dir and confirm `DESIGN.md`, `wiki-overrides.json`, and `blocksmith.lock` all land | Fixture; `packages/sdk/dist/design-md.js` must be built; writes `data/cloud/api-keys.json` | **suite** |
| `verify-handshake-acceptance.ts` | `verify:handshake-acceptance` | The three-way handshake. (1) IDE to Web: mutates `fixtures/vendor-ui/src/components/ui/Button.tsx` (`#ffffff` becomes `#fefefe`), rescans, asserts the marker reaches the published `.md` and that the facts hashes match. (2) Web to IDE: finalize with `promote: true`, assert all three artifacts exist. (3) MCP parity: `handleGetComponentDocs` returns exactly the role and description the wiki shows. Restores the fixture in a `finally`. | Fixture, mutated in place | **suite** |
| `verify-sync-conflict.ts` | `verify:sync-conflict` | The stale-draft gate. A rescan changes the doc hash, so a finalize with the old `baseContentHash` would conflict; `modifyMarkdownBlock` still works after restore; `getWorkspaceScanSyncStatus` does not report stale when hashes match | Fixture | **suite** |
| `verify-saas-acl.ts` | `verify:saas-acl` | Document ownership in strict mode. Owner A can read, owner B is denied, the admin key bypasses, an unauthenticated finalize returns 401, and a second owner claiming the same filename throws "owned by another team" | Deletes tracked `data/cloud/documents.json`; sets `BLOCKSMITH_SAAS_STRICT=1` | **suite** |
| `verify-security-gate.ts` | `verify:security-gate` | Default deny. Unregistered docs deny anonymous **and** signed-in non-owners; `scan-acme-ui-kit.md` and `apollo.md` stay public but `upload:scan-acme-ui-kit.md` does not; admin bypass preserved; anonymous `GET /api/wiki/import` returns 401 with no `uploads` array; publish grants anonymous read but never anonymous write, and unpublish closes it again | Deletes tracked `data/cloud/documents.json` | **suite** |
| `verify-org-rbac.ts` | `verify:org-rbac` | Roles and invites. `canPerform` matrix for viewer/member; invite by email then `acceptPendingInvites` links exactly one; org-scoped document access grants member write, viewer read-only, outsider nothing | Deletes tracked `data/cloud/orgs.json` and `documents.json` | **suite** |
| `verify-governance-e2e.ts` | `verify:governance-e2e` | Governance round trip with no LLM: finalize, pull with an API key, apply via the SDK's `updateDesignMd` into a temp workspace, assert the governance prose landed in `DESIGN.md` | Fixture; built SDK dist | **suite** |
| `verify-governance-tiers.ts` | `verify:governance-tiers` | The three-tier loop against `/api/v1/governance/events`. A snippet with an off-token hex and an inactive link produces at least one block-tier and one warn-tier finding, `governed === false`, the off-token finding carries a nearest-token suggestion, detect-without-record creates no event, record creates an open event, the feed lists it, and PATCH resolves it | Fixture; API key; writes tracked `data/cloud/governance-events.json` | **suite** |
| `verify-mcp-sync-status.ts` | `verify:mcp-sync` | `handleGetSyncStatus` returns a `workspaceScan` block with `isWorkspaceScan`, boolean `stale`, boolean `hostedRefreshOnly`, plus an `mcpNote` string | Fixture | **suite** |
| `verify-component-interface.ts` | `verify:component-interface` | The structural extractor survives five real component shapes: type alias with HTML attribute intersection, `FC<Props>` with an interface heritage chain, `forwardRef<Ref, Props>`, `memo(arrow)`, and a default-export function. Asserts variant unions, prop defaults, `hasChildren`, `rootElement`, and inherited props from base interfaces | Nothing. Pure string input. | **suite** |
| `verify-pulse.ts` | `verify:pulse` | The generated package builds and is faithful. Runs codegen, `npm install --ignore-scripts`, builds `@blocksmith/pulse-runtime` and `@blocksmith/acme-ui-kit`, then asserts `dist/index.js` exports `Button`, `src/tokens.css` has `--acme-accent`, and that `Card.tsx` still has a `title` prop and a `<section>`, `Input.tsx` an `<input>`, `Badge.tsx` a `label` prop | Network or warm npm cache; several minutes | **suite** |
| `verify-external-vendor.ts` | none (inline `tsx` call) | The scan works on a second repo shape. Runs on `fixtures/external-mini`, asserts a stable `scan-external-mini.md` filename, nonzero inventory, nonzero featured (with the hint that a missing `catalogPaths` in `blocksmith.config.json` is the usual cause), and workspace-scan mode | `fixtures/external-mini/`; honors `BLOCKSMITH_VENDOR_TEST_WORKSPACE` | **goal1** |
| `verify-scan-backend.ts` | none (inline `tsx` call) | The unified scan service and its path guards. `parseGithubUrl` splits owner and repo; both fixtures are allowed server workspace paths; `/usr` (or `C:\Windows`) is blocked and `runScanService` throws "cannot scan path"; a fixture scan reports `scanMode: "fixture"`; a client-side export uploads and reports `scanMode: "clientScan"` and parses as a wiki | Both fixtures | **goal1** |
| `verify-github-scan.ts` | `verify:github-scan` | Clone to wiki, for real. Clones `shadcn-ui/ui` (override with `BLOCKSMITH_VERIFY_GITHUB`), persists, asserts nonzero inventory, a `scan-` filename, `github-repo:` frontmatter, workspace-scan mode, and a nav with 2 or more groups. Prints clone and persist timings. Cleans up the clone. | Network, `git`, minutes | **goal1:full** |
| `verify-supabase.ts` | `verify:supabase` | Storage read/write actually works: rejects a publishable key mistaken for the service role, runs a health check, uploads a markdown file and downloads it back | `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; a real bucket | **workable** |
| `verify-cloud-api.ts` | `verify:cloud-api` | The cloud API modules without an HTTP server: mint and authenticate an API key, run `runScanApi({ fixture: "vendor" })`, assert filename and 4 or more featured, run `runPulseCodegen` and assert slug and 4 or more CSS vars, report whether the SDK dist exists | Deletes `data/cloud/api-keys.json`; fixture | **workable** |
| `verify-workable.ts` | `verify:workable` (also the aggregate) | The local product is assemblable: pulse codegen resolves, and six artifacts exist on disk (demo page, demo component, generated dist, pulse-runtime dist, fixture snapshot, codegen API route) | Built `packages/generated/` and `packages/pulse-runtime/dist/` | **workable** |
| `verify-design-ir.ts` | `verify:design-ir` | Golden values for the Design IR compiler. Three documents (Designmodo, User Interviews, Apollo) compile to exact `--wiki-accent`, `--wiki-bg`, `--wiki-text`, `--wiki-border`, `--wiki-nav-bg`, `--wiki-radius`, `--wiki-radius-card` values | Two gitignored uploads plus `docs/designs.md/apollo.md` | **standalone** |
| `verify-modify-tokens.ts` | `verify:modify-tokens` | About 25 assertions on the markdown writeback handlers. Editing a color token, a spacing token, a typography family, the introduction block, and an arbitrary section all round-trip through `parseApolloMarkdown`, siblings stay untouched, the CSS variable survives exactly once, and a missing target throws | `docs/designs.md/apollo.md` (tracked) | **standalone** |
| `verify-ir-cicd.ts` | `verify:ir-cicd` | 31 assertions covering the whole IR lifecycle on a synthetic doc ref: ingest auto-promotes scan facts but stages governance as draft; the lock is deterministic and pins only official blocks; unchanged re-ingest does not bump; an edit becomes draft v2 invisible to agents; promote advances the pointer and staleness is detected; a token re-scan auto-promotes because code wins; rollback returns the pointer while history stays append-only; a vanished block is staled not deleted; and the graph compiles to a device profile and a C header traceable to `block@version` | Nothing external. Uses a unique per-run doc ref so it never collides. | **standalone** |
| `verify-figma-import.ts` | `verify:figma-import` | About 50 assertions, the largest single script at 572 lines. Figma variable normalization (flat, nested-by-collection, and array payloads, RGBA floats to hex, bare numbers to px, unresolved aliases skipped); import to workspace-scan markdown and back through the parser; token drift with all four statuses (match, mismatch, figma-only, code-only); component surface normalization and component drift; design-context extraction for files with no variables at all; REST file extraction including named styles, annotations with node provenance, saved measurements, and render candidates; and the MCP handler path import to persist to drift, with cleanup | Nothing. Deterministic, no Figma credentials. | **standalone** |
| `verify-governance-copilot.ts` | `verify:governance-copilot` | The LLM drafts a non-empty role and description from a prompt plus scan context | `NVIDIA_API_KEY`, else prints SKIP and exits 0. Makes a live inference call. | **standalone** |
| `verify-patterns-live.ts` | `verify:patterns-live` | Eight live HTTP checks against a running dev server: `GET /api/v1/me`, the SDK's `client.me()`, `POST /api/v1/scans`, MCP `initialize` over HTTP, `client.createScan()`, `/demo/pulse` rendering `acme-ui-kit`, `client.codegen.pulse()`, and the presence of `packages/cli/dist/cli.js` | `npm run dev` on port 3000, built SDK, built CLI | **standalone** |
| `verify-mcp-accept.ts` | **none at all** | The remote MCP endpoint accepts an `initialize` call with Cursor-style `Accept: application/json, text/event-stream` headers | `npm run dev` on port 3000. Run with `tsx scripts/verify-mcp-accept.ts`. | **standalone** |
| `verify-production-smoke.ts` | `verify:production-smoke` | Against a deployed URL: `/` loads, `/wiki` loads, `/api/supabase/health` reports `storage.ok` | `BLOCKSMITH_URL`, else prints SKIP and exits 0 | **standalone** |
| `verify-production-goals.ts` | `verify:production-goals` | Against a deployed URL: the public demo wiki renders workspace-scan content, the scan API rejects anonymous requests with 401/403/400/429 and never 500, the MCP route is reachable and never 500, and `/api/v1/auth/keys/me` returns valid JSON with a 401 | `BLOCKSMITH_URL`, else SKIP. Run by CI on push to `main`. | **standalone** |

### 2.3 The adjacent gates that are not named `verify-*`

| Script | npm alias | What it proves | Where it runs |
|---|---|---|---|
| `scripts/governance-gate.ts` | `governance:check` | No **added** line in a changed `.ts/.tsx/.js/.jsx/.css/.scss` file introduces a hex color that is not in the design doc's palette. Only added lines, so pre-existing code is never flagged. Exit 2 if the doc cannot load. | `.githooks/pre-commit` |
| `scripts/validate-ui.ts` | `validate:ui` | The same off-token gate **plus** lock freshness: fails if `blocksmith.lock` is missing while a registry exists, or if the lock's graph hash no longer matches the promoted official graph. Exit 0 governed, 1 violations or stale, 2 setup error. | `.github/workflows/validate-ui.yml` on every PR touching UI files |
| `packages/protocol/conformance/run.ts` | part of `protocol:conformance` | 14 checks: valid fixtures validate with hash verification, invalid fixtures fail for the documented reason (including "draft in official graph"), golden hash vectors reproduce byte for byte, graph hash is order-independent, lock verification catches version mismatch and staleness | `.github/workflows/protocol-conformance.yml` |
| `packages/protocol/conformance/drift.ts` | part of `protocol:conformance` | The app's `src/lib/ir/hash.ts` and the package's `src/hash.ts` agree on golden vectors, and `public/schema/` matches `packages/protocol/schemas/` | Same workflow |

### 2.4 What breaking the important ones means

**`scan:verify` and `verify:scan-wiki`.** These are the coverage floor. If `scan:verify` fails, the published wiki no longer lists every React file the scanner found, which means a customer scanning their repo sees an incomplete inventory and concludes we missed half their codebase. This is the single most damaging first impression the product can make, because a design-system lead's first question is always "did you find everything?" `verify:scan-wiki` extends the same guarantee through the parser: it is not enough that the markdown contains the paths, the wiki must parse them back out at the same count.

**`verify:vendor-e2e`.** This is the proof that the scanner works on a repo that is not our own. It is easy to accidentally write a scanner that only works on BlockSmith's own `src/`, because that is what you have open. If this breaks, the core claim of the product ("point it at your repo") is unproven. Note the escape hatch built into it: `BLOCKSMITH_WORKSPACE=/path/to/vendor npm run verify:vendor-e2e` runs the same assertions against a real customer repo, with the fixture-specific checks skipped.

**`verify:handshake-acceptance`.** This is the only script that proves all three legs of the handshake in one run, and it is the only script that mutates real source and then asserts the mutation propagates. Its third leg, MCP parity, is the thesis of the company in an assertion: what the MCP tool returns for a component must be byte-identical to what the wiki shows. If that ever diverges, an agent is building against a different design system than the human approved, which is precisely the problem we exist to solve. The `docs/E2E-TEST-GUIDE.md` troubleshooting table calls the manual version of this a RELEASE BLOCKER, and it is right.

**`verify:pulse`.** See section 4. Breaking it means the generated package built successfully and is worthless.

**`verify:security-gate`.** See section 5. Breaking it means customer design systems are readable by strangers.

**`verify:ir-cicd`.** This asserts the promotion model itself. The check named `"draft agent-rule absent from official graph"` is the whole enforcement guarantee: a human staged an edit, and no agent can see it until a human promotes. If that assertion breaks, the product's governance claim is false while the UI continues to display green badges.

**`verify:component-interface`.** The five cases are not arbitrary. They are the five shapes we found in real customer-shaped repos that the naive extractor got wrong. Each one is a bug that shipped once. If a case fails, the extractor has regressed to returning `null` for that shape, and `verify:pulse` will fail downstream with a stub regression, which is the loud version of the same bug.

---

## 3. The golden fixture strategy

### 3.1 What `fixtures/vendor-ui` is

It is a synthetic vendor repository: a plausible, small, stable React design system that is not BlockSmith. Twelve tracked files:

```
fixtures/vendor-ui/
  blocksmith.config.json      { workspaceId, scanPaths, catalogPaths, exportSnapshot }
  package.json
  README.md
  DESIGN.md                   the writeback target
  scan-snapshot.md            the committed reference snapshot
  .gitignore                  ignores .blocksmith/
  src/app/globals.css         8 CSS variables, the token source
  src/components/ui/Button.tsx
  src/components/ui/Card.tsx
  src/components/ui/Badge.tsx
  src/components/ui/Input.tsx
  src/components/layout/AppShell.tsx
```

The config is four lines and it is load-bearing:

```json
{
  "workspaceId": "acme-ui-kit",
  "scanPaths": ["src"],
  "catalogPaths": ["src/components/ui"],
  "exportSnapshot": true
}
```

`workspaceId` is why the published filename is deterministically `scan-acme-ui-kit.md` rather than a content hash, which is what lets every other script hard-code that name. `catalogPaths` is why `AppShell` is inventoried but not featured: it is app chrome, not a design primitive, and `verify-vendor-fixture.ts` asserts exactly that distinction:

```ts
const shell = result.inventory.find((f) => f.filePath.includes("AppShell"));
if (!shell) errors.push("AppShell should be inventoried");
else if (shell.featured) errors.push("AppShell must not be featured (app chrome)");
```

That single assertion is the classifier's entire specification. There is a second, smaller fixture, `fixtures/external-mini` (a `Button` and a `Chip`), which exists so that `verify-external-vendor.ts` can prove the scanner is not overfitted to one repo shape.

### 3.2 The two snapshots, and why there are two

This confuses everyone once. There are two files named `scan-snapshot.md` under `fixtures/vendor-ui`:

| Path | Tracked | Written by | Read by |
|---|---|---|---|
| `fixtures/vendor-ui/scan-snapshot.md` | **Yes** | A human, by copying the generated one | `src/lib/codegen/run.ts` as `FIXTURE_SCANS[0]` |
| `fixtures/vendor-ui/.blocksmith/scan-snapshot.md` | No (`.gitignore` ignores `.blocksmith/`) | `publishScanMarkdown` in `src/lib/scan/run.ts` on every scan | `src/lib/codegen/run.ts` as `FIXTURE_SCANS[1]`; existence asserted by `verify-vendor-e2e` and `verify-workable` | 

The reason the tracked one exists is stated in a one-line comment in `src/lib/codegen/run.ts`:

```ts
/** Committed for CI/Vercel, because `data/uploads/*.md` is gitignored. */
```

`data/uploads/*.md` is gitignored, so on CI and on Vercel there is no scan document on disk. The committed snapshot is the fallback that lets `runPulseCodegen("upload:scan-acme-ui-kit.md")` succeed during `npm run build` on a fresh machine. It is a build input disguised as a test fixture.

Snapshot writing is skipped entirely on serverless (`canWriteWorkspaceSnapshot` in `src/lib/runtime/writable-root.ts` returns false for anything under `fixtures/` when `VERCEL=1`), because writing into a read-only deployment bundle would throw.

### 3.3 How the snapshot is regenerated

```bash
npm run scan:vendor
# = BLOCKSMITH_WORKSPACE=fixtures/vendor-ui AI_LAB_SCAN_CURATE=0 \
#   tsx --conditions=react-server scripts/scan-workspace.ts
```

`AI_LAB_SCAN_CURATE=0` is mandatory and every verify script sets it. It disables the LLM curation pass. Without it the scan output is nondeterministic and the fixture stops being golden. `verify-vendor-e2e.ts` asserts this defensively rather than trusting the environment:

```ts
if (persisted.curated) {
  errors.push("E2E vendor scan must be facts-only (AI_LAB_SCAN_CURATE=0)");
}
```

That writes `data/uploads/scan-acme-ui-kit.md` and `fixtures/vendor-ui/.blocksmith/scan-snapshot.md`. To refresh the tracked copy, copy the generated one over `fixtures/vendor-ui/scan-snapshot.md` and commit it.

### 3.4 Telling a real regression from an intended change

There is no snapshot diff tool. There is a diff you read with your eyes, and a rule for reading it. Run:

```bash
git diff fixtures/vendor-ui/scan-snapshot.md
```

Classify every changed line into one of three buckets.

**Bucket 1: environment noise. Always ignore.** Four frontmatter fields plus their prose echoes change on every machine and every run:

```
workspace-root:   absolute path, differs per checkout
scanned-at:       wall clock
git-commit:       whatever HEAD is
scan-facts-hash:  derived from the above, so it always moves
```

You can see this in the repo right now. The tracked snapshot says `workspace-root: /Users/koshish/BlockSmith/fixtures/vendor-ui` and the generated one says `/sessions/wonderful-nifty-allen/mnt/BlockSmith/fixtures/vendor-ui`. Nothing is wrong. Because `scan-facts-hash` is derived from fields that include the timestamp, **the hash is not a usable change detector**, which is a real weakness of the current snapshot design (see Open questions).

**Bucket 2: counts. Never ignore.** These four lines are the actual assertion surface:

```
inventory-tsx: 5
inventory-files: 6
featured-components: 4
- **Files read:** 6 (5 React, 8 CSS vars, 1 CSS rules, 0 utility classes, 14 hex entries)
```

If any number moves and you did not add or remove a file in `fixtures/vendor-ui/src/`, that is a scanner regression, full stop. A dropped CSS variable means the token extractor changed. A dropped React file means the inventory glob changed. A moved featured count means the classifier changed. These are exactly the failures `scan:verify` and `verify-vendor-fixture` exist to catch, which is why you should reach for those before reading the diff at all.

**Bucket 3: structure and content.** Section headings, table columns, token rows, the component library entries. A change here is intended if and only if you changed an emitter in `src/lib/scan/to-markdown.ts` in the same commit. If you did not, you have changed the wiki's shape by accident, and every customer's existing document will re-render differently on their next scan.

The practical rule: **never commit a snapshot change in the same commit as anything else.** A snapshot refresh should be its own commit with a message naming the emitter change that caused it. Otherwise the diff is unreviewable and the fixture stops being evidence.

The same rule applies to `fixtures/vendor-ui/DESIGN.md`, which the handshake scripts rewrite. Its current content is verify-run residue, and that is a bug of process, not of code (see section 8).

---

## 4. The faithfulness guards

### 4.1 Why output quality needs its own guards

Most systems fail loudly. This one fails quietly, and the reason is architectural rather than accidental.

The Pulse codegen takes a scanned component interface and emits a real React component. When the interface extractor cannot understand a component, the generator does not throw. It cannot throw, because a customer repo will always contain some component shape we have not seen, and refusing to generate anything would be worse than generating something generic. So it falls back to a stub, roughly `<div>{children}</div>` with pass-through props.

Now trace what happens if the extractor regresses. Every component takes the fallback. `npm run codegen:pulse` succeeds. `npm install` succeeds. `tsc` succeeds, because a div that accepts children is perfectly well typed. The package publishes. It imports cleanly. `import { Card } from "@blocksmith/acme-ui-kit"` works. Every test that checks "does the package build" passes. And the customer's `Card` renders a bare div with no title and no section element, and they conclude the product is a toy.

There is no exception anywhere in that chain. The only way to detect it is to assert on the shape of the emitted source. That is what a faithfulness guard is.

### 4.2 `verify:pulse` (`scripts/verify-pulse.ts`)

Two halves. The first half proves the package builds at all: run codegen, `npm install --ignore-scripts`, build `@blocksmith/pulse-runtime`, build `@blocksmith/acme-ui-kit`, then assert `dist/index.js` exists and contains `Button`, and `src/tokens.css` exists and contains `--acme-accent`.

The second half is the guard, and the comment in the source says exactly why it is there:

```ts
// Faithfulness guard: components must reflect their real interface, not the
// legacy `<div>{children}</div>` stub. Card carries a required `title` prop
// and renders a <section>; Input renders an <input>. If codegen ever falls
// back to generic stubs for IR-bearing components, these catch it.
const faithful: [string, RegExp, string][] = [
  ["Card.tsx",  /title\s*[:?]/, "Card lost its real `title` prop (stub regression)"],
  ["Card.tsx",  /<section/,     "Card no longer renders <section> (stub regression)"],
  ["Input.tsx", /<input/,       "Input no longer renders <input> (stub regression)"],
  ["Badge.tsx", /label\s*[:?]/, "Badge lost its real `label` prop (stub regression)"],
];
```

Four regexes against four files on disk. Crude, and exactly right: a regex on emitted source is the cheapest possible assertion that survives every refactor of the generator's internals. The three properties chosen are each a different kind of fidelity: a required prop (the interface survived), a non-`div` root element (the structure survived), and a semantic element (`<input>`, so the component is still the thing it claims to be).

The cost is real. This script runs `npm install` and two TypeScript builds. It is the slowest thing in `verify:software` by a wide margin, and it is last in the chain for that reason.

### 4.3 `verify:component-interface` (`scripts/verify-component-interface.ts`)

This is the upstream guard: if extraction breaks, `verify:pulse` will fail, but it will fail after four minutes with a confusing message about a missing `<section>`. This script fails in under a second with `forwardRef<Ref, Props>: size variants lost`.

Five table-driven cases, each a real component shape with a hand-written expectation function:

| Case | What it specifically defends |
|---|---|
| type alias with `ButtonHTMLAttributes<HTMLButtonElement> & {...}` | Intersection types; literal union variants (`"primary" \| "secondary"`); destructured defaults (`variant = "primary"` becomes `default: '"primary"'`); `rootElement === "button"` |
| `FC<PanelProps>` where `PanelProps extends BaseProps extends HTMLAttributes` | Following an interface heritage chain two levels up. Asserts `title` from `BaseProps` is not lost. |
| `forwardRef<HTMLInputElement, FieldProps>` | The generic argument order is `<Ref, Props>`, not `<Props, Ref>`. Getting this backwards yields `null`. |
| `memo(({ label, color = "gray" }: TagProps) => ...)` | An arrow function wrapped in a call expression, with no named function to anchor on |
| `export default function Hero(...)` | Default exports, where the component name comes from the filename rather than the export |

The header comment states the dependency explicitly: "Guards faithful codegen (PROJECT-PIPELINE / Pulse): if extraction regresses, the generator falls back to stubs and the 'pull a real UI kit' promise breaks."

Adding a sixth shape is the cheapest useful contribution anyone can make to this repo.

### 4.4 `scan:verify` (`scripts/verify-scan-coverage.ts`)

Forty-eight lines, one idea. Recompute the deterministic inventory from the fixture, read the published markdown, and assert set inclusion:

```ts
const result = scanWorkspace(FIXTURE_ROOT);
const { fileName } = workspaceScanToMarkdown(result);
const published = readFileSync(resolveUploadPath(fileName), "utf-8");
const missing = result.inventory.filter((f) => !published.includes(f.filePath));
if (missing.length > 0) { /* print up to 10 paths, exit 1 */ }
```

The check is deliberately one-directional. It proves nothing was **lost** between scanning and publishing. It does not prove nothing was added, and it does not prove the rows are correct. That is the right trade: the failure that actually happens is silent shrinkage, because that is what a stricter glob or a new exclusion causes. It counts published table rows and prints them for the human, but does not assert on that count.

`verify:scan-wiki` closes the loop on the other side, asserting that `parseWorkspaceScanMarkdown` recovers exactly `result.inventory.length` entries and exactly `result.components.length` featured components from the file. Together the two mean: what the scanner found, the file contains, and the parser recovers. All three counts equal, or the build fails.

---

## 5. The tenancy and security guards

These three exist because of a specific incident, documented in `docs/SECURITY-RELEASE-GATE.md`. `canAccessDocument()` used to contain, in effect, `if (!doc) return true`: a document with no ownership row was world-readable. Anyone who uploaded a design system without a registration row had published it. The doc calls this gap **G2** and rates it critical, and the whole document is titled a RELEASE BLOCKER.

The lesson encoded in the code afterwards is that access control here is opt-in per route. Every route must remember to call `requireDocumentAccess`. A new route that forgets is a leak. So the guards assert the **backstop** behavior, not just the route behavior.

### 5.1 `verify:saas-acl`

Sets `BLOCKSMITH_SAAS_STRICT=1`, wipes the document store, and asserts five things: registration records the owner; owner A can access; owner B cannot; the admin key bypasses (infrastructure needs a way in); an unauthenticated `POST /api/wiki/finalize` returns **401**, called against the real route handler; and a second owner registering the same filename throws an error containing "owned by another team".

**A failure means** the ownership model is broken. Either documents are not being attributed to owners, or the finalize route has lost its auth gate, or two tenants can collide on a filename and silently take over each other's document.

### 5.2 `verify:security-gate`

The default-deny guard, added in direct response to G2. Five phases:

1. An unregistered private doc denies **both** an anonymous caller and a signed-in non-owner. Two separate assertions, because the original bug allowed both.
2. `isPublicContent` allows exactly `scan-acme-ui-kit.md` and `apollo.md`, and specifically **rejects** `upload:scan-acme-ui-kit.md`. The doc-ref prefix must not be a way to smuggle a private path past the public allowlist.
3. Admin key bypass still works.
4. Anonymous `GET /api/wiki/import` returns 401 **and** the body has no `uploads` key. Two assertions, because returning 401 with a populated body would still leak the cross-tenant filename list.
5. Opt-in publishing is a read grant only: publish makes it anonymously readable, an anonymous **write** is still denied, and unpublishing closes read access again.

**A failure means** stop and treat it as a security incident, not a test failure. Specifically: if phase 1 fails, every unregistered document on the deployment is public. `docs/SECURITY-RELEASE-GATE.md` says it plainly: "no design-partner uploads of real design systems. No Fortune 100 pilot. No 'we're live' marketing."

### 5.3 `verify:org-rbac`

The team layer. Asserts the role matrix (`viewer` reads but does not write, `member` writes), that `inviteOrgMember` followed by `acceptPendingInvites` links exactly one invite by email match, that the accepted member's role is `member`, and then the four-way document access matrix: member writes, viewer cannot write, viewer reads, outsider gets nothing.

**A failure means** either an invited teammate cannot see the org's documents (annoying) or a viewer can promote to production (severe: a read-only account can move the official pointer that agents and CI follow).

### 5.4 What these three do not cover

Be precise, because the security doc is precise. They are unit-level assertions on `canAccessDocument`, `canPerform`, and four route handlers called in process. They are **not** a route audit. `docs/SECURITY-RELEASE-GATE.md` says so directly in its inventory table: "Verification: `npm run verify:saas-acl`, `verify:org-rbac`. Unit-level; not full route audit."

There is no automated test that enumerates every route under `src/app/api/` and asserts each one gates. The route audit is a hand-maintained table in that document. There is also `src/middleware.ts` as a coarse backstop on `/api/v1/*` and mutating `/api/wiki/*`. And the S9 line item, "stranger security test on production by two non-builders," is still marked red and unrun.

---

## 6. Typecheck, lint, and the build guard

### 6.1 Typecheck is the first gate

`verify:software` starts with `npm run typecheck`, which is `tsc --noEmit` against the root `tsconfig.json`. It is first so that a type error never gets misreported as a runtime verify failure four minutes later.

The standard is zero errors. `docs/E2E-TEST-GUIDE.md` step 0.3 says "clean". `docs/RELEASE-TEST-PLAN.md` section 9 says "must be clean". `docs/PRODUCTION-CHECKLIST.md` records the last time it was made clean as a shipped item.

### 6.2 The exclusion list

```json
"exclude": ["node_modules", "packages/cli", "packages/sdk", "font-generator"]
```

Two of these deserve explanation.

**`font-generator`** is a git submodule containing a separate Next.js application with its own dependency tree and its own conventions. It was breaking both `typecheck` and `build` in the parent repo. Commit `60cdd31` ("fix(build): exclude nested font-generator app from root tsconfig") added the exclusion, and `docs/PRODUCTION-CHECKLIST.md` records the outcome: "Build unblocked, excluded the nested `font-generator` app from the root tsconfig (it was failing `typecheck`/`build`); `verify:software` is green." This is the right call for a nested submodule. It is not the right call for the other two.

**`packages/cli` and `packages/sdk`** are excluded because they build with their own `tsconfig.json` files and their own module targets. The consequence is that **`npm run typecheck` does not check the CLI or the SDK at all.** `packages/cli/package.json` has its own `typecheck` script and nothing invokes it. `packages/sdk/package.json` does not even have one; its only type checking is whatever `npm run build` (a bare `tsc`) does. This matters more than it looks, because the CLI is the one artifact customers run on their own machines.

### 6.3 The state of typecheck right now

Run `npx tsc --noEmit` in this working tree today and it is not clean. Three errors in tracked source:

```
src/components/app-header.tsx(7,38): error TS2307: Cannot find module
  '@/components/custom-sidebar-trigger' or its corresponding type declarations.
src/components/examples/c-dialog-1.tsx(20,26): error TS2322:
  Property 'render' does not exist on type '... DialogTriggerProps ...'
src/components/examples/c-dialog-1.tsx(46,28): error TS2322:
  Property 'render' does not exist on type '... DialogCloseProps ...'
```

And then 11,272 more error lines from `ui/`, the untracked shadcn/ui clone sitting in the working tree. It produces errors because the root tsconfig's `include` is `["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"]` and `ui/` is neither in `exclude` nor in `.gitignore`. On a clean clone the directory does not exist and the problem vanishes, which is why nobody noticed. Two fixes, both trivial: add `ui` to `.gitignore`, and add `ui` to the tsconfig `exclude` list so a future scratch checkout cannot do this again.

Because `verify:software` starts with `typecheck`, **`verify:software` cannot currently pass in this working tree.** Fix the three real errors and the `ui/` exclusion before treating the suite as a gate.

### 6.4 Lint

`npm run lint` maps to `next lint`, and `eslint.config.mjs` is four effective lines:

```js
export default compat.extends("next/core-web-vitals");
```

No custom rules, no import ordering, no complexity limits, no unused-export detection. And, more importantly: **lint is not wired into anything.** It is not in `verify:software`. It is not in `.githooks/pre-commit`. It is not in any GitHub workflow. It is a command that exists and that nobody is required to run. Treat lint as advisory today. Typecheck is the real static gate.

### 6.5 The build guard

`npm run build` is three steps:

```
node scripts/guard-build.mjs && node scripts/ensure-pulse.mjs && next build
```

**`scripts/guard-build.mjs`** refuses to build while `next dev` is running. Twenty-seven lines, one `pgrep`:

```js
if (process.env.VERCEL === "1" || process.env.CI === "true") process.exit(0);
const running = execSync("pgrep -fl 'next dev' 2>/dev/null || true", ...).trim();
if (running) { /* print instructions, exit 1 */ }
```

The reason is in the comment: building over an active dev server corrupts `.next` and produces Internal Server Errors and "Cannot find module './611.js'" chunk failures in the browser. That failure is confusing enough, and cost enough time, that it earned a dedicated guard. It is skipped on CI and Vercel because `pgrep` can false-positive on build machines and a false positive there would break every deploy.

Its sibling is `scripts/dev.mjs`, which is `npm run dev`. It kills stale `next dev` processes, frees ports 3000 and 3001, and then detects two corrupted-cache conditions and wipes `.next` automatically: production build artifacts left behind (`.next/BUILD_ID` present), and stale webpack chunks (it walks `.next/server/**` for `require("./NNN.js")` references and checks each one exists on disk). Together, `guard-build.mjs` and `dev.mjs` are a two-sided guard against the same class of local corruption: one refuses to create it, the other cleans it up.

**`scripts/ensure-pulse.mjs`** runs on `postinstall` and before every build. If `packages/generated/acme-ui-kit/dist/index.js` does not exist, it runs `npm run build:pulse`. `packages/generated/` is gitignored, so on a fresh clone or a CI machine the generated package does not exist and the app will not compile without it. This is why the committed fixture snapshot from section 3.2 has to exist.

### 6.6 Git hooks

`.githooks/pre-commit` runs six gates in order: `scan:verify`, `verify:scan-wiki`, `verify:vendor-e2e`, `verify:handshake-writeback`, `verify:handshake-acceptance`, `verify:sync-conflict`, then `governance:check`. On governance failure it prints the bypass instruction (`git commit --no-verify`).

`.githooks/post-commit` runs `activity:from-commit`, appending real commit activity to the BlockSmith ledger.

Both require one-time opt-in:

```bash
git config core.hooksPath .githooks
```

**It is not currently enabled in this checkout.** `git config core.hooksPath` returns empty. The hooks are documentation until somebody runs that line. Note also that the pre-commit set is a subset of `verify:software` chosen for speed, and it deliberately omits the security guards.

### 6.7 CI

Three workflows in `.github/workflows/`, and the notable thing is what is missing.

| Workflow | Trigger | Runs |
|---|---|---|
| `validate-ui.yml` | PR touching `**/*.{ts,tsx,js,jsx,css,scss}` or `blocksmith.lock` | `npm run validate:ui -- --range "origin/<base>...HEAD"` with `fetch-depth: 0` |
| `protocol-conformance.yml` | PR or push to main touching `packages/protocol/**`, `src/lib/ir/**`, `public/schema/**` | `npm run protocol:conformance` |
| `production-goals.yml` | Push to `main`, or manual | `sleep 60`, then `npm run verify:production-goals` against `vars.BLOCKSMITH_URL` |

**No workflow runs `typecheck`. No workflow runs `verify:software`. No workflow runs `lint`. No workflow runs `next build`.** Vercel builds on push, which is the only thing catching a broken build, and it catches it after merge rather than before. `docs/SECURITY-RELEASE-GATE.md` item S10 tracks this explicitly: the verify scripts exist and are in `verify:software`, but "wire into CI workflow" is still an open box.

The `production-goals` workflow SKIPs (exit 0) when `BLOCKSMITH_URL` is unset, by design, so an unconfigured repository variable is silently the same as a passing gate.

---

## 7. The release checklist

Assembled from `docs/E2E-TEST-GUIDE.md` Part 9, `docs/RELEASE-TEST-PLAN.md` section 9 and its release checklist, `docs/SECURITY-RELEASE-GATE.md` verification commands, `docs/PRODUCTION-CHECKLIST.md` sections 6 and 7, and `docs/TESTING-FIGMA-FUSION.md` section E. Run in this order. Later steps depend on earlier state.

### Stage 0: local, before you touch anything

```bash
npm install
npm run typecheck                 # must be zero errors
npm run build:packages            # @block-smith/cli + @blocksmith/sdk
npm link -w @block-smith/cli      # puts `blocksmith` on PATH
blocksmith --help                 # sanity
```

### Stage 1: the software gate

```bash
npm run scan:vendor               # required first: verify:software's first two
                                  # scripts read data/uploads/scan-acme-ui-kit.md,
                                  # which is gitignored and may not exist
npm run verify:software           # typecheck + 17 scripts, several minutes
```

If you touched the IR, the protocol, or the schemas:

```bash
npm run verify:ir-cicd            # 31 checks on the closed loop
npm run protocol:conformance      # conformance suite + hash drift gate
```

If you touched the Figma path:

```bash
npm run verify:figma-import       # about 50 checks, no credentials needed
```

If you touched the parser or the markdown writeback:

```bash
npm run verify:modify-tokens
npm run verify:design-ir
```

Then reset the working tree damage the suite caused:

```bash
git status                        # expect: fixtures/vendor-ui/DESIGN.md,
                                  # fixtures/vendor-ui/scan-snapshot.md,
                                  # data/cloud/{documents,orgs,governance-events}.json
git checkout -- fixtures/vendor-ui data/cloud    # unless a change is intended
```

### Stage 2: live local

```bash
npm run dev                       # separate terminal, port 3000
npm run verify:patterns-live      # 8 live HTTP checks: API, SDK, MCP, /demo/pulse, CLI
tsx scripts/verify-mcp-accept.ts  # Cursor-style MCP initialize headers
```

### Stage 3: security, before any deploy that will hold customer data

```bash
BLOCKSMITH_SAAS_STRICT=1 npm run verify:saas-acl
npm run verify:security-gate
npm run verify:org-rbac
npm run verify:governance-e2e
```

### Stage 4: build and deploy

```bash
# stop `npm run dev` first, because guard-build.mjs will refuse otherwise
npm run build                     # must pass clean
```

Before deploying, confirm from `docs/PRODUCTION-CHECKLIST.md`:

- `BLOCKSMITH_SAAS_STRICT=1` is set on Vercel. Without it, tenants can read each other's documents.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `BLOCKSMITH_ADMIN_SECRET` present.
- `supabase/schema.sql` and `supabase/schema-orgs.sql` applied; the `scan-docs` bucket is private.
- Any pending migration applied. `docs/RELEASE-TEST-PLAN.md` section 0 has the two additive columns on `blocksmith_pipeline_runs` (`status`, `log`); skipping it means console logs do not survive a cold start.
- Upstash variables present, or accept per-instance rate limiting.

### Stage 5: post-deploy

```bash
BLOCKSMITH_URL=https://<prod> npm run verify:production-smoke
BLOCKSMITH_URL=https://<prod> npm run verify:production-goals
```

Then the manual passes that no script covers:

- `docs/RELEASE-TEST-PLAN.md` sections 1 through 8 on production, 30 to 40 minutes. The one that must not be skipped is section 3, lock hydration across a cold start, described as "the single most important test before release, it was the 'my lock disappeared overnight' bug."
- `docs/E2E-TEST-GUIDE.md` Part 4.2 step (e): stage a draft without promoting, then ask MCP for that component. The agent must see the promoted version only. The guide says "if an agent can see a draft, that's a release blocker."
- `docs/SECURITY-RELEASE-GATE.md` stranger security test, eight steps, two browsers, recorded by someone who did not write the ACL code.
- `docs/PUBLIC-RELEASE-SPRINT.md` stranger checklist, run by two people who did not build the product.

### The short version

If you remember one line, remember this one:

```bash
npm run scan:vendor && npm run verify:software
```

and if you are deploying, add:

```bash
BLOCKSMITH_URL=https://<prod> npm run verify:production-goals
```

---

## 8. What is NOT tested today

This section is deliberately blunt. Everything below is a real gap, verified against the repository, not a hypothetical.

### 8.1 Nothing has unit tests

Zero `*.test.ts` or `*.spec.ts` files in `src/`, `packages/`, `scripts/`, or `fixtures/`. No test runner in `package.json`. No coverage tooling. Nobody can tell you what fraction of any module is exercised.

The most complex pure logic in the repo is entirely uncovered at the unit level: `src/lib/scan/component-interface.ts` (a TypeScript-shape parser), `src/lib/parser/modify.ts` (markdown surgery), `src/lib/figma/` (multiple payload shapes), `src/lib/ir/hash.ts` (content-addressed hashing whose semantics are described in `protocol-conformance.yml` as "constitutional"). Each is covered only through an end-to-end script that exercises one path through it.

### 8.2 Never run against a live external service

| Surface | State | Note |
|---|---|---|
| **Live Figma API** | `verify:figma-import` is explicitly "pure and deterministic, no live Figma credentials needed." Every payload is a hand-written literal in the script. | If Figma changes a response shape, no automated check notices. `docs/TESTING-FIGMA-FUSION.md` sections A through D are entirely manual and require a paid Figma plan, a `FIGMA_ACCESS_TOKEN`, and a public HTTPS deployment for webhooks. **Built, unproven** against schema change. |
| **Figma plugin** (`figma-plugin/`) | No script touches it. Manual only, `TESTING-FIGMA-FUSION.md` section B, 8 steps. | |
| **Figma webhooks** | Manual `curl` for the passcode path; real events need a public deployment. | |
| **Supabase** | `verify:supabase` exists and does a real upload and download round trip, but it is **not** in `verify:software`. Only in `verify:workable`. | It also never deletes the test object, so every run leaks a `verify-supabase-<timestamp>.md` into the bucket. |
| **GitHub clone** | `verify:github-scan` is real (it clones `shadcn-ui/ui`), but it is only in `verify:goal1:full`, which nothing runs automatically. | |
| **NVIDIA inference** | `verify:governance-copilot` makes a real call, but SKIPs with exit 0 when `NVIDIA_API_KEY` is unset, so absence of a key is indistinguishable from success. The vision path (screenshot capture to design.md) has no verify script at all. | |
| **Resend / email** | `resend` is a dependency and `docs/PRODUCTION-CHECKLIST.md` lists "email delivery for org invites" as an open P1. No script. **Planned**. | |
| **Upstash Redis** | Rate limiting falls back to in-memory when unset. Verified only by the manual `curl` loop in `RELEASE-TEST-PLAN.md` section 6. | |
| **Sentry** | Wired, no-op until a DSN is set. No script asserts an error actually reaches Sentry. | |

### 8.3 Covered only by manual click-through

- The entire browser UI. No Playwright, no Cypress, no component tests. Not one assertion runs in a browser. The only Playwright code in the repo is `scripts/_verify-dashboard-tmp.mjs`, a one-off screenshot script that imports Playwright by absolute path out of an npx cache directory. It is scratch, not a test, and it should be deleted.
- The Chrome capture extension (`extension/`). `E2E-TEST-GUIDE.md` Part 7, seven manual steps.
- The Pipeline UI: promote, rollback, pin lock, run consoles, failure badges. `RELEASE-TEST-PLAN.md` sections 1 through 8, all manual.
- Cold-start durability on serverless. The most important production behavior in the product (does a promoted block survive a lambda freeze) is a manual test that requires waiting 15 minutes or forcing a redeploy.
- Rate limits. Manual `curl` loop.
- The onboarding and dashboard flows. `PRODUCTION-CHECKLIST.md` section 7 is a manual list.
- The CLI end to end. `blocksmith login`, `pull`, `check --staged`, `scan`, `mcp-url`, `setup hooks`. `E2E-TEST-GUIDE.md` Part 3 is 30 minutes of manual work against a second repo you must supply yourself. `verify:patterns-live` only checks that `packages/cli/dist/cli.js` exists on disk.

### 8.4 Scripts that are stale or fragile

- **`verify:design-ir`** hard-codes `data/uploads/design-f37abfd0.md` and `data/uploads/design-c37e5b44.md`. Both are gitignored (`data/uploads/*.md`). On a fresh clone this script cannot run. It is also not in any aggregate suite, so nobody notices. **Stale by dependency.**
- **`verify:wiki`** defaults to `data/uploads/design-163e34fb.md`, also gitignored, and it **is** in `verify:software`. On a fresh clone, `verify:software` fails on step four with a file-not-found from a file nobody can restore.
- **`scan:verify` and `verify:scan-wiki`** read `data/uploads/scan-acme-ui-kit.md`, also gitignored. They are steps two and three of `verify:software`. `verify:scan-wiki` at least prints `Run: npm run scan`. `scan:verify` just throws. **The aggregate suite cannot run on a clean checkout without first running `npm run scan:vendor`, and nothing says so.**
- **`verify-mcp-accept.ts`** has no npm alias at all. It is invisible unless you list the directory.
- **`verify:production-smoke` and `verify:production-goals`** exit 0 when `BLOCKSMITH_URL` is unset. In `production-goals.yml` the URL comes from a repo variable, so a missing variable is a silently green CI job.
- **`verify:governance-copilot`** exits 0 when `NVIDIA_API_KEY` is unset. Same failure mode.
- **`scripts/_verify-dashboard-tmp.mjs` and `.bak`** are committed scratch files with hard-coded absolute paths from a previous session.

### 8.5 The suite mutates tracked files

Running `verify:software` modifies, in the working tree: `fixtures/vendor-ui/DESIGN.md`, `fixtures/vendor-ui/scan-snapshot.md`, `data/cloud/documents.json`, `data/cloud/orgs.json`, `data/cloud/governance-events.json`, `data/uploads/scan-acme-ui-kit.wiki-overrides.json`. All six are tracked in git. Three of them are deleted outright before being rewritten.

Two consequences. First, you cannot tell a real change from test residue in `git status`, so residue gets committed, which is why the committed `fixtures/vendor-ui/DESIGN.md` currently contains the string "Written by verify-handshake-acceptance." Second, the suite is not safe to run in a dirty working tree, and nothing warns you.

### 8.6 Ordering and isolation

`verify:software` is a `&&` chain, so it stops at the first failure and you never learn whether the other 16 would have passed. The scripts share state and depend on execution order: `verify:handshake-pull` runs after `verify:handshake-writeback` and reads a sidecar the earlier script created, which is why it contains a warning rather than an assertion about pre-existing overrides. `verify:handshake-acceptance` mutates `Button.tsx` and restores it in a `finally`; interrupt it with Ctrl-C between the write and the restore and the fixture is left with `#fefefe` in it, and every subsequent scan-based script starts producing different output.

### 8.7 Type coverage holes

`packages/cli` and `packages/sdk` are excluded from the root tsconfig and nothing invokes their per-package typecheck. The CLI is the artifact customers run locally, and it is the least statically checked code in the repository.

### 8.8 The route audit is a spreadsheet

There is no test that enumerates routes under `src/app/api/` and asserts each gates on ownership. The audit is a hand-maintained markdown table in `docs/SECURITY-RELEASE-GATE.md`. A new route added tomorrow appears in no table and fails no check. `src/middleware.ts` plus default-deny in `canAccessDocument` are the backstops, and neither is asserted route-by-route.

### 8.9 Concurrency

`docs/RELEASE-TEST-PLAN.md` lists it under known limitations: "Concurrent promotes can race across lambdas (read-modify-write on registry entries has no cross-instance locking)." Accepted for launch, untested, and untestable with the current tooling.

---

## 9. The quality bar for new code

### 9.1 Before you open a pull request

Non-negotiable, in order:

1. `npm run typecheck` is clean. Zero errors, not "only errors in files I did not touch."
2. `npm run scan:vendor && npm run verify:software` is green.
3. `git status` shows only files you meant to change. Revert verify residue in `fixtures/vendor-ui/` and `data/cloud/` unless the change is deliberate, and if it is deliberate, explain why in the PR description.
4. If your change is customer-facing, tick the boxes in the `docs/PUBLIC-RELEASE-SPRINT.md` PR template, including the one that says the change is tested on production and not only locally.

### 9.2 Which verify script your change must extend

This is the part that matters. A change of each kind must extend a specific script. If your change does not fit any row, you are probably building something with no verification story, and you should say so in the PR rather than let it pass silently.

| If you change | You must extend | With |
|---|---|---|
| `src/lib/scan/extract.ts` (the scanner) | `verify-vendor-fixture.ts` | An assertion on the new fact you extract. If your change alters counts, refresh the snapshot in its own commit. |
| `src/lib/scan/to-markdown.ts` (the emitter) | `verify-scan-wiki.ts` **and** the fixture snapshot | An assertion that the parser recovers the new section. Snapshot refresh in a separate commit. |
| `src/lib/scan/parse.ts` (the parser) | `verify-vendor-e2e.ts` | A round-trip assertion. Emitter and parser must be changed and verified together. |
| `src/lib/scan/component-interface.ts` | `verify-component-interface.ts` | A sixth (seventh, eighth) case in the `cases` array with an `expect` function. This is the cheapest high-value contribution in the repo. |
| `src/lib/codegen/pulse.ts` (the generator) | `verify-pulse.ts` | A row in the `faithful` array: a file, a regex, and a message naming the stub regression it catches. |
| `src/lib/parser/modify.ts` (markdown writeback) | `verify-modify-tokens.ts` | A block: modify, re-parse, assert the change landed, assert siblings are untouched. |
| `src/lib/ir/` (registry, lock, enforce, targets) | `verify-ir-cicd.ts` | A `check()` in the matching lifecycle phase. Keep the phase headings. |
| `packages/protocol/` or `public/schema/` | `packages/protocol/conformance/` | A fixture under `valid/` or `invalid/`, and a golden vector under `behavioral/` if hash semantics move. Hash changes need a spec bump; see the workflow comment. |
| `src/lib/cloud/documents.ts` or `access.ts` | `verify-security-gate.ts` | An assertion for the new deny path. Assert the deny, not the allow. |
| `src/lib/cloud/rbac.ts` or `orgs.ts` | `verify-org-rbac.ts` | A row in the role matrix and a document-access assertion. |
| A new `src/app/api/**/route.ts` | `verify-security-gate.ts` or `verify-saas-acl.ts` | Import the handler, call it unauthenticated, assert 401. Every route. |
| `src/lib/figma/` | `verify-figma-import.ts` | A `check()` with a literal payload in the shape Figma actually sends. |
| `src/mcp/handlers.ts` | `verify-handshake-acceptance.ts` (parity) or `verify-mcp-sync-status.ts` (status) | An assertion that MCP output equals wiki output. Never let those diverge silently. |
| `src/lib/governance/` | `verify-governance-tiers.ts` | A snippet that trips the new rule, and an assertion on the tier and the suggestion. |
| The CLI (`packages/cli/`) | Nothing exists | Say so in the PR. Manually walk `docs/E2E-TEST-GUIDE.md` Part 3. This is the largest hole in the strategy. |
| The browser UI | Nothing exists | Say so in the PR, and name which manual checklist you walked. |

### 9.3 Rules that are not about scripts

- **A new capability without a verify script is not shipped.** Use the status vocabulary honestly: **Built, unproven** is a legitimate and useful label. Claiming **Shipped** for something no script and no manual pass has exercised is the one thing that makes this whole document worthless.
- **When you fix a bug, add the assertion that would have caught it** to the script that owns that surface. Every case in `verify-component-interface.ts` is a bug that shipped once. That is the pattern.
- **A gate that skips on missing configuration must say so loudly.** Three scripts currently exit 0 when an environment variable is absent. Do not add a fourth without printing a `SKIP` line that a human will actually see.

---

## 10. How to add a new verify script

### 10.1 Conventions

**Location and name.** `scripts/verify-<subject>.ts`, kebab case, matching the surface it guards. The npm alias is `verify:<subject>` and it usually drops filler: `scripts/verify-mcp-sync-status.ts` is `verify:mcp-sync`, `scripts/verify-wiki-parse.ts` is `verify:wiki`, `scripts/verify-scan-coverage.ts` is `scan:verify`. Prefer the boring literal name for anything new.

**Header comment.** Every script opens with a block comment stating what it proves and how to run it. This is not decoration. It is the first thing anyone reads when the script fails. Follow the existing shape:

```ts
/**
 * Goal 2: Web to IDE writeback for workspace-scan docs.
 * Finalize via HTTP, then cloud sidecar + local vendor DESIGN.md survives rescan.
 *
 * Usage: npm run verify:handshake-writeback
 */
```

If the script guards against a specific regression, say which one and what the consequence is. `verify-component-interface.ts` and `verify-pulse.ts` are the models.

**The runner.** Add to `package.json`:

```json
"verify:my-thing": "tsx --conditions=react-server scripts/verify-my-thing.ts"
```

Use `--conditions=react-server` if the script imports anything from `src/app/`, `src/mcp/`, or a module marked `server-only`. Omit it for pure-logic scripts (`verify:component-interface`, `verify:design-ir`, `verify:wiki`, `verify:modify-tokens` all omit it). If you get a confusing module resolution error importing a route handler, the missing flag is the cause.

**Imports.** Both `@/lib/...` and `../src/lib/...` are used in the existing scripts. `tsx` honors the tsconfig `paths`, so both work. Prefer `@/` for new scripts.

**Environment setup.** Set the flags your script needs at the top of `main()`, before any dynamic import, and never rely on the caller:

```ts
process.env.AI_LAB_SCAN_CURATE = "0";   // no LLM in the scan path, always
process.env.BLOCKSMITH_SAAS_STRICT = "0"; // or "1" for security scripts
process.env.BLOCKSMITH_ADMIN_SECRET = "test-admin-secret"; // if minting API keys
```

Then `await import()` the modules that read those variables at module load. That deferred-import pattern (`const { scanAndPersist } = await import("../src/lib/scan/run")`) appears in almost every script and exists precisely because the flags must be set first.

If the script needs local credentials, copy the `loadEnvLocal()` helper that appears in `verify-scan-coverage.ts`, `verify-supabase.ts`, `verify-patterns-live.ts`, and others. It is duplicated in six scripts and should be extracted into a shared helper at some point.

**Test the real thing.** Import route handlers directly and call them with a `NextRequest`:

```ts
import { POST as finalizePost } from "../src/app/api/wiki/finalize/route";

const req = new NextRequest("http://localhost/api/wiki/finalize", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ /* ... */ }),
});
const res = await finalizePost(req);
```

Do not mock. Do not spin up a server unless you are specifically testing HTTP transport (`verify:patterns-live` and `verify-mcp-accept` are the only two that do, and both document the dev-server requirement in their usage comment).

**Clean up what you create.** Use `mkdtempSync(join(tmpdir(), "blocksmith-<name>-"))` for scratch workspaces and `rmSync(..., { recursive: true, force: true })` in a `finally`. `verify-handshake-pull.ts` and `verify-governance-e2e.ts` are the models. If you mutate a fixture, restore it in a `finally` the way `verify-handshake-acceptance.ts` does. If you create an upload, unlink it the way `verify-figma-import.ts` does.

### 10.2 The exit code contract

| Code | Meaning | Who uses it |
|---|---|---|
| **0** | All assertions passed | Everything |
| **0** | Deliberately skipped because required configuration is absent, after printing a `SKIP` line | `verify:production-smoke`, `verify:production-goals`, `verify:governance-copilot` |
| **1** | One or more assertions failed | Everything |
| **2** | Setup error, distinct from a violation: the doc would not load, the environment is wrong | `governance-gate.ts`, `validate-ui.ts` only |

The chain in `verify:software` is `&&`, so a nonzero exit stops everything after it. That is intentional. Never `console.error` a failure and then exit 0.

Never throw an uncaught exception as your failure mode. Always end with:

```ts
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

An uncaught rejection in some Node versions exits 0, which turns a failing check into a passing build.

### 10.3 The three output formats

Pick one of the three that already exist. Do not invent a fourth.

**Format A: the error array.** The most common, and the right default for anything with more than three assertions. Collect, report the context first, then dump the failures.

```ts
const errors: string[] = [];

if (system.mode !== "workspace-scan") {
  errors.push(`Expected mode workspace-scan, got ${system.mode}`);
}

console.log("Workspace scan wiki verification");
console.log(`  Published:   ${fileName}`);
console.log(`  Inventory:   ${result.inventory.length} React files`);

if (errors.length) {
  console.error("\nFAILED:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log("\nOK, scan, published .md, and wiki parse are consistent.");
```

The virtue is that you see **every** failure in one run, and you see the diagnostic context (counts, paths, doc refs) whether it passed or failed. That context is what you actually debug from.

**Format B: the check counter.** For scripts with many independent assertions organized into phases. Used by `verify-ir-cicd.ts` (31), `verify-figma-import.ts` (about 50), `verify-modify-tokens.ts` (about 25).

```ts
let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (ok) console.log(`  OK ${label}`);
  else {
    failures += 1;
    console.error(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
  }
}

console.log("\nPROMOTE");
check("promote succeeds at v2", promo.ok && promo.version === 2);

process.exit(failures === 0 ? 0 : 1);
```

Always pass the `detail` argument with the actual value. `check("colors parsed", ds.colors.length >= 3, \`colors=${ds.colors.length}\`)` tells you it found 2. Without the detail you only know it did not find 3.

**Format C: throw on first failure.** For short scripts (under 100 lines) where every assertion is a precondition for the next. Used by `verify-saas-acl.ts`, `verify-org-rbac.ts`, `verify-security-gate.ts`, `verify-mcp-sync-status.ts`.

```ts
if (await canAccessDocument(fileName, ownerB)) {
  throw new Error("Owner B should be denied");
}

console.log("[verify:my-thing] OK");
console.log("  what it covered, one line each");

main().catch((err) => {
  console.error("[verify:my-thing] FAIL", err);
  process.exit(1);
});
```

The `[verify:name]` prefix is the convention for this format. Use it consistently in both the OK and the FAIL branch so a failure inside a long chain is greppable.

Across all three: **print the numbers even on success.** `Inventory: 5 React files`, `Featured: 4 (button, card, badge, input)`, `Block-tier: 1`, `Warn-tier: 1`. Someone reading a green log should be able to spot a wrong-but-passing number.

### 10.4 Where to register it

Four places, in order of increasing commitment:

1. **`package.json` scripts.** Always. Even `verify-mcp-accept.ts` should have one; it does not, and that is a bug.
2. **The `verify:software` chain**, if it is fast (under about 30 seconds), needs no network, no credentials, and no running server, and guards a surface that must never regress. Append it before `verify:component-interface` and `verify:pulse`, which are the slow tail. If it is slow or needs credentials, leave it out and document it here instead.
3. **`.githooks/pre-commit`**, only if it is fast and guards something a commit can plausibly break. The current set is six scripts and adding a seventh should be a deliberate decision, because every second here is a second on every commit.
4. **A GitHub workflow**, if it can run without secrets on a clean checkout. Copy the shape of `protocol-conformance.yml`: `actions/checkout@v4`, `actions/setup-node@v4` with Node 22 and npm cache, `npm ci --ignore-scripts`, then your command. Note that `--ignore-scripts` skips `postinstall`, so if your script needs the generated Pulse package you must run `npm run build:pulse` explicitly.

5. **This chapter.** Add a row to the catalog in section 2.2 and, if it guards something important, a paragraph in section 2.4. A verify script nobody knows exists is a verify script nobody runs.

---

## Open questions

1. **When do we add Vitest, and who owns the first ten unit tests?** Section 1.4 argues the trigger conditions are already met for `component-interface.ts`, `parser/modify.ts`, `figma/`, and `ir/hash.ts`. Nobody has decided. The risk of deciding late is that the four hardest modules stay covered only by whatever path the vendor fixture happens to take.

2. **Should verify scripts be allowed to write into tracked files at all?** The current answer is accidental rather than chosen. Options: point them at a temp copy of the fixture (loses the "writeback survives a rescan" property that is the whole point of `verify:handshake-writeback`), gitignore the mutated artifacts (loses the committed snapshot that CI and Vercel depend on), or add a post-suite `git checkout` step (a band-aid, and it would discard intended changes). No option is clearly right.

3. **Why is `verify:software` not in CI?** It is the repository's own definition of "the whole local product works," and no workflow runs it. The blocker is that it needs `data/uploads/scan-acme-ui-kit.md`, which is gitignored, so it cannot run on a clean checkout without `npm run scan:vendor` first, and it runs `npm install` inside `verify:pulse`. Both are solvable. `docs/SECURITY-RELEASE-GATE.md` item S10 has tracked this as open for a while.

4. **Should `scan-facts-hash` be a real change detector?** It currently includes the scan timestamp, so it changes on every run and cannot be used to answer "did the scan output actually change." A hash over the facts alone, excluding timestamp, path, and commit, would make snapshot review mechanical instead of manual.

5. **Is the vendor fixture too small?** Five React files, eight CSS variables, four featured components. Real customer repos have hundreds. Every performance characteristic, every batching path, and every partial-failure path is untested by construction. Should there be a second, deliberately large fixture, or is `verify:github-scan` against `shadcn-ui/ui` the answer, and if so why is it not in any routine suite?

6. **How do we test the CLI?** It is the artifact customers run on their own machines, it is excluded from typecheck, and it has no verify script. `E2E-TEST-GUIDE.md` Part 3 is 30 minutes of manual work requiring a second repo you supply yourself. The minimum viable answer is probably a fixture consumer repo under `fixtures/` and a `verify:cli` that runs `login`, `pull`, and `check` against a local server.

7. **What replaces the manual stranger tests?** `SECURITY-RELEASE-GATE.md` S9 and `PUBLIC-RELEASE-SPRINT.md` both require two non-builders to walk a checklist on production. That gate has never been satisfied. It is also the only thing standing between the current state and design-partner uploads. Either it gets scheduled with named people and dates, or it gets replaced with something automatable, and the honest reading of the docs is that it has been neither for months.

8. **Should `scripts/_verify-dashboard-tmp.mjs` and its `.bak` be deleted?** Almost certainly yes. Unless the Playwright approach in it should be promoted into a real browser-level verify script, in which case it should be rewritten properly rather than left as scratch.

---

## Where to look in the code

**The scripts themselves**

```
scripts/verify-*.ts                    32 files, the whole catalog in section 2.2
scripts/validate-ui.ts                 lock freshness + off-token gate (CI)
scripts/governance-gate.ts             off-token gate on added lines (pre-commit)
scripts/guard-build.mjs                refuses a build while `next dev` runs
scripts/dev.mjs                        safe dev startup, stale chunk detection
scripts/ensure-pulse.mjs               generates the Pulse package on postinstall/build
scripts/scan-workspace.ts              the scan entry point (`npm run scan`, `scan:vendor`)
scripts/codegen-pulse.ts               the codegen entry point
scripts/_verify-dashboard-tmp.mjs      scratch Playwright screenshots, delete this
```

**Configuration and wiring**

```
package.json                           lines 21-74: every verify alias
                                       line 52: the verify:software chain
                                       line 14: build = guard-build && ensure-pulse && next build
tsconfig.json                          exclude: packages/cli, packages/sdk, font-generator
eslint.config.mjs                      four lines, next/core-web-vitals only
.githooks/pre-commit                   6 verify scripts + governance:check (opt-in)
.githooks/post-commit                  activity:from-commit
.github/workflows/validate-ui.yml      PR gate on UI files
.github/workflows/protocol-conformance.yml   PR + main gate on protocol/IR/schema
.github/workflows/production-goals.yml       post-merge production check
.gitignore                             data/uploads/*.md, packages/generated/, .blocksmith/
```

**The fixtures**

```
fixtures/vendor-ui/                    the golden vendor design system
fixtures/vendor-ui/blocksmith.config.json    workspaceId, scanPaths, catalogPaths
fixtures/vendor-ui/scan-snapshot.md          tracked; a build input for CI/Vercel
fixtures/vendor-ui/.blocksmith/scan-snapshot.md   untracked; regenerated every scan
fixtures/vendor-ui/DESIGN.md           the writeback target (currently holds test residue)
fixtures/external-mini/                the second, smaller vendor shape
fixtures/storybook-static/index.json   for `npm run ingest:storybook`
packages/protocol/conformance/         valid/, invalid/, behavioral/ fixtures + run.ts + drift.ts
```

**The code under test that the guards care about most**

```
src/lib/scan/extract.ts                scanWorkspace, the deterministic facts
src/lib/scan/to-markdown.ts            workspaceScanToMarkdown, the emitter
src/lib/scan/parse.ts                  parseWorkspaceScanMarkdown, the parser
src/lib/scan/component-interface.ts    extractComponentInterface, the faithfulness source
src/lib/scan/run.ts                    scanAndPersist, publishScanMarkdown, snapshot writing
src/lib/runtime/writable-root.ts       canWriteWorkspaceSnapshot (serverless guard)
src/lib/codegen/run.ts                 FIXTURE_SCANS fallback for CI/Vercel
src/lib/codegen/pulse.ts               the generator the faithfulness guards watch
src/lib/ir/registry.ts                 versions, official pointer, promote, rollback
src/lib/ir/lock.ts                     buildLock, verifyLock
src/lib/cloud/documents.ts             canAccessDocument, the default-deny backstop
src/lib/cloud/rbac.ts                  canPerform
src/lib/cloud/saas.ts                  saasStrictMode, isPublicContent
src/middleware.ts                      the coarse credential check
src/app/api/wiki/finalize/route.ts     called directly by five verify scripts
src/app/api/v1/scans/pull/route.ts     called directly by two
src/app/api/v1/governance/events/route.ts   called directly by one
src/mcp/handlers.ts                    handleGetComponentDocs, handleGetSyncStatus
```

**The documents this chapter was assembled from**

```
docs/E2E-TEST-GUIDE.md                 the full manual pass, 2.5 to 3 hours, 9 parts
docs/RELEASE-TEST-PLAN.md              pipeline reliability, production-only, 8 sections
docs/SECURITY-RELEASE-GATE.md          the P0 security gate, route audit, stranger test
docs/PRODUCTION-CHECKLIST.md           env vars, Supabase setup, deploy, post-deploy smoke
docs/PUBLIC-RELEASE-SPRINT.md          the PR checklist and the stranger definition of done
docs/TESTING-FIGMA-FUSION.md           manual Figma connector, plugin, webhook testing
docs/GOAL1-VENDOR-SCAN.md              the snapshot contract and blocksmith.config.json
```

Related chapters: [Chapter 03](./03-what-blocksmith-is.md) for what the pipeline produces and why fidelity is the product, and [Chapter 20](./20-your-first-ninety-days.md) for where verification fits into your first weeks.
