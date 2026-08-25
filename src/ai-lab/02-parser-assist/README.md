# Step 02 — Parser assist ✅

When uploaded markdown is **design-related but not table-structured**, GPT-OSS rewrites it into the canonical Style Reference format, then the existing parser runs.

## Flow

1. `needsParserAssist(md)` — unstructured + hex/design signals
2. `normalizeMarkdownWithAi` — parser profile (`NVIDIA_MODEL_PARSER`)
3. Cache at `.blocksmith/ai-lab/normalized/<doc>/<hash>.md`
4. `loadDesignSystem` reads cache via `resolveMarkdownForParsing`

## Wiring

- `prepareDesignSystemDoc(docRef)` — async, called from wiki page + import API
- Disable with `AI_LAB_PARSER_ASSIST=0`

## Test

```bash
npm run ai-lab:normalize -- path/to/messy-design.md
```

No invented colors: normalization must pass `isApolloStructuredMarkdown` before cache.
