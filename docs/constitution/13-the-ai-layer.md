# The AI Layer: Deterministic Composition With Validated Generation

**What this chapter covers.** Every place in BlockSmith where a large language model is called, what it is allowed to decide, what it is forbidden from deciding, and the machinery (providers, prompts, schemas, validators, caches, rate limits, fallbacks) that turns a stochastic model into a product surface you can put in front of a Fortune 100 design ops team.

**Why it matters.** The whole pitch is "provably on brand". A design system company that lets an LLM invent hex values has no product. But a design system company with no AI at all cannot handle the messy real world: unpredictable markdown, screenshots, prose intent, forty-file component scans. The resolution is a single architectural rule, applied consistently in seven places. If you understand that rule you understand the codebase.

**Read this if** you are about to add an AI feature, debug why a model output was ignored, change a model or provider, or explain to an investor why our generation is different from v0 or Lovable.

---

## 1. The core architectural principle

State it once, plainly:

> **Deterministic composition from the IR and real components. The LLM only selects and arranges within validated constraints.**

The principle is recorded in the project memory note `product-direction` as the chosen architecture, and you can see it enforced mechanically in `src/lib/design-ir/merge-ai-chrome.ts`, `src/ai-lab/09-scan-curate/validate.ts`, and `src/lib/ai/governed-generate.ts`.

Broken into its four moving parts:

| Layer | Owns | Must never do |
|-------|------|---------------|
| Parser | Extract tables into tokens (colors, typography, radii, surfaces, components) | Guess brand names |
| Semantic compiler | Map tables plus Role and Purpose columns onto `--wiki-*` using English semantics only | Hardcode `citra-orange`, `apollo-gold`, or any brand regex |
| LLM | Read parsed JSON plus the source markdown, then choose and arrange | Invent a hex that is not in the token graph |
| Validator | Merge model output only when every value traces back to a parsed token | Allow drift |

That table is lifted (with punctuation rewritten) from `docs/VISUALIZE-ACCURACY-PLAN.md`, which is the oldest written statement of the rule in the repo.

### 1.1 Why this preserves "provably on brand"

"Provably" is a strong word and we mean it literally. The proof is not that the model promised to behave. The proof is that a deterministic function ran after the model and threw away anything the model made up.

Three concrete instances of that function:

1. `mergeValidatedAiChrome(ir, ai)` in `src/lib/design-ir/merge-ai-chrome.ts`. It builds `paletteValues(ir)`, a `Set` of every hex present in `ir.colorVariables`, `ir.tokens.colors`, and `ir.wikiChrome.cssVariables`. A model-supplied value survives only when `value.startsWith("#") && allowed.has(value.toLowerCase())`. A key survives only when it is in the 29-entry `WIKI_KEYS` allowlist or starts with `--font-`. A `--color-*` key survives only when it is byte-identical to the canonical value already in the IR, which means the model can restate a token but cannot redefine one.
2. `assertHexSubset(factsText, curatedText)` in `src/ai-lab/09-scan-curate/validate.ts`. It extracts the hex set from the deterministic scan facts and the hex set from the LLM-written wiki markdown, and throws if the curated document contains a color the scan never saw.
3. `scoreDrift(code, system)` in `src/lib/ai/governed-generate.ts`. It does not trust the generating model at all. It re-lints the generated code with the same engine the CI gate uses.

In all three the model is upstream of a filter, never downstream of one.

### 1.2 Why it still feels magical

Because the model is doing the part humans cannot script: reading unstructured prose and deciding what it *means*. A doc that says "Surfaces: Canvas is the page, Elevated is used for cards and popovers" has no machine-readable mapping to `--wiki-bg` and `--wiki-sidebar`. Writing regexes for that is how the product failed before (see the "What went wrong before" section of `docs/VISUALIZE-ACCURACY-PLAN.md`: slug lists like `sprout` and `citra-orange` broke on the next upload). The model does the semantic mapping; the validator makes the mapping safe. The user sees their brand appear on a wiki they never configured, which is the magic, and none of the pixels are invented, which is the product.

### 1.3 Why curated layout archetypes beat infinite generation

This is the strategic half of the same rule, recorded in the `product-direction` memory note: "Curated layout archetypes > infinite generation."

The argument:

- Infinite generation has unbounded output space, so it has unbounded failure space. There is no validator you can write for "any layout an LLM might emit".
- A curated archetype (a hero, a settings page, a checkout summary) is a **finite structure with holes**. The holes take IR components and IR tokens. The LLM's job shrinks to picking an archetype and filling holes, which is a small, enumerable, checkable decision.
- A finite decision space is testable. `npm run verify:design-ir` runs regression on sample docs. There is no equivalent test for "generate anything".
- Competitors (v0, Lovable, bolt) generate UI from a prompt, which is random and off-brand by construction. We generate from a governed design system, so the output is on-brand by construction. That difference only exists because our output space is constrained.

The archetype library itself is **Planned**, not built. Today the constrained-composition pattern is fully realised in the chrome compiler and the governed generator; the demo-page archetypes are P2 in the phasing recorded in `product-direction`.

---

## 2. The provider stack

### 2.1 One vendor, deliberately

Every LLM call in this repo goes to NVIDIA's OpenAI-compatible endpoint. There is no Anthropic client, no OpenAI-hosted client, no Gemini client. The base URL default lives in `src/ai-lab/shared/nvidia-profiles.ts`:

```ts
const BASE_URL =
  process.env.NVIDIA_BASE_URL?.trim() ||
  "https://integrate.api.nvidia.com/v1";

export function createNvidiaClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey, baseURL: BASE_URL });
}
```

We use the official `openai` npm SDK pointed at NVIDIA. That is why model ids look like `openai/gpt-oss-120b` and `nvidia/nemotron-3-super-120b-a12b`: those are NVIDIA-hosted model names, not calls to OpenAI.

**Standing rule: do not add another vendor.** It is written into the `governed-generate-live` memory note ("reuses the project's NVIDIA stack ... do NOT add Anthropic/another vendor") and it is a real constraint, not a preference. Reasons:

- One key rotation story, one billing story, one outage story.
- Two API keys on the same provider already give us failover (see 2.3), which is most of the resilience benefit of multi-vendor at none of the integration cost.
- Every prompt in the repo is tuned against these models' quirks (`<think>` blocks, `reasoning_content`, `chat_template_kwargs`). A second vendor doubles the prompt surface.
- Legal and procurement: one data processing agreement.

If you ever need to break this rule, it is a founder-level decision, not a ticket.

### 2.2 Profiles

Two profiles, defined in `getNvidiaProfile(id)`:

| Profile | Default model | Temperature | top_p | max_tokens | Thinking |
|---------|---------------|-------------|-------|------------|----------|
| `chrome` | `NVIDIA_MODEL_CHROME`, else `nvidia/nemotron-3-super-120b-a12b` when `VERCEL === "1"`, else `nvidia/nemotron-3-ultra-550b-a55b` | 0.35 | 0.95 | 8192 | off (`reasoning_budget` 4096 recorded but unused while off) |
| `parser` | `NVIDIA_MODEL_PARSER`, else `openai/gpt-oss-120b` | 0.5 | 1 | 4096 | off |

The `VERCEL === "1"` branch is important and easy to miss: **the same code picks a different model in production than on your laptop.** Locally `chrome` is the 550B Ultra model; on Vercel it silently downgrades to the 120B Super model, because Ultra takes roughly two minutes per call and Vercel function budgets do not allow that. If you are debugging "why does chrome look different in prod", this line is the answer.

`enable_thinking` is off for both profiles because the chrome and parser paths demand parseable JSON and reasoning traces corrupt that reliably.

### 2.3 `chatWithModels`: key fallback and model fallback

`src/ai-lab/shared/chat.ts` exposes four entry points. The one that matters most for live product surfaces is `chatWithModels`:

```ts
export async function chatWithModels(
  models: string[],
  profileId: NvidiaProfileId,
  messages: ChatMessage[],
  opts?: { maxTokens?: number; stream?: boolean },
): Promise<ChatResult>
```

Behaviour:

- Collect keys as `[NVIDIA_API_KEY, NVIDIA_API_KEY_FALLBACK]`, trimmed, deduplicated. Zero keys throws immediately with a message pointing at `src/ai-lab/README.md`.
- Loop **keys on the outside, models on the inside**. So it tries every model on key 1 before touching key 2. That ordering is a deliberate cost choice (exhaust the primary account) but it also means a rate-limited primary key costs you N failed attempts before the fallback key is reached.
- Each failure logs `[ai-lab] chatWithModels: <model> failed, trying next` and continues. Total failure rethrows the last error.
- It takes the named profile's temperature, top_p and thinking settings but overrides the model, and optionally `max_tokens`. That is the whole point: it decouples "how should the model behave" (profile) from "which model, and how fast" (the explicit list).

The other three helpers:

| Function | Fallback behaviour | Used by |
|----------|--------------------|---------|
| `chatWithProfile` | Tries the profile model, plus `CHROME_MODEL_FALLBACKS` when the profile is `chrome`, then repeats the whole list on the fallback key | scan curate (parser profile), single-pass chrome |
| `chatJsonWithProfile<T>` | Wraps `chatWithProfile`, extracts JSON via `extractJsonFromModelText`, runs a caller-supplied `parse` | governance copilot, single-pass chrome |
| `chatJsonWithModel<T>` | **No fallback at all.** Uses `getAiLabClient()` (primary key only), one model, one attempt | ensemble primary agents and refiner |

