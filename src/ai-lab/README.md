# AI Lab (`src/ai-lab`)

Ordered pipeline for **unpredictable** design `.md` → wiki chrome. No brand slug lists.

## Build order (one module at a time)

| Step | Folder | Status | Purpose |
|------|--------|--------|---------|
| 0 | `shared/` | ✅ | NVIDIA profiles, chat helper, JSON extract |
| 1 | `01-ai-chrome/` | ✅ | Nemotron compiles `--wiki-*` from parsed tokens + markdown |
| 2 | `02-parser-assist/` | ✅ | GPT-OSS normalizes messy prose → structured tables |
| 3 | `03-visualize-status/` | ✅ | UX when AI off / deterministic-only / AI applied |
| 4 | `04-component-previews/` | ✅ | Render `IR.components[]` specs in wiki |
| 9 | `09-scan-curate/` | ✅ | Scan facts → LLM → designer wiki `.md` |
| 10 | `10-governance-copilot/` | ✅ | Human prompt → role + do's/don'ts draft (component pages) |

## Env (`.env.local` only — never commit keys)

```bash
NVIDIA_API_KEY=nvapi-...
NVIDIA_API_KEY_FALLBACK=nvapi-...   # optional second key
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL_CHROME=nvidia/nemotron-3-ultra-550b-a55b
NVIDIA_MODEL_PARSER=openai/gpt-oss-120b
```

## Test step 1

```bash
npm run ai-lab:chrome -- upload:design-dcd1a101.md
```

## Test step 2

```bash
npm run ai-lab:normalize -- path/to/unstructured-design.md
```

## Test step 4

```bash
npm run ai-lab:previews -- upload:design-dcd1a101.md
```

## Architecture

See `docs/VISUALIZE-ACCURACY-PLAN.md`.
