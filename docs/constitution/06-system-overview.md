# The System From Ten Thousand Feet

**What this chapter covers.** The whole machine, in one place. What BlockSmith physically is (one Next.js app, a handful of packages, a pile of verify scripts), how work flows through it, where every directory lives and why, every page route and every API route, every npm script, and what the hosting environment forces the code to do.

**Why it matters.** You cannot review a pull request, debug a production incident, or decide where a new feature belongs until you know which plane a file lives on. This chapter is the map. Everything after it is a zoom-in on one region.

**Read this if** you have just joined, or you are about to open a file you have never seen and want to know, in ten seconds, what it is for.

Everything here is grounded in the repository as it stands. Where a thing is designed but not built, it is labeled. Where a doc in `docs/` describes something the code does not do, that is called out, because stale docs are the most expensive kind of lie in a young codebase.

---

## 1. The mental model

BlockSmith is three things bolted together:

1. **One Next.js 15 application** at the repo root (`src/`), App Router, React 19, deployed to Vercel. It is the product: the wiki, the dashboard, the pipeline console, the protocol spec site, and about sixty API routes.
2. **A family of packages** under `packages/`: a CLI a customer installs, an SDK the CLI is built from, a protocol package that defines the interchange format, a tiny runtime for generated code, a layout library, and a directory of machine-generated packages.
3. **A set of verify scripts** under `scripts/`. There is no test framework in this repo. There is no Jest, no Vitest, no Playwright, and no test dependency in `package.json` at all. Instead there are roughly thirty `tsx` scripts named `verify-*.ts`, each of which asserts one end-to-end property and exits non-zero when it fails. `npm run verify:software` chains seventeen of them. This is the test suite. Treat it as one.

A detail that explains a lot of otherwise-strange code: the verify scripts **import Next.js route handlers directly and call them in-process** with a synthetic `NextRequest`, for example `import { POST as finalizePost } from "../src/app/api/wiki/finalize/route"`. No HTTP server is involved. That is why almost every verify script runs under `tsx --conditions=react-server`, and it is why "end to end" in this repo means "through the real handler", not "over the wire". Only five scripts actually open a socket: `verify:patterns-live`, `verify-mcp-accept`, `verify:production-smoke`, `verify:production-goals`, and `verify:supabase`.

### The three planes

Everything in the repo belongs to exactly one of three planes. When you cannot place a file, you do not yet understand it.

```
                    +---------------------------------------+
   INGEST PLANE     |  Get design truth INTO the system     |
                    +---------------------------------------+
                                    |
                                    v
                    +---------------------------------------+
   CONTROL PLANE    |  Version it, govern it, promote it,   |
                    |  pin it, audit it                     |
                    +---------------------------------------+
                                    |
                                    v
                    +---------------------------------------+
   OUTPUT PLANE     |  Compile it OUT to every consumer     |
                    +---------------------------------------+
```

**The ingest plane** turns some external artifact into a BlockSmith markdown document. Five adapters exist:

| Adapter | Entry point | Status |
|---|---|---|
| Repo scan (local path, GitHub clone, client-side upload, bundled fixture) | `src/lib/scan/service.ts` | **Shipped**, the reference adapter |
| Figma library (REST fetch, MCP variables payload, webhook) | `src/lib/figma/adapter.ts` | **Shipped** for tokens and component surfaces |
| Paste / upload markdown | `src/app/api/wiki/import/route.ts` | **Shipped** |
| Screenshot capture (browser extension, vision model) | `src/lib/ingest/capture.ts` | **Shipped**, requires an NVIDIA key |
| Prompt (text or image to a synthetic design system) | `src/lib/dashboard/generate.ts`, `vision-generate.ts` | **Shipped**, requires an NVIDIA key |
| Storybook static build | `src/lib/ingest/storybook.ts` | **Built, unproven** against a real customer Storybook. It exists to prove the protocol is not BlockSmith-shaped. |

**The control plane** is where a design fact becomes a versioned, promotable, pinnable thing. It lives almost entirely in `src/lib/ir/` (the registry, the lock, promote, rollback, the pipeline run log) plus `src/lib/blocks/` (which shatters a parsed document into addressable blocks and feeds them to the registry) plus `src/lib/governance/` and `src/lib/cloud/` (roles, orgs, deviations, audit events).

**The output plane** compiles the promoted graph back out. The authoritative list of consumers is data, not prose: `packages/protocol/compile-targets.v1.json`. It names six targets, of which five are implemented:

| Target | Reads | Emits | Implementation |
|---|---|---|---|
| `wiki` | blocks (drafts allowed) | HTML/React pages | `src/components/wiki/**` |
| `pulse-react` | official graph | an npm package | `src/lib/codegen/pulse.ts` |
| `mcp` | official graph + lock | tool payloads for coding agents | `src/lib/mcp/blocksmith-server.ts`, `src/mcp/handlers.ts` |
| `device-sim` | official graph | a watch/HMI JSON profile | `src/lib/ir/targets/device-sim.ts` |
| `c-header` | official graph | `tokens.h` for firmware | `src/lib/ir/targets/c-header.ts` |
| `lvgl` | official graph | embedded UI | **Planned**, declared as `status: "stub"` |

`wiki` is the only target with `officialOnly: false`. It alone may render drafts. Every other target must refuse to read anything that has not been promoted. That rule is enforced by `listGovernedBlocks()` in `src/lib/ir/enforce.ts`, which filters out `draft` and `conflict` before an agent ever sees a block.

### Which plane is strong, which is thin

Be honest about this in front of customers and in front of yourselves.

- **The ingest plane is the strongest.** Repo scan is genuinely good: it walks a real vendor repo, extracts CSS variables, hex colors, utility classes, and per-component structural interfaces using the TypeScript syntactic API, classifies which components a designer actually cares about, and writes a document that round-trips. Six verify scripts guard it (`scan:verify`, `verify:scan-wiki`, `verify:vendor-fixture`, `verify:vendor-e2e`, `verify:external-vendor`, `verify:github-scan`). Figma import is real but younger, and the Figma REST variables endpoint is Enterprise-only, so `src/lib/figma/rest.ts` recovers de-facto tokens from color and text styles instead.
- **The control plane is real but young.** The registry, lock, promote, rollback, diff, and run log all exist and are exercised by `verify:ir-cicd`. The append-only version model is sound. What is thin: it has never been driven by more than one human at a time, there is no migration story for schema changes, and the Supabase mirror (`src/lib/ir/cloud-registry.ts`) exists specifically because the on-disk registry does not survive a serverless cold start. That mirror is the least-tested part of the whole system.
- **The output plane is broad but shallow.** Five targets is impressive on a slide. In practice the wiki is heavily exercised, MCP is exercised by hand and by `mcp:probe`, Pulse codegen is guarded by `verify:pulse`, and `device-sim` plus `c-header` exist to prove the graph is not web-specific. They are demo-grade, not customer-grade.
- **The thinnest thing of all is the handshake back into a customer repo.** `blocksmith pull` writes `DESIGN.md`, `.blocksmith/wiki-overrides.json`, and `blocksmith.lock`. That path works (`verify:handshake-pull`, `verify:handshake-writeback`, `verify:handshake-acceptance`) but it has never run against a repo that was not ours or a fixture.

### One more warning about the docs

`docs/04-architecture.md` describes a monorepo with `apps/wiki/`, `packages/core/`, and `packages/mcp-server/`. **None of those exist.** That document describes a target shape that was never built. The real layout is a single Next app plus `packages/{cli,sdk,protocol,pulse-runtime,pretext-components,generated}`. `README.md` is similarly stale: its "Project structure" section lists four directories out of the roughly thirty that exist, and its route table describes only the Apollo demo document. Read `docs/PROJECT-PROTOCOL.md` and `docs/PROJECT-PIPELINE.md` instead. Those two are accurate and have checked boxes that correspond to real code.

---

## 2. The one-diagram version

```
   SOURCES (ingest plane)
   +--------------+  +--------------+  +--------------+  +--------------+  +--------------+
   | Repo scan    |  | Figma        |  | Paste /      |  | Screenshot   |  | Prompt       |
   | local path,  |  | REST file,   |  | upload .md   |  | capture via  |  | text or      |
   | GitHub clone,|  | MCP vars,    |  |              |  | extension    |  | image        |
   | client scan  |  | webhook      |  |              |  |              |  |              |
   +------+-------+  +------+-------+  +------+-------+  +------+-------+  +------+-------+
          |                 |                 |                 |                 |
          |  scan/run.ts    | figma/import.ts | wiki/import     | ingest/capture  | dashboard/
          |  scan/          |  reuses         |  route          |  vision model   |  generate
          |  to-markdown.ts |  to-markdown    |                 |                 |
          v                 v                 v                 v                 v
   +--------------------------------------------------------------------------------------+
   |                    design.md   (the interchange format)                               |
   |   data/uploads/<name>.md   +   Supabase bucket "scan-docs" at uploads/<name>.md       |
   |                                                                                       |
   |   YAML frontmatter  ...... machine metadata (workspace-root, github-repo,             |
   |                             scan-facts-hash, blocksmith-source)                        |
   |   Markdown tables   ...... human-readable tokens, components, guidelines               |
   |   HTML comments     ...... invisible structured IR:                                    |
   |                             <!-- blocksmith:interface {json} -->                       |
   |                             <!-- blocksmith:source <base64> -->                        |
   +-------------------------------------------+------------------------------------------+
                                               |
                      clients/registry.ts picks a parser by shape
                      (workspace-scan | comprehensive wiki | apollo)
                                               |
                                               v
                              +----------------------------+
                              |  LoadedDesignSystem        |
                              |  (src/lib/blocks/types.ts) |
                              +-------+------------+-------+
                                      |            |
                 left fork            |            |            right fork
                 "which version       |            |            "what does it
                  is true"            |            |             look like"
                                      v            v
              +-----------------------------+   +-------------------------------+
              | blocks/extract.ts           |   | design-ir/compile.ts          |
              | -> StoredBlock[]            |   | -> DesignIR (zod-validated)   |
              | blocks/store.ts             |   | --wiki-* CSS custom props     |
              |   -> ir/registry.ts         |   | WCAG legibility enforced      |
              +--------------+--------------+   +---------------+---------------+
                             |                                  |
                             v                                  |
              +-----------------------------+                   |
              |  CONTROL PLANE              |                   |
              |  registry: append-only      |                   |
              |    versions per block id    |                   |
              |  official: the release ptr  |                   |
              |  promote / rollback /       |                   |
              |    resolve-conflict         |                   |
              |  lock: blocksmith.lock      |                   |
              |  runs: append-only audit    |                   |
              +--+-----+-----+-----+-----+--+                   |
                 |     |     |     |     |                      |
       +---------+     |     |     |     +----------+           |
       |               |     |     |                |           |
       v               v     v     v                v           v
   +--------+   +--------+ +----+ +--------+  +----------+  +--------+
   | CI     |   | CLI    | | MCP| | Pulse  |  | device / |  | Wiki   |
   | gate   |   | pull   | |    | | npm pkg|  | c-header |  | render |
   +--------+   +--------+ +----+ +--------+  +----------+  +--------+
   validate:ui   DESIGN.md  agents  @blocksmith  tokens.h    /wiki
   governance    overrides  read     /<slug>     device-      pages,
   :check        lock       only     dist/       sim.json     themed
                            official                          by DesignIR
```

