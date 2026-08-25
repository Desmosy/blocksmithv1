# Ingestion: How Design Truth Gets In

**What this chapter covers.** Every path by which a design system enters BlockSmith: local repo scan, GitHub scan, Figma import (MCP and REST), markdown paste and upload, AI generation from a prompt or a screenshot, Storybook ingest, the browser extension, and the Figma plugin. For each path you get the entry point, the code path, the output, the verify script, and an honest status.

**Why it matters.** Everything downstream of ingestion (the wiki, the Design IR, governance tiers, the lock, MCP serving agents, Pulse codegen) reads exactly one artifact shape. If ingestion is wrong, everything after it is confidently wrong. Ingestion is also where the commercial wedge lives right now: Figma import plus drift.

**Read this if** you are adding a new source of design truth, debugging why a scan produced two components instead of forty, wondering why the Figma path does not use the variables REST API, or trying to understand why we refuse to import Figma screens.

---

## 1. The principle: one funnel, one shape

There are many ways in. There is exactly one way through.

Every ingest path in this repo converges on the same artifact: a markdown document with `blocksmith-source: workspace-scan` in its YAML frontmatter, written by one function, `workspaceScanToMarkdown()` in `src/lib/scan/to-markdown.ts`. That function takes a `WorkspaceScanResult` (defined in `src/lib/scan/types.ts`) and emits the markdown that the rest of the product reads.

Look at how many callers there are:

| Caller | File | What it is really ingesting |
|--------|------|-----------------------------|
| `scanWorkspaceToPayload()` / `scanAndPersist()` | `src/lib/scan/run.ts` | A real code repository |
| `importFigmaVariables()` | `src/lib/figma/import.ts` | A Figma library (tokens plus components) |
| `persistDesignProject()` | `src/lib/dashboard/create.ts` | A blank starter project, or an AI-generated system |
| `verify-*` scripts | `scripts/` | Fixtures, in tests |

The Figma importer does not have its own markdown emitter. It builds a synthetic `WorkspaceScanResult` in `buildFigmaScanResult()` with `workspaceRoot` set to `figma://<fileKey>` and then calls the exact same `workspaceScanToMarkdown()`. The AI project generator does the same thing with `workspaceRoot: project://<key>`. That is the whole trick.

### Why this decision keeps the system small

The alternative, and the obvious one, is a per-source pipeline: a Figma parser, a Figma wiki renderer, a Figma governance mapper, a Figma MCP surface. That is four new modules per source. With five sources you have twenty modules and twenty ways to drift apart.

Because every path funnels through one markdown shape, each of the following works for a new source with zero new code:

- **The wiki.** `parseWorkspaceScanMarkdown()` in `src/lib/scan/parse.ts` turns the markdown into a `DesignSystem` object with nav, colors, spacing, surfaces, components, and inventory. A Figma import renders in the wiki because it is indistinguishable, structurally, from a repo scan.
- **Token parsing.** `parseCssVarTable()` (`src/lib/scan/tokens.ts`), `parseCssRulesTable()` (`src/lib/scan/css-rules.ts`), `parseUtilityClassesTable()` (`src/lib/scan/tailwind-classes.ts`), `parseWorkspaceHexColors()` (`src/lib/scan/workspace-colors.ts`) all key off table headings that only `to-markdown.ts` writes.
- **Governance and the IR.** The block registry ingests from the parsed system, so a Figma-sourced component is governable the same way a scanned one is. See [Chapter 07](./07-design-ir-and-blocks.md).
- **Drift.** `codeVarsFromScanMarkdown()` and `codeComponentSurfacesFromMarkdown()` read the published markdown, not any in-memory object. That means drift works between *any two* sources, not just Figma and code.
- **Storage, access control, ownership.** Everything is an `upload:<fileName>.md` doc ref, persisted by `persistUploadMarkdown()` in `src/lib/uploads/persist.ts`.

The cost of the decision is real and you should know it: markdown is a lossy carrier for structured data. Section 10 explains how we smuggle the structured parts through it, and what breaks.

### The canonical document shape

```
---
blocksmith-source: workspace-scan
workspace-root: /abs/path | figma://<fileKey> | project://<key>
project-name: acme-ui-kit
workspace-id: acme-ui-kit
github-repo: owner/repo          # only for GitHub scans
scanned-at: 2026-06-23T02:37:55.876Z
git-commit: 3ae3059              # only when a git HEAD was readable
scan-paths: src
inventory-tsx: 5
inventory-files: 6
featured-components: 4
scan-facts-hash: 38e68cafd5df8ad
---

# <project> Workspace Scan
> Auto-generated. Pipeline: scan, classify, wiki.

## Scan metadata
## 1. Existing design documents      (only when DESIGN.md and friends exist)
## 2. Design Tokens
### 2.1 CSS variables                (Token | Value | Source)
### 2.2 Colors (hex found in workspace)
### 2.3 Utility classes (Tailwind / className)
### 2.4 CSS classes & styles
## 3. Component Library              (### per component, plus hidden IR comments)
## 4. Catalog exclusions
## 5. Codebase inventory             (every React file, always last)
```

Section numbers shift depending on which optional sections exist, which is why every parser regex in the codebase matches `## [\d.]+\.` rather than a fixed number. If you add a section, add it in `to-markdown.ts` and fix the numbering arithmetic near the end of that file, where `sectionNum` is computed by counting the optional sections that were emitted.

`scan-facts-hash` is injected by `injectScanFactsHash()` and comes from `scanResultFingerprint()` in `src/lib/scan/fingerprint.ts`. It hashes only the facts (paths, exports, token names and values, categories) and deliberately excludes timestamps and human prose, so re-running a scan on an unchanged repo produces an identical hash. That is how stale detection works in `src/lib/scan/sync-status.ts`.

---

## 2. Repo scan: the local workspace path

**Status: Shipped.** Covered by `npm run verify:vendor-fixture`, `npm run verify:vendor-e2e`, `npm run verify:external-vendor` (via `verify:goal1`), `npm run scan:verify`, and `npm run verify:scan-wiki`.

This is the original ingest path and still the most detailed one. Entry points:

```bash
npm run scan                                    # scans process.cwd() or $BLOCKSMITH_WORKSPACE
npm run scan:vendor                             # scans fixtures/vendor-ui
BLOCKSMITH_WORKSPACE=/path/to/repo npm run scan
blocksmith scan /path/to/repo                   # CLI: scans locally, uploads markdown
```

The MCP tool is `scan_workspace`. The HTTP routes are `POST /api/scan/workspace` (browser, GitHub or fixture only) and `POST /api/v1/scans` (API key, all four modes).

### 2.1 The pipeline, in order

The order in `src/lib/scan/run.ts` is load-bearing and documented at the top of that file:

1. `scanWorkspace()` (`src/lib/scan/extract.ts`) produces deterministic facts on disk.
2. `workspaceScanToMarkdown()` serializes those facts and picks a stable filename.
3. `persistScanFacts()` writes the raw facts to `.blocksmith/scan-facts/` for audit.
4. `resolveScanMarkdownForWiki()` (`src/ai-lab/09-scan-curate/resolve.ts`) optionally runs an LLM polish pass over the prose.
5. `mergeUploadOverridesAfterRescan()` re-applies any human edits stored as sidecar overrides.
6. `persistUploadMarkdown()` writes the published document. The wiki reads this file and nothing else.
7. Optionally, a copy is written to the scanned repo at `.blocksmith/scan-snapshot.md`.

Facts are always generated before curation, and the full inventory is re-appended deterministically by `mergeInventoryIntoMarkdown()` after curation, so the model physically cannot delete a file from the inventory. The curator is additionally fenced by `src/ai-lab/09-scan-curate/validate.ts`: `assertHexSubset()` throws if the curated document contains a hex color that was not in the facts, `assertInventoryCoverage()` throws if any inventory path went missing, and `assertCuratedScanShape()` throws if the frontmatter or Component Library section was destroyed. Curation defaults to **off** for the scan product path: `runScanService()` sets `AI_LAB_SCAN_CURATE=0` unless something else already set it.

### 2.2 File discovery: what the walker actually reads

`walkUiFiles()` in `src/lib/scan/walk.ts`:

- **Roots** come from `resolveScanRoots()` (`src/lib/scan/workspace-config.ts`), in priority order: the `BLOCKSMITH_SCAN_PATHS` env var, then `scanPaths` from `blocksmith.config.json`, then the defaults `src`, `app`, `components`, `packages`, `styles`, filtered to those that exist.
- **Extensions collected**: `.tsx`, `.jsx`, `.css`, `.scss`, plus any file named `tailwind.config.{js,ts,mjs,cjs}`.
- **Directories skipped**: `node_modules`, `.next`, `.git`, `dist`, `build`, `out`, `coverage`, `.blocksmith`, `.turbo`, `.cache`, `.storybook`, `__tests__`, `__mocks__`, `__snapshots__`, `e2e`, `.playwright`, `.cypress`.
- **Files skipped**: anything matching `*.test.*`, `*.spec.*`, `*.stories.*`, `*.story.*`.
- **Hard cap**: 5,000 files. Once hit, the walk stops immediately. On a very large monorepo you will silently get a partial scan.
- **Always added, regardless of roots**: the common global stylesheet locations (`src/app/globals.css`, `app/globals.css`, `src/styles/globals.css`, `styles/globals.css`, `src/index.css`, `src/App.css`, `index.css`, `App.css`) and root-level Tailwind configs. This is how a Vite portfolio with no `src/styles` still yields a palette.

