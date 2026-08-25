# Figma → BlockSmith (the Figma-fit wedge)

BlockSmith does **not** replace Figma's canvas. Figma is the design source of
truth; your repo is the code source of truth; `design.md` is the neutral
contract both reconcile against. This import seeds the contract from Figma, then
**reconciles it against your code** — the payoff is drift: *"Figma says X,
shipped code says Y."*

We import the design **system** (tokens + the published component library), not
individual frames/screens. A screen is an instance, not a governed asset — that's
design-to-code, which Figma Make already does. We stay the system of record.

## Pipeline

```
Figma get_variable_defs + components
        │  assembleFigmaImport() → importFigmaVariables() / POST /api/figma/import
        ▼
   design.md (workspace-scan)  ──►  wiki · tokens · Component Library · governance · MCP   [all reused]
        │  figma_token_drift / POST /api/figma/drift
        ▼
  token + component drift  ◄── code scan (blocksmith scan)
```

## Live: pull from a Figma file

The deterministic core is fully unit-tested (`npm run verify:figma-import`). The
only live part is the Figma MCP call, which needs a selected file. Pattern:

```ts
import { assembleFigmaImport, importFigmaVariables } from "@/lib/figma";

// 1. Pull raw data from the Figma MCP (Dev Mode) against the selected file.
const variableDefs = await figma.get_variable_defs({ fileKey, nodeId }); // any shape
const components   = await figma.get_libraries({ fileKey });             // optional

// 2. Shape it — adapter tolerates RGBA-object colors, nested collections,
//    numeric values, and skips unresolved aliases.
const input = assembleFigmaImport({ variableDefs, components, fileKey, fileName });

// 3. Import → governed design.md upload (or POST it to /api/figma/import).
const { docRef } = await importFigmaVariables(input);
```

### Files with NO variables (most real-world files)

`get_variable_defs` returns `{}` for the many files built on styles, not the
variables system (older community kits, un-systematized files). For these, pass
`get_design_context` output and tokens are **recovered from the design itself**
(colors by role, radii, type scale) — the same engine a future UI connector or
the webpage extension would use:

```ts
const designContextCode = await figma.get_design_context({ fileKey, nodeId });
const input = assembleFigmaImport({ designContextCode, fileKey, fileName });
const { docRef } = await importFigmaVariables(input);
```

You can pass **both** `variableDefs` and `designContextCode` — real variables
win on name collision, inferred tokens fill the gaps.

Then reconcile against a code scan:

```bash
blocksmith scan /path/to/repo        # produces upload:scan-*.md (code side)
```

```ts
// MCP tool: figma_token_drift({ variables, components, doc: "upload:scan-*.md" })
// or POST /api/figma/drift
```

## UI connector (`/figma`) — no agent required

For end-users not in a coding agent, the BlockSmith UI has a **paste-a-link**
connector at `/figma`. It uses the Figma **REST API** (the web app can't use the
agent-side MCP) with a personal access token:

- `parseFigmaFileKey(url)` → `fetchFigmaFile(key, token)` → `extractFigmaFile()`
- Recovers tokens from **color styles, text styles, and raw fills**, plus
  **component sets with variant props** — works on any plan (Figma's *variables*
  REST endpoint is Enterprise-only, so we don't depend on it).
- Route: `POST /api/figma/connect { figmaUrl, figmaToken }`. The token is used
  once to fetch the file and is **not stored**.

## Surfaces

| Surface | Import | Drift |
|---------|--------|-------|
| **MCP tool** | `import_figma_variables` | `figma_token_drift` |
| **HTTP** | `POST /api/figma/import` · `POST /api/figma/connect` (UI) | `POST /api/figma/drift` |
| **Library** | `importFigmaVariables()` · `extractFigmaFile()` | `driftFigmaAgainstScan()` · `driftFigmaComponentsAgainstScan()` |

## Roadmap: vision enrichment

Token *values* must stay structured (exact, governable, drift-ready). The
*qualitative* wiki — component roles, usage notes, imagery style, dos/don'ts —
is best filled by a **multimodal pass** over `get_screenshot`. Rule of thumb:
**vision describes, structure governs.** Same engine as the webpage→design.md
extension track.

## What drift tells you

```
## Figma ↔ code component drift
> 1 differ · 1 Figma-only · 1 code-only · 0 in sync.
- **Button** — ✗ differs
  - `size`: `Large` in Figma, not in code
  - prop(s) `label` in Figma, not in code
- **Card** — → Figma only          # designer shipped a token/component devs haven't built
- **Tooltip** — ← code only         # code has UI not in the Figma library
```

## Modules (`src/lib/figma/`)

- `adapter.ts` — live seam: raw Figma payloads → `FigmaImportInput`
- `normalize.ts` / `import.ts` — variables → tokens → `design.md`
- `components.ts` — published components → scan `ScannedComponent` IR
- `drift.ts` / `component-drift.ts` — token + variant-level reconciliation
