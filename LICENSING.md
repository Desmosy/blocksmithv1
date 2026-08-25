# Licensing — BlockSmith open core

BlockSmith is **open core**. The client, SDK, MCP server, and the Design-IR
spec are open source (MIT). The hosted application and its multi-tenant cloud
are **source-available** under the Business Source License 1.1 (BSL), which
automatically converts to Apache-2.0 on the Change Date.

> **Status: internal.** This boundary is being established now. Do **not** push
> to a public remote or announce the open-source split until we've made
> meaningful progress ourselves. See "Rollout" below.

## Open source — MIT

Licensed under [MIT](./LICENSE-MIT). These are the adoption + standardization
surfaces: the more widely they're used, inspected, and built on, the stronger
the ecosystem moat.

| Path | What |
|------|------|
| `packages/cli` | The `blocksmith` CLI |
| `packages/sdk` | The workspace SDK |
| `packages/protocol` | Design-IR / lock / blocks **spec + JSON schemas** (the standard) |

**Intended open — extraction pending** (still under `src/` today; move into
packages before the open repo can stand alone):

| Path | What |
|------|------|
| `src/lib/figma` | Figma import + drift engine |
| `src/lib/mcp`, `src/mcp` | The MCP server agents connect to |
| `src/lib/scan` (parsers), `src/lib/governance/color-lint.ts` | Workspace scan parsers + Tier-1 (block) lint |

## Source-available — BSL 1.1 → Apache-2.0 (Change Date 2030-06-23)

Licensed under [BSL 1.1](./LICENSE). This is the business: the hosted product
and the team/enterprise value that is genuinely hard to self-host. **Default:
anything not explicitly listed as open above is proprietary.**

| Path | What |
|------|------|
| `src/app` | The Next.js app — dashboard, cloud wiki, auth, API routes |
| `src/lib/cloud` | Org / RBAC / multi-tenant, document registry, rate limits |
| `src/lib/ai`, AI generation & curation | Governed generation, drift scoring |
| `packages/pulse-runtime`, `packages/generated/*` | Proprietary runtime + generated kits |

The BSL **Additional Use Grant** permits production use *except* offering
BlockSmith to third parties as a competing hosted/managed service.

## Why open core

1. **The moat is a standard, not a secret.** If `design.md` + the MCP become
   the interchange format for design governance, we win the ecosystem — which
   requires the spec + client to be freely adoptable and inspectable.
2. **Agents and developers won't trust a closed tool** that sits in their repo
   and their AI loop. Openness on the client side is adoption fuel.
3. **Willingness-to-pay lives in the cloud/team layer** — hosted wiki,
   collaboration, RBAC, AI, enterprise governance — which the BSL protects from
   a larger player simply reselling our server.

## Rollout (do these before going public)

- [x] License boundary documented; `LICENSE` (BSL), `LICENSE-MIT`, and
      per-package `LICENSE` files in place.
- [ ] Physically extract the "intended open" libs into `packages/*` so the open
      tree compiles independently of the proprietary app.
- [ ] Decide repo strategy: split public/private repos, or a monorepo with a
      filtered public mirror (e.g. `git subtree` / CI export of open paths only).
- [ ] Add SPDX headers: `// SPDX-License-Identifier: MIT` (open) and
      `BUSL-1.1` (proprietary) across files.
- [ ] Consider **Apache-2.0** instead of MIT for `packages/protocol` (patent
      grant matters more for a spec).
- [ ] Contributor policy / CLA/DCO if accepting external contributions.
- [ ] Replace the licensor placeholder with the legal entity once formed.
- [ ] **Hold:** no public push or announcement until the above and our own
      product progress are ready.
