# The Wiki: Where The Company Lives

**What this chapter covers.** Every human-facing surface BlockSmith ships: the marketing landing, the signed-in dashboard, the wiki and all of its pages and tabs, edit mode, the release console, Visualize, public share links, and the design language we use on ourselves. For each surface you get what the user sees, which file renders it, which API it calls, and whether it is real or a placeholder.

**Why it matters.** BlockSmith has one product rule that decides scope arguments: the wiki is not documentation hosting, it is the release console for design. Every other artifact we ship (the CLI, the MCP server, the CI gate, the npm package, the device profile) is a *consumer* of decisions humans made in the wiki. If you understand the wiki, you understand what the company sells. If you build something outside the wiki that lets a human change design truth, you have built the wrong thing.

**Read this if** you are about to touch anything under `src/app/wiki/`, `src/app/dashboard/`, `src/components/wiki/`, or `src/app/api/wiki/`, or if someone asks you "should this be a separate admin app?" (the answer is in section 1).

---

## 1. The founding rule

The rule is written down in `docs/TEAM-NORTH-STAR.md`, and it is short:

> If a feature helps teams control design truth, it ships **in the wiki first**. CLI, MCP, and CI are **consumers** of what humans promote in the wiki.

Everything in this chapter is downstream of that sentence. The north star doc states the product thesis this way (punctuation adjusted to house style): the wiki is where a company lives, where you browse, govern, and promote design blocks to production; one team gets one design graph and one importable package; agents and apps consume pinned versions through `blocksmith.lock`, not "latest markdown."

### 1.1 The "do not build / build instead" table

This table is reproduced from `docs/TEAM-NORTH-STAR.md`. Each row is expanded below with the reasoning, because the reasoning is the part that keeps getting lost.

| Do not build | Build instead |
|--------------|---------------|
| Separate "Jenkins for design" admin app | **Pipeline UI inside the wiki** (badges, promote, rollback, lock status) |
| Second dashboard for blocks | Component and token pages **are** the block pages |
| Notion clone for free-form docs | Structured blocks with a **draft to production** lifecycle |
| Per-engineer design packages | **Per product, per org** package |

**Row 1: no separate release admin app.** The tempting architecture is a "BlockSmith Admin" where design leads approve things, with the wiki as a read-only rendering of what was approved. That fails for a social reason, not a technical one. The person who decides that a button rule is correct is the person reading the button page. If approval lives in a different tool, approval becomes an unrelated chore performed later by someone with less context, and the wiki degrades into stale documentation, which is exactly the thing every design team already has and hates. So the promote button sits on the page where the decision is made: `BlockReleaseStrip` on the component page (`src/components/wiki/BlockReleaseStrip.tsx`), and the full console at `/wiki/pipeline`.

**Row 2: the component page is the block page.** In the Design IR, a block is a versioned unit: `component:primary-button`, `token:color:accent`, `guideline:dos`, `agent-rule:guide`, `page:introduction`, `section:<slug>`. Those ids are not internal plumbing, they are addresses of pages a human already visits. Giving blocks a second home (a "Blocks" screen listing 400 rows) would mean the human has to hold a mapping in their head between the thing they read and the thing they approve. Instead the block strip is rendered inline, and the block id is derived from the same slug the page uses. See the call sites: `IntroductionPage` passes `page:introduction`, `ColorPage` passes `colorBlockId(cssVar)`, `GuidelinesPage` passes `guideline:dos` and `guideline:donts`, `AgentGuidePage` passes `agent-rule:guide`, `ComponentDetailPage` passes `component:${component.id}`.

**Row 3: not a Notion clone.** Free-form docs cannot be promoted, diffed, or pinned. A block has a version number, a content hash, an official pointer, and an append-only history; a Notion page has none of those. This is why the wiki's editor is deliberately narrow: structured forms where the shape is known (a color row, a typography family, a component role), plus one raw-markdown escape hatch per section (`SectionEditor`) so nothing is truly read-only. We are not competing on writing experience. We are competing on "what exactly did engineering agree to ship, and which version is live right now."

**Row 4: one package per product, not per person.** The package name is derived from the doc reference by `packageNameForDoc()` in `src/lib/ir/releases.ts`: `upload:scan-acme-mobile-app.md` becomes `@blocksmith/acme-mobile-app`. If packages were per-user, two engineers on the same team would compile different UIs from the same design system, which destroys the entire premise. Roles (owner, admin, member, viewer) control *who may promote*, not *which package you get*.

### 1.2 Who consumes what humans promote

From the same doc, and true in the code today:

| Consumer | How they get truth | Official versions only? |
|----------|--------------------|--------------------------|
| Human in the wiki | Renders the graph, can preview drafts | No, drafts are visible |
| Cursor and other MCP clients | `get_design_tokens`, `get_component_docs` | Yes, enforced in `src/lib/ir/enforce.ts` |
| Customer app | `import ... from "@blocksmith/..."` | Yes, built from the promoted graph |
| Customer CI | `npm run validate:ui` plus the lock in their repo | Yes |
| Device simulator, `tokens.h` | `compile:device` | Yes |

The wiki is the only surface in that list where a human can see something that is not yet true in production. That asymmetry is the product.

### 1.3 What the rule forbids in practice

Concrete consequences you will run into:

- A new governance control does not get a settings page in the dashboard. It goes on the wiki page that the rule applies to, or on `/wiki/sync` if it is workspace-wide (see `GovernanceSettingsPanel`).
- The CLI never gets a `blocksmith promote` command that bypasses the wiki. `blocksmith pull` reads what was promoted; it does not decide.
- Any AI feature must feed the loop, never fork it. The governance copilot (`GovernanceCopilotPanel`) drafts text into the human's edit form and writes nothing on its own: `POST /api/wiki/governance/draft` returns a suggestion and persists nothing.

---

## 2. The signed-in journey

### 2.1 Landing versus dashboard

`src/app/page.tsx` is 18 lines and does one decision:

```tsx
const signedIn = !!(await getSupabaseUser());
if (signedIn) redirect("/dashboard");
return <HomeStudio />;
```

Signed out you get the marketing landing (`src/components/home/HomeStudio.tsx`, roughly 900 lines: hero, ASCII art, feature cards, a developer section with the CLI snippet, testimonials, a get-started band). Signed in you never see it again. Auth failure falls through to the landing rather than erroring, which is deliberate: a misconfigured Supabase should not take the marketing site down.

Two honest notes about the landing, because you will be asked:

- `HomeTestimonials.tsx` contains five fabricated testimonials ("Jane Doe", "Acme Corp", and so on) and `TRUSTED_LOGOS` in `HomeStudio` attributes invented quotes to real companies. This is placeholder marketing copy and must be removed or replaced before any public launch.
- `ScanWorkspaceCard.tsx` is the fully working "Connect GitHub and scan a repo" widget (OAuth via `createBrowserSupabase().auth.signInWithOAuth`, repo list from `/api/auth/github/repos`, scan through `POST /api/scan/workspace`). It is imported by `HomeStudio.tsx` but never rendered. The buttons a visitor actually sees in the `#start` section are plain `<button type="button">` elements with no handler. The working component is orphaned; the visible one is a stub.

### 2.2 The dashboard as home base

Route group: `src/app/dashboard/` with `layout.tsx`, `page.tsx`, `connectors/`, `settings/`, `analytics/`.

`layout.tsx` renders a shadcn sidebar shell: an inline script that reads `localStorage["bs-dashboard-theme"]` and stamps `data-dash-theme="dark"` on `<html>` before hydration (no flash of the wrong theme), then `DashboardThemeProvider`, `AppSidebar`, a header with breadcrumbs, and the page content. Dashboard chrome tokens live in `src/styles/dashboard.css`, scoped to `.dashboard-shell`.

`page.tsx` is the home base itself and does three things:

1. Reads the session (`getSupabaseUser`) for the greeting.
2. Computes tenant scoping. In hosted mode (`saasDbEnabled()`), it resolves the caller's default org (`ensureDefaultOrg`) and builds `allowedFileNames` from `listDocumentsForOrg(org.id)`. An anonymous visitor in hosted mode gets an empty set, so they see nothing. Locally, with no database, `allowedFileNames` stays `undefined` and everything local is listed.
3. Renders `PromptBar` at the top, then either `DashboardEmptyState` (zero projects) or `ProjectGrid`.

**The prompt bar** (`src/components/dashboard/PromptBar.tsx`) is the single entry point for creating a design system. It has one textarea and several routes out of it:

| Input | What happens | Endpoint |
|-------|--------------|----------|
| Free text that does not look like markdown, AI on | Generate a system from the prompt | `POST /api/projects/create` with `useAi: true` |
| Free text, AI off | Scaffold a neutral starter system | `POST /api/projects/create` with `useAi: false` |
| Pasted markdown (detected by `looksLikeMarkdown`: contains a newline, starts with a heading, or starts with `---`) | Import as a document | `POST /api/wiki/import` |
| Attached `.md` file | Same import path with a filename | `POST /api/wiki/import` |
| Attached PNG, JPEG, or WebP | Read a screenshot into a system | `POST /api/projects/generate-image` |

All four paths end in `router.push(wikiUrl)`, so every creation gesture lands you inside the wiki. That is the point: there is no "project settings" limbo between creating a system and governing it.

Two placeholders in the prompt bar to be aware of: the model dropdown lists "Claude 3.5 Sonnet", "GPT-4o", and "Gemini 1.5 Pro", but `selectedModel` is never sent to the server (the AI path is NVIDIA-backed, gated by `isNvidiaConfigured()`); and the "Import from Figma" and "Scan a repo" pills link to `/dashboard/connectors#figma` and `#codebase`, anchors that no longer exist on that page.

