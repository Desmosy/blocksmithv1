# Step 09 — Scan curate (black box)

```
scan (deterministic facts)  →  LLM curator  →  designer .md  →  wiki
```

## Why

Deterministic scan finds truth on disk. The model **structures and explains** it for designers — it does not invent tokens.

## Flow

1. `scanWorkspace()` — files, CSS vars, classified components
2. `workspaceScanToMarkdown()` — facts `.md` (audit copy in `.blocksmith/scan-facts/`)
3. `resolveScanMarkdownForWiki()` — GPT-OSS (`NVIDIA_MODEL_PARSER`) writes curated wiki `.md`
4. Cached at `.blocksmith/ai-lab/scan-curated/<doc>/<hash>.md`
5. Published to `data/uploads/scan-*.md` — same doc ref the wiki loads

## Env

```bash
NVIDIA_API_KEY=nvapi-...
NVIDIA_MODEL_PARSER=openai/gpt-oss-120b
AI_LAB_SCAN_CURATE=1   # default: on when API key present; set 0 to disable
```

## Validation

- Must match workspace-scan frontmatter shape
- Hex colors in output ⊆ hex in facts (no invented palette)

## Test

```bash
AI_LAB_SCAN_CURATE=1 npm run scan
```
