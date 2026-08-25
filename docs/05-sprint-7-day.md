# 7-Day Sprint — DocuRender → BlockSmith Foundation

**Thesis:** [00-thesis.md](./00-thesis.md) — agent docs grow; **week 1 proves the human wiki layer.**

First public ship: **paste `CLAUDE.md` + `DESIGN.md` → rendered documentation UI** your team can browse for direction. Architect so repo scan + MCP plug into the same blocks in week 2+.

**Optimize for:** wiki typography, navigation, and calm product feel—not feature count.

---

## Day 1 — Foundation & name

**Outcomes**

- [ ] Confirm product name: **BlockSmith** (repo) + lab label for site
- [ ] Initialize project (Next.js or Vite + React + Tailwind + shadcn)
- [ ] Draft `Block` TypeScript types in `lib/blocks/types.ts`
- [ ] Stub landing: hero + “Experiments coming soon”
- [ ] `docs/` planning committed (this repo)

**Deliverable:** Runnable dev server + empty wiki layout with sidebar shell.

**Block schema checklist** (handshake-ready — [08-web-ide-handshake.md](./08-web-ide-handshake.md))

- `id`, `type`, `title`, `source`, `content`, `updatedAt`, `contentHash`
- `status`: `draft | finalized | stale | conflict`
- Types: `component | token | agent-rule | workflow | page`
- Stub `/sync` page: “IDE ↔ Web sync — coming week 2”

---

## Day 2 — Paste & preview

**Outcomes**

- [ ] `/paste` route: large textarea + “Preview markdown”
- [ ] Markdown preview panel (react-markdown or similar)
- [ ] Save raw paste to session/localStorage for reload

**Deliverable:** User can paste README/CLAUDE.md and see rendered markdown side-by-side.

**Do not yet:** AI structuring (Day 3).

---

## Day 3 — AI structure extraction

**Outcomes**

- [ ] “Generate Wiki” button → API route calls LLM
- [ ] Prompt returns `Block[]` JSON (validated with Zod)
- [ ] Map blocks to sidebar nav structure
- [ ] Error/loading states

**Deliverable:** Paste → click → structured pages list (titles in sidebar).

**Prompt design notes**

- Ask for: pages, sections, components mentioned, workflows, token tables
- Require valid JSON only; retry on parse failure

---

## Day 4 — Wiki UI

**Outcomes**

- [ ] Sidebar navigation from block index
- [ ] Page templates: generic page, component-ish (props list stub), agent rules
- [ ] Typography, spacing, code blocks, copy button
- [ ] Route: `/wiki/[blockId]`

**Deliverable:** Feels like a small internal doc site, not raw markdown.

---

## Day 5 — Export

**Outcomes**

- [ ] Export wiki as single Markdown file or zip
- [ ] Optional: static HTML export (print-friendly)
- [ ] “Copy page” per block

**Deliverable:** User can take wiki out of the app.

---

## Day 6 — Demo & polish

**Outcomes**

- [ ] Seed demo content (sample CLAUDE.md + component notes)
- [ ] Fix top 3 UI papercuts
- [ ] Record **30-second** screen demo (paste → generate → browse → export)
- [ ] Screenshot for README and future lab site

**Deliverable:** `demo.gif` or linked video in README.

---

## Day 7 — Launch & outreach

**Outcomes**

- [ ] README: problem, demo, how to run locally
- [ ] Post on X + LinkedIn (lead with tool, not “lab”)
- [ ] DM or email **10** design engineers / founders with personalized line + link
- [ ] Optional: minimal lab landing page with one experiment card

**Post template (adapt)**

> Built a small tool: paste messy design docs (CLAUDE.md, README, notes) → get a structured internal wiki. Trying ideas at the intersection of AI + product UI. Demo: [link]

**Deliverable:** 10 conversations started; 1 public post.

---

## Daily time budget (suggested)

| Day | Hours (flex) |
|-----|----------------|
| 1–2 | 3–4h |
| 3–4 | 4–6h (hardest) |
| 5–7 | 3–4h |

---

## Stretch (if ahead)

- Start `scan` on a local folder (no AI) — one component parser proof
- MCP hello-world server returning static Button doc

---

## Definition of sprint success

1. A human (you or a peer) prefers the **wiki** over raw pasted markdown for finding “what’s canonical”
2. Live demo: paste agent design docs → generate → browse sidebar wiki
3. GIF + README framed with thesis (agent docs grow → render for humans)
4. Block schema committed; ready for week 2 scan/MCP per [06-roadmap.md](./06-roadmap.md)

---

## After day 7 — immediate next tasks

1. `blocksmith init` + config file
2. Scan `src/components` in example repo
3. MCP `get_component_docs` wired in Cursor
4. File watcher for one component file