Separately, `findDesignDocPaths()` looks for `DESIGN.md`, `design.md`, `DESIGN_SYSTEM.md`, and `docs/DESIGN.md`. These are **listed, not merged**. The scan tells you they exist and how many bytes they are; it never absorbs their content. On a case-insensitive filesystem (macOS) you will see the same file listed twice, once as `DESIGN.md` and once as `design.md`. You can see that in `fixtures/vendor-ui/scan-snapshot.md` today.

### 2.3 What gets extracted, per file

From `scanWorkspace()` in `src/lib/scan/extract.ts`. Files larger than 512,000 bytes are skipped entirely by `readText()`.

**CSS variables.** Regex `(--[\w-]+)\s*:\s*([^;}\n]+)` over every file type, not just CSS. Deduped by `name::source`, so the same variable defined in two files yields two rows and the wiki can show you both.

**Colors.** Two sources. First, every hex literal anywhere in any scanned file, via `#([0-9a-fA-F]{3,8})\b`, normalized to six-digit lowercase with alpha dropped. Second, any CSS variable whose value normalizes to a hex, recorded with the variable name as the token and a source string of the form `path (--var-name)`.

> **Known bug worth knowing.** `normalizeHex()` in `extract.ts` strips a leading `#`, then blindly expands any three-character string by doubling each character. It never validates that the characters are hex digits. So the CSS variable `--acme-radius-md: 8px` becomes the "color" `#88ppxx`, which you can see today in `fixtures/vendor-ui/scan-snapshot.md`. The equivalent function in `src/lib/figma/normalize.ts` does it correctly by matching `#([0-9a-fA-F]{3,8})` first. The scan version should be brought in line with the Figma version.

**Tailwind and utility classes.** `extractUtilityClassesFromTsx()` in `src/lib/scan/tailwind-classes.ts` matches seven `className` shapes (double-quoted, single-quoted, template literal, brace-wrapped variants, plain `class=`, and the first string argument of a `cn(...)` call). Classes containing `${` are dropped because they are template holes, as are classes starting with `[` or `{` and classes longer than 80 characters. Caps: 200 new classes per file, 300 globally. Only the top 120 by usage count reach the markdown table.

**CSS rules.** `extractCssRules()` in `src/lib/scan/css-rules.ts`, only for `.css` and `.scss` files. Comments are stripped, then a flat `selector { declarations }` regex runs. `isUsefulSelector()` keeps class selectors, common element selectors, pseudo-classes, `:root`, `html`, `body`, and anything whose name looks design-system-ish (`btn`, `hero`, `card`, `badge`, and so on). It rejects at-rules and vendor pseudo-elements. Caps: 80 rules per file, 140 characters of selector, 220 characters of declarations, and only the first 200 rules reach the markdown.

**Exports.** Regex over `export function|const|class` plus a second pass for `export default Identifier;`, which is the common Vite and portfolio shape.

**Components.** Only `.tsx` and `.jsx` files are considered. For each one the scanner records the hexes used in the file and the CSS variables referenced via `var(--x)`, then runs classification (next subsection).

### 2.4 Classification: two gates, not one

A file becomes a *featured component* (a page in the wiki Component Library) only if it passes **both** of the following.

**Gate one: `classifyComponentForWiki()` in `src/lib/scan/catalog.ts`.** It returns a `CatalogDecision` with one of nine categories, and each category carries a designer-readable role and a reason string that is published in the "Catalog exclusions" table. Order matters; the first match wins:

| Order | Test | Category | Featured |
|-------|------|----------|----------|
| 1 | Filename or an export ends with `Page` | `page_shell` | no |
| 2 | Path under `packages/pretext-components/` | `rendering_infra` | no |
| 3 | Source imports or implements Pretext or text measurement | `rendering_infra` | no |
| 4 | Filename matches a dev-tool list (`ComponentGallery`, `InspectablePreview`, and so on) | `dev_tool` | no |
| 5 | Filename matches app chrome (`Shell`, `Provider`, `Nav`, `Sidebar`, `Toast`, `Logo`, and so on) | `app_chrome` | no |
| 6 | Filename matches a small-utility list (`CopyButton`, `SyncedAtLabel`) | `utility` | no |
| 7 | Path is under a catalog root | `design_primitive` or `token_showcase` | **yes** |
| 8 | Wiki visual showcase, wiki root primitive, or demo primitive | `design_primitive` or `token_showcase` | **yes** |
| 9 | Under `packages/*/src/` with a recognized primitive name | `design_primitive` | **yes** |
| 10 | Primitive-shaped name but outside every catalog root | `design_primitive` | no |
| 11 | Portfolio section file (`src/components/Hero.tsx` style) | `design_pattern` | **yes** |
| 12 | Anything else | `unknown` | no |

"Catalog root" means the default vendor design-system paths (`components/ui`, `ui/components`, `design-system`, `ds/components`, `primitives`, `core/components`, `lib/ui`, `ui/src`) plus anything in `catalogPaths` from `blocksmith.config.json` or the `BLOCKSMITH_CATALOG_PATHS` env var.

**Gate two: `isScannableDesignComponent()` in `src/lib/scan/component-filter.ts`.** A separate, older, path-shaped filter that excludes wiki pages, app and API routes, hooks, MCP, ai-lab, and most of `src/lib/`, and that re-checks for primitive-looking names. Having two overlapping gates is historical debt; they mostly agree, but a file that clears one and fails the other silently disappears from the featured list while still appearing in the inventory.

**Overrides.** `.blocksmith/catalog.json` in the scanned repo, applied by `applyCatalogOverrides()` after the heuristic:

```json
{
  "forceFeatured": ["src/components/legacy/Button.tsx"],
  "forceInventoryOnly": ["src/components/layout/AppShell.tsx"],
  "exclude": ["src/components/internal/Debug.tsx"]
}
```

`exclude` drops the file before it even reaches the inventory. `forceFeatured` rewrites the decision to `design_primitive`. `forceInventoryOnly` keeps the classification but flips `includeInWiki` to false. The vendor fixture uses `forceInventoryOnly` on `AppShell.tsx` precisely so that layout chrome does not masquerade as a design primitive.

**Everything else still gets inventoried.** `result.inventory` contains every React file the walker read, featured or not, and `buildInventoryMarkdown()` in `src/lib/scan/inventory.ts` writes all of it, always as the last section. That is the coverage guarantee: the Component Library is opinionated, the inventory is complete.

### 2.5 ComponentScanMeta and ComponentInterface

`ComponentScanMeta` (in `src/lib/blocks/types.ts`) is the per-component payload the wiki and codegen see:

```ts
export interface ComponentScanMeta {
  sourceFile: string;
  exports: string[];
  cssVarsUsed: string[];
  colorsUsed: string[];
  interface?: ComponentInterface;   // structural props/variants IR
  source?: string;                  // verbatim source, capped
}
```

The first four fields are the original shape. They were enough to render a documentation page and completely insufficient to generate code. A CTO review in June 2026 traced a real product failure to exactly this: Pulse codegen was stamping generic `div` wrappers for every component except a hand-written `Button`, because the scan IR did not carry component *structure*. The chosen fix (recorded in the `faithful-codegen-pipeline` memory as "direction B") was to make the scan IR richer rather than to reposition the product around the control plane.

That is why `interface` and `source` exist.

**`extractComponentInterface()`** lives in `src/lib/scan/component-interface.ts` and produces:

```ts
export interface ComponentInterface {
  name: string;
  props: PropSpec[];          // { name, type, optional, default?, variants? }
  extendsTypes: string[];     // e.g. ButtonHTMLAttributes<HTMLButtonElement>
  hasChildren: boolean;
  propsTypeName?: string;     // e.g. ButtonProps
  rootElement?: string;       // first lowercase JSX tag returned
}
```

It handles, and `npm run verify:component-interface` asserts, all of these real-world shapes: an inline object type on the parameter, a `type X = { ... }` alias, an intersection with HTML attributes, `React.FC<Props>` and `FunctionComponent<Props>` annotations, `interface Props extends Base` heritage chains resolved against locally declared types, `forwardRef<Ref, Props>` (props is the second type argument), `memo<Props>` (props is the first), nested wrappers such as `memo(forwardRef(...))`, anonymous `export default function`, and `export default <arrow>`. String-literal unions become `variants`, which is what makes variant-level drift possible later. Defaults are read out of the destructuring pattern, so `{ variant = "primary" }` is captured.

**Why the TypeScript type checker is deliberately not used.** The extractor calls `ts.createSourceFile()` and walks the syntax tree. It never creates a `Program`, never resolves modules, and never asks for types. Three reasons, in order of importance:

1. **It has to work on a lone file.** The GitHub scan path extracts a tarball into a temporary directory with no `node_modules`. There is nothing to resolve. A type checker on that tree would return `any` for every React type and error on every import.
2. **It has to be fast and bounded.** A type checker on a large monorepo is minutes and gigabytes. The scan budget is a Vercel function with `maxDuration = 60`.
3. **It has to be deterministic.** Syntactic extraction gives the same answer for the same bytes forever. Checker output depends on which version of which `@types` package happens to be installed in the repo being scanned, which is not something we control.

The cost is that we cannot follow an imported type. If `ButtonProps` is declared in a sibling file, `resolvePropsType()` records it in `extendsTypes` as an opaque external name rather than expanding its members. That is an accepted, documented limitation, and it degrades gracefully: codegen falls back one tier instead of failing.

