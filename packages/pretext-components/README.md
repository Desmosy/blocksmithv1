# @blocksmith/pretext-components

Spin-off layout library for BlockSmith. It uses [Cheng Lou's Pretext](https://github.com/chenglou/pretext) for canvas-accurate text measurement inside design-system component frames.

**Not part of AI Lab.** This package is a standalone renderer: given a parsed component spec (colors, radius, typography) it lays out buttons, cards, nav bars, inputs, and other frames with Pretext-sized text slots.

## Why

DOM reflow is slow and `system-ui` drifts on macOS. Pretext measures once per text run, then relayouts at any width in ~0.0002ms, ideal for component galleries, share previews, and MCP block thumbnails.

## Usage (BlockSmith wiki)

```tsx
import { PretextComponentView } from "@blocksmith/pretext-components/react";

<PretextComponentView component={doc} spec={parsedSpec} maxWidth={360} />
```

## Package layout

```
src/
  measure.ts      : Pretext font string + layout helpers
  classify.ts     : component kind from title/role/description
  types.ts        : ComponentSpec, TextSlot, GalleryItem
  frames/         : per-kind frame builders
  react/          : PretextText, PretextComponentView, ComponentGallery
```

## CLI (from repo root)

```bash
npm run pretext-components:test -- upload:design-dcd1a101.md
```
