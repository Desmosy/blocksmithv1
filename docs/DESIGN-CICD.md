# Design CI/CD — block versions & `blocksmith.lock`

**Category pitch:** Design CI/CD **complements** the BlockSmith wiki — Finalize in the wiki **is** the promote step; the wiki **is** the pipeline dashboard for humans.

**Coexistence:** Teams still scan, browse Featured/Styles, Visualize, and govern in the wiki. CI/CD adds **version numbers** and **`blocksmith.lock`** so agents cannot drift from what humans finalized.

**Full research brief (professors):** [RESEARCH-INFRA-DESIGN-IR-AND-CICD.md](./RESEARCH-INFRA-DESIGN-IR-AND-CICD.md)

**Related:** [BLOCKS-V1-SPEC.md](./BLOCKS-V1-SPEC.md) (interchange format) · [PITCH-AND-PRODUCT-MODEL.md](./PITCH-AND-PRODUCT-MODEL.md)

---

## One sentence

> Every design block has a **version**. Humans **promote** what is official in the wiki. Agents **pin** versions in `blocksmith.lock` — like `package-lock.json` for design.

---

## Why this exists

Code has CI/CD: build → artifact → promote → lock digest → deploy.

Design has scattered markdown, Figma, and agent context — **no pinned build**. Two agents on different days can follow different “latest” rules. Designers think the team agreed to v4 while Cursor still behaves like v3.

**Block versions + lock file** = design stops drifting.

---

## The pipeline (design CI/CD)

| Step | Code CI/CD | Design CI/CD (BlockSmith) |
|------|------------|---------------------------|
| 1. Trigger | `git push` | Scan, upload `.md`, governance edit |
| 2. **Ingest** | Checkout | Figma / repo / `DESIGN.md` → **Design IR** |
| 3. **Build** | `npm run build` | IR → wiki + `@blocksmith/<product>` (Pulse) |
| 4. **Test** | unit/e2e | Fidelity check, public block feedback (optional) |
| 5. **Staging** | preview env | **Draft** block (e.g. `button-primary` **v4**) in wiki |
| 6. **Promote** | merge / release | Human **Finalize** → v4 becomes official |
| 7. **Lock** | `package-lock` / image digest | **`blocksmith.lock`** updated |
| 8. **Deploy** | production | Agents + MCP + CI use **locked versions only** |

```
INGEST → BUILD → (TEST) → STAGING (draft) → PROMOTE (finalize) → LOCK → DEPLOY (agents)
```

Wiki = **pipeline dashboard** for humans.  
MCP + lock = **runtime** that only consumes approved artifacts.

---

## Block versions (simple)

Each block in the graph has an id and version history:

| Block id | Example |
|----------|---------|
| `button-primary` | Primary button — role, radius, colors, do/don’t |
| `surface-canvas` | Page background / elevation |
| `color-accent` | Accent hex + usage rules |
| `governance-nav` | Finalized prose rules |

| State | Meaning |
|-------|---------|
| **v3 finalized** | Official — agents and CI should use this |
| **v4 draft** | Edited in wiki — visible to humans, **not** for agents yet |
| **stale** | Repo changed; wiki or lock may need refresh |
| **conflict** | Wiki and repo disagree — human resolves |

### Story (concrete)

1. **Monday** — `button-primary` **v3**: 8px radius. Lock: `"button-primary": "v3"`. Agent builds a page → 8px.
2. **Tuesday** — Designer opens wiki, edits **v4 draft**: 12px radius. Lock **unchanged** → agents still use v3.
3. **Wednesday** — Team **Finalize** v4. Lock → `"button-primary": "v4"`. Next agent run uses 12px.

No silent drift between “what design agreed” and “what the agent did.”

---

## `blocksmith.lock` (sketch)

Lives in the customer repo (alongside `DESIGN.md`), updated on finalize / pull:

```json
{
  "schema": "blocksmith.lock.v1",
  "docRef": "upload:scan-acme-mobile-app.md",
  "contentHash": "a1b2c3d4",
  "blocks": {
    "button-primary": { "version": 4, "contentHash": "…" },
    "surface-canvas": { "version": 2, "contentHash": "…" },
    "color-accent": { "version": 1, "contentHash": "…" }
  },
  "package": {
    "name": "@blocksmith/acme-mobile-app",
    "pulseBuild": "2026-06-04T12:00:00Z"
  }
}
```

| Field | Purpose |
|-------|---------|
| `blocks.*.version` | Which promoted version agents must use |
| `contentHash` | Detect stale lock vs wiki/repo |
| `package` | Pin Pulse build tied to this lock |

**Agents and CI** read the lock — not “whatever markdown was in context.”

---

## Human vs agent roles

| Role | Job |
|------|-----|
| **Human** (designer / lead) | Edit drafts, **promote** via Finalize, resolve conflicts |
| **Agent** (Cursor / MCP) | Build UI against **locked** blocks + `@blocksmith/...` imports |
| **BlockSmith** | Runs ingest/build; hosts wiki; writes lock on pull/finalize |

---

## Implementation status

| Piece | Status |
|-------|--------|
| Draft / Finalize / Stale badges | ✅ partial (governance, handshake) |
| Per-block version integers in store | ⬜ planned |
| `blocksmith.lock` in repo on pull | ⬜ planned |
| MCP refuses draft versions | ⬜ planned |
| `validate_ui` against lock + package | ⬜ planned |

---

## Investor line

> **CI/CD for design truth:** ingest from code and docs, compile to blocks and importable UI, humans promote versions in the wiki, agents pin them in `blocksmith.lock`.

---

## Related

- [08-web-ide-handshake.md](./08-web-ide-handshake.md) — finalize writeback
- [BLOCKS-V1-SPEC.md](./BLOCKS-V1-SPEC.md) — what a block is on the wire
- [PHASE2-PULSE.md](./PHASE2-PULSE.md) — build artifacts