`chatJsonWithModel` having no key fallback is intentional for the ensemble (each agent is already redundant with its siblings, and per-agent retries would blow the wall-clock budget), but it is an asymmetry worth knowing when you read a "primary agent failed" log.

### 2.4 Which models, and why fast beat large

`src/lib/ai/governed-generate.ts` opens with the decision:

```ts
const GENERATE_MODELS = (
  process.env.NVIDIA_MODEL_GENERATE?.trim() ||
  "nvidia/nemotron-3-super-120b-a12b,openai/gpt-oss-120b"
)
```

The code comment says it directly: these are "Fast, reliable models for live generation, deliberately NOT the heavy 550B chrome model". The 550B Ultra model takes roughly two minutes per call. The governed demo issues **two** calls. A four-minute demo is not a demo, and a Vercel function with `maxDuration = 120` would time out before the first pair finished.

Measured outcome, recorded in the `governed-generate-live` memory note: live end-to-end latency around **13.5 seconds** for the two parallel calls, with a proven result of 5 drift violations in the ungoverned output and 0 in the governed output, same model, same prompt, only the governance context differing. That last clause is the entire experimental control and you should protect it: if anyone ever "improves" the demo by giving the governed agent a better model, the demo stops being evidence and becomes marketing.

Output is capped at `NVIDIA_GENERATE_MAX_TOKENS`, default 1600, because a single small component is short and tokens are money and latency.

### 2.5 Every environment variable

| Variable | Default | Used by | Effect |
|----------|---------|---------|--------|
| `NVIDIA_API_KEY` | none | everything | Primary key. Absent means every AI surface degrades (503 or deterministic fallback) |
| `NVIDIA_API_KEY_FALLBACK` | none | `chatWithModels`, `chatWithProfile`, capture | Second key, tried after the primary is exhausted |
| `NVIDIA_BASE_URL` | `https://integrate.api.nvidia.com/v1` | `createNvidiaClient` | Provider endpoint |
| `NVIDIA_MODEL_CHROME` | Ultra 550B locally, Super 120B on Vercel | `chrome` profile, ensemble primary selection | Wiki chrome compiler model |
| `NVIDIA_MODEL_PARSER` | `openai/gpt-oss-120b` | `parser` profile | Curate, governance copilot, prompt-to-design-system |
| `NVIDIA_MODEL_GENERATE` | `nvidia/nemotron-3-super-120b-a12b,openai/gpt-oss-120b` | governed generate | Comma-separated ordered model list |
| `NVIDIA_GENERATE_MAX_TOKENS` | `1600` | governed generate | Output cap per agent |
| `NVIDIA_MODEL_CHROME_REFINER` | `openai/gpt-oss-120b` | ensemble refiner | Consensus model |
| `NVIDIA_MODEL_VISION` | see 7.2 and 7.4 | `vision-generate.ts`, `capture.ts` | Multimodal model |
| `NVIDIA_ENSEMBLE` | unset (hybrid) | `generateAiLayout`, `/api/ai/status` | `1` switches Visualize from single-pass to multi-agent ensemble |
| `NVIDIA_ENSEMBLE_ULTRA` | unset | `parallelPrimaryModels()` | `1` allows the slow Ultra model into the ensemble on Vercel |
| `AI_LAB_SCAN_CURATE` | inferred from key presence | `scanCurateEnabled()` | `0` forces raw scan facts, `1` forces curation |
| `AI_LAB_PARSER_ASSIST` | see `02-parser-assist/needs-assist.ts` | parser assist | Toggles LLM normalization of messy markdown |
| `VERCEL` | set by the platform | profile selection, ensemble model selection | Production model downgrade |
| `BLOCKSMITH_AI_RATE_LIMIT` | `10` | `aiGenerateRateLimitForRequest` | Per-IP AI calls per window |
| `BLOCKSMITH_AI_RATE_LIMIT_PER_USER` | `40` | `aiGenerateRateLimitForUser` | Per-signed-in-user AI calls per window |
| `BLOCKSMITH_AI_RATE_WINDOW_MIN` | `60` | both AI limiters | Window length in minutes, floored at 1 minute |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | unset | `src/lib/cloud/rate-limit.ts` | Makes rate limits distributed instead of per-instance |

Note the gap: `.env.example` documents `AI_LAB_SCAN_CURATE`, `NVIDIA_MODEL_VISION` (commented out) and the Upstash pair, but does **not** list `NVIDIA_API_KEY` itself as its own line. It is only referenced in a comment on the capture ingest block. `src/ai-lab/README.md` and `docs/VISUALIZE-AND-API.md` do document it properly. This is a small onboarding trap worth fixing.

---

## 3. The governed versus ungoverned demo

This is the money shot of the pitch, and the reason it is credible is a single implementation decision. Read this section carefully.

### 3.1 What it does

`src/lib/ai/governed-generate.ts` takes one user prompt and runs **two LLM completions in parallel** with the same model list and the same user message. The only difference is the system message.

The ungoverned agent (`ungovernedMessages`) is told it is a frontend engineer AI, that it should write one small self-contained React plus TypeScript component with inline styles, and, quoting the prompt: "You have no design system or component library to follow, use your own judgment for colors, spacing, and components."

The governed agent (`governedMessages`) gets four hard rules plus the tenant's actual design system:

1. Colors: use only the CSS variable tokens below via `var(--token)`, never a raw hex.
2. Components: compose only the listed approved components.
3. Import approved components from the tenant's package name and import its `tokens.css`.
4. Do not invent variants, colors, or components outside the system.

Then the literal design context, introduced as "APPROVED DESIGN SYSTEM (authoritative, this is what the team pinned in their blocksmith.lock)".

Both are told to respond with only one fenced `tsx` block and no prose.

The two calls are issued with `Promise.all`, so wall-clock time is the slower agent, not the sum.

### 3.2 `formatDesignContextForPrompt`

Defined in `src/lib/ai/build-design-context.ts`. It is one line of code over `buildDesignContext(system)`:

```ts
export function formatDesignContextForPrompt(system: LoadedDesignSystem): string {
  const ctx = buildDesignContext(system);
  return JSON.stringify(ctx, null, 2);
}
```

`buildDesignContext` is where the real work is. It converts a `LoadedDesignSystem` into a **budgeted, structured, pretty-printed JSON document** with these fields:

| Field | Content | Budget |
|-------|---------|--------|
| `systemId`, `systemName`, `mode`, `contentHash`, `sourcePath`, `tagline` | identity and provenance | none |
| `overview` | system overview prose | first 800 chars |
| `currentWikiChrome` | output of `buildWikiThemeStyle(system)`, the currently resolved chrome | none |
| `colors` | `{ name, cssVar, hex, role }`, with `cssVar` normalized to start with `--` (bare names become `--color-<name>`) | all |
| `typography` | `{ name, role, substitute, cssVar }` | all |
| `components` | `{ id, title, role, description }` | first 24 components, description first 200 chars |
| `surfaces` | `{ level, name, value, purpose }` | first 8 |
| `guidelines.dos` / `guidelines.donts` | usage rules | first 6 each |
| `agentGuideExcerpt` | the doc's agent guide | first 1200 chars |

Two things to notice. First, **the same function feeds both the governed generator and the chrome compiler** (`compile-chrome.ts` and `compile-ensemble.ts` both call it). One context builder, one place to change what a model knows about a tenant. Second, the field ordering and the `role` columns are what let the model reason semantically: it is not given a bag of hexes, it is given hexes with their declared jobs.

### 3.3 The credibility argument: same engine as CI and MCP

This is the part that matters.

The drift numbers shown in the demo are **not** produced by asking a model to grade itself. They are produced by `scoreDrift`, which calls three functions from `src/lib/governance/color-lint.ts`:

```ts
const palette = paletteFromColors(system.colors);
const offTokens = findOffTokenColors(code, palette);
// then, per violation:
const near = nearestToken(o.hex, system.colors);
```

Those exact functions are imported by:

| Consumer | File | Role |
|----------|------|------|
| MCP `validate_ui_code` | `src/mcp/handlers.ts` (`handleValidateUiCode`) | Coding-time enforcement inside the agent's editor |
| MCP `check_governance_diff` | `src/lib/governance/check-diff.ts` | Tiered governance findings with fix suggestions |
| CI gate | `scripts/validate-ui.ts` | The `validate:ui` command a customer wires into their pipeline |
| Commit gate | `scripts/governance-gate.ts` | Pre-push enforcement |
| The demo | `src/lib/ai/governed-generate.ts` | Scoring both agents' output |

The file's own header comment states the intent: it is shared "so that coding-time and push-time enforcement apply the exact same rule: a color must be a defined token".

So when the showcase renders "5 drift violations, would fail validate:ui in CI", that sentence is literally true. The same lines of code that produced the 5 will produce a non-zero exit in the customer's pipeline. If we had written a separate demo-only scorer, the demo would be theatre. Because we did not, the demo is a **live execution of the product**. Protect this. Any future refactor that gives the demo its own scoring path destroys the only thing that makes it worth showing.

How the lint itself works, briefly:

- `normalizeHex` lowercases, expands 3-digit shorthand, drops an 8-digit alpha suffix, and returns null for anything that is not a 6-digit hex.
- `paletteFromColors` builds a `Set` of normalized approved hexes.
- `findOffTokenColors` scans line by line for `/#[0-9a-fA-F]{3,8}\b/g`, skips `transparent`, `currentcolor`, `inherit`, `none`, and reports every hex not in the palette with its line number and a 100-character snippet.
- `nearestToken` picks the closest approved token by squared RGB distance. It is deliberately cheap and deliberately approximate; its job is to point an agent at the intended token, not to be perceptually correct. If we ever want perceptual accuracy, this is where a CIELAB delta-E would go.

