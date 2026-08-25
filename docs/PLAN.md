# BlockSmith / UI AI Lab — Master Plan

**Handshake:** [08-web-ide-handshake.md](./08-web-ide-handshake.md)

---

## Thesis (short)

Agent `design.md` grows; humans need an **auto-updating knowledge base** they can understand—not static markdown.

**BlockSmith = KB (web) ↔ workspace (IDE):** two-way sync. Change code or docs in Cursor, or **finalize** direction in the wiki—**both sides show the same truth.**

---

## Executive summary

| Piece | What |
|-------|------|
| **Product** | Auto-updating design-system knowledge base for humans |
| **Web** | Rendered wiki—browse, understand, finalize rules |
| **IDE** | Repo + Cursor MCP—implement, agent execution |
| **Handshake** | IDE → Web (watch/scan); Web → IDE (finalize writeback) |
| **Week 1** | Wiki UI + block schema (`status`, sync-ready) |
| **Weeks 2–8** | Watch, finalize, MCP, conflict UI |

**Pitch:**  
*An auto-updating knowledge base for your design system—web and IDE always in sync.*

---

## Goals

| Horizon | Goal |
|---------|------|
| **Week 1** | Human KB UI from paste; blocks ready for sync |
| **Weeks 2–3** | **IDE → Web** auto-update (watch + scan) |
| **Weeks 4–5** | **Web → IDE** finalize writeback |
| **Weeks 6–8** | MCP + conflicts + handshake demo |
| **Lab** | Case study + experiments on site |

---

## Positioning

See [01-vision-and-positioning.md](./01-vision-and-positioning.md).

- **Is:** Auto-updating KB + web ↔ IDE handshake—not a one-shot doc renderer
- **Not:** Static wiki, one-way MCP read-only, Notion clone

**Ship message (full):**  
*Finalize a rule in the wiki or ship a component in Cursor—your team sees the same design truth on both sides.*

**Ship message (week 1):**  
*Paste design docs, get the knowledge base UI—we’re wiring live sync next.*

---

## Wedge

```
Static design.md  →  drift, no human oversight
One-way MCP       →  agents OK, humans lost
BlockSmith        →  auto-updating KB + web ↔ IDE handshake
```

---

## Build order (respect handshake phases)

### Week 1 — Web KB shell

Paste → blocks → wiki. Schema includes `status`, `contentHash`, `updatedAt`.

### Weeks 2–3 — IDE → Web

Watcher, scan, SSE to wiki. **KB auto-updates from repo.**

### Weeks 4–5 — Web → IDE

Finalize in wiki → write `DESIGN.md` / overrides. **Human direction lands in repo.**

### Weeks 6–8 — MCP + polish

Same blocks in Cursor; `get_sync_status`; conflict UI; 30s two-way demo.

**Do not skip week 1 quality**—the web surface is what humans trust before they believe sync.

---

## MVP

See [03-product-spec-mvp.md](./03-product-spec-mvp.md).

**Handshake acceptance:**

- [ ] IDE save → wiki updates
- [ ] Wiki finalize → repo file updates
- [ ] MCP matches wiki for same block ID

---

## Architecture

[04-architecture.md](./04-architecture.md) — sync engine, block store, SSE, MCP invalidation.

---

## 7-day sprint

[05-sprint-7-day.md](./05-sprint-7-day.md) — add block `status` + stub `/sync` page Day 1.

---

## Roadmap

[06-roadmap.md](./06-roadmap.md)

---

## Success metrics

- Team opens **wiki daily** for direction (not raw markdown)
- Recorded demo: IDE change → wiki; wiki finalize → IDE file
- “We have one source of truth” — design + eng agree

---

## Next step

1. [08-web-ide-handshake.md](./08-web-ide-handshake.md)  
2. Day 1: blocks with `status` + sync route stub  
3. Week 2: chokidar IDE → Web before MCP marketing
