# Research infrastructure — Design IR & Design CI/CD

**Audience:** Academic mentors, research collaborators, thesis reviewers.  
**Scope:** The **research layer** of BlockSmith / UI AI Lab — not the wiki product alone.

**Companion docs:** [BLOCKS-V1-SPEC.md](./BLOCKS-V1-SPEC.md) (technical sketch) · [DESIGN-CICD.md](./DESIGN-CICD.md) (pipeline summary) · [PITCH-AND-PRODUCT-MODEL.md](./PITCH-AND-PRODUCT-MODEL.md) (full product context)

**Student:** Koshish · **Project:** BlockSmith (UI AI Lab) · **Production demo:** https://blocksmith-mocha.vercel.app

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [How research infra fits the product](#2-how-research-infra-fits-the-product)
3. [The research problem](#3-the-research-problem)
4. [Design IR — the protocol layer](#4-design-ir--the-protocol-layer)
5. [Same protocol across platforms](#5-same-protocol-across-platforms)
6. [Design CI/CD — the pipeline layer](#6-design-cicd--the-pipeline-layer)
7. [How IR and CI/CD work together](#7-how-ir-and-cicd-work-together)
8. [Open research questions](#8-open-research-questions)
9. [Implementation status & roadmap](#9-implementation-status--roadmap)
10. [How a professor can help](#10-how-a-professor-can-help)
11. [Glossary](#11-glossary)

---

## 1. Executive summary

### What we are researching

Two coupled systems:

| Layer | Name | Role | Analogy |
|-------|------|------|---------|
| **Protocol** | **Design IR** (`blocksmith.blocks.v1`) | Canonical **intermediate representation** for UI design truth | TCP/IP for design packets |
| **Pipeline** | **Design CI/CD** | **Version, promote, lock, deploy** design blocks for humans and agents | GitHub Actions + `package-lock.json` for design |

### One paragraph

Teams increasingly maintain design documentation for **AI coding agents** (`DESIGN.md`, `CLAUDE.md`, agent rules). These files help machines but overwhelm humans, and **agents still drift** from official design decisions. BlockSmith ships a **design wiki** (scan → browse → govern) as the human-facing product. The **research contribution** is underneath: a published **interchange format** (Design IR) so Figma, code scans, and markdown all compile to **one block graph**, and a **CI/CD pipeline** so humans **promote** block versions in the wiki while agents **pin** them in `blocksmith.lock` — the same semantic contract transmitted to **web apps, agent tools, and (eventually) embedded devices** via different compile targets.

### What is hardest (research view)

1. **Design CI/CD** — closed loop: ingest → build → draft → promote → lock → enforce under continuous change  
2. **Block versions** — artifact model inside that pipeline  
3. **Growing agent documentation** — ingest adapters must keep up with new template formats  
4. **IR protocol design** — minimal schema that survives multi-source ingest  
5. **Cross-platform compile** — same meaning on web, agent API, and device without semantic loss  

---

## 2. How research infra fits the product

BlockSmith is **not** “wiki **or** protocol.” It is **wiki plus protocol**.

```
┌─────────────────────────────────────────────────────────────────┐
│  PRODUCT (what teams use daily)                                  │
│  · GitHub scan → design wiki (Featured, Styles, components)      │
│  · Visualize, governance edit, Finalize, blocksmith pull           │
│  · API keys, MCP, org ownership (SaaS on Vercel + Supabase)      │
└────────────────────────────┬────────────────────────────────────┘
                             │ reads/writes
┌────────────────────────────▼────────────────────────────────────┐
│  RESEARCH INFRA (what this document describes)                   │
│  · blocksmith.blocks.v1 — Design IR graph                        │
│  · Ingest adapters (scan, md, future: Figma, Storybook)          │
│  · Compile targets (wiki, Pulse npm pkg, MCP, device)            │
│  · Design CI/CD — versions, blocksmith.lock, validate_ui         │
└─────────────────────────────────────────────────────────────────┘
```

| Surface | User | Powered by |
|---------|------|------------|
| Wiki pages | Designer, PM, lead | IR compiled to `wiki` target |
| `@blocksmith/<product>` package | Engineer, agent | IR compiled to `pulse-react` target |
| MCP tool responses | Cursor / agents | IR compiled to `mcp` target + lock file |
| Watch / HMI preview (planned) | Embedded teams | IR compiled to `device-sim` / `lvgl` target |
| `blocksmith.lock` in repo | CI, agents | CI/CD promote step |

**The wiki is the human console for the pipeline.** Finalize in the wiki = **promote** in CI/CD. The professor’s help on IR + CI/CD directly strengthens the product’s foundation without replacing the wiki.

---

## 3. The research problem

### 3.1 Agent documentation explosion

Product teams add ever-longer files for AI tools: design tokens, component rules, workflow notes, do’s/don’ts. Agents tolerate flat markdown; **humans cannot govern** from it at scale.

### 3.2 Multiple incompatible sources

| Source | Typical content |
|--------|-----------------|
| **Repository (code)** | Real components, CSS variables, exports — *visual truth* |
| **Figma** | Intent, exploration — often diverges from shipped code |
| **Markdown / agent templates** | Governance prose — grows without structure |
| **Notion / wikis** | Human docs — rarely machine-enforceable |

No single format. **Drift** between what design agreed, what code ships, and what the agent read Tuesday vs Thursday.

### 3.3 No software-style lifecycle for design truth

Code has: build, test, release, **lockfile**, deploy, rollback.

Design has: edit a doc, hope the team reads it, hope the agent remembers.

**Research claim:** Design truth needs the same **artifact lifecycle** as code dependencies — especially now that **agents are builders**.

### 3.4 Cross-platform gap

The same product may need:

- Web dashboard (React)  
- Mobile or embedded UI (C / LVGL)  
- Agent-generated screens (MCP + imports)  

Today each surface is redesigned separately. **Research goal:** one **semantic** design spec, many **physical** runtimes.

---

## 4. Design IR — the protocol layer

### 4.1 Definition

**Design IR** (Intermediate Representation) is a **canonical, versioned graph of design blocks** — the neutral format between *sources* (ingest) and *targets* (compile).

- **Not** a wiki UI  
- **Not** a Figma file  
- **Not** raw `DESIGN.md`  
- **Is** the **packet** every tool converts to/from  

**Spec name:** `blocksmith.blocks.v1` (working title; open publication planned).

### 4.2 Why “protocol” and not “database”

Like TCP/IP:

- **TCP/IP** does not own email or the web; it defines **how packets are shaped** so any link layer can carry them.  
- **Design IR** does not own Figma or React; it defines **how design blocks are shaped** so any ingest adapter and compile target can interoperate.

**Strategic intent:** Publish the spec; BlockSmith wiki + SaaS is the **reference implementation** that dogfoods it first.

### 4.3 Block — atomic unit

Each block is one addressable piece of design truth.

```ts
interface BlocksmithBlockV1 {
  id: string;                    // e.g. "button-primary"
  type: "component" | "token" | "guideline" | "agent-rule" | "page";
  title: string;
  version: number;                 // monotonic per id; promoted on Finalize
  status: "draft" | "finalized" | "stale" | "conflict";
  source: {
    file: string;
    line?: number;
    ingest?: "scan" | "figma" | "paste" | "storybook";
  };
  content: Record<string, unknown>;  // type-specific payload
  updatedAt: string;
  contentHash: string;           // sha256 of canonical content
  finalizedAt?: string;
  editedBy?: "web" | "ide" | "mcp" | "ingest";
}
```

**Examples:**

| Block id | type | content (conceptual) |
|----------|------|----------------------|
| `color-accent` | token | `{ hex: "#d97757", cssVar: "--accent", role: "CTA" }` |
| `button-primary` | component | `{ role, radius, variants, scanMeta, doDont[] }` |
| `governance-cta-density` | agent-rule | `{ rule: "Max one primary CTA per view" }` |

### 4.4 Graph container

```ts
interface BlocksmithGraphV1 {
  schema: "blocksmith.blocks.v1";
  docRef: string;        // e.g. upload:scan-acme-app.md
  systemId: string;
  contentHash: string;   // hash of full graph
  blocks: BlocksmithBlockV1[];
}
```

**Reference storage (BlockSmith today):** `.blocksmith/blocks/<id>.json`, `.blocksmith/index.json`  
**Hosted storage (SaaS):** Supabase markdown + derived parse; graph materialization in progress.

### 4.5 Ingest adapters (into IR)

Adapters **only write IR**. They never write directly to wiki or Pulse.

| Adapter | Input | IR output | Status |
|---------|-------|-----------|--------|
| `scan` | GitHub / local repo walk | component, token blocks from code facts | ✅ implemented |
| `markdown` | Upload / paste comprehensive wiki md | page, token blocks | ✅ implemented |
| `governance` | Finalize / pull from wiki | guideline, agent-rule blocks | ✅ partial |
| `figma` | Figma API / tokens export | token, component stubs | ⬜ planned |
| `storybook` | stories + props | component blocks | ⬜ planned |
| `tokens-studio` | token JSON | token blocks | ⬜ planned |
| `agent-template` | `CLAUDE.md`, `AGENTS.md` chunks | agent-rule blocks | ⬜ research |

**Conflict rule:** If Figma accent ≠ scan accent, both values land in IR with `status: "conflict"` until a human resolves in the wiki (promote one).

### 4.6 Truth precedence (when sources disagree)

| Kind of fact | Authority |
|--------------|-----------|
| Paths, exports, hex from **code scan** | Ingest from repo until re-scan |
| **Governance** (when/how to use) | Finalized wiki block wins over draft |
| Cross-source **token mismatch** | `conflict` state; human resolves |
| **Agent execution** | **Locked** finalized versions only — never draft |

---

## 5. Same protocol across platforms

This section answers: *How does one protocol transmit across web, agents, and hardware?*

### 5.1 Core principle

> **Same semantics, different syntax.**

The **protocol on the wire** is always `blocksmith.blocks.v1` (JSON graph).  
Each **platform** runs a **compile target** that maps blocks to local forms.

This is identical in structure to:

- **LLVM IR** → x86, ARM, WASM backends  
- **Protobuf** → generated stubs per language  
- **OpenAPI** → server + many client SDKs  

We are **not** copying React `import` syntax onto a microcontroller. We are copying **block IDs, versions, tokens, and rules**.

### 5.2 Architecture diagram

```
                         ┌──────────────────────┐
                         │  blocksmith.blocks.v1 │
                         │  (Design IR graph)      │
                         │  + version per block    │
                         └───────────┬────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
         ▼                           ▼                           ▼
  ┌─────────────┐            ┌─────────────┐            ┌─────────────┐
  │ wiki target │            │ pulse-react │            │ mcp target  │
  │ HTML/CSS    │            │ npm package │            │ JSON tools  │
  │ human UX    │            │ import {}   │            │ for Cursor  │
  └─────────────┘            └─────────────┘            └─────────────┘
         │                           │                           │
         ▼                           ▼                           ▼
   Designer browser            Next.js / React app          AI coding agent
         
         ┌───────────────────────────┴───────────────────────────┐
         ▼                                                           ▼
  ┌─────────────┐                                            ┌─────────────┐
  │ device-sim  │                                            │ lvgl / c    │
  │ canvas frame│                                            │ header gen  │
  │ 240×240 etc │                                            │ (future)    │
  └─────────────┘                                            └─────────────┘
         │                                                           │
         ▼                                                           ▼
   Watch / HMI preview                                         Embedded firmware
```

### 5.3 What is identical on every platform

| Field | Web | Agent (MCP) | Device |
|-------|-----|-------------|--------|
| Block id `button-primary` | ✅ | ✅ | ✅ |
| Version `v4` (from lock) | ✅ | ✅ | ✅ |
| Accent token `#d97757` | ✅ | ✅ | ✅ |
| Rule “max one CTA per view” | ✅ | ✅ | ✅ (as constraint) |
| `contentHash` for staleness | ✅ | ✅ | ✅ |

### 5.4 What differs per platform (compile target)

| Platform | How the team *uses* the same block | Example |
|----------|-------------------------------------|---------|
| **Web (Pulse)** | JavaScript import + CSS variables | `import { Button } from "@blocksmith/acme"` + `tokens.css` |
| **Wiki** | Rendered pages, governance editor | Component page for `button-primary` v4 |
| **Agent (MCP)** | JSON tool payload + lock file | `get_design_tokens({ blockId, version: 4 })` |
| **CI** | Lock file + validator | `blocksmith.lock` → `validate_ui(pr)` |
| **Device simulator** | Canvas render with constraints | 240×240 frame, min 44px touch |
| **Device firmware (future)** | Generated C/LVGL structs | `BS_TOKEN_ACCENT 0xD97757`, widget defs |

### 5.5 Worked example — one block, three platforms

**IR block (source of truth):**

```json
{
  "id": "button-primary",
  "type": "component",
  "version": 4,
  "status": "finalized",
  "content": {
    "radius": "12px",
    "accentVar": "--color-accent",
    "governance": "Primary CTA only; max one per viewport"
  },
  "contentHash": "sha256:abc…"
}
```

**Compile to web (`pulse-react`):**

```tsx
import { Button } from "@blocksmith/acme-app";
// Button reads --color-accent, border-radius 12px from tokens.css
```

**Compile to agent (`mcp`):**

```json
{
  "blockId": "button-primary",
  "version": 4,
  "rules": ["Primary CTA only", "max one per viewport"],
  "tokens": { "accent": "var(--color-accent)", "radius": "12px" }
}
```

**Compile to device (`device-sim` / future `lvgl`):**

```json
{
  "widget": "btn_primary",
  "cornerRadius": 12,
  "fillColor": "#d97757",
  "minTouchMm": 44,
  "labelMaxLines": 1
}
```

**Same block. Same version. Same governance intent. Different emitter.**

### 5.6 Why cross-platform transmission helps

| Stakeholder | Benefit |
|-------------|---------|
| **Design lead** | Change rule once in wiki → promotes vN → **all surfaces** pick it up after lock |
| **Web engineer** | Imports package compiled from same IR as wiki |
| **Agent** | Cannot invent accent hex — must use locked token block |
| **Embedded engineer** | Gets token table + widget constraints from **same** graph, not a separate PDF |
| **Organization** | One audit trail: block id + version + contentHash |

Without IR: four documents drift.  
With IR: one graph, many compilers — **the protocol is what travels**, not PDFs or screenshots.

### 5.7 Device honesty (research scope)

**Phase 1 (thesis-demonstrable):** Browser **device simulator** — proves semantic compile without firmware risk.  
**Phase 2:** Export `tokens.h` / LVGL descriptors — generated artifacts, human integrates.  
**Phase 3:** OTA update of design blocks on hardware — industry partner territory.

We claim **semantic portability**, not “flash any `.md` to any chip day one.”

---

## 6. Design CI/CD — the pipeline layer

### 6.1 Definition

**Design CI/CD** is the **operational lifecycle** for blocks in Design IR:

```
INGEST → BUILD → (TEST) → STAGING → PROMOTE → LOCK → DEPLOY → (ROLLBACK)
```

Mapped to BlockSmith:

| Pipeline stage | BlockSmith mechanism |
|----------------|----------------------|
| **Ingest** | GitHub scan, upload `.md`, future Figma adapter |
| **Build** | Parse → `BlocksmithGraphV1` → compile wiki + Pulse |
| **Test** | Fidelity score, public block feedback (optional) |
| **Staging** | `status: "draft"`, higher `version` number in wiki |
| **Promote** | Human **Finalize** in wiki |
| **Lock** | Write `blocksmith.lock` to repo on pull |
| **Deploy** | MCP + agents + CI read lock only |
| **Gate** | `validate_ui` fails PRs that violate locked blocks (planned) |
| **Rollback** | Promote previous version N-1; lock reverted |

### 6.2 Block versions

Each `id` has a monotonic `version` integer.

| State | Wiki shows | Lock file | Agents use |
|-------|------------|-----------|------------|
| v3 finalized | Official v3 | `button-primary: 3` | v3 |
| v4 draft | Preview v4 | still v3 | still v3 |
| v4 finalized | Official v4 | `button-primary: 4` | v4 |

**Promote** is a **human gate** — equivalent to merging to `main` or tagging a release.

### 6.3 `blocksmith.lock`

Lives in customer repository (next to `DESIGN.md`):

```json
{
  "schema": "blocksmith.lock.v1",
  "docRef": "upload:scan-acme-mobile-app.md",
  "contentHash": "graph-hash-…",
  "blocks": {
    "button-primary": { "version": 4, "contentHash": "block-hash-…" },
    "surface-canvas": { "version": 2, "contentHash": "…" },
    "color-accent": { "version": 1, "contentHash": "…" }
  },
  "package": {
    "name": "@blocksmith/acme-mobile-app",
    "pulseBuild": "2026-06-04T12:00:00Z"
  }
}
```

**Purpose:**

- Agents pin **exact** block versions — not “latest markdown”  
- CI detects **stale** lock when `contentHash` ≠ wiki graph  
- Links **Pulse package build** to promoted graph state  

### 6.4 Why CI/CD is the hardest research piece

It is **distributed systems behavior**:

- Concurrent writers (wiki human, repo engineer, agent builder)  
- Partial failure (finalize OK, pull failed, lock stale)  
- Long-running agent sessions holding old versions  
- Re-scan invalidating scan-derived blocks without wiping governance  
- Serverless hosting (no local file watcher) — pipeline must be **explicit**, not filesystem-driven  

IR without CI/CD is a **file format**.  
IR **with** CI/CD is **infrastructure**.

---

## 7. How IR and CI/CD work together

```
┌─────────────── INGEST ADAPTERS ───────────────┐
│ scan · markdown · figma · agent-templates      │
└────────────────────┬──────────────────────────┘
                     ▼
            Design IR graph
         (blocks.v1 + versions)
                     │
       ┌─────────────┼─────────────┐
       ▼             ▼             ▼
   wiki compile  pulse compile  mcp compile
       │             │             │
       └─────────────┼─────────────┘
                     ▼
              Human reviews in wiki
                     │
              Draft v(N+1) ──► Finalize (PROMOTE)
                     │
                     ▼
            blocksmith.lock updated
                     │
       ┌─────────────┴─────────────┐
       ▼                           ▼
  Agent reads lock            CI validate_ui
  builds @blocksmith/pkg      fails off-brand diffs
```

**IR answers:** *What is the shape of design truth?*  
**CI/CD answers:** *Which version is official, and who is allowed to execute against it?*

---

## 8. Open research questions

Suitable for thesis chapters, papers, or guided research:

### Representation (IR)

1. What is the **minimal** block type system that covers tokens, components, and governance without becoming a full UI language?  
2. How should **conflicts** be represented when ingest sources disagree?  
3. How does the schema **evolve** (`blocks.v1` → `v2`) without breaking locks?

### Synchronization (CI/CD)

4. What consistency model fits design: **eventual** (re-scan) vs **strong** (finalize barrier)?  
5. How to detect and repair **stale** blocks when repo changes but governance does not?  
6. Can lockfile semantics mirror **npm lockfile** formal properties (deterministic resolve)?

### Agents

7. Does version pinning reduce measurable **fidelity drift** in agent-generated UI?  
8. What is the right **enforcement** boundary: MCP advisory vs CI blocking?  

### Cross-platform compile

9. What **semantic invariants** must every compile target preserve (contrast, touch target, governance rules)?  
10. How to quantify **loss** when compiling IR → device constraints?  

### Scale

11. As agent template files grow unbounded, what **ingest** strategy preserves human oversight (chunking, block boundaries, summarization without inventing truth)?  

---

## 9. Implementation status & roadmap

### 9.1 Current (reference implementation)

| Component | Status |
|-----------|--------|
| Repo scan → markdown → wiki parse | ✅ Production SaaS |
| Block types in code (`src/lib/blocks/types.ts`) | ✅ Full IR types in `src/lib/ir/types.ts` |
| Governance finalize → pull | ✅ Finalize promotes + rewrites lock; pull delivers lock |
| Pulse compile (`pulse-react` target) | ✅ v0 local |
| MCP tools | ✅ Lock-enforced + `get_lockfile`, `get_block_versions` |
| Design IR published JSON Schema | ✅ `public/schema/blocksmith.blocks.v1.json` + lock schema + `examples/graphs/` |
| Per-block `version` + history | ✅ Version registry (`src/lib/ir/registry.ts`): ingest/promote/rollback/conflict/stale |
| `blocksmith.lock` generation | ✅ `src/lib/ir/lock.ts` — deterministic build, verify, `/api/v1/lock`, pull payload |
| MCP enforce lock (reject draft) | ✅ Agents read official versions only (`src/lib/ir/enforce.ts`) |
| `validate_ui` CI gate | ✅ `scripts/validate-ui.ts` + `.github/workflows/validate-ui.yml` (lock staleness + off-token diff) |
| `device-sim` compile target | ✅ `src/lib/ir/targets/device-sim.ts` + `/demo/device` + `tokens.h` emitter (Phase 2) |
| Figma / Storybook ingest | ⬜ Planned |

**Closed-loop proof:** `npm run verify:ir-cicd` exercises ingest → stage → promote → lock → enforce → rollback → device compile end-to-end.

### 9.2 Suggested research roadmap (~6 months)

| Phase | Research deliverable |
|-------|---------------------|
| **R1** | Formalize `blocks.v1` JSON Schema + 3 example graphs |
| **R2** | Version model + `blocksmith.lock` spec + reference writer on finalize/pull |
| **R3** | MCP reads lock only; case study measuring agent drift with/without lock |
| **R4** | Second compile target (`device-sim`) from same graph |
| **R5** | Evaluation: small team using wiki + lock for 2 weeks; fidelity / conflict metrics |

### 9.3 Relationship to product roadmap

Product (wiki SaaS) and research (IR + CI/CD) **ship together**:

- Wiki **Finalize** button = CI/CD **Promote** UI  
- Pulse package = CI/CD **Build** artifact  
- Professor collaboration on **lock + schema** unblocks agent enforcement demos  

---

## 10. How a professor can help

| Expertise | Contribution |
|-----------|--------------|
| **Programming languages / compilers** | IR schema design, compile target invariants, semantics preservation proofs |
| **Distributed systems** | Lockfile model, stale/conflict detection, consistency |
| **Formal methods** | Version promotion rules, state machine for block lifecycle |
| **HCI / empirical** | User study: does CI/CD framing reduce team/agent drift vs markdown-only? |
| **Software engineering** | Compare to package managers, infrastructure-as-code, GitOps analogies |
| **Writing** | Thesis structure, related work (OT, CRDT, design tokens, agent tooling) |

**Concrete starter tasks:**

1. Review draft JSON Schema for `BlocksmithBlockV1`  
2. Critique `blocksmith.lock` vs npm lockfile / Nix / SPDX  
3. Define evaluation metrics for “agent fidelity to design”  
4. Co-author workshop paper: *Design IR as interchange for human–agent UI systems*  

---

## 11. Glossary

| Term | Meaning |
|------|---------|
| **Design IR** | Intermediate representation — canonical block graph (`blocksmith.blocks.v1`) |
| **Block** | Atomic unit of design truth (token, component, rule, page) |
| **Ingest adapter** | Compiler **into** IR from a source format |
| **Compile target** | Compiler **out of** IR to a platform (wiki, Pulse, MCP, device) |
| **Design CI/CD** | Versioned pipeline: promote human truth, pin agent truth |
| **Promote / Finalize** | Human approves draft block version → official |
| **`blocksmith.lock`** | Repo file pinning block id → version for agents/CI |
| **Pulse** | BlockSmith’s `pulse-react` compile target → `@blocksmith/<product>` |
| **MCP** | Model Context Protocol — how Cursor/agents call BlockSmith tools |
| **Reference implementation** | BlockSmith wiki + SaaS — dogfoods the open spec |

---

## References (internal)

| Document | Content |
|----------|---------|
| [00-thesis.md](./00-thesis.md) | North star |
| [BLOCKS-V1-SPEC.md](./BLOCKS-V1-SPEC.md) | Protocol sketch |
| [DESIGN-CICD.md](./DESIGN-CICD.md) | Pipeline summary |
| [04-architecture.md](./04-architecture.md) | Block store in codebase |
| [08-web-ide-handshake.md](./08-web-ide-handshake.md) | Web ↔ IDE sync |
| [PHASE2-PULSE.md](./PHASE2-PULSE.md) | `pulse-react` target |
| [PITCH-AND-PRODUCT-MODEL.md](./PITCH-AND-PRODUCT-MODEL.md) | Product + infra coexistence |

---

*Document version: 1.0 — research infrastructure brief for academic collaboration. Last updated June 2026.*