**Carried source.** `extract.ts` also stores the file's verbatim text on the component when it is at or under `COMPONENT_SOURCE_CAP` (8,000 bytes). Codegen's `emitComponent()` is three-tier: emit the verbatim source when it exports the component by name (faithful by construction), otherwise synthesize a real prop signature from the `ComponentInterface`, otherwise fall back to a generic stub. `npm run verify:pulse` asserts the faithful tier is still reached (`Card` must have a `title` prop and a `<section>` root, `Input` an `<input>`, `Badge` a `label`) so the pipeline cannot silently regress to stubs again.

### 2.6 Filenames, config, and stale detection

`stableDocFileName()` in `to-markdown.ts` decides where the document lands:

- Explicit `workspaceId` in `blocksmith.config.json` gives `scan-<slug>.md`, stable across machines. The fixture produces `scan-acme-ui-kit.md`.
- A `workspaceId` inferred from `package.json` `name` (npm scope stripped) gets a disambiguating suffix, because two unrelated repos are both called `ui`. The suffix is the GitHub `owner-repo` slug when known, otherwise the first eight hex characters of a SHA-256 of the absolute workspace path.
- The disambiguated form is why `data/uploads/` contains both `scan-acme-ui-kit.md` and `scan-acme-ui-kit-8f902bea.md`.

`blocksmith.config.json` (or `.blocksmith/config.json`) supports `workspaceId`, `scanPaths`, `catalogPaths`, and `exportSnapshot`. When `exportSnapshot` is not explicitly `false` and the workspace root is writable (`canWriteWorkspaceSnapshot()`), the published markdown is also written to `<repo>/.blocksmith/scan-snapshot.md` so the vendor can commit their own snapshot.

Stale detection: `getWorkspaceScanSyncStatus()` in `src/lib/scan/sync-status.ts` compares the published `scan-facts-hash` against a freshly computed fingerprint. If the server cannot legally read the workspace path (see the guard in section 3), it returns `hostedRefreshOnly: true` with a hint of `cli-rescan` or `github-rescan` instead of pretending to know.

### 2.7 Known blind spots

Be honest about these when someone asks why their scan looks thin.

- **React and CSS only.** No Vue, Svelte, Angular, Swift, Kotlin, or Flutter. The walker collects four extensions.
- **Nested CSS is partially missed.** The rule regex matches non-nested `{ ... }` blocks, so declarations inside `@media`, `@supports`, and nested SCSS are not reliably captured as rules (their variables and hexes are still picked up by the flat regexes).
- **No Tailwind config evaluation.** `tailwind.config.*` is read as text and mined for hexes and variables. The theme object is never evaluated, so a palette expressed as JavaScript expressions is invisible.
- **Design docs are listed, not parsed.** `DESIGN.md` content never enters the wiki automatically.
- **Runtime and computed styles are invisible.** CSS-in-JS with dynamic values, theme providers, and anything computed at runtime does not appear.
- **The 5,000 file cap** truncates large monorepos with no warning in the document.
- **Two overlapping classification gates** can disagree, producing a file that is inventoried but mysteriously not featured. The reason string in the exclusions table only reflects gate one.
- **The `#88ppxx` bug** described above produces junk color rows for any three-character CSS variable value.
- **Zero featured components is the most common first-run failure.** The fix is almost always `catalogPaths` in `blocksmith.config.json` or `forceFeatured` in `.blocksmith/catalog.json`.

---

## 3. GitHub scan: the remote repo path

**Status: Shipped.** Covered by `npm run verify:github-scan`, which clones a real public repo (default `shadcn-ui/ui`, override with `BLOCKSMITH_VERIFY_GITHUB`), scans it, persists it, and re-parses the published document.

Entry point: the home page card `src/components/home/ScanWorkspaceCard.tsx`, which posts `{ github: "owner/repo" }` to `POST /api/scan/workspace`. Also `blocksmith scan --github owner/repo` and `POST /api/v1/scans` with an API key.

### 3.1 Tarball, not clone

`cloneGithubRepo()` in `src/lib/scan/github.ts` does **not** shell out to `git`. It:

1. Resolves the ref: an explicit branch from a `/tree/<branch>` URL, otherwise `repos.get()` for the repository's `default_branch`, otherwise `main`.
2. Calls Octokit's `repos.downloadTarballArchive()`.
3. Streams the archive through `tar.x()` into a directory created with `mkdtempSync(join(tmpdir(), "blocksmith-clone-"))`.
4. Asserts the archive has exactly one top-level entry (GitHub tarballs are always `owner-repo-sha/`) and returns that as the workspace root, plus a `cleanup()` closure.

The function name still says "clone" for historical reasons. It is an HTTP download.

**Why git clone was abandoned.** The Vercel serverless runtime does not ship a `git` binary, and you cannot install one at request time. Shelling out to `git` worked on a developer laptop and failed the moment the same code ran in production. The GitHub API tarball endpoint needs no binary, no SSH keys, and no credential helper, and it is a single authenticated HTTPS request. The tradeoff is that we get a snapshot with no git history, which is why `gitHead()` in `extract.ts` returns `null` for GitHub scans and the `git-commit` frontmatter line is simply absent.

### 3.2 The /tmp constraints

Serverless `/tmp` is small, ephemeral, and shared across invocations of the same warm container. The code is written accordingly:

- Extraction goes into a unique `mkdtemp` directory, never a fixed path, so concurrent scans cannot collide.
- `runScanService()` wraps the scan in `try { ... } finally { cleanup() }` so the directory is removed even when the scan throws.
- `cloneGithubRepo()` also removes the directory on any failure before rethrowing.
- `scanAndPersist()` is called with `writeSnapshot: false` for GitHub mode. Writing `.blocksmith/scan-snapshot.md` into a directory that is about to be deleted is pointless, and `canWriteWorkspaceSnapshot()` would reject it anyway.
- The route declares `maxDuration = 60` because tarball download plus extraction plus scan routinely exceeds the default budget. The response reports `cloneMs` and `scanMs` separately so you can see which half is slow.

### 3.3 Auth, authorization, and rate limits

`POST /api/scan/workspace` is the hardened public route. Its rules, in order:

1. **Local paths are refused.** Any `workspace` value other than the literal `fixture:vendor` returns 403 with a message telling you to run the CLI instead. The browser cannot ask the server to read a path.
2. **Arbitrary repo URLs are refused.** `isRepoSlug()` requires an `owner/repo` slug. You cannot paste `https://github.com/someone/private-thing`.
3. **GitHub OAuth is required** unless the caller presents a valid API key. `getGithubSession()` must return a session, and `assertRepoAccessible(session.providerToken, slug)` verifies the signed-in user can actually see that repository. This is the check that makes private repo scanning safe: we use the user's own OAuth token, so GitHub itself enforces the permission.
4. **Rate limits are per user and per IP**, both enforced (`scanRateLimitForUser`, `scanRateLimitForRequest`), returning 429 with a `Retry-After` header. API keys take the per-key limit in `POST /api/v1/scans` instead.
5. **The token used for the tarball** is the OAuth provider token from the session, falling back to the `GITHUB_TOKEN` env var for server-side and CLI use. An unauthenticated tarball request is subject to GitHub's anonymous rate limit (low), which is another reason the OAuth path is not optional.

The server-local `workspace` mode still exists for development and is guarded by `isAllowedServerWorkspacePath()` in `src/lib/scan/service.ts`: in production only paths under `fixtures/` (plus anything listed in `BLOCKSMITH_SCAN_ALLOW_PATHS`) are allowed; outside production the process working directory is also allowed.

---

## 4. Figma import: the commercial wedge

**Status: Shipped for the deterministic core and the MCP path (proven live). Built, unproven for the REST connector against a live personal access token at the time the wedge memory was written; the route and its UI exist and are exercised by `npm run verify:figma-import` (54 checks) against recorded payloads.**

This gets the most space because it is the current wedge. Read `docs/FIGMA-IMPORT.md` for the runbook and `docs/TESTING-FIGMA-FUSION.md` for the manual test script.

### 4.0 The position

Write this on the wall:

> Figma is the design source of truth. The repository is the code source of truth. `design.md` is the neutral contract both sides reconcile against.

BlockSmith does not replace Figma's canvas. Token extraction on its own is a commodity: Tokens Studio, Style Dictionary, and Figma's own exports all do it. The moat is everything downstream of `design.md` that we already built, namely the wiki, governance tiers, MCP serving the system to coding agents, and drift.

### 4.1 Route A: the MCP path via `get_variable_defs`

This is the agent-side path. A coding agent with the Figma Dev Mode MCP available pulls raw data and hands it to the pure core:

```ts
import { assembleFigmaImport, importFigmaVariables } from "@/lib/figma";

const variableDefs = await figma.get_variable_defs({ fileKey, nodeId });
const components   = await figma.get_libraries({ fileKey });   // optional
const input = assembleFigmaImport({ variableDefs, components, fileKey, fileName });
const { docRef } = await importFigmaVariables(input);
```

`assembleFigmaImport()` in `src/lib/figma/adapter.ts` is the seam. Everything below it is pure and unit-tested. Its job is to survive the shapes Figma actually returns:

