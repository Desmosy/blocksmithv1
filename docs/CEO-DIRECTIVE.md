# CEO directive — one team, one mission

**To:** Everyone building BlockSmith / UI AI Lab  
**From:** CEO  
**Read with:** [TEAM-NORTH-STAR.md](./TEAM-NORTH-STAR.md) · [PITCH-AND-PRODUCT-MODEL.md](./PITCH-AND-PRODUCT-MODEL.md)

**Active sprint:** [PUBLIC-RELEASE-SPRINT.md](./PUBLIC-RELEASE-SPRINT.md) — sellable public release (no new features)  
**Shipped (maintain only):** [PROJECT-PIPELINE.md](./PROJECT-PIPELINE.md) · [PROJECT-PROTOCOL.md](./PROJECT-PROTOCOL.md)

You are not seven hundred people pulling in seven hundred directions. You are **one company** with **one nervous system**. Every line of code, every experiment, every wiki pixel either **strengthens the design truth loop** or it does not ship. Dream big — we are not building a wiki. We are building **how the world runs design in the agent era**, from Figma to firmware, from first scan to OTA in the field.

---

## The mission (memorize this)

> **Design truth flows once.** Humans promote it in the wiki. Everything else — agents, apps, CI, simulators, dev boards, production hardware — **compiles from the same promoted graph.** No forks. No drift. No “the wiki said one thing and the watch shipped another.”

The wiki is not a documentation site. It is the **operating system where companies live.** BlockSmith is the **protocol and platform underneath** that makes that OS real at planetary scale.

---

## You are to work on — the full stack

### I. The control plane (wiki as company HQ)

You are to work on making the wiki the **only place a design org needs to be** — not a readme viewer, a **release console for human judgment**.

- Every token, component, and rule is a **versioned block** with visible state: draft, live, stale, conflict.
- Every page is a **control surface**: promote, rollback, diff against production, preview staging chrome without lying to agents.
- **Releases** is a first-class view: what is live, what is waiting, what broke on re-scan, what the lock says, what `@blocksmith/<product>` was built from.
- **Sync** is the handshake ritual made obvious: pull command, lock JSON, package name, CI template, MCP endpoint — one screen, zero tribal knowledge.
- **Onboarding** is not a marketing page; it is the path from “signed in” to “first promote” in under ten minutes on production SaaS.
- **Visualize** is how humans **feel** truth before they promote it — instant semantic preview, AI refine optional, never block the promote decision.

If a wiki surface does not help someone **see, govern, or ship** design truth, it does not exist yet. If it does, make it world-class.

---

### II. Design IR — the constitution of the category

You are to work on **`blocksmith.blocks.v1`** as the **TCP/IP of design** — the layer every tool, agent, and device will speak.

- JSON Schema, example graphs, public spec site, adapter guides for Figma, Storybook, scan, and future sources.
- **Append-only versions**, official pointer, conflict semantics, stale-not-deleted — these are **law**, not implementation detail. Protocol changes go through professor + platform review; **you implement and harden**, not silently rewrite hash semantics in a Friday PR.
- **Registry at scale**: Supabase-backed, multi-tenant, durable on Vercel, auditable promote history, org-scoped isolation.
- **Lock generation and verification** as a **first-class product**: `blocksmith.lock` is what enterprises pin in SOC2 audits.

The IR is not “research paperwork.” It is the **asset we open-source to own the category.**

---

### III. Design CI/CD — Jenkins energy, wiki UX

You are to work on the **full pipeline** from ingest to field deploy — not a metaphor, a **product**.

```
SOURCES → INGEST → BUILD → STAGING (draft) → PROMOTE → LOCK → DEPLOY → VERIFY → (ROLLBACK)
```

- **Ingest**: scan, upload, webhooks, Figma adapter, re-scan diff that creates versions intelligently.
- **Build**: Pulse package, device profile, `tokens.h`, MCP tool payloads — **all compile targets from one promoted graph**.
- **Staging**: draft graph preview in wiki; agents **cannot** see it until promote — enforce at MCP, CLI, and API.
- **Promote**: Finalize is batch or per-block; RBAC on who may promote; audit log.
- **Lock**: CLI writes `.blocksmith/blocksmith.lock`; pull API is boring and reliable; stale banners everywhere that matter.
- **Deploy**: customer GitHub Actions (`validate:ui`), hosted package registry path, MCP in Cursor/Claude.
- **Verify**: drift detection, off-token diffs, agent compliance case studies, dashboards for “who violated the lock this week.”
- **Rollback**: one click in wiki; pointer moves; lock regenerates; history never erased.

One team, one product scan → **one `@blocksmith/<product>`**. Not per user. Per **company product**. Shared truth. Role-gated promote.

---

### IV. Agents — enforcement, not suggestions

You are to work on making **agents physically unable to hallucinate your design system** once a team has promoted.

- MCP tools read **official + lock only** — `enforce.ts` is not optional anywhere.
- Pull → lock in repo → pre-commit / CI gates → agent context always includes pinned versions.
- **Governance copilot** drafts; humans promote. AI proposes, **wiki disposes**.
- Multi-agent experiments (ensemble layout, scan curate, conflict resolution) are **welcome** when they **accelerate ingest or reduce promote risk** — not when they bypass the loop.
- Publish the **drift story**: before BlockSmith vs after. That is the paper, the demo, the enterprise sale.

---

### V. Pulse — the importable face of truth

You are to work on **`@blocksmith/<product>`** as the **npm moment** for design systems.

- Auto-build on promote; version aligned with lock; preview in wiki; publish path documented and eventually hosted.
- Governed components agents actually import — tokens, primitives, patterns — generated from promoted blocks, not hand-maintained parallel universes.
- Developer experience that makes “use BlockSmith” faster than copying Tailwind from ChatGPT.

