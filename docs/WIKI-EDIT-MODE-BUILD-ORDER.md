# Wiki edit mode — engineer build guide

**Audience:** Software engineer implementing wiki-as-authoring-surface.  
**Product goal:** Designers edit in the wiki → changes land in **staging** → humans **promote** on Pipeline → developers **pull** lock/repo. The wiki must not feel like a read-only markdown viewer.

**Read first:** [08-web-ide-handshake.md](./08-web-ide-handshake.md)

---

## One sentence for the engineer

> Reuse the existing **block edit → finalize → staging → promote** pipeline; expose it consistently in the UI on every wiki page designers expect to change. Do **not** build a second save path.

---

## What already exists (do not reinvent)

| Piece | Location | Role |
|-------|----------|------|
| Client edit hook | `src/hooks/useEditableBlock.ts` | Local draft in `localStorage`, conflict detection, `POST /api/wiki/finalize` |
| Finalize API | `src/app/api/wiki/finalize/route.ts` | Writes `.md`, `refreshBlocksForDoc(doc, "web")`, optional promote |
| Markdown patcher | `src/lib/parser/modify.ts` | `modifyMarkdownBlock(md, blockId, updatedData)` — **only** agent-guide, guidelines, component:\* today |
| Page chrome | `src/components/wiki/pages/PageHeader.tsx` | Edit / Save to staging / Discard / conflict UI |
| Per-block release | `src/components/wiki/BlockReleaseStrip.tsx` | Staging vs production for one block |
| Staged event | `blocksmith:staged` custom event | Fired after successful finalize — strips refresh |
| Reference pages | `GuidelinesPage`, `ComponentDetailPage`, `ButtonsPage`, `AgentGuidePage` | Copy these patterns |

**Gap:** Foundation pages (Color, Typography, Spacing), Introduction, and raw source are **read-only**. `modify.ts` does not support token blocks yet.

---

## User-visible loop (must be obvious in UI)

```
Edit → Save to staging → banner “Staged — open Pipeline to promote” → Pipeline promote → lock updates → dev runs blocksmith pull
```

- **Save to staging** = `finalize()` (writes markdown + ingests as `editedBy: "web"` draft version).
- **Agents / CI** still read **production** until promote — unchanged.
- Never imply “saved to repo” until promote + pull (honest copy).

---

## Doc lifecycle rules (preview vs connected)

From `src/lib/wiki/doc-lifecycle.ts`:

| Lifecycle | How doc was created | Edit behavior |
|-----------|---------------------|---------------|
| `preview` | Paste, upload, bundled `apollo.md` | See **Phase 5** — limited save or honest gate |
| `connected` | GitHub / workspace scan | Full finalize + promote + pull path |
| `pinned` | (future) lock verified in repo | Same as connected |

Pass `lifecycle` from `WikiShell` into edit components. **Do not** show Pipeline promote as available on preview docs without explaining limits.

---

## Build order (phases)

Work in order. Each phase has **done when** criteria. Do not start Phase 3 until Phase 1 ships in at least one page.

---

### Phase 1 — Global edit chrome + staging banner

**Goal:** Every editable page feels like part of one product, not a one-off form.

#### Build

1. **`WikiEditBanner`** (new, `src/components/wiki/WikiEditBanner.tsx`)
   - Shown when `GET /api/wiki/releases?doc=…` reports **any** block in staging for this doc (or listen to `blocksmith:staged`).
   - Copy: **“You have staged changes. Open Pipeline to promote them to production.”**
   - CTA links to `/wiki/pipeline?doc=…` (or `/wiki/releases` if that’s the table view you prefer — pick one, stay consistent).
   - Privy chrome: hairline border, no emoji, no green gradients.

2. **`WikiEditModeBar`** (new, optional thin bar under workspace bar)
   - When page `isEditing`: **“Editing — changes are local until you save to staging.”**
   - When `hasDraft` and not editing: **“Unsaved draft in browser — Save to staging or Discard.”**

3. **Mount banner in `WikiShell`** (`src/components/wiki/WikiShell.tsx`)
   - Inside main content, above `{children}`, after `PostScanBanner`.
   - Fetch staging count once on load + refresh on `blocksmith:staged`.

4. **Standardize actions in `PageHeader`**
   - Primary: **Edit** / **Save to staging** / **Discard**
   - Use existing `blockId`, `onFinalize`, `onDiscard` props — already on Guidelines.
   - Replace any remaining `bg-green-600` buttons with `var(--wiki-cta-fill)` (Privy).

