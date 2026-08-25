# Step 04 — Component previews

Render wiki live previews from `DesignIR.tokens.components[]` descriptions.

## Flow

```
ComponentDoc (title, role, description)
  → classifyComponentKind()     # button | card | nav | tag | …
  → parseComponentPreviewSpec() # hex, radius, padding from prose + IR fallbacks
  → ComponentPreviewView        # generic template (no brand lists)
```

## IR context

When `DesignIRProvider` is present, previews use `ir.preview` + palette for fallbacks.
Otherwise `buildPreviewContextFromSystem()` reads `--wiki-*` CSS vars.

## Test

```bash
npm run ai-lab:previews -- upload:design-dcd1a101.md
```

## Wiki integration

- `ComponentLivePreview` → `src/components/wiki/visual/ComponentLivePreview.tsx`
- Component detail pages and editable button rows use the same pipeline.