### Every box, explained

**Repo scan.** `POST /api/scan/workspace` or `POST /api/v1/scans` or `npm run scan` all funnel into `runScanService()` in `src/lib/scan/service.ts`, which supports four modes: `github` (download the API tarball with Octokit and untar into a temp dir, no git binary needed, which is what makes it work on Vercel), `workspace` (a server-side path, guarded by an allowlist), `clientScan` (the CLI scanned on the developer's laptop and uploaded JSON), and `fixture` (the bundled `fixtures/vendor-ui`). The result is a `WorkspaceScanResult`, which `workspaceScanToMarkdown()` renders into markdown.

**Figma.** `src/lib/figma/import.ts` deliberately **reuses `workspaceScanToMarkdown`**. It synthesizes a fake `WorkspaceScanResult` with `workspaceRoot: "figma://<fileKey>"` so that the wiki, the parser, the block extractor, and governance all work on a Figma import for free, with zero new rendering code. This is the single best structural decision in the repo: new ingest adapters cost almost nothing because they all aim at the same markdown.

**Paste / upload.** `POST /api/wiki/import` accepts arbitrary markdown, saves it as `data/uploads/<slug>-<8 hex of sha256>.md`, and lets `src/lib/parser/generic.ts` figure out its shape.

**Screenshot capture.** The Chrome extension in `extension/` posts up to four data-URL images to `POST /api/ingest/capture`, which runs them through an NVIDIA-hosted vision model with a fixed system prompt and gets back the same "Style Reference" markdown the wiki already renders. The result is stamped with `<!-- blocksmith:capture-draft -->` so the UI can show a "this came from a picture, check it" banner.

**Prompt.** `POST /api/projects/create` with `useAi` calls `generateDesignSystemFromPrompt()`; `POST /api/projects/generate-image` calls `generateDesignSystemFromImage()`. Both synthesize a `WorkspaceScanResult` and go through the same markdown writer.

**design.md.** See section 3. It is the pivot of the entire architecture.

**The parser router.** `src/lib/clients/registry.ts` is the busiest module in `src/lib/`, with roughly forty-four importers. `prepareDesignSystemDoc(docRef)` is async and hydrates the document from Supabase into a memory cache; `loadDesignSystem(docRef)` is synchronous, sniffs the markdown shape, and dispatches to one of three parsers. If you call `loadDesignSystem` on an upload without awaiting `prepareDesignSystemDoc` first, it throws with an instructive message. That two-call dance exists entirely because Vercel has no persistent disk.

**The left fork (control).** `blocksFromDesignSystem()` in `src/lib/blocks/extract.ts` turns a `DesignSystem` into stable ids: `token:color:<var>`, `token:typography:<slug>`, `token:spacing:<token>`, `token:surface:<level>`, `component:<id>`, `guideline:dos`, `guideline:donts`, `agent-rule:guide`, `page:<section>`. Those ids are the primary key of the entire control plane. `persistBlocksForDoc()` then calls `recordIngest()` in `src/lib/ir/registry.ts`.

**The right fork (render).** `compileDesignIR()` in `src/lib/design-ir/compile.ts` produces a zod-validated `DesignIR`: a set of `--wiki-*` CSS custom properties, a preview palette, font stacks, and resolved Google Fonts. It is cached at `.blocksmith/design/<docKey>/ir.json`, keyed on content hash **and** `DESIGN_IR_COMPILER_REV` (currently `12`), so bumping the compiler invalidates every cache without a manual purge.

**The registry.** One JSON file per block id: `.blocksmith/registry/<docKey>/<blockId>.json`, shaped `{ id, official?, versions: [] }`. `versions` is append-only and never deleted. `official` is a movable tag. The header comment states the model plainly: npm-style, history is immutable, the tag moves. Version assignment in `recordIngest()`:

- new id becomes version 1
- same id, same content hash: no-op, and any prior `stale` mark is cleared
- same id, changed content hash: version N+1
- id present in the registry but absent from this ingest pass: the latest record flips to `stale`, never deleted, unless the adapter passed `partial: true`

Auto-promotion has one rule, and it encodes the whole product thesis: `token` and `component` blocks that came from `ingest` promote themselves. Code is truth about code. Anything a human edited in the wiki stages as a draft and waits for a person to click promote.

**The lock.** `buildLock()` in `src/lib/ir/lock.ts` produces `blocksmith.lock`, the design-system equivalent of `package-lock.json`. It pins `{ blockId: { version, contentHash } }` plus a graph hash. `verifyLock()` detects four failure classes: stale (the graph hash moved), version mismatch, missing pins, and hash mismatch (which means someone hand-edited the lock). Locks are written per document to `.blocksmith/locks/<docKey>.lock`, with a best-effort mirror to the legacy single `.blocksmith/blocksmith.lock`. Per-document paths exist because promoting document A must never clobber document B's pin.

**CI gate.** `npm run validate:ui` (`scripts/validate-ui.ts`) runs in `.github/workflows/validate-ui.yml` on every PR that touches a UI file. Stage 1 fails the build when the lock is missing while a registry exists, or when the lock is stale. Stage 2 scans **only the added lines of the diff** for hex colors that are not in the promoted palette. Exit 0 governed, 1 violation or stale, 2 setup error. `npm run governance:check` is the same idea wired into `.githooks/pre-commit`.

**CLI pull.** `blocksmith pull --doc upload:scan-foo.md` calls `GET /api/v1/scans/pull`, then writes three files into the customer's repo: `DESIGN.md` (full wiki export), `.blocksmith/wiki-overrides.json`, and `blocksmith.lock`.

**MCP.** Sixteen tools over two transports. `npm run mcp` runs stdio for a local Cursor install; `POST /api/mcp` is the remote Streamable HTTP transport, authenticated with `Authorization: Bearer bs_live_...`. Both share `createBlocksmithMcpServer()`, so the tool set is identical. The server also ships a long instruction string to every client on connect, which is how governance travels with the connector instead of requiring the customer to paste rules into a repo file.

**Pulse.** `npm run codegen:pulse` reads a workspace-scan document and emits a real, buildable npm package at `packages/generated/<slug>/`. See section 3 for why this is possible at all.

**Device and C header.** `npm run compile:device` reads the same official graph and emits `.blocksmith/targets/<docKey>/device-<frame>.json` plus `tokens.h`. The stated thesis in `src/lib/ir/targets/device-sim.ts` is worth memorizing: we compile meaning (accent color, minimum touch target, at most one call to action), not React syntax.

**Wiki render.** `src/app/wiki/[[...slug]]/page.tsx` is one 579-line catch-all route that dispatches roughly twenty-one wiki pages across three parser modes.

---

## 3. The data spine: `design.md` is the interchange format

This is the central insight of the codebase. **Everything round-trips through markdown.**

There is no database of design tokens. There is no protobuf. There is no internal object store that is the source of truth. The source of truth is a markdown file that a human can read, diff in a pull request, and edit by hand, and every subsystem re-derives its view from that file.

A workspace-scan document has three channels layered into one file.

### Channel 1: YAML frontmatter (machine metadata)

Written by `workspaceScanToMarkdown()` in `src/lib/scan/to-markdown.ts`:

```
---
blocksmith-source: workspace-scan
workspace-root: /Users/you/vendor-app
project-name: acme-ui-kit
workspace-id: acme-ui-kit
github-repo: acme/ui-kit
scanned-at: 2026-06-09T12:00:00.000Z
git-commit: 4f2a91c
scan-paths: src
inventory-tsx: 41
inventory-files: 212
featured-components: 4
scan-facts-hash: 38e68fcafd5df8ad
---
```

Read back by `parseMarkdownFrontmatter()` in `src/lib/markdown/frontmatter.ts`, a twelve-line wrapper over `gray-matter` that flattens every value to a string. It flattens deliberately: YAML would otherwise turn `scanned-at:` into a `Date` and `inventory-tsx:` into a number, and downstream code wants a flat string map.

`blocksmith-source` is the document-type discriminator. `src/lib/scan/parse.ts` matches `workspace-scan(?:-curated)?`. `scan-facts-hash` is a sixteen-character digest injected after the fact by `injectScanFactsHash()`, computed over a payload that deliberately excludes timestamps and human prose overrides. That is what makes staleness detection work: if the code changed, the hash changes; if only a human edited a description, it does not.

### Channel 2: markdown tables (the human layer)

The body is ordinary, readable markdown: numbered H2 sections, pipe tables of CSS variables, colors, utility classes, and one H3 per component with a `| Field | Value |` table. This is what renders in the wiki, what a designer reads, and what a human edits.

Every table has an emit/parse pair. `src/lib/scan/css-rules.ts` has `extractCssRules` and `parseCssRulesTable`. `src/lib/scan/tailwind-classes.ts` has `extractUtilityClassesFromTsx` and `parseUtilityClassesTable`. `src/lib/scan/workspace-colors.ts` has the color pair. If you add a table, add both halves or the round trip breaks silently.

### Channel 3: invisible HTML comments (the structured IR)

This is the trick that makes faithful codegen possible. Markdown renderers drop HTML comments, so a wiki reader never sees them, but a parser can recover exact structured data.

**Marker one, the component interface.** Written at `src/lib/scan/to-markdown.ts:221`, guarded by `if (c.interface)`, with the comment "Full structural IR for faithful codegen, invisible in rendered wiki":

```ts
`<!-- blocksmith:interface ${JSON.stringify(c.interface)} -->`
```

A real payload from `data/uploads/scan-acme-ui-kit.md`:

```
<!-- blocksmith:interface {"name":"Button","props":[{"name":"variant","type":"\"primary\" | \"secondary\"","optional":true,"default":"\"primary\"","variants":["primary","secondary"]}],"extendsTypes":["ButtonHTMLAttributes<HTMLButtonElement>"],"hasChildren":true,"propsTypeName":"ButtonProps","rootElement":"button"} -->
```

The shape is `ComponentInterface` from `src/lib/scan/component-interface.ts`:

```ts
interface ComponentInterface {
  name: string;
  props: PropSpec[];
  extendsTypes: string[];
  hasChildren: boolean;
  propsTypeName?: string;
  rootElement?: string;
}
interface PropSpec {
  name: string;
  type: string;
  optional: boolean;
  default?: string;
  variants?: string[];
}
```

It is produced by walking the TypeScript **syntactic** API only: `ts.createSourceFile`, no type checker, no module resolution. That is why it works on a single in-memory file from a repo whose `node_modules` we never install. It handles `forwardRef<Ref, Props>`, `memo<Props>`, nested `memo(forwardRef(...))`, `React.FC<Props>`, local interface `extends` merging, destructured defaults, and best-effort root JSX host element.

It is read back in **two** places, each with its own copy of the regex:

- `parseInterfaceComment()` at `src/lib/scan/parse.ts:100`
- `codeComponentSurfacesFromMarkdown()` at `src/lib/figma/component-drift.ts:60`

Both use `/<!--\s*blocksmith:interface\s+(\{[\s\S]*?\})\s*-->/`.

**Marker two, the verbatim source.** Written at `src/lib/scan/to-markdown.ts:224`, with the comment "Verbatim source, base64 to survive markdown, codegen re-emits it":

```ts
const b64 = Buffer.from(c.source, "utf-8").toString("base64");
lines.push(`<!-- blocksmith:source ${b64} -->`);
```

Read back by `parseSourceComment()` at `src/lib/scan/parse.ts:111` with `/<!--\s*blocksmith:source\s+([A-Za-z0-9+/=]+)\s*-->/`. Capped at `COMPONENT_SOURCE_CAP = 8_000` bytes; larger files simply omit the marker.

**Marker three, capture provenance.** `CAPTURE_DRAFT_MARKER = "<!-- blocksmith:capture-draft -->"`, exported from `src/lib/ingest/capture.ts:60` and appended to any document produced from screenshots.

**Two write-only breadcrumbs** that nothing parses back: `<!-- blocksmith:supplemental-capture target=... -->` (`src/app/api/ingest/capture/route.ts`) and `<!-- blocksmith:figma-fusion model=... -->` (`src/app/api/figma/{connect,webhook}/route.ts`).

**A different convention entirely:** `<!-- blocksmith-end-<componentId> -->`, note the hyphen rather than the colon. That one is written into the *customer's own* `DESIGN.md` by `src/lib/scan/design-md.ts` as a section-end sentinel, so `blocksmith pull` can rewrite one component's section without touching the rest of the file.

### Why this matters

Because the interface IR and the verbatim source ride inside the markdown, `src/lib/codegen/pulse.ts` can emit a real npm package from nothing but a markdown file. Its three-tier fidelity ladder:

1. **Verbatim.** If `<!-- blocksmith:source -->` exists and the source actually exports the component under that name, re-emit it byte for byte. The generated file carries the header comment "verbatim source". Faithful by construction.
2. **IR-synthesized.** If only `<!-- blocksmith:interface -->` exists, generate a real props type from the recorded props (names, optionality, types, defaults), keep only the `extends` clauses that reference importable React types, use the recorded `rootElement`, and style the body from the component's own recorded CSS variables.
3. **Generic stub.** A `<div data-blocksmith-component="...">` placeholder.

`scripts/verify-pulse.ts` contains four anti-regression guards that fail the build if codegen ever silently drops from tier one or two to tier three: `Card.tsx` must contain `title` and `<section`, `Input.tsx` must contain `<input`, `Badge.tsx` must contain `label`. Without those guards a subtle parser change would quietly turn a real component library into a pile of divs, and nothing would go red.

### Two fragilities worth knowing

1. **The interface regex depends on single-line JSON.** `(\{[\s\S]*?\})` is non-greedy and stops at the first closing brace. It works today only because `JSON.stringify` is called without indentation and `PropSpec` has no nested objects. Add a nested object to `PropSpec` and both parsers will silently truncate, fall into their `catch`, and return `undefined`. That is a silent degradation, not a crash. The regex is also duplicated in two modules rather than shared from one constant.
2. **`CAPTURE_DRAFT_MARKER` is exported but not imported.** `src/components/wiki/CaptureDraftBanner.tsx` re-declares the literal instead of importing it. The banner and the ingest layer can drift.

---

## 4. Repo tour

```
BlockSmith/
|
+-- src/                          THE APPLICATION
|   +-- app/                      Next.js App Router: pages + ~58 API routes
|   |   +-- api/                  see the route inventory in section 5
|   |   +-- dashboard/            signed-in home base (project grid, prompt bar)
|   |   +-- demo/                 device / investor / pulse demo pages
|   |   +-- figma/                Figma connect page
|   |   +-- protocol/             the public spec site (7 pages)
|   |   +-- share/[shareId]/      public single-block share view
|   |   +-- sites/[slug]/         an org's public published-wiki site
|   |   +-- studio/               pretext component gallery
|   |   +-- wiki/[[...slug]]/     ONE catch-all route rendering ~21 wiki pages
|   |   +-- layout.tsx, error.tsx, not-found.tsx, robots.ts
|   |
|   +-- lib/                      ALL SERVER LOGIC. See the table below.
|   +-- components/               React. `wiki/` is the largest subtree (44 files
|   |                             at top level plus pages/, pipeline/, visual/).
|   |                             `ui/` is shadcn. `reui/`, `shadcn-space/`,
|   |                             `shadcn-studio/` are vendored registry blocks.
|   +-- ai-lab/                   Numbered, ordered LLM pipeline modules. Each
|   |                             folder is one step (01-ai-chrome, 02-parser-assist,
|   |                             04-component-previews, 05-font-resolve,
|   |                             09-scan-curate, 10-governance-copilot). Imported
|   |                             as `@/ai-lab/...`. Every one degrades to a
|   |                             deterministic path when no API key is present.
|   +-- mcp/                      server.ts (stdio entry) + handlers.ts (19 handlers)
|   +-- hooks/                    6 client hooks
|   +-- emails/                   React Email templates (org invite)
|   +-- styles/, types/           global CSS, ambient .d.ts
|   +-- middleware.ts             one front door: coarse credential gate + CSP
|   +-- instrumentation.ts        stub; the real watcher starts from /api/sync/events
|
+-- packages/                     THE PACKAGES (npm workspaces: packages/*,
|   |                             packages/generated/*)
|   +-- cli/                      @block-smith/cli. The ONLY package on npm.
|   +-- sdk/                      @blocksmith/sdk. Bundled INTO the CLI from
|   |                             source by esbuild, so it is never published.
|   +-- protocol/                 @blocksmith/protocol. Schemas, validators,
|   |                             canonical hashing, conformance suite.
|   +-- pulse-runtime/            Two components (Surface, Text) that every
|   |                             generated package re-exports.
|   +-- pretext-components/       Private. Canvas-accurate layout frames using
|   |                             @chenglou/pretext for text measurement.
|   +-- generated/                GITIGNORED. Machine output of codegen:pulse.
|                                 `acme-ui-kit` is regenerated by postinstall.
|
+-- scripts/                      THE TEST SUITE + build helpers. ~50 files.
|   +-- ai-lab/                   4 manual drivers for individual AI Lab steps
|   +-- pretext-components/       1 gallery driver
|   (`_verify-dashboard-tmp.mjs` and its `.bak` are a dead Playwright scratch
|    file with a hardcoded npx cache path. Not wired to any script. Delete them.)
|
+-- docs/                         Planning docs, specs, and this Constitution.
|   +-- constitution/             STYLE.md + the chapters
|   +-- designs.md/               apollo.md, the bundled public sample document
|
+-- data/                         LOCAL PERSISTENCE (mostly gitignored)
|   +-- uploads/                  design.md documents. *.md is gitignored;
|   |                             only .gitkeep and one overrides sidecar tracked.
|   +-- cloud/                    JSON fallback for the SaaS tables. documents.json,
|   |                             orgs.json, governance-events.json tracked;
|   |                             api-keys.json gitignored.
|   +-- public-share/             one JSON per public share link. Gitignored.
|
+-- .blocksmith/                  GITIGNORED WRITABLE ROOT. blocks/, registry/,
|                                 locks/, runs/, design/, targets/, activity/,
|                                 governance/, scan-facts/, ai-lab/, index.json,
|                                 catalog.json, blocksmith.lock
|
+-- fixtures/                     Checked-in vendor repos for the verify scripts.
|   +-- vendor-ui/                the primary fake customer (has DESIGN.md,
|   |                             src/, blocksmith.config.json, scan-snapshot.md)
|   +-- external-mini/            a second, smaller vendor for verify:external-vendor
|   +-- storybook-static/         an index.json for the Storybook adapter
|
+-- supabase/                     schema.sql, setup.sql, schema-orgs.sql,
|                                 schema-registry.sql, schema-deviations.sql,
|                                 schema-governance-events.sql. Applied by hand.
|
+-- public/schema/                The four published JSON Schemas, served at
|                                 /schema/*.json. COPIES of packages/protocol/schemas/;
|                                 kept in sync by protocol:sync-schemas and
|                                 guarded by the drift gate.
|
+-- examples/                     acme-minimal.blocks.v1.json + a sample GH workflow
+-- extension/                    Chrome MV3 "BlockSmith Capture". 5 files. Captures
|                                 up to 4 tab screenshots and POSTs them to
|                                 /api/ingest/capture. Unpacked dev extension,
|                                 never packed or published.
+-- figma-plugin/                 "BlockSmith Annotate". 4 files. Walks the selection
|                                 (11 node types, capped at 250), exports up to 4
|                                 JPG previews, POSTs to /api/v1/figma/annotations/
|                                 propose, writes approved proposals back as native
|                                 Figma annotations. API key lives in Figma
|                                 clientStorage, never in the document.
+-- font-generator/               A SEPARATE, NESTED Next.js APP. See below.
+-- ui/                           A vendored clone of the shadcn/ui repo (9,862 files,
|                                 its own .git and pnpm workspace). Reference material
|                                 only; nothing in src/ imports it. It is NOT in the
|                                 root tsconfig exclude list, and 3,991 of its files
|                                 are currently pulled into the root TypeScript
|                                 program. See the open questions.
+-- components/                   One stray file (custom-sidebar-trigger.tsx).
|                                 shadcn's components.json aliases point at
|                                 @/components (src/components), so this root
|                                 directory is vestigial.
+-- .github/workflows/            validate-ui.yml, protocol-conformance.yml,
|                                 production-goals.yml
+-- .githooks/                    pre-commit (runs 7 verify scripts + governance),
|                                 post-commit (appends to the activity ledger).
|                                 Opt in with: git config core.hooksPath .githooks
+-- blocksmith.config.json        BlockSmith scanning ITSELF (workspaceId,
|                                 scanPaths, exportSnapshot)
+-- components.json               shadcn config: new-york, rsc, lucide, four
|                                 third-party registries (@efferd, @tailark,
|                                 @reui, @blocks-so)
+-- next.config.ts, tsconfig.json, eslint.config.mjs, postcss.config.mjs
+-- instrumentation.ts, instrumentation-client.ts, sentry.{server,edge}.config.ts
```

### `src/lib/` in one table

Every subdirectory, what it does, and who calls it.

| Directory | Purpose | Main entry points | Called by |
|---|---|---|---|
| `activity/` | Append-only per-document work ledger at `.blocksmith/activity/<doc>/activity.jsonl` | `appendActivity`, `listActivity`, `logActivityFromCommit` | MCP `log_component_work`, `/api/wiki/activity`, post-commit hook |
| `ai/` | Prompt construction, layout generation, the governed-vs-ungoverned engine | `generateAiLayout`, `runGovernedGenerate`, `buildDesignContext` | `/api/ai/*`, demo showcase |
| `apollo/` | Wiki chrome theming (name is legacy, the code is brand-agnostic) | `buildWikiChromeCss`, `applyThemeToDocument` | wiki theme components, `useVisualizeStyle` |
| `auth/` | Who is signed in; GitHub provider token | `getSupabaseUser`, `getGithubSession`, `useSupabaseSession` | 20+ routes and pages |
| `blocks/` | The domain vocabulary plus the block store. Where INGEST physically happens. | `blocksFromDesignSystem`, `persistBlocksForDoc`, `ensureDocBlocks`; `types.ts` is the most-imported module in the repo | everything |
| `clients/` | The document loader and parser router | `prepareDesignSystemDoc`, `loadDesignSystem`, `listAllDocSources` | ~44 importers |
| `cloud/` | The SaaS control plane: orgs, roles, API keys, ACL, deviations, audit, rate limits | `requireDocumentAccess` (21 routes), `saasStrictMode`, `authenticateApiKey`, `checkRateLimit` | every mutating route |
| `codegen/` | Pulse: scan markdown to a real npm package | `generatePulsePackage`, `runPulseCodegen` | `/api/v1/codegen/pulse`, MCP, `codegen:pulse` |
| `cursor/` | Build the one-click `cursor://` MCP install deeplink | `buildCursorMcpDeeplink` | `CursorMcpInstall.tsx` |
| `dashboard/` | Project list, create, rename, delete, AI generation, Redis metadata cache | `listDashboardProjects`, `createStarterProject`, `registerOwnedProject` | `/dashboard`, `/api/projects/*` |
| `design-ir/` | The theme compiler: document to validated `DesignIR` of `--wiki-*` variables | `compileDesignIR`, `ensureDesignIRWithFonts`, `flattenIRToCssProperties` | wiki page, studio, previews |
| `design-tokens/` | Legacy role-to-value heuristics plus the Style Dictionary bridge | `bodyFontFamily`, `buildStyleDictionaryTargets` | `semantic-resolve`, `compile-device` |
| `email/` | Resend-backed org invite delivery | `sendOrgInvite` | `/api/v1/orgs/invite` |
| `figma/` | Figma import, normalization, and token/component drift | `assembleFigmaImport`, `driftFigmaAgainstScan`, `computeComponentDrift` | `/api/figma/*`, MCP |
| `fonts/` | Map design-doc typography rows to real Google Fonts | `pickGoogleFontSpec`, `compileFontStacksWithResolutions` | design-ir, wiki font components |
| `format/` | Five lines of date-fns wrappers | `formatDate` | UI |
| `governance/` | The deviation linter: exactly four rules | `checkGovernanceDiff`, `findOffTokenColors`, `scanProseViolations` | MCP, CI gate, git hook, `/api/v1/governance/events` |
| `ingest/` | Screenshot capture and the Storybook adapter | `extractDesignMarkdownFromImages`, `graphFromStorybook` | `/api/ingest/capture`, `ingest:storybook` |
| `ir/` | The Design CI/CD control plane: registry, lock, promote, rollback, diff, runs, cloud mirror, compile targets | `recordIngest`, `promoteBlock`, `buildLock`, `verifyLock`, `listGovernedBlocks` | pipeline routes, MCP, CI |
| `markdown/` | One 12-line frontmatter wrapper | `parseMarkdownFrontmatter` | scan parse, sync status, dashboard |
| `mcp/` | The MCP server definition and the stateless HTTP transport | `createBlocksmithMcpServer`, `handleRemoteMcpRequest` | `npm run mcp`, `/api/mcp` |
| `parser/` | Markdown readers for non-scan documents plus the surgical markdown writer | `parseApolloMarkdown`, `parseGenericMarkdown`, `modifyMarkdownBlock`, `replaceSectionBody` | registry router, finalize, source |
| `pretext-components/` | Adapter from in-repo types to the spun-out layout package | `buildComponentGallery` | `/studio`, live previews |
| `public-share/` | Public single-block share links. **The one purely local-disk subsystem.** | `createShare`, `recordOpinion` | `/api/share/*`, `/share/[id]` |
| `runtime/` | Where it is safe to write on this host | `blocksmithWritableRoot`, `skipLocalScanAudit` | every disk writer |
| `scan/` | The deterministic repo-to-design-system pipeline plus the markdown round trip. 29 files, the largest module. | `runScanService`, `scanAndPersist`, `workspaceScanToMarkdown`, `parseWorkspaceScanMarkdown`, `extractComponentInterface` | 51 importers |
| `supabase/` | Client factories (browser, cookie-bound server, service-role admin) and object storage | `getSupabaseAdmin`, `supabaseUploadMarkdown`, `SCAN_DOCS_BUCKET` | cloud/*, uploads/persist |
| `sync/` | The in-process event bus and the chokidar file watcher | `emitSync`, `startWatcher` | `/api/sync/events` |
| `uploads/` | Three-tier document persistence: memory, local disk, Supabase | `persistUploadMarkdown`, `hydrateUploadMarkdown`, `saveMarkdownUpload`, `safeUploadFileName` | ~40 importers |
| `visual/` | Browser-only DOM measurement (what actually rendered vs what the tokens claim) | `readComputedSnapshot` | wiki inspectors |
| `visualize/` | Read-only accessors over `DesignIR.preview` | `previewAccentColor` | spacing pages |
| `wiki/` | Doc query param, lifecycle, edit policy, markdown export, nav normalization | `resolveDocParam`, `getDocLifecycle`, `canEditDoc`, `generateDesignSystemMarkdown` | ~25 importers |

### `src/lib/ir` versus `src/lib/design-ir`

These two directories sound identical and are completely unrelated. They never import each other. Their only shared dependency is `src/lib/blocks/types.ts`. Learn the difference on day one.

|  | `src/lib/ir/` | `src/lib/design-ir/` |
|---|---|---|
| Question it answers | Which version of a fact is true | What does the fact look like on screen |
| Central type | `BlocksmithGraphV1` / `BlocksmithBlockV1` | `DesignIR` = `z.infer<typeof designIRSchema>` |
| Unit | one block | one whole document's compiled theme |
| Validation | hand-written TS mirroring the published JSON Schemas | zod, on read and on write |
| Versioning | per-block monotonic integers, `official` pointer, lock file | cache invalidation only (content hash plus `DESIGN_IR_COMPILER_REV`) |
| Persisted at | `.blocksmith/registry/`, `.blocksmith/locks/`, `.blocksmith/runs/` plus Supabase | `.blocksmith/design/<doc>/ir.json`, disk only |
| Analogy used in the code's own comments | npm registry plus package-lock.json | a compiler pass |

### The nested `font-generator` app, and the gotcha

`font-generator/` is **a separate, standalone Next.js application** living inside this repository. It runs on port 3939, has its own `package.json`, its own `node_modules`, its own dependency set (`harfbuzzjs`, `opentype.js`, `lottie-web`), and its own `.claude/skills`. It is a prompt-driven variable-font studio: it instantiates real open-licensed variable fonts by picking a base family and adjusting real OpenType axes, rather than synthesizing glyphs from scratch.

It is also, structurally, an **unregistered git submodule**. `git ls-files -s font-generator` shows mode `160000` (a gitlink) but there is no `.gitmodules` file. The same is true of `ui/`, which is a vendored clone of the shadcn/ui repository kept as reference material.

**The gotcha:** `font-generator` must be excluded from the root `tsconfig.json`, or the production build fails. The root tsconfig's `include` is `["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"]`, which would otherwise sweep in the nested app's sources, which target a different React version and a different set of ambient types. The fix is in the `exclude` list:

```json
"exclude": ["node_modules", "packages/cli", "packages/sdk", "font-generator"]
```

This was a real production break, fixed in commit `60cdd31` ("fix(build): exclude nested font-generator app from root tsconfig"). `packages/cli` and `packages/sdk` are excluded for the same reason: they are built by their own compilers (esbuild and `tsc` respectively) against their own tsconfigs.

If you add another nested app, add it to that exclude list in the same commit.

---

## 5. Route inventory

Chapter filenames in `docs/constitution/` follow `NN-topic.md`. At the time this chapter was written, only `STYLE.md` and this file existed, so the "Covered in" column below is the planned table of contents rather than a set of live links. Treat forward references as a promise, not a fact.

### Page routes

| Route | Purpose | Auth | Covered in |
|---|---|---|---|
| `/` | Landing page (`HomeStudio`) for logged-out visitors; redirects to `/dashboard` when a Supabase session exists | none | Ch. 12, the product surfaces |
| `/dashboard` | Signed-in home base: prompt bar plus project grid, tenant-scoped to the caller's org | session (hosted); open locally | Ch. 12 |
| `/dashboard/analytics` | Usage and governance charts | session | Ch. 12 |
| `/dashboard/connectors` | Figma, GitHub, MCP, extension connection status | session | Ch. 09, ingest adapters |
| `/dashboard/settings` | Org, members, API keys, governance tiers | session plus role | Ch. 11, tenancy and RBAC |
| `/wiki/[[...slug]]` | The wiki. One catch-all rendering roughly 21 pages across 3 parser modes | doc ACL via `assertWikiDocAccess`; middleware redirects logged-out visitors of a private doc to sign-in | Ch. 08, the wiki |
| `/studio` | Pretext-accurate component gallery for a document | doc ACL | Ch. 08 |
| `/share/[shareId]` | Public single-block view with approve / unsure / reject | public by link | Ch. 12 |
| `/sites/[slug]` | An org's public site listing its published wikis | public | Ch. 11 |
| `/protocol` | Spec site overview, the TCP/IP analogy | public | Ch. 07, the protocol |
| `/protocol/blocks.v1` | The graph and block spec | public | Ch. 07 |
| `/protocol/lock.v1` | The lock file, staleness, pull flow | public | Ch. 07 |
| `/protocol/registry.v1` | Version model and promote semantics | public | Ch. 07 |
| `/protocol/adapters` | Ingest adapter registry table | public | Ch. 07 |
| `/protocol/targets` | Compile target registry table | public | Ch. 07 |
| `/protocol/conformance` | How a third party runs the suite | public | Ch. 07 |
| `/demo/investor` | The 90-second pipeline demo, self-seeding | public | Ch. 10, the pipeline |
| `/demo/pulse` | Renders the generated `@blocksmith/acme-ui-kit` package | public | Ch. 13, codegen |
| `/demo/device` | Device simulator: the graph on embedded frames | public | Ch. 13 |
| `/figma` | Figma connect and import page | session | Ch. 09 |
| `/privacy`, `/terms` | Legal | public | n/a |

The wiki sub-routes handled inside the single catch-all are: `introduction`, `source`, `components`, `components/buttons`, `inventory`, `guidelines`, `governance`, `sync`, `releases`, `pipeline`, `demo`, `playground`, and the `foundation/*` family (`color`, `typography`, `spacing`, `css-vars`, `styles`, `surfaces`, `layout`, `imagery`, `agent-guide`). Which of those render depends on the document's parser mode (`workspace-scan`, `generic`, or `apollo`) and on its lifecycle. Preview documents (paste, upload, bundled samples) get an honest empty state on `pipeline` and `releases` rather than fake production cards.

### API routes

Auth column vocabulary: **none** means no credential is checked in the handler; **session** means a Supabase cookie session via `getSupabaseUser()`; **API key** means `Authorization: Bearer bs_live_...` via `requireApiKey()`; **doc ACL** means `requireDocumentAccess()`, which resolves an actor (API key wins over session) and then applies the default-deny document ACL; **actor** means `resolveActor()` accepting either credential. Note that `src/middleware.ts` adds a coarse gate on top in strict mode: every `/api/v1/*` call and every mutating `/api/wiki/*` call must carry some credential before the handler even runs.

| Route | Method | Purpose | Auth | Covered in |
|---|---|---|---|---|
| `/api/ai/governed-generate` | POST | Runs one prompt twice, governed and ungoverned, and scores the drift with the same color linter CI uses. `maxDuration = 120`. | session + doc ACL + AI rate limit | Ch. 14, AI Lab |
| `/api/ai/layout` | POST | Generate wiki chrome (`--wiki-*` variables) for a document with one or an ensemble of LLM passes. `maxDuration = 120`. | none; requires `NVIDIA_API_KEY` | Ch. 14 |
| `/api/ai/status` | GET | Whether AI Lab is configured on this server | none | Ch. 14 |
| `/api/auth/github/repos` | GET | List the signed-in user's GitHub repositories via the OAuth provider token | session with GitHub provider token | Ch. 09 |
| `/api/auth/github/status` | GET | Whether a usable GitHub provider token is present | session | Ch. 09 |
| `/api/design-system` | GET | The full parsed `DesignSystem` as JSON, for non-MCP tools and CI | none | Ch. 08 |
| `/api/figma/connect` | POST | Fetch a Figma file by key or URL, extract tokens and components, optionally enrich with vision, write a scan-shaped document. `maxDuration = 60`. | gated | Ch. 09 |
| `/api/figma/drift` | POST | Reconcile a Figma library against a code scan: "Figma says X, code says Y" | doc ACL | Ch. 09 |
| `/api/figma/import` | POST | Import a raw Figma variables payload into a document | session + strict-mode gate | Ch. 09 |
| `/api/figma/webhook` | POST | Figma V2 webhook. Re-imports on file change. | `FIGMA_WEBHOOK_PASSCODE`, compared with `timingSafeEqual` | Ch. 09 |
| `/api/ingest/capture` | POST | Browser-extension screenshots to a design document via a vision model. `maxDuration = 60`. | session in strict mode + AI rate limit + doc ACL for supplemental captures | Ch. 09 |
| `/api/mcp` | POST, GET, DELETE | Remote MCP over Streamable HTTP. A new server and transport per request, stateless. | API key | Ch. 15, MCP |
| `/api/projects/create` | POST | Create a project from a name, optionally AI-generated from a prompt. `maxDuration = 60`. | session in strict mode + AI rate limit | Ch. 12 |
| `/api/projects/delete` | POST | Delete a project (upload plus registry record) | doc ACL (owner or admin) | Ch. 12 |
| `/api/projects/generate-image` | POST | Generate a design system from a UI screenshot. `maxDuration = 90`, 8 MB data URL cap. | session in strict mode + AI rate limit | Ch. 12 |
| `/api/projects/rename` | POST | Rename a project (frontmatter plus H1) | doc ACL | Ch. 12 |
| `/api/scan/workspace` | POST | The browser-facing scan entry. Modes: fixture, github, workspace, clientScan. `maxDuration = 60`. | API key or GitHub session + scan rate limit | Ch. 09 |
| `/api/share` | POST | Mint a public share link for one block | doc ACL (read) | Ch. 12 |
| `/api/share` | GET | Look up an existing share for a block | doc ACL | Ch. 12 |
| `/api/share/[id]` | GET | Fetch a share record | public | Ch. 12 |
| `/api/share/[id]/opinion` | POST | Record approve / unsure / reject plus an optional comment | public | Ch. 12 |
| `/api/share/[id]/view` | POST | Increment the view counter | public | Ch. 12 |
| `/api/supabase/health` | GET | Storage reachability probe | none | Ch. 16, hosting |
| `/api/sync/events` | GET | Server-Sent Events stream of `blocks.updated`. Starts the chokidar watcher as a side effect. 30 s heartbeat. `runtime = "nodejs"`. | none | Ch. 17, the handshake |
| `/api/sync/github-rescan` | POST | Re-scan a GitHub-backed document in place. `maxDuration = 60`. | doc ACL + GitHub session | Ch. 09 |
| `/api/sync/rescan` | POST | Re-scan a server-side workspace path, guarded by `isAllowedServerWorkspacePath` | doc ACL | Ch. 09 |
| `/api/sync/scan-status` | GET | Is this scan document stale relative to its workspace | none | Ch. 17 |
| `/api/sync/status` | GET | Watcher status plus block-store index, for the Sync page and MCP parity | none | Ch. 17 |
| `/api/v1/auth/keys` | POST, GET | Admin key minting and prefix listing | `BLOCKSMITH_ADMIN_SECRET` header | Ch. 11 |
| `/api/v1/auth/keys/me` | GET, POST, DELETE | Self-serve API keys for a signed-in user (CLI pull, scan, MCP) | session | Ch. 11 |
| `/api/v1/codegen/pulse` | POST | Generate `@blocksmith/<slug>` from a workspace-scan document | API key | Ch. 13 |
| `/api/v1/deviations` | POST, GET | File and list conscious deviations | API key or session + org scope | Ch. 10 |
| `/api/v1/deviations/[id]` | PATCH | Approve, reject, or resolve a deviation | actor + RBAC | Ch. 10 |
| `/api/v1/deviations/budget` | GET | Remaining deviation budget for a pusher | actor | Ch. 10 |
| `/api/v1/figma/annotations/propose` | OPTIONS, POST | LLM-proposed annotations for the Figma plugin. `maxDuration = 60`. CORS preflight. | actor + AI rate limit | Ch. 09 |
| `/api/v1/governance/events` | POST, GET, PATCH | Record, list, and acknowledge governance violations. This is what `blocksmith check` posts to. | API key or session + doc ACL | Ch. 10 |
| `/api/v1/governance/settings` | GET, PATCH | Per-org governance tiers and deviation TTL | session + RBAC | Ch. 10 |
| `/api/v1/lock` | GET | The `blocksmith.lock` artifact for a document | API key + doc ACL | Ch. 10 |
| `/api/v1/me` | GET | Verify an API key. This is `blocksmith whoami`. | API key | Ch. 11 |
| `/api/v1/orgs/invite` | POST | Invite a member by email (Resend, or saved without delivery) | session + admin role | Ch. 11 |
| `/api/v1/orgs/me` | GET | Current workspace org plus members. Auto-creates a personal org. | session | Ch. 11 |
| `/api/v1/orgs/members` | DELETE | Remove a member | session + admin role | Ch. 11 |
| `/api/v1/scans` | POST | The unified scan backend for CLI and SDK | API key + scan rate limit | Ch. 09 |
| `/api/v1/scans/pull` | GET | The `blocksmith pull` payload: `DESIGN.md`, overrides, lock | API key + doc ACL | Ch. 17 |
| `/api/wiki/activity` | GET | The component activity ledger for a document | none | Ch. 08 |
| `/api/wiki/export` | GET | Export the wiki as a markdown file or JSON | none | Ch. 08 |
| `/api/wiki/finalize` | POST | Write a wiki edit back into the markdown and overrides, promote the block, refresh the lock, mirror to cloud | doc ACL + pipeline rate limit | Ch. 17 |
| `/api/wiki/governance/draft` | POST | LLM drafts a component role plus do's and don'ts from a human prompt | doc ACL; requires `NVIDIA_API_KEY` | Ch. 14 |
| `/api/wiki/governance/violations` | GET, PATCH | List and acknowledge violations for a document (wiki UI) | doc ACL | Ch. 10 |
| `/api/wiki/import` | GET, POST | List the caller's uploads; import pasted or uploaded markdown | session (strict mode refuses anonymous listing) | Ch. 09 |
| `/api/wiki/pin-lock` | POST | Write `blocksmith.lock` when everything is official and no lock exists | doc ACL + pipeline rate limit | Ch. 10 |
| `/api/wiki/pipeline` | GET | One payload for the whole pipeline console: lanes, lock, runs, counts | doc ACL | Ch. 10 |
| `/api/wiki/pipeline/diff` | GET | Production versus staging content per block, feeding the diff drawer | doc ACL | Ch. 10 |
| `/api/wiki/pipeline/demo` | POST | Re-seed the synthetic investor demo registry (`demo:investor.md` only) | none by design; touches no customer data | Ch. 10 |
| `/api/wiki/promote` | POST | Promote selected blocks to production | doc ACL + pipeline rate limit | Ch. 10 |
| `/api/wiki/publish` | GET, POST | Read and set the published flag that exposes a wiki on the org's public site | session + admin role | Ch. 11 |
| `/api/wiki/releases` | GET | The full release table, or one row for a block badge | doc ACL | Ch. 10 |
| `/api/wiki/rollback` | POST | Move `official` back to the previous finalized version | doc ACL + pipeline rate limit | Ch. 10 |
| `/api/wiki/source` | GET, POST | Read and write the raw markdown of a document section | doc ACL | Ch. 08 |

---

## 6. The npm scripts inventory

There is no test runner. These scripts are the contract.

### Development and build

| Script | What it does | When you run it |
|---|---|---|
| `dev` | `node scripts/dev.mjs`. Kills any stale `next dev`, then starts one process on port 3000. | Always. Do not run `next dev` directly. |
| `dev:clean` | Same, plus wipes `.next`. | When you see missing-chunk errors in the browser. |
| `clean` | `rm -rf .next node_modules/.cache` | After a corrupted cache. |
| `build` | `guard-build.mjs` then `ensure-pulse.mjs` then `next build`. The guard **refuses to build while `next dev` is running**, because that corrupts `.next`. Skipped on CI. | Before deploying, or to reproduce a Vercel failure. |
| `build:clean` | `clean` then `next build` | When `build` fails mysteriously. |
| `build:pulse` | `codegen:pulse`, then `npm install --ignore-scripts --include=dev` (to link the new `file:` workspace), then build `pulse-runtime` and the generated kit. | Rarely by hand. |
| `postinstall` | `ensure-pulse.mjs`. Exits immediately if `packages/generated/acme-ui-kit/dist/index.js` exists; otherwise runs `build:pulse`. Sets `BLOCKSMITH_ENSURE_PULSE=1` first to prevent infinite recursion (the inner `build:pulse` itself runs `npm install`). | Automatic. This is why a fresh clone works despite `packages/generated/` being gitignored. |
| `start` | `next start` | Production smoke on a local build. |
| `lint` | `next lint` | Before pushing. |
| `typecheck` | `tsc --noEmit` | Constantly. First step of `verify:software`. |

### Scan and ingest

| Script | What it does |
|---|---|
| `scan` | Scan `BLOCKSMITH_WORKSPACE` (or this repo), optionally run the LLM curator, write `data/uploads/scan-*.md`. |
| `scan:vendor` | The same against `fixtures/vendor-ui` with curation forced off. Deterministic. |
| `ingest:storybook` | Compile a `storybook-static` build into a `blocks.v1` graph. Proves the protocol is not BlockSmith-shaped. |
| `mcp` | Run the MCP server on stdio for a local Cursor install. |
| `mcp:probe` | Assert that governance actually arrives through the connector rather than through repo files. |

### Codegen and compile

| Script | What it does |
|---|---|
| `codegen:pulse` | Scan markdown to `packages/generated/<slug>/`: `package.json`, `tsconfig.json`, `src/tokens.css`, `src/tokens.ts`, `src/index.ts`, one `.tsx` per component. |
| `compile:device` | The official graph to `.blocksmith/targets/<doc>/device-<frame>.json`, `tokens.h`, `tokens.css`, `tokens.json`. |
| `protocol:sync-schemas` | Copy `packages/protocol/schemas/*` to `public/schema/*`. One source of truth. |
| `build:sdk`, `build:cli`, `build:packages` | `tsc` for the SDK; esbuild for the CLI (which inlines the SDK from source); both. |

### Verify (the test suite)

`npm run verify:software` is the gate you run before every push. It chains, in order: `typecheck`, `scan:verify`, `verify:scan-wiki`, `verify:wiki`, `verify:vendor-fixture`, `verify:vendor-e2e`, `verify:handshake-writeback`, `verify:handshake-pull`, `verify:handshake-acceptance`, `verify:sync-conflict`, `verify:saas-acl`, `verify:security-gate`, `verify:org-rbac`, `verify:governance-e2e`, `verify:governance-tiers`, `verify:mcp-sync`, `verify:component-interface`, `verify:pulse`.

| Script | Asserts | Network |
|---|---|---|
| `scan:verify` | The published scan markdown's inventory matches the deterministic scan facts | local |
| `verify:scan-wiki` | End-to-end workspace-scan wiki correctness | local |
| `verify:wiki` | Comprehensive wiki markdown parses with a document-driven nav, not the Apollo skeleton | local |
| `verify:vendor-fixture` | Workspace scan works outside BlockSmith itself, no LLM | local |
| `verify:vendor-e2e` | Full vendor scan: `scanAndPersist` to published markdown on disk to a consistent wiki parse | local |
| `verify:external-vendor` | A second vendor repo (`fixtures/external-mini`) | local |
| `verify:github-scan` | Clone, scan, persist, parse against a real GitHub repo | **network** |
| `verify:scan-backend` | The unified scan service, path guards, client upload, GitHub URL parsing | local |
| `verify:component-interface` | The structural interface extractor across real-world component shapes | local |
| `verify:handshake-writeback` | Web-to-IDE writeback for workspace-scan documents | local |
| `verify:handshake-pull` | Finalize, then the pull payload, then `DESIGN.md` on disk | local |
| `verify:handshake-acceptance` | The automated checks for `docs/08-web-ide-handshake.md` | local |
| `verify:sync-conflict` | Conflict detection when a scan document changes under an open wiki draft | local |
| `verify:saas-acl` | Document ownership and strict-mode ACL gates | local |
| `verify:security-gate` | Default-deny: unregistered private documents are refused, the named demo and bundled samples stay public, anonymous import listing is refused | local |
| `verify:org-rbac` | Roles, invites, document access | local |
| `verify:governance-e2e` | Governance finalize, pull, `DESIGN.md`, without an LLM | local |
| `verify:governance-tiers` | The three-tier loop: detect (block and warn), record event, resolve | local |
| `verify:governance-copilot` | The copilot drafts a role and description from a prompt | **LLM** |
| `verify:mcp-sync` | MCP `get_sync_status` includes workspace-scan stale and hosted fields | local |
| `verify:pulse` | Codegen runs, the generated package builds, and four anti-stub guards hold | local |
| `verify:ir-cicd` | The Design CI/CD closed loop: ingest, promote, lock, verify, drift | local |
| `verify:design-ir` | Golden checks for the Design IR compiler | local |
| `verify:modify-tokens` | Token and introduction writeback | local |
| `verify:figma-import` | The Figma import wedge end to end | local |
| `verify:supabase` | Supabase storage smoke test | **network** |
| `verify:cloud-api` | Cloud API plus SDK smoke test, no HTTP server required | local |
| `verify:patterns-live` | Live HTTP test of the CLI, SDK, and MCP patterns | **needs `npm run dev`** |
| `verify:production-smoke` | Post-deploy smoke against the live origin | **network** |
| `verify:production-goals` | Public-route production checks after a merge to main | **network** |
| `verify:workable` | `verify:software` plus Supabase plus cloud API plus artifact checks | mixed |
| `verify:goal1` / `verify:goal1:full` | The scan goal bundle; `:full` adds the GitHub scan | mixed |
| `protocol:conformance` | `conformance/run.ts` (public fixtures and golden hash vectors) then `conformance/drift.ts` (app hash implementation versus package, schema copies identical, live registry output validates) | local |
| `verify-mcp-accept.ts` | POSTs a Cursor-style MCP `initialize` to `/api/mcp`. **Not wired to any npm script**; run it with `tsx` by hand. | needs `npm run dev` |

Three warnings about the verify suite.

**Some scripts depend on gitignored state.** `data/uploads/*.md`, `data/cloud/api-keys.json`, and all of `.blocksmith/` are gitignored, yet `verify:design-ir`, `scan:verify`, and `verify:scan-wiki` read published uploads. On a fresh clone they pass only after a scan has run. `verify:goal1` regenerates the fixture document first, which is why it is the safe bundle to run on a new machine.

**Env loading is copy-pasted.** An identical twelve-line `loadEnvLocal()` appears in at least nine scripts. If `.env.local` parsing ever needs to change, it changes in nine places.

**`verify:pulse` runs `npm install`.** It is the only "local" verify script that touches the network, because relinking the generated `file:` workspace requires it.

### Gates, publishing, and AI Lab drivers

| Script | What it does |
|---|---|
| `governance:check` | Fails the commit when changed UI code introduces colors that are not tokens. Wired into `.githooks/pre-commit`. |
| `validate:ui` | The CI gate. Stage 1 lock freshness, stage 2 off-token colors on added diff lines. Run by `.github/workflows/validate-ui.yml`. |
| `activity:from-commit` | Appends real commit activity to the per-document ledger. Wired into `.githooks/post-commit`. |
| `publish:packages` | Builds and publishes `@block-smith/cli` to npm. Supports `--dry-run` and `--otp`. |
| `publish:packages:dry-run` | Preview the tarball, publish nothing. |
| `ai-lab:chrome`, `ai-lab:normalize`, `ai-lab:previews`, `ai-lab:fonts` | Manual drivers for individual AI Lab steps. Each takes a doc ref. |
| `pretext-components:test` | Renders the component gallery through the layout package. |

---

## 7. Runtime and hosting

Production is Vercel, at `https://blocksmith-mocha.vercel.app`. Everything awkward in this codebase traces back to three constraints of that environment.

### Constraint 1: the filesystem is read-only except `/tmp`, and `/tmp` is ephemeral

Vercel gives each serverless invocation a read-only application bundle and a small, per-instance `/tmp` that vanishes when the instance recycles. BlockSmith's entire local persistence model assumes a writable `.blocksmith/` next to the source. The reconciliation is `src/lib/runtime/writable-root.ts`, thirty lines:

```ts
export function isServerlessHosted(): boolean {
  return process.env.VERCEL === "1" || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
}
export function blocksmithWritableRoot(): string {
  if (isServerlessHosted()) return join(tmpdir(), "blocksmith");
  return join(process.cwd(), ".blocksmith");
}
export function skipLocalScanAudit(): boolean { return isServerlessHosted(); }
export function canWriteWorkspaceSnapshot(workspaceRoot: string): boolean { /* refuse fixtures/ on hosted */ }
```

Every disk writer goes through it: `blocks/store.ts`, `ir/lock.ts`, `ir/registry.ts`, `ir/pipeline-runs.ts`, `ai-lab/09-scan-curate/store.ts`. On serverless those become `/tmp/blocksmith/*` and are treated as a **cache, not storage**. Two consequences follow:

- `skipLocalScanAudit()` turns the scan-facts and curator cache into a no-op on hosted deploys, because writing megabytes of facts into a tiny `/tmp` is pointless.
- `src/lib/ir/cloud-registry.ts` exists purely to make the registry durable: it mirrors every registry write into Postgres (micro-batched with a 25 ms `setTimeout` per document, chunked at 200 rows per upsert) and hydrates a cold `/tmp` from the cloud before reads. `ensurePipelineRegistry()` in `src/lib/ir/ensure-pipeline-registry.ts` documents the rule: hydrate from cloud, rebuild from markdown only if still empty, and never push back on a read path, because cold document load has a sub-three-second budget.

**One subsystem did not get the memo.** `src/lib/design-ir/store.ts` computes its root as `join(process.cwd(), ".blocksmith")` directly rather than via `blocksmithWritableRoot()`, so it has no `/tmp` fallback. `ensure.ts` catches the write failure and returns an in-memory IR instead, so the theme still compiles, just without a cache. `src/lib/public-share/store.ts` is worse: it writes `data/public-share/<id>.json` with no cloud path at all, which means **public share links do not survive on Vercel**. Both are known gaps, listed in the open questions.

### Constraint 2: `maxDuration`

Vercel kills a serverless function at a plan-dependent ceiling. Long routes declare their budget explicitly, and Next.js requires the value to be a static literal (there is a comment in `src/app/api/ai/layout/route.ts` making that point). The declared budgets:

| Route | `maxDuration` | Why |
|---|---|---|
| `/api/ai/governed-generate`, `/api/ai/layout` | 120 | Two or more LLM passes |
| `/api/projects/generate-image` | 90 | Vision inference |
| `/api/figma/connect`, `/api/figma/webhook`, `/api/ingest/capture`, `/api/scan/workspace`, `/api/sync/github-rescan`, `/api/projects/create`, `/api/v1/figma/annotations/propose` | 60 | Network fetch, clone, or one LLM pass |

Anything without a declaration takes the platform default. If you add a route that clones a repo or calls a model, declare a budget in the same commit.

### Constraint 3: no long-lived process, no shared memory

The chokidar file watcher (`src/lib/sync/watcher.ts`) and the in-process event bus (`src/lib/sync/events.ts`) are fundamentally local-development machinery. Both are stashed on `globalThis` (`__blocksmithWatcher`, `__syncBus`) so they survive hot module replacement. The watcher is started lazily from `GET /api/sync/events` rather than from `instrumentation.ts`, precisely so that `chokidar`, `fs`, and `crypto` never get pulled into the instrumentation client bundle. `next.config.ts` also lists `chokidar` in `serverExternalPackages` for the same reason.

For hosted multi-instance sync, `emitSync()` does a dual dispatch: an in-process emit **and** a fire-and-forget publish to a Supabase Realtime broadcast channel (`blocksmith:sync`, event `blocks.updated`). That is the only cross-instance signal in the system.

Rate limiting has the same shape. `src/lib/cloud/rate-limit.ts` uses Upstash Redis fixed-window counters when configured and a process-local `Map` when not, because a per-instance map on serverless enforces nothing.

### The other pieces of the runtime

There is **no `vercel.json`** in the repo, and no `images` configuration in `next.config.ts`. All imagery is local files under `public/`. Every timeout is a per-route `export const maxDuration`, which is the only place a budget is declared.

**Next.js configuration** (`next.config.ts`). Notable: `reactStrictMode: true`; `poweredByHeader: false`; a five-header security block applied to every path (`X-Content-Type-Options`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy`, and a two-year HSTS with preload); `transpilePackages: ["@blocksmith/pulse-runtime", "@blocksmith/acme-ui-kit"]` so the generated package can be imported directly from TypeScript source; `serverExternalPackages: ["chokidar"]`; matched Turbopack and webpack rules that run `@svgr/webpack` over the `@icon-pkg/streamline-core-line-free` SVGs (the webpack rule must be `unshift`ed ahead of Next's default asset rule, because node_modules SVGs are otherwise skipped); and a dev-only `watchOptions.ignored` covering `.next`, `node_modules`, and `.blocksmith` so the watcher does not fight itself.

**Middleware** (`src/middleware.ts`) does two jobs. First, it sets a per-request nonce-based Content Security Policy on every response, with an explicit `connect-src` allowlist for Supabase, Upstash, Sentry, the GitHub API, and the Figma API. Second, in strict mode only, it is a coarse credential gate: every `/api/v1/*` call and every mutating `/api/wiki/*` call must present either a `Bearer` header or a Supabase auth cookie, and a logged-out visitor to a private wiki document is redirected to sign-in rather than shown a bare 404. The file's own comment is the right framing: it removes the class of bug where someone forgets to call `requireDocumentAccess` on a new route. It is defense in depth, not the actual authorization, and it never touches the database because it runs on the edge.

**Supabase** provides three things: Auth (GitHub OAuth with scopes `read:user user:email repo`, plus email/password and magic link), Postgres (eleven tables), and Storage (the `scan-docs` bucket, private, 2 MB file limit). Three client factories exist and the distinction matters: `createBrowserSupabase()` (anon key, browser), `createUserSupabase()` (anon key bound to request cookies, for reading the session in a server component), and `getSupabaseAdmin()` (service role, bypasses row-level security by design, used by every cloud store). The registry tables have RLS enabled with **no policies at all**, which is deliberate: they are service-role-only and document access is enforced in the application by `requireDocumentAccess`.

**Upstash Redis** does exactly two things and both degrade silently to nothing when unconfigured. First, distributed rate limiting under the `rl:` prefix (see the table below). Second, the dashboard project-metadata cache under `pmeta:<fileName>`, with no TTL, read as a single `MGET`. The rationale is in the file header of `src/lib/dashboard/meta-cache.ts`: in hosted mode the dashboard cannot parse every document's markdown on each load, because that would be N storage downloads. A cache miss degrades to a coarse card, not an error.

| Redis key | Limit env (default) | Window env (default) | Used by |
|---|---|---|---|
| `rl:scan:github:<ip>` | `BLOCKSMITH_SCAN_RATE_LIMIT` (8) | `BLOCKSMITH_SCAN_RATE_WINDOW_MIN` (60 min) | `/api/scan/workspace` |
| `rl:scan:github:user:<userId>` | `BLOCKSMITH_SCAN_RATE_LIMIT_PER_USER` (12) | same | `/api/scan/workspace` |
| `rl:scan:apikey:<keyId>` | `BLOCKSMITH_SCAN_RATE_LIMIT_PER_KEY` (24) | same | `/api/v1/scans` |
| `rl:ai:gen:ip:<ip>` | `BLOCKSMITH_AI_RATE_LIMIT` (10) | `BLOCKSMITH_AI_RATE_WINDOW_MIN` (60 min) | five AI routes |
| `rl:ai:gen:user:<userId>` | `BLOCKSMITH_AI_RATE_LIMIT_PER_USER` (40) | same | five AI routes |
| `rl:pipeline:write:<ip>` | `BLOCKSMITH_PIPELINE_RATE_LIMIT` (120) | hard-coded 10 min | promote, rollback, pin-lock, finalize |

Rate limiting **fails open**. A Redis outage logs a warning and allows the request. That is a deliberate availability choice, and you should know it before you rely on a limit as a security control.

**Sentry** is wired through `instrumentation.ts` (server and edge), `instrumentation-client.ts` (browser), and `sentry.{server,edge}.config.ts`. `tracesSampleRate: 0.1`, `sendDefaultPii: false`, session replay off. `onRequestError = Sentry.captureRequestError` gives App Router server error capture. **Note that `next.config.ts` does not wrap the config with `withSentryConfig`**, so there is no build-time source-map upload and no tunnel route. Stack traces in Sentry will be minified.

`instrumentation.ts` also does something worth copying elsewhere: `warnOnRiskyProdConfig()` logs loudly at startup when production is running without Supabase (data will be lost on an ephemeral filesystem), with Supabase but without `BLOCKSMITH_SAAS_STRICT=1` (tenant isolation is not enforced), or without Upstash (rate limits are per-instance only).

**CI** is three GitHub Actions workflows, all using Node 22 and `npm ci --ignore-scripts` (which deliberately skips `postinstall` and therefore `ensure-pulse`):

- `validate-ui.yml` on any PR touching a UI file: the design gate.
- `protocol-conformance.yml` on PRs and pushes touching `packages/protocol/**`, `src/lib/ir/**`, or `public/schema/**`: the conformance suite plus the hash drift gate.
- `production-goals.yml` on push to main: waits 60 seconds for the Vercel deploy to settle, then runs public-route checks against the live origin. It skips with exit 0 when the `BLOCKSMITH_URL` repo variable is unset, so it never blocks on an unconfigured environment.

**Git hooks** are opt-in (`git config core.hooksPath .githooks`). `pre-commit` runs six verify scripts plus `governance:check` and prints the bypass instructions when it blocks. `post-commit` appends to the activity ledger.

---

## 8. Storage model

There are **three independent switches**, all reducible to two environment facts: whether `SUPABASE_SERVICE_ROLE_KEY` is present, and whether `VERCEL === "1"`.

### Switch 1: documents

Decided by `supabaseStorageEnabled()` (URL plus service-role key). `persistUploadMarkdown()` in `src/lib/uploads/persist.ts` is a **write-through to three tiers**:

```ts
memory.set(safe, { markdown, mtimeMs: Date.now(), savedAt });
let backend: "supabase" | "local" | "both" = "local";
if (supabaseStorageEnabled()) { await supabaseUploadMarkdown(safe, markdown); backend = "supabase"; }
try {
  await mkdir(UPLOADS_ROOT, { recursive: true });
  await writeFile(resolveUploadPath(safe), markdown, "utf-8");
  backend = backend === "supabase" ? "both" : "local";
} catch { /* Vercel, local mirror optional */ }
```

The in-memory `Map` is not an optimization. Its comment reads: "In-memory layer, required on Vercel where disk is ephemeral." Reads go memory, then local disk, then Supabase download, in that order (`hydrateUploadMarkdown`). The synchronous reader `readUploadMarkdownSync()` deliberately throws an instructive error when the cache is cold, naming `hydrateUploadMarkdown()`. That is why `prepareDesignSystemDoc()` must be awaited before `loadDesignSystem()`.

Filenames are always `<sanitized-slug>-<first 8 hex of sha256(markdown)>.md`, capped at 2 MB. `safeUploadFileName()` rejects `..`, any path separator, anything that is not `.md`, and anything failing `/^[\w.-]+\.md$/i`. Because every upload carries a hash suffix, an upload can never spoof a bundled sample name.

Locally: `data/uploads/<file>.md`. Hosted: the `scan-docs` Supabase bucket under the key prefix `uploads/<file>.md`. Same bare filename, different prefix. Sidecar override files (`<name>.wiki-overrides.json`) are uploaded as `text/plain` rather than `application/json`, because the bucket's MIME allowlist rejects the JSON type.

### Switch 2: cloud tables

```ts
export function saasDbEnabled(): boolean { return supabaseStorageEnabled(); }
export function localCloudStoreWritable(): boolean {
  if (process.env.VERCEL === "1") return false;
  return true;
}
```

Every cloud store follows one of two shapes. **Database-exclusive** (`orgs.ts`, `deviations.ts`, `governance-events.ts`): if the database is enabled, use it and return; otherwise use the JSON file. **Database-first with mirror** (`documents.ts`, `api-keys.ts`): write to Postgres, then return early if local disk is not writable. So on Vercel the JSON files are skipped entirely; locally with Supabase configured, both are written and reads prefer the database with a file fallback.

The JSON fallbacks live in `data/cloud/`: `api-keys.json` (gitignored), `documents.json`, `orgs.json`, `governance-events.json`, `deviations.json`. All are `{ version: 1, ... }` and all silently reset on a parse failure. Events and deviations are capped at 500 entries.

### Switch 3: enforcement

```ts
export function saasStrictMode(): boolean {
  if (process.env.BLOCKSMITH_SAAS_STRICT === "0") return false;
  if (process.env.BLOCKSMITH_SAAS_STRICT === "1") return true;
  return process.env.NODE_ENV === "production";
}
```

When strict mode is off, `requireDocumentAccess` returns `{ ok: true, userId: null, isAdmin: true }` and `assertWikiDocAccess` returns immediately. That is single-user local development. In production it defaults on.

### The eleven Supabase tables

| Table | Defined in | Owner module |
|---|---|---|
| `blocksmith_documents` | `schema.sql`, extended by `schema-orgs.sql` | `cloud/documents.ts` |
| `blocksmith_api_keys` | `schema.sql` | `cloud/api-keys.ts` |
| `blocksmith_organizations` | `schema-orgs.sql` | `cloud/orgs.ts` |
| `blocksmith_org_members` | `schema-orgs.sql` | `cloud/orgs.ts` |
| `blocksmith_governance_events` | `schema-governance-events.sql` | `cloud/governance-events.ts` |
| `blocksmith_deviations` | `schema-deviations.sql` | `cloud/deviations.ts` |
| `org_governance_settings` | `schema-deviations.sql` | `cloud/deviations.ts` |
| `blocksmith_block_registry_entries` | `schema-registry.sql` | `ir/cloud-registry.ts` |
| `blocksmith_registry_manifest` | `schema-registry.sql` | `ir/cloud-registry.ts` |
| `blocksmith_block_locks` | `schema-registry.sql` | `ir/cloud-registry.ts` |
| `blocksmith_pipeline_runs` | `schema-registry.sql` | `ir/pipeline-runs.ts` |

Note the inconsistency: `org_governance_settings` is the only table without the `blocksmith_` prefix. There is also no foreign key to `auth.users`; user ids are plain `uuid` columns.

The SQL files are applied **by hand** in the Supabase dashboard. There is no migration runner, no versioning, and no way to tell from the repo which files have been applied to which environment. This is the single largest operational gap in the system.

### What is on disk and nowhere else

| Path | Contents | Survives Vercel? |
|---|---|---|
| `.blocksmith/registry/` | append-only block versions | No, but mirrored to Postgres |
| `.blocksmith/locks/` | per-document lock files | No, but mirrored to Postgres |
| `.blocksmith/runs/` | pipeline audit log, last 200 | No, but mirrored to Postgres |
| `.blocksmith/blocks/` | one JSON per stored block | No; rebuilt from markdown |
| `.blocksmith/design/` | compiled `DesignIR` cache | No, and **not mirrored**; falls back to in-memory compile |
| `.blocksmith/activity/` | per-document JSONL work ledger | No, and not mirrored |
| `.blocksmith/scan-facts/`, `.blocksmith/ai-lab/` | pre-LLM facts and curator cache | Skipped entirely on hosted |
| `.blocksmith/targets/` | device profiles, `tokens.h` | Local only, a build artifact |
| `data/public-share/` | public share links | **No, and not mirrored. Known gap.** |

---

## 9. Where to start reading

A suggested first week. Read in this order. Do not skip ahead; each step assumes the last.

**Day 1: the round trip.** Read `src/lib/scan/to-markdown.ts` top to bottom, then `src/lib/scan/parse.ts`. Then open `fixtures/vendor-ui/scan-snapshot.md` in an editor and find the frontmatter, a table, and the two HTML comment markers. Run `npm run scan:vendor` and diff the result. You now understand the data spine, which is 60 percent of the system.

**Day 2: the loader and the wiki.** Read `src/lib/clients/registry.ts`, especially `prepareDesignSystemDoc` and `loadDesignSystem`. Then `src/lib/blocks/types.ts` (the vocabulary of the whole app), then `src/app/wiki/[[...slug]]/page.tsx` and follow one page component down. Run `npm run dev` and open `/wiki?doc=upload:scan-acme-ui-kit.md`.

**Day 3: the control plane.** Read `src/lib/ir/types.ts`, then `src/lib/ir/registry.ts` in full (474 lines, worth every minute), then `src/lib/ir/lock.ts`, then `src/lib/ir/enforce.ts`. Then run `npm run verify:ir-cicd` and read what it prints. Then open `/demo/investor` and click through the promote flow while watching `.blocksmith/runs/`.

**Day 4: the output plane.** Read `src/lib/codegen/pulse.ts`, focusing on the three-tier `emitComponent`. Run `npm run codegen:pulse` and read the files it produced in `packages/generated/`. Then read `src/lib/ir/targets/device-sim.ts` for the "compile meaning, not syntax" argument. Then `src/lib/mcp/blocksmith-server.ts` for the tool list and the instruction string.

**Day 5: the perimeter.** Read `src/middleware.ts`, `src/lib/cloud/saas.ts`, `src/lib/cloud/access.ts`, `src/lib/cloud/rbac.ts`, and `src/lib/runtime/writable-root.ts`. Those five files determine what a request is allowed to do and where it is allowed to write. Then run `npm run verify:security-gate` and `npm run verify:saas-acl`.

**Day 6: the customer's side.** Read `packages/cli/src/cli.ts`, then `check.ts`, then `pull.ts`. Read `packages/protocol/src/index.ts` and run `npm run protocol:conformance`. This is what a customer actually installs and runs.

**Day 7: run the whole gate.** `npm run verify:software`. It takes a while. When it goes green, you have proven your machine can build and validate the product end to end, and you have watched every subsystem announce itself.

**Files to skip on the first pass.** `src/components/{reui,shadcn-space,shadcn-studio}/` (vendored registry blocks), `ui/` (a vendored clone of shadcn/ui, reference only), `font-generator/` (a separate application), `src/lib/design-tokens/resolve.ts` (the superseded brand-slug heuristics), and `src/lib/parser/component-spec.ts` (an explicitly legacy adapter).

---

## Open questions

1. **Supabase migrations.** The SQL files in `supabase/` are applied by hand with no runner, no version table, and no record of what has been applied where. How do we ship a schema change to production without guessing? This is the biggest operational risk in the repo.
2. **Public share links do not survive Vercel.** `src/lib/public-share/store.ts` writes only to `data/public-share/*.json`. Either it needs a Supabase table or the feature should be marked local-only in the UI. Which?
3. **The Design IR cache bypasses `blocksmithWritableRoot()`.** `src/lib/design-ir/store.ts` writes to `process.cwd()/.blocksmith` directly, so on Vercel every wiki page recompiles the theme in memory on every cold start. Is that acceptable latency, or should it use `/tmp` like everything else?
4. **The interface regex is duplicated and fragile.** Two copies of `/<!--\s*blocksmith:interface\s+(\{[\s\S]*?\})\s*-->/` exist, and both break silently if `PropSpec` ever gains a nested object. Should the marker move to a delimited, length-prefixed, or base64 encoding like `blocksmith:source` already uses?
5. **The app does not import `@blocksmith/protocol`.** `src/lib/ir/` is a parallel implementation kept in sync only by `packages/protocol/conformance/drift.ts`. `docs/PROJECT-PROTOCOL.md` task P7 says the app should consume the package as the single source of truth. Do we finish P7, or do we accept the drift gate as sufficient and say so out loud?
6. **The published CLI is stale.** `@block-smith/cli@0.1.0` on npm was published from the committed `packages/cli/dist/cli.js`, which predates the commander migration, `setup hooks`, and the deviations flow. Anyone who installs it today gets an older product than the docs describe. When do we cut 0.2.0?
7. **CLI dead ends.** `packages/cli/src/updates.ts` and `src/fix.ts` are fully implemented but never registered in `cli.ts`, yet `check.ts` prints `blocksmith updates` and `blocksmith fix <block-id>` as user instructions. `--strict` is accepted and never read. `--ci` is branched on but not declared, so commander rejects it. Fix or remove?
8. **`docs/04-architecture.md` and `README.md` describe a repo that does not exist.** Do we rewrite them, delete them, or add a header pointing at this chapter?
9. **`ui/` and `font-generator/` are unregistered nested git repositories.** `font-generator` is a gitlink (mode `160000`) with no `.gitmodules`; `ui/` is entirely untracked and not in `.gitignore` either. A fresh clone gets neither. Register them as submodules, vendor them properly, or move them out.
10. **`ui/` is inside the root TypeScript program.** `font-generator` was added to the `exclude` list; `ui/` was not, and `include: ["**/*.ts", "**/*.tsx"]` sweeps it in. `npx tsc --noEmit --listFilesOnly` currently reports 3,991 files under `/Users/koshish/BlockSmith/ui/`. That is a large, silent tax on every `npm run typecheck`, which is the first step of `verify:software`. Add it to `exclude` unless there is a reason not to.
11. **Rate limiting fails open.** A Redis outage silently disables every limit. Fine for availability, dangerous if we ever describe a limit as a security control. Where is the line?
12. **The two `blocksmith check` implementations.** The CLI posts to `/api/v1/governance/events`; `npm run validate:ui` runs the same two ideas locally. They can drift. Should one call the other?
13. **`org_governance_settings` is the only table without the `blocksmith_` prefix**, and no table has a foreign key to `auth.users`. Cosmetic, or a sign the schema was written in two sittings and needs a pass?

---

## Where to look in the code

**The data spine**
- `src/lib/scan/to-markdown.ts` writes the document, including both IR comment markers
- `src/lib/scan/parse.ts` reads it back
- `src/lib/scan/component-interface.ts` extracts the structural IR with the TypeScript syntactic API
- `src/lib/markdown/frontmatter.ts` flattens the frontmatter
- `src/lib/clients/registry.ts` routes a document to one of three parsers

**The control plane**
- `src/lib/ir/types.ts` the protocol types
- `src/lib/ir/registry.ts` append-only versions, promote, rollback, conflicts
- `src/lib/ir/lock.ts` build and verify the lock
- `src/lib/ir/enforce.ts` what an agent is allowed to see
- `src/lib/ir/cloud-registry.ts` the Supabase durability mirror
- `src/lib/ir/hash.ts` canonical hashing, constitutional, do not change casually
- `src/lib/blocks/extract.ts` the block id scheme
- `src/lib/blocks/store.ts` where ingest physically happens

**The output plane**
- `src/lib/codegen/pulse.ts` the three-tier codegen ladder
- `src/lib/ir/targets/device-sim.ts` and `c-header.ts` the non-web emitters
- `src/lib/mcp/blocksmith-server.ts` the 16 MCP tools and the instruction string
- `src/mcp/handlers.ts` the 19 handlers behind them
- `packages/protocol/compile-targets.v1.json` the authoritative target list

**Governance and CI**
- `src/lib/governance/check-diff.ts` the four-rule linter
- `src/lib/governance/color-lint.ts` off-token color detection and nearest-token suggestion
- `scripts/validate-ui.ts` the CI gate, two stages
- `scripts/governance-gate.ts` the commit gate
- `.github/workflows/validate-ui.yml`, `protocol-conformance.yml`, `production-goals.yml`
- `.githooks/pre-commit`, `.githooks/post-commit`

**The perimeter**
- `src/middleware.ts` CSP and the coarse credential gate
- `src/lib/cloud/saas.ts` the three mode switches
- `src/lib/cloud/access.ts` `requireDocumentAccess`, used by 21 routes
- `src/lib/cloud/rbac.ts` the four roles and the action matrix
- `src/lib/cloud/api-keys.ts` `bs_live_` keys, stored as sha256 only
- `src/lib/cloud/rate-limit.ts` fixed-window counters that fail open

**Storage and hosting**
- `src/lib/runtime/writable-root.ts` where it is safe to write
- `src/lib/uploads/persist.ts` the three-tier document write-through
- `src/lib/supabase/storage.ts` the `scan-docs` bucket
- `supabase/*.sql` the eleven tables, applied by hand
- `next.config.ts`, `instrumentation.ts`, `sentry.server.config.ts`

**Configuration and build**
- `tsconfig.json` note the `exclude` list and why `font-generator` is in it
- `package.json` all 60-plus scripts
- `scripts/dev.mjs`, `scripts/guard-build.mjs`, `scripts/ensure-pulse.mjs`
- `blocksmith.config.json` BlockSmith scanning itself
- `components.json` shadcn plus four third-party registries
