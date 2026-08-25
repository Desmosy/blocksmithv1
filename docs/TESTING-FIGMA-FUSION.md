# Testing Figma fusion, annotations, measurements, capture, and webhooks

## Prerequisites

Add to `.env.local` and restart `npm run dev`:

```env
NVIDIA_API_KEY=...
FIGMA_ACCESS_TOKEN=figd_...
FIGMA_WEBHOOK_PASSCODE=use-a-long-random-value
```

Use a paid-plan Figma file you can edit. Include at least one frame, component set, native annotation, and saved measurement. Create a BlockSmith API key in **Wiki → Setup → API keys** for the plugin.

## A. Structured + visual connector

1. Open `http://localhost:3000/figma` while signed in.
2. Paste the Figma file URL and a token with `file_content:read` access.
3. Click **Create fused design.md**.
4. In the resulting Source page, verify:
   - exact CSS variables and component variants;
   - `## Figma provenance` with file key/version;
   - annotation and saved-measurement counts;
   - measurement endpoint node IDs and offsets;
   - `## Visual Language & Intent` with rendered-frame node IDs.

Expected fallback: remove `NVIDIA_API_KEY` and repeat. Structured import succeeds and the response reports why visual fusion was skipped.

## B. Native annotation plugin

1. Import `figma-plugin/manifest.json` as a Figma development plugin.
2. Select representative frames/components and run **BlockSmith Annotate**.
3. Enter the BlockSmith origin and `bs_live_…` key.
4. Click **Generate AI proposals**.
5. Verify proposals are grouped as Development, Interaction, Accessibility, or Content and reference the selected nodes.
6. Uncheck at least one, apply the remainder, then inspect native annotations in Figma Dev Mode.
7. Confirm existing annotations were preserved and supported properties were pinned.
8. Re-run the connector and verify the applied annotations enter the same `design.md` with node provenance.

## C. Extension enrichment of the same Figma document

1. Reload the unpacked extension from `chrome://extensions` so the changed popup is active.
2. Open the same Figma file and capture an overlay, hover state, prototype state, or viewport not represented by the normal frame render.
3. The extension automatically derives `upload:scan-figma-<file-key>.md`; verify **Enrich Figma doc** matches the connector document. Correct it manually if necessary.
4. Click **Generate or enrich design.md**.
5. Verify the response opens the existing wiki rather than creating a second project.
6. In Source, find `## Supplemental Capture Evidence`. Exact Figma tree values above it remain authoritative.

For Canva, Adobe, or a website, leave the target blank. The extension creates a separate capture draft as before.

## D. Webhook resynchronization

First test authentication locally:

```bash
curl -X POST http://localhost:3000/api/figma/webhook \
  -H 'Content-Type: application/json' \
  -d '{"event_type":"PING","passcode":"YOUR_FIGMA_WEBHOOK_PASSCODE"}'
```

Expected: `{"ok":true,"event":"PING"}`. An incorrect passcode must return 401.

For real events, expose a public HTTPS deployment and create a Figma V2 webhook pointing to `/api/figma/webhook`. Prefer `FILE_VERSION_UPDATE`, `LIBRARY_PUBLISH`, and `DEV_MODE_STATUS_UPDATE` as deliberate workflow signals; `FILE_UPDATE` is less immediate. After an event, verify the response contains the document ref plus annotation, measurement, and rendered-frame counts, then reload that document.

## E. Automated regression suite

```bash
npm run typecheck
npm run verify:figma-import
npm run verify:wiki
npm run verify:scan-wiki
npm run build
```

The Figma verification covers variable normalization, components, drift, annotation provenance, saved measurements, frame selection, and persistence of fusion content into the same markdown document.

## Current safety model

- Exact structure outranks visual estimates.
- AI proposals require selection and human application.
- Existing native annotations are preserved.
- Connector tokens are used once and are not persisted.
- Plugin API keys live in Figma client storage.
- Webhooks require a timing-safe passcode comparison.
- Nothing auto-promotes into the production lock.