- **A flat map** of name to value.
- **An array** of `{ name, value, type }`.
- **A nested object** keyed by collection and group. `flattenFigmaVariableDefs()` walks it and joins group names with `/`, which matters because the downstream name conversion keeps the group prefix, and the token classifier keys off prefixes like `Color`, `Radius`, and `Spacing`.
- **RGBA object colors** with 0-to-1 float channels, converted by `figmaRgbaToHex()`. Alpha is dropped; tokens are opaque.
- **Numbers** for dimensions.
- **Unresolved variable aliases** (`{ type: "VARIABLE_ALIAS", id }`). These are **skipped, not guessed**. Resolving an alias needs the whole variable graph, and inventing a value would be worse than omitting one.

Then `figmaNameToCssVar()` in `src/lib/figma/normalize.ts` converts `Color/Text/Primary` to `--color-text-primary`, splitting camelCase boundaries and preserving an already-CSS-shaped `--foo`. `figmaVariablesToTokens()` in `import.ts` classifies each value with `asColor()` (hex or `rgb()` or `rgba()`) then `asDimension()` (an explicit unit, or a bare number treated as pixels, which is the Figma convention), and drops anything that is neither, counting it in `summary.skipped`.

The result becomes a synthetic `WorkspaceScanResult` and goes through `workspaceScanToMarkdown()`. Every token carries `source: figma:<fileKey>` so its origin is traceable in the wiki's Source column.

**Live proof and the gotcha.** All three of these were run against real files through the remote Figma MCP:

1. A landing page file with real variables, imported through `get_variable_defs`.
2. An admin kit with **no** variables, where 24 tokens were recovered from `get_design_context` (route B below).
3. Component drift between a real published Figma component library and the `acme-ui-kit` code scan.

> **The live-canvas-selection gotcha.** The remote Figma MCP reads the user's **live canvas selection**, not the `node-id` in the URL you pass it. If the user has nothing selected in the Figma editor, you get an empty or wrong payload and the import silently produces a thin document. Before blaming the adapter, ask the human to select a layer or frame in Figma. This trips up every first-time demo.

### 4.2 Route B: recovering tokens when the file has no variables

**This is the common case, not the edge case.** Figma variables are relatively new. Most real files, especially community kits and anything more than a couple of years old, are built on *styles*, not variables. For those, `get_variable_defs` returns `{}` and a naive importer produces an empty design system.

`figmaDesignContextToTokens()` in `src/lib/figma/adapter.ts` fixes that. `get_design_context` returns the selected design as React plus Tailwind code. The de-facto tokens are sitting right there in the class names, so we mine them:

1. **Colors by role.** Four regex families with a role each: `text-[...]` and `text-white|black` become Text, `bg-[...]` becomes Background, `border-[...]` becomes Border, and `from|to|via|fill|stroke-[...]` become Accent. Every remaining bare hex or `rgba()` in the code (shadows, gradients, masks) is swept into Accent. Each unique hex is then assigned to exactly one role, by highest occurrence count with ties broken by role priority. Output names look like `Color/Text/1`, `Color/Background/2`, ranked by frequency so the most-used color is number one.
2. **Border radii.** `rounded-[Npx]` values, plus `9999` when `rounded-full` appears, sorted ascending, emitted as `Radius/<n>`.
3. **Type scale.** `text-[Npx]` values, sorted ascending, emitted as `Font Size/<n>`.

The output is a `{ name: value }` map in exactly the shape `get_variable_defs` produces, so it flows through the identical pipeline with no branching downstream.

You can pass both sources at once. In `assembleFigmaImport()` the merge is `{ ...inferred, ...fromVars }`, so **real variables win on name collision** and inferred tokens only fill gaps. In `importFigmaVariables()` the same precedence is achieved differently, by ordering real variables first in the array and relying on the first-wins dedupe in `figmaVariablesToTokens()`. Two mechanisms, one rule.

### 4.3 Route C: the REST connector, and why not the variables REST API

The web app cannot use the Figma MCP, because the MCP is agent-side. For end users who are not sitting in a coding agent, the UI at `/figma` (`src/components/figma/FigmaConnectCard.tsx`) takes a pasted file URL and a personal access token and posts them to `POST /api/figma/connect`.

`src/lib/figma/rest.ts` implements it:

- `parseFigmaFileKey(url)` accepts `figma.com/file/<key>`, `figma.com/design/<key>`, or a bare key.
- `fetchFigmaFile(key, token)` calls `GET https://api.figma.com/v1/files/:key` with an `X-Figma-Token` header and converts 403, 404, and 429 into readable, actionable error messages. The response type is checked at compile time against `GetFileResponse` from `@figma/rest-api-spec`.
- `extractFigmaFile(file)` is pure and unit-tested. It walks the document tree once and collects everything below.

**Why we do not depend on the variables REST API.** Figma's `GET /v1/files/:key/variables/local` endpoint is **Enterprise-plan only**. Building the paid connector on an endpoint that most prospects cannot call would mean the demo fails for the majority of users on the majority of files. So the REST path deliberately reconstructs tokens from data available on every plan:

1. **Named color styles.** Walk the tree, find each node's first visible `SOLID` fill, and remember the hex against the node's `styles.fill` style id. Then join against the file's `styles` map: every `FILL` style whose id we saw becomes `Color/<style name>`. These are the design system's *intended* tokens, which is why they rank first.
2. **Text styles.** Same join for `styles.text` against `style.fontSize`, producing `Font Size/<style name>` in pixels.
3. **Raw fills, as a fallback only.** If the file has zero named color styles, the 24 most-used raw fill hexes become `Color/1` through `Color/24`, ordered by occurrence. A file with no formal style setup still yields a usable palette instead of nothing.
4. **Component sets.** Every `COMPONENT_SET` node, deduplicated by name, with its `componentPropertyDefinitions` map intact so variant options survive.
5. **Native annotations.** Any node `annotations` array, captured with node id, node name, node type, label markdown, category, and pinned property names.
6. **Frames.** Up to 24 `FRAME`, `SECTION`, `COMPONENT`, or `COMPONENT_SET` nodes with their bounding boxes, used later for rendering.
7. **Saved measurements.** Dev Mode measurement annotations with their start and end node ids, sides, offset type, value, and free text.

The extract also returns a `stats` object (`namedColorStyles`, `textStyles`, `rawFills`, `componentSets`) which the route hands straight back to the UI. That is deliberate honesty: the user sees exactly what their file offered rather than a number we made up.

**Token handling.** The personal access token is used once, for the duration of the request, and is never stored. The route errors with 422 when a file yields neither tokens nor components, which is a much better failure than an empty wiki.

**Fusion.** When `NVIDIA_API_KEY` is configured and the caller did not opt out, the route renders up to four representative frames through Figma's image endpoint (`fetchFigmaFrameImages()`, which filters to frames at least 160 by 120, sorts by area, downloads the rendered JPEGs, and rejects anything over about 4.5 MB), then calls `extractFigmaVisualEnrichment()`. See section 9 for the rules that pass governs. The structured import always succeeds on its own; when fusion is skipped the response carries `fusion: { enabled: false, reason }` so the failure is visible instead of silent.

**Provenance appendix.** Both the connector and the webhook append a `## Figma provenance` section carrying the file key, the file version, the annotation and measurement counts, and up to 50 measurement rows, with the line "Structured nodes are authoritative; visual observations are descriptive."

**Webhook.** `POST /api/figma/webhook` (`src/app/api/figma/webhook/route.ts`) re-runs the same extraction on a Figma V2 event. It authenticates with a `timingSafeEqual` comparison against `FIGMA_WEBHOOK_PASSCODE`, answers `PING` events immediately, and uses the server-side `FIGMA_ACCESS_TOKEN`. Prefer `FILE_VERSION_UPDATE`, `LIBRARY_PUBLISH`, and `DEV_MODE_STATUS_UPDATE` as triggers; `FILE_UPDATE` fires on essentially every keystroke.

### 4.4 Drift: the actual product

The import is the setup. Drift is the payoff, and the reason this is a product rather than a plugin.

An import alone says "here are your Figma tokens." Anyone can do that. Drift says:

> Figma says `--color-brand-primary` is `#3b82f6`. Your shipped code says `#2563eb`, defined at `src/app/globals.css`.

**Token drift.** `computeTokenDrift()` in `src/lib/figma/drift.ts` matches the two sides on normalized CSS variable name and classifies every token into one of four states: `match`, `mismatch`, `figma-only`, `code-only`. Comparison is deliberately loose, via `valuesEqual()`: hex forms are normalized before comparison (so `#FFF` equals `#ffffff` equals `rgb(255,255,255)`), numeric values are compared numerically (so `8` equals `8px`), and everything else falls back to case-insensitive trimmed string equality. Without that leniency every report would be pure noise.

The code side comes from `codeVarsFromScanMarkdown()`, which reads the published scan markdown's CSS variables table. That is important: drift reads the *document*, not a live repository. It works offline, it works on Vercel, and it works between any two documents.

**Component and variant drift.** `computeComponentDrift()` in `src/lib/figma/component-drift.ts` goes further, and this is the part that makes design leads sit up. It reduces both sides to a `ComponentSurface` (`{ name, variants, props }`), matches components by aggressively normalized slug (lowercase, non-alphanumerics removed), and then diffs at variant-option granularity:

```
## Figma vs code component drift
> 1 differ · 1 Figma-only · 1 code-only · 0 in sync.
- Button  (differs)
  - `size`: `Large` in Figma, not in code
  - prop(s) `label` in Figma, not in code
- Card    (Figma only)     # designer shipped something devs have not built
- Tooltip (code only)      # code has UI that is not in the Figma library
```

