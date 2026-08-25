# BlockSmith

**UI AI Lab flagship** — **design wiki + handshake** on SaaS, with **Design IR** and **design CI/CD** underneath connecting wiki, agents, and `@blocksmith` packages.

**Start here:** [`docs/CEO-DIRECTIVE.md`](docs/CEO-DIRECTIVE.md) (mission) · [`docs/TEAM-NORTH-STAR.md`](docs/TEAM-NORTH-STAR.md) (architecture) · [`docs/PITCH-AND-PRODUCT-MODEL.md`](docs/PITCH-AND-PRODUCT-MODEL.md) (pitch)

**Active sprint (sellable public release):** [`docs/PUBLIC-RELEASE-SPRINT.md`](docs/PUBLIC-RELEASE-SPRINT.md)  
**Shipped:** [`docs/PROJECT-PIPELINE.md`](docs/PROJECT-PIPELINE.md) · [`docs/PROJECT-PROTOCOL.md`](docs/PROJECT-PROTOCOL.md)

Scan or upload `.md` → rendered wiki → (Pulse) `@blocksmith/<product>`. Production: https://blocksmith-mocha.vercel.app

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000/wiki](http://localhost:3000/wiki).

Edit `docs/designs.md/apollo.md` and refresh the browser to see updates (IDE → Web read path for MVP).

## Wiki routes (Apollo)

| Path | Page |
|------|------|
| `/wiki` | Introduction |
| `/wiki/foundation/color` | Color tokens (grouped) |
| `/wiki/foundation/typography` | Typography |
| `/wiki/foundation/spacing` | Spacing & shapes |
| `/wiki/components/buttons` | Buttons + previews |
| `/wiki/guidelines` | Do's and don'ts |
| `/wiki/sync` | Sync status (handshake roadmap) |

## Project structure

```
src/
├── app/wiki/           # Wiki routes
├── components/wiki/    # UI shell + pages
├── lib/
│   ├── blocks/         # Shared types
│   ├── parser/apollo.ts
│   └── clients/apollo.ts
docs/                   # Planning + apollo.md source
```

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run typecheck` — TypeScript

## What to work on

| Track | Doc | Status |
|-------|-----|--------|
| Ship to internet (Vercel) | [`docs/DEPLOY.md`](docs/DEPLOY.md) | Parked TODO |
| Phase 2 codegen (`@blocksmith/pulse`) | [`docs/PHASE2-PULSE.md`](docs/PHASE2-PULSE.md) | ✅ local — `/demo/pulse` |

## Distribution (CLI / SDK / remote MCP)

Ship without open-sourcing the repo — [`docs/DISTRIBUTION.md`](docs/DISTRIBUTION.md)

```bash
npm run verify:workable          # full local product check
npm run verify:patterns-live     # needs npm run dev in another terminal
npm run build:packages
```

Pulse demo: [http://localhost:3000/demo/pulse](http://localhost:3000/demo/pulse)

## Docs

Pitch: [`docs/PITCH-AND-PRODUCT-MODEL.md`](docs/PITCH-AND-PRODUCT-MODEL.md) · **Research infra (professors):** [`docs/RESEARCH-INFRA-DESIGN-IR-AND-CICD.md`](docs/RESEARCH-INFRA-DESIGN-IR-AND-CICD.md) · Design IR: [`docs/BLOCKS-V1-SPEC.md`](docs/BLOCKS-V1-SPEC.md) · Design CI/CD: [`docs/DESIGN-CICD.md`](docs/DESIGN-CICD.md)

## Live sync + MCP

- **IDE → Web:** Save `docs/designs.md/*.md` — wiki auto-refreshes via SSE (`npm run dev`).
- **Web → IDE:** Edit guidelines/components in wiki → **Finalize** writes back to the `.md` file.
- **MCP:** `npm run mcp` — Cursor tools read `.blocksmith/blocks/` (same graph as wiki). See [`docs/MCP.md`](docs/MCP.md).

```bash
cp .cursor/mcp.json.example .cursor/mcp.json
```

## Workspace scan (IDE → wiki)

```bash
BLOCKSMITH_WORKSPACE=/path/to/vendor-app npm run scan
```

Or call MCP tool `scan_workspace`. Writes real data from the repo to `data/uploads/scan-*.md` and opens the wiki — no mock values.

## Next

- Web → IDE finalize into vendor `DESIGN.md`
- Publish block schema (`blocksmith.blocks.v1`) — see [`docs/BLOCKS-V1-SPEC.md`](docs/BLOCKS-V1-SPEC.md)