#### Done when

- [ ] After finalize on Guidelines, banner appears without manual refresh.
- [ ] Banner links to Pipeline/Releases and disappears when staging is empty (after promote or rollback).
- [ ] PageHeader looks identical on Guidelines and at least one other page you touch in Phase 2.

#### Do not

- Add a new API for “draft” — browser draft stays in `useEditableBlock`; server draft is post-finalize.

---

### Phase 2 — Foundation pages (Color, Typography, Spacing)

**Goal:** Structured forms edit tokens; same finalize path as components.

#### Backend (required first)

Extend `src/lib/parser/modify.ts` with block handlers:

| blockId | updatedData shape | Markdown target |
|---------|-------------------|-----------------|
| `token:color:<slug>` | `{ name, value, role?, group? }` | Apollo color table row / structured section |
| `token:typography:<slug>` | `{ name, substitute, weights, sizes, lineHeight, letterSpacing, role }` | Typography table |
| `token:spacing:<slug>` | `{ name, value, token }` | Spacing table |

- Slug must match `colorBlockId()` in `ColorPage.tsx`: `token:color:${cssVar without --}`.
- Add unit tests in `scripts/` or next to `modify.ts` using snippets from `docs/designs.md/apollo.md`.
- After modify works, confirm `refreshBlocksForDoc` creates/updates IR blocks with `editedBy: "web"`.

#### Frontend (per page)

Pattern (copy from `GuidelinesPage.tsx`):

```tsx
const { isEditing, finalize, ... } = useEditableBlock<ColorTokenForm>(
  docFileName,
  colorBlockId(token.cssVar),
  initialFromSystem,
  system.contentHash || "",
);

<PageHeader blockId={...} onFinalize={(f) => finalize(f)} ... />
<BlockReleaseStrip docFileName={docFileName} blockId={...} />
```

| Page | File | Edit UX |
|------|------|---------|
| Color | `src/components/wiki/pages/ColorPage.tsx` | Select swatch → edit name, hex, role in form; validate `#` hex |
| Typography | `src/components/wiki/pages/TypographyPage.tsx` | Row edit for family + scale fields |
| Spacing | `src/components/wiki/pages/SpacingPage.tsx` | Row edit for name + value |

- View mode: keep current previews (swatches, specimens).
- Edit mode: simple inputs, not a spreadsheet grid v1.
- Each save finalizes **one block** (one token row). Batch edit is Phase 2.5 optional.

#### Done when

- [ ] Designer can change Apollo canvas hex on Color page, Save to staging, see block on Pipeline staging lane.
- [ ] Promote updates production version; MCP `get_component` / token reads would pick up new value after pull (connected docs).
- [ ] `modify.ts` tests pass for at least one color + one typography mutation.

#### Do not

- Store token edits only in React state or a new DB table — markdown remains source of truth after finalize.

---

### Phase 3 — Introduction / overview

**Goal:** System name, tagline, and overview prose editable without opening the `.md` file.

#### Backend

Add to `modify.ts`:

| blockId | updatedData | Target |
|---------|-------------|--------|
| `page:introduction` | `{ name?, tagline?, overview? }` | Apollo frontmatter / `## Overview` / title lines per parser |

Check `src/lib/parser/apollo.ts` for where `system.name`, `tagline`, `overview` are extracted — patch the same regions on write.

#### Frontend

`src/components/wiki/pages/IntroductionPage.tsx`:

- `PageHeader` with `blockId="page:introduction"`.
- Edit fields: **Name**, **Tagline**, **Overview** (textarea).
- `useEditableBlock` + finalize.

#### Done when

- [ ] Changing overview text in wiki updates `apollo.md` (or upload doc) on finalize.
- [ ] Introduction page shows staging badge after save.
- [ ] Re-parse shows new copy without server restart (`clearDesignSystemCache` already called in finalize).

---

### Phase 4 — Source tab (full markdown editor)

**Goal:** Power users can edit the whole document; same promote semantics.

#### Build

1. **Tab or route:** `Design | Source` on wiki — or sub-route `/wiki/source?doc=…`.
2. **Editor:** `textarea` or CodeMirror 6 (lighter than Monaco for v1). Load full markdown via existing read path (`readUploadMarkdownContent` / `docs/designs.md/`).
3. **Save:** New API or extend finalize:
   - **Option A (recommended v1):** `POST /api/wiki/source` with `{ doc, content, baseContentHash }` — writes entire file, then `refreshBlocksForDoc(doc, "web")` for all touched blocks.
   - **Option B:** `blockId: "source:full"` in finalize with `{ markdown: string }` — special case in modify (replace entire file).
