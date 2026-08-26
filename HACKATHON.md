# WebMCP Challenge — 10-day plan

**Repo:** `blockSmithv1` · **Live URL:** _TBD — deploy from this repo_ · **Deadline:** _confirm on Devpost_

Judges see three things: a live URL, a <3-minute video, and this repo. Every item below serves one of them.

---

## The thesis

> Agents generate UI that is plausible and wrong. Not wrong in ways a compiler catches — wrong in ways only a design system knows. BlockSmith makes the website itself the referee: it hands the agent the rules as executable tools, rejects what breaks them, and names the rule that was broken so the agent fixes it in the same turn.

Two claims underneath, both defensible:

1. **The rules aren't in the DOM.** Locked tokens, spacing scales, deviation budgets — none of it can be scraped or inferred from the rendered page. A tool is the *only* path to it. Most WebMCP entries expose a faster route to visible data; this exposes the only route to invisible data.
2. **The rules change, so the tools must too.** See below.

## The self-updating edge

WebMCP's known weak spot, in Chrome's own words: *"tool discoverability requires direct site visits."* Tools are registered statically by a page and go stale the moment the app changes underneath them.

BlockSmith is the rare case where that's already solved, because the design system is a living artifact:

- A repo scan or Figma sync changes the tokens → every tool's answers change with it
- Drift detection ("Figma says X, code says Y") means the system notices its own staleness
- Promotion/lock semantics in `blocksmith.registry.v1` version the truth the tools speak for
- The spec's `toolchange` event plus `AbortController` unregistration means the *tool surface itself* can change — components appear and disappear as the system evolves

Nobody else in this field will demo a tool surface that updates itself because the underlying truth moved. Build it explicitly and say it out loud.

---

## Day-by-day

### Days 1–2 · Governance depth
The engine has to catch what actually goes wrong, not just what's easy to catch.

- [x] Scale linting — spacing, font-size, radius off-scale detection
- [x] First preset (`portfolio.md`) authored and parsing
- [x] Tailwind class linting — `p-4`, `text-2xl`, `rounded-xl`, `bg-blue-500` *(agent)*
- [x] Prose-rule enforcement — gradients, shadows, pure #000/#fff, undeclared fonts *(agent)*
- [x] Second preset (`saas.md`) *(agent)*
- [x] Wire all three linters into `check_governance`
- [x] Consolidate: one `runGovernance(code, system)` returning all violation classes
- [x] Regression fixtures — compliant + non-compliant snippet per preset, asserted in CI

### Days 3–4 · The preset system
This is the product for anyone who doesn't already have a design system.

- [x] Third preset (`docs.md` or `landing.md`)
- [x] Preset picker UI — choose a system, see it rendered, adopt it
- [x] `use_preset` tool so an agent can adopt one mid-conversation
- [ ] Pulse codegen verified against each preset → real `@blocksmith/<preset>` package
- [x] Render a full example page per preset so the taste is visible, not just described
- [ ] Version the presets (`portfolio.v1`) through the existing registry semantics

### Days 5–6 · The live loop
The thing judges actually watch.

- [x] `apply_token_change` — agent mutates, page visibly updates, human confirms
- [x] `get_current_context` — which page/component the human is looking at
- [x] Dynamic registration — tools appear/disappear via `toolchange` as system state changes
- [ ] Governed vs ungoverned split view, same prompt, both results on screen
- [ ] Optimistic UI so the change lands instantly while the agent talks

### Day 7 · Capture
- [x] `capture_site_design({url})` with **`untrustedContentHint`**
- [x] Extraction validated against the presets as ground truth
- [x] Captured systems enter as drafts, never straight into a lock

### Day 8 · Hardening
- [x] Public route reachable with no auth wall, seeded
- [x] Every tool output verified under 1,500 chars
- [x] Errors are descriptive enough for an agent to self-correct
- [x] Mid-chain failure doesn't dead-end the agent
- [x] Evals written (`messages` + `expectedCall`) and passing
- [ ] Tested in DevTools → Application → WebMCP: registration, schemas, manual invoke
- [ ] Tested in ChatGPT's in-app browser end to end

### Day 9 · Ship
- [ ] Deploy to Vercel; live URL in README
- [ ] Register for the origin trial (Chrome 149) so plain Chrome works flagless
- [ ] Public GitHub repo, MIT badged in the About sidebar
- [x] README carries a literal `document.modelContext.registerTool({...})` block
- [ ] Rotate the Supabase service role key ⚠️ *still outstanding*

### Day 10 · Submit
- [ ] Video — <3 min, public YouTube, audio, opens on governed vs ungoverned
- [x] Text description covering all four required points
- [ ] Credentials on the form if anything is gated
- [ ] Submit with a day of buffer, not an hour

---

## Standing constraints

| Budget | Limit |
|---|---|
| Tool / parameter names | 30 chars |
| Parameter descriptions | 150 chars |
| Tool descriptions | 500 chars |
| **Tool output** | **1,500 chars** |

API is `document.modelContext` — never `navigator.modelContext`.

Annotations are not decoration: `readOnlyHint` on every read tool, **`untrustedContentHint` on `capture_site_design`** (it returns third-party content — a textbook injection vector).

## Language rule

✅ design system · tokens · rules · rejected · staging · production
❌ Design IR · blocks.v1 · ingest · official graph · draft vN

## Risk register

| Risk | Mitigation |
|---|---|
| Reads as a dev tool; judges aren't designers | Governed vs ungoverned split screen. Visual, instant, no jargon |
| Governance looks thorough but isn't | Days 1–2 exist entirely for this. Tailwind is the biggest hole |
| Preset taste is mediocre → everything downstream is | One preset excellent before three exist |
| Nothing deployed until late | Deploy on day 5 even if rough, then iterate |
| Scope creep from a 10-day product plan | Features can be removed after the hackathon; shipping cannot |

## Submission requirements (verbatim)

- [ ] Working live URL judges can open in ChatGPT's browser or Chrome with WebMCP enabled
- [ ] Text description: why the use case fits WebMCP · how it improves UX · what people+agents can now do that was hard before · how WebMCP was implemented
- [ ] <3-min public YouTube demo with audio
- [ ] Public repo with all source, assets, and run instructions
- [ ] Open source license, detectable in the About section
- [ ] Repo contains a visible `document.modelContext.registerTool({...})`
