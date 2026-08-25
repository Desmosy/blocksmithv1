# Product Spec — BlockSmith MVP

**Handshake:** [08-web-ide-handshake.md](./08-web-ide-handshake.md)

## Product promise (phased)

| Phase | Promise |
|-------|---------|
| **v0 (week 1)** | Human **knowledge base UI** from paste; blocks sync-ready (`status`, `contentHash`) |
| **v1** | **IDE → Web:** auto-updating KB from repo (watch + scan) |
| **v2** | **Web → IDE:** finalize wiki edits → repo files update |
| **v3** | **MCP** + conflicts; same blocks on web and in Cursor |

**One sentence:** Auto-updating design knowledge base for humans—with a two-way handshake so finalized changes in the wiki or IDE always show on both sides.

## User stories

### Design systems lead / PM (v0 — primary)

- As a human, I paste our agent design docs and get a wiki I can skim in minutes—not an afternoon in markdown.
- As a lead, I centralize workflows and component rules so the team has **one rendered source of truth** (same problem as internal wiki for a global product team).
- As a director, I judge taste and UX direction from navigable pages, not line 200 of `design.md`.

### Design engineer (v1+)

- As a dev, I run `blocksmith scan` so my component docs exist without writing Notion pages.
- As a dev, I open `localhost:3000/wiki` to browse tokens and components with examples.
- As a dev, I configure Cursor MCP so the model asks BlockSmith for Button rules instead of guessing.

### Agent (via MCP)

- When the user asks to build a settings page, the model calls `get_design_tokens` and `get_component_docs` for Card, Input, Button.
- When a new variant ships in code, the next MCP read returns updated variants.

### You (lab owner)

- As a builder, I record a 30s demo showing paste OR scan → wiki → Cursor using MCP.

---

## Modes of operation

### Mode 1 — Paste (DocuRender / week 1)

| Step | Behavior |
|------|----------|
| Input | User pastes markdown: CLAUDE.md, README, design notes |
| Action | “Generate Wiki” → AI extracts structure |
| Output | Wiki pages in block UI; export MD/HTML |

**Purpose:** Validates the thesis—**human render layer**—before MCP. Same block renderer as Mode 2.

**Inputs (prioritize):** `DESIGN.md`, `design.md`, `CLAUDE.md`, `AGENTS.md`, README, workflow notes.

### Mode 2 — Repo scan (BlockSmith / v0.1+)

| Step | Behavior |
|------|----------|
| Input | Files from configured repo root |
| Action | `blocksmith scan` parses files |
| Output | `.blocksmith/` generated blocks + wiki |

### Mode 3 — IDE → Web (auto-update, v1)

| Step | Behavior |
|------|----------|
| Trigger | Save in IDE on components, tokens, `DESIGN.md` |
| Action | Watcher → parse → update blocks → SSE to wiki |
| Output | Knowledge base refreshes without manual regen |

### Mode 4 — Web → IDE (finalize, v2)

| Step | Behavior |
|------|----------|
| Trigger | Human edits block in wiki, clicks **Finalize** |
| Action | Sync writes repo (`DESIGN.md` / overrides) |
| Output | IDE shows file change; MCP reads new rules |

### Mode 5 — MCP (IDE API, v3)

Same blocks as wiki; tools may trigger Mode 3 writes. See handshake doc.

---

## Inputs (scan targets)

| File / path | Extract |
|-------------|---------|
| `CLAUDE.md`, `AGENTS.md` | Agent rules, conventions |
| `DESIGN.md`, `README.md` | Product/design narrative |
| `components.json` | shadcn config |
| `tailwind.config.*` | Theme, colors, spacing |
| `tokens.json`, CSS variables | Design tokens |
| `src/components/**/*` | Props, variants, examples |
| Storybook stories (if present) | Usage examples |

**Config:** `blocksmith.config.ts` — include/exclude globs, component roots.

---

## Outputs

### Human wiki

- Sidebar: sections (Tokens, Components, Agent Rules, Workflows)
- Per component: variants, sizes, props table, code snippets, do/don’t
- Per token: name, value, usage
- Search (v0.2)

