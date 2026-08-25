# Experiments Backlog — UI AI Lab

**Thesis:** [00-thesis.md](./00-thesis.md) — all experiments serve **human direction** as agent documentation scales.

Three **tiny** experiments establish the lab; **BlockSmith** is the depth bet (render layer + source of truth). Each experiment shippable in 1–2 weeks max.

---

## Priority order

| # | Experiment | Role | Build when |
|---|------------|------|------------|
| 1 | DocuRender / DesignWiki | Week 1 demo; becomes BlockSmith paste mode | **Now** |
| 2 | BlockSmith (scan + MCP) | Flagship / differentiation | Weeks 2–8 |
| 3 | Prompt-to-UI Playground | Breadth, visual wow | Weeks 9–12 |
| 4 | Design System Explainer | Merge into BlockSmith component blocks | Weeks 9+ |

---

## 1. DocuRender (Design Doc Renderer)

### One-sentence problem

Agent-oriented `design.md` / `CLAUDE.md` is growing, but humans cannot steer UX from markdown alone—they need a rendered internal wiki.

### Core flow

1. Paste markdown
2. Click **Generate Wiki**
3. AI creates structured pages
4. App renders polished documentation site
5. User edits (later) and exports

### Inputs

- CLAUDE.md, AGENTS.md
- README, DESIGN.md
- Ad-hoc design notes, Figma export text

### Outputs

- Sidebar wiki
- Export Markdown / HTML

### Success metrics

- 30s demo understandable without explanation
- Export used at least once in dogfood

### Relation to BlockSmith

Same wiki UI and block schema; later input = **scan** instead of paste.

### Ship checklist

- [ ] Problem sentence on lab card
- [ ] Demo GIF
- [ ] Screenshot
- [ ] What I learned (3 bullets)
- [ ] GitHub + live/local instructions

---

## 2. BlockSmith (live wiki + MCP)

See [03-product-spec-mvp.md](./03-product-spec-mvp.md) and [04-architecture.md](./04-architecture.md).

### One-sentence problem

AI coding tools generate UI that ignores your real components, tokens, and agent rules.

### Core flow

1. `blocksmith init` in repo
2. `blocksmith scan`
3. Browse `localhost:3000/wiki`
4. Cursor uses MCP for component/token queries
5. Code change → blocks auto-update (v0.2)

### “What I learned” prompts (fill after ship)

- Did MCP actually reduce wrong variants in Cursor?
- What was hardest to parse—cva, props, or markdown rules?
- Would teams commit `.blocksmith/` or regenerate in CI?

---

## 3. Prompt-to-UI Playground

### One-sentence problem

Product ideas start as words, not Figma—teams need fast **visual** exploration before build.

### Core flow

1. User describes a screen (e.g. “Dashboard for travel startup: visa status, flights, tasks”)
2. System generates **3 polished UI variations** (layout + typography + color)
3. User compares, picks direction, exports image or HTML reference

### Explicit non-goals

- Not full production codegen
- Not replacing engineering implementation
- Not a Figma competitor

### Technical sketch

- LLM → structured layout JSON (sections, components, copy)
- Render with HTML/CSS or React preview templates
- Optional: tie to BlockSmith tokens if MCP/config present

### Success metrics

- Variations look **product-grade**, not generic bootstrap
- Under 60s generation time perceived

### Ship checklist

Same as experiment 1 lab card format.

---

## 4. Design System Explainer

### One-sentence problem

Component docs and tokens exist but engineers still misuse variants.

### Core flow

1. User pastes component docs or design tokens
2. App outputs:
   - “Use this button when…”
   - “Do not use this variant when…”
   - Examples gallery
   - React usage snippets

### Merge strategy

Do **not** build a separate long-lived app if BlockSmith component blocks cover:

- `do` / `dont` arrays
- `agentHint` for MCP
- Usage examples from scan

Ship as **BlockSmith feature** + lab card: “Design System Explainer powered by scan.”

---

## Lab card template (copy per experiment)

```markdown
## [Experiment Name]

**Problem:** [one sentence]

![Demo](./assets/experiment-name.gif)

**What I learned**
- ...
- ...
- ...

[Live demo](#) · [GitHub](#)
```

---

## Content calendar (suggested)

| Week | Public output |
|------|----------------|
| 1 | DocuRender demo post |
| 4 | “BlockSmith scans your repo” post |
| 8 | Cursor + MCP screen recording |
| 10 | Prompt-to-UI teaser GIF |
| 12 | “UI AI Lab” recap with 3 cards |

---

## Icebox (ideas, not scheduled)

- Figma plugin → push tokens to BlockSmith
- VS Code extension (non-Cursor)
- Violation linter in CI
- Notion import
- Multi-repo design system monorepo support