The code-side surfaces come from `codeComponentSurfacesFromMarkdown()`, which reads the hidden `<!-- blocksmith:interface {...} -->` comments described in section 10. A component with no embedded interface degrades to a presence-only row (name matching still works, variant comparison does not) rather than being dropped.

**Surfaces.** MCP tool `figma_token_drift`, HTTP `POST /api/figma/drift`, library functions `driftFigmaAgainstScan()` and `driftFigmaComponentsAgainstScan()`. The HTTP route gates the read: because drift reads a scan document's tokens, it calls `requireDocumentAccess(request, fileName, "read")` on any `upload:` doc ref, exactly like any other document read. The handler refuses non-upload doc refs with a message telling you to run a scan first, rather than returning a confusingly empty report.

### 4.5 The line we do not cross: system, not screens

We import the design **system**: design tokens plus the published component library. We do **not** import frames or screens.

The rule is stated in the wedge memory, in `docs/FIGMA-IMPORT.md`, and it is enforced by the shape of the code. `extractFigmaFile()` collects `COMPONENT_SET` nodes for components. It collects frames only as *render targets for visual enrichment* and as measurement anchors, capped at 24, never as components. There is no code path anywhere in `src/lib/figma/` that turns a frame into a `ScannedComponent`.

**Why.** A screen is an instance, not a governed asset. Governing "Checkout Page v3, final, FINAL2" is meaningless: it changes every day, it has no stable identity, and no agent should be told it is a rule. A token and a published component *are* governed assets: they have identity, they have versions, other things depend on them, and a human can meaningfully approve them.

**And commercially.** The moment you import a frame and emit code for it, you are doing design-to-code. That is Figma Make's business, run inside Figma, by Figma, with the canvas they own. Competing there means losing on their turf. Staying at the system layer means we are the system of record that both Figma and the repo reconcile against, which is a position neither of them occupies.

If someone proposes "we should just generate the screen too", the answer is no, and this paragraph is why.

---

## 5. Paste and upload

**Status: Shipped.** Documented in `docs/PASTE-AND-WIKI.md`.

The oldest and simplest way in. `POST /api/wiki/import` (`src/app/api/wiki/import/route.ts`) accepts either JSON with a `markdown` string and an optional `fileName`, or a `multipart/form-data` body with a `.md` file. The home studio (`src/components/home/HomeStudio.tsx`) drives both: paste into the textarea and submit, or drop one or many `.md` files (each file becomes its own wiki, with a results list).

The route:

1. Requires sign-in when `saasStrictMode()` is on.
2. Saves via `saveMarkdownUpload()` in `src/lib/uploads/store.ts`, which slugifies the base name, appends the first eight hex characters of a SHA-256 of the content, and rejects anything empty or over 2 MB. Content-addressed naming means re-uploading identical markdown is idempotent.
3. Registers the document against the signed-in user's default org with `scanMode: "import"`, so it appears on their dashboard and passes ownership checks. An unregistered doc is orphaned in hosted mode.
4. Parses it and returns `wikiUrl`, the detected `parser`, the system name, and counts.

**Parser auto-detection.** Unlike every other path in this chapter, a pasted document is *not* required to be workspace-scan shaped. The registry picks a parser:

- **Apollo**, for structured token documents. `isApolloStructuredMarkdown()` looks for a `## Tokens` colors heading or a `## Components` section with a `| Name | Value | Token |` table.
- **Comprehensive wiki**, for multi-chapter documents. `isComprehensiveWikiMarkdown()` in `src/lib/parser/generic.ts` triggers on six or more numbered `##` headings with eight or more `##` total, or a table of contents with ten or more `##`, or fifteen or more `##` in a document over 12,000 characters. These are explicitly protected from being squashed into Apollo shape.
- **Generic**, for anything else with headings: a section sidebar plus rendered markdown pages.
- **Workspace scan**, when `isWorkspaceScanMarkdown()` matches the frontmatter. This is how a `.blocksmith/scan-snapshot.md` committed by a vendor can be re-uploaded and render as a full scan wiki.

**Storage.** `persistUploadMarkdown()` in `src/lib/uploads/persist.ts` writes to three places with different lifetimes: an in-process `Map` (required on Vercel, where disk is ephemeral and a warm lambda must serve the doc it just wrote), Supabase Storage when configured, and the local `data/uploads/` mirror when the filesystem allows it. Reads go through `hydrateUploadMarkdown()`, which fills the memory cache from disk or Supabase before any synchronous read. Filenames are validated by `safeUploadFileName()`, which rejects path separators, `..`, and anything that is not `[\w.-]+\.md`.

**Starter project scaffold.** `createStarterProject()` in `src/lib/dashboard/create.ts` is the "start from nothing" path, driven by `src/components/dashboard/PromptBar.tsx` and `DashboardEmptyState.tsx` via `POST /api/projects/create`. It hands `persistDesignProject()` eleven hand-picked CSS variables (a neutral brand, two surfaces, a border, two text colors, two radii, three spacing steps) and no components. Because it funnels through `workspaceScanToMarkdown()`, the scaffold is guaranteed to parse and render on every wiki page rather than being a special empty state that breaks the moment someone opens Foundation. That guarantee is the reason the scaffold reuses the scan emitter instead of writing its own template.

---

## 6. AI generation paths

**Status: Shipped, gated on a configured model.** No verify script; these paths call a live model and are exercised manually.

Two of them, both landing in the same `persistDesignProject()`.

### 6.1 From a text prompt

`generateDesignSystemFromPrompt()` in `src/lib/dashboard/generate.ts`, behind `POST /api/projects/create` with `{ name, useAi: true }`.

The model is asked, with a strict system prompt, to return **only** a JSON object with `name`, `colors`, `typeScale`, `radii`, `spacing`, and `components`, with explicit bounds (six to ten colors, four to six type sizes, two to four radii, three to five spacing steps, four to seven components) and a requirement that hex be `#rrggbb`.

The guardrails are all on our side of the boundary:

- `extractSpec()` strips `<think>` blocks, unwraps code fences, and slices from the first `{` to the last `}` before parsing, because models emit prose no matter what you tell them.
- `specToParts()` re-validates everything. `normHex()` accepts only real hex and normalizes it. `px()` rejects negatives and non-finite numbers. Names are slugified into `--color-*`, `--radius-*`, `--spacing-*`, `--font-size-*`. Counts are hard-capped (16 colors, 8 radii, 10 spacing, 10 type sizes, 12 components) independently of what the prompt asked for. Duplicate variable names and duplicate component ids are dropped.
- Zero usable colors is treated as an error, not as an empty system.
- **The route never blocks the user on a flaky model.** Any AI failure is caught and logged, and the request falls through to `createStarterProject()`. The response carries `generated: true|false` so the UI can tell the truth about which one happened.
- Rate limited per user (or per IP when anonymous), sign-in required in strict mode, `maxDuration = 60`.

### 6.2 From a screenshot, via vision

`generateDesignSystemFromImage()` in `src/lib/dashboard/vision-generate.ts`, behind `POST /api/projects/generate-image` with `{ image: "data:image/png;base64,..." }`.

Same JSON contract, same `extractSpec()` and `specToParts()` validation, so the entire guardrail stack is shared. Differences: the model defaults to an image-capable NVIDIA model overridable with `NVIDIA_MODEL_VISION`; NVIDIA reasoning is explicitly disabled via `chat_template_kwargs: { enable_thinking: false }` at the request body root; the route enforces a MIME allowlist (PNG, JPEG, WebP data URLs only) and an 8,000,000 character cap on the data URL, returning 413 when exceeded; and `maxDuration` is 90 because vision inference is slower.

Note the honest asymmetry with section 9: this path lets vision produce token *values*. It is a **project bootstrap** path, not a governance path. The resulting document is an editable starting point that a human is expected to correct in the wiki, and it is not a claim about anyone's real design system. The capture path in section 8 makes that same distinction explicit with a draft marker; this one currently relies on the fact that the user typed the prompt and watched the result. That gap is listed in Open questions.

---

## 7. Storybook ingest and other adapters

**Status: Shipped for the CLI adapter.** Fixture at `fixtures/storybook-static/index.json`. No dedicated verify script.

`npm run ingest:storybook -- ./storybook-static --doc upload:my-app.md`

`src/lib/ingest/storybook.ts` plus `scripts/ingest-storybook.ts`. This is the protocol's external-neutrality proof: something that is not a repo scan and not Figma, compiled into the same IR.

It reads a static Storybook build's `index.json` (Storybook 7 and 8) or `stories.json` (6.x), groups story entries by component title, and emits one component block per component with the block id `component:<slug>`, an `importPath`, the list of story names as variants, and an `agentHint` that tells a coding agent to use a documented variant before inventing one.

Two rules make it safe to run alongside a repo scan:

- **The adapter contract**: it writes IR only. Never the wiki, never Pulse. Blocks go into the registry through `recordIngest()`.
- **The conflict rule**: if the registry already holds the same block id from a *different* ingest source with different content, the incoming block lands with status `conflict` instead of overwriting. A human resolves it in the wiki Pipeline. The ingest is recorded as `partial: true` so a Storybook run cannot mark scan facts stale.