`buildOutput` also sets `usesApprovedKit` by the crude but honest test `code.includes(packageName)`, where `packageName` comes from `packageNameForDoc(docRef)` in `src/lib/ir/releases.ts` (`upload:scan-acme-ui-kit.md` becomes `@blocksmith/acme-ui-kit`).

### 3.4 Cache key and TTL

```
key   = sha256(`${docRef}::${system.contentHash ?? ""}::${prompt}`)
TTL   = 10 * 60_000 ms  (10 minutes)
CACHE_MAX = 200 entries
```

The `contentHash` component is the interesting one. It means **editing the design system invalidates the cache automatically**: change a token, get a fresh generation. Without it a demo would keep replaying a stale result after a token edit, which would look like the governance had no effect.

Eviction is a comment-acknowledged "cheap LRU-ish": on insert at capacity it sorts all entries by insertion time and deletes the oldest one. It sorts 200 entries to delete one, which is fine at this size and would not be at 200,000.

A cache hit returns `{ ...cachedResult, cached: true }`, and the client surfaces that as a "cached" suffix next to the model name, so nobody is misled into thinking a cached demo was a fresh inference.

### 3.5 Endpoint contract

`POST /api/ai/governed-generate`, defined in `src/app/api/ai/governed-generate/route.ts`.

```
runtime     = "nodejs"
maxDuration = 120
```

`maxDuration = 120` exists because there are two parallel completions and a cold serverless start; the route comment says "allow headroom on cold serverless". Note that Next.js requires this to be a static literal, so it cannot be derived from an env var.

Request body:

```json
{ "doc": "upload:scan-acme-ui-kit.md", "prompt": "Build a checkout summary card…" }
```

Response body (`GovernedGenerateResult`):

```json
{
  "doc": "upload:scan-acme-ui-kit.md",
  "systemName": "Acme UI Kit",
  "prompt": "…",
  "packageName": "@blocksmith/acme-ui-kit",
  "approvedTokenCount": 18,
  "approvedComponents": ["Button", "Card", "Badge"],
  "governed":   { "code": "…", "driftCount": 0, "violations": [], "usesApprovedKit": true,  "model": "…" },
  "ungoverned": { "code": "…", "driftCount": 5, "violations": [ { "hex": "#2563eb", "line": 12, "snippet": "…", "nearest": { "name": "Accent", "cssVar": "--acme-accent", "hex": "#e85d4a" } } ], "usesApprovedKit": false, "model": "…" },
  "cached": false,
  "generatedAt": "2026-08-16T…Z"
}
```

Status codes, in the order the route checks them:

| Status | Condition | Body |
|--------|-----------|------|
| 503 | `!isNvidiaConfigured()` | `{ error, code: "not_configured" }` |
| 400 | missing or non-string `doc` | `{ error: "Missing doc." }` |
| 400 | `normalizePrompt` throws (empty prompt) | `{ error: "Prompt is required." }` |
| 403 / 401 | `requireDocumentAccess` denies (upload docs only) | whatever the access layer returns |
| 429 | per-IP or per-user AI rate limit | `{ error, code: "rate_limited" }` plus a `Retry-After` header |
| 500 | anything else, logged as `[api/ai/governed-generate]` | `{ error: message }` |
| 200 | success | the result above |

**Tenant scoping.** The route only enforces access when the doc is an upload reference:

```ts
if (isUploadDocRef(doc)) {
  const access = await requireDocumentAccess(request, uploadFileNameFromRef(doc), "read");
  if (!access.ok) return access.response;
}
```

The service layer's contract, stated in its own header comment, is that it is stateless and tenant-safe and that "callers must pass a docRef they're authorized for (enforced at the route)". Non-upload docs (bundled sample and demo documents) pass through, which is what lets the public investor demo run without a login. If you add a new doc-ref scheme, you must revisit this branch, because the default is permissive.

**Prompt bounds.** `normalizePrompt` trims, throws on empty, and truncates to `MAX_PROMPT_LEN = 600`. The client independently sets `maxLength={600}` on the textarea, so the two agree by convention rather than by shared constant. Worth unifying.

**Rate limits.** Per-IP always (`aiGenerateRateLimitForRequest`, default 10 per 60 minutes). Then, when a Supabase session exists, an additional per-user check (`aiGenerateRateLimitForUser`, default 40 per 60 minutes). The per-user limit is larger, not smaller: signing in buys you more, which is the intended incentive. Both are fixed-window counters in `src/lib/cloud/rate-limit.ts`, backed by Upstash Redis when configured and by an in-memory `Map` otherwise, and they **fail open** on any Redis error so an Upstash outage cannot brick the endpoint.

---

## 4. Client safety

`src/components/demo/GovernedAiShowcase.tsx` is a `"use client"` component with two safety decisions that are not obvious and are both deliberate.

### 4.1 It never looks broken

State machine: `"idle" | "loading" | "done" | "unconfigured" | "error"`.

```ts
if (res.status === 503) { setStatus("unconfigured"); return; }
if (!res.ok) throw new Error(body.error ?? "Generation failed.");
```

In `idle`, `unconfigured`, and `error` the component renders `<StaticSample />` with an explanatory line above it. The `unconfigured` line names `NVIDIA_API_KEY` explicitly and says "Showing a sample, the governed card is the real generated kit". The `error` line shows the server's message followed by "showing a sample instead".

Why this matters: this component is the centrepiece of `/demo/investor` (it is mounted from `src/components/demo/InvestorDemo.tsx`). A demo that renders a red error box in front of an investor because a model provider had a bad thirty seconds is a self-inflicted wound. A demo that quietly falls back to a truthful static sample loses nothing, because the static sample is not a mockup.

That is the second half of the decision, and it is the part people get wrong. `StaticSample` does not hand-draw a "governed" card. It imports the **real generated package**:

```ts
import { Button, Card, Badge, cssVars } from "@blocksmith/acme-ui-kit";
```

The governed column renders actual `Card`, `Badge` and `Button` components from the kit our pipeline generated, themed with the kit's own `cssVars`, and the accent shown in the caption is read out of `cssVars["--acme-accent"]` rather than typed in. The ungoverned column is hand-written with off-brand values on purpose (`#2563eb`, a bespoke button, an invented radius) because that column is *supposed* to be wrong. So even in fallback mode the claim on screen is true.

### 4.2 It never evaluates LLM output

The live columns render generated code like this:

```tsx
<pre style={codeBlock}>{out.code || "// (empty response)"}</pre>
```

Text inside a `<pre>`. Not `eval`, not `new Function`, not `dangerouslySetInnerHTML`, not a Babel-in-the-browser transform, not an iframe with the code injected.

**This is the XSS boundary of the entire product.** Consider the alternative. The ungoverned agent is by design given no constraints and told to use its own judgment. Its output is attacker-influenceable: the prompt comes from a user-controlled textarea, and the doc it is grounded in can be a tenant-uploaded markdown file. If we executed that output in the page, we would have built a remote code execution primitive with a "Generate live" button on it, running on the same origin as the user's Supabase session. Every token, every document, every org membership would be reachable from a prompt injection.

Rendering as text costs us the ability to show a live preview of the generated component. That is a real product loss and people will ask for it. The answer is not "eval it carefully". The answer, if we ever build it, is a sandboxed cross-origin iframe with a restrictive CSP and no ambient credentials, which is a project, not a patch. Until that project ships, the rule is absolute: **LLM-produced JSX is displayed, never executed.**

The component's own header comment states both decisions, so the intent survives a refactor.

---

## 5. Visualize: the AI layout ensemble

Visualize is the feature where a user clicks a button and the wiki reskins itself into their design system. `docs/VISUALIZE-ACCURACY-PLAN.md` calls it BlockSmith's technical moat, and it is the oldest instance of the deterministic-plus-validated pattern.

### 5.1 Instant semantic pass, background LLM refine

The user-visible contract, from `docs/VISUALIZE-AND-API.md`: semantic preview under 1 second, AI refine typically 30 to 90 seconds, and a refine failure never removes the preview.

`src/hooks/useVisualizeStyle.ts` implements it:

1. On mount, `GET /api/ai/status` to learn whether AI is configured at all (`{ configured, visualizeMode, required }`). If it is not, the hook never issues a refine request.
2. On apply, `applyDeterministicTheme()` runs first: load Google fonts for the doc's typography, then `applyVisualizeThemeFromIR(ir)`. Mode becomes `"deterministic"`, status text becomes "Design preview active (semantic chrome)". No network LLM call is involved. This is why Visualize works with no API key at all.
3. A `MIN_LOADING_MS = 800` floor keeps the spinner from flashing.
4. Then, and only then, `void fetchAndApplyAiLayout()` fires **without being awaited**. The preview is already on screen; the refine is background work.
5. On success, `applyAiTheme(layout)` re-applies the theme with the model's chrome, mode becomes `"ai"`, and the summary line becomes the model's own one-sentence summary.
6. On any failure the semantic chrome stays exactly as it is and a soft warning appears.

There is also a re-run path: an effect watches `ir.contentHash` and re-runs both passes when the underlying document changes, guarded by `appliedHashRef` so it does not loop.

### 5.2 Timeout budget

