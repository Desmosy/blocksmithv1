# Team north star — wiki as control plane, blocks as releases

**Read this before building anything.** Keeps product, research, and professor infra aligned.

**Audience:** Everyone on BlockSmith / UI AI Lab — engineers, designers, professor, investors.

**Related:** [PITCH-AND-PRODUCT-MODEL.md](./PITCH-AND-PRODUCT-MODEL.md) · [RESEARCH-INFRA-DESIGN-IR-AND-CICD.md](./RESEARCH-INFRA-DESIGN-IR-AND-CICD.md) · [IR-CICD-IMPLEMENTATION.md](./IR-CICD-IMPLEMENTATION.md)

**Active assignments:** [PROJECT-PIPELINE.md](./PROJECT-PIPELINE.md) (Jenkins-class UI) · [PROJECT-PROTOCOL.md](./PROJECT-PROTOCOL.md) (TCP/IP layer)

---

## One sentence (north star)

> **The wiki is where a company lives** — browse, govern, and **promote** design blocks to production; **one team → one design graph → one importable package**; agents and apps consume **pinned versions** via `blocksmith.lock`, not “latest markdown.”

---

## The company lives in the wiki (not a separate ops tool)

| ❌ Do not build | ✅ Build instead |
|----------------|------------------|
| Separate “Jenkins for design” admin app | **Pipeline UI inside the wiki** (badges, promote, rollback, lock status) |
| Second dashboard for blocks | Component / token pages **are** the block pages |
| Notion clone for free-form docs | Structured blocks with **draft → production** lifecycle |
| Per-engineer design packages | **Per product / per org** package |

**Rule:** If a feature helps teams control design truth, it ships **in the wiki first**. CLI, MCP, and CI are **consumers** of what humans promote in the wiki.

---

## One team = one design system = one package

Not one package per user. One **released artifact** per product the team owns.

| Entity | Example | Notes |
|--------|---------|-------|
| **Org / team** | `acme-design` on BlockSmith | GitHub org, invites, API keys |
| **Design doc** | `upload:scan-acme-mobile-app.md` | Stable slug from repo / `workspaceId` |
| **Design IR graph** | All blocks for that doc | Tokens, components, governance rules |
| **Pulse package** | `@blocksmith/acme-mobile-app` | Compiled from **promoted** blocks |
| **Lock file** | `blocksmith.lock` in customer repo | Pins `{ blockId → version }` for agents/CI |

```
Acme Corp (org)
  └── scan-acme-mobile-app.md
        ├── Wiki (humans)
        ├── @blocksmith/acme-mobile-app (agents / apps)
        ├── blocksmith.lock (repo pin)
        └── device profile / tokens.h (embedded compile)
```

**Every user on the team** sees the **same wiki**, shares the **same promoted graph**, pulls the **same lock**. Roles (owner / admin / viewer) control **who may promote**, not separate packages.

---

## Block versions — when do they update?

Versions are **append-only history**. The **official** pointer is what “production” means.

| Event | What happens | Who sees it |
|-------|----------------|-------------|
| **First scan / ingest** | New block → **v1**; scan facts (token/component) **auto-promote** to official | Wiki + agents |
| **Re-scan, code unchanged** | No new version | — |
| **Re-scan, token/color changed in repo** | New **vN**; scan fact **auto-promotes** (code wins) | Wiki shows update; lock goes **stale** until pull |
| **Designer edits governance** | New **draft vN+1** | Wiki preview only; **agents still on old official** |
| **Human Finalize (Promote)** | Official pointer → vN+1; lock regenerated | Agents + CI use new version |
| **Rollback** | Official pointer → older vN | Production reverts; history kept |
| **Block removed from repo** | Marked **stale**; last official still in lock until human acts | Wiki banner |

**Yes, block versions update** — on ingest (code) and on promote (human). They do **not** update for agents mid-draft.

There is **no separate Jenkins job per block** in v1. The **pipeline is the block lifecycle**:

```
INGEST → DRAFT (staging) → PROMOTE (production) → LOCK → DEPLOY (agents/CI)
```

Optional **v2 environments** (same model, different pointers):