**The project grid** (`src/components/dashboard/ProjectGrid.tsx`) renders one card per design system. Each card is a `Link` to `/wiki?doc=<docRef>`, plus a checkbox for multi-select, plus a kebab menu with Rename and Delete. Client-side search, kind filter (Figma, Code scan, Design, Sample) and sort (recent, name) run over the already-loaded list. Delete is optimistic with a 5 second undo window (`UNDO_MS = 5000`): the card disappears immediately, a toast offers Undo, and only after the timer expires does the browser call `POST /api/projects/delete`. Rename posts to `POST /api/projects/rename`, which rewrites `project-name:` in frontmatter and the first H1 in the markdown.

### 2.3 What a "project" actually is

One project equals one design system equals one document record. Concretely:

```
Org (blocksmith_orgs)
 └── DocumentRecord (blocksmith_documents / data/cloud/documents.json)
       fileName: scan-acme-ui-kit.md
       docRef:   upload:scan-acme-ui-kit.md
       scanMode: import | github | workspace | figma | ...
       published: bool
        │
        ├── markdown            data/uploads/<name>-<hash>.md  (or Supabase Storage)
        ├── parsed blocks       <writableRoot>/blocks/<docKey>/*.json
        ├── IR registry         <writableRoot>/registry/<docKey>/<blockId>.json + manifest.json
        ├── reference lock      <writableRoot>/locks/<docKey>.lock
        ├── pipeline runs       <writableRoot>/runs/<docKey>.json
        └── public shares       data/public-share/<shareId>.json
```

`blocksmithWritableRoot()` (`src/lib/runtime/writable-root.ts`) is `<cwd>/.blocksmith` locally and `os.tmpdir()/blocksmith` when hosted, with Supabase tables (`blocksmith_block_registry_entries`, `blocksmith_registry_manifest`, `blocksmith_block_locks`, `blocksmith_pipeline_runs`) as the durable mirror.

The doc reference is the join key everywhere. It travels through the UI as the `?doc=` query parameter (`DOC_QUERY_KEY` in `src/lib/wiki/doc-param.ts`), and `hrefWithDoc(path, fileName)` is the helper that keeps it attached across navigation. If you ever write a wiki link by hand and forget `?doc=`, the user silently drops back to the default document.

### 2.4 `listDashboardProjects` and why it reads local uploads

`src/lib/dashboard/projects.ts` is small but load-bearing:

```ts
export async function listDashboardProjects(
  allowedFileNames?: Set<string>,
): Promise<DashboardProject[]>
```

It calls `listUploads()` (the upload backend, not the filesystem directly), optionally filters to the tenant's allowed file names, and then branches:

- **Hosted** (`supabaseStorageEnabled()`): read denormalized metadata from `getCachedMetas()` in one batch. On a cache miss it falls back to `coarseProject()`, which derives a name and kind from the filename alone and reports zero tokens and components. This exists because downloading N markdown documents from object storage on every dashboard render is unacceptable latency.
- **Local**: parse every document (`richProject`) to get the real name, kind, token count and component count.

The parsing helpers are deliberately dumb regex over markdown: `countTokens` counts table rows starting with a backticked `--` CSS variable, `countComponents` counts `###` headings inside the Component Library section, `deriveKind` looks at the `workspace-root` frontmatter (`figma://`, `project://`) and the filename prefix (`scan-`, `design-`).

Why local uploads at all? Because the product must run with no Supabase, no auth, and no network. A new engineer clones the repo, runs `npm run dev`, and sees real projects on the dashboard because `data/uploads/*.md` is right there. The same code path serves production by swapping the backend behind `listUploads()`. The cost is that the tenant boundary is enforced by the *page* (which builds `allowedFileNames`), not by the lister, so any new caller of `listDashboardProjects` must remember to pass the scope. That is a sharp edge worth knowing.

### 2.5 Connectors, settings, analytics

| Route | File | State |
|-------|------|-------|
| `/dashboard/connectors` | `src/app/dashboard/connectors/page.tsx` renders `IntegrationsSection` | **Partial.** A vendored integrations table with hardcoded rows (Slack, GitHub, Figma, Jira), fake "Last sync" strings ("10 minutes ago"), local-state-only toggles, and an API Key input that saves nothing. None of it is wired to `POST /api/figma/connect` or the scan endpoints. |
| `/dashboard/settings` | `src/app/dashboard/settings/page.tsx` | **Shipped, thin.** Real data: GitHub login, email, org name from `ensureDefaultOrg`, your role and member count from `listOrgMembers`, plus a sign-out button. "Plan: Free" and "Governance: Tiers 1 to 3 enabled" are static strings. |
| `/dashboard/analytics` | `src/app/dashboard/analytics/page.tsx` renders `<Dashboard />` | **Not real.** Every tile is hardcoded: `src/components/stats.tsx` ships "12 Design Systems", "1,248 Active Components", "94% Governance Score"; `recent-scans.tsx` ships invented activity rows. No fetch calls exist in any of these files. |

The dashboard sidebar (`src/components/app-sidebar.tsx`) is also a vendored template that still says "Efferd" in the header and "© Efferd LLC" in the footer, with several nav entries pointing at `#/projects`, `#/team`, `#/api-keys`. The hand-built `DashboardSidebar.tsx` described in the original design note was deleted in favour of it. Replacing that chrome is unglamorous but it is the first thing a customer sees after sign-in.

---

## 3. The wiki itself

### 3.1 One route to rule them all

The entire wiki is a single Next.js optional catch-all: `src/app/wiki/[[...slug]]/page.tsx`, `export const dynamic = "force-dynamic"`. There is no per-page route file. The flow is:

1. `resolveDocParam(searchParams.doc)` picks the document, falling back to `getDefaultDocFileName()`.
2. `assertWikiDocAccess(fileName)` gates reads. Important detail: it returns immediately unless `saasStrictMode()` is on (which defaults to `NODE_ENV === "production"`). Locally, everything is open. In strict mode it resolves the doc to a registry file name, allows named public content, accepts pending invites, and then calls `canAccessDocument(fileName, userId, { action: "read" })`, calling `notFound()` if you are not allowed. A denied user gets a 404, not a 403, so the existence of another team's document is not leaked.
3. `prepareDesignSystemDoc(fileName)` hydrates the markdown (this is what makes hosted uploads work on a cold serverless instance), then `loadDesignSystem(fileName)` parses it.
4. `ensureDesignIRWithFonts(fileName, system)` compiles the Design IR and resolves fonts.
5. `getDocLifecycle({ mode: system.mode })` decides whether this document is `preview`, `connected`, or `pinned`.
6. `renderRoute(...)` switches on the joined slug and the parser mode.
7. `normalizeWikiNav(system.nav, lifecycle)` reshapes the sidebar, and `WikiShell` renders the chrome around the chosen page.

### 3.2 Three parser modes, one shell

`system.mode` decides which route table applies:

| Mode | Source | Route table |
|------|--------|-------------|
| `apollo` | A structured design markdown (tables for colors, typography, spacing, a Component Library section) | Full: introduction, all foundation pages, demo, playground, guidelines, agent guide, governance, pipeline, releases, sync |
| `workspace-scan` | A repo scan (`blocksmith-source: workspace-scan` in frontmatter) | Introduction, color, css-vars, styles, surfaces, spacing, components hub ("Featured"), inventory, source, governance, pipeline, releases, sync, per-component pages |
| `generic` | Any other markdown | Introduction, source, sync, releases, pipeline, governance, per-section pages under `/wiki/doc/<id>`, and `GenericModeNotice` for anything else |

The router is explicit rather than clever: each mode has its own `if` chain in `renderRoute`. That is intentional. A single generic route map would have to guess what a page means for a scan document versus a hand-written design document, and guessing is how you end up rendering an empty "Typography" page for a repo that has no type scale.

### 3.3 Document lifecycle: the honesty rule

`src/lib/wiki/doc-lifecycle.ts` is 50 lines and prevents the single most damaging lie the product could tell.

```
Paste / upload (scanMode "import")   -> preview
Bundled sample (apollo.md, ...)      -> preview
GitHub / workspace scan              -> connected
Lock verified in customer repo       -> pinned   (reserved, collapses to connected today)
```

A `preview` document has no repository behind it. If we showed it a Pipeline with a green "Promoted to production" toast, we would be claiming that agents somewhere now follow this rule. They do not. So `renderRoute` short-circuits:

```tsx
if (lifecycle === "preview" && (route === "pipeline" || route === "releases")) {
  return <PreviewPipelineEmptyState route={route} />;
}
```

`PreviewPipelineEmptyState` shows a lock icon and two links: connect a repo, or watch the release loop at `/demo/investor`. `normalizeWikiNav` additionally marks those nav items `locked: true` in preview so the sidebar shows a padlock instead of a live link.

The companion file is `src/lib/wiki/edit-policy.ts`, which is client-safe (no server imports) so edit forms can call it in the browser:

| Lifecycle | Document kind | canEdit | canPromote | Reason shown |
|-----------|---------------|---------|------------|--------------|
| connected or pinned | GitHub or workspace scan | yes | yes | full finalize, promote, pull |
| preview | `upload:*` or `scan-*` | yes | no | "Saved to your preview document. Connect a repo to promote to production and share with engineering." |
| preview | bundled sample | no | no | "This is a read-only sample. Connect a repo and scan to save changes to your team's pipeline." |

### 3.4 The chrome

`src/components/wiki/WikiShell.tsx` composes everything:

