# `blocksmith.blocks.v1` — Design IR protocol (sketch)

**Analogy:** TCP/IP for **packets**; **`blocksmith.blocks.v1`** for **design truth**.

**Coexistence:** This spec does **not** replace the BlockSmith **wiki**, handshake, Visualize, or governance UI. Those are **first-class surfaces**. Design IR is the **shared graph** underneath so wiki pages, MCP responses, Pulse packages, and `blocksmith.lock` all mean the same thing.

**Pitch:** We publish the **interchange format**; BlockSmith wiki + SaaS is the **reference product** that dogfoods it.

**Full research brief (professors):** [RESEARCH-INFRA-DESIGN-IR-AND-CICD.md](./RESEARCH-INFRA-DESIGN-IR-AND-CICD.md)

**Related:** [DESIGN-CICD.md](./DESIGN-CICD.md) · [PITCH-AND-PRODUCT-MODEL.md](./PITCH-AND-PRODUCT-MODEL.md)

---

## One sentence

> Any tool (Figma, Storybook, repo scan, `DESIGN.md`) **compiles into** one block graph; any target (wiki, React package, device profile, agents) **compiles out** — **one IR, many targets, no competing truths.**

---

## The TCP/IP mental model

| Internet | Design stack |
|----------|----------------|
| Apps (browser, email) | Wiki, Pulse, agents, LVGL |
| **TCP/IP** (shared packet format) | **`blocksmith.blocks.v1`** (shared block graph) |
| Ethernet, Wi‑Fi, fiber | Figma, Storybook, scan, markdown **ingest adapters** |

We do **not** need to own every design tool. We define what the **middle packet** looks like so everything meets there.

```
  Figma ──────┐
  Storybook ──┼── INGEST ──→  blocks.v1  ── COMPILE ──→  Wiki
  Repo scan ──┤   (adapters)   (Design IR)   (targets)     Pulse pkg
  DESIGN.md ──┘                                              MCP tools
                                                               Device sim
```

**Figma is an input compiler, not a competing database.**

---

## What is Design IR?

**IR** = intermediate representation = canonical JSON graph of design blocks.

- Not how Figma stores a file  
- Not how your repo stores `Button.tsx`  
- Not raw markdown  

It is the **neutral ground** where sources merge and targets read.

---

## Block object (v1 sketch)

Aligns with [04-architecture.md](./04-architecture.md) and `src/lib/blocks/types.ts`. **Planned** fields marked ⬜.

```ts
interface BlocksmithBlockV1 {
  /** Stable id, e.g. "button-primary" */
  id: string;
  type: "component" | "token" | "guideline" | "agent-rule" | "page";
  title: string;

  /** Monotonic per id — promoted on Finalize ⬜ */
  version: number;

  status: "draft" | "finalized" | "stale" | "conflict";
  source: { file: string; line?: number; ingest?: "scan" | "figma" | "paste" };

  content: {
    /** Type-specific payload — tokens, role, do/dont, scan meta, agentHint */
    [key: string]: unknown;
  };

  updatedAt: string;       // ISO-8601
  contentHash: string;       // sha256 of canonical content
  finalizedAt?: string;
  editedBy?: "web" | "ide" | "mcp" | "ingest";
}
```

### Graph container

```ts
interface BlocksmithGraphV1 {
  schema: "blocksmith.blocks.v1";
  docRef: string;           // e.g. upload:scan-acme-app.md
  systemId: string;
  contentHash: string;
  blocks: BlocksmithBlockV1[];
}
```

**On disk (reference impl):** `.blocksmith/blocks/<id>.json`, `.blocksmith/index.json`

---

## Ingest adapters (inputs)

| Source | Adapter (status) | Compiles to |
|--------|------------------|-------------|
| Repo workspace scan | ✅ `scanWorkspace` | component + token blocks |
| Paste / upload `.md` | ✅ parsers | page + token blocks |
| `DESIGN.md` / governance pull | ✅ finalize path | guideline / agent-rule blocks |
| Figma API | ⬜ planned | token + component stubs |
| Storybook | ⬜ planned | component blocks |
| Tokens Studio | ⬜ planned | token blocks |

**Rule:** adapters **only write IR**. They do not talk to the wiki or Pulse directly.

---

## Compile targets (outputs)

| Target | Consumer | Status |
|--------|----------|--------|
| `wiki` | Humans | ✅ |
| `pulse-react` | `@blocksmith/<slug>` npm package | ✅ v0 local |
| `mcp` | Cursor tools (`get_design_tokens`, …) | ✅ lock-enforced (official versions only) |
| `blocksmith.lock` | Repo pin file | ✅ `src/lib/ir/lock.ts` · `/api/v1/lock` · pull payload |
| `device-sim` | Watch/HMI browser frame | ✅ `/demo/device` · `npm run compile:device` |
| `lvgl` / `c-header` | Embedded export | ✅ `tokens.h` emitter (`src/lib/ir/targets/c-header.ts`) |

**Compile API (concept):**

```
POST /compile
{ "graph": BlocksmithGraphV1, "target": "pulse-react" | "wiki" | "device-sim" }
→ artifacts + hashes
```

Reference route today: `POST /api/v1/codegen/pulse` (Pulse target only).

---

## Conflict & truth rules

1. **Scan facts** (paths, exports, hex from code) — ingest wins until re-scan.  
2. **Governance** (role, do/don’t) — finalized wiki blocks win over draft.  
3. **Cross-source disagreement** (Figma hex ≠ scan hex) — IR marks `conflict`; human resolves in wiki.  
4. **Agents** — read **lock file** versions only, never draft.

---

## Versioning & lock (CI/CD layer)

See [DESIGN-CICD.md](./DESIGN-CICD.md).

- Humans **promote** `version` on Finalize  
- `blocksmith.lock` pins `{ blockId → version, contentHash }`  
- Pulse package build id optional in lock  

---

## Open spec roadmap

| Milestone | Deliverable |
|-----------|-------------|
| **v0** | Internal schema in repo + architecture doc ✅ |
| **v1 alpha** | Published JSON Schema (`public/schema/blocksmith.blocks.v1.json`, `…lock.v1.json`, served at `/schema/…`) + example graph in `examples/graphs/` ✅ |
| **v1 beta** | Ingest table + compile target registry documented |
| **v1 stable** | Third-party ingest adapter guidelines |

BlockSmith remains the **reference stack** that dogfoods the spec first.

---

## Category names (pick one in decks)

- **Design IR** / **Design control plane**  
- **Compiled design systems**  
- **Block-native UI** (cloud-native, but for interface truth)

---

## Investor paragraph

> Design truth is trapped in incompatible tools. We publish **`blocksmith.blocks.v1`** — the interchange format — and ship BlockSmith as the reference pipeline: ingest anything, compile to wiki and importable UI, version blocks like CI/CD artifacts, pin them in `blocksmith.lock` so agents never drift. We own the protocol layer; the product proves it works.

---

## Related

- [04-architecture.md](./04-architecture.md) — block store in monorepo
- [00-thesis.md](./00-thesis.md) — north star
- [PHASE2-PULSE.md](./PHASE2-PULSE.md) — `pulse-react` target
