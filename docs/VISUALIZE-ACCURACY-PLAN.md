# Visualize Accuracy — AI Lab Architecture

Visualize is BlockSmith’s **technical moat**: the wiki must reflect whatever design `.md` a user uploads — unpredictable names, tables, and syntax — not a fixed brand checklist.

## Core principle (no hardcoding)

| Layer | Job | Must NOT do |
|-------|-----|-------------|
| **Parser** | Extract tables → tokens (colors, type, radii, surfaces, components) | Guess brand names |
| **Semantic compiler** | Map tables + **Role** / **Purpose** columns → `--wiki-*` using English semantics only | `citra-orange`, `apollo-gold`, Caldera regexes |
| **AI (on Visualize)** | Read parsed JSON + source `.md` → chrome JSON for ambiguous docs | Invent hex not in the token graph |
| **Validator** | Merge AI output only if hex ∈ parsed palette | Allow drift |
| **Renderers** | Apply `IR` + generic CSS classes (`wiki-cta-primary`) | Apollo defaults |

```
user .md (any syntax)
    → Parser → DesignIR.tokens (authoritative hex)
    → compileSemanticWikiChrome() (surfaces + roles + component descriptions)
    → [Visualize click] → AI layout → mergeValidatedAiChrome()
    → DOM (--wiki-* + component rules)
```

## What went wrong before

- Slug lists (`sprout`, `citra-orange`) — breaks on the next upload
- Wiki components with fixed Tailwind radii — ignored IR
- AI optional afterthought — unpredictable docs need AI **in the loop**, with validation

## Phased roadmap

### P0 — Stop lying ✅

- No Apollo hex in previews; golden tests for sample docs

### P1 — Design IR ✅

- `blocksmith.design.v1` on disk; visualize reads IR

### P2 — AI Lab loop (`src/ai-lab/`)

- [x] `semantic-resolve.ts` + `merge-ai-chrome.ts`
- [x] **Step 01** `01-ai-chrome/` — Nemotron chrome compiler (wired to Visualize)
- [x] **Step 03** (partial) `03-visualize-status/` — deterministic vs AI status in wiki
- [x] **Step 02** `02-parser-assist/` — GPT-OSS normalize messy markdown → cache → parser
- [x] **Step 04** `04-component-previews/` — component spec renderers

### P3 — Layout packet (later)

- Pre-built hero/zone HTML from IR for marketing-style docs

## AI’s role (this product)

**The LAB solves mapping; engineers don’t maintain brand lists.**

1. Parser gives **facts** (hex, roles, radii rows).
2. Semantic compiler gives **best-effort** chrome without brand names.
3. Nemotron reads facts + markdown and returns `--wiki-*` + summary.
4. Validator drops any AI hex not in `ir.colorVariables`.
5. UI renderers consume vars only.

When the doc is well-structured (tables), deterministic path is often enough. When syntax is messy, AI + validation is the product.

## How to test

```bash
npm run verify:design-ir   # regression on sample docs
npm run dev:clean
```

Upload **your** `.md` → Visualize → chrome should track **your** tables, not Apollo/Caldera shortcuts.

## Related

- `docs/VISUALIZE-AND-API.md`
- `src/lib/design-ir/semantic-resolve.ts`
- `src/lib/design-ir/merge-ai-chrome.ts`
