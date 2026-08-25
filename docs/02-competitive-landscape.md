# Competitive Landscape & Wedge

**Thesis:** [00-thesis.md](./00-thesis.md) — agent `design.md` grows; humans need a **render layer**, not another generator.

## Summary

**Yes, companies exist in every adjacent bucket.** Most tools either (a) help humans collaborate on docs, (b) generate **more** agent-oriented markdown, or (c) sync design systems for designers—not **render** exploding agent docs into a wiki humans use for **direction**.

BlockSmith’s wedge: **auto-updating human knowledge base** with **web ↔ IDE handshake**—not static docs, not one-way MCP. Finalized changes appear on both surfaces.

---

## Category map

### 1. General documentation / wikis

**Examples:** GitBook, Notion, Confluence, Document360, Nuclino, Slite

**What they do well:** Collaboration, permissions, enterprise KB, Git sync (GitBook).

**Gap for you:** Not optimized for **component props**, **agent rules**, or **MCP query from Cursor**. Heavy product; you want a **thin layer**.

---

### 2. AI code documentation

**Examples:** DocuWriter.ai; research/tools like DocAgent, RepoDoc

**Focus:** APIs, Swagger, tests, repo-wide technical docs from **source code**.

**Gap for you:** Less focus on **design tokens**, **do/don’t**, **shadcn usage**, **CLAUDE.md / DESIGN.md** as first-class inputs.

---

### 3. Design system documentation

**Examples:** Zeroheight

**Focus:** Living style guides, Figma sync, team collaboration.

**Gap for you:** Often design-team-centric; weaker on **AI agent instructions** and **live MCP** during coding.

---

### 4. AI document / deck rendering

**Examples:** Gamma, Canva (prompt-powered design)

**Focus:** Beautiful output from plain text; presentations/marketing.

**Gap for you:** One-shot beautification, not **continuous sync from repo** or **Cursor integration**.

---

### 5. Workflow documentation

**Examples:** Scribe (record steps → doc)

**Focus:** SOPs, screenshots, process capture.

**Gap for you:** Different input (user actions vs **code + design files**).

---

### 6. Design.md / agent context generators

**Examples:** Context.dev Design.md Generator and similar

**Direction:** Extract design rules into **AI-readable** `design.md`.

**Your opposite / complement:**

```
Many tools:  design → design.md (for agents)
BlockSmith:  repo + docs → human wiki + agent rules (kept in sync)
```

---

## Positioning matrix

| Dimension | GitBook / Notion | Gamma | Zeroheight | BlockSmith |
|-----------|------------------|-------|------------|------------|
| Repo as source of truth | Partial | No | Partial | **Yes** |
| Component-level blocks | No | No | Yes | **Yes** |
| MCP for Cursor | No | No | No | **Yes** |
| Auto-update on code change | Manual | N/A | Manual | **Yes (goal)** |
| Agent instruction export | No | No | Limited | **Yes** |
| Local-first / dev tool | No | No | No | **Yes** |

---

## Wedge statement

**For product teams where agent documentation is growing faster than human oversight:**

> Paste or connect `CLAUDE.md` and design docs. BlockSmith renders a centralized wiki humans use for UX direction and taste—while structured blocks underneath stay agent-ready (and later sync via MCP).

**Not competing on:** longest `design.md`. **Competing on:** governable, browsable, trustworthy **UI** for the same truth.

---

## What not to claim

- “We replace Notion”
- “We generate all documentation from scratch”
- “We are the only AI doc tool”

## What to claim

- “Cursor stops hallucinating the wrong Button variant.”
- “Your CLAUDE.md and components stay one source of truth.”
- “Wiki blocks update when you ship a new prop.”

---

## Moat (honest, for a side project)

1. **Taste** in wiki UI and block layout
2. **Depth** on shadcn/Tailwind/Cursor stack
3. **MCP ergonomics** (tool names, responses tuned for codegen)
4. **Speed** of iteration vs enterprise vendors
5. **Community** (open CLI, examples, templates)

Moat is weak until usage; **shipping and demos** matter more than patents.

---

## Validation ideas (before big build)

1. Record Cursor session: without MCP vs with BlockSmith MCP on same prompt
2. Post in design-engineering / Cursor communities with 30s GIF
3. Ask 5 teams: “Where do agents read your design rules today?”
4. Compare output quality against raw `CLAUDE.md` paste into chat

---

## Strategic choice

| Strategy | Risk | Reward |
|----------|------|--------|
| Generic AI doc generator | High competition | Low differentiation |
| DocuRender only (paste wiki) | Easier ship | Commodity vs Gamma |
| **BlockSmith + MCP + auto-update** | Harder engineering | Strong 2026 story |

**Plan:** Ship DocuRender UX fast; **invest differentiation in MCP + scan + watch**.
