# Design-first ingest — capture, fusion, annotation

**Status:** Phase 1 shipped · Phase 2 fusion shipped in the Figma connector · Phase 3 annotation loop started
**Owner:** CTO / platform
**Read with:** [FIGMA-IMPORT.md](./FIGMA-IMPORT.md) � �

---

## Why (the investor sentence)

> Most design systems are born in Figma or Canva — not in a GitHub repo.
> BlockSmith now ingests design truth **from the design tool itself**: capture
> what the designer sees, extract a governed design.md, and when code arrives,
> the handshake reconciles both. **Design → wiki → code → lock**, not just
> code → wiki.

This inverts the current entry point (repo scan) and opens BlockSmith to teams
at the *earliest* stage of product work — the largest segment of design
engineers.

---

## The three phases

### Phase 1 — Capture (SHIPPED, this repo)

**What:** Browser extension (`extension/`) + `POST /api/ingest/capture`.
Capture up to 4 views of any design in any tab (Canva, Figma, Adobe, live
sites) → NIM vision model → "Style Reference" design.md (the exact
`data/uploads/design-*.md` format the wiki already renders) → existing upload
pipeline → wiki page.

**Truth model (non-negotiable):** vision values are ESTIMATES, and a capture
is a **draft project pending human review** — never assumed to be the source
of truth.

- Every generated doc carries a provenance footer + a machine-readable draft
  marker (`<!-- blocksmith:capture-draft -->`).
- While the marker is present, the wiki shows the **Captured draft** banner on
  every page of the doc: *Review & edit source* (existing source editor) →
  *Confirm as design.md* (strips the marker via `/api/wiki/source`, same
  conflict semantics as any edit).
- Capture docs NEVER auto-promote into a lock — before or after confirm.
- Tiered source confidence: `code scan > design-tool node tree > vision capture`.

**Lifecycle:** `capture → draft project (banner) → human edits → confirm → regular project`.

**New pieces:**

| Piece | Path |
|-------|------|
| Vision extraction | `src/lib/ingest/capture.ts` |
| API endpoint | `src/app/api/ingest/capture/route.ts` |
| Extension (MV3) | `extension/` (manifest, popup, README) |
| Env | `NVIDIA_MODEL_VISION` (optional; defaults to Llama-4 Maverick → Llama-3.2-90B-Vision → Phi-3.5-Vision fallbacks) |

### Phase 2 — Figma fusion (node tree × vision) — SHIPPED

Figma's tree gives exact values but zero semantics ("Frame 427"). Vision gives
semantics but approximate values. Fuse them:

1. REST API: pull node tree + rendered PNGs per top-level frame (2x).
2. Anchor: map every vision claim to node ids (render crop ↔ subtree), so each
   block traces to `node-id` the way scan blocks trace to `file:line`.
3. Fusion: vision names/roles/patterns + tree-exact hex/spacing/type values.
4. Emit design.md: tree-backed values ingest like scan facts; vision-only
   claims stage as drafts.

The connector now extracts native annotations, selects representative frames,
renders them through Figma's image endpoint, and appends node-linked visual
semantics to the same structured `design.md`. Exact tree values remain
authoritative. With no vision key, structured import still succeeds honestly.

### Phase 3 — Annotation loop (agentic Figma) — IN PROGRESS

The human gate moved into Figma, where designers live:

1. Fusion pass writes its proposals as **Figma Dev Mode annotations** via the
   plugin API (not pixel automation — the API does this cleanly).
2. Designer reviews/edits annotations inside Figma.
3. Re-extraction reads confirmed annotations as promoted-grade metadata →
   design.md → staging → promote.

The development plugin in `figma-plugin/` already scans a selection/page,
previews node-linked proposals, and writes selected proposals as native Figma
annotations while preserving existing annotations. The webhook endpoint at
`POST /api/figma/webhook` re-imports structure, annotations, and visual evidence
after Figma events when `FIGMA_ACCESS_TOKEN` and `FIGMA_WEBHOOK_PASSCODE` are set.

Doctrine unchanged: **AI proposes, human disposes** — upstream in Figma instead
of only in the wiki.

---

## Investor demo script (90 seconds, live)

**Setup (before the call):** extension loaded unpacked, signed in to production
BlockSmith, a Canva design open in one tab, wiki in another. Do one dry run —
vision extraction takes 10–30s; narrate over it.

1. *(0:00)* "Every design tool exports pixels. Nobody exports **governance**.
   Watch." — show the Canva design.
2. *(0:10)* Click extension → **Capture this tab**. Scroll, capture once more.
   "Two views, any tool — this works on Figma, Adobe, even a competitor's
   live site."
3. *(0:20)* Click **Generate design.md**. While it runs: "A vision model is
   extracting the design system — colors by role, type scale, components,
   do's and don'ts — into the same governed format our repo scanner produces."
4. *(0:45)* Wiki page opens: tokens table, typography, components, guidelines.
   "This is not a screenshot gallery. Every value is a **block** with
   provenance — captured, estimated, waiting for human approval."
5. *(1:05)* Open Pipeline on an existing scan doc: "When their code lands, the
   same pipeline reconciles design truth against code truth — staging,
   promote, lock. Agents can only use what humans approved."
6. *(1:25)* Close: "Design-first teams start here with a screenshot. Code-first
   teams start with a repo scan. Both end in the same lock. That's the
   protocol play."

---

## How to test (add to release testing)

### Capture API (no extension needed)

```bash
# from repo root, server running with NVIDIA_API_KEY set
IMG=$(base64 -i some-design-screenshot.png)
curl -s -X POST http://localhost:3000/api/ingest/capture \
  -H 'Content-Type: application/json' \
  -d "{\"images\":[\"data:image/png;base64,$IMG\"],\"title\":\"Test Design\",\"sourceUrl\":\"https://example.com\"}"
```

**Expected:** JSON with `wikiUrl`, `model`, `stats` (colors/typography/components counts). Open `wikiUrl` — rendered Style Reference page with provenance footer. Errors must be readable (401 sign-in message in strict mode, 429 rate limit, 503 when no NVIDIA key).

### Extension end-to-end

1. `chrome://extensions` → Load unpacked → `extension/`.
2. Point Server at `http://localhost:3000` (popup field), sign in to BlockSmith in the browser.
3. Open any Canva/Figma design → capture 1–2 views → Generate.

**Expected:** new tab opens on the generated wiki page; popup shows stats + link. Repeat >10 times rapidly → 429 with retry message (AI rate limit). Not signed in on strict prod → clear "Sign in to BlockSmith" error.

### Quality bar (manual)

Compare 3 captures against their sources: hex values within perceptual range, no invented components, role names sensible. If a model produces garbage, pin a better one via `NVIDIA_MODEL_VISION` — no code change.

---

## What this is NOT (scope fences)

- Not a replacement for repo scan — capture docs are previews, scan facts stay authoritative.
- Not pixel-automation of Figma's UI — Phase 3 uses the plugin/annotation API.
- Not in the P0 release gate — additive endpoint + separate extension folder; zero changes to existing routes. Ship the release either way; demo this to investors in parallel.