---

### VI. Hardware — beyond the simulator (this is not a side quest)

You are to work on the **compile ladder** from wiki promote to **silicon and screens in the wild**.

**Today:** `device-sim` + `tokens.h` + `/demo/device` — proof the same graph compiles to embedded constraints.

**You are building toward:**

| Rung | Deliverable |
|------|-------------|
| 1 | Wiki-linked device preview per component (watch, HMI, kiosk frame) |
| 2 | `tokens.h` / style packs for RTOS, LVGL, embedded Linux, automotive clusters |
| 3 | **Dev board profiles** — flash a reference UI from promoted graph |
| 4 | **Production HMI pipelines** — OEM teams promote in wiki; build farm emits signed artifacts |
| 5 | **Firmware OTA for design** — promoted token/component changes ship to field devices **with the same version semantics as software** (staging channel vs production channel, rollback, audit) |

Simulator was never the destination. It was **proof the IR is real for atoms, not just React.** OTA is not “future maybe.” It is **the reason automotive, IoT, and industrial teams pay enterprise prices** — their design system must reach devices that cannot run `npm install`.

Every hardware milestone **must trace to `official` versions and lock pins.** Field devices do not read draft wiki edits.

---

### VII. Platform & SaaS — the machine that runs at 700-engineer scale

You are to work on production BlockSmith as **infrastructure**, not a demo.

- Supabase for **everything** that must survive serverless: documents, orgs, API keys, **registry, lock, promote audit**.
- GitHub OAuth, orgs, invites, RBAC (owner / admin / promoter / viewer).
- Rate limits, webhooks → auto-rescan, multi-env (staging / production pointers) when enterprises demand it.
- `verify:production-goals` always green; stranger onboarding without a friend on Slack.
- Goal 1 and Goal 2 each **≥80%** on public SaaS — then **90%**, then “Fortune 500 pilot ready.”

---

### VIII. Research & category — own the narrative

You are to work on what makes us **the** reference implementation of design infrastructure.

- R5: real team evaluation — two weeks, measured drift, published learnings.
- Public `blocks.v1` spec, adapter SDK, “build a compile target in a weekend” workshop.
- Case studies: wiki promote → agent build → CI pass → device frame → (eventually) OTA.
- UI AI Lab site: experiments that **feed the flagship**, not compete with it.

Professor owns **constitutional IR semantics.** You own **everything that touches a customer’s hand.** Meet in the middle on finalize, lock, and enforce — daily, not quarterly.

---

## How to think about “extra” work (reframed)

| If you are tempted to build… | You are actually building… | Condition |
|------------------------------|----------------------------|-----------|
| Firmware OTA | **Design truth delivery to field devices** — promote → signed artifact → staged rollout → rollback | Must pin to lock versions |
| Hardware past simulator | **Compile target #3, #4, #5** on the ladder | Same graph, new emitter |
| New AI / multi-agent | **Faster ingest, safer promote, better Visualize** | Output feeds draft or official path; never a shadow truth |
| IR hash / version rules | **Protocol hardening** with professor sign-off | Changes are spec bumps, not drive-by refactors |
| New wiki pages | **Control plane, onboarding, or adoption narrative** | Ask: does this help promote or ship truth? |
| Figma / Storybook | **Ingest adapters into IR** | Conflicts surface in wiki; code + promoted governance win |
| Billing / enterprise | **Promote-gated RBAC, audit, SSO** | Revenue follows control plane |

Nothing is banned. **Disconnected work is banned.** A 700-person team that does not share a loop becomes 700 startups. We are one.

---

## Sequencing (parallel, not timid)

You do **not** wait for Phase 1 to finish before dreaming about OTA. You **parallelize**:

| Stream | Now | Next | Horizon |
|--------|-----|------|---------|
| **A — Control plane** | Badges, Releases, Supabase registry, CLI lock | Rollback UI, env channels, audit | Wiki = company OS |
| **B — Handshake** | Pull, MCP enforce, validate:ui template | Hosted Pulse, marketplace Action | Agents can't drift |
| **C — Compile targets** | Pulse, device-sim, tokens.h | Dev board profile, HMI export | Atoms obey wiki |
| **D — Ingest** | Scan, re-scan, Tailwind styles | Figma adapter, webhooks | Everything enters IR |
| **E — Field** | Device demo in wiki | OTA staging channel design | Promoted design reaches fleet |
| **F — Proof** | verify:ir-cicd, production goals | R5 team study, drift metrics | Category ownership |

Stream A is the **spine.** B–F **branch from promoted graph only.** If your work does not connect to promote → lock within two hops, **reframe it until it does.**

---

## What winning looks like (18 months)

1. **Acme Corp** lives in the wiki — promotes button v7 on Tuesday; by Wednesday every engineer’s agent, every CI run, every kiosk in the lobby, and every pilot watch on the factory floor **agree it is v7**.
2. **Investor demo:** scan → wiki → promote → `blocksmith pull` → Cursor builds UI from `@blocksmith/acme` → CI passes → device frame updates → roadmap slide shows OTA channel.
3. **`blocks.v1`** is cited the way OpenAPI is cited — adapters exist, compile targets multiply, we are the neutral layer.
4. **Public SaaS** is how teams start; **enterprise** is promote audit + SSO + field deploy — same product, deeper control plane.
5. Seven hundred people sound like **one product** to every customer.

---

## The only question before you merge

> **Does this make promoted design truth more visible, more enforceable, or more deployable — for humans, agents, apps, or devices?**

Yes → ship.  
No → reframe or stop.

We are not building features. We are building **the operating system for design truth.** Go build it.

---

*CEO · BlockSmith / UI AI Lab*