Note that Storybook is the one adapter that bypasses the `design.md` funnel and writes blocks directly. That is a deliberate exception: Storybook contributes *component* facts to an existing system rather than defining a whole system, so it has no tokens, no foundation, and nothing to render as a standalone wiki. `graphFromStorybook()` can also emit a standalone `blocksmith.blocks.v1` graph document with `--graph-only`.

Other adapters present: none. There is no OpenAPI adapter, no Style Dictionary adapter, no Tokens Studio adapter. They are listed as **Idea** in the table in section 11 so they are not lost.

---

## 8. The browser extension and the Figma plugin

Both directories exist. Both are early. Be honest about that.

### 8.1 `extension/` : BlockSmith Capture

**Status: Shipped as a demo-grade unpacked extension.** Manifest V3, version 0.1.0. Four files: `manifest.json`, `popup.html`, `popup.js`, `background.js`. Documented in `extension/README.md` and `docs/DESIGN-FIRST-INGEST.md`.

What exists today:

- Permissions are `activeTab` and `storage`, with host permissions for the production origin and `http://localhost:3000`. The service worker is intentionally empty; all logic is in the popup, because `chrome.tabs.captureVisibleTab` requires a user-gesture context.
- Up to four captures per design, taken as JPEG at quality 82, held in `chrome.storage.session` so they vanish when the browser closes.
- Captures post to `POST /api/ingest/capture` with `images`, `sourceUrl`, `title`, and an optional `targetDoc`.
- **Figma enrichment mode.** `figmaDocRef(url)` in `popup.js` recognizes a `figma.com/design/<key>` or `figma.com/file/<key>` URL and derives `upload:scan-figma-<key>.md`, which is exactly the filename the Figma connector produces. When that target is set, the capture is *appended* to the existing connector document under `## Supplemental Capture Evidence` rather than creating a second project. The route verifies the target is a Figma-sourced document (its `workspace-root` must start with `figma://`) and requires write access before appending.
- **The truth model is enforced in code.** `extractDesignMarkdownFromImages()` in `src/lib/ingest/capture.ts` appends a provenance footer and a machine-readable marker `<!-- blocksmith:capture-draft -->`. While that marker is present the wiki shows a "Captured draft" banner on every page of the document. Confirming strips it through the normal source editor. A capture never auto-promotes into a lock, before or after confirm. Tiered source confidence, stated in `docs/DESIGN-FIRST-INGEST.md`: code scan beats design-tool node tree beats vision capture.
- Server-side guards: 503 when no vision key is configured, 401 in strict mode without sign-in, and the AI rate limits (per IP and per user) because vision calls are real spend. Vision model fallback chain is Llama 4 Maverick, then Llama 3.2 90B Vision, then Phi 3.5 Vision, overridable with `NVIDIA_MODEL_VISION`. Up to 4 images, each capped at about 6 MB of base64.

What it is meant to become: the "restyle the web" track. Point it at any webpage, extract a `design.md`, and eventually push style changes back. That is a different ideal customer profile from the Figma-fit wedge and should not be conflated with it. Today the extension only reads.

### 8.2 `figma-plugin/` : BlockSmith Annotate

**Status: Partial.** A Figma development plugin, not published to the Figma community. Four files: `manifest.json`, `code.js` (113 lines), `ui.html`, `README.md`.

What exists today:

- Loads all pages, then takes the current selection (or the page's children when nothing is selected) as candidate nodes, capturing each node's id, name, type, and existing annotation labels.
- Exports up to four small JPEG previews at 0.75 scale and posts them, with the node list, to `POST /api/v1/figma/annotations/propose`. That route requires an actor (an API key or a session), applies the AI rate limits, and calls `proposeFigmaAnnotations()`.
- Proposals come back constrained: at most 3 per node and 40 total, each with a node id that must be in the submitted set, one of exactly four categories (Development, Interaction, Accessibility, Content), a label under 280 characters, a confidence level, and pinned properties drawn from a fixed allowlist of 13 Figma property names. Anything that fails validation is dropped server-side rather than passed through.
- The UI lists proposals with checkboxes. Applying writes native Figma annotations through `figma.annotations` and **preserves existing annotations** by appending rather than replacing.
- The API key lives in Figma's private `clientStorage`, not in the document.
- A local deterministic preview works without the server.

What it is meant to become: phase 3 of design-first ingest, the annotation loop. Today the human review gate lives in the BlockSmith wiki. The goal is to move it into Figma where designers actually work: the fusion pass proposes annotations, the designer reviews and edits them inside Figma, and re-extraction reads confirmed annotations as promoted-grade metadata. The connector already reads native annotations back out (`extractFigmaFile()` collects them and the fusion prompt is told to treat them as explicit designer intent), so the round trip is closed in principle. The doctrine does not change: AI proposes, human disposes, just upstream instead of downstream.

Honest assessment: `code.js` is 113 lines and there is no automated test for the plugin. It works in a demo. It is not hardened.

---

## 9. Vision describes, structure governs

This is the most important rule in this chapter, and the one most likely to be violated by a well-meaning contributor who wants "the AI to just read the design."

### The rule

**Structured extraction produces the governable spine.** Exact values, traceable to a source, drift-comparable. A CSS variable from `src/app/globals.css` line whatever. A Figma color style with a name and a hex. A component's variant options read out of its `componentPropertyDefinitions`. These are facts. They can be locked, versioned, promoted, and served to agents as rules.

**Multimodal vision produces qualitative enrichment.** Component roles, usage notes, imagery style, composition, density, hierarchy, dos and donts, the prose that makes a wiki readable rather than a token dump. These are descriptions. They are useful, they are not authoritative, and they never become the value of anything.

Or in five words: **vision describes, structure governs.**

### How it is enforced

Not by convention. By prompt, by data flow, and by lifecycle.

**By prompt.** The fusion system prompt in `src/lib/ingest/capture.ts` (`FIGMA_FUSION_PROMPT`) opens by stating the model is enriching exact structured Figma facts, and then instructs it, in order: do not emit token tables, do not claim exact numeric values because the structured Figma tree is authoritative for those, cite one or more provided node ids in backticks for every observation, treat supplied annotations as explicit designer intent, and end with an evidence list of rendered frame names and node ids. The response must begin with `## Visual Language & Intent` or it is rejected outright.

**By data flow.** The connector calls `extractFigmaFile()` first and computes the whole token set and component set from the tree. The vision call receives a `structuredSummary` string ("N exact tokens; M component sets; ...") and is told not to contradict it. The vision output is appended as a markdown appendix *after* the structured document. It cannot overwrite a token row because it never touches the token table.

**By lifecycle.** Vision-derived documents carry provenance and, for captures, the `blocksmith:capture-draft` marker that keeps the wiki banner up until a human confirms. The connector's provenance section states plainly that structured nodes are authoritative and visual observations are descriptive. The capture-enrichment appendix repeats it. Captures never auto-promote into a lock.

**By graceful degradation.** With no `NVIDIA_API_KEY`, structured import still succeeds, and the response says why fusion was skipped. Structure without vision is a thinner wiki. Vision without structure would be a confident fabrication.

The same discipline appears in the scan curator, which is a text model rather than a vision model but faces the identical temptation: `assertHexSubset()` throws if the curated prose contains a hex that was not in the facts, and `mergeInventoryIntoMarkdown()` re-appends the deterministic inventory after curation so the model cannot drop a file.

### Why the reverse would be dangerous

Suppose we let vision produce token values and used structure only for prose. Trace what happens.

1. A vision model reads `#2563EB` off a JPEG that has been resized, JPEG-compressed, and possibly rendered over a semi-transparent overlay. It returns `#2565EC`. Perceptually identical. Numerically wrong.
2. That value enters `design.md` as a token.
3. Drift now reports a mismatch against the code, which is actually correct. The engineer "fixes" the code to match the hallucinated token. The design system is now measurably wrong, and the wrongness was introduced by the tool whose job is to prevent exactly that.
4. Or worse: a human promotes the token, it enters the lock, and MCP starts serving it to coding agents as a rule. Every agent-written component now uses a color no designer ever chose.
5. And there is no way to detect it after the fact, because the provenance says "extracted from the design", which is technically true.

Now add the second-order problem. Drift only has value if both sides are exact. Two approximate sides produce a report where every row is a small mismatch, the signal-to-noise ratio collapses, and users learn to ignore the drift view. The moment drift becomes noise, the wedge is gone, because the drift view *is* the product.

Compare with the failure mode of the correct arrangement. Vision writes a slightly wrong prose sentence about a component's role. A human reads it in the wiki and edits it. Nothing downstream breaks, nothing enters a lock, no agent is misled about a value. The blast radius of a vision error under the correct rule is one paragraph. Under the reversed rule it is the entire governed system.

There is one place where a vision model is currently allowed to produce values, and it is deliberate: the screenshot-to-project bootstrap in section 6.2, which creates a new editable project rather than describing an existing system. If you extend that path to touch an existing document, you must add the draft-marker lifecycle that the capture path already has.

---

## 10. Round-trip integrity: smuggling structure through markdown

Markdown is a lossy carrier. The funnel decision in section 1 means a `ComponentInterface` object and up to 8 KB of verbatim TypeScript have to survive being written into a human-readable document and read back out. Here is how.

### Invisible HTML comments

`workspaceScanToMarkdown()` writes, per component, after the visible metadata table:

```
<!-- blocksmith:interface {"name":"Button","props":[...],"extendsTypes":[],"hasChildren":true,...} -->
<!-- blocksmith:source PGRpdiBjbGFzc05hbWU9...  -->
```

- **`blocksmith:interface`** carries `JSON.stringify(componentInterface)` inline. It is recovered by `parseInterfaceComment()` in `src/lib/scan/parse.ts` with the regex `<!--\s*blocksmith:interface\s+(\{[\s\S]*?\})\s*-->` and a `JSON.parse` inside a try block that returns `undefined` on failure. It is also read independently by `codeComponentSurfacesFromMarkdown()` in `src/lib/figma/component-drift.ts`, which is how variant-level drift works without re-parsing any source.
- **`blocksmith:source`** carries the verbatim component source **base64 encoded**. Base64 is not decoration. Raw TypeScript inside an HTML comment would break the moment the source contained `-->`, a backtick fence, a pipe character inside a markdown table region, or a line starting with `#`. Base64 reduces the payload to `[A-Za-z0-9+/=]`, which is inert in both markdown and HTML comments. `parseSourceComment()` decodes it back.

Both are invisible in the rendered wiki, which is the point: a human reads a clean component page, and the machine reads a full IR from the same bytes.

Other markers using the same technique: `<!-- blocksmith:capture-draft -->` (draft lifecycle), `<!-- blocksmith:figma-fusion model=... -->` (which model produced the visual appendix), `<!-- blocksmith:supplemental-capture target=... -->` (extension enrichment provenance), and `<!-- blocksmith-end-<componentId> -->` (the DESIGN.md writeback section terminator in `src/lib/scan/design-md.ts`).

### What else survives, and how

| Data | Carrier | Reader |
|------|---------|--------|
| Workspace root, project name, timestamps, coverage counts | YAML frontmatter | `parseMarkdownFrontmatter()` (gray-matter) |
| Facts fingerprint | `scan-facts-hash` in frontmatter | `getWorkspaceScanSyncStatus()` |
| CSS variables | the `Token`, `Value`, `Source` table | `parseCssVarTable()` |
| Colors | the `Hex`, `Occurrences`, `Sources` table | `parseWorkspaceHexColors()` |
| Utility classes | the `Class`, `Uses`, `Sources` table | `parseUtilityClassesTable()` |
| CSS rules | the `Selector`, `Styles`, `Source` table | `parseCssRulesTable()` |
| Component metadata | the `Field`, `Value` table per component | `parseTableField()` in `parse.ts` |
| Props and variants | `blocksmith:interface` comment | `parseInterfaceComment()` |
| Component body | `blocksmith:source` comment (base64) | `parseSourceComment()` |
| Full file inventory | `Codebase inventory` table | `parseInventoryTable()` |
| Human role and notes | Bold `**Role:**` line and `**Designer notes:**` block | regex in `parseComponents()` |

### What does not survive

Anything truncated on the way out is gone. The markdown keeps only the top 120 utility classes, the first 200 CSS rules, the first 40 catalog exclusions, at most 12 CSS variables and 8 hex values in a component's metadata row, and no source at all for files over 8 KB. Those caps exist to keep documents readable and under storage limits, and they mean the published document is a lossy projection of `WorkspaceScanResult`. If you need the unabridged facts, read `.blocksmith/scan-facts/`, which `persistScanFacts()` writes before curation.

### The stale-upload shadowing gotcha

This one has cost real debugging time, so it gets its own subsection.

`data/uploads/` is gitignored. The committed, reproducible scan document lives at `fixtures/vendor-ui/scan-snapshot.md` (and `.blocksmith/scan-snapshot.md`). But `loadUploadMarkdown()` in `src/lib/codegen/run.ts` resolves in this order:

1. `data/uploads/<fileName>` on local disk, if it exists.
2. The committed fixture snapshot, but only when the filename is exactly `scan-acme-ui-kit.md`.
3. Supabase, via hydrate.
4. The fixture snapshot as a last-resort fallback.

Step 1 wins. So a stale `data/uploads/scan-acme-ui-kit.md` on your machine, produced before you changed the scanner, **shadows** the committed snapshot. You change the extractor, you run codegen, nothing changes, and you conclude your change did not work. It did; you were reading last week's document.

The symptom is the same for anything that reads a published document: codegen, drift, the wiki, `npm run verify:pulse`. The fix is to regenerate after any scanner change:

```bash
npm run scan:vendor      # rewrites data/uploads/scan-acme-ui-kit.md and the fixture snapshot
```

The same class of problem exists in reverse for the memory cache in `src/lib/uploads/persist.ts`: a warm process holds the markdown in a `Map` keyed by filename, so an out-of-band edit to the file on disk is not seen until the process restarts or something calls `persistUploadMarkdown()` again.

---

## 11. Every ingest path, at a glance

| # | Path | Entry point | Code path | Output | Verify | Status |
|---|------|-------------|-----------|--------|--------|--------|
| 1 | **Local repo scan** | `npm run scan`, `blocksmith scan /path`, MCP `scan_workspace` | `walk.ts` → `extract.ts` → `to-markdown.ts` → `run.ts` | `upload:scan-<id>.md` plus `.blocksmith/scan-snapshot.md` | `verify:vendor-fixture`, `verify:vendor-e2e`, `scan:verify`, `verify:scan-wiki` | **Shipped** |
| 2 | **CLI client scan upload** | `blocksmith scan /path` (scans locally, uploads markdown) | `scan-local.ts` → `scripts/scan-client.ts` → `runClientScanExport()` → `persistClientScan()` | `upload:scan-<id>.md` | `verify:scan-backend` | **Shipped** |
| 3 | **GitHub scan** | Home page Connect GitHub, `POST /api/scan/workspace {github}`, `blocksmith scan --github` | `github.ts` tarball → `service.ts` → `run.ts` | `upload:scan-<id>.md` (no snapshot, no git commit) | `verify:github-scan` | **Shipped** |
| 4 | **Fixture demo scan** | Try demo, `blocksmith scan --fixture vendor`, `{fixture:"vendor"}` | `service.ts` fixture mode → `run.ts` | `upload:scan-acme-ui-kit.md` | `verify:vendor-fixture`, `verify:scan-backend` | **Shipped** |
| 5 | **Figma MCP import (variables)** | Agent calls `import_figma_variables`, or `POST /api/figma/import` | `adapter.ts` `assembleFigmaImport()` → `import.ts` → `to-markdown.ts` | `upload:scan-figma-<fileKey>.md` | `verify:figma-import` | **Shipped** (proven live) |
| 6 | **Figma MCP import (no variables)** | Same, passing `designContextCode` | `figmaDesignContextToTokens()` → same pipeline | Same | `verify:figma-import` | **Shipped** (proven live) |
| 7 | **Figma REST connector** | `/figma` UI, `POST /api/figma/connect {figmaUrl, figmaToken}` | `rest.ts` `fetchFigmaFile()` + `extractFigmaFile()` → `handleImportFigmaVariables()` | Same, plus `## Figma provenance` and optional fusion appendix | `verify:figma-import` (pure extractor only) | **Built, unproven** against a live token |
| 8 | **Figma webhook resync** | `POST /api/figma/webhook` on a Figma V2 event | Same as 7, server-side `FIGMA_ACCESS_TOKEN` | Overwrites the same doc | Manual (`docs/TESTING-FIGMA-FUSION.md` section D) | **Built, unproven** |
| 9 | **Token drift** | MCP `figma_token_drift`, `POST /api/figma/drift` | `drift.ts` `computeTokenDrift()` vs `codeVarsFromScanMarkdown()` | `TokenDriftReport` plus rendered markdown | `verify:figma-import` | **Shipped** |
| 10 | **Component / variant drift** | Same, with `components` | `component-drift.ts` vs `blocksmith:interface` comments | `ComponentDriftReport` plus markdown | `verify:figma-import` | **Shipped** (proven live) |
| 11 | **Markdown paste** | Home studio textarea, `POST /api/wiki/import {markdown}` | `saveMarkdownUpload()` → parser auto-detect | `upload:<slug>-<hash>.md` | `verify:wiki` | **Shipped** |
| 12 | **File upload (single or bulk)** | Home studio drop zone, `POST /api/wiki/import` multipart | Same | One doc per file | `verify:wiki` | **Shipped** |
| 13 | **Starter project scaffold** | Dashboard prompt bar, `POST /api/projects/create {useAi:false}` | `create.ts` `createStarterProject()` → `to-markdown.ts` | `upload:scan-project-<key>.md` | none | **Shipped** |
| 14 | **AI generate from prompt** | Dashboard prompt bar, `POST /api/projects/create {useAi:true}` | `generate.ts` → `specToParts()` → `persistDesignProject()` | Same, falls back to 13 on any error | none | **Shipped** (needs a model) |
| 15 | **AI generate from screenshot** | Dashboard image upload, `POST /api/projects/generate-image` | `vision-generate.ts` → shared validation → `persistDesignProject()` | Same | none | **Shipped** (needs a vision model) |
| 16 | **Browser capture (new draft)** | Extension popup, `POST /api/ingest/capture` | `capture.ts` `extractDesignMarkdownFromImages()` → `saveMarkdownUpload()` | `upload:capture-<slug>.md` with draft marker | Manual (`docs/DESIGN-FIRST-INGEST.md`) | **Shipped** (demo-grade) |
| 17 | **Browser capture (enrich Figma doc)** | Extension popup with `targetDoc` | Appends `## Supplemental Capture Evidence` to an existing `figma://` doc | Same doc, appended | Manual (`docs/TESTING-FIGMA-FUSION.md` section C) | **Partial** |
| 18 | **Figma visual fusion** | Automatic inside 7 and 8 when a vision key is set | `fetchFigmaFrameImages()` → `extractFigmaVisualEnrichment()` | `## Visual Language & Intent` appendix | `verify:figma-import` (persistence only) | **Shipped** |
| 19 | **Figma annotation proposals** | Figma plugin, `POST /api/v1/figma/annotations/propose` | `proposeFigmaAnnotations()` → plugin writes native annotations | Annotations in the Figma file, read back by 7 | Manual (`docs/TESTING-FIGMA-FUSION.md` section B) | **Partial** |
| 20 | **Storybook ingest** | `npm run ingest:storybook -- <dir> --doc <ref>` | `storybook.ts` → `recordIngest()` | Blocks in the IR registry (not a wiki doc) | none (fixture only) | **Shipped** |
| 21 | **Webpage restyle extension** | none | none | none | none | **Idea** |
| 22 | **OpenAPI / Swagger adapter** | none | none | none | none | **Idea** |
| 23 | **Tokens Studio / Style Dictionary adapter** | none | none | none | none | **Idea** |
| 24 | **Non-React framework scan (Vue, Svelte)** | none | none | none | none | **Idea** |

---

## Open questions

1. **Two classification gates.** `classifyComponentForWiki()` and `isScannableDesignComponent()` overlap and can disagree, and only the first one produces a reason string. Should the second be folded into the first, or does the second gate encode BlockSmith-specific exclusions that a vendor scan should not inherit?
2. **The `#88ppxx` hex bug.** `normalizeHex()` in `src/lib/scan/extract.ts` does not validate hex digits, so any three-character CSS variable value becomes a fake color. The fix is a one-line regex change to match the Figma version. What else depends on the current (wrong) output? At minimum, the committed fixture snapshot and any recorded facts hashes change.
3. **Figma alias resolution.** We skip unresolved `VARIABLE_ALIAS` values rather than guessing. A file that expresses its whole semantic layer as aliases to a primitive layer therefore imports as near-empty. Should we make a second MCP or REST call to resolve the graph, and what does that cost in latency and plan requirements?
4. **The REST connector has never been proven against a live personal access token.** Everything is unit-tested against recorded payloads. Someone needs to run it against three real files on three different Figma plans and record what actually comes back.
5. **Vision producing token values in `generate-image`.** Section 6.2 is the one place a vision model sets values. It creates a new project rather than describing an existing system, so it is defensible, but there is no draft marker and no banner. Should the capture lifecycle be applied there too?
6. **The 5,000 file cap is silent.** A truncated scan looks identical to a complete one in the published document. It should at minimum write a `scan-truncated: true` frontmatter field and show a banner.
7. **`DESIGN.md` is listed but never merged.** Vendors keep real design intent in that file. Is there a safe way to ingest it (as prose only, never as values, per section 9) or does that reintroduce the exact confusion the vision rule prevents?
8. **The Figma plugin has no tests.** 113 lines of `code.js`, no automated coverage, and it writes to a customer's Figma document. What is the minimum test harness that makes that acceptable?
9. **Storybook bypasses the `design.md` funnel.** It writes blocks directly. That is defensible for a component-only source, but it means the funnel invariant in section 1 has one documented exception. Should future adapters follow Storybook's shape or the Figma shape, and what decides?
10. **Drift is only ever Figma against code.** The machinery reads two published documents and is source-agnostic. Nothing prevents Storybook against code, or capture against Figma. Nothing exposes those either.

---

## Where to look in the code

**The funnel**
```
src/lib/scan/to-markdown.ts        workspaceScanToMarkdown() : the single emitter
src/lib/scan/types.ts              WorkspaceScanResult : the single input shape
src/lib/scan/parse.ts              parseWorkspaceScanMarkdown() : the single reader
src/lib/scan/fingerprint.ts        scanResultFingerprint() : facts hash for staleness
src/lib/scan/inventory.ts          the deterministic, never-LLM-edited inventory section
```

**Repo and GitHub scan**
```
src/lib/scan/extract.ts            scanWorkspace() : the extractor
src/lib/scan/walk.ts               walkUiFiles(), findDesignDocPaths()
src/lib/scan/workspace-config.ts   blocksmith.config.json, catalog.json, scan roots
src/lib/scan/catalog.ts            classifyComponentForWiki(), applyCatalogOverrides()
src/lib/scan/component-filter.ts   isScannableDesignComponent() : the second gate
src/lib/scan/component-interface.ts extractComponentInterface() : syntactic TS only
src/lib/scan/css-rules.ts          CSS rule extraction and table parsing
src/lib/scan/tailwind-classes.ts   utility class extraction and table parsing
src/lib/scan/tokens.ts             CSS var table parsing, designer surfaces/spacing/radius
src/lib/scan/workspace-colors.ts   hex table parsing and color merge
src/lib/scan/github.ts             parseGithubUrl(), cloneGithubRepo() : tarball, not git
src/lib/scan/run.ts                scanAndPersist(), the ordered publish pipeline
src/lib/scan/service.ts            runScanService(), the four modes, path guard
src/lib/scan/sync-status.ts        stale detection and refresh hints
src/lib/scan/upload-overrides.ts   human edits that survive a rescan
src/ai-lab/09-scan-curate/         optional LLM polish, and the assertions that fence it
```

**Figma**
```
src/lib/figma/types.ts             the wedge doctrine, in a comment at the top
src/lib/figma/adapter.ts           assembleFigmaImport(), flattenFigmaVariableDefs(),
                                   figmaDesignContextToTokens() : the no-variables path
src/lib/figma/normalize.ts         figmaNameToCssVar(), asColor(), asDimension()
src/lib/figma/import.ts            importFigmaVariables(), the synthetic scan result
src/lib/figma/components.ts        Figma components → ScannedComponent IR
src/lib/figma/rest.ts              parseFigmaFileKey(), extractFigmaFile(), fetchFigmaFile()
src/lib/figma/drift.ts             computeTokenDrift(), valuesEqual(), renderDriftMarkdown()
src/lib/figma/component-drift.ts   variant-level drift from embedded interface comments
```

**Other ingest**
```
src/lib/ingest/capture.ts          vision capture, Figma fusion, annotation proposals
src/lib/ingest/storybook.ts        Storybook index → blocks, with the conflict rule
src/lib/dashboard/create.ts        persistDesignProject(), createStarterProject()
src/lib/dashboard/generate.ts      prompt → spec → validated tokens
src/lib/dashboard/vision-generate.ts screenshot → spec → validated tokens
src/lib/uploads/persist.ts         memory + Supabase + local mirror
src/lib/uploads/paths.ts           safeUploadFileName(), doc ref helpers
src/lib/parser/generic.ts          parser auto-detection for pasted documents
src/lib/markdown/frontmatter.ts    parseMarkdownFrontmatter()
```

**Routes**
```
src/app/api/scan/workspace/route.ts        public scan: fixture, github; local paths 403
src/app/api/v1/scans/route.ts              API-key scan: all four modes
src/app/api/figma/import/route.ts          MCP-shaped import
src/app/api/figma/connect/route.ts         REST connector plus visual fusion
src/app/api/figma/drift/route.ts           token and component drift, access-gated
src/app/api/figma/webhook/route.ts         Figma V2 event resync
src/app/api/ingest/capture/route.ts        extension capture, new draft or enrich
src/app/api/wiki/import/route.ts           paste and file upload
src/app/api/projects/create/route.ts       starter and AI-from-prompt
src/app/api/projects/generate-image/route.ts AI-from-screenshot
src/app/api/v1/figma/annotations/propose/route.ts plugin annotation proposals
src/mcp/handlers.ts                        handleImportFigmaVariables(), handleFigmaTokenDrift()
```

**Scripts**
```
scripts/scan-workspace.ts          npm run scan
scripts/scan-client.ts             local scan, JSON to stdout, used by the CLI
scripts/ingest-storybook.ts        npm run ingest:storybook
scripts/verify-vendor-fixture.ts   scan → markdown → parse, stable filename
scripts/verify-vendor-e2e.ts       full scanAndPersist, upload on disk, snapshot
scripts/verify-external-vendor.ts  a second fixture, always runs
scripts/verify-scan-backend.ts     the unified service, path guards, clientScan
scripts/verify-scan-coverage.ts    published inventory matches live facts
scripts/verify-scan-wiki.ts        published markdown renders correctly in the wiki model
scripts/verify-github-scan.ts      real public repo, clone → scan → persist → parse
scripts/verify-component-interface.ts  every real-world component shape
scripts/verify-figma-import.ts     54 checks: normalize, components, drift, handlers
```

**Fixtures, plugins, docs**
```
fixtures/vendor-ui/                the Acme UI kit: four primitives, one shell, config, snapshot
fixtures/external-mini/            a second, deliberately different vendor shape
fixtures/storybook-static/         a Storybook index for the adapter
extension/                         MV3 capture extension (manifest, popup, background, README)
figma-plugin/                      BlockSmith Annotate development plugin
docs/GOAL1-VENDOR-SCAN.md          the scan runbook, config reference, debug checklist
docs/FIGMA-IMPORT.md               the Figma runbook and surface matrix
docs/DESIGN-FIRST-INGEST.md        the three phases of design-first ingest
docs/PASTE-AND-WIKI.md             paste and upload
docs/TESTING-FIGMA-FUSION.md       the manual test script for fusion, plugin, webhook
```