```ts
const AI_LAYOUT_TIMEOUT_MS = 90_000;
```

Enforced client-side with an `AbortController`. On abort, `visualizeAiRefineWarning` maps the message to user copy: "AI refine timed out, preview uses semantic chrome from your scan." Missing-key errors map to "AI refine unavailable, using semantic chrome from your scan." Everything else becomes "AI refine skipped, `<error>`". Those strings live in `src/ai-lab/03-visualize-status/messages.ts` so the failure vocabulary is in one file rather than smeared through components.

Server side, `POST /api/ai/layout` sets `maxDuration = 120` with the comment that the hybrid default is one background LLM refine at roughly 60 to 90 seconds. So the client gives up at 90s and the function is killed at 120s. The gap is intentional headroom, not an oversight, but note the consequence: a request the client abandoned can still be burning tokens server-side for another 30 seconds. There is no cancellation propagation.

`aiRunningRef` prevents concurrent refines from the same hook instance. There is no server-side dedupe, so two tabs on the same doc will pay twice.

### 5.3 The ensemble

`generateAiLayout(docRef)` in `src/lib/ai/generate-layout.ts` is a two-way switch:

```ts
if (process.env.NVIDIA_ENSEMBLE === "1") return compileChromeEnsemble(docRef);
const layout = await compileChromeWithAi(docRef);
```

Default (hybrid): one pass, `compileChromeWithAi`, `chatJsonWithProfile("chrome", …)`, markdown excerpt capped at 24,000 characters, returns `passes: ["semantic", "primary"]`.

Ensemble (`NVIDIA_ENSEMBLE=1`): `compileChromeEnsemble` in `src/ai-lab/01-ai-chrome/compile-ensemble.ts`, markdown excerpt capped at 20,000 characters. Structure:

```
loadEnsembleDoc(docRef)
  → compileDesignIR()                  deterministic IR
  → compileSemanticWikiChrome()        deterministic chrome (vote A)
  → formatDesignContextForPrompt()     parsed tokens for the prompt
  → Promise.all(primary agents)        votes B1..Bn, in parallel
  → refiner agent                      consensus over A and B1..Bn
  → mergeValidatedAiChrome()           validation
  → enforceChromeLegibility()          guardrails
```

Model selection (`parallelPrimaryModels()`):

| Condition | Models |
|-----------|--------|
| `VERCEL === "1"` and not `NVIDIA_ENSEMBLE_ULTRA` | `nvidia/nemotron-3-super-120b-a12b` and `openai/gpt-oss-120b` |
| `NVIDIA_MODEL_CHROME` set | that model plus Super 120B, deduped, capped at 2 |
| otherwise | the `chrome` profile model plus Super 120B |

The refiner is `NVIDIA_MODEL_CHROME_REFINER`, default `openai/gpt-oss-120b`, a different family from the Nemotron primaries so the consensus pass is not just the same model agreeing with itself.

The comment on `parallelPrimaryModels` states the cost model plainly: "Models run in parallel (wall-clock approximately the slowest agent, not sum)." You pay N times the tokens for roughly 1 times the latency. `VisualizeLoadingOverlay.tsx` warns the user the ensemble "may take up to 5 minutes", which is why it is not the default.

Failure handling is layered:

- A primary agent that throws is caught, logged as `[ensemble] primary agent <model> failed`, and returns `null`. Surviving agents continue.
- If **all** primaries fail, the whole call throws with a message naming `NVIDIA_API_KEY` and model availability.
- If the refiner fails, it falls back to `primaries[0].data` with the model recorded as `"primary-fallback"`, so the log and the response tell you a degraded path ran.

The merge is a three-layer fill, in priority order: start from the semantic baseline (validated), overlay any non-empty refiner value (validated), then for keys still missing, try each primary's value through its own `mergeValidatedAiChrome` trial and take it only if it survives validation. So a key never lands unvalidated no matter which layer supplied it.

### 5.4 Legibility guardrails

`enforceChromeLegibility(chrome)` in `src/lib/design-ir/color-utils.ts` runs last, over a copy, on every merged chrome map.

The problem it solves is stated in its own comment: role matchers and AI refinement read prose and can pick a foreground that collides with its surface. A token labelled "muted surfaces" gets used as muted *text*. A CTA label fails contrast on the accent fill. Both are legal outputs of a validated pipeline (every hex is an approved token) and both are unreadable.

What it does:

| Pairing | Rule | Threshold |
|---------|------|-----------|
| `--wiki-text` on `--wiki-bg` | `ensureReadable`, else swap to best of black or white | WCAG contrast 4.5 |
| `--wiki-muted` on `--wiki-bg`, then again on `--wiki-sidebar` | `legibleMuted`: must differ from the surface and clear the threshold, else blend `--wiki-text` toward the surface at 0.55, 0.65, 0.75, 0.85, 1.0 and take the first that clears | 2.4 |
| `--wiki-cta-on-accent` on `--wiki-accent` | `bestForeground` over the current value, `--wiki-bg`, `--wiki-text`, plus white and black | maximize |
| `--wiki-nav-text` and `--wiki-nav-muted` on `--wiki-nav-bg` | same as body and muted | 4.5 and 2.4 |

The math is real WCAG: `channelLuminance` applies the sRGB transfer function, `relativeLuminance` uses the 0.2126 / 0.7152 / 0.0722 coefficients, `contrastRatio` is the standard `(L1 + 0.05) / (L2 + 0.05)`.

Two design notes. First, the derived muted tone is produced by blending two colors that are already in the palette, so the guardrail prefers staying on-palette over falling back to grey. Second, the whole file is pure color math with no parser or server imports, marked "Client-safe", so the same guardrail can run in the browser and on the server without duplication.

The consequence you should internalise: **a model swap can never produce an unreadable theme.** That is a stronger guarantee than "the model usually picks well", and it is what lets us change models without a visual QA pass.

### 5.5 No invented tokens

Covered mechanically in section 1.1, but the prompt side matters too. `LAYOUT_SYSTEM_PROMPT` in `src/lib/ai/layout-schema.ts` includes the rules, quoted with punctuation rewritten:

- "PARSED TOKENS are the only allowed hex sources. Never invent colors."
- "Do not assume Apollo, Inter, or 8px radius unless the doc says so."
- "Include every parsed `--color-*` in cssVariables unchanged."
- "Match the doc's theme (light / mixed / dark zones) from Surfaces plus layout notes."

`CHROME_SYSTEM_PROMPT` appends: "Every hex must exist in the PARSED TOKENS color list."

And the user prompt (`buildChromeUserPrompt`) labels its sections explicitly: `DETERMINISTIC SEMANTIC CHROME (hint, improve if doc implies different mapping)`, `PARSED TOKENS (authoritative hex, do not invent colors)`, `SOURCE MARKDOWN`. The model is shown the deterministic answer and invited to beat it, which is a much better framing than asking it to start from nothing.

Output shape is enforced by Zod, `AiLayoutResponseSchema`: `cssVariables` is `z.record(z.string())`, `layout` is optional with `contentMaxWidth`, `sidebarWidth`, `borderRadius`, and a `density` enum of `compact | comfortable | spacious`, and `summary` is a required string. A response that does not parse throws inside `chatJsonWithModel` and is treated as an agent failure.

So there are three independent defences against invented tokens: the prompt says do not, the schema constrains the shape, and the merge discards anything not in the palette. Only the third one is load-bearing. The other two exist to raise the hit rate.

### 5.6 The accuracy plan

`docs/VISUALIZE-ACCURACY-PLAN.md` records the phased roadmap and its status:

| Phase | Content | Status in the doc |
|-------|---------|-------------------|
| P0 | Stop lying: no Apollo hex in previews, golden tests for sample docs | done |
| P1 | Design IR: `blocksmith.design.v1` on disk, visualize reads IR | done |
| P2 | AI Lab loop: semantic resolve, merge, steps 01 through 04 | done |
| P3 | Layout packet: pre-built hero and zone HTML from IR for marketing-style docs | later |

P3 is the archetype work from section 1.3 and remains **Planned**.

The doc also states the acceptance test in one line: upload *your* markdown, click Visualize, and the chrome should track *your* tables, not an Apollo or Caldera shortcut. `npm run verify:design-ir` is the regression harness.

---

## 6. The wiki curate step

### 6.1 Where it sits

`src/lib/scan/run.ts` documents the order, and the order is the design:

```
1. scanWorkspace()             facts on disk
2. workspaceScanToMarkdown()   full facts .md plus inventory
3. resolveScanMarkdownForWiki() optional LLM polish; inventory always re-appended
4. write upload                the wiki reads this file only
```

Step 3 is the curate step. The entry point is `resolveScanMarkdownForWiki(result, factsMarkdown, docRef)` in `src/ai-lab/09-scan-curate/resolve.ts`.

### 6.2 What it is for

A raw workspace scan produces something true and unreadable: file paths, export lists, CSS variable tables, hex occurrence counts, coverage numbers. A designer opening that wiki learns nothing about *when to use the Button*.

The curate step turns facts into prose for a human audience. The system prompt in `src/ai-lab/09-scan-curate/prompt.ts` names the audience explicitly: "Write for UI/UX designers and frontend engineers, roles must explain WHEN to use each component, not list exports."

### 6.3 What it may touch

It is given a fixed skeleton to fill, with frontmatter, a one-sentence system summary, section 1 Design Tokens (1.1 CSS variables, 1.2 Colors), section 2 Component Library with a `### ComponentName` block per component containing a Role paragraph and a field table, and section 3 Catalog exclusions.