| Environment | Meaning | Wiki label |
|-------------|---------|------------|
| **Staging** | `draft` versions visible, editable | “Preview” |
| **Production** | `official` + `blocksmith.lock` | “Live” / badge on block |

We do **not** need a literal Jenkins instance per block. We need **promote gates in the wiki** that feel like “merge to main” for each block (or batch Finalize).

---

## “Jenkins for design” — what we actually mean

| Jenkins concept | BlockSmith equivalent | Where it lives |
|-----------------|----------------------|----------------|
| Build | Scan / ingest → Design IR | Server on scan + `recordIngest()` |
| Artifact | Block @ version + Pulse build | Registry + `@blocksmith/…` |
| Staging | **Draft** block in wiki | Wiki UI (preview theme) |
| Approve / merge | **Finalize** (promote) | Wiki button + `POST /api/wiki/finalize` |
| Production deploy | Update `blocksmith.lock` | Pull API + CLI → customer repo |
| CI gate | `npm run validate:ui` | GitHub Actions on **their** repo |
| Rollback | `rollbackBlock()` | Wiki action (to build) |

**Professor’s code** implements the **engine** (registry, lock, enforce, verify script).  
**Product work** implements the **wiki control plane** humans use to run the pipeline.

---

## Wiki UI — control plane (required, integrated)

The wiki is not only documentation. It is the **release console** for design.

### Today (shipped or partial)

| UI | Status |
|----|--------|
| Browse tokens, components, styles | ✅ |
| Visualize (apply theme) | ✅ hybrid |
| Edit governance (Role, rules) | ✅ |
| Finalize → repo / cloud md | ✅ |
| IR registry + promote on Finalize (backend) | ✅ local |
| Version badges (v3 live, v4 draft) | ✅ `BlockReleaseStrip` on component pages |
| Lock freshness banner (“pull lock”) | ✅ Releases banner + `LockStatusCard` on Sync |
| Per-block **Promote / Rollback** | ✅ `/wiki/releases` + block-page strip · `POST /api/wiki/promote`, `/api/wiki/rollback` |
| **Pipeline view** (all blocks: draft / live / stale) | ✅ **`/wiki/releases`** — table, batch promote, history, conflicts |
| Package + lock panel (“`@blocksmith/acme` @ lock hash”) | ✅ Releases handshake panel (pull cmd, import, CI, MCP) |
| Device preview link from wiki | ✅ Releases → `/demo/device?doc=…` |

### Wiki UI to build (priority order)

1. **Block status badge** on every component/token page — `Draft` | `Live v3` | `Stale` | `Conflict`  
2. **Promote / Finalize** on block page (already have governance finalize — unify language)  
3. **System → Releases** page — table of blocks, official version, last promote, lock stale?  
4. **Sync page** — show `blocksmith.lock` JSON, copy pull command, package name  
5. **Rollback** (admin) — pick previous version from history  
6. **Environment toggle** (later) — preview wiki chrome from draft graph without promoting  

**All of the above live in the wiki.** No separate admin product.

---

## Who consumes promoted blocks?

| Consumer | How they get truth | Must use official only? |
|----------|-------------------|-------------------------|
| **Human in wiki** | Renders graph (can preview **draft**) | Can see drafts |
| **Cursor / MCP** | `get_design_tokens`, `get_component_docs` | ✅ yes (`enforce.ts`) |
| **Customer app** | `import from "@blocksmith/…"` | ✅ built from promoted graph |
| **Customer CI** | `validate:ui` + lock in repo | ✅ yes |
| **Device sim / tokens.h** | `compile:device` | ✅ yes |
| **Embedded firmware** | Generated `tokens.h` (future) | ✅ yes |

**Same protocol (`blocks.v1`), different compile targets.** Package is not a separate truth — it is a **build artifact** of the promoted graph.

---

## Version update flow (team story)

1. **Monday** — Team scans `acme/app`. Wiki live. `@blocksmith/acme-app` built from official v1 blocks. Lock in repo.  
2. **Tuesday** — Designer edits button rule in wiki → **draft v2** visible on button page with “Draft” badge. Production unchanged.  
3. **Wednesday** — Lead clicks **Promote** on wiki → official v2 → lock updates → `blocksmith pull` → agents read v2.  
4. **Thursday** — Engineer changes accent in code → re-scan → token auto-promotes v3 → wiki + stale lock banner → lead pulls new lock.  

