# BlockSmith Capture — browser extension

## WebMCP on any site

`webmcp.js` runs on every page in the page's main world (so a site's
Content-Security-Policy cannot block it, unlike the bookmarklet) and registers
four tools with `document.modelContext`: `blocksmith_capture_this_site`,
`blocksmith_audit_this_page`, `blocksmith_get_rules`, `blocksmith_page_context`.
An agent browsing the site can capture its design system or judge what the
page paints against one BlockSmith governs. A small badge in the corner says
how many tools are live; needs Chrome with `chrome://flags/#enable-webmcp-testing`.

The file is a copy of `public/webmcp/blocksmith.js` — `npm run sync:extension`
refreshes it, and `verify:webmcp` fails when they differ.

Design-first ingest: capture what you see in **Canva, Figma, Adobe XD, or any
website**, and BlockSmith turns it into a governed `design.md` in your wiki.

## Install (unpacked, for demo/testing)

1. Chrome → `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select this `extension/` folder
3. Pin "BlockSmith Capture" to the toolbar

## Use

1. Sign in to BlockSmith in the same browser (the capture API uses your session).
2. Open your design (Canva doc, Figma file, any site).
3. Click the extension → **📸 Capture this tab** (up to 4 views: scroll, open
   another frame, show hover states).
4. **Generate design.md** → vision extraction runs (~10–30s) → the new wiki
   page opens automatically.

The server field defaults to production; point it at `http://localhost:3000`
for local dev (`npm run dev`).

## Server requirements

- `NVIDIA_API_KEY` set (vision extraction; optional `NVIDIA_MODEL_VISION` to
  pin a specific NIM vision model)
- Endpoint: `POST /api/ingest/capture` — rate-limited like other AI endpoints

## Truth model — captures are DRAFTS

A capture is stored as a **draft project**, not a finished design.md — we
don't know it's the source of truth until a human says so:

1. Generate → BlockSmith opens the draft with a **"Captured draft"** banner.
2. **Review & edit source** — fix any value the vision model estimated wrong.
3. **Confirm as design.md** — only then does the banner clear and the doc
   behave like a regular project.

Generated docs carry a provenance footer; captures never auto-promote into a
lock. Exact values from code scans or the Figma node tree always outrank
capture values (see `docs/DESIGN-FIRST-INGEST.md`).