- **`TopNav`** (sticky, 56px). Logo, three tabs, search box, theme toggle, export, auth chrome. The tabs are: **Design** (`/wiki`), **Releases** (`/wiki/pipeline`), **Setup** (`/wiki/sync`). Note the label-to-route mismatch: the tab called "Releases" points at the *Pipeline*, and its active state also covers `/wiki/releases` and `/wiki/governance`. The top nav colours come from `--chrome-nav-*`, which are deliberately excluded from the Visualize theme graph (see section 6).
- **`WikiWorkspaceBar`**. System name, a lifecycle chip (Preview / Connected / Pinned) with subtitle copy from `LIFECYCLE_COPY`, the `SourceSwitcher` (jump to another document), and the Visualize button.
- **`Sidebar`**. Renders the normalized nav, remembers open sections in `sessionStorage` under `blocksmith-wiki-sidebar-v2` (v2 because v1 accumulated `open: true` for every section ever visited), auto-expands the active branch, and force-expands everything while a search query is active. Search itself is a 120ms-debounced filter over nav labels in `WikiShell`.
- **Banners**, in render order inside the content column: `PostScanBanner` (reads `?scanned=<n>` and offers "Open Pipeline" or "Browse the wiki"), `CaptureDraftBanner` (a design captured through the browser extension is a draft project until a human confirms), `ScanStaleBanner` (workspace-scan only, offers a re-scan through `/api/sync/rescan` or `/api/sync/github-rescan`), and `WikiEditBanner`.
- **`WikiBuildGate`** wraps children and shows `WikiGeneratingOverlay` for up to 2.2 seconds after a create or scan, keyed by a `sessionStorage` flag. Content stays visible underneath, never `opacity: 0`, because hiding it caused blank white screens.
- **`SyncToast`** for live sync events.

`normalizeWikiNav` (`src/lib/wiki/normalize-nav.ts`) unifies the three parsers into one sidebar shape: Introduction, then a **Workflow** section, then Explore / Foundation / Components / For developers. Two behaviours worth knowing. First, `SIDEBAR_WORKFLOW_IDS` contains only `pipeline`, `governance`, and `sync`, so **Release log is intentionally absent from the sidebar**; `/wiki/releases` is reachable only through the "Table view" link on the Pipeline page. Second, when it hoists workflow items out of the sections whose ids are `sync` or `guidelines`, it drops any remaining items in those sections. On an apollo document that means the **Guidelines** and **Agent guide** nav entries disappear even though both pages exist and are editable. That is a real navigation bug, not a design decision.

### 3.5 Page by page

Everything below is rendered inside the shell described above. "Reads" means the props the router hands it or the endpoint it fetches itself.

#### Introduction (`/wiki`)

`IntroductionPage.tsx`, client. A four-swatch brand hero linking to the color page, the title and tagline, an inline edit form for name, tagline and overview, scan coverage ("N React files, M featured") with an amber warning when too few components were featured (with the `catalogPaths` hint for `blocksmith.config.json`), quick-link chips, and a four-card meta grid (Parser, Source, Last synced, Mode). Edits through `useEditableBlock` with block id `page:introduction`; promotes through `BlockReleaseStrip`.

#### Color (`/wiki/foundation/color`)

`ColorPage.tsx`, client. Grouped swatch grid (`ColorSwatchCard`, grouping by `groupColorsByCategory`), a large inspector for the selected color with copy buttons for the hex and the CSS variable, a full-palette strip, and an edit form (name, hex validated against `#rrggbb`, role). Block id is `colorBlockId(cssVar)`, described in the file as a mirror of `slugFromCssVar` in the extractor: `token:color:<slug>`. Reads `system.colors` only. The swatch card draws a checkerboard behind light colors, which is the one legitimate use of a CSS gradient in the wiki.

#### Typography (`/wiki/foundation/typography`)

`TypographyPage.tsx`, client. A family selector, an edit form (name, Google Fonts substitute, weights, sizes, line height, letter spacing, role), a `FontSpecimen` per family with a live sample, a size slider, a weight selector and a "View on Google Fonts" link, and a type scale section driven by `TypeScalePreview`. Block id `token:typography:<slug>`.

#### Spacing (`/wiki/foundation/spacing`)

`SpacingPage.tsx`, client. Base unit label from `spacingBaseUnitLabel(ir)`, a spacing scale where each row is a proportional bar wrapped in `InspectablePreview`, a border-radius grid, and layout chips. Block id `token:spacing:<token>`.

#### Surfaces (`/wiki/foundation/surfaces`)

`SurfacesPage.tsx`, server. A stack of `SurfaceLevelCard`, each offset by `index * 24px` with descending z-index so elevation reads visually. Each card carries a `ShareBlockPanel` (see section 7). No editing.

#### Layout and Imagery

`LayoutPage.tsx` and `ImageryPage.tsx` are both server components that render a header and one paragraph of prose (`system.layoutNotes`, `system.imagery`). They are honest stubs: the parser extracts the text, the page shows it, nothing more.

#### Featured components (`/wiki/components`, workspace-scan mode)

`ScanComponentsHubPage.tsx`, client. This is the nav item labelled **Featured**. A grid of component cards linking to `/wiki/components/<id>`; each card renders a scaled-down live preview when `canRenderLocalScannedPreview(component)` is true, otherwise an "Open for preview" placeholder. "Featured" exists because a repo scan finds hundreds of files and most are not design-system components; the scan promotes a subset and the full list lives on Inventory.

#### Component detail (`/wiki/components/<id>`)

`ComponentDetailPage.tsx`, client. The densest page in the product, and the canonical example of the founding rule. In order: `PageHeader` with status badge and edit controls, `BlockReleaseStrip` for `component:<id>`, `ScanPullHint`, the edit surface (`ComponentGovernanceEditPanel` for scanned components, otherwise a plain role and description editor), a compact `GovernanceCopilotPanel`, a live preview, a collapsed "Scan details (for engineers)" section wrapping `ScannedComponentPanel`, `ShareBlockPanel`, designer notes, and `ComponentActivityPanel` (last 25 activity entries from `listActivity`).

#### Styles and CSS variables (workspace-scan mode)

`ScanStylesPage.tsx` shows utility classes found in the codebase as chips (capped at 80, with a "+N more" note) and CSS rules grouped by source file. `ScanCssVarsPage.tsx` groups raw `--*` variables by prefix and renders a color chip when the value parses as a color. Both are read-only reports of what the scanner found, and both only appear in the nav when the scan actually produced data (`system.scanCssVars?.length`, `system.scanCssRules?.length`).

#### Inventory (`/wiki/inventory`)

`ScanInventoryPage.tsx`. Three stat cards from `system.scanCoverage` (React files, total UI files, featured of total) and a table of every scanned file with its exports, featured flag and category. File paths link back to the component page when a component's `scan.sourceFile` matches. This is the page that answers "did you actually read my whole repo?"

#### Playground (`/wiki/playground`, apollo mode)

`ComponentPlaygroundPage.tsx`, 646 lines, the largest page. A component picker grouped by `classifyComponentKind`, a canvas with light/dark/system preview, interaction-state pills from `deriveComponentStates`, generated CSS and HTML with copy buttons, and a control panel (content text, render-as kind, variant, colors snapped to the token palette, border width, radius, padding, font size, weight, shadow preset, family). Everything is ephemeral: nothing is written back to the document. It is a thinking tool, not an authoring tool.

#### Generated demo (`/wiki/demo`, apollo mode)

`DemoPage.tsx`. Renders a whole fake product surface (dashboard or landing) using only your tokens, plus a provenance list that says exactly what came from your system and what is sample copy, plus a code view generated by `generateProjectFiles`. Archetypes come from `src/ai-lab/06-demo-compose`.

#### Guidelines and Agent guide

`GuidelinesPage.tsx` edits two lists (do's and don'ts) under the block id `guidelines`, but renders two release strips for `guideline:dos` and `guideline:donts`. `AgentGuidePage.tsx` edits a markdown textarea under block id `agent-guide` and promotes `agent-rule:guide`. In both cases the edit id and the promote id differ, which is a latent inconsistency to fix rather than to imitate.

#### Governance (`/wiki/governance`)

Rendered by `renderGovernance()` in the router, which does real work before the page mounts:

```ts
const snapshot = buildSystemSnapshot(system, ir);
recordSnapshot(docFileName, snapshot);
const previous = loadPreviousSnapshot(docFileName, snapshot.contentHash);
const diff = previous ? diffSnapshots(previous, snapshot) : null;
const report = scoreFidelity(system, ir);
```

`GovernancePage.tsx` then renders a score ring (green at 85 and above, amber at 60 and above, otherwise red), a list of fidelity checks with pass, warn or fail, a drift list of added, removed and changed tokens and components since the previous snapshot, `GovernanceViolationsPanel`, and `ComponentActivityPanel`.

`GovernanceViolationsPanel` is the design lead's inbox. It reads `GET /api/wiki/governance/violations?doc=...&status=open&limit=30` and shows each event with its tier (`block` or `warn`), rule id, message, snippet, author, source, commit hash, and override reason. Acknowledge and Mark resolved send `PATCH` to the same route. The events arrive from developers running `check_governance_diff` through MCP before pushing; an override recorded with `record=true` lands here. This is the loop that makes governance more than a document: a rule written in the wiki produces a warning in someone's editor, and the override lands back in the wiki with a name attached.

#### Source (`/wiki/source`)

`SourcePage.tsx`, client. A full-document markdown editor: `GET /api/wiki/source?doc=` loads content plus content hash, a plain textarea at 60vh holds it (the header comment explains: no Monaco, keeps the bundle light for v1), and `POST /api/wiki/source` saves the whole file. A 409 flips the UI into a conflict banner with "Overwrite and save to staging". On success it dispatches the `blocksmith:staged` window event with `blockId: "source:full"`. An amber warning says source edits affect the entire document.

#### Sync (`/wiki/sync`)

`SyncPage.tsx`, server. The setup and administration page, and the only wiki page that is mostly about the workspace rather than the design:

- `SourceSwitcherHint` and `ScanPullHint` (copyable `blocksmith pull --doc <ref>` with the suggested workspace path).
- `SyncStatusPanel`: connection status and event counters. It subscribes to Supabase Realtime broadcast on `REALTIME_CHANNEL` for `blocks.updated`, and falls back to `new EventSource("/api/sync/events")` when Supabase is not configured. The sub-label always claims "File watcher, SSE, wiki auto-refresh" even on the Supabase path.
- `DeviationsQueuePanel`: pending, approved and rejected deviations with TTL countdown, backed by `/api/v1/deviations`. Admins and owners can pass or roll back.
- `LockStatusCard`: lock freshness dot, package name, graph hash, live and waiting counts, and a copyable pull command. It is the at-a-glance version of the Pipeline lock strip and hides itself entirely if the registry has not been materialized.
- Status rows: client, source, parser, last loaded, number of `.md` files available.
- Team workspace: `TeamPanel` (invite by email through `/api/v1/orgs/invite`, membership from `/api/v1/orgs/me`), `GovernanceSettingsPanel` (deviation TTL, budget limits, escalation thresholds, admin and owner only), and `PublishCard`.
- API keys: `ApiKeysPanel` creates a key through `POST /api/v1/auth/keys/me`, shows it exactly once, offers revoke, and renders `CursorMcpInstall` immediately after creation, which builds a one-click Cursor deeplink and a copyable `.cursor/mcp.json`. This is the handshake moment where a human decision becomes an agent capability.

`PublishCard` flips the document's public flag through `POST /api/wiki/publish`. It is the only route in the wiki API with an explicit `roleAtLeast(role, "admin")` gate, and its effect is significant: `canAccessDocument` grants anonymous read to any published document, which then appears on the org microsite at `/sites/<slug>`.

#### Pipeline and Releases

Covered in full in section 5.

### 3.6 Route to component to data, in one table

| Route | Component | Primary data source |
|-------|-----------|---------------------|
| `/wiki` | `IntroductionPage` | props (`system`, `ir`, `meta`, `sources`) |
| `/wiki/foundation/color` | `ColorPage` | `system.colors` |
| `/wiki/foundation/typography` | `TypographyPage` | `system.typography`, `system.typeScale` |
| `/wiki/foundation/spacing` | `SpacingPage` | `system.spacing`, `system.borderRadius`, `ir` |
| `/wiki/foundation/surfaces` | `SurfacesPage` | `system.surfaces` |
| `/wiki/foundation/layout` | `LayoutPage` | `system.layoutNotes` |
| `/wiki/foundation/imagery` | `ImageryPage` | `system.imagery` |
| `/wiki/foundation/css-vars` | `ScanCssVarsPage` | `system.scanCssVars` |
| `/wiki/foundation/styles` | `ScanStylesPage` | `system.scanCssRules`, `system.scanUtilityClasses` |
| `/wiki/foundation/agent-guide` | `AgentGuidePage` | `system.agentGuide` |
| `/wiki/components` | `ScanComponentsHubPage` | `system.components` |
| `/wiki/components/<id>` | `ComponentDetailPage` | `system.components`, `listActivity`, `resolveComponentExcerptForDoc` |
| `/wiki/components/buttons` | `ButtonsPage` | `system.components` filtered by title, `system.dos` |
| `/wiki/inventory` | `ScanInventoryPage` | `system.scanCoverage`, `system.scanInventory` |
| `/wiki/playground` | `ComponentPlaygroundPage` | `ir` through `useDesignIROptional()` |
| `/wiki/demo` | `DemoPage` | `ir`, `src/ai-lab/06-demo-compose` |
| `/wiki/guidelines` | `GuidelinesPage` | `system.dos`, `system.donts` |
| `/wiki/governance` | `GovernancePage` | `buildSystemSnapshot`, `scoreFidelity`, `GET /api/wiki/governance/violations` |
| `/wiki/source` | `SourcePage` | `GET` and `POST /api/wiki/source` |
| `/wiki/sync` | `SyncPage` | many panels, see above |
| `/wiki/pipeline` | `PipelinePage` | `GET /api/wiki/pipeline` |
| `/wiki/releases` | `ReleasesPage` | `GET /api/wiki/releases` |
| `/wiki/doc/<id>` | `GenericSectionPage` | `system.sections` |

---

## 4. Edit mode and finalize

### 4.1 The word "draft" means three different things

This trips up everyone. Keep them separate:

1. **Browser draft.** `useEditableBlock` (`src/hooks/useEditableBlock.ts`) stores unsaved form state in `localStorage` under `blocksmith:draft:${docRef}:${blockId}`, along with the `baseContentHash` captured when editing started. Nobody else can see it. It survives a reload.
2. **Staging draft.** After a successful finalize, the markdown is written and `refreshBlocksForDoc(doc, "web")` records a **new version** in the IR registry with `status: "draft"` and `editedBy: "web"`. The block's `official` pointer has not moved, so agents, MCP and CI still read the old version. The wiki labels this state "Staging".
3. **Preview document.** A `preview` lifecycle document, where saves land in the upload record and promotion is impossible. This is a property of the *document*, not of any block.

The badge in `BlockStatusBadge.tsx` maps `BlockStatus` to labels, and it deliberately does not use the word "Draft":

| `BlockStatus` | Badge label | Meaning |
|---------------|-------------|---------|
| `draft` | **Staging** | A newer version exists; production is unchanged |
| `finalized` | **Live** | This version is the official pointer |
| `stale` | **Stale** | The source vanished from the repo, but the lock still pins the last official version |
| `conflict` | **Conflict** | Two sources disagree about this block |

(The north star document still writes this set as "Draft, Live v3, Stale, Conflict". The code says Staging. Prefer the code, and fix the doc.)

### 4.2 How a human edits governance

Take the case the product is actually about: a design lead changes when a button may be used.

1. They open `/wiki/components/primary-button?doc=upload:scan-acme-ui-kit.md`.
2. `PageHeader` shows the current badge and an "Edit block" button (only when `blockId` is set and there is no conflict).
3. Clicking it opens `ComponentGovernanceEditPanel`. That panel opens with an amber notice that is worth quoting because it is the product thesis compressed into three sentences: you are setting **rules** for when and how to use this component, colors and spacing and variants come from **code** (shown in the preview beside the form), and saving only changes human-facing policy. Saved edits land in Staging; promote them on the Pipeline.
4. The form has two fields: "When to use this component" (one line) and "Usage rules, do's and don'ts" (multi-line). Beside them: a live preview rendered from the real scan, a read-only "From code" strip showing the source file and the CSS variables the component uses, and a live preview of the exact `DESIGN.md` section that will be written.
5. Optionally the human types intent into `GovernanceCopilotPanel` ("Primary CTA only, max one per view, never for destructive actions"), gets back a suggested role, suggested rules and a rationale from `POST /api/wiki/governance/draft`, and clicks "Apply to draft". The suggestion never reaches the server state; it only fills the human's form. The route is gated behind `governanceCopilotEnabled()` and returns 503 when no model is configured.
6. "Save draft" calls `finalize()`.

### 4.3 What finalize does

`POST /api/wiki/finalize` (`src/app/api/wiki/finalize/route.ts`, about 210 lines) with:

```json
{
  "doc": "upload:scan-acme-ui-kit.md",
  "blockId": "component:primary-button",
  "updatedData": { "role": "...", "description": "..." },
  "baseContentHash": "a1b2c3d4e5f60718",
  "force": false,
  "promote": false
}
```

Step by step:

1. Validate `doc` and `blockId`. Rate limit on `pipeline:write:<ip>`, default 120 requests per 10 minutes (`BLOCKSMITH_PIPELINE_RATE_LIMIT`), returning 429 over the limit.
2. For upload references, `requireDocumentAccess(request, fileName)` with the default action `"write"`, which needs `member` or higher. Repository documents under `docs/designs.md/` skip this check.
3. Compare the sha256 prefix of the current markdown against `baseContentHash`. Mismatch returns **409** with `{ error: "Conflict", currentHash }` unless `force: true`.
4. `modifyMarkdownBlock(currentMd, blockId, updatedData)` patches the markdown, then it is persisted (`persistUploadMarkdown` for uploads, a direct write for repository documents). **This overwrites the source file in place with no backup.**
5. For `component:*` block ids on a workspace-scan document, the human prose is also written to sidecar override files (`setUploadComponentOverride`, and `setComponentOverride` in the vendor tree when the workspace path is allowlisted). This is what lets a re-scan overwrite the machine facts without destroying the human's rules.
6. `clearDesignSystemCache()`, then `refreshBlocksForDoc(doc, "web")` records the new staging version. `getBlockHistory` supplies `stagedVersion` for the response.
7. If and only if `promote === true`, it also calls `promoteBlock`, `writeReferenceLock(doc)` and syncs the lock to the cloud. The UI does not send `promote: true` for normal edits, and the build-order doc explicitly says to avoid it.
8. `syncRegistryToCloud(doc)` always runs. Staging errors are captured into a `stagingError` field rather than failing the request.

Response: `{ success, contentHash, staged, stagedVersion, promotedVersion, lockHash, stagingError, pipelineUrl }`.

The client then dispatches `window.dispatchEvent(new CustomEvent("blocksmith:staged", { detail: { docRef, blockId } }))`. Two components listen: `BlockReleaseStrip` (reloads its own row) and `WikiEditBanner` (reloads the staged counts). That is why saving on one page instantly updates the banner at the top of every page without a refresh.

### 4.4 Save to staging versus promote

This is the distinction the entire product rests on.

| | Save to staging | Promote |
|---|---|---|
| Button | "Save to staging" (`PageHeader`), "Save draft" (governance panel) | "Promote", "Promote all waiting", "Resolve and promote" |
| Endpoint | `POST /api/wiki/finalize` | `POST /api/wiki/promote` |
| Writes markdown | Yes, in place | No |
| Creates a new version | Yes, `status: "draft"` | No, moves the `official` pointer to an existing version |
| Moves the official pointer | No | Yes |
| Regenerates `blocksmith.lock` | No | Yes (`writeReferenceLock`) |
| Visible to agents, MCP, CI, the npm package | No | Yes, after the customer pulls |
| Logged as a pipeline run | No | Yes (`appendRunDurable`) |
| Reversible | The markdown edit is not reversible from the API; the version record is append-only | Yes, `POST /api/wiki/rollback` |

The honest-copy rule from `docs/WIKI-EDIT-MODE-BUILD-ORDER.md` is: never imply "saved to repo" until promote and pull have both happened. You can see it enforced in `SectionEditor`, which picks its success message from the edit policy:

```ts
setMessage(
  policy.canPromote
    ? "Saved to staging. Open Pipeline to promote."
    : "Saved to your preview document.",
);
```

### 4.5 The universal escape hatch

`SectionEditor` exists so that no page is ever a dead end. The router hands each apollo page a `sectionEdit` prop mapping the page to its exact markdown heading through the local `se()` helper (the colors page maps to the Colors token heading, the surfaces page to the Surfaces heading, the guidelines page to the do's and don'ts heading, and so on). `PageHeader` renders it as a collapsible "Edit section source" control. It loads `GET /api/wiki/source?doc=...&section=<slug>`, shows the raw markdown for that heading, and saves through the same `POST /api/wiki/finalize` with block id `section:<slug>` (handled by `replaceSectionBody` in `src/lib/parser/modify.ts`). It renders nothing at all when `canEditDoc().canEdit` is false, which keeps read-only samples honest.

Note that `docs/WIKI-EDIT-MODE-BUILD-ORDER.md` still lists `WikiEditBanner`, `src/lib/wiki/edit-policy.ts`, `POST /api/wiki/source` and foundation-page editing as work to be done. All four now exist in the repo. The build-order document is stale on those points; treat the code as the truth and correct the doc.

### 4.6 Conflicts

Two independent conflict mechanisms share a word:

- **Edit conflict (409).** The document changed since the browser draft was created. Surfaced by `PageHeader`'s red banner ("Conflict Detected: this block changed in the IDE while you were editing") with two choices: "Overwrite and save to staging" (re-posts with `force: true`) or "Discard my draft". `SectionEditor` and `SourcePage` show their own inline versions of the same thing.
- **Block conflict (`status: "conflict"`).** Two ingest sources disagree about the same block, for example a human edited a component's prose in the wiki while a re-scan produced a different value. The block appears in the Staging lane with a red card and the promote button changes to "Resolve and promote", which sends `resolveConflicts: true`.

---

## 5. The release console

There are two surfaces on the same data. `/wiki/pipeline` is the visual console and the default; `/wiki/releases` is the dense table, linked from the Pipeline header as "Table view". `docs/PROJECT-PIPELINE.md` says the table should be demoted to "advanced", and the top nav already labels the Pipeline route "Releases", so the naming is currently inconsistent across three places.

### 5.1 `/wiki/pipeline`

`PipelinePage.tsx` fetches `GET /api/wiki/pipeline?doc=<ref>` once on mount and after every mutation. That route composes `ensurePipelineRegistry`, `hydrateRunsFromCloud`, `buildReleaseTable`, the parsed lock body and `listRuns(doc, 25)`, then splits the rows into lanes:

- `lanes.staging`: rows where `draftPending`, or `official == null`, or `conflict`.
- `lanes.production`: rows with an `official` version.
- `lanes.lockedIds`: the block ids present in the current lock.
- `driftCount`: from the lock drift report, or the production count when there is no lock at all.

Layout, top to bottom:

**Header.** Title, "Table view" link, and the primary promote button, labelled either `Promote N selected` or `Promote all waiting (N)`.

**`LockStrip`.** A pinned status bar with three states and three different calls to action:

| Lock state | Message | Primary action |
|------------|---------|----------------|
| No lock | "Production graph ready, pin your repo to enforce agents" | **Pin production lock** (`POST /api/wiki/pin-lock`) |
| Stale | "Promoted after last pull, N pins would fail validate:ui" | **Copy pull** |
| Fresh | "Agents and CI pinned to this graph" | **Copy lock** |

The meta line shows the graph hash, the package name and the live count. Pin is disabled when `counts.live === 0`, and the API returns 409 if there are no official blocks, which prevents writing a lock that pins nothing. This whole control exists to fix a specific dead end: after a first scan, every block auto-promotes, so there is nothing to promote and no lock, and the customer saw "40 Live" with no next action.

**`PipelineStageView`.** The Jenkins-style stage grid. Columns are the four stages in `src/lib/ir/pipeline-stages.ts` (`ingest`, `staging`, `production`, `lock`), relabelled in the UI as scan, staging, production, lock. The first row is a live snapshot of the current state; each subsequent row is a `PipelineRun` with per-stage durations. Stage cells are colour coded by `--pipeline-*` variables, with a diagonal hatch for failures. Clicking a run badge or "Console output" opens `RunConsoleDrawer`, which shows the actual server-side log lines (`RunLogLine[]`, capped at 200 per run) with timestamps and levels, the actor, the lock hash before and after, and up to 24 block chips. Promote runs that did not fail also get a "Rollback run" action. The header comment states the rule this component follows: no fabricated branch tags, no guessed inter-run timing. If we did not measure it, we do not draw it.

**Lanes.** Two `StageLane` columns, Staging ("Saved edits waiting for review") and Production ("Approved versions in the lock graph"), filled with `BlockCard`s. A card shows the type icon, title, block id, version (staging cards also show the current production version), the status word, and a "locked" chip titled "Pinned in blocksmith.lock". Staging cards carry a checkbox. Newly promoted cards get a highlight for 2.5 seconds.

**`PromoteDiffDrawer`.** The review gate. It fetches `GET /api/wiki/pipeline/diff?doc=...&blocks=id1,id2` and shows, per block, the version transition (`v2` to `v3`, or `new` to `v1`), a conflict warning when the staging status is `conflict`, and a Field / Production / Staging table limited to changed fields plus colors (with swatches), capped at eight rows. The footer counts changed fields and reminds the operator that history is append-only and rollback is one click. Only after confirm does the browser call `POST /api/wiki/promote`.

**`HandshakePanel`.** Imported from `ReleasesPage` and reused here. Four numbered steps with copy buttons: pull the lock (`blocksmith pull --doc <ref>`), import the package (`import { Button } from "@blocksmith/<product>"`), gate CI (a `validate:ui` GitHub Actions snippet), point agents at MCP (`/api/mcp` with a bearer key, tools read promoted versions only). Below that, links to `/demo/device?doc=...`, `/schema/blocksmith.blocks.v1.json` and `/schema/blocksmith.lock.v1.json`. The panel exists so that no part of the handshake is tribal knowledge.

### 5.2 `/wiki/releases`

`ReleasesPage.tsx` reads `GET /api/wiki/releases?doc=<ref>` into a `ReleaseTable` and renders:

- Five summary chips: Live, Drafts waiting, Stale, Conflicts, Never promoted (from `table.counts`).
- A lock banner with three copy variants ("Lock fresh", "Lock stale, versions were promoted after it was written", "No lock written yet, agents are unpinned"), the graph hash, the pinned block count, a drift list (`versionMismatches`, `missingInLock`, first five of each), and a View/Hide toggle for the raw `blocksmith.lock` JSON with a copy button.
- The table: checkbox, Block (title plus monospace id), State (badge), Production version, Latest version with a "waiting" flag, Last promote (date plus `via <editedBy>`), and Actions (Promote and Rollback).
- Expanding a row reveals the append-only version history: version number, status, whether it is the official pointer, timestamp, editor, and content hash prefix.
- The same `HandshakePanel`.

Row ordering comes from `rowOrder` in `src/lib/ir/releases.ts`: conflicts first, then drafts waiting and never-promoted, then stale, then live. The operator sees what needs attention at the top.

### 5.3 UI element to API route

| UI element | Where | Route | Payload |
|------------|-------|-------|---------|
| Load lanes, stage grid, runs | `PipelinePage` | `GET /api/wiki/pipeline?doc=` | reads only |
| Load release table | `ReleasesPage`, `LockStatusCard`, `WikiEditBanner` | `GET /api/wiki/releases?doc=` | reads only |
| Load one block's row | `BlockReleaseStrip` | `GET /api/wiki/releases?doc=&block=` | reads only |
| Diff before promote | `PromoteDiffDrawer` | `GET /api/wiki/pipeline/diff?doc=&blocks=` | reads only |
| Promote (single, batch, or resolve) | `BlockReleaseStrip`, `ReleasesPage`, `PipelinePage` | `POST /api/wiki/promote` | `{ doc, blockIds[], resolveConflicts }` |
| Rollback one block | `ReleasesPage`, `PipelineStageView` | `POST /api/wiki/rollback` | `{ doc, blockId }` |
| Pin production lock | `LockStrip` | `POST /api/wiki/pin-lock` | `{ doc }` |
| Save an edit to staging | `PageHeader`, `SectionEditor`, all edit forms | `POST /api/wiki/finalize` | `{ doc, blockId, updatedData, baseContentHash, force }` |
| Save whole source | `SourcePage` | `POST /api/wiki/source` | `{ doc, content, baseContentHash, force }` |
| Publish to the org site | `PublishCard` | `POST /api/wiki/publish` | `{ doc, published }` |
| Acknowledge or resolve a violation | `GovernanceViolationsPanel` | `PATCH /api/wiki/governance/violations?doc=` | `{ id, status }` |
| Seed the investor demo | `InvestorDemo` | `POST /api/wiki/pipeline/demo` | none |
| Export the wiki as markdown | top nav | `GET /api/wiki/export?doc=&format=md` | reads only |

### 5.4 Promote, rollback, and the run log

`POST /api/wiki/promote` hydrates the registry from the cloud, ensures blocks exist, loops `promoteBlock(doc, blockId, "", { deferManifest: true })` (falling back to `resolveConflict` only when `resolveConflicts` is set and the error mentions a conflict), updates the manifest once for the whole batch, writes the reference lock, and syncs registry and lock to the cloud in parallel. A cloud persistence failure does not fail the request; it sets `persisted: false` and returns a `persistenceWarning`. Every attempt appends a run through `appendRunDurable`, success or failure.

`POST /api/wiki/rollback` picks the highest version below the current official that has a `finalizedAt`, sets the official pointer to it, rewrites the lock, and logs a new run. If there is no earlier finalized version (the common case immediately after a first promote), it returns 409 with a readable error. Nothing is ever deleted: rollback is itself a new run, and the version history keeps every entry.

