# WebMCP Challenge — build checklist

**Repo:** `blockSmithv1` · **Live URL:** _TBD_ · **Deadline:** _confirm on Devpost_

Judges see: a live URL, a <3-min video, and this repo. Everything below serves one of those three.

---

## 0 · Pre-flight (blocking, do first)

- [ ] **Rotate the Supabase service role key.** ⚠️ *Yours to do — Supabase dashboard.* The old `BlockSmith` repo's history contains it (`ccda3df`, `d25b1bc`). Service role bypasses RLS entirely.
- [x] Fresh repo with clean history — no leaked key
- [x] `LICENSE` = MIT, all workspace packages MIT
- [ ] Strip internal strategy docs (`docs/constitution/`, pitch scripts, competitive landscape)
- [ ] `npm install` + `npm run build` green in the new folder
- [ ] Push to a **public** GitHub repo; confirm GitHub's About sidebar badges it **MIT**
- [ ] Claim Vercel credits — code `OAIWEBMH-9E2F-MUT4` (first 1000)

---

## 1 · The thesis

> **BlockSmith turns any website's design into a skill your coding agent can use** — and gives the agent governance tools that reject the components that violate it.

Every submission gives agents *more power*. This one gives them **boundaries**. Chrome's own security docs say consent and trust patterns are unsolved; we have a working answer.

**Never say on camera:** "Design IR", "blocks.v1", "ingest", "official graph".

---

## 2 · Hard constraints (from Chrome's security guide)

| Budget | Limit |
|---|---|
| Tool / parameter names | 30 chars |
| Parameter descriptions | 150 chars |
| Tool descriptions | 500 chars |
| **Tool output** | **1,500 chars** |

- [ ] Every tool return value verified under 1.5K
- [ ] `skills.md` / `design.md` delivered via **summary + link**, never in a tool result
- [ ] API is `document.modelContext` — **not** `navigator.modelContext`

---

## 3 · Architecture

- [ ] `src/lib/webmcp/registry.ts` — single source of truth for tool defs (name, description, schema, annotations, server handler). Both transports import it so they cannot drift.
- [ ] `src/app/api/webmcp/invoke/route.ts` — server dispatch into `src/mcp/handlers.ts`
- [ ] `src/hooks/useWebMcp.ts` — registers on mount, `AbortController` unregisters on unmount
- [ ] `src/components/webmcp/WebMcpTools.tsx` — mounts tools, exposes support state
- [ ] Remote MCP server (`src/lib/mcp/blocksmith-server.ts`) refactored to read the same registry

---

## 4 · The six tools

Chrome's guidance: one function per tool, each costs context and latency. Six, not fifteen.

| Tool | Annotation | Does |
|---|---|---|
| `get_current_context` | `readOnlyHint` | What page/component the human is looking at |
| `list_components` | `readOnlyHint` | Components in the active design system |
| `check_governance` | `readOnlyHint` | Validate code → violations + the compliant fix |
| `explain_violation` | `readOnlyHint` | Rule behind a violation, registered only when violations exist |
| `capture_site_design` | **`untrustedContentHint`** | Any URL → design summary. Third-party content — flag is mandatory |
| `export_skill` | `readOnlyHint` | Emit `skills.md` (summary + link; mind the 1.5K cap) |
| `apply_token_change` | *write* | Mutates the visible page, behind the existing confirm gate |

- [ ] Verbs distinguish doing from starting (`apply_*` mutates, `start_*` opens a flow)
- [ ] Natural-language params (`component="Button"`, not `component_id=42`)
- [ ] Errors are descriptive enough for the model to self-correct
- [ ] UI visibly updates after every write — this *is* the demo

---

## 5 · Judge access

- [ ] **Public demo route, no auth wall**, seeded project — one click to a working tool
- [ ] Landing copy explains it in 10 seconds
- [ ] If auth is used anywhere, credentials go on the submission form
- [ ] Works in ChatGPT's in-app browser (native WebMCP)
- [ ] Works in Chrome via `chrome://flags/#enable-webmcp-testing`
- [ ] Register for the **origin trial** (Chrome 149) so plain Chrome works without the flag

---

## 6 · Testing

- [ ] DevTools → **Application → WebMCP**: all tools registered, schemas valid, manual `Run tool` passes for each
- [ ] Evals written (`messages` + `expectedCall`) — catches "agent picked the wrong tool", invisible to manual testing
- [ ] Full journey rehearsed end-to-end in ChatGPT's browser
- [ ] Mid-chain failure handled gracefully (tool errors don't dead-end the agent)
- [ ] *Stretch:* Cloudflare Browser Run `navigator.modelContextTesting` for CI regression

---

## 7 · Submission artifacts

- [ ] **Live URL** reachable by judges
- [ ] **Video** — public YouTube, **under 3 minutes**, with audio
  - [ ] Opens on governed vs ungoverned, side by side
  - [ ] States what was built + how WebMCP was implemented
  - [ ] Shows the agent getting *rejected* and self-correcting
- [ ] **Public repo** with source, assets, and run instructions
- [ ] MIT license visible in the GitHub About section
- [ ] README shows a literal `document.modelContext.registerTool({...})` block
- [ ] **Text description** covering all four required points:
  - [ ] Why this use case fits WebMCP
  - [ ] How it makes for a better UX
  - [ ] What people + agents can do together that was hard/impossible before
  - [ ] How WebMCP was implemented

---

## 8 · Scoring edges

- [ ] Security story told explicitly — `untrustedContentHint` on third-party capture, `readOnlyHint` split, human-in-the-loop on writes
- [ ] Tool list is tight and readable
- [ ] One 60-second surface over deep machinery — judges spend minutes, not hours
- [ ] Something visibly changes on screen while the agent works