### Agent artifacts

- `agent-rules.md` (generated) — concise instructions for coding agents
- MCP resources mirroring blocks (JSON or markdown)

### Export

- Markdown bundle
- Static HTML (optional)
- Copy page as markdown

---

## Block model (conceptual)

Each **block** is a typed document fragment:

```ts
type BlockType =
  | "component"
  | "token"
  | "agent-rule"
  | "workflow"
  | "page"; // generic doc section

interface Block {
  id: string;
  type: BlockType;
  title: string;
  source: { file: string; line?: number };
  content: {
    summary?: string;
    props?: PropDef[];
    variants?: string[];
    examples?: CodeExample[];
    do?: string[];
    dont?: string[];
    agentHint?: string; // short line for MCP
  };
  updatedAt: string;
}
```

Wiki UI renders blocks; MCP returns serialized subsets.

---

## MCP tools (v0.1 → v0.2)

### v0.1 (ship with first MCP release)

| Tool | Description | Input | Output |
|------|-------------|-------|--------|
| `get_component_docs` | Docs for one or more components | `names: string[]` | Markdown or JSON blocks |
| `get_design_tokens` | Colors, spacing, typography | `category?: string` | Token list + usage |
| `list_components` | Discover available components | — | Name + one-line summary |

### v0.2

| Tool | Description |
|------|-------------|
| `generate_usage_example` | JSX snippet following rules |
| `check_ui_against_design_system` | Heuristic: unknown variants, raw hex vs tokens |
| `update_component_docs` | Regenerate block for path (after edit) |
| `get_agent_rules` | Full agent instruction bundle |

### Example Cursor prompts (docs for users)

- “What button variant should I use for a secondary action on the settings page?”
- “Generate a card using our design rules.”
- “Does this JSX violate our design system?”
- “Update docs for the new `ghost` button variant.”

---

## CLI (target UX)

```bash
npx blocksmith init      # config + .blocksmith/gitignore hints
npx blocksmith scan      # parse repo → blocks
npx blocksmith dev       # wiki on :3000 + MCP on stdio/SSE
npx blocksmith export    # static markdown/html
```

**Week 1 substitute:** `npm run dev` in app repo without published CLI.

---

## UI requirements (wiki app)

- Clean typography, sidebar nav, responsive
- Code blocks with copy
- “Source: `path/to/Button.tsx`” link
- Loading / error states for AI paste mode
- Empty state: “Run scan or paste docs”

**Bar:** Feels closer to a **product** doc site than a raw Vitepress tree.

---

## Non-goals (MVP)

- Multi-tenant SaaS, auth, billing
- Figma plugin (later)
- Full automated UI codegen from prompts (that’s experiment #2)
- Perfect AST for every framework (start: React + TS + shadcn)

---

## Acceptance criteria

### v0 done (thesis demo)

- [ ] Paste `DESIGN.md` + `CLAUDE.md` → wiki with sidebar, readable component/workflow pages
- [ ] A peer says they would **browse the wiki** rather than the pasted markdown for “what’s canonical”
- [ ] README + 30s GIF framed as: agent docs grow → humans need render layer
- [ ] Export MD/HTML works

### v1 done (IDE → Web)

- [ ] Save `Button.tsx` → wiki updates within seconds (no manual refresh)
- [ ] Scan sample shadcn repo → ≥5 component blocks

### v2 done (Web → IDE)

- [ ] Finalize do/don’t in wiki → `DESIGN.md` (or override) updated on disk
- [ ] IDE shows file diff after finalize

### v3 done (full handshake)

- [ ] MCP `get_component_docs` matches wiki for same `block.id`
- [ ] 30s demo: both directions in one recording
- [ ] Stale/conflict badges work

---

## Experiment overlap

| Experiment | Relationship to BlockSmith |
|------------|----------------------------|
| DocuRender | Paste mode + wiki UI |
| Design System Explainer | Subset of component block generation (do/don’t) |
| Prompt-to-UI | Separate app; link from lab site |