Allowed:

- Writing the tagline and the component Role prose (2 to 3 sentences on purpose, when to use, variants known from facts).
- Choosing which of the scanned values are "designer-relevant" and worth surfacing.
- Ordering and grouping.
- Writing the one-line exclusion reasons.
- Omitting rendering infrastructure, devtools, and app chrome (only components marked `includeInWiki` in the facts may appear).

### 6.4 What it must never touch

The prompt's rule 2 is absolute: "NEVER invent colors, hex codes, CSS variables, file paths, or component names. Use ONLY values from the scan facts."

Additional hard limits:

- No JSON, no code fences (rule 1).
- No raw source dumps, no "Exports:" prose outside tables (rule 5).
- Colors capped at 40 rows, excluded components capped at 10 rows, preferring token-linked colors over stray literals.
- It is told explicitly **not** to write a "Codebase inventory" section, because that section "is appended deterministically after curation with 100% of React files".

That last point is the pattern in miniature. The part that must be complete and exact (every React file in the repo) is never entrusted to a model; `mergeInventoryIntoMarkdown(curated, result.inventory)` re-appends it deterministically after the model is done, on both the cached and fresh paths.

### 6.5 Enforcement and fallback

Two assertions run on every curated output, in `curateScanToWikiMarkdown`:

- `assertCuratedScanShape(md)`: must have workspace-scan frontmatter (`isWorkspaceScanMarkdown`), must have a `## N. Component Library` heading, must have at least one `### ` component entry.
- `assertHexSubset(factsMarkdown, curated)`: throws naming up to 5 offending hexes if the curated document introduced a color the scan never saw.

There is also `assertInventoryCoverage(factsMd, publishedMd)`, which checks that every `.tsx` path present in the facts survives into the published document.

If anything throws, `resolveScanMarkdownForWiki` catches it, logs `[ai-lab:09] scan curate failed for <docRef>`, and returns the **deterministic facts markdown** with `applied: false` and the error as `reason`. The scan still publishes. The wiki is uglier and completely correct. That is the right trade and it is the trade everywhere in this layer.

Gating and caching:

- `scanCurateEnabled()`: `AI_LAB_SCAN_CURATE=0` forces off, `=1` forces on, otherwise it follows whether a key is configured.
- Cache key is `scanFactsHash(factsMarkdown)`, the first 16 hex characters of a SHA-256, stored on disk under `<writable root>/ai-lab/scan-curated/<safe doc key>/<hash>.md` with a sibling `<hash>.meta.json` recording model, facts byte count, doc ref, and timestamp. Raw facts are separately persisted under `<writable root>/scan-facts/` for audit.
- Both persistence paths are skipped when `skipLocalScanAudit()` is true, which is how read-only serverless filesystems are handled.
- Facts markdown is truncated to `MAX_FACTS_CHARS = 40_000` with a visible truncation marker before being sent.

Model: the `parser` profile (`openai/gpt-oss-120b` by default), not the chrome profile, because this is a long-form prose task where the 120B model is fast and good enough.

---

## 7. Generation paths in the product

Five paths call a model to create or change user-facing content. Here is each one.

### 7.1 Design system from a text prompt

| Item | Value |
|------|-------|
| Route | `POST /api/projects/create` |
| File | `src/app/api/projects/create/route.ts` |
| Library | `generateDesignSystemFromPrompt()` in `src/lib/dashboard/generate.ts` |
| Body | `{ name: string, useAi?: boolean }` |
| Config | `dynamic = "force-dynamic"`, `maxDuration = 60` |
| Model | `parser` profile model, temperature 0.5, `max_tokens` 1800, user prompt sliced to 2000 chars |
| Status | **Shipped** |

Guardrails, in order:

1. Empty name gives 400.
2. In hosted mode (`saasStrictMode()`), an unauthenticated request gives 401, because creating writes storage and, with AI, spends tokens.
3. AI is attempted only when `body.useAi && isNvidiaConfigured()`.
4. Rate limit before the call: per-user when signed in, otherwise per-IP; 429 with `Retry-After`.
5. `extractSpec(text)` is defensive parsing, not `JSON.parse`. It strips `<think>…</think>` blocks, unwraps a fenced block if present, then takes the substring from the first `{` to the last `}` and parses that. Returns `null` rather than throwing.
6. `specToParts(spec)` is the real validator. Every hex goes through `normHex` (shorthand expansion, alpha truncation, must end up 6 digits) or is dropped. Every size goes through `px()` (finite and non-negative) or is dropped. Caps: 16 colors, 8 radii, 10 spacing steps, 10 type sizes, 12 components, with duplicate CSS variable names and duplicate component ids silently skipped. Component names are slugged for ids and stripped to alphanumerics for export names.
7. Zero usable colors throws.
8. **Any** AI failure is caught in the route and falls through to `createStarterProject(name)`. The comment says it plainly: never block the user on a flaky model. The response carries `generated: true|false` so the client can tell which happened.

Note what the model is *not* allowed to produce: it emits a small JSON spec, and we build the CSS variables, the token names, and the component records ourselves. The model never writes markdown, never writes CSS, never names a CSS variable. `--color-<slug>`, `--radius-<slug>`, `--spacing-<slug>` and `--font-size-<slug>` are our naming scheme, applied deterministically to model-supplied labels.

**Known gap: the model dropdown in the prompt bar is decorative.** `src/components/dashboard/PromptBar.tsx` renders a `DropdownMenu` offering "Claude 3.5 Sonnet", "GPT-4o", and "Gemini 1.5 Pro" with vendor logos, stores the choice in `selectedModel`, and **never sends it anywhere**. The request body is `{ name: text, useAi }`. Every generation runs on the NVIDIA-hosted `parser` model regardless of what the user picked. This is UI borrowed from a template and left wired to nothing. It should either be removed or repointed at real, honestly named options, because as it stands it tells the user something false about what is running. Status: **Partial** at best, and arguably a correctness bug rather than a missing feature.

### 7.2 Design system from a screenshot (vision)

| Item | Value |
|------|-------|
| Route | `POST /api/projects/generate-image` |
| File | `src/app/api/projects/generate-image/route.ts` |
| Library | `generateDesignSystemFromImage()` in `src/lib/dashboard/vision-generate.ts` |
| Body | `{ image: dataUrl }` |
| Config | `dynamic = "force-dynamic"`, `maxDuration = 90` |
| Model | `NVIDIA_MODEL_VISION`, default `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`, temperature 0.4, `max_tokens` 6000 |
| Status | **Built, unproven** (no verify script exercises it) |

Client side, `generateFromImage` in `PromptBar.tsx` reads the file with `FileReader.readAsDataURL` and posts the data URL. It is reachable two ways: the paperclip input (which routes `.md` to upload and `image/*` here) and a dedicated "Screenshot" pill that only renders when `aiEnabled`.

Guardrails:

- 503 when no key is configured.
- 401 in strict SaaS mode without a session.
- Rate limited on the same AI limiters as everything else.
- MIME allowlist by regex on the data URL prefix: `^data:image\/(png|jpe?g|webp);base64,`. Anything else is 400.
- `MAX_DATA_URL = 8_000_000` characters, roughly a 6MB image once base64 encoded; over that is 413 with a human message.
- The vision prompt demands JSON only, in exactly the same shape as the text-prompt path, and it says "Extract the dominant colors you actually see", which is the important word: *see*, not invent.
- The response goes through the **same** `extractSpec` and `specToParts` as the text path, so it inherits every cap and every hex normalization. Zero colors throws "No colors could be read from the image."

`chat_template_kwargs: { enable_thinking: false }` is attached at the body root with a comment explaining it mimics Python's `extra_body`. Compare section 11.4: `chat.ts` nests the same flag *inside* an `extra_body` key, and those two cannot both be right.

### 7.3 Governance copilot

| Item | Value |
|------|-------|
| Route | `POST /api/wiki/governance/draft` |
| File | `src/app/api/wiki/governance/draft/route.ts` |
| Library | `draftComponentGovernance()` in `src/ai-lab/10-governance-copilot/draft.ts` |
| Prompts | `src/ai-lab/10-governance-copilot/prompt.ts` |
| UI | `src/components/wiki/GovernanceCopilotPanel.tsx`, applied through `ComponentGovernanceEditPanel.tsx` |
| Model | `parser` profile via `chatJsonWithProfile` |
| Verify | `npm run verify:governance-copilot` (skips gracefully with no key), `npm run verify:governance-e2e` |
| Status | **Shipped** |

The whole feature is defined by what it may write. `docs/GOAL2-GOVERNANCE-COPILOT.md` states it as a table:

| Field | Copilot | Source of truth |
|-------|---------|-----------------|
| Role (when to use) | may draft | human finalizes |
| Description (dos and donts) | may draft | human finalizes |
| Tokens, colors, CSS vars | read-only | repo scan |
| Source file path, exports | read-only | repo scan |
| Component variants and props | read-only | repo scan |

The system prompt enforces the same split: output exactly `{ role, description, rationale }`, "You may ONLY write governance (role plus usage rules). Never invent or change code facts", and "If scan context is provided, you may reference tokens/paths ONLY when they appear in that context." The user prompt embeds the scan facts under the header "read-only, do not contradict or invent beyond this", with `cssVarsUsed` capped at 12 and `colorsUsed` capped at 8.

`parseGovernanceDraft` is the response validator: must be an object, coerces the three fields to trimmed strings, and throws if both `role` and `description` came back empty. `rationale` exists purely for the human reviewer, which is a nice pattern: the model explains itself into a field that never ships to `DESIGN.md`.