4. **Conflict:** Same 409 pattern as `useEditableBlock` (hash mismatch → show diff message, force overwrite button).
5. **Warning banner:** “Editing source affects the entire document. Prefer structured edit on token pages when possible.”

#### Done when

- [ ] User can fix a typo anywhere in `apollo.md` from the wiki and see it after reload.
- [ ] Staging reflects ingest; promote still required for production/agents.
- [ ] Large paste does not break parser (run `verify:wiki` in CI).

#### Do not

- Auto-promote on source save.
- Allow source edit without `baseContentHash` conflict check on connected docs.

---

### Phase 5 — Preview docs (upload / apollo sample)

**Goal:** Honest UX — preview is not production pipeline, but designers can still try edit flow where safe.

#### Policy (pick with PM; implement one)

**Option A — Gate (stricter, less eng)**  
- If `lifecycle === "preview"`: Edit buttons disabled with tooltip: **“Connect a repo and scan to save changes to your team’s pipeline.”**
- CTA: home → GitHub scan.
- Exception: none.

**Option B — Upload save (recommended for demos)**  
- If doc is `upload:*` or `scanMode === "import"`:
  - Allow finalize → writes to upload storage (`persistUploadMarkdown` — already in finalize route).
  - Banner: **“Saved to your preview document. Connect a repo to promote to production and share with engineering.”**
  - Pipeline / promote **stay hidden or locked** (`PreviewPipelineEmptyState` — already exists).
- Bundled `docs/designs.md/apollo.md`: **read-only** OR copy-on-write to upload when user clicks “Edit sample” (product call).

Implement helper:

```ts
// src/lib/wiki/edit-policy.ts
export function canEditDoc(lifecycle: DocLifecycle, fileName: string): {
  canEdit: boolean;
  canPromote: boolean;
  reason?: string;
}
```

Wire into `PageHeader` and Source tab.

#### Done when

- [ ] Preview doc never shows fake Pipeline promote success.
- [ ] Upload doc can save governance/color edits and reload wiki with new content.
- [ ] Connected scan doc has full edit + promote path.

---

## Shared implementation checklist

Use on every new editable page:

- [ ] `useEditableBlock` with correct `blockId` and `system.contentHash`
- [ ] `PageHeader` wired with `blockId`, `onFinalize`, `onDiscard`
- [ ] `BlockReleaseStrip` when block exists in IR registry
- [ ] `modifyMarkdownBlock` handler + test
- [ ] `canEditDoc()` guard for preview
- [ ] Privy styling (no emoji, no green staging buttons)
- [ ] Dispatch / listen `blocksmith:staged` for banner refresh

---

## API reference (finalize)

```http
POST /api/wiki/finalize
Content-Type: application/json

{
  "doc": "apollo.md",
  "blockId": "guidelines",
  "updatedData": { "dos": ["..."], "donts": ["..."] },
  "baseContentHash": "abc123…",
  "force": false
}
```

- **409** — IDE changed file since edit started; show conflict UI.
- **Success** — markdown written, blocks re-ingested as staging, optional `promote: true` (avoid for normal UI).

---

## Testing

| Check | Command / action |
|-------|------------------|
| Types | `npm run typecheck` |
| Wiki parse | `npm run verify:wiki` |
| Handshake | `npm run verify:handshake-writeback` |
| Manual | Edit guideline → staging banner → Pipeline promote → `blocksmith pull` on fixture repo |

---

## Out of scope for this track

- Figma import as edit source
- Real-time multi-user co-editing
- WYSIWYG Notion-style page builder
- Replacing markdown with a proprietary DB-only format
- Auto-promote on every save (breaks design CI/CD story)

---

## Suggested sprint split

| Week | Deliverable |
|------|-------------|
| 1 | Phase 1 + `modify.ts` tests + Color page edit (one token) |
| 2 | Color/Typography/Spacing complete + Phase 3 Introduction |
| 3 | Phase 4 Source tab + Phase 5 preview policy + `verify:handshake-writeback` green |

---

## Questions for PM before coding Phase 5

1. Is bundled `apollo.md` editable or read-only sample?
2. Upload-only docs: promote forever disabled, or “promote” copies to a connected doc later?
3. Source tab: available on preview uploads or connected only?

Escalate answers in this doc’s PR description when resolved.