`PipelineRun` (in `src/lib/ir/pipeline-runs.ts`) records the doc, a monotonic run number, the actor (GitHub login, API key owner, `ingest`, or `local-dev`), the action (`promote`, `rollback`, `pin-lock`, `ingest`, `demo-seed`), a summary, the blocks touched with versions, the lock hash before and after, the duration, per-stage results, and the console log. Storage is `<writableRoot>/runs/<docKey>.json` with a best-effort Supabase mirror.

---

## 6. Visualize

### 6.1 What it does

The wiki normally renders in BlockSmith's own chrome. Click "Visualize style" in the workspace bar and the wiki repaints itself in *your* design system: your colors, your fonts, your radii, your surfaces. It is the fastest possible answer to "is this document actually describing our product?"

The implementation is `src/hooks/useVisualizeStyle.ts` plus `src/lib/apollo/apply-theme-client.ts`. The preference is remembered per document in `localStorage` (`blocksmith-visualize:<fileName>`).

### 6.2 Hybrid: deterministic first, AI second

From `docs/VISUALIZE-AND-API.md`, and matching the hook:

1. **Immediately** (under a second): the semantic compiler maps the Design IR to `--wiki-*` variables. Fonts load through `loadGoogleFontsForTypographyAsync`, then `applyVisualizeThemeFromIR(ir)` writes the variables. `compileMode` becomes `"deterministic"`. This requires no model and no network beyond fonts. `canVisualizeSystem(ir)` gates the button: the IR must have colors, components or spacing.
2. **In the background** (typically 30 to 90 seconds, timeout at 90): if `GET /api/ai/status` reported `configured: true`, the hook posts to `/api/ai/layout` with the document reference and the IR content hash. A successful response calls `applyVisualizeThemeFromIR(ir, layout)` and `compileMode` becomes `"ai"`.
3. **On failure or timeout**: `setAiWarning(...)` shows a soft notice in the workspace bar and the deterministic preview stays exactly as it was. The AI pass can only improve the page; it can never break it.

### 6.3 Why the preview must never invent tokens

`docs/VISUALIZE-ACCURACY-PLAN.md` calls Visualize the technical moat, and states the constraint as a layer table. Reproduced with punctuation adjusted:

| Layer | Job | Must not do |
|-------|-----|-------------|
| Parser | Extract tables into tokens (colors, type, radii, surfaces, components) | Guess brand names |
| Semantic compiler | Map tables plus Role and Purpose columns to `--wiki-*` using English semantics only | Hardcode `citra-orange`, `apollo-gold`, brand-specific regexes |
| AI (on Visualize) | Read the parsed JSON plus the source markdown and return chrome JSON for ambiguous documents | Invent a hex value that is not in the token graph |
| Validator | Merge AI output only if the hex exists in the parsed palette | Allow drift |
| Renderers | Apply the IR and generic CSS classes such as `wiki-cta-primary` | Fall back to Apollo defaults |

The reason this is a hard rule and not a preference: the wiki's whole claim is "this is what your design system says." If the preview shows a colour the document does not contain, then the preview is a fourth source of truth, competing with the markdown, the IR and the code. Worse, it is the most persuasive one, because it is the one people look at. So `mergeValidatedAiChrome()` drops any AI-proposed hex that is not present in `ir.colorVariables`, and the failure mode is "less styled", never "differently styled".

The history matters too. Earlier attempts hardcoded brand slug lists (`sprout`, `citra-orange`) and fixed Tailwind radii in wiki components. Both broke on the next customer document. That failure is why the IR exists as a compile step between the parser and the renderer.

### 6.4 The frozen top nav

One subtlety that will confuse you if you do not know it. `src/styles/blocksmith-chrome.css` defines `--chrome-nav-bg`, `--chrome-nav-text`, `--chrome-nav-muted`, `--chrome-nav-border` and `--chrome-nav-input-bg` as literal values, with a comment stating that these are intentionally not part of the `--wiki-*` theme graph, so Visualize and the AI layout never write them. The result is that the global header (logo, tabs, search, theme toggle, sign in) looks identical whether or not Visualize is on. The product chrome must stay recognisably BlockSmith even while the content area becomes someone else's brand, otherwise the user cannot tell what is their design and what is our application.

### 6.5 Accuracy status

`docs/VISUALIZE-ACCURACY-PLAN.md` tracks phases: P0 (stop showing Apollo hex values in previews) and P1 (Design IR on disk, `blocksmith.design.v1`) are complete; P2 (the AI Lab loop: semantic resolve, AI chrome merge, parser assist, component preview renderers, status messaging) is complete; P3 (a pre-built layout packet with hero and zone HTML compiled from the IR) is **Planned**, not built. Regression coverage is `npm run verify:design-ir`.

---

## 7. Public share and block-level feedback

### 7.1 The thesis

`docs/PUBLIC-FEEDBACK.md` frames it precisely: pre-launch human signal on a **single design block**, not on the whole app. The bet is that "does this button read as the primary action?" is a question you can put in front of ten people in a Slack thread and get a useful answer, whereas "review our design system" is a question nobody answers. It also converts a private governance artifact into something shareable, which is how a wiki page escapes the team that wrote it.

### 7.2 The flow