Route guards: 503 when unconfigured (with a message telling you to add the key), `requireDocumentAccess` for upload doc refs, a 400 in strict SaaS mode when no upload doc ref was supplied at all, and 400s for missing `componentTitle`, `componentId`, or `prompt`.

Non-goals recorded in the doc, so nobody re-litigates them: no editing Figma, no mockup generation, no re-running scans from chat, no multi-turn memory across sessions, no auto-finalize without human review. The draft goes into an edit panel, a human reviews it against a live component preview and a `DESIGN.md` diff, and only then does it flow through finalize and `blocksmith pull`.

### 7.4 Extension capture ingest (vision)

| Item | Value |
|------|-------|
| Route | `POST /api/ingest/capture` |
| File | `src/app/api/ingest/capture/route.ts` |
| Library | `extractDesignMarkdownFromImages()` in `src/lib/ingest/capture.ts` |
| Config | `dynamic = "force-dynamic"`, `maxDuration = 60` |
| Models | `NVIDIA_MODEL_VISION` first if set, then `meta/llama-4-maverick-17b-128e-instruct`, `meta/llama-3.2-90b-vision-instruct`, `microsoft/phi-3.5-vision-instruct` |
| Status | **Partial** (works, and the Figma enrichment branch is narrowly scoped) |

Screenshots from the browser extension (Canva, Figma, Adobe, any tab) become a Style Reference `design.md` and flow through the existing upload pipeline. Limits: at most 4 images, each at most 6MB of base64, coerced to `data:image/png;base64,` when a bare base64 string is sent.

The governance-critical part is the truth precedence, stated in the file header: vision-extracted values are **visual estimates**, capture docs enter as previews and drafts, and they are "never auto-promoted into a lock". Enforcement is a machine-readable marker, `CAPTURE_DRAFT_MARKER = "<!-- blocksmith:capture-draft -->"`, which the wiki uses to show a review banner and which is stripped only when a human clicks Confirm in the source editor.

There is a second mode: pass `targetDoc` and the capture is appended to an existing document as a `## Supplemental Capture Evidence` section, prefixed with a note that the exact Figma tree values above remain authoritative. That mode requires write access and currently refuses any document whose `workspace-root` is not a `figma://` reference.

The response is deliberately explicit: `status: "draft"`, plus a `reviewUrl` pointing at the source view.

### 7.5 Parser assist

| Item | Value |
|------|-------|
| Library | `src/ai-lab/02-parser-assist/` (`needs-assist.ts`, `normalize.ts`, `resolve.ts`, `store.ts`) |
| Entry | `ensureParserAssist(docRef, rawMarkdown)`, called from `prepareDesignSystemDoc()` in `src/lib/clients/registry.ts` |
| Model | `parser` profile |
| Status | **Shipped** |

When an uploaded document is not recognizable as workspace-scan, comprehensive-wiki, or Apollo-structured markdown, an LLM normalizes the prose into structured tables the deterministic parser can read, and the result is cached on disk under a content hash. There is a self-heal ahead of every other gate: if the document is comprehensive-wiki markdown, any stale normalized rewrite is purged and the design system cache cleared, because a stale squashed rewrite must never shadow the doc-driven parser.

This is the same shape again: the model reshapes input so a deterministic component can do the real work. It never becomes the parser.

---

## 8. Vision describes, structure governs

`docs/FIGMA-IMPORT.md` states the rule in four words: **vision describes, structure governs.**

Restated in AI terms:

| | Vision (multimodal) | Structure (parsed or scanned) |
|---|---|---|
| Produces | Descriptions, roles, usage notes, imagery style, dos and donts, approximate values | Exact token values, file paths, export names, component props |
| Confidence | Estimate | Exact |
| May enter a lock | No | Yes |
| May be promoted without review | No | Yes, through the normal pipeline |
| Failure mode | Slightly wrong prose | Broken enforcement |

The reasoning, from the same doc: "Token *values* must stay structured (exact, governable, drift-ready). The *qualitative* wiki ... is best filled by a multimodal pass."

Where the boundary sits in code:

- `src/lib/ingest/capture.ts` puts vision output behind `CAPTURE_DRAFT_MARKER` and refuses to let it be treated as truth until a human confirms.
- The Figma enrichment branch of `/api/ingest/capture` appends vision output *below* the structured import with the literal note that "Exact Figma tree values above remain authoritative", and refuses any non-Figma target document.
- `docs/TESTING-FIGMA-FUSION.md` gives the acceptance criterion in one line: "Exact structure outranks visual estimates."
- `docs/DESIGN-FIRST-INGEST.md`: "capture docs are previews, scan facts stay authoritative", and with no vision key configured "structured import still succeeds honestly".
- The one place vision *does* produce token values, `generateDesignSystemFromImage`, is a green-field creation path. There is no structured truth for it to contradict, and the product it creates is an editable starter project, not a locked system.

### 8.1 What a violation looks like in a bug report

You will know the boundary has been crossed when a report reads like one of these:

- "I connected Figma, then captured a screenshot for extra notes, and the accent hex in my wiki changed." Vision overwrote structure.
- "`blocksmith.lock` contains a color that does not exist in my repo or my Figma file." A vision estimate reached a lock.
- "CI is failing on a token nobody added." Same, one step later.
- "The component's `Source` row points at a file that does not exist." A model wrote a path instead of copying one.
- "Rescanning the repo did not fix the wrong value." Vision output was persisted somewhere the deterministic pipeline does not overwrite.

All five are the same bug: an estimate acquired the authority of a fact. Triage them by finding which write path let vision-derived data past a validator, not by improving a prompt.

---

## 9. Prompt and context engineering

### 9.1 How tenant context is formatted

One function, `buildDesignContext`, produces the JSON described in section 3.2, and `formatDesignContextForPrompt` pretty-prints it with 2-space indentation. Pretty-printing costs tokens and buys reliability: these models follow structure in structured input noticeably better than in minified JSON, and the indentation makes the "PARSED TOKENS" block visually distinct from the raw markdown block that follows it.

Prompt assembly is consistently sectioned with delimiter headers, for example in `buildChromeUserPrompt`:

```
=== DETERMINISTIC SEMANTIC CHROME (hint) ===
=== PARSED TOKENS (authoritative hex, do not invent colors) ===
=== SOURCE MARKDOWN ===
```

The labels do work. `PARSED TOKENS` is marked authoritative, the semantic chrome is marked as a hint the model may improve on, and the raw markdown is marked as source. When the model has to reconcile a conflict it has an explicit priority order.

### 9.2 How context is budgeted

Budgets are per-call-site and hardcoded:

| Call site | Budget |
|-----------|--------|
| `buildDesignContext.overview` | 800 chars |
| `buildDesignContext.components` | 24 components, each description 200 chars |
| `buildDesignContext.surfaces` | 8 |
| `buildDesignContext.guidelines` | 6 dos, 6 donts |
| `buildDesignContext.agentGuideExcerpt` | 1200 chars |
| `approvedComponentTitles` (governed generate) | 24 titles, filtered to those starting with an uppercase letter |
| `compile-chrome.ts` markdown excerpt | 24,000 chars |
| `compile-ensemble.ts` markdown excerpt | 20,000 chars |
| `curate.ts` facts markdown | 40,000 chars, with a visible truncation marker |
| `curate.ts` facts JSON | 80 colors, 20 excluded components |
| governance copilot scan context | 12 CSS vars, 8 colors |
| user prompt, governed generate | 600 chars |
| user prompt, project create | 2000 chars |

Colors and typography are **never** truncated. That is a deliberate asymmetry: components can be sampled because the model only needs to know what kinds of things exist, but the color list is the palette the validator will check against, so a truncated palette would make the model's job impossible and the validator's job unfair.

### 9.3 When a design system is too large for the window

Today, honestly: **we truncate silently and hope.** There is no token counter anywhere in the repo, no context-length check, no chunking, no retrieval. The budgets above are character caps chosen by hand.

What actually happens to a system with 200 components:

- The prompt sees 24 of them. The governed agent is told to compose only from those 24, so it will not use component 25 even though the tenant approved it. The output is on-brand and under-uses the system.
- The color palette is complete, so drift scoring stays correct. This is the one thing truncation cannot break, and it is not an accident.
- If the source markdown exceeds 20,000 or 24,000 characters, the chrome compiler sees a prefix. Since design docs front-load their token tables, the prefix is usually the important part, but a doc that puts its Surfaces table at the end will compile worse. There is no warning.
- Curate is the only path that marks its truncation, with a `[…truncated…]` line.

Mitigations that exist today: the caches (a large system is expensive once, not every time), the fact that only 24 component *summaries* rather than component source are ever sent, and the validator being palette-complete.

Mitigations that do not exist: token accounting, adaptive budgets based on the model's context length, relevance-ranked component selection (send the components most likely relevant to *this* prompt instead of the first 24), chunked multi-pass curation for very large scans, and any user-visible signal that truncation occurred. All **Planned** at best. The relevance-ranked selection is the highest-value one and the smallest: the governed generator already has the user's prompt, and choosing 24 components by keyword overlap would beat "first 24" immediately.

### 9.4 Repeated technique notes

Worth internalising because they recur:

