# Roadmap

**Pitch:** [PITCH-AND-PRODUCT-MODEL.md](./PITCH-AND-PRODUCT-MODEL.md)  
**Thesis:** [00-thesis.md](./00-thesis.md)  
**Handshake:** [08-web-ide-handshake.md](./08-web-ide-handshake.md)

Phases: **KB UI** → **IDE → Web** → **Web → IDE** → **MCP** → lab portfolio.

---

## Phase 0 — Planning (now)

- [x] Vision, wedge, competitive map
- [x] MVP spec, architecture, 7-day sprint
- [ ] Confirm stack (Next.js + TS + shadcn)
- [ ] Create `examples/sample-repo` when coding starts

---

## Phase 1 — DocuRender slice (Days 1–7)

**Theme:** Prove thesis — humans can **direct UX** from rendered wiki, not raw agent markdown

| Item | Status |
|------|--------|
| Paste → AI structure → wiki | Planned |
| Export MD/HTML | Planned |
| Demo GIF + README | Planned |
| Lab landing stub | Optional |

**Exit criteria:** Public post + 10 outreach messages + working local demo.

---

## Phase 2 — IDE → Web (Weeks 2–3)

**Theme:** Auto-updating knowledge base from repo

| Week | Focus |
|------|--------|
| 2 | Sync engine stub, chokidar, scan → blocks, SSE to wiki |
| 3 | Component/token parsers; save in IDE → wiki updates live |

**Exit criteria:** Edit `Button.tsx` → wiki shows new variant without manual regen.

---

## Phase 3 — Web → IDE (Weeks 4–5)

**Theme:** Handshake other direction — human finalization hits repo

| Week | Focus |
|------|--------|
| 4 | Draft/finalize UI, writeback to `DESIGN.md` / overrides |
| 4.5 | **Governance copilot** — LLM drafts role + rules from prompt; preview + finalize + pull ([GOAL2-GOVERNANCE-COPILOT.md](./GOAL2-GOVERNANCE-COPILOT.md)) |
| 5 | Conflict + stale badges; loop prevention (`contentHash`) |

**Exit criteria:** Finalize do/don’t in wiki → file visible in IDE; copilot drafts governance without changing scan facts.

---

## Phase 4 — MCP + full handshake (Weeks 6–8)

**Theme:** IDE peer complete; same blocks as web

| Item | Priority |
|------|----------|
| MCP `get_component_docs`, `get_design_tokens`, `get_sync_status` | P0 |
| `blocksmith dev` = wiki + sync + MCP | P0 |
| Two-way demo video | P0 |
| MCP `check_ui_against_design_system` | P2 |

**Exit criteria:** 30s recording—IDE save → wiki AND wiki finalize → IDE file; MCP matches wiki.

---

## Phase 5 — Lab site + experiment #2 (Weeks 9–12)

**Theme:** Portfolio breadth

| Item | Notes |
|------|--------|
| Lab one-pager | Experiments, Notes, Demos, Contact |
| BlockSmith experiment page | Problem, GIF, learnings, links |
| **Prompt-to-UI Playground** | 3 visual variations from description; image/HTML, not full app codegen |
| Cross-link experiments | |

**Exit criteria:** 2 experiments documented on site; BlockSmith at v0.2.

---

## Phase 6 — Experiment #3 + polish (Months 4–5)

**Theme:** Design System Explainer depth

- Merge explainer features into component blocks (do/don’t, “use when”)
- `get_agent_rules` MCP tool
- Search in wiki
- Optional: commit generated blocks for CI static wiki

---

## Phase 7 — Growth (optional, month 6+)

Only if traction from outreach/posts:

| Idea | Notes |
|------|--------|
| `npx blocksmith` published package | |
| GitHub Action: scan on PR → comment diff on docs | |
| Figma tokens import | |
| Hosted sync (SaaS) | Defer until demanded |
| Templates: “shadcn + BlockSmith starter” | |

---

## Milestone timeline (visual)

```
Week 1        [KB UI — paste bootstrap]
Weeks 2-3     [IDE → Web auto-update]
Weeks 4-5     [Web → IDE finalize]
Weeks 6-8     [MCP + full handshake demo]
Weeks 9-12    [Lab site + Prompt-to-UI]
Month 4-5     [Explainer depth]
Month 6+      [Package, CI, optional SaaS]
```

---

## Decision gates

### Gate A (end of week 1)

**Proceed to scan if:** Wiki UI feels good and 3+ people responded to outreach.

**Pivot if:** AI structuring unreliable → manual sidebar JSON editor for week 2.

### Gate B (end of week 3)

**Proceed to Web → IDE if:** IDE save updates wiki reliably.

**Pivot if:** Watch too flaky → manual “Sync now” button first.

### Gate C (end of week 5)

**Proceed to MCP if:** Finalize writeback works; no sync loops.

### Gate D (end of week 8)

**Proceed to lab experiment #2 if:** Two-way handshake demo gets engagement.

**Else:** Double down on BlockSmith UX and outreach before second experiment.

---

## What “lab” means at each phase

| Phase | Public message |
|-------|----------------|
| 1 | “Knowledge base UI for design docs” |
| 2–3 | “Auto-updating KB—IDE changes show in wiki instantly” |
| 4–8 | “Web ↔ IDE handshake—finalize either side, same truth” |
| 9+ | “UI AI Lab experiments” |

---

## Resources to budget

- LLM API credits for paste mode (low volume)
- Domain (~$12/yr) when lab site goes up
- No infra cost for local MCP MVP