Inside the wiki, `ShareBlockPanel` (`src/components/share/ShareBlockPanel.tsx`) sits under a block. On mount it calls `GET /api/share?doc=&blockKind=&blockId=`. If no share exists, the button reads "Get public link" and calls `POST /api/share`, which is idempotent: `createShare` looks for an existing record first, so re-opening the panel returns the same URL forever. The panel then shows a copyable link, an "Open public page" anchor, four stats (Views, Works, Unsure, Doesn't work) and a "Refresh stats" button.

The URL shape is `https://<origin>/share/<12 hex characters>`, for example `http://localhost:3000/share/cb0bae5e6e0d`. The id is `randomUUID()` with dashes stripped, truncated to 12 characters.

Block ids come from `src/lib/public-share/block-ids.ts`:

| Kind | Id rule | Example |
|------|---------|---------|
| `component` | the parsed component id, verbatim | `primary-action-button` |
| `surface` | `level-<n>-<slugified name>` | `level-1-canvas` |
| `color` | CSS variable with the leading `--` removed | `color-canvas` |

`/share/[shareId]/page.tsx` is a server component: load the share record (404 if missing or disabled), load the design system, resolve the block (`loadPublicBlock`), apply the document's theme styles and Google Fonts, and render `PublicBlockPreview` plus `OpinionPanel`. Components render through the same `ComponentLivePreview` the wiki uses, so the public page is not a screenshot or a re-implementation. A component share whose `contentHash` no longer matches the system shows a note that the preview came from an earlier document version.

`OpinionPanel` offers three reactions: **Works for me** (`approve`), **Not sure** (`unsure`), **Doesn't work** (`reject`). It pings `POST /api/share/<id>/view` once per session (guarded by `sessionStorage`), posts the vote to `POST /api/share/<id>/opinion`, remembers the vote in `localStorage`, and then shows a "Community pulse" bar chart.

### 7.3 Honest gaps

The flow works end to end (there are live records in `data/public-share/`), but before this is a launched feature:

- **Free-text comments are dropped.** The route validates `comment` (max 500 characters) and passes it to `recordOpinion`, which only increments a counter. Nothing is stored. `OpinionPanel` never sends one anyway.
- **Color shares are unreachable.** Every layer supports `blockKind: "color"`, but no component renders `ShareBlockPanel` with that kind. The only two call sites are `ComponentDetailPage` (component) and `SurfaceLevelCard` (surface).
- **Storage is serverless-hostile.** `data/public-share/<id>.json` is written with `fs` under `process.cwd()`, which is read-only on Vercel. The doc says so plainly: fine for local demos, swap for Postgres or Redis when you deploy.
- **The share page never hydrates uploads.** `page.tsx` calls `loadDesignSystem` directly, without the `prepareDesignSystemDoc` call that the wiki route and `/studio` both make. Since real share records point at `upload:` references, a cold serverless instance will throw and the page will 404.
- **`enabled` is write-only.** Every read path checks it; nothing ever sets it to `false`. There is no revoke.
- **No vote integrity.** `view` and `opinion` have no auth, no rate limit and no server-side dedupe. Counts are trivially inflatable.

Related public surface: `/sites/<slug>` (`src/app/sites/[slug]/page.tsx`) is the per-org microsite listing documents an admin published through `PublishCard`. It reads `getOrgBySlug` and `listPublishedDocumentsForOrg`, and links each entry into the wiki with the org slug attached.

---

## 8. BlockSmith's own design language

"Taste is a feature" is a stated company principle. We sell design governance. If our own product looks like a template, the pitch dies in the first ten seconds. That makes our own UI a product surface, not a chore.

### 8.1 The founder's constraints

Recorded and unambiguous: Canva or Figma-like in structure (sidebar, prompt bar, project grid), **no gradients**, no AI-slop aesthetics (no purple-to-pink hero washes, no emoji affordances, no glow shadows).

### 8.2 Three palettes, which is two too many

**Palette 1: brand tokens** in `src/app/globals.css` under `@theme`. These are the ones named in the product notes and used across the marketing site and the dashboard:

| Token | Value | Role |
|-------|-------|------|
| `--color-ink-black` | `#000000` | primary text and solid buttons |
| `--color-paper-white` | `#ffffff` | canvas |
| `--color-faint-slate` | `#f8fafc` | page background |
| `--color-lavender-mist` | `#e2e9f3` | borders and dividers |
| `--color-blue-gray-mist` | `#c5d3e8` | secondary tint |
| `--color-cream-wash` | `#fffde6` | highlight tint |
| `--color-sky-tint` | `#c4edff` | highlight tint |
| `--color-graphite` | `#686562` | muted text |
| `--color-signal-orange` | `#ff4500` | errors, announcement band, the `btn-slide` hover wipe |

Type scale lives beside them (`--text-caption` 14px through `--text-display` 189px, each with its own line height and letter spacing), with the fonts wired in `src/app/layout.tsx`: **Inter** as `--font-inter` (body), **Space Grotesk** as `--font-display`, **JetBrains Mono** as `--font-mono`, exposed to Tailwind as `font-plain`, `font-gtplanar` and `font-gtstandardmono`. The house convention is Inter for body text and JetBrains Mono for small uppercase labels with wide tracking. You can see it applied consistently: `font-gtstandardmono text-[10px] uppercase tracking-wider` on the project card kind label, the "Updated 3d ago" line, the "Projects" heading and the settings section headings.

**Palette 2: wiki chrome**, in `src/styles/blocksmith-chrome.css`, described in its own header as "Privy editorial reference, ink on marble" with the rules "no gradients, no emoji affordances, no drop shadows on cards or buttons":

| Token | Value |
|-------|-------|
| `--color-canvas` | `#ffffff` |
| `--color-obsidian-ink` | `#010110` |
| `--color-carbon` | `#111117` (dark mode background) |
| `--color-graphite` | `#22222a` |
| `--color-fog` | `#73737c` (muted) |
| `--color-ash` | `#d9d9d9` |
| `--color-iris-pulse` | `#635bff` (accent, used sparingly) |

These feed the `--wiki-*` variables that every wiki component reads. Headings use `--wiki-display-font` at weight 400 with `-0.03em` tracking; body text uses Inter at `-0.02em`. Cards get a one pixel border and `--wiki-card-shadow: none`. The pipeline state colours are deliberately achromatic (`--pipeline-success` is ash, not green), so the console reads as an instrument rather than a dashboard.

**Palette 3: dashboard shell**, in `src/styles/dashboard.css`, a vendored shadcn theme in oklch with a lime-green `--primary` and its own radius scale, mapped onto `--dash-*` aliases for our components.

Note the collision: `--color-graphite` is `#686562` in the brand tokens and `#22222a` in the wiki chrome. Same name, different value, different file. And `--color-iris-pulse` (`#635bff`) is an accent that appears in no product note. This is drift, and it is exactly the failure mode the product exists to prevent. Whoever consolidates these three palettes into one governed set will be dogfooding the pitch.

### 8.3 Where the no-gradient rule holds and where it does not

It holds in the wiki. `Logo.tsx` carries the comment "Privy-style ink dot (no gradient bars)". Grepping for `gradient` under `src/components/wiki/` returns exactly two functional uses: the checkerboard behind transparent colours in `ColorSwatchCard`, and the diagonal hatch on failed pipeline stages. Both encode information rather than decoration, which is the correct exception.

It does not hold on the dashboard. `ProjectGrid.tsx` defines a `GRADIENTS` array of six Tailwind gradient classes (rose to orange, fuchsia to cyan, violet to purple, and so on) and hashes the project name to pick one for every card thumbnail. That is precisely the "AI-slop aesthetic" the constraint was written against, and it is the first screen a signed-in user sees. It should be replaced with a deterministic mark derived from the design system itself: the project's own accent colour, or a small swatch row from its palette. A design-governance product whose project cards ignore the project's design is a bad joke told at our own expense.

Also present on the dashboard and worth a decision: `BorderBeam` (an animated border on the prompt bar) and the `motion/react` transitions in the model dropdown.

---

## 9. The state of the UI

### 9.1 What the north star claims

Reproduced from `docs/TEAM-NORTH-STAR.md`, which uses a check mark for shipped:

| UI | Status |
|----|--------|
| Browse tokens, components, styles | shipped |
| Visualize (apply theme) | shipped, hybrid |
| Edit governance (Role, rules) | shipped |
| Finalize to repo or cloud markdown | shipped |
| IR registry plus promote on Finalize (backend) | shipped, local |
| Version badges (v3 live, v4 draft) | shipped, `BlockReleaseStrip` on component pages |
| Lock freshness banner ("pull lock") | shipped, Releases banner plus `LockStatusCard` on Sync |
| Per-block Promote and Rollback | shipped, `/wiki/releases` plus block-page strip, `POST /api/wiki/promote`, `/api/wiki/rollback` |
| Pipeline view (all blocks: draft, live, stale) | shipped, `/wiki/releases`, table, batch promote, history, conflicts |
| Package plus lock panel | shipped, Releases handshake panel (pull command, import, CI, MCP) |
| Device preview link from wiki | shipped, Releases to `/demo/device?doc=` |

### 9.2 What I verified in the repo

Status vocabulary per `STYLE.md`.

| Surface | File | Status | What is missing |
|---------|------|--------|-----------------|
| Landing page | `src/components/home/HomeStudio.tsx` | **Partial** | Fabricated testimonials and logo quotes; the "Connect GitHub" and "Try demo" buttons in `#start` have no handlers; the working `ScanWorkspaceCard` is imported but never rendered; `HomeStudioStyles` and `home-studio-css.ts` are dead duplicates of `home-studio.css` |
| Dashboard home | `src/app/dashboard/page.tsx` | **Shipped** | Gradient card thumbnails violate the brand constraint |
| Prompt bar | `PromptBar.tsx` | **Shipped** | Model selector is decorative; two pill links point at dead anchors |
| Project grid, rename, delete, undo | `ProjectGrid.tsx` | **Shipped** | Delete leaves orphaned registry, lock, run and share records |
| Empty state onboarding | `DashboardEmptyState.tsx` | **Shipped** | |
| Connectors | `IntegrationsSection` | **Partial** | Entirely mock data; no wiring to `/api/figma/connect` or scan routes |
| Settings | `dashboard/settings/page.tsx` | **Shipped** | Plan and governance rows are static strings |
| Analytics | `dashboard/analytics/page.tsx` | **Planned** | Every number is hardcoded; no data layer at all |
| Dashboard sidebar | `app-sidebar.tsx` | **Partial** | Vendored template, still branded "Efferd", several nav links are `#/` placeholders |
| Wiki shell, nav, search, banners | `WikiShell.tsx` and friends | **Shipped** | `normalizeWikiNav` drops the Guidelines and Agent guide nav items on apollo documents |
| Foundation pages (color, typography, spacing, surfaces) | `pages/*.tsx` | **Shipped** | Layout and Imagery are single-paragraph stubs |
| Scan pages (Featured, Inventory, Styles, CSS variables) | `pages/Scan*.tsx` | **Shipped** | |
| Component detail plus governance edit | `ComponentDetailPage.tsx` | **Shipped** | Edit block id and promote block id disagree on Guidelines and Agent guide |
| Governance copilot | `GovernanceCopilotPanel.tsx` | **Shipped** | Requires `NVIDIA_API_KEY`, returns 503 otherwise |
| Violations feed | `GovernanceViolationsPanel.tsx` | **Shipped** | `openCount` saturates at 100 |
| Source editor | `SourcePage.tsx` | **Shipped** | Plain textarea, no syntax highlighting; whole-file overwrite with no previous version retained |
| Section editor | `SectionEditor.tsx` | **Shipped** | |
| Pipeline console | `PipelinePage.tsx` plus `pipeline/*` | **Shipped** | `PipelineRunsPanel.tsx` is orphaned (superseded by `PipelineStageView`); `pipeline-stage.css` is not imported anywhere and duplicates rules already in `globals.css`; the diff drawer does not bind the Escape key |
| Releases table | `ReleasesPage.tsx` | **Shipped** | TanStack Table is wired with a single dummy column and adds nothing |
| Lock strip and pin | `LockStrip.tsx`, `POST /api/wiki/pin-lock` | **Shipped** | |
| Run console | `RunConsoleDrawer.tsx` | **Shipped** | Older runs have no captured log and say so |
| Visualize | `useVisualizeStyle.ts` | **Shipped**, hybrid | P3 layout packet is Planned |
| Playground | `ComponentPlaygroundPage.tsx` | **Shipped** | Ephemeral by design; no write-back |
| Generated demo | `DemoPage.tsx` | **Shipped** | |
| Sync page panels (keys, team, deviations, publish) | `SyncPage.tsx` | **Shipped** | Dead `SyncStep` component left in the file |
| Public share | `share/*`, `api/share/*` | **Partial** | Comments dropped, colour shares unreachable, filesystem storage, likely 404 on hosted cold start, no revoke, no vote integrity |
| Org microsite | `sites/[slug]` | **Built, unproven** | Depends on cloud org tables |
| Studio gallery | `src/app/studio/page.tsx` | **Shipped** | |
| Protocol spec site | `src/app/protocol/*` | **Shipped** | Static prose plus the real compile-targets manifest |
| Investor demo | `demo/investor` plus `POST /api/wiki/pipeline/demo` | **Shipped** | Self-seeds on load |
| Device preview | `demo/device` | **Shipped** | Compile failures degrade to an empty state |
| Pulse package demo | `demo/pulse` | **Shipped** | |
| Figma connect | `figma/page.tsx`, `FigmaConnectCard` | **Built, unproven** | The card declares `summary` and `figmaStats` and renders neither; the route has no session gate and no rate limit |
| Environment toggle (preview the wiki from the draft graph) | none | **Planned** | Listed in the north star as later work |

### 9.3 The two naming inconsistencies to resolve

1. **Pipeline versus Releases.** `PROJECT-PIPELINE.md` says Pipeline is primary and Releases should be tucked away as "table view (advanced)". The code links them to each other as peers. The top nav labels the Pipeline route "Releases". The sidebar hides the Releases route entirely. Pick one vocabulary and apply it in all four places.
2. **Draft versus Staging.** The badge says Staging, the registry status is `draft`, the north star writes "Draft", and the edit banner says "staged changes". Choose one customer-facing word (Staging reads better next to Production) and make the docs follow.

---

## 10. The interaction contract

### 10.1 Roles

`src/lib/cloud/rbac.ts` defines four roles and five actions:

```ts
type OrgRole = "owner" | "admin" | "member" | "viewer";
type DocAction = "read" | "write" | "scan" | "manage_members" | "manage_keys";
```

Ranking is `viewer` 1, `member` 2, `admin` 3, `owner` 4. `read` needs viewer, `write` and `scan` and `manage_keys` need member, `manage_members` needs admin.

Critically, `requireDocumentAccess(request, fileName, action?)` in `src/lib/cloud/access.ts` **returns success unconditionally when `saasStrictMode()` is false**, and strict mode defaults to `NODE_ENV === "production"`. So every gate below is inert in local development. Do not conclude from "it worked on my machine" that permissions are correct.

### 10.2 What each action requires

| Action | UI | Minimum role (strict mode) |
|--------|----|----------------------------|
| Read a wiki page | any wiki route | viewer, or anonymous if the document is published |
| Load the release table | `GET /api/wiki/releases` | **member** (the route calls `requireDocumentAccess` without an action, so it defaults to `write`) |
| Read source or a section | `GET /api/wiki/source` | **member**, same defaulting issue |
| Save an edit to staging | `POST /api/wiki/finalize` | member |
| Save the whole source | `POST /api/wiki/source` | member |
| Promote | `POST /api/wiki/promote` | member |
| Rollback | `POST /api/wiki/rollback` | member |
| Pin the production lock | `POST /api/wiki/pin-lock` | member |
| Re-scan | `POST /api/sync/rescan`, `/api/sync/github-rescan` | member, plus a server-allowlisted workspace path |
| Create or revoke an API key | `ApiKeysPanel` | member |
| Invite a teammate | `TeamPanel` | admin |
| Change governance settings | `GovernanceSettingsPanel` | admin |
| Publish to the public site | `PublishCard` | **admin or owner**, explicitly enforced with `roleAtLeast(role, "admin")` |
| Rename or delete a project | project card menu | member (the docstring claims owner or admin; the code does not) |
| Create a public share link | `ShareBlockPanel` | viewer (`"read"` on the document) |

Two gaps worth fixing rather than documenting around: `PROJECT-PIPELINE.md` specifies that only a `releaser` or `admin` should see Promote, Rollback and Pin; today any `member` can. And several read endpoints demand `write` because of the default argument, so a genuine `viewer` gets a 403 on the Releases page.

### 10.3 Destructive and undoable

| Action | Destructive? | Undoable? | How |
|--------|--------------|-----------|-----|
| Save to staging (`finalize`) | Yes for the markdown: the source file is overwritten in place with no backup | Partly: the version record is append-only, but the previous markdown text is gone | Edit again |
| Save whole source | Most destructive routine action: full-file overwrite, no prior copy retained anywhere | No | Re-type it |
| Promote | No: only the `official` pointer moves | Yes | `POST /api/wiki/rollback` |
| Rollback | No: a new run, history intact | Yes | Promote again |
| Pin the lock | No: derived from existing official state, idempotent | Yes | Pin again after a promote |
| Re-scan | Yes: republishes the scan markdown, overwriting machine facts | Partly: human prose survives through the component override sidecars written by `finalize` | Re-edit prose |
| Delete a project | **Irreversible.** Removes the markdown from memory cache, Supabase Storage and disk, unregisters the document record, and drops cached metadata | Only within the 5 second client-side undo window, which is purely optimistic UI: nothing has been sent yet | Undo toast |
| Revoke an API key | Yes for that key | No, create a new one | |
| Publish or unpublish | No | Yes, toggle back | `PublishCard` |
| Acknowledge or resolve a violation | No, the audit trail stays | Yes, set the status back | `PATCH` the same route |
| Seed the investor demo | Yes, but only inside the synthetic `demo:investor.md` namespace | Idempotent by intent, re-seeds on reload | |
| Create a share link | No | **No revoke exists** (`enabled` is never set to false) | |

One more sharp edge: deleting a project does **not** clean up `<writableRoot>/registry/<docKey>/`, `locks/`, `runs/`, or `data/public-share/*.json`. Promoted state and live public links outlive the document.

---

## Open questions

1. **Pipeline or Releases?** Which route is the canonical release console, and what is the top nav tab called? Four places disagree today.
2. **Draft or Staging?** One customer-facing word for a version that exists but is not official.
3. **Who may promote?** `PROJECT-PIPELINE.md` wants a `releaser` role gate. Today any `member` can promote, rollback, pin and delete. Do we add a role, or do we accept that membership means release authority?
4. **Is the bundled `apollo.md` sample editable?** Open in `WIKI-EDIT-MODE-BUILD-ORDER.md` Phase 5: read-only, or copy-on-write into an upload when someone clicks Edit?
5. **Can an upload document ever be promoted?** Today `canPromote` is permanently false for previews. Does connecting a repo later adopt the existing preview document, or does the user start over?
6. **What replaces the gradient project thumbnails?** The obvious answer is a mark derived from the project's own palette, which also demonstrates the product on the first screen.
7. **Should the dashboard analytics page exist at all before it has data?** A page of invented numbers inside a governance product is a credibility risk, not a placeholder.
8. **Where do public shares live in production?** The filesystem store cannot survive a serverless deploy, and the share page does not hydrate uploaded documents. Is this feature launched, or parked?
9. **Do we keep the free-text comment field on public feedback?** It is validated and discarded. Either store it (and then moderate it) or delete the field.
10. **One palette or three?** Brand tokens, wiki chrome and the dashboard shell are three separate systems with a colliding `graphite`. Consolidating them is the most visible dogfooding opportunity in the repo.
11. **When does `pinned` become a real lifecycle?** It exists in the type and collapses to `connected`. Verifying the lock inside the customer repository is the missing signal.
12. **Should read endpoints stop defaulting to the `write` action?** Fixing it grants viewers real read access, which is what the role is for.

---

## Where to look in the code

**Routing and shell**

- `src/app/wiki/[[...slug]]/page.tsx` (the entire wiki router)
- `src/components/wiki/WikiShell.tsx`, `TopNav.tsx`, `WikiWorkspaceBar.tsx`, `Sidebar.tsx`
- `src/lib/wiki/doc-param.ts`, `doc-lifecycle.ts`, `edit-policy.ts`, `normalize-nav.ts`, `friendly-error.ts`, `export-markdown.ts`
- `src/lib/cloud/wiki-access.ts`, `src/lib/cloud/rbac.ts`, `src/lib/cloud/access.ts`

**Pages**

- `src/components/wiki/pages/` (every page component; start with `IntroductionPage`, `ComponentDetailPage`, `PipelinePage`, `ReleasesPage`, `SyncPage`, `SourcePage`)
- `src/components/wiki/pipeline/` (`LockStrip`, `StageLane`, `BlockCard`, `PromoteDiffDrawer`, `PipelineStageView`, `RunConsoleDrawer`)
- `src/components/wiki/visual/` (`ColorSwatchCard`, `ComponentLivePreview`, `InspectablePreview`, `ComputedBoxModel`, `FontSpecimen`, `TypeScalePreview`, `SurfaceLevelCard`)

**Editing and release**

- `src/hooks/useEditableBlock.ts`, `src/components/wiki/pages/PageHeader.tsx`, `src/components/wiki/SectionEditor.tsx`, `BlockStatusBadge.tsx`, `BlockReleaseStrip.tsx`, `WikiEditBanner.tsx`
- `src/app/api/wiki/finalize/route.ts`, `promote/route.ts`, `rollback/route.ts`, `pin-lock/route.ts`, `source/route.ts`, `releases/route.ts`, `pipeline/route.ts`, `pipeline/diff/route.ts`, `publish/route.ts`, `governance/draft/route.ts`, `governance/violations/route.ts`
- `src/lib/ir/releases.ts`, `src/lib/ir/pipeline.ts`, `src/lib/ir/pipeline-runs.ts`, `src/lib/ir/pipeline-stages.ts`, `src/lib/parser/modify.ts`

**Dashboard**

- `src/app/dashboard/layout.tsx`, `page.tsx`, `connectors/page.tsx`, `settings/page.tsx`, `analytics/page.tsx`
- `src/components/dashboard/PromptBar.tsx`, `ProjectGrid.tsx`, `DashboardEmptyState.tsx`
- `src/lib/dashboard/projects.ts`, `meta-cache.ts`, `create.ts`, `manage.ts`
- `src/app/api/projects/create|rename|delete|generate-image/route.ts`

**Visualize**

- `src/hooks/useVisualizeStyle.ts`, `src/lib/apollo/apply-theme-client.ts`, `src/lib/visualize/preview-tokens.ts`, `src/lib/visualize-storage.ts`
- `src/ai-lab/01-ai-chrome/`, `src/ai-lab/03-visualize-status/`, `src/lib/design-ir/semantic-resolve.ts`, `merge-ai-chrome.ts`

**Public share**

- `src/app/share/[shareId]/page.tsx`, `layout.tsx`, `error.tsx`
- `src/components/share/OpinionPanel.tsx`, `ShareBlockPanel.tsx`, `PublicBlockPreview.tsx`
- `src/lib/public-share/store.ts`, `block-ids.ts`, `resolve-block.ts`, `load-block.ts`
- `src/app/api/share/route.ts` and `src/app/api/share/[id]/`

**Design language**

- `src/app/globals.css` (brand tokens, type scale, pipeline CSS)
- `src/styles/blocksmith-chrome.css` (wiki chrome, frozen nav variables)
- `src/styles/dashboard.css` (dashboard shell theme)
- `src/app/layout.tsx` (font wiring)

**Source documents**

- `docs/TEAM-NORTH-STAR.md` (the founding rule and the control-plane tables)
- `docs/PROJECT-PIPELINE.md` (the pipeline console specification)
- `docs/WIKI-EDIT-MODE-BUILD-ORDER.md` (edit mode phases, partly stale)
- `docs/VISUALIZE-AND-API.md`, `docs/VISUALIZE-ACCURACY-PLAN.md`
- `docs/PUBLIC-FEEDBACK.md`