- **Show the deterministic answer to the model.** Both the chrome compiler and the ensemble refiner receive the semantic baseline as a labelled vote. It anchors the output and makes total failure rare.
- **Ask for JSON only, then parse defensively anyway.** Every JSON path has a tolerant extractor (`extractJsonFromModelText`, or `extractSpec` which additionally strips `<think>` blocks).
- **Ask for one fenced block, then extract defensively anyway.** `CODE_FENCE_RE` in `governed-generate.ts` falls back to the trimmed raw text when no fence is found.
- **Put the constraint in the system message and the content in the user message.** Every call site does this, which is what makes caching by `(doc, contentHash, prompt)` sound.

---

## 10. Cost, latency, and reliability

### 10.1 Cost

What we can state from the repo: there is **no metering, no usage accounting, and no per-tenant cost attribution anywhere in the codebase.** Nothing records tokens consumed. `TODO: verify` the actual per-call cost against the NVIDIA account, because the answer is not in this repository.

What exists instead is four cost *controls*:

1. **Output caps.** 1600 tokens for governed generate, 1800 for prompt-to-system, 4096 for the parser profile, 6000 for vision, 8192 for the chrome profile.
2. **Input caps.** The budgets in 9.2.
3. **Caches.** Governed generate caches for 10 minutes in memory. Scan curate caches on disk indefinitely, keyed by facts hash. Parser assist caches normalized markdown on disk by content hash. A repeated demo or a repeated scan of an unchanged repo costs nothing.
4. **Rate limits.** 10 AI calls per IP per hour, 40 per signed-in user per hour, by default.

The single largest cost lever is the ensemble. `NVIDIA_ENSEMBLE=1` multiplies chrome token spend by roughly three (two primaries plus a refiner) for one document. It is off by default for that reason as much as for latency.

The second largest is the `VERCEL` model downgrade, which quietly moves production off a 550B model.

### 10.2 Latency and timeouts

| Path | Client timeout | Server `maxDuration` | Observed |
|------|----------------|----------------------|----------|
| `POST /api/ai/governed-generate` | none set by the showcase | 120s | approximately 13.5s for two parallel calls |
| `POST /api/ai/layout` (hybrid) | 90s via `AbortController` | 120s | 30 to 90s per `docs/VISUALIZE-AND-API.md` |
| `POST /api/ai/layout` (ensemble) | 90s via `AbortController` | 120s | overlay warns up to 5 minutes |
| `POST /api/projects/create` | none | 60s | seconds |
| `POST /api/projects/generate-image` | none | 90s | seconds to tens of seconds |
| `POST /api/ingest/capture` | none | 60s | seconds to tens of seconds |
| Semantic Visualize (no LLM) | n/a | n/a | under 1s |

Two problems are visible in that table.

**The ensemble cannot finish inside its own budget.** The overlay tells users it may take 5 minutes. The client aborts at 90 seconds. The function is killed at 120 seconds. So on a document slow enough to need the ensemble, the ensemble will be killed and the user will keep semantic chrome. The path works locally, where `maxDuration` is not enforced. This is a genuine inconsistency and it is why `NVIDIA_ENSEMBLE` stays off in production.

**Client abort does not cancel server work.** No `AbortSignal` is threaded from the route into the OpenAI client anywhere in the repo. An abandoned refine keeps spending tokens until the function ends.

Only the governed-generate endpoint sits comfortably inside its budget, and that is precisely because it was designed backwards from the budget: fast models were chosen so that two parallel calls fit in 120 seconds.

### 10.3 Under load

Failure modes, in the order you will meet them:

1. **Rate limits bite first.** 10 per IP per hour is low. Behind a corporate NAT or a shared demo link, one enthusiastic room of people will exhaust it. Signed-in users get 40. The response is a clean 429 with `Retry-After`, and the showcase renders the static sample, so the user experience under limit is a fallback rather than an error.
2. **Provider rate limits next.** `chatWithModels` responds by walking its model list, then its key list. Two keys on one provider help with per-key quotas and not at all with a provider-wide outage.
3. **Serverless concurrency.** Every AI route is `nodejs` runtime with a long `maxDuration`, so each in-flight request pins a function instance for up to two minutes. This is the real scaling ceiling: it is concurrency-bound long before it is CPU-bound.
4. **Cold starts.** `maxDuration = 120` on governed generate exists partly to absorb them.
5. **Total provider failure.** Every surface degrades rather than breaking: governed generate returns 503 and the client shows the static sample; Visualize keeps semantic chrome; project create falls back to a starter; scan curate publishes raw facts; the governance copilot returns 503 and manual editing still works. There is no path where a dead provider produces a dead page. That property is worth defending in code review.

### 10.4 Where the in-memory state breaks

Two separate stories, and it is important not to conflate them.

**Rate limits: mostly solved.** `src/lib/cloud/rate-limit.ts` uses Upstash Redis fixed-window counters when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set, so limits hold across instances. Without Upstash it falls back to a per-process `Map`, which on a serverless deployment means the effective limit is roughly `limit x instances` and resets whenever an instance recycles. It also **fails open** on any Redis error, by design, so a Redis outage means no limits rather than no service. (The `governed-generate-live` memory note predates the Redis work and describes the limiter as in-memory; the code has since moved on.)

**The governed-generate result cache: not solved.** The `Map` in `src/lib/ai/governed-generate.ts` is per-process, full stop. Consequences on a multi-instance deployment:

- Cache hit rate falls to roughly `1/instances`. Ten instances means most "repeat" demos are cold, at full cost and full latency.
- A cache entry can outlive a design system edit on an instance that has not seen the edit. The `contentHash` in the key protects against this correctly, since a different content hash is a different key, so the risk is wasted memory rather than stale output. This is the payoff for putting `contentHash` in the key.
- `CACHE_MAX = 200` is per instance, so total memory is `200 x instances`.
- Nothing is shared with the CLI, MCP, or CI, which run in different processes entirely.

The fix is the same as the rate limiter's: move it to Redis or a Supabase table, keyed identically. It is tracked as P2 in `docs/GOAL-SAAS-STATUS.md` per the memory note. Until then, treat cache hits as an optimization that happens sometimes, never as a guarantee.

Similarly per-process or per-disk: the parser-assist normalized cache and the scan-curate cache both live on the filesystem under `blocksmithWritableRoot()`, and both are skipped entirely when `skipLocalScanAudit()` is true. On an ephemeral serverless filesystem they are effectively per-invocation.

---

## 11. Status table

| Capability | Path | Status | Evidence |
|------------|------|--------|----------|
| Governed vs ungoverned live generation | `src/lib/ai/governed-generate.ts`, `POST /api/ai/governed-generate` | **Shipped** | Live on `/demo/investor`; measured approximately 13.5s, drift 5 to 0 on identical model and prompt |
| Drift scoring shared with CI and MCP | `src/lib/governance/color-lint.ts` | **Shipped** | Imported by `scripts/validate-ui.ts`, `scripts/governance-gate.ts`, `src/mcp/handlers.ts`, `src/lib/governance/check-diff.ts` |
| Showcase static fallback and no-eval rendering | `src/components/demo/GovernedAiShowcase.tsx` | **Shipped** | 503 and error branches render `StaticSample`; code shown inside `<pre>` |
| Visualize semantic chrome (no LLM) | `src/lib/design-ir/semantic-resolve.ts`, `useVisualizeStyle` | **Shipped** | `npm run verify:design-ir` |
| Visualize single-pass AI refine (hybrid default) | `compile-chrome.ts`, `POST /api/ai/layout` | **Shipped** | Default path, documented in `docs/VISUALIZE-AND-API.md` |
| Visualize multi-agent ensemble | `compile-ensemble.ts` behind `NVIDIA_ENSEMBLE=1` | **Partial** | Works locally; exceeds the 90s client abort and 120s `maxDuration` in production |
| No-invented-token validation | `merge-ai-chrome.ts` | **Shipped** | Palette set check plus key allowlist |
| Legibility guardrails | `enforceChromeLegibility` in `color-utils.ts` | **Shipped** | WCAG math, runs on every merge |
| Scan curate (facts to designer prose) | `src/ai-lab/09-scan-curate/` | **Shipped** | Shape and hex-subset assertions; disk cache; falls back to raw facts |
| Governance copilot | `src/ai-lab/10-governance-copilot/`, `POST /api/wiki/governance/draft` | **Shipped** | `npm run verify:governance-copilot`, `npm run verify:governance-e2e` |
| Parser assist (normalize messy markdown) | `src/ai-lab/02-parser-assist/` | **Shipped** | `npm run ai-lab:normalize` |
| Font resolve | `src/ai-lab/05-font-resolve/` | **Shipped** | `npm run ai-lab:fonts` |
| Component preview renderers | `src/ai-lab/04-component-previews/` | **Shipped** | `npm run ai-lab:previews` |
| Design system from a text prompt | `POST /api/projects/create` | **Shipped** | Falls back to a starter project on any AI error |
| Design system from a screenshot | `POST /api/projects/generate-image` | **Built, unproven** | No verify script; reachable from the prompt bar |
| Extension capture ingest | `POST /api/ingest/capture` | **Partial** | Draft-marker lifecycle shipped; Figma enrichment limited to Figma-sourced docs |
| Prompt-bar model selector | `src/components/dashboard/PromptBar.tsx` | **Partial** | `selectedModel` is never sent; every generation uses the `parser` profile |
| Curated layout archetypes (demo page) | not built | **Planned** | P3 in `docs/VISUALIZE-ACCURACY-PLAN.md`, P2 in the `product-direction` memory note |
| Distributed governed-generate cache | not built | **Planned** | In-memory `Map`, per instance |
| Token accounting and adaptive context budgets | not built | **Idea** | No token counter exists anywhere in the repo |
| Sandboxed live preview of generated code | not built | **Idea** | Requires a cross-origin iframe with a strict CSP; explicitly not `eval` |