That is **design CI/CD** without a separate Jenkins UI.

---

## Ambition map (reframed — nothing is “off limits”)

See **[CEO-DIRECTIVE.md](./CEO-DIRECTIVE.md)** for the full mission. Short version:

| Lane | What we are building |
|------|----------------------|
| Wiki | Company OS — control plane, not readme hosting |
| IR | Constitutional protocol — professor sign-off on semantics |
| CI/CD | Promote → lock → deploy → verify → rollback |
| Agents | Enforcement — official graph only |
| Pulse | `@blocksmith/<product>` per team product |
| Hardware | Simulator → dev boards → HMI → **OTA** (same promoted versions) |
| AI | Ingest, copilot, Visualize — **feeds the loop**, never a shadow truth |

**Rule:** disconnected experiments do not ship. Everything connects to **promote → lock** within two hops.

---

## Division of labor (stay in lane)

| Owner | Owns | Does not own |
|-------|------|----------------|
| **Product / you** | Wiki UX, scan, SaaS, Sync, Visualize, promote UI | Rewriting IR hash semantics without professor review |
| **Professor / research** | IR schema, registry, lock, enforce, compile targets, proofs | Wiki styling, GitHub OAuth, billing |
| **Shared** | Finalize → promote wiring, pull returns lock, MCP tools | Duplicate block stores |

Before a PR: *Does this make the wiki a better control plane, or strengthen IR/CI/CD under it?* If neither, defer.

---

## Parallel streams (not sequential phases)

Full sequencing in **[CEO-DIRECTIVE.md](./CEO-DIRECTIVE.md)**. All streams run at once; **Stream A (control plane)** is the spine.

| Stream | Mandate |
|--------|---------|
| **A — Control plane** | Wiki badges, Releases, Supabase registry, CLI lock, rollback UI |
| **B — Handshake** | MCP enforce, validate:ui, hosted Pulse |
| **C — Compile targets** | device-sim → dev boards → HMI → field |
| **D — Ingest** | Webhooks, Figma adapter, re-scan intelligence |
| **E — Field / OTA** | Promoted design → signed artifacts → staged rollout |
| **F — Proof** | R5 evaluation, drift metrics, public `blocks.v1` |

---

## FAQ (for the team)

**Q: Does every user get their own package?**  
A: No. **One package per product** (per scan doc / org). Users share it.

**Q: When does the package update?**  
A: When the **official** graph changes — after promote or auto-promote on scan — then Pulse rebuilds.

**Q: Where is Jenkins?**  
A: Design CI/CD **is** the pipeline. Wiki promote = merge to production. `validate:ui` = CI gate in **their** GitHub repo.

**Q: Can staging show different blocks than production?**  
A: Yes. **Draft** = staging preview in wiki. **Official** = what lock + agents use.

**Q: Should pipeline UI be separate from wiki?**  
A: **No.** Wiki is where the company lives.

**Q: What did professor build?**  
A: The **engine** under the wiki (registry, versions, lock, enforce, device compile, `verify:ir-cicd`). Wiki UI for releases is **our** next product layer on top.

---

## Diagram (pin on Slack / Notion)

```
┌─────────────────────────────────────────────────────────────┐
│  WIKI — where the company lives (control plane)              │
│  Browse · Visualize · Edit draft · PROMOTE · Rollback · Sync  │
└───────────────────────────┬─────────────────────────────────┘
                            │ promotes official versions
┌───────────────────────────▼─────────────────────────────────┐
│  Design IR (blocksmith.blocks.v1) — one graph per product    │
│  append-only versions · official pointer = production        │
└───────────────────────────┬─────────────────────────────────┘
                            │
      ┌─────────────────────┼─────────────────────┐
      ▼                     ▼                     ▼
 blocksmith.lock    @blocksmith/pkg         device / MCP
 (repo pin)         (import UI)            (agents / embedded)
      │
      ▼
 Customer GitHub CI (validate:ui) — gate on their PRs
```

---

*This document is the alignment contract. Update it when scope changes; link PRs to a phase checkbox.*
