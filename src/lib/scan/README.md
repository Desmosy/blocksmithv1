# Workspace scan pipeline

```
UI files under scan paths (default: src/, packages/, styles/)
    → scan (deterministic facts + **full React inventory**)
    → [black box: LLM curator]  ← polishes featured sections only
    → inventory appended deterministically (100% of React files, never dropped)
    → wiki
```

## Coverage guarantee

| What | Guarantee |
|------|-----------|
| **Codebase inventory** | Every `.tsx`/`.jsx` under scan paths — verifiable with `npm run scan:verify` |
| **Featured components** | Designer-facing subset with live previews |
| **Tokens** | All CSS vars + hex found in scanned files |
| **LLM curated prose** | Accurate for included facts; does not remove inventory rows |

Scan paths default to `src`, `app`, `packages`, `styles`. Override with `BLOCKSMITH_SCAN_PATHS`.

## Black box (step 09)

See `src/ai-lab/09-scan-curate/README.md`.

- **Input:** classified components, CSS variables, hex colors, paths — no invention
- **Output:** `data/uploads/scan-*.md` with `blocksmith-source: workspace-scan-curated`
- **Audit:** raw facts saved to `.blocksmith/scan-facts/`
- **Cache:** `.blocksmith/ai-lab/scan-curated/`

```bash
AI_LAB_SCAN_CURATE=1 npm run scan   # force on
AI_LAB_SCAN_CURATE=0 npm run scan   # facts only, no model
```

## Env

```bash
BLOCKSMITH_CATALOG_PATHS=src/components/ui
BLOCKSMITH_SCAN_PATHS=src/components,packages,styles
NVIDIA_API_KEY=nvapi-...
```

## Commands

```bash
npm run scan
# MCP: scan_workspace
```