### 11.1 Known code-level defects found while writing this chapter

Recorded here so they are not lost:

1. **`extra_body` nesting is inconsistent and probably wrong in `chat.ts`.** `extraBodyForProfile()` returns `{ extra_body: { chat_template_kwargs: {...} } }` and that object is spread into the OpenAI SDK call. `extra_body` is a *Python* SDK convention for injecting extra body fields; the Node SDK has no such key, so it is sent to NVIDIA as a literal field named `extra_body`. Meanwhile `src/lib/dashboard/vision-generate.ts` sets `chat_template_kwargs` at the body root with a comment saying that is the right way. One of the two is not doing what its author intended, and the likely consequence is that `enable_thinking: false` is silently ignored on every `chat.ts` call.
2. **Unused import.** `src/ai-lab/01-ai-chrome/compile-ensemble.ts` imports `chatJsonWithProfile` and never uses it.
3. **`MAX_PROMPT_LEN` is duplicated.** 600 in `governed-generate.ts`, 600 again as `MAX_PROMPT` in `GovernedAiShowcase.tsx`. Export the constant.
4. **`.env.example` never lists `NVIDIA_API_KEY` on its own line**, only inside a comment about capture ingest.
5. **The prompt-bar model dropdown is inert** (section 7.1).
6. **Ensemble timeout budget is internally inconsistent** (section 10.2).

---

## Open questions

1. **What does an AI call actually cost us?** Nothing in the repo measures it. Before we price a plan we need per-call token counts and a per-tenant attribution story. Where should the meter live: a wrapper around `runChat`, or a provider-side report?
2. **Is `extra_body` doing anything?** Defect 1 above. If `enable_thinking: false` is being ignored, our JSON reliability is better than we think and our latency is worse. Someone should diff a request with and without it.
3. **Do we move the governed-generate cache to Redis, or drop it?** A 10-minute per-instance cache buys little in production. Either promote it to the Upstash layer the rate limiter already uses, or delete it and accept the cost, but the current middle state is the worst of both.
4. **Does the ensemble survive?** It cannot complete inside its own timeouts on Vercel. Either the primaries get fast enough to fit in 90 seconds, or the whole path becomes an offline or queued job, or we delete it and keep the hybrid single pass. Right now it is code that only runs on laptops.
5. **What replaces "first 24 components"?** Relevance ranking against the user's prompt is cheap and would immediately improve the governed generator on large systems. Is anything more sophisticated warranted, or is keyword overlap enough?
6. **How do we tell a user their system was truncated?** Today truncation is silent everywhere except curate. A tenant with 200 components has no way to know the generator only ever considered 24 of them.
7. **When do we build the sandboxed preview?** The showcase is materially weaker for showing code instead of a rendered component. The safe version is a real project. Is it worth doing before the archetype library?
8. **Should curate be allowed to reorder or rename sections?** It fills a fixed skeleton today. Loosening that improves prose quality and weakens `assertCuratedScanShape`. Where is the line?
9. **Does the shared color-lint engine need a perceptual distance metric?** `nearestToken` uses squared RGB distance. It is good enough to point an agent at the intended token, but "nearest" is shown to users as a prescriptive fix, and RGB distance disagrees with human perception often enough to be noticed.
10. **Is the second NVIDIA key real redundancy?** Two keys on one provider protect against per-key quota, not against a provider outage. If a provider outage during a customer demo is unacceptable, the no-second-vendor rule has to be revisited, and that is a founder decision.
11. **What is the cancellation story?** No route threads an `AbortSignal` into the provider client, so abandoned requests keep spending. Is that worth fixing before or after metering?

---

## Where to look in the code

**Provider and chat plumbing**
```
src/ai-lab/shared/nvidia-profiles.ts    profiles, keys, base URL, client factory
src/ai-lab/shared/chat.ts               chatWithModels, chatWithProfile, chatJsonWithProfile, chatJsonWithModel
src/ai-lab/shared/extract-json.ts       tolerant JSON extraction from model text
src/ai-lab/shared/load-doc.ts           doc loading for AI Lab steps
src/lib/ai/nvidia.ts                    deprecated shim over the profiles module
```

**Governed vs ungoverned demo**
```
src/lib/ai/governed-generate.ts             the service: two agents, drift scoring, cache
src/lib/ai/build-design-context.ts          buildDesignContext, formatDesignContextForPrompt
src/lib/governance/color-lint.ts            the shared drift engine
src/app/api/ai/governed-generate/route.ts   endpoint, access gate, rate limits, 503
src/components/demo/GovernedAiShowcase.tsx  client, fallback, no-eval rendering
src/components/demo/InvestorDemo.tsx        where the showcase is mounted
src/lib/ir/releases.ts                      packageNameForDoc
```

**Visualize and the layout ensemble**
```
src/lib/ai/generate-layout.ts               hybrid vs ensemble switch
src/lib/ai/layout-schema.ts                 Zod schema plus LAYOUT_SYSTEM_PROMPT
src/lib/ai/load-ensemble-doc.ts             doc plus markdown loader
src/lib/ai/resolve-design-doc.ts            validateDocRef
src/ai-lab/01-ai-chrome/compile-chrome.ts   single-pass compiler
src/ai-lab/01-ai-chrome/compile-ensemble.ts parallel primaries plus refiner
src/ai-lab/01-ai-chrome/prompt.ts           chrome and refiner prompts
src/ai-lab/03-visualize-status/messages.ts  user-facing status and warning copy
src/lib/design-ir/merge-ai-chrome.ts        the no-invented-tokens validator
src/lib/design-ir/color-utils.ts            WCAG math and enforceChromeLegibility
src/lib/design-ir/semantic-resolve.ts       deterministic chrome baseline
src/hooks/useVisualizeStyle.ts              instant pass, background refine, 90s abort
src/app/api/ai/layout/route.ts              refine endpoint
src/app/api/ai/status/route.ts              configured? which visualize mode?
src/components/wiki/VisualizeLoadingOverlay.tsx
```

**Wiki curate**
```
src/ai-lab/09-scan-curate/curate.ts     facts to markdown, gating, truncation
src/ai-lab/09-scan-curate/prompt.ts     the skeleton and the strict rules
src/ai-lab/09-scan-curate/validate.ts   shape, hex subset, inventory coverage
src/ai-lab/09-scan-curate/resolve.ts    cache, fallback to raw facts
src/ai-lab/09-scan-curate/store.ts      disk cache layout
src/lib/scan/run.ts                     the four-step publish order
src/lib/scan/inventory.ts               deterministic inventory re-append
```

**Product generation paths**
```
src/components/dashboard/PromptBar.tsx          all four client entry points
src/app/api/projects/create/route.ts            text prompt to design system
src/lib/dashboard/generate.ts                   extractSpec, specToParts, prompt path
src/app/api/projects/generate-image/route.ts    screenshot to design system
src/lib/dashboard/vision-generate.ts            vision model and prompt
src/app/api/ingest/capture/route.ts             extension capture ingest
src/lib/ingest/capture.ts                       vision models, draft marker, limits
src/app/api/wiki/governance/draft/route.ts      governance copilot endpoint
src/ai-lab/10-governance-copilot/draft.ts       draft service and response validator
src/ai-lab/10-governance-copilot/prompt.ts      what the copilot may and may not write
src/ai-lab/02-parser-assist/                    LLM normalization of messy markdown
src/lib/clients/registry.ts                     prepareDesignSystemDoc, loadDesignSystem
```

**Enforcement consumers of the same engine**
```
src/mcp/handlers.ts               validate_ui_code, check_governance_diff
src/lib/governance/check-diff.ts  tiered findings with fix suggestions
scripts/validate-ui.ts            the CI gate
scripts/governance-gate.ts        the commit gate
```

**Infrastructure**
```
src/lib/cloud/rate-limit.ts   Upstash-backed AI and scan limiters
src/lib/cloud/access.ts       requireDocumentAccess
src/lib/cloud/saas.ts         saasStrictMode
src/lib/auth/session.ts       getSupabaseUser
```

**Scripts**
```
npm run ai-lab:chrome     scripts/ai-lab/01-test-chrome.ts
npm run ai-lab:normalize  scripts/ai-lab/02-test-normalize.ts
npm run ai-lab:previews   scripts/ai-lab/04-test-previews.ts
npm run ai-lab:fonts      scripts/ai-lab/05-test-font-resolve.ts
npm run verify:design-ir           deterministic IR regression
npm run verify:governance-copilot  copilot, skips without a key
npm run verify:governance-e2e      draft to finalize to pull
```

**Docs**
```
src/ai-lab/README.md               build order, env, per-step test commands
src/ai-lab/manifest.ts             AI_LAB_STEPS status manifest
docs/VISUALIZE-ACCURACY-PLAN.md    the original statement of the core principle
docs/VISUALIZE-AND-API.md          hybrid pipeline, timings, endpoints
docs/GOAL2-GOVERNANCE-COPILOT.md   what the copilot may change
docs/PROJECT-PIPELINE.md           where the governed demo sits in the pitch
docs/FIGMA-IMPORT.md               "vision describes, structure governs"
docs/DESIGN-FIRST-INGEST.md        capture truth precedence
docs/TESTING-FIGMA-FUSION.md       "exact structure outranks visual estimates"
```
