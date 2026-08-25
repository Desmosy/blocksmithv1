# @blocksmith/protocol

![blocks.v1 conformance](https://img.shields.io/badge/blocks.v1-conformant-22c55e)

**`blocksmith.blocks.v1` — the interchange format for design truth.**

Figma is Ethernet. This is TCP/IP. Any tool compiles **into** the block graph
(ingest adapter); any consumer compiles **out** (compile target) — wiki, npm
packages, AI agents, firmware headers. `blocksmith.lock` pins production in
every repo so agents physically cannot hallucinate a design system.

This package is everything a third party needs to speak the protocol —
types, validators, canonical hashing, JSON Schemas, conformance fixtures —
**without cloning BlockSmith**. Zero runtime dependencies.

## Install

```bash
npm install @blocksmith/protocol
```

## Emit a valid graph in under 20 lines

```ts
import {
  blockContentHash, graphHash, validateGraph,
  type BlocksmithBlockV1, type BlocksmithGraphV1,
} from "@blocksmith/protocol";

const content = { value: "#d97757", cssVar: "--color-accent" };
const block: BlocksmithBlockV1 = {
  id: "token:color:accent", type: "token", title: "Accent",
  version: 1, status: "finalized",
  source: { file: "tokens.css", ingest: "scan" },
  content, updatedAt: new Date().toISOString(),
  contentHash: blockContentHash("token:color:accent", "token", content),
};
const graph: BlocksmithGraphV1 = {
  schema: "blocksmith.blocks.v1",
  docRef: "my-app.md", systemId: "my-app",
  contentHash: graphHash([block]), blocks: [block],
};

console.log(validateGraph(graph, { verifyHashes: true })); // { ok: true, errors: [] }
```

## Validate what an agent is about to consume

```ts
import { validateGraph, verifyLockAgainstGraph } from "@blocksmith/protocol";

// Official graphs must not contain drafts or conflicts:
validateGraph(graph, { officialOnly: true, verifyHashes: true });

// Is the repo's lock still current?
const { ok, stale, errors } = verifyLockAgainstGraph(lock, officialGraph);
```

## What's in the box

| Path | Contents |
|------|----------|
| `schemas/` | JSON Schema 2020-12 for `blocks.v1`, `lock.v1`, `registry.v1`, `compile-targets.v1` |
| `fixtures/` | Canonical example graph + lock (hashes are real — recompute and compare) |
| `conformance/` | Valid/invalid/behavioral fixtures + runner (`npm run conformance`) |
| `compile-targets.v1.json` | Registry of reference compile targets |

## Conformance

```bash
npm run conformance
```

Fork `conformance/` fixtures to prove **your** emitter speaks blocks.v1:
golden hash vectors must reproduce byte-for-byte; official graphs must
exclude `draft`/`conflict`; locks must detect version drift and staleness.

## Constitutional invariants (do not break)

1. **Versions are append-only.** Rollback moves the `official` pointer; history is never edited.
2. **`official` is production.** Only official versions are lock-eligible; agents and compile targets read official graphs only.
3. **Scan facts auto-promote** (token/component from code); **governance stages as draft** until a human promotes.
4. **`stale` ≠ deleted** — the last official version stays pinned until a human decides.
5. **`conflict` blocks promote** until a human resolves the disagreeing sources.
6. **Hashing is canonical** — sorted-key JSON, sha256, truncated 32 hex; graph hash is order-independent.

Changing any of these is a `blocks.v2` spec bump (see `docs/PROTOCOL-GOVERNANCE.md`
in the BlockSmith repo).

## Reference implementation

BlockSmith (wiki + Pipeline + MCP + device targets) dogfoods this spec:
spec site at `/protocol`, schemas served at `/schema/*.json`.
