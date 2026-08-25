# The Design IR: Blocks, Versions, And The Protocol

**What this chapter covers.** The data structure at the centre of BlockSmith: what a block is, how it gets an identity and a content hash, how versions accumulate, what "production" means, how `blocksmith.lock` pins it, how agents are prevented from reading anything else, and how all of that is packaged as a public protocol called `blocksmith.blocks.v1`.

**Why it matters.** Every other part of the company is a peripheral of this one. The wiki is a renderer of it. The scanner is a producer of it. MCP, the Pulse package build, the device simulator, and the CI gate are consumers of it. The pitch deck calls it the moat. If the IR is wrong, everything downstream is wrong in the same way at the same time.

**Read this if** you are about to touch anything under `src/lib/ir/`, `packages/protocol/`, or any route that promotes, rolls back, or pins. Also read it before you argue about whether we are a documentation product or an infrastructure product, because this chapter is where that argument is settled by code.

**One note on the quotes.** Every code block below is copied from the repository, but the Constitution's style contract forbids em dashes and en dashes even inside quoted material. Several source comments and log strings use them. Where that happened, the punctuation was rewritten to a comma or a colon and nothing else was changed. If you diff a quote here against the file and find one character different, that is why. Logic, identifiers, and hashes are verbatim.

---

## 0. First, disambiguate: two things in this repo are called "IR"

This trips up everybody in week one. There are two unrelated directories with confusingly similar names.

| Directory | What it actually is | Consumers |
|-----------|---------------------|-----------|
| `src/lib/ir/` | **The Design IR.** The block graph, version registry, lock file, enforcement, compile targets. The subject of this chapter. | MCP, Pulse build, CI gate, device targets, Pipeline UI |
| `src/lib/design-ir/` | **The wiki theme compiler.** Takes a parsed `DesignSystem` and produces the CSS variables the wiki chrome renders with (`--wiki-accent`, `--wiki-bg`, radii, font stacks). Nothing to do with blocks, versions, or locks. | The wiki renderer only |

`src/lib/design-ir/schema.ts` even has its own version constants that mean something completely different:

```ts
export const DESIGN_IR_VERSION = 1 as const;
/** Bump when compileWikiChrome / token resolution logic changes */
export const DESIGN_IR_COMPILER_REV = 12;
```

That `compilerRev` is a cache-busting number for the wiki's theme compiler. It is not a protocol version. When somebody says "bump the IR version", ask which one they mean.

`src/lib/design-tokens/` is a third, smaller thing: helpers that pick colors out of a parsed system by role or CSS-variable name (`resolve.ts`), plus one genuine compile target, `style-dictionary.ts`, which does read the real block graph:

```ts
import type { BlocksmithGraphV1 } from "@/lib/ir/types";

/** Emit portable CSS and JSON from the same promoted graph used by device targets. */
export async function buildStyleDictionaryTargets(graph: BlocksmithGraphV1, outDir: string) {
```

From here on, "the IR" means `src/lib/ir/` and nothing else.

---

## 1. Why an IR at all

### 1.1 The problem, stated concretely

Design truth about one product arrives from several places that do not agree and cannot be made to agree:

| Source | What it knows | What it is wrong about |
|--------|---------------|------------------------|
| Repository scan | The hex values, CSS variables, component exports, and props that actually ship | Intent. It cannot tell you a color is "the CTA color" or that a button is deprecated |
| Figma | Intent and exploration | What shipped. Figma routinely diverges from code |
| Markdown (`DESIGN.md`, `CLAUDE.md`, pasted docs) | Governance prose, do's and don'ts, agent rules | Everything factual, the moment code changes underneath it |
| Human edits in the wiki | Curated descriptions and roles | Nothing, but they are the slowest to produce and easiest to lose |
| AI (the governance copilot, Visualize) | Plausible-sounding gap fillers | Whether any of it is true |

And that truth has to reach several consumers that need different shapes of it:

| Consumer | Needs |
|----------|-------|
| The wiki | Renderable pages, including unapproved drafts, for humans |
| MCP agents in Cursor | Small JSON payloads, approved content only, with a version number attached |
| The Pulse package build | Tokens plus component definitions, approved content only |
| The CI gate on a customer PR | A pinned set of allowed values plus a staleness signal |
| The device simulator and `tokens.h` emitter | Literal color integers, touch-target math, governance rules as constraints |

### 1.2 The N-times-M problem

Without a neutral middle, every source has to know about every consumer. Five sources times six consumers is thirty adapters, and each one has to independently decide the questions that actually matter: which value wins when two sources disagree, whether a human approved this, what version this is, and what to do when a component disappears from the repo. Thirty adapters means thirty different answers to those questions, which means the answers are effectively random.

With a neutral middle, each source writes one adapter into the IR (N adapters) and each consumer writes one compiler out of it (M compilers). N + M instead of N × M. More importantly, the hard questions get answered exactly once, in the middle, where they can be tested.

The rule is stated as law in `docs/PROJECT-PROTOCOL.md`:

> Adapters write **blocks.v1** only. Targets read **official graph** only. Lock pins what agents see.

An adapter that writes directly to the wiki, or a target that reads raw markdown, breaks the whole property. `src/lib/ingest/storybook.ts` opens with exactly that reminder:

```ts
 * Reads a static Storybook build (index.json v4/v5 or stories.json v3) and
 * compiles component blocks INTO blocksmith.blocks.v1. Per the adapter
 * contract it only writes IR: never the wiki, never Pulse.
```

### 1.3 The compiler analogy, done properly

The analogy the docs reach for is LLVM. It is the right analogy, and it is worth being precise about which parts transfer.

**What transfers.** LLVM's value is that `clang`, `rustc`, and `swiftc` all lower to one intermediate representation, and x86, ARM, and WASM backends all consume that one representation. Adding a language costs one frontend. Adding a chip costs one backend. Nobody writes a Rust-to-ARM compiler. That is exactly the shape here: `scan`, `markdown`, `governance`, and `storybook` are frontends; `wiki`, `pulse-react`, `mcp`, `device-sim`, and `c-header` are backends. `packages/protocol/compile-targets.v1.json` is literally a backend registry.

**What also transfers, and matters more.** LLVM IR is not just a data format, it is a format with *invariants*: SSA form, typed values, well-formedness that `opt -verify` checks. The equivalent invariants here are the ones in `docs/PROTOCOL-GOVERNANCE.md` and the registry schema: versions are append-only, the `official` pointer may only reference a recorded version, official graphs contain no drafts, hashes are canonical. `packages/protocol/conformance/run.ts` is our `-verify`.

**Where the analogy breaks, and you should say so out loud.** LLVM IR has a defined semantics for every instruction, so "this lowering is correct" is a statement you can in principle prove. Our block payload is declared as:

```ts
content: Record<string, unknown>;
```

and the published JSON Schema says only:

```json
"content": {
  "type": "object",
  "description": "Type-specific payload. Tokens carry value/cssVar; components carry role/description/radius; guidelines carry items[]; agent-rules carry text."
}
```

That description is prose, not schema. There is no machine-checkable contract on what a `component` block's content contains. So "compiling" a block is, in practice, plucking fields and hoping. `src/lib/ir/targets/device-sim.ts` shows the consequence honestly:

```ts
function parsePx(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const m = value.match(/([\d.]+)\s*px/);
  return m ? Math.round(Number(m[1])) : fallback;
}
```

A component with no `radius` silently becomes an 8px corner on a watch face. LLVM would not compile a program with a missing operand; we ship a default. This is the single largest gap between "we have an IR" and "we have a compiler", and section 10 returns to it.

---

## 2. What a block is

### 2.1 The kinds

Block kinds and statuses are declared in `src/lib/blocks/types.ts`, and the IR imports them rather than redeclaring them:

```ts
export type BlockStatus = "draft" | "finalized" | "stale" | "conflict";

export type BlockType =
  | "page"
  | "token"
  | "component"
  | "guideline"
  | "agent-rule";
```

Five kinds, four statuses. That is the entire type system. There is no `surface` kind and no `governance-rule` kind, despite what some older docs imply: surfaces are `token` blocks with an id prefix of `token:surface:`, and governance prose lands as `guideline` or `agent-rule`.

| Kind | What it holds | Where it comes from | Auto-promoted? |
|------|---------------|---------------------|----------------|
| `token` | A single design value: color, typography family, spacing step, surface level | Repo scan, markdown parse | Yes (on ingest) |
| `component` | One documented component: role, description, and scan metadata | Repo scan, markdown parse, Storybook adapter | Yes (on ingest) |
| `guideline` | Do's and don'ts lists | Markdown parse | No |
| `agent-rule` | Free prose aimed at AI agents (the "Agent Prompt Guide") | Markdown parse, governance edits | No |
| `page` | Prose sections and the wiki introduction | Markdown parse (generic mode), structured docs | No |

The status values mean:

| Status | Meaning | Served to agents? |
|--------|---------|-------------------|
| `draft` | Staged. A human edited it, or an adapter produced it and nobody approved it | No |
| `finalized` | Promoted. This is production truth | Yes, if it is also the `official` version |
| `stale` | The source it came from vanished. Not deleted, because the lock may still pin it | No |
| `conflict` | Two ingest sources produced different content for the same id | No, and it cannot be promoted until resolved |

### 2.2 The block itself

`src/lib/ir/types.ts`, quoted verbatim except that the file's comment dashes have been rewritten:

```ts
export const BLOCKS_SCHEMA = "blocksmith.blocks.v1" as const;
export const LOCK_SCHEMA = "blocksmith.lock.v1" as const;

export type IngestSource =
  | "scan"
  | "markdown"
  | "governance"
  | "figma"
  | "paste"
  | "storybook"
  | "agent-template";

export type EditOrigin = "web" | "ide" | "mcp" | "ingest";

/** Atomic unit of design truth. The packet on the wire. */
export interface BlocksmithBlockV1 {
  id: string;
  type: BlockType;
  title: string;
  /** Monotonic per id; bumped when content changes, promoted on Finalize. */
  version: number;
  status: BlockStatus;
  source: { file: string; line?: number; ingest?: IngestSource };
  content: Record<string, unknown>;
  updatedAt: string;
  /** sha256 over canonical (id, type, content). */
  contentHash: string;
  finalizedAt?: string;
  editedBy?: EditOrigin;
}
```

Field by field:

| Field | Required | Meaning and why it exists |
|-------|----------|---------------------------|
| `id` | yes | Stable, human-readable address. Schema pattern is `^[a-z0-9][a-z0-9:_-]*$`. It is the primary key everywhere: registry filename, lock key, MCP argument, `tokens.h` define name. See section 3.1 |
| `type` | yes | One of the five kinds. Drives auto-promotion policy and which compile targets care about it |
| `title` | yes | Display string for the wiki and the release table. Not part of the content hash, so retitling does not create a version |
| `version` | yes | Integer, starts at 1, monotonic per id, never reused. Assigned by the registry, never by an adapter |
| `status` | yes | Lifecycle state, per the table above |
| `source.file` | yes | Where this came from. In practice today this is the markdown doc path, not the original `.css` or `.tsx`. That is a known weakness (section 10) |
| `source.line` | no | Line in that file. Rarely populated |
| `source.ingest` | no | Which adapter produced it. Also rarely populated in real data (section 10) |
| `content` | yes | The payload. Object, otherwise unconstrained |
| `updatedAt` | yes | ISO timestamp from the source document, not from the ingest run |
| `contentHash` | yes | `sha256:` plus 32 hex chars over canonical `(id, type, content)`. Section 3 |
| `finalizedAt` | no | When this version became official. Its presence is what makes a version rollback-eligible |
| `editedBy` | no | Which surface caused this version: `web` (wiki), `ide`, `mcp`, `ingest` (a scan). This is what separates "code changed" from "a human typed" and therefore drives auto-promotion |

### 2.3 The graph container

```ts
/** Graph container. What ingest adapters emit and compile targets read. */
export interface BlocksmithGraphV1 {
  schema: typeof BLOCKS_SCHEMA;
  docRef: string;
  systemId: string;
  /** Order-independent hash over (id, version, contentHash). */
  contentHash: string;
  blocks: BlocksmithBlockV1[];
}
```

`docRef` is the unit of tenancy. It is a document reference such as `upload:scan-acme-ui-kit.md` or `apollo.md`. One `docRef` equals one product equals one design system equals one package equals one lock. `systemId` is the parsed system's own id (`acme-ui-kit`), used for naming.

There is no org id, no project id, and no user id anywhere in the block schema. Multi-tenancy is entirely a function of the `docRef` string plus access checks in the routes above it. Remember that when you read section 10.

### 2.4 The content payload, in practice

The schema does not constrain `content`, but the producer does. `src/lib/blocks/content.ts`:

```ts
/** Payload stored per block on disk. Wiki and MCP read the same shape. */
export interface BlockContent {
  summary?: string;
  role?: string;
  description?: string;
  value?: string;
  cssVar?: string;
  group?: string;
  agentHint?: string;
  items?: string[];
  text?: string;
  /** Introduction page (page:introduction) fields. */
  name?: string;
  tagline?: string;
  overview?: string;
  /** Component compile hints (device-sim, Pulse). */
  radius?: string;
}
```

Every field optional, one flat bag shared by all five kinds. `agentHint` is worth calling out: it is a pre-written sentence for an LLM to read, generated at extraction time. It exists because MCP payloads should not require the agent to infer usage from a hex value.

### 2.5 Where blocks come from

`src/lib/blocks/extract.ts` is the derivation from a parsed `DesignSystem` to blocks. The id scheme it produces:

| Source in the parsed system | Block id | Type |
|-----------------------------|----------|------|
| `system.colors[]` | `token:color:<cssVar minus leading -- and color- prefix>` | `token` |
| `system.typography[]` | `token:typography:<slugified name>` | `token` |
| `system.spacing[]` | `token:spacing:<token minus leading -->` | `token` |
| `system.surfaces[]` | `token:surface:<level>` | `token` |
| `system.components[]` | `component:<component id>` | `component` |
| `system.dos[]` | `guideline:dos` | `guideline` |
| `system.donts[]` | `guideline:donts` | `guideline` |
| `system.agentGuide` | `agent-rule:guide` | `agent-rule` |
| Name / tagline / overview | `page:introduction` (status `draft`) | `page` |
| Generic-mode sections | `page:<section.id>` (status `draft`) | `page` |

A concrete extraction, for colors:

```ts
blocks.push(
  block({
    id: `token:color:${slug}`,
    type: "token",
    title: c.name,
    source: { file: sourceFile },
    docRef,
    systemHash,
    updatedAt,
    content: {
      summary: c.role,
      value: c.value,
      cssVar: c.cssVar,
      group: c.group,
      agentHint: `Use ${c.name} (${c.cssVar}) ${c.value} for ${c.role}`,
    },
  }),
);
```

Note `source: { file: sourceFile }` with no `ingest`. `sourceFile` is `system.sourcePath`, which for a scan is the generated markdown, not `globals.css`. Both of those facts matter in section 10.

### 2.6 The published schema

`packages/protocol/schemas/blocksmith.blocks.v1.json` is JSON Schema 2020-12 and is the normative artifact. It sets `additionalProperties: false` on the block and on the graph, so an adapter cannot smuggle extra fields through. Selected constraints:

```json
"id": {
  "description": "Stable id, e.g. 'component:button-primary' or 'token:color:accent'.",
  "pattern": "^[a-z0-9][a-z0-9:_-]*$"
},
"version": {
  "type": "integer",
  "minimum": 1,
  "description": "Monotonic per id. New content = new version. Promoted (made official) by a human Finalize in the wiki, the CI/CD promote gate."
},
"status": {
  "enum": ["draft", "finalized", "stale", "conflict"],
  "description": "draft: staged, never served to agents. finalized: promoted official truth. stale: source vanished or repo changed under it. conflict: two ingest sources disagree, a human must resolve."
}
```

`packages/protocol/src/validate.ts` is a dependency-free executable mirror of that schema, so a third party can validate without an Ajv dependency. It is the schema that is normative; the validator is convenience. Both are exercised by the conformance suite.

---

## 3. Identity and hashing

### 3.1 How a block gets a stable id

Ids are derived, not assigned. That is the whole trick. `token:color:acme-accent` comes from the CSS variable `--acme-accent`, via:

```ts
function slugFromCssVar(cssVar: string): string {
  return cssVar.replace(/^--/, "").replace(/^color-/, "");
}
```

The consequence is that the same repo scanned twice produces the same ids, so version history attaches to the right block without any identity resolution step. The cost is that renaming a CSS variable is indistinguishable from deleting one block and creating another: the old id goes `stale` at its last official version and a new id appears at v1. There is no rename operation in the IR.

Ids get sanitized once more on the way to disk:

```ts
function safeKey(ref: string): string {
  return ref.replace(/[^a-zA-Z0-9._-]/g, "_");
}
```

So `token:color:acme-accent` is stored as `token_color_acme-accent.json` in the registry, and as `token__color__acme-accent.json` in the block store (which uses a different escape, `b.id.replace(/:/g, "__")`). Two escapes for the same id in two stores. It works because nothing round-trips a filename back into an id, but it is the kind of thing that bites later.

### 3.2 Canonical hashing

`src/lib/ir/hash.ts` is 58 lines and is the most load-bearing file in the repository. Its header says so:

```ts
/**
 * Canonical hashing for blocksmith.blocks.v1.
 *
 * Two graphs that mean the same thing must hash the same, regardless of key
 * order, whitespace, or which adapter produced them. This is the property the
 * lock file's staleness detection rests on (research doc 6.3).
 *
 * CONSTITUTIONAL: must stay byte-identical to packages/protocol/src/hash.ts.
 * The drift gate (npm run protocol:conformance) fails CI if they diverge.
 * Changing semantics here is a blocks.v2 spec bump with professor sign-off.
 */
```

The three functions:

```ts
/** Deterministic JSON: object keys sorted recursively, arrays preserved. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v === undefined) continue;
      out[key] = sortValue(v);
    }
    return out;
  }
  return value;
}

/** Content hash of a block: id + type + canonical content. Prefixed for clarity. */
export function blockContentHash(
  id: string,
  type: string,
  content: unknown,
): string {
  return `sha256:${sha256Hex(`${id} ${type} ${canonicalJson(content)}`).slice(0, 32)}`;
}

/**
 * Graph hash: order-independent digest over (id, version, contentHash) triples.
 * The lock file stores this; CI compares it against the live registry.
 */
export function graphHash(
  entries: { id: string; version: number; contentHash: string }[],
): string {
  const lines = entries
    .map((e) => `${e.id}@${e.version}:${e.contentHash}`)
    .sort()
    .join("\n");
  return `sha256:${sha256Hex(lines).slice(0, 32)}`;
}
```

Read the properties off the code, because third parties depend on them:

1. **Object key order is irrelevant.** `{a:1,b:2}` and `{b:2,a:1}` hash identically. The conformance suite asserts this.
2. **Array order is significant.** A reordered do's list is a new version. That is deliberate: order carries meaning in a prioritized list.
3. **`undefined` properties are dropped**, so an adapter that sets `line: undefined` matches one that omits `line`.
4. **The separator is a single ASCII space** between id, type, and canonical content.
5. **Truncation is the first 32 hex characters**, i.e. 128 bits. Enough for collision resistance in this use, short enough to read in a terminal.
6. **The graph hash is order-independent**, because the lines are sorted before joining. Two builds of the same official set produce the same graph hash regardless of directory read order.
7. **`title` is not hashed.** Only `id`, `type`, and `content`. Retitling does not bump a version.

Point 4 has a scar attached. From `docs/PROTOCOL-GOVERNANCE.md`:

> **v1 canonicalization decision (June 2026):** the id/type/content separator is a single ASCII space. An early app build accidentally embedded a NUL byte; the drift gate caught it on first run and the app was corrected to spec. Pre-existing local registries self-heal: next ingest records new versions, locks re-pin.

That is the single best argument in this repo for having a drift gate at all. A one-byte divergence between the app and the published package would have silently produced two incompatible hash universes, and nothing else in the system would have noticed.

### 3.3 Verify it yourself

Take the real accent token from `.blocksmith/registry/upload_scan-acme-ui-kit.md/token_color_acme-accent.json` at version 2. The canonical string that gets hashed is:

```
token:color:acme-accent token {"agentHint":"Use Acme Accent (--acme-accent) #e85d4a for Defined in `src/app/globals.css`","cssVar":"--acme-accent","group":"Design tokens","summary":"Defined in `src/app/globals.css`","value":"#e85d4a"}
```

sha256 of that, first 32 hex chars, prefixed: `sha256:b5177e3edbe22de9acc51125681fc6b3`. That is exactly the `contentHash` stored on that version record, and exactly what `.blocksmith/blocksmith.lock` pins for `token:color:acme-accent`. The hash chain is real and you can reproduce it in a Node one-liner.

### 3.4 What counts as a change

A change is any difference in `canonicalJson(content)`, full stop. That is a stronger statement than it sounds:

- Editing a component's `description` in the wiki is a change, because `description` lives in `content`.
- Changing a color from `#e85d4a` to `#E85D4A` is a change, because canonicalization normalizes key order, not value case.
- Reordering the do's list is a change.
- Renaming the block's `title` is **not** a change.
- Re-running an identical scan is not a change, which is why re-scan is idempotent (`recordIngest` reports it in `unchanged`).
- Changing `source.file` or `updatedAt` is **not** a change, because neither is hashed. A block whose content is identical but whose source moved does not get a new version. That is usually what you want and occasionally surprising.

### 3.5 The other hash you will trip over

There is a second, older content hash in `src/lib/blocks/extract.ts`:

```ts
function hashSlice(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

const contentHash = hashSlice(
  `${partial.id}:${partial.type}:${JSON.stringify(partial.content)}`,
);
```

Different separator (`:` not space), different length (16 not 32), no `sha256:` prefix, no canonicalization. It is what the block *store* writes into `.blocksmith/blocks/<doc>/<id>.json`. Look at the real file for the accent token and you see `"contentHash": "88ad64ae867819cc"`, while the registry entry for the same block says `"contentHash": "sha256:b5177e3edbe22de9acc51125681fc6b3"`.

`recordIngest` ignores the incoming value and recomputes with the canonical function:

```ts
const contentHash = blockContentHash(b.id, b.type, b.content);
```

So the legacy hash never contaminates the protocol. But it does mean two files on disk describe the same block with two different hashes, and a newcomer reading `.blocksmith/blocks/` will conclude that hashes do not match the lock. They do not. Those are not the hashes the lock uses.

---

## 4. Versions and the official pointer

### 4.1 The two records

```ts
/** One immutable version record in the registry. */
export interface BlockVersionRecord {
  version: number;
  status: BlockStatus;
  title: string;
  type: BlockType;
  content: Record<string, unknown>;
  contentHash: string;
  source: { file: string; line?: number; ingest?: IngestSource };
  updatedAt: string;
  createdAt: string;
  finalizedAt?: string;
  editedBy?: EditOrigin;
}

/** Per-block registry entry: append-only versions + the official release pointer. */
export interface BlockRegistryEntry {
  id: string;
  /** Version number currently promoted (lock-eligible). Absent = never promoted. */
  official?: number;
  versions: BlockVersionRecord[];
}
```

That is the entire version model. An append-only array plus one integer pointer. The mental model the code comments give is npm: history is immutable, the tag moves.

`official` absent means the block has never been promoted, and therefore no agent, package build, or device compile may see it. Not "sees an old version": sees nothing.

The append-only rule is machine-enforced by the published validator, which is worth knowing because it means a hand-edited registry file fails conformance:

```ts
if (typeof v.version !== "number" || v.version <= prev) {
  ctx.fail(
    `$.versions[${i}].version`,
    `versions must be strictly ascending (append-only); got ${v.version} after ${prev}`,
  );
}
```

and

```ts
if (!versions.includes(input.official as number)) {
  ctx.fail(
    "$.official",
    `official pointer v${input.official} not present in versions, pointers may only reference recorded versions`,
  );
}
```

### 4.2 Ingest: how a version comes to exist

`recordIngest` in `src/lib/ir/registry.ts` is the only function that creates versions. Its contract, from its own docblock:

```
 * - New id                          -> version 1
 * - Same id, same contentHash       -> no-op
 * - Same id, changed contentHash    -> version N+1
 * - Id present in registry, absent from ingest -> latest marked "stale"
```

The heart of it:

```ts
if (last && last.contentHash === contentHash) {
  // Content identical. Clear staleness if a previous pass marked it.
  if (last.status === "stale") {
    last.status = entry.official === last.version ? "finalized" : "draft";
    writeEntry(docRef, entry);
  }
  report.unchanged.push(b.id);
} else {
  const version = (last?.version ?? 0) + 1;
  const autoPromote =
    (SCAN_FACT_TYPES.has(b.type) && editedBy === "ingest") ||
    (version === 1 && b.status === "finalized");
  const conflict = b.status === "conflict";

  const record: BlockVersionRecord = {
    version,
    status: conflict ? "conflict" : autoPromote ? "finalized" : "draft",
    ...
    ...(autoPromote && !conflict ? { finalizedAt: now } : {}),
  };
  entry.versions.push(record);
  if (autoPromote && !conflict) entry.official = version;
  writeEntry(docRef, entry);
```

Two lines carry the entire truth-precedence policy:

```ts
/** Block types whose ingest source (the repo) is authoritative. Auto-promote. */
const SCAN_FACT_TYPES = new Set(["token", "component"]);
```

```ts
const autoPromote =
  (SCAN_FACT_TYPES.has(b.type) && editedBy === "ingest") ||
  (version === 1 && b.status === "finalized");
```

Read the conjunction carefully, because people misread it constantly. A token block auto-promotes **only when `editedBy === "ingest"`**, that is, only when a scan produced it. The same token block edited by a human in the wiki arrives with `editedBy: "web"` and stages as a draft. Code changes go live automatically; human changes wait for a promote. That asymmetry is the product.

The second clause is a bootstrap: the very first version of a block that its adapter already declared `finalized` becomes official immediately, so a first scan does not leave you staring at forty unpromoted blocks.

Staling is a separate pass at the end, and it is skipped for partial ingests:

```ts
// Blocks that vanished from the source are stale, not deleted. The lock
// may still pin them; a human decides in the wiki. Partial adapter passes
// never stale blocks owned by other sources.
if (!options?.partial) {
  for (const entry of listRegistryEntries(docRef)) {
    if (seen.has(entry.id)) continue;
    const last = latest(entry);
    if (last && last.status !== "stale") {
      last.status = "stale";
      writeEntry(docRef, entry);
      report.staled.push(entry.id);
    }
  }
}
```

The `partial` flag exists because of the Storybook adapter. A Storybook ingest contributes component blocks alongside a repo scan; without `partial`, it would mark every token in the doc stale simply because Storybook did not mention them.

Note also that staling **mutates a version record in place** (`last.status = "stale"`). Append-only applies to the array, not to the status field of the newest record. That is a real, deliberate exception, and it is also how un-staling works when the block reappears.

### 4.3 Promote, rollback, resolve

```ts
/** Human gate: promote the latest version of a block to official. */
export function promoteBlock(
  docRef: string,
  blockId: string,
  systemId = "",
  options?: PromoteOptions,
): PromoteResult {
  const entry = readEntry(docRef, blockId);
  if (!entry) return { ok: false, id: blockId, error: "Unknown block id" };
  const last = latest(entry);
  if (!last) return { ok: false, id: blockId, error: "No versions recorded" };
  if (last.status === "conflict") {
    return {
      ok: false,
      id: blockId,
      error:
        "Block is in conflict, resolve the disagreeing sources before promoting.",
    };
  }
  const previousOfficial = entry.official;
  last.status = "finalized";
  last.finalizedAt = new Date().toISOString();
  entry.official = last.version;
  writeEntry(docRef, entry);
  if (!options?.deferManifest) writeManifest(docRef, systemId);
  return { ok: true, id: blockId, version: last.version, previousOfficial };
}
```

Three things to notice. Promote always targets the **latest** version, never an arbitrary one: there is no "promote v3 while v5 exists". Conflict is a hard block, and the only escape is `resolveConflict`, which is a separate explicit call requiring `resolveConflicts: true` in the API body. And `deferManifest` exists purely for batch performance, documented in the code:

```ts
   * Skip the per-call manifest rebuild. Batch callers (promote route) set this
   * and call updateManifest() once at the end. Writing the manifest after
   * every block in a 40-block promote is O(N^2) directory scans plus N
   * fire-and-forget Supabase manifest upserts.
```

Rollback moves the pointer backwards to the nearest **previously finalized** version:

```ts
const prior = [...entry.versions]
  .filter((v) => v.version < entry.official! && v.finalizedAt)
  .sort((a, b) => b.version - a.version)[0];
```

The `v.finalizedAt` filter is what makes this safe. You cannot roll back onto a version that was never in production, so you can never accidentally ship a draft by rolling back. Rollback is single-step: to go back three releases you click three times, each one recorded as its own run.

### 4.4 The event table, with code paths

This is the table from `docs/TEAM-NORTH-STAR.md`, reproduced in full, with the implementing code path added for each row.

| Event | What happens | Who sees it | Code path |
|-------|--------------|-------------|-----------|
| **First scan / ingest** | New block becomes **v1**; scan facts (`token`/`component`) **auto-promote** to official | Wiki and agents | `persistBlocksForDoc` (`src/lib/blocks/store.ts`) calls `recordIngest`; `version = (last?.version ?? 0) + 1` yields 1; `autoPromote` true via `SCAN_FACT_TYPES.has(b.type) && editedBy === "ingest"`, or via the `version === 1 && b.status === "finalized"` bootstrap; `entry.official = version` |
| **Re-scan, code unchanged** | No new version | Nobody | `recordIngest`: `last.contentHash === contentHash` branch pushes to `report.unchanged` and writes nothing |
| **Re-scan, token or color changed in repo** | New **vN**; scan fact auto-promotes, because code wins | Wiki updates; the lock goes **stale** until pulled | `recordIngest` else-branch: new record with `status: "finalized"`, `entry.official = version`. Lock staleness surfaces via `verifyLock` (`src/lib/ir/lock.ts`) comparing `lock.contentHash` against `officialGraphHash(docRef)` |
| **Designer edits governance** | New **draft vN+1** | Wiki preview only; agents stay on the old official version | `POST /api/wiki/finalize` writes the markdown, then calls `refreshBlocksForDoc(doc, "web")`. Because `editedBy === "web"`, `autoPromote` is false, so `status: "draft"` and `entry.official` is untouched |
| **Human Finalize (Promote)** | Official pointer moves to vN+1; lock regenerated | Agents and CI use the new version | `POST /api/wiki/promote` calls `promoteBlock` per id, then `updateManifest`, then `writeReferenceLock(doc)`, then awaits `syncRegistryToCloud` and `syncLockToCloud` |
| **Rollback** | Official pointer moves to an older vN; history kept | Production reverts | `POST /api/wiki/rollback` calls `rollbackBlock`, then `writeReferenceLock(doc)`, then awaits both cloud syncs, then `appendRunDurable` |
| **Block removed from repo** | Marked **stale**; the last official version stays in the lock until a human acts | Wiki banner | `recordIngest` final loop sets `last.status = "stale"` for ids not in `seen`. The official pointer is untouched, so `getOfficialBlocks` still returns it and `buildLock` still pins it. `verify:ir-cicd` asserts exactly this: `buildLock(DOC).blocks["component:button-primary"]?.version === 1` |

One row deserves emphasis because it is counterintuitive. "Block removed from repo" does **not** remove it from the lock. The block's `official` pointer still points at a finalized version, `getOfficialBlocks` still materializes it, and agents keep using it. Only the `latest` record is flagged stale, and the wiki shows a banner. Deleting a component from the repo does not silently delete design truth from under agents mid-sprint. Somebody has to decide.

### 4.5 What "production" means, precisely

Production is the set `{ officialRecord(entry) for every entry where entry.official != null }`. Nothing else. Materialized by:

```ts
/** All officially promoted blocks. The only truth agents may execute against. */
export function getOfficialBlocks(docRef: string): BlocksmithBlockV1[] {
  const out: BlocksmithBlockV1[] = [];
  for (const entry of listRegistryEntries(docRef)) {
    const rec = officialRecord(entry);
    if (!rec) continue;
    out.push(recordToBlock(entry.id, rec));
  }
  return out;
}

/** Materialize the official graph as a blocksmith.blocks.v1 document. */
export function getOfficialGraph(
  docRef: string,
  systemId = "",
): BlocksmithGraphV1 {
  const blocks = getOfficialBlocks(docRef);
  return {
    schema: BLOCKS_SCHEMA,
    docRef,
    systemId: systemId || readManifest(docRef)?.systemId || "",
    contentHash: graphHash(blocks),
    blocks,
  };
}
```

There is no environment concept and no branch concept. One pointer per block, one production per doc. `docs/TEAM-NORTH-STAR.md` sketches optional v2 environments as "same model, different pointers", which is the right shape, and it is **Planned**, not built.

### 4.6 The read model on top

`src/lib/ir/releases.ts` joins registry state and lock state into rows a human can act on. It is the only place the derived predicates live, and the Pipeline and Releases UIs both consume it:

```ts
const conflict = latest.status === "conflict";
const stale = latest.status === "stale";
const draftPending =
  latest.status === "draft" &&
  (e.official == null || latest.version > e.official);
const canRollback =
  e.official != null &&
  e.versions.some((v) => v.version < e.official! && Boolean(v.finalizedAt));
```

and

```ts
canPromote: draftPending || conflict,
```

`src/lib/ir/diff.ts` produces the field-level production-versus-staging diff shown in the promote drawer, including hex detection so the UI can render swatches. The rule that the Pipeline console enforces socially, that you review a diff before promoting, is implemented there, not in the registry.

---

## 5. The registry

### 5.1 On disk

Storage layout, from the registry's own header comment and the code:

```
.blocksmith/
  index.json                       block store index, all docs, one file
  blocks/<docKey>/<id>.json        StoredBlock mirror (wiki-shaped)
  registry/<docKey>/<blockId>.json BlockRegistryEntry (versions + official)
  registry/<docKey>/manifest.json  RegistryManifest
  locks/<docKey>.lock              per-doc reference lock
  blocksmith.lock                  legacy single-lock mirror
  runs/<docKey>.json               pipeline run log
  design/<docKey>/ir.json          wiki theme IR (the other IR)
```

`<docKey>` is `docRef.replace(/[^a-zA-Z0-9._-]/g, "_")`, so `upload:scan-acme-ui-kit.md` becomes `upload_scan-acme-ui-kit.md`.

One JSON file per block, holding the block's entire version history. `component:button` in the acme fixture currently holds 53 version records in one file. Reads are `readdirSync` plus `JSON.parse` per file, with corrupt files silently skipped:

```ts
} catch {
  /* skip corrupt */
}
```

The manifest is a per-doc summary, recomputed on every write, deliberately in a single directory pass:

```ts
// Single directory pass: counts AND the official graph hash come from one
// listRegistryEntries() read (officialGraphHash() would re-scan the dir).
```

The real manifest for the acme fixture right now:

```json
{
  "schema": "blocksmith.registry.v1",
  "docRef": "upload:scan-acme-ui-kit.md",
  "systemId": "acme-ui-kit",
  "lastIngestAt": "2026-07-02T16:27:30.069Z",
  "officialGraphHash": "sha256:a667c0b7499f1981687454e1160a7497",
  "blockCount": 14,
  "promotedCount": 13,
  "draftCount": 2,
  "staleCount": 1
}
```

### 5.2 The serverless problem

Here is the thing you must internalize before you debug anything in production. `src/lib/runtime/writable-root.ts`:

```ts
export function isServerlessHosted(): boolean {
  return process.env.VERCEL === "1" || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
}

/** Writable `.blocksmith` root. Local dev only; serverless skips disk audit (tiny /tmp). */
export function blocksmithWritableRoot(): string {
  if (isServerlessHosted()) {
    return join(tmpdir(), "blocksmith");
  }
  return join(process.cwd(), ".blocksmith");
}
```

On Vercel, the entire registry lives in `/tmp` on one lambda instance. It is not shared between instances and it does not survive a freeze. The registry is, on paper, a synchronous filesystem API. In production the filesystem is a cache.

### 5.3 The cloud mirror

`src/lib/ir/cloud-registry.ts` is what makes it durable, and it is explicitly best-effort and env-gated:

```ts
 * The disk registry (src/lib/ir/registry.ts) stays the synchronous source the
 * control plane reads. This module mirrors writes to Supabase (fire-and-forget)
 * and hydrates a cold disk from the cloud before reads. Everything is env-gated
 * and best-effort: without Supabase configured, BlockSmith behaves exactly as
 * before.
```

Three Supabase tables, from `supabase/schema-registry.sql`:

```sql
create table if not exists blocksmith_block_registry_entries (
  doc_ref text not null,
  block_id text not null,
  versions jsonb not null default '[]'::jsonb,
  official integer,
  updated_at timestamptz not null default now(),
  primary key (doc_ref, block_id)
);

create table if not exists blocksmith_registry_manifest (
  doc_ref text primary key,
  ...
);

create table if not exists blocksmith_block_locks (
  doc_ref text primary key,
  lock jsonb not null,
  content_hash text not null,
  generated_at timestamptz not null default now()
);
```

There are two write paths, and the difference between them is the difference between a promote that survives and one that vanishes.

**Fire-and-forget.** Every `writeEntry` fires a mirror:

```ts
void import("./cloud-registry")
  .then((m) => m.mirrorEntry(docRef, entry))
  .catch(() => {});
```

`mirrorEntry` does not hit the network immediately. It coalesces, because a 200-block scan would otherwise open 200 concurrent upserts:

```ts
const pendingEntries = new Map<string, Map<string, BlockRegistryEntry>>();
let flushScheduled = false;
...
docQueue.set(entry.id, entry);
if (!flushScheduled) {
  flushScheduled = true;
  setTimeout(() => {
    void flushPendingEntries().catch(() => {});
  }, 25);
}
```

A 25 millisecond timer on a lambda that may be frozen the moment the response is sent. On an ingest path that is an acceptable loss, because the next ingest reproduces the same content.

**Awaited.** Every path that changes production awaits instead:

```ts
await Promise.all([syncRegistryToCloud(doc), syncLockToCloud(doc, lock)]);
```

with the reasoning spelled out in `src/app/api/wiki/promote/route.ts`:

```ts
// Durability: the response must not outrun persistence. A frozen lambda
// drops fire-and-forget mirrors, silently losing the promote. But a cloud
// outage must not turn a promote that ALREADY SUCCEEDED into a 500: degrade
// loudly (run log + response flag), never fail the action.
```

If the awaited sync throws, the route logs it, sets `persisted = false`, and returns `persistenceWarning` in the response body. The promote still happened locally. It may not survive a cold start. The operator is told.

### 5.4 Hydration

The reverse direction. A cold lambda has an empty `/tmp`, so a synchronous `listRegistryEntries` would return nothing and the Pipeline would render an empty production lane after a successful promote elsewhere. `hydrateRegistryFromCloud` pulls the rows back down and writes them to `/tmp` before the synchronous reads happen:

```ts
const warm =
  existsSync(dir) &&
  readdirSync(dir).some((f) => f.endsWith(".json") && f !== "manifest.json");
if (warm) return;
```

with a separate warmth check for the lock, because the two can diverge:

```ts
// Lock has its own warm check. The registry dir can be warm while the
// pinned lock is still missing on this instance.
await hydrateLockFromCloud(docRef);
```

Every write route calls `await hydrateRegistryFromCloud(doc)` as its first real action. `src/lib/ir/ensure-pipeline-registry.ts` wraps the read path and adds a rebuild fallback, plus a performance rule learned the hard way:

```ts
     * Awaited push to Supabase even when the registry is already warm.
     * Write paths (scan/ingest) set this so the next cold lambda sees their
     * writes; read paths must NOT. Syncing on every Pipeline GET turned each
     * page view into N registry writes and dominated cold-load latency
```

### 5.5 Durability, honestly

| Configuration | What survives |
|---------------|---------------|
| Local dev, no Supabase | Everything, in `.blocksmith/`, committed to git if you want it |
| Vercel, Supabase configured, promote or rollback or pin-lock | Registry entries, manifest, lock, run log. Awaited before the response |
| Vercel, Supabase configured, plain scan or ingest | Best-effort. The 25ms coalesced flush may be lost on freeze, but a re-ingest reproduces identical content and hashes, so the loss is recoverable |
| Vercel, Supabase not configured | Nothing survives a cold start. `saasDbEnabled()` returns false, `db()` returns null, every mirror and hydrate call becomes a no-op |

There is one more honesty gate worth knowing. Preview docs (pasted or uploaded markdown with no repo behind them) never enter the registry at all:

```ts
// Step 1 honesty: a preview doc (paste / upload / bundled sample) has no repo
// behind it. Skip the version registry + auto-promote entirely so it never
// shows fake "production" versions.
if (getDocLifecycle({ mode: system.mode }) === "preview") {
  return { docRef, systemId: system.id, ..., blockIds: [], blockCount: 0 };
}
```

A pasted design doc renders a wiki but has no versions, no lock, and no Pipeline. That is a product decision encoded in the ingest path: we do not show a fake release console for something not wired to a codebase.

---

## 6. `blocksmith.lock`

### 6.1 What it is

The deploy artifact. Same role as `package-lock.json`: agents and CI resolve against pinned versions instead of "latest markdown". It lives in the customer's repository next to `DESIGN.md`; BlockSmith keeps a reference copy per doc.

```ts
/** blocksmith.lock. Lives in the customer repo, pins agent/CI truth. */
export interface BlocksmithLockV1 {
  schema: typeof LOCK_SCHEMA;
  docRef: string;
  systemId: string;
  /** Official graph hash at lock time. Staleness sentinel. */
  contentHash: string;
  generatedAt: string;
  blocks: Record<string, { version: number; contentHash: string }>;
  package?: { name: string; pulseBuild?: string };
}
```

A real one, `.blocksmith/blocksmith.lock`, abbreviated in the middle:

```json
{
  "schema": "blocksmith.lock.v1",
  "docRef": "upload:scan-acme-ui-kit.md",
  "systemId": "acme-ui-kit",
  "contentHash": "sha256:85cbd664d69a41d6b63ae686790588a6",
  "generatedAt": "2026-07-02T16:27:15.725Z",
  "blocks": {
    "agent-rule:guide": { "version": 1, "contentHash": "sha256:3929a79c3321bc4ba5323ea1dd25e0ec" },
    "component:badge":  { "version": 3, "contentHash": "sha256:4d1aefbb9318601d96d7c5bf94d9477a" },
    "component:button": { "version": 50, "contentHash": "sha256:4d5de5c5e5ede59028e3803f7e8549a6" },
    "component:card":   { "version": 3, "contentHash": "sha256:4c7df6f53136344c4b8922154ce31edf" },
    "component:input":  { "version": 3, "contentHash": "sha256:8507a05cde12383bfc77e8a6fa3245ed" },
    "token:color:acme-accent": { "version": 2, "contentHash": "sha256:b5177e3edbe22de9acc51125681fc6b3" },
    "token:color:acme-text":   { "version": 2, "contentHash": "sha256:db64a4c7b5ab8ceeaff06fabd8ef0702" },
    "token:color:ffffff":      { "version": 2, "contentHash": "sha256:f5c2a55eda52ce7f580b96f12a1cd8c3" }
  }
}
```

### 6.2 What it pins, and what it does not

It pins exactly the official graph: every block with an `official` pointer, at that version, with that content hash. Nothing else. Drafts are absent. Conflicts are absent. Never-promoted blocks are absent. Stale blocks whose last official version still stands **are** present.

It does not pin content. Only `{ version, contentHash }`. An agent holding only the lock knows which version it is entitled to and can detect tampering, but it must still fetch the content from BlockSmith. The lock is an integrity and resolution artifact, not a cache.

The optional `package` field links a Pulse npm build to the graph state that produced it.

### 6.3 Who writes it

`buildLock` and `writeReferenceLock` in `src/lib/ir/lock.ts`:

```ts
/** Build a lock from the registry's official (promoted) graph. */
export function buildLock(
  docRef: string,
  options?: { packageName?: string; pulseBuild?: string },
): BlocksmithLockV1 {
  const blocks = getOfficialBlocks(docRef);
  const pinned: BlocksmithLockV1["blocks"] = {};
  for (const b of [...blocks].sort((x, y) => x.id.localeCompare(y.id))) {
    pinned[b.id] = { version: b.version, contentHash: b.contentHash };
  }
  return {
    schema: LOCK_SCHEMA,
    docRef,
    systemId: readManifest(docRef)?.systemId ?? "",
    contentHash: graphHash(blocks),
    generatedAt: new Date().toISOString(),
    blocks: pinned,
    ...
  };
}
```

Ids are sorted before insertion, so the JSON key order is deterministic and two builds of the same graph produce byte-identical files apart from `generatedAt`. `verify:ir-cicd` asserts the hash half of that:

```ts
const lockAgain = buildLock(DOC);
check(
  "deterministic: same graph -> same lock hash",
  lock1.contentHash === lockAgain.contentHash,
);
```

Three routes write it: `POST /api/wiki/promote`, `POST /api/wiki/rollback`, and `POST /api/wiki/pin-lock`. Plus `POST /api/wiki/finalize` when called with `promote: true`, the explicit one-step escape hatch.

`pin-lock` exists for a specific dead end, described in its own docblock:

```ts
 * POST /api/wiki/pin-lock. Fix the "40 Live, no lock" dead end.
 *
 * When ingest auto-promoted everything and there is nothing to click,
 * the production graph is ready but agents are unpinned. This writes the
 * reference lock from the current official graph and logs a run.
```

That is a direct consequence of auto-promotion: a first scan promotes everything, so the Pipeline has no drafts to promote, so nothing ever triggers a lock write. Pin-lock is the button that closes that hole.

### 6.4 Per-doc locks

There is a legacy single path and an authoritative per-doc path:

```ts
/** Per-doc reference locks. Promoting doc A must never clobber doc B's pin. */
function docLockPath(docRef: string): string {
  const key = docRef.replace(/[^a-zA-Z0-9._-]/g, "_");
  return join(blocksmithWritableRoot(), "locks", `${key}.lock`);
}
```

`writeReferenceLock` writes the per-doc file and best-effort mirrors to `.blocksmith/blocksmith.lock` for older tooling. Reads prefer per-doc and fall back to legacy, and both are checked for a matching `docRef`:

```ts
export function readReferenceLockForDoc(
  docRef: string,
): { lock: BlocksmithLockV1; path: string } | null {
  const perDoc = docLockPath(docRef);
  const fromPerDoc = readLock(perDoc);
  if (fromPerDoc && fromPerDoc.docRef === docRef) {
    return { lock: fromPerDoc, path: perDoc };
  }
  const legacy = readLock();
  if (legacy && legacy.docRef === docRef) {
    return { lock: legacy, path: legacyReferenceLockPath() };
  }
  return null;
}
```

### 6.5 Who reads it, and how it reaches the customer's repo

| Reader | Path | What it does with it |
|--------|------|----------------------|
| `GET /api/v1/lock` | `src/app/api/v1/lock/route.ts` | Builds a fresh lock and returns it as JSON, or as a file download with `?format=file` and `Content-Disposition: attachment; filename="blocksmith.lock"` |
| `GET /api/v1/scans/pull` | `src/app/api/v1/scans/pull/route.ts` | Bundles the lock into the pull payload alongside `DESIGN.md`, best-effort and nullable |
| `blocksmith pull` (CLI) | `packages/cli/src/pull.ts` | Writes it to the repo root via `writeLock` in `packages/sdk/src/design-md.ts` |
| `get_lockfile` (MCP) | `src/mcp/handlers.ts` | Returns the lock plus `getLockStatus`, so an agent can compare against the repo copy |
| `npm run validate:ui` | `scripts/validate-ui.ts` | The CI gate. Section 7.8 |
| Pipeline and Releases UI | `src/lib/ir/releases.ts` | `lockBody` for display, `lock` for the freshness banner |

The pull path is deliberately soft, because a doc with nothing promoted has no lock and that must not break a pull:

```ts
    // Design CI/CD: pull delivers the lock alongside DESIGN.md so the repo
    // pins exactly the block versions a human promoted in the wiki.
    let lock = null;
    try {
      ensureDocBlocks(docParam);
      lock = buildLock(docParam);
    } catch (err) {
      console.warn("[api/v1/scans/pull] lock build skipped:", err);
    }
```

and the CLI says so plainly rather than failing:

```ts
  if (response.lock) {
    writeLock(workspaceRoot, response.lock);
    console.log("  ok blocksmith.lock: pinned versions for CI & agents");
  } else {
    console.log("  .. blocksmith.lock skipped: promote blocks in the Pipeline to pin versions");
  }
```

Two details worth flagging. The CLI serializes with its own `JSON.stringify(lock, null, 2)` rather than importing `serializeLock`, so there are two serializers producing (currently) identical bytes. And `GET /api/v1/lock` reports `fresh` by verifying a lock it **just built** against the registry it built it from, which is a tautology: that field is effectively always `true`. Real staleness detection is `getLockStatus`, which reads the persisted reference lock. Do not read `fresh` from that route and conclude anything.

### 6.6 Staleness, and how it is detected

Staleness is one comparison:

```ts
const stale = lock.contentHash !== registryHash;
```

where `registryHash` is `officialGraphHash(docRef)`, the order-independent hash over `(id, version, contentHash)` of the current official graph. Any promote, any rollback, any auto-promoting re-scan changes some block's version or content hash, which changes the graph hash, which flips `stale` to true. There is no timestamp comparison and no polling. Staleness is a pure function of content.

`verifyLock` reports four distinct failure modes, not one:

```ts
export interface LockVerification {
  ok: boolean;
  stale: boolean;
  missingInLock: string[];
  missingInRegistry: string[];
  versionMismatches: { id: string; locked: number; official: number }[];
  hashMismatches: string[];
  lockHash: string;
  registryHash: string;
}
```

| Signal | Cause |
|--------|-------|
| `stale` | The graph moved since the lock was written. The normal case. Fix: re-pull |
| `missingInLock` | A block was promoted after the lock was written |
| `missingInRegistry` | The lock pins an id the registry no longer promotes. Usually a rollback to a state before the block existed, or a doc mixup |
| `versionMismatches` | Pin points at v50 while production is v53. Reported per block, so the UI can say "3 blocks drifting" |
| `hashMismatches` | Same version number, different content hash. This is the interesting one: it means the lock was hand-edited or corrupted, or somebody rewrote history. The protocol package words it exactly that way: `"contentHash mismatch, lock corrupted or hand-edited"` |

### 6.7 A live stale lock, right now, in this repo

You do not need to construct an example. The committed acme fixture is currently stale. Recompute the official graph hash from `.blocksmith/registry/upload_scan-acme-ui-kit.md/` and compare it to `.blocksmith/locks/upload_scan-acme-ui-kit.md.lock`:

```
official blocks:      13
registry graph hash:  sha256:a667c0b7499f1981687454e1160a7497
lock contentHash:     sha256:85cbd664d69a41d6b63ae686790588a6
pinned blocks:        13
drift: component:button  locked v50, official v53
```

Twelve of thirteen pins are correct. One block, `component:button`, moved from v50 to v53 through later scans, and nobody re-pinned. `verifyLock` on this doc returns `ok: false`, `stale: true`, and one entry in `versionMismatches`. `getLockStatus` surfaces it as `fresh: false` with a drift payload, and the Pipeline lock strip renders the drift counter from exactly that.

### 6.8 How staleness reaches a human

`src/lib/ir/enforce.ts` shapes it for every UI and tool that asks:

```ts
export function getLockStatus(docRef: string): LockStatus {
  const found = readReferenceLockForDoc(docRef);
  if (!found) {
    return { present: false, path: referenceLockPath(docRef) };
  }
  const { lock, path } = found;
  const v = verifyLock(docRef, lock);
  return {
    present: true,
    path,
    docRef: lock.docRef,
    contentHash: lock.contentHash,
    generatedAt: lock.generatedAt,
    pinnedBlocks: Object.keys(lock.blocks).length,
    fresh: v.ok,
    drift: v.ok
      ? undefined
      : {
          versionMismatches: v.versionMismatches,
          missingInLock: v.missingInLock,
          missingInRegistry: v.missingInRegistry,
        },
  };
}
```

Three states, three UI treatments: no lock (pin-lock CTA), stale (drift counter plus pull command), fresh (hash badge). `src/components/wiki/pipeline/LockStrip.tsx` and `src/components/wiki/LockStatusCard.tsx` render them.

---

## 7. Enforcement

### 7.1 What enforcement actually is

Be precise here, because the marketing sentence and the implementation are not the same sentence.

The marketing sentence is "agents physically cannot hallucinate your design system". The implementation is: the server materializes a filtered list and returns it. There is no refusal, no error, no 403 when an agent asks about a draft block. The draft simply is not in the response, and the agent has no way to name it.

`src/lib/ir/enforce.ts`:

```ts
/**
 * Blocks an agent is allowed to execute against: official versions only.
 * Draft, conflict, and never-promoted blocks are filtered out. That is the
 * enforcement boundary (research doc 4.6 row 4).
 */
export function listGovernedBlocks(docRef: string): GovernedBlock[] {
  ensureDocBlocks(docRef);
  const official = getOfficialBlocks(docRef);
  ...
  const stored = new Map(listStoredBlocks(docRef).map((b) => [b.id, b]));
  const out: GovernedBlock[] = [];
  for (const b of official) {
    if (b.status === "conflict" || b.status === "draft") continue;
    const base = stored.get(b.id);
    out.push({
      id: b.id,
      type: b.type,
      title: b.title,
      source: b.source,
      updatedAt: b.updatedAt,
      contentHash: b.contentHash,
      status: b.status,
      docRef: base?.docRef ?? docRef,
      content: b.content as StoredBlock["content"],
      version: b.version,
      finalizedAt: b.finalizedAt,
    });
  }
  return out;
}
```

Two filters stack. `getOfficialBlocks` already excludes anything with no `official` pointer. The explicit `if (b.status === "conflict" || b.status === "draft") continue` is belt and braces for the case where a version record is official but somehow carries a non-finalized status. Content comes from the **registry**, not the store, with the reasoning in the code:

```ts
// Stored blocks carry the freshest formatting metadata; the registry decides
// WHICH version is real. Serve registry content, keep store docRef shape.
```

That line is the whole enforcement design in one sentence. The store may be newer. The registry decides.

Every governed block carries `version` and `finalizedAt`, so a long-running agent session can tell that its truth moved underneath it, which is the stated purpose:

```ts
 * Agents never read drafts. Every MCP read resolves through the registry's
 * official pointers and is annotated with the pinned version, so a long-running
 * agent session can detect that its truth went stale mid-task.
```

The annotation is literal. `src/mcp/handlers.ts` stamps the pin into the text the model reads:

```ts
export function formatBlockForAgent(block: StoredBlock): string {
  const pin =
    block.version != null
      ? `, pinned v${block.version} (${block.contentHash})`
      : "";
  const lines = [`## ${block.title} (${block.id})${pin}`, ""];
```

### 7.2 Which MCP tools are actually governed

The MCP server is defined in `src/lib/mcp/blocksmith-server.ts` (tool list, dispatch, and the instruction string sent to every client) with handlers in `src/mcp/handlers.ts`. It is served two ways: stdio for local IDEs (`src/mcp/server.ts`) and stateless Streamable HTTP behind `requireApiKey` (`src/lib/mcp/http-handler.ts`, `src/app/api/mcp/route.ts`).

Only some tools go through the IR. This table matters, because "MCP is lock-enforced" is true of about a third of the surface.

| Tool | IR call | Governed? |
|------|---------|-----------|
| `get_design_tokens` | `listGovernedBlocks(docRef)`, filtered to `type === "token"` | Yes |
| `get_component_docs` | `listGovernedBlocks(docRef)` | Yes |
| `list_components` | `listGovernedBlocks(docRef)` | Yes |
| `get_sync_status` | `getLockStatus`, `getRegistrySummary`, `listExcludedBlocks` | Yes |
| `get_lockfile` | `buildLock`, `serializeLock`, `getLockStatus` | Yes |
| `get_block_versions` | `getBlockHistory(docRef, blockId)` | Yes, full history including drafts, which is correct for an audit tool |
| `validate_ui_code` | none. Uses `loadDesignSystem` plus `paletteFromColors` | **No** |
| `check_component_governance`, `get_governance_rules`, `get_component_history`, `log_component_work`, `check_governance_diff` | none. All read `loadDesignSystem(docRef)`, the raw parsed markdown | **No** |
| `pulse_codegen` | none. See section 9 | **No** |

`validate_ui_code` is the sharpest edge. Its own tool description tells the agent to "ALWAYS check `get_lockfile` first", and the handler then validates against the parsed markdown palette without consulting the lock at all. The instruction is prose; the implementation is not wired to it.

### 7.3 What an agent actually experiences

Nothing dramatic. A draft, conflicted, or never-promoted block is simply not in the array. There is no error, no `isError`, and no per-block explanation. If a whole category comes back empty the agent gets a nudge string such as `No components matched for ${result.docRef}. Try list_components.`, still with `isError: false`.

The only tool that ever returns an error shape on a read is `get_block_versions`, and only for an id the registry has never seen:

```ts
  const history = getBlockHistory(docRef, args.blockId);
  if (!history) {
    return {
      docRef, blockId: args.blockId, versions: [],
      error: `No registry entry for "${args.blockId}". Try list_components or get_design_tokens for valid ids.`,
    };
  }
```

If the block exists but was never promoted, that tool succeeds and says so in prose: `"Never promoted, agents cannot use this block yet."`

The only place an agent can learn **why** something is missing is `get_sync_status`, which serializes `listExcludedBlocks` as `excludedFromAgents` alongside lock freshness and registry counts.

Everything else is handled by asking nicely. The server instruction string delivered on connect says:

> Drafts and conflicted blocks are never served. If a block you expect is missing, a human has not finalized it in the wiki yet; ask them to promote it rather than inventing values.

That sentence is the actual refusal mechanism for a model that notices a gap. It is prompt engineering standing in for an error code, and it is worth being clear-eyed that this is what "agents physically cannot hallucinate your design system" reduces to at the tool boundary.

There is exactly one hard refusal in the whole IR surface, and it is on the write side:

```ts
  if (last.status === "conflict") {
    return { ok: false, id: blockId,
      error: "Block is in conflict, resolve the disagreeing sources before promoting." };
  }
```

### 7.4 Stale blocks are still served

Worth isolating because it surprises people. The `continue` in `listGovernedBlocks` tests for `"conflict"` and `"draft"`. It does not test for `"stale"`. And staling mutates the **latest** version record, never the official pointer. So a block that was promoted and later vanished from the repo keeps a valid `official` pointer, `getOfficialBlocks` returns it, and agents keep receiving it.

That is deliberate and it is the right call, per the north-star rule "stale is not deleted": deleting a component from a repo should not silently yank design truth out from under an in-flight agent session. But it means "stale" is a signal to humans in the wiki and to lock verification, not an agent-facing exclusion. `listExcludedBlocks` reports `"stale"` as a reason only for blocks that have no official record at all.

### 7.5 An agent read can mutate the registry

This one is a genuine design smell rather than a documentation gap. `listGovernedBlocks` opens with `ensureDocBlocks(docRef)`, which short-circuits only if the store index already reports a non-zero `blockCount`:

```ts
export function ensureDocBlocks(docRef: string): DocBlockIndex {
  const index = getBlockStoreIndex();
  if (index.docs[docRef]?.blockCount) {
    return index.docs[docRef];
  }
  return refreshBlocksForDoc(docRef);
}
```

On a cold serverless instance the index is empty, so `refreshBlocksForDoc` runs, which calls `persistBlocksForDoc`, which calls `recordIngest`. An agent calling `get_design_tokens` can therefore create versions, auto-promote scan facts, and mark vanished blocks stale, purely as a side effect of reading. Read paths and write paths are not separated at this layer.

It is mostly benign, because re-ingesting identical markdown produces identical hashes and lands in `unchanged`. It stops being benign the moment the markdown on that instance differs from the markdown the registry was built from.

### 7.6 Telling humans what was withheld

Filtering silently would be worse than not filtering, because a designer would see a change in the wiki and not understand why Cursor ignored it. So exclusions are enumerable with reasons, and this is the function `get_sync_status` serializes:

```ts
export function listExcludedBlocks(
  docRef: string,
): { id: string; reason: "draft" | "conflict" | "stale" | "unpromoted" }[] {
  ensureDocBlocks(docRef);
  const officialIds = new Set(getOfficialBlocks(docRef).map((b) => b.id));
  const out: ... = [];
  for (const b of listStoredBlocks(docRef)) {
    if (officialIds.has(b.id)) continue;
    const reason =
      b.status === "conflict"
        ? "conflict"
        : b.status === "stale"
          ? "stale"
          : b.status === "draft"
            ? "draft"
            : "unpromoted";
    out.push({ id: b.id, reason });
  }
  return out;
}
```

That feeds the sync-status surface: "N blocks are not visible to your agent, and here is why for each."

### 7.7 What happens if a consumer ignores all of this

Nothing stops it. `getOfficialBlocks`, `getRegistryEntry`, and `getBlockHistory` are exported and unguarded, and any server-side code can read drafts directly. The enforcement boundary is a convention that in-repo consumers honor, plus a validator that third parties can run:

```ts
if (
  options.officialOnly &&
  (b.status === "draft" || b.status === "conflict")
) {
  ctx.fail(
    `$.blocks[${i}].status`,
    `official graph must not contain "${b.status}" blocks, agents and compile targets read promoted versions only`,
  );
}
```

`packages/protocol/compile-targets.v1.json` records the intent per target, and it is a manifest, not a runtime check:

```json
{ "id": "wiki",        "officialOnly": false, "description": "Human console. The only target allowed to preview drafts (staging)." },
{ "id": "pulse-react", "officialOnly": true,  "output": "npm-package" },
{ "id": "mcp",         "officialOnly": true,  "reference": "src/lib/ir/enforce.ts" },
{ "id": "device-sim",  "officialOnly": true },
{ "id": "c-header",    "officialOnly": true },
{ "id": "lvgl",        "officialOnly": true,  "status": "stub" }
```

So: enforcement is real for anything routed through `enforce.ts`, and it is a documented promise for everything else. Call it **Partial**, not **Shipped**, and do not let a deck say otherwise.

### 7.8 The CI half

The other enforcement surface runs in the customer's repository, not ours. `npm run validate:ui` (`scripts/validate-ui.ts`, wired to `.github/workflows/validate-ui.yml`) gates a PR on lock freshness and off-token colors in the diff. Its own header states the contract:

```ts
/**
 * validate_ui, the Design CI/CD GATE stage (research doc 6.1, row "Gate").
 *
 * Fails a PR when:
 *   1. blocksmith.lock is missing while a registry exists (unpinned agents)
 *   2. the lock is STALE, its graph hash no longer matches the promoted
 *      official graph (someone finalized newer block versions; re-pull)
 *   3. the diff introduces off-token colors (deviates from locked tokens)
 * ...
 * Exit codes: 0 governed, 1 violations/stale lock, 2 setup error
 */
```

It looks for the lock in three places, repo root first:

```ts
function resolveLockPath(explicit: string, doc: string): string | null {
  const candidates = explicit
    ? [explicit]
    : [
        join(process.cwd(), "blocksmith.lock"),
        referenceLockPath(doc),
        referenceLockPath(),
      ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}
```

The "missing lock" case is deliberately conditional. No lock plus no registry is a skip, not a failure, so the gate is safe to add to a repo that has not onboarded. No lock plus a registry with promoted blocks is a hard failure, because that means agents are running unpinned:

```ts
      console.error(
        `No blocksmith.lock found, but the design registry for "${args.doc}" has promoted blocks.`,
      );
      console.error(
        "   Agents are running unpinned. Pull the lock: blocksmith pull, or MCP get_lockfile.\n",
      );
      failed = true;
```

When a lock is present it reports each drift class separately, and `--allow-stale` downgrades the whole stage from error to warning:

```ts
      for (const m of v.versionMismatches) {
        log(`   ${m.id}: locked v${m.locked}, official is v${m.official}`);
      }
      for (const id of v.missingInLock) log(`   ${id}: promoted but not pinned`);
      for (const id of v.missingInRegistry) {
        log(`   ${id}: pinned but no longer promoted (rolled back or removed)`);
      }
      for (const id of v.hashMismatches) {
        log(`   ${id}: contentHash mismatch, lock corrupted or hand-edited`);
      }
```

One subtlety to know before you debug a confusing CI run: `registryExists` is computed against the `--doc` argument, but verification runs as `verifyLock(lock.docRef, lock)`, using the docRef **inside the lock file**. Point the gate at one doc while the repo's lock belongs to another and it will happily verify the lock against its own registry and report fresh.

`scripts/governance-gate.ts` is the local pre-commit sibling and is worth reading because it shows the philosophy in miniature. It loads the doc's palette, walks the unified diff, and fails on any **added** line containing a hex that is not a defined token:

```ts
/**
 * Governance gate. Fail the build/commit when changed UI code introduces
 * colors that are not defined tokens in the design system. This is what turns
 * the wiki from documentation into enforcement: deviations can't land.
 */
```

```ts
console.error(`\n${violations.length} off-token color(s), these deviate from ${docLabel}:\n`);
...
console.error(`Override (not recommended): git commit --no-verify\n`);
```

Only added lines are scanned, so it gates new deviations without flagging a legacy codebase. And there is an escape hatch, deliberately, because a gate with no escape hatch gets uninstalled.

---

## 8. The protocol as a public artifact

### 8.1 The claim

The claim is that `blocksmith.blocks.v1` is an interchange standard, and that BlockSmith is merely its reference implementation. The deck line is "Figma is Ethernet, BlockSmith is TCP/IP".

The claim implies a testable property: a third party should be able to emit and consume the format without any BlockSmith code. That is what `packages/protocol/` exists to make true.

### 8.2 What is actually in the package

```
packages/protocol/
  package.json              @blocksmith/protocol, version 0.1.0, MIT, zero runtime deps
  README.md                 emit a valid graph in under 20 lines
  schemas/
    blocksmith.blocks.v1.json
    blocksmith.lock.v1.json
    blocksmith.registry.v1.json
    blocksmith.compile-targets.v1.json
  src/
    types.ts     hash.ts     validate.ts     index.ts
  fixtures/
    acme-minimal.blocks.v1.json
    acme-minimal.lock.v1.json
  conformance/
    run.ts       drift.ts
    valid/       minimal-graph.json, full-acme-graph.json, fresh-lock.json
    invalid/     wrong-schema-field.json, draft-in-official-graph.json,
                 bad-content-hash.json, lock-version-mismatch.json
    behavioral/  golden-vectors.json
  compile-targets.v1.json
```

The public API is `validateGraph`, `validateLock`, `validateRegistryEntry`, `validateRegistryManifest`, `validateCompileTargets`, `verifyLockAgainstGraph`, `lockFromGraph`, `blockContentHash`, `graphHash`, `canonicalJson`, and the two schema constants. Zero runtime dependencies, which is why `validate.ts` is a hand-written 430-line structural validator rather than an Ajv call.

The fixtures carry **real** hashes. `acme-minimal.blocks.v1.json` has `contentHash: "sha256:afffd0184ad0a9a1d184f247916216c1"` at the graph level and real per-block hashes; a third party recomputes them and compares. That is the point of shipping fixtures rather than examples.

### 8.3 Schema sync: one source, two copies

The app serves schemas from `public/schema/` so that the Next.js build does not depend on building the package. That creates two copies of every schema, which is exactly the situation that rots. The rule, from `docs/PROTOCOL-GOVERNANCE.md`:

> **App copies** (`src/lib/ir/hash.ts`, `public/schema/*.json`) exist so the Vercel app builds without a package build step, but they are **CI-enforced byte/behavior-identical** by the drift gate. A divergence is a failing build, not a code-review hope. Sync direction is always package to public.

The sync is fifteen lines, `scripts/sync-protocol-schemas.mjs`:

```js
const SRC = join(process.cwd(), "packages", "protocol", "schemas");
const DEST = join(process.cwd(), "public", "schema");

for (const name of readdirSync(SRC)) {
  if (!name.endsWith(".json")) continue;
  copyFileSync(join(SRC, name), join(DEST, name));
  console.log(`synced ${name}`);
}
```

Run with `npm run protocol:sync-schemas`. It is a one-way copy with no diffing, which is correct: the package is normative, `public/` is a build output that happens to be committed.

### 8.4 The drift gate

`npm run protocol:conformance` runs two programs. `conformance/run.ts` is the public suite, twenty checks a third party can run after `npm install`. `conformance/drift.ts` is BlockSmith-only and is the interesting one, because it imports both implementations and compares them:

```ts
import * as pkg from "../src/hash";
import * as app from "../../../src/lib/ir/hash";
```

Then, over four content vectors including a nested object and a unicode string:

```ts
ok(
  `blockContentHash vector ${i} identical`,
  pkg.blockContentHash("id:x", "token", c) ===
    app.blockContentHash("id:x", "token", c),
);
ok(
  `canonicalJson vector ${i} identical`,
  pkg.canonicalJson(c) === app.canonicalJson(c),
);
```

Then byte-compares all four schema files between `public/schema/` and `packages/protocol/schemas/`, with the fix in the failure message:

```ts
ok(`${name} identical`, a === b, "run: npm run protocol:sync-schemas");
```

Then, best of all, it runs the **app's** `recordIngest` against a throwaway doc and validates the resulting registry entry and manifest with the **package's** validators:

```ts
const { recordIngest, getRegistryEntry, readManifest } = await import(
  "../../../src/lib/ir/registry"
);
const { validateRegistryEntry, validateRegistryManifest } = await import(
  "../src/validate"
);
```

That is the check that catches semantic drift rather than textual drift: the app's output must conform to the published spec, every PR, forever. `.github/workflows/protocol-conformance.yml` runs it on every PR touching `packages/protocol/`, `src/lib/ir/`, or the schemas.

### 8.5 Versioning policy for the protocol itself

From `docs/PROTOCOL-GOVERNANCE.md`:

| Change type | Examples | Process |
|-------------|----------|---------|
| **Patch** | Docs, examples, fixture additions, error-message wording | Team merge; conformance must stay green |
| **Minor** | New optional fields, new block `type`, new `ingest` source, new compile target | Professor plus platform review; schemas updated in `packages/protocol/schemas/` then synced; conformance fixtures extended in the same PR |
| **Major** | Hash algorithm, separator, truncation length, `status` enum semantics, append-only rule | Spec bump to `blocks.v2` with a migration doc; both versions supported during transition; golden vectors duplicated per version |

The hash law is frozen for v1, stated normatively in that doc, and duplicated as a comment in both hash implementations. Roles are assigned: research owns hash semantics and registry lifecycle law; platform owns minor schema additions and publishing; anyone may contribute patch-level docs, fixtures, adapters, and targets that clear the listing bar.

The listing bar itself is written down, which is what turns "we have a protocol" into something a stranger can act on. An ingest adapter is listed on `/protocol/adapters` when its output passes `validateGraph(g, { verifyHashes: true })`, golden vectors reproduce byte-for-byte, conflict behavior is demonstrated, and it ingests as `partial` alongside a primary scan. A compile target is listed when it consumes official graphs only, its artifacts carry the graph `contentHash` and per-item `block@version` traceability, and it is registered in `compile-targets.v1.json` by PR.

There is also an explicit rule for the awkward case where the product outruns the spec:

> BlockSmith may ship behavior **ahead** of the published spec, feature-flagged or documented as "reference extension". The spec catches up in a minor bump, or the extension dies. The spec never silently follows an unreviewed implementation change; the drift gate makes "silently" impossible for hash and schema surfaces.

### 8.6 How far this is from an actual standard

Now the honest part.

**What is genuinely done.** Four published JSON Schemas. A zero-dependency package with real validators and real fixtures. A conformance suite a stranger can run. A CI drift gate that has already caught one real bug in production code (the NUL byte). A seven-page spec site at `/protocol` with schema downloads. A written governance policy with named owners and a version policy. That is more protocol infrastructure than most projects that use the word.

**What is not done.**

1. **It is not on npm.** `packages/protocol/package.json` says `"version": "0.1.0"` and `docs/PROJECT-PROTOCOL.md` says the remaining work is "`npm publish` + professor sign-off review". The README's `npm install @blocksmith/protocol` does not currently resolve. It is an installable workspace package, which is not the same thing.
2. **The app does not import it.** `grep -rn "@blocksmith/protocol" src/` returns only documentation pages under `src/app/protocol/`. Task P7's stated goal was "`src/lib/ir/hash.ts` re-export from `@blocksmith/protocol` or delete duplicate". Neither happened. There are two hash implementations kept in sync by a test. That test is good, but "single source of truth" is currently a CI property, not an architectural one.
3. **There is one external adapter, and we wrote it.** `src/lib/ingest/storybook.ts` is real, it implements the conflict rule and partial ingest correctly, and it proves the adapter contract is implementable. It also proves nothing about third-party adoption, because we are the third party.
4. **Zero outside implementations.** No one else has emitted a `blocks.v1` graph. The standard is a standard of one.
5. **The `content` payload is unspecified.** Section 1.3 covered this. Two conformant emitters can produce component blocks with completely disjoint content shapes, both passing every check, and neither usable by the other's compile targets. Interchange of the envelope is solved. Interchange of the payload is not even attempted.

Status verdict: the protocol **artifacts** are Shipped. The protocol as an **interchange standard** is Built, unproven, and item 5 is the reason it will stay that way until somebody specifies content per block type.

---

## 9. A worked example, end to end

One real block, `token:color:acme-accent`, from the vendor fixture in this repository. Every JSON below is copied from a real file, not constructed.

### Step 1: the source file

`fixtures/vendor-ui/src/app/globals.css`:

```css
:root {
  --acme-accent: #e85d4a;
  --acme-accent-muted: #f4a99a;
  --acme-surface-1: #faf8f6;
  --acme-surface-2: #efeae4;
  --acme-text: #1a1a1a;
  --acme-text-muted: #6b6b6b;
  --acme-radius-md: 8px;
  --acme-space-4: 16px;
}
```

Used by `fixtures/vendor-ui/src/components/ui/Button.tsx`:

```tsx
variant === "primary" ? "var(--acme-accent)" : "var(--acme-surface-2)";
```

### Step 2: scan

`npm run scan:vendor` walks the workspace and writes a markdown scan document, `data/uploads/scan-acme-ui-kit.md`. Its front matter records provenance:

```yaml
---
blocksmith-source: workspace-scan
workspace-root: /.../fixtures/vendor-ui
project-name: acme-ui-kit
workspace-id: acme-ui-kit
scanned-at: 2026-07-02T16:27:29.079Z
git-commit: d349fed
scan-paths: src
inventory-tsx: 5
inventory-files: 6
featured-components: 4
scan-facts-hash: 2a5032fbafddfd35
---
```

and the token table contains the row that becomes our block:

```markdown
| Token | Value | Source |
|-------|-------|--------|
| `--acme-accent` | #e85d4a | `src/app/globals.css` |
```

Note what has already been lost: the markdown is now the `source.file` for every block derived from it. The link back to `globals.css:2` survives only as prose inside the table.

### Step 3: block

`loadDesignSystem` parses that markdown into a `DesignSystem`, and `blocksFromDesignSystem` derives a `StoredBlock`. On disk at `.blocksmith/blocks/upload_scan-acme-ui-kit.md/token__color__acme-accent.json`:

```json
{
  "id": "token:color:acme-accent",
  "type": "token",
  "title": "Acme Accent",
  "source": { "file": "data/uploads/scan-acme-ui-kit.md" },
  "docRef": "upload:scan-acme-ui-kit.md",
  "systemHash": "7f7199079ebe2d14",
  "updatedAt": "2026-06-25T20:03:39.897Z",
  "content": {
    "summary": "Defined in `src/app/globals.css`",
    "value": "#e85d4a",
    "cssVar": "--acme-accent",
    "group": "Design tokens",
    "agentHint": "Use Acme Accent (--acme-accent) #e85d4a for Defined in `src/app/globals.css`"
  },
  "status": "finalized",
  "contentHash": "88ad64ae867819cc",
  "version": 2
}
```

That `contentHash` is the legacy 16-char store hash from section 3.5. Ignore it.

### Step 4: version

`persistBlocksForDoc` passes the block to `recordIngest`, which recomputes the canonical hash and appends a version record. `.blocksmith/registry/upload_scan-acme-ui-kit.md/token_color_acme-accent.json`, complete:

```json
{
  "id": "token:color:acme-accent",
  "versions": [
    {
      "version": 1,
      "status": "finalized",
      "title": "Acme Accent",
      "type": "token",
      "content": {
        "summary": "Defined in `src/app/globals.css`",
        "value": "#e85d4a",
        "cssVar": "--acme-accent",
        "group": "Design tokens",
        "agentHint": "Use Acme Accent (--acme-accent) #e85d4a for Defined in `src/app/globals.css`"
      },
      "contentHash": "sha256:dea6096962c0890c1521727ef19211ae",
      "source": { "file": "data/uploads/scan-acme-ui-kit.md" },
      "updatedAt": "2026-06-06T22:26:05.194Z",
      "createdAt": "2026-06-10T02:44:02.661Z",
      "editedBy": "ingest",
      "finalizedAt": "2026-06-10T02:44:02.661Z"
    },
    {
      "version": 2,
      "status": "finalized",
      "title": "Acme Accent",
      "type": "token",
      "content": {
        "summary": "Defined in `src/app/globals.css`",
        "value": "#e85d4a",
        "cssVar": "--acme-accent",
        "group": "Design tokens",
        "agentHint": "Use Acme Accent (--acme-accent) #e85d4a for Defined in `src/app/globals.css`"
      },
      "contentHash": "sha256:b5177e3edbe22de9acc51125681fc6b3",
      "source": { "file": "data/uploads/scan-acme-ui-kit.md" },
      "updatedAt": "2026-06-12T03:22:11.112Z",
      "createdAt": "2026-06-12T03:22:11.729Z",
      "editedBy": "ingest",
      "finalizedAt": "2026-06-12T03:22:11.729Z"
    }
  ],
  "official": 2
}
```

Two things are worth staring at.

First, `editedBy: "ingest"` plus `type: "token"` means `autoPromote` was true, so `status` was written as `finalized`, `finalizedAt` was set, and `entry.official` advanced. Nobody clicked anything. Code is authoritative for scan facts.

Second, and this is the most instructive artifact in the repository: **the two versions have byte-identical `content` and different `contentHash`.** `canonicalJson(v1.content) === canonicalJson(v2.content)` is `true`, yet v1 is `sha256:dea60969...` and v2 is `sha256:b5177e3e...`. Identical content must hash identically; that is the entire premise of the system.

It is not a mystery, and you do not have to take the explanation on faith. Brute-force the separator against v1's stored hash and exactly one candidate reproduces it:

```
" "        sha256:b5177e3edbe22de9acc51125681fc6b3
"\u0000"   sha256:dea6096962c0890c1521727ef19211ae   <== matches the stored v1 hash
":"        sha256:e8ca3de351b2751c589d243d5bf0c5ad
""         sha256:e9279b934c816d1685a83b3128c06fe7
```

v1 was hashed on 10 June by a build that put a NUL byte between id, type, and content. v2 was hashed on 12 June, after the fix, with the single ASCII space the spec requires. Current code reproduces v2 exactly. This is the NUL-byte incident from section 3.2, preserved in committed data, and it is exactly what the governance doc means by "pre-existing local registries self-heal: next ingest records new versions, locks re-pin". The self-healing worked: the lock pins v2, not v1.

Two lessons. Do not trust a `contentHash` on any version record written before that fix, because it is unverifiable by current code. And notice what caught this in the first place: not a code review, not a type, but `packages/protocol/conformance/drift.ts` comparing two independent implementations of the same function.

### Step 5: promote

For this block, promote already happened implicitly at ingest. Had it been a `guideline` or an `agent-rule`, the path would be `POST /api/wiki/promote` with `{ doc, blockIds }`, which calls `promoteBlock` per id with `deferManifest: true`, then `updateManifest(doc)`, then `writeReferenceLock(doc)`.

The same doc has a real example of the non-auto path. `agent-rule:guide` sits at latest v10 with status `draft` and `official: 1`. Nine staged edits, none promoted. Agents on this doc are reading the v1 agent guide from June while the wiki shows v10. That is the draft/production separation working exactly as designed, and also a reminder that it is easy to leave a doc in that state indefinitely.

Current state of all fourteen blocks in this doc:

```
agent-rule:guide               latest v10  draft      official 1
component:badge                latest v3   finalized  official 3
component:button               latest v53  finalized  official 53
component:card                 latest v3   finalized  official 3
component:input                latest v3   finalized  official 3
page:introduction              latest v1   draft      official -
token:color:acme-accent        latest v2   finalized  official 2
token:color:acme-accent-muted  latest v2   finalized  official 2
token:color:acme-surface-1     latest v2   finalized  official 2
token:color:acme-surface-2     latest v2   finalized  official 2
token:color:acme-text          latest v2   finalized  official 2
token:color:acme-text-muted    latest v2   finalized  official 2
token:color:fefefe             latest v1   stale      official 1
token:color:ffffff             latest v2   finalized  official 2
```

Thirteen promoted, two drafts pending, one stale. Exactly the manifest counts from section 5.1. `token:color:fefefe` is the stale row: a hex that appeared in an earlier scan, vanished from the code, and is still pinned at its last official version because nobody decided otherwise.

### Step 6: lock

`writeReferenceLock` calls `buildLock`, which calls `getOfficialBlocks`, sorts by id, and pins `{ version, contentHash }`. Our block's entry in `.blocksmith/locks/upload_scan-acme-ui-kit.md.lock`:

```json
"token:color:acme-accent": {
  "version": 2,
  "contentHash": "sha256:b5177e3edbe22de9acc51125681fc6b3"
}
```

Identical to the v2 record. The chain from `globals.css` to the lock is now closed, and every link is verifiable by recomputation.

The lock as a whole, however, is stale, for the reason in section 6.7: `component:button` moved to v53 after this lock was written. So the correct reading of this artifact is "twelve pins current, one pin drifting, whole lock stale until re-pinned".

### Step 7: consumed

**By the wiki.** The wiki does not read the lock. It renders from the parsed markdown and shows registry state as badges via `buildReleaseTable`. It is the only target with `officialOnly: false`, because a human console must be able to see what is waiting.

**By MCP agents.** The MCP tool layer resolves through `listGovernedBlocks(docRef)`, which returns the official record and annotates it with `version` and `finalizedAt`. So the agent receives content `{ value: "#e85d4a", cssVar: "--acme-accent", agentHint: "Use Acme Accent (--acme-accent) #e85d4a for ..." }` tagged as v2 with hash `b5177e3e`. It does not receive `page:introduction` (never promoted) or the v10 agent guide (draft). It receives `token:color:fefefe` (stale but still official). Lock freshness reaches the agent separately through `getLockStatus`, so a session can notice that the pins moved mid-task.

**By the package build. And here the chain breaks.** `npm run codegen:pulse` compiles `@blocksmith/acme-ui-kit` into `packages/generated/acme-ui-kit/`, and our accent does end up in the emitted `src/tokens.css` and `src/tokens.ts`. But it does not get there through the IR. `src/lib/codegen/run.ts`:

```ts
export async function runPulseCodegen(
  docRef?: string,
): Promise<PulseCodegenOutput> {
  const ref =
    docRef?.trim() ||
    process.env.BLOCKSMITH_DOC?.trim() ||
    "upload:scan-acme-ui-kit.md";

  const { markdown, resolvedFrom } = await loadScanMarkdownForCodegen(ref);
  const system = parseWorkspaceScanMarkdown(markdown, ref);
  const result = generatePulsePackage(system, CODEGEN_ROOT);
```

It loads the scan markdown, parses it into a `DesignSystem`, and emits. There is no import of `@/lib/ir/*` anywhere under `src/lib/codegen/`. So the Pulse package is built from the **parsed markdown**, not the official graph. Drafts, never-promoted blocks, conflicted blocks, and stale blocks all compile straight into the package. The `officialOnly: true` entry for `pulse-react` in `compile-targets.v1.json` describes an intention, not the code.

The emitted `package.json` records no provenance beyond a boolean, and you can check this against the committed artifact at `packages/generated/acme-ui-kit/package.json`:

```json
"blocksmith": { "generated": true, "source": "pulse-codegen" }
```

No `contentHash`, no `docRef`, no version pins. The generated file headers say `Auto-generated from BlockSmith scan` and nothing more.

There is a slot in the lock schema for exactly this linkage, `package?: { name: string; pulseBuild?: string }`, and `buildLock` accepts `{ packageName, pulseBuild }` options. **No caller anywhere in the repo passes them.** Every call site (`/api/v1/lock`, `/api/v1/scans/pull`, `mcp/handlers.ts`, `ir/releases.ts`, all four wiki write routes, `ir/demo-seed.ts`) calls `buildLock(docRef)` with no options, so `lock.package` is always absent. The package name that the Pipeline UI shows comes from a string transform, `packageNameForDoc` in `src/lib/ir/releases.ts`, not from the lock.

This is the single largest hole in the "one IR, many targets" claim, and it is the target the pitch mentions first. Section 10 lists it as such.

**By the device targets.** `npm run compile:device` runs `compileDeviceSim(getOfficialGraph(doc), frameId)`, which turns our block into:

```json
{
  "id": "token:color:acme-accent",
  "version": 2,
  "name": "Acme Accent",
  "value": "#e85d4a",
  "rgb": 15228234,
  "kind": "color",
  "contentHash": "sha256:b5177e3edbe22de9acc51125681fc6b3"
}
```

and `emitTokensHeader(graph)` turns it into a C define with full traceability:

```c
#define BS_COLOR_COLOR_ACME_ACCENT 0xE85D4Au /* token:color:acme-accent@v2 sha256:b5177e3edbe22de9acc51125681fc6b3 */
```

The header also stamps the graph hash at the top, so a firmware build can be audited against the design graph that produced it:

```c
/*
 * BlockSmith generated design tokens. DO NOT EDIT BY HAND.
 * schema:    blocksmith.blocks.v1
 * docRef:    upload:scan-acme-ui-kit.md
 * graphHash: sha256:a667c0b7499f1981687454e1160a7497
 */
```

Same block, same version, same hash, four different emitters. That is the property the whole chapter is about, and it is real: `verify:ir-cicd` asserts it end to end, including the exact header line, on every run.

### Step 8: the closed loop, verified

`npm run verify:ir-cicd` (`scripts/verify-ir-cicd.ts`) is the executable version of this entire section, on a synthetic doc so it never touches real registries. It walks ingest, build, idempotent re-ingest, stage, enforce, promote, re-scan, rollback, stale, and compile, and asserts the interesting properties at each step:

```ts
check("3 blocks created at v1", r1.created.length === 3);
check("scan facts auto-promoted (token+component)", ...);
check("governance staged as draft (not official)", r1.official["agent-rule:cta-density"] === undefined);
check("lock pins exactly the official blocks", Object.keys(lock1.blocks).length === 2);
check("deterministic: same graph, same lock hash", lock1.contentHash === lockAgain.contentHash);
check("unchanged content does not bump versions", r2.unchanged.length === 3 && r2.bumped.length === 0);
check("draft v2 is NOT official", ...);
check("lock unaffected by drafts", verifyLock(DOC, lock1).ok);
check("draft agent-rule absent from official graph", ...);
check("old lock now STALE", v1Check.stale, ...);
check("rollback returns pointer to v1", rb.ok && rb.version === 1);
check("history immutable: both versions still recorded", ...);
check("vanished block marked stale, not deleted", r6.staled.includes("component:button-primary"));
check("stale block still locked at last official version", buildLock(DOC).blocks["component:button-primary"]?.version === 1);
check("semantic loss measured", loss.carried + loss.dropped.length === graph.blocks.length);
```

If you change anything in `src/lib/ir/`, this is the script that tells you whether you broke the model. Run it plus `npm run protocol:conformance` before you push.

---

## 10. What is weak

Ranked by how much it will hurt, not by how easy it is to fix.

### Solid

- **Hashing.** Canonical, tested, dual-implemented, drift-gated, with real golden vectors. It has already caught a real bug in production code. This is the strongest part of the system.
- **The version model.** Append-only plus a pointer is the right primitive, it is small enough to reason about, and the invariants are machine-checked by the published validator.
- **Lock staleness.** A pure content-derived comparison with no clocks and no polling. Correct by construction and cheap.
- **The promote/rollback lifecycle.** Human gate on governance, automatic on code facts, conflicts blocked until resolved, rollback restricted to previously finalized versions. The state machine is coherent and the closed loop is verified by a script that actually runs.
- **Auditability.** Every production-changing action becomes an append-only run with a captured server-side console log, lock hash before and after, and per-stage timings.

### Thin

- **`content` is unspecified.** Repeat of sections 1.3 and 8.6, listed here because it is the number one item. `Record<string, unknown>` with a prose description in the schema. Targets pluck and default. Two conformant emitters can be mutually useless. Until there is a per-type content schema, "one IR, many targets" is an engineering convention inside this repo, not a property of the format.
- **Provenance is not populated.** `source.ingest` is optional in the type, and `src/lib/blocks/extract.ts` never sets it. Every scan-derived and markdown-derived block in every real registry in this repo has `source: { "file": "data/uploads/scan-....md" }` and no `ingest`. Only the Storybook adapter sets it. The cross-source conflict rule is implemented in terms of `latest.source.ingest !== "storybook"`, which works today only because Storybook is the sole adapter that populates the field. Add a Figma adapter that also sets `ingest` and the rule keeps working; add one that does not and conflict detection silently stops firing.
- **`source.file` points at the wrong file.** It is the generated markdown, not `globals.css:2`. So "jump to source" from a block is impossible, and re-scanning a repo cannot correlate a block to the file that changed. The information exists in the scan (the markdown table has the source column) and is discarded at extraction time.
- **Two hash schemes coexist.** Section 3.5. The store writes a 16-char unprefixed hash, the registry writes the canonical one. Nothing breaks, but every newcomer loses an hour to it and there is no reason for the legacy one to exist.
- **Two id escapes coexist.** `:` becomes `_` in the registry and `__` in the block store. Harmless until something tries to reverse a filename.
- **Version numbers are meaningless as a signal.** `component:button` is at v53 in a fixture repository with five components. Every scan that produces even a whitespace difference in a description bumps the version. There is no notion of a significant versus insignificant change, so "v53" tells a human nothing. Compare with semver, where the number carries intent.
- **No rename.** A renamed CSS variable is a delete plus a create, and all version history is lost. There is no aliasing mechanism.
- **Enforcement is filtering, not refusal.** Sections 7.3 and 7.7. Anything that bypasses `enforce.ts` sees everything. The `officialOnly` flag in the targets manifest is documentation.
- **`validate_ui_code` does not read the lock.** Its own tool description tells the agent to check `get_lockfile` first, then the handler validates against the parsed markdown palette. The most enforcement-shaped tool on the MCP surface is the one least connected to the IR.
- **`lock.package` is dead weight.** The field exists in the type, in the JSON Schema, and in `buildLock`'s options. Nothing in the repository ever populates it. The one link the schema provides between a promoted graph and a shipped npm build is unused.
- **`GET /api/v1/lock` reports a tautological `fresh`.** It verifies a lock it just built against the registry it built it from. Anyone reading that field as a staleness signal will get `true` forever.
- **The `page:introduction` trap.** It is created with status `draft`, so it never auto-promotes, so on a fresh scan there is always at least one block that will never be in production until somebody promotes it by hand. Every real doc in this repo has exactly this dangling draft.

### Broken, not thin

Two items do not belong in "thin" because they contradict claims the product makes out loud.

- **The Pulse package build bypasses the IR completely.** Section 9, step 7. `src/lib/codegen/run.ts` reads scan markdown and parses it; there is no `@/lib/ir` import anywhere under `src/lib/codegen/`. So the flagship compile target, the one in the sentence "one team, one design graph, one importable package", is compiled from a document rather than from the promoted graph. Drafts and stale blocks ship in the package. Nothing in the emitted artifact carries a graph hash or a `block@version` pin, so a package cannot be audited back to a design state. `compile-targets.v1.json` lists it as `officialOnly: true`, which is currently false. Meanwhile `device-sim`, `c-header`, and the Style Dictionary emitter all do it correctly, take a `BlocksmithGraphV1`, and stamp the hash. The fix is not conceptually hard: `getOfficialGraph(docRef)` instead of `parseWorkspaceScanMarkdown(markdown)`, plus a `blocksmith` field in the emitted `package.json` carrying `docRef`, `contentHash`, and the pins. Until that lands, do not let a deck or a demo claim the package is built from promoted blocks.
- **Reads mutate.** Section 7.5. An agent calling `get_design_tokens` on a cold instance triggers a full ingest, which can create versions, auto-promote, and mark blocks stale. Read paths should not be able to write history.

### Would break at 100 customers

- **`.blocksmith/index.json` is one global file.** Every doc in the deployment shares it. It is already 61 KB across 42 docs and 1348 blocks, rewritten in full on every `persistBlocksForDoc`. At 100 customers with a few hundred blocks each it is a megabyte-scale file rewritten on every ingest, with no locking. Two concurrent scans race and one wins.
- **The registry is a filesystem, and on Vercel the filesystem is `/tmp`.** Every read is `readdirSync` plus a `JSON.parse` per block. A 500-block doc is 500 file reads for a single `getOfficialBlocks`, and `writeManifest` does that whole pass again on every write. `deferManifest` was added precisely because the naive version was O(N^2). That is a patch on a structure that should be a database query.
- **Hydration is all-or-nothing and racy.** `hydrateRegistryFromCloud` checks whether the directory has any block file and returns early if so. A partially hydrated directory, from a lambda killed mid-hydration, looks warm forever. And the Supabase row holds the entire `versions` array as one JSONB blob, so appending version 54 to `component:button` rewrites all 53 prior records. At a few hundred versions per block that becomes the dominant write cost.
- **Concurrency is unmanaged.** There is no compare-and-swap on the official pointer, no row version, no transaction across the registry write plus the lock write. Two simultaneous promotes on the same doc from two lambdas both read, both mutate, both write, and last-write-wins. The `upsert` is per block, so a batch promote can land partially. Nothing detects it. `docs/RESEARCH-INFRA-DESIGN-IR-AND-CICD.md` names this correctly ("concurrent writers", "partial failure") as the hard research problem, and it is currently unaddressed in code.
- **No RLS, no tenant column in the IR.** The Supabase tables are keyed on `doc_ref` with service-role access only, and the schema file says so. Authorization lives entirely in the route layer via `requireDocumentAccess`. Anything that calls a registry function without going through a route bypasses tenancy. There is no `org_id` on any IR row.
- **Locks are BlockSmith-side reference copies, not verified repo state.** `getDocLifecycle` has a `pinned` lifecycle for "the lock has been verified inside the customer's repo", and the code says it "collapses to connected" because that verification does not exist yet. So today we know what we last generated, not what the customer's repo actually contains. Every drift claim is about our own copy.
- **Cleanup does not exist.** `.blocksmith/registry/` in this repo contains 47 doc directories, most of them from `verify:*` and `smoke_*` runs that each create a uniquely named doc. Nothing prunes them. At customer scale this is unbounded growth in both `/tmp` and Supabase.
- **The stale/conflict statuses mutate the newest version record in place.** Append-only is the invariant everyone quotes, and staling violates the spirit of it. If two sources both write status transitions concurrently, the last one wins and there is no record that the other happened.

---

## Open questions

1. **Do we specify `content` per block type, or do we admit the IR is an envelope?** Specifying it is a minor schema bump under the governance policy and would make the interchange claim true. Not specifying it means every new compile target re-derives its own assumptions. This is the highest-leverage unanswered question in the codebase.
2. **When does the registry stop being a filesystem?** The disk-plus-mirror design works and it is clearly a transitional shape. What is the trigger to invert it and make Supabase primary with disk as cache: a customer count, a block count, or the first lost promote?
3. **How do we make promote safe under concurrency?** Compare-and-swap on `official` with a row version is the obvious answer, but it changes the registry API from synchronous to asynchronous everywhere, which touches every caller.
4. **What is the rename story?** A CSS variable rename currently destroys history. Do we add an `aliases` field, a rename operation with a redirect record, or do we accept the loss and document it?
5. **Should `version` mean something?** Today it is a change counter. Should there be a distinction between a cosmetic bump and a breaking token change, so a lock diff can say "3 breaking, 40 cosmetic"?
6. **Where does the enforcement boundary actually belong?** MCP filtering is advisory in the sense that any other code path bypasses it. The research doc poses this as an open question (MCP advisory versus CI blocking) and we have shipped both halves without deciding which one is load-bearing.
7. **What is the migration story for `blocks.v2`?** The governance doc says both versions are supported during transition and golden vectors are duplicated per version. Nothing in the code reads a schema version and branches. If the hash law ever changes, every existing lock and every existing version record becomes unverifiable. What does the migration actually do to `.blocksmith/registry/`?
8. **Do we publish the package, and what does that commit us to?** Publishing `@blocksmith/protocol` to npm makes the interchange claim defensible and makes the hash law a public promise we cannot quietly change. That is the point, and it is also the cost.
9. **How do we verify a lock inside a customer repository?** Until `pinned` is real, every drift statement is about our reference copy. This is the difference between "your lock is stale" and "we think your lock might be stale".
10. **When does Pulse move onto the graph?** This is the highest-value small fix in the chapter. Switching `runPulseCodegen` to `getOfficialGraph(docRef)` and stamping `docRef`, `contentHash`, and per-block pins into the emitted `package.json` would make the flagship target honest and would finally give `lock.package` something to point at. What is blocking it: does the markdown parse carry structural component data that the block `content` payload currently drops, and if so, is that a reason to fix `content` (question 1) first?

---

## Where to look in the code

**The IR core**

| Path | What it owns |
|------|--------------|
| `src/lib/ir/types.ts` | `BlocksmithBlockV1`, `BlocksmithGraphV1`, `BlocksmithLockV1`, `BlockRegistryEntry`, `BlockVersionRecord`, `RegistryManifest`, `LockVerification` |
| `src/lib/ir/hash.ts` | `canonicalJson`, `blockContentHash`, `graphHash`. Constitutional, mirrored in the protocol package |
| `src/lib/ir/registry.ts` | `recordIngest`, `promoteBlock`, `rollbackBlock`, `resolveConflict`, `getOfficialBlocks`, `getOfficialGraph`, `getBlockHistory`, manifest writing |
| `src/lib/ir/lock.ts` | `buildLock`, `writeReferenceLock`, `readReferenceLockForDoc`, `verifyLock` |
| `src/lib/ir/enforce.ts` | `listGovernedBlocks`, `listExcludedBlocks`, `getLockStatus` |
| `src/lib/ir/cloud-registry.ts` | Supabase mirror, coalesced flush, `syncRegistryToCloud`, `syncLockToCloud`, `hydrateRegistryFromCloud`, `hydrateLockFromCloud` |
| `src/lib/ir/ensure-pipeline-registry.ts` | Cold-start hydrate or rebuild before Pipeline reads |
| `src/lib/ir/releases.ts` | `buildReleaseTable`, the control-plane read model, `packageNameForDoc` |
| `src/lib/ir/diff.ts` | Production versus staging field diff for the promote drawer |
| `src/lib/ir/pipeline-runs.ts`, `pipeline-stages.ts`, `pipeline.ts` | Append-only run log, per-stage timings, Pipeline payload types |
| `src/lib/ir/targets/device-sim.ts` | `compileDeviceSim`, `deviceCompileLoss`, `DEVICE_FRAMES` |
| `src/lib/ir/targets/c-header.ts` | `emitTokensHeader` |
| `src/lib/ir/demo-seed.ts` | Self-seeding investor walkthrough state |

**Block production**

| Path | What it owns |
|------|--------------|
| `src/lib/blocks/types.ts` | `BlockType`, `BlockStatus`, `DesignSystem` and friends |
| `src/lib/blocks/content.ts` | `StoredBlock`, `BlockContent`, `BlockStoreIndex` |
| `src/lib/blocks/extract.ts` | `blocksFromDesignSystem`, the id scheme, the legacy 16-char hash |
| `src/lib/blocks/store.ts` | `persistBlocksForDoc`, the preview-doc skip, the ingest run log |
| `src/lib/blocks/refresh.ts` | `refreshBlocksForDoc`, `ensureDocBlocks` |
| `src/lib/ingest/storybook.ts` | The one external ingest adapter, conflict rule and partial ingest |
| `src/lib/runtime/writable-root.ts` | `blocksmithWritableRoot`, the `/tmp` decision |
| `src/lib/wiki/doc-lifecycle.ts` | `preview` versus `connected` versus `pinned` |

**Consumers**

| Path | What it does |
|------|--------------|
| `src/lib/mcp/blocksmith-server.ts` | Tool declarations, dispatch, and the instruction string every client receives on connect |
| `src/mcp/handlers.ts` | Tool implementations. The only file that imports `enforce.ts` on the agent side. `formatBlockForAgent` is where the `pinned vN (hash)` annotation is written |
| `src/mcp/server.ts` | stdio transport for local IDEs |
| `src/lib/mcp/http-handler.ts`, `src/app/api/mcp/route.ts` | Stateless Streamable HTTP behind `requireApiKey` |
| `src/lib/codegen/run.ts`, `src/lib/codegen/pulse.ts` | The Pulse target. Note: reads markdown, not the graph. See section 10 |
| `scripts/codegen-pulse.ts`, `src/app/api/v1/codegen/pulse/route.ts` | CLI and HTTP entry points for Pulse |
| `scripts/compile-device.ts` | `getOfficialGraph(doc)` then `compileDeviceSim` and `emitTokensHeader`. The correct pattern to copy |
| `src/lib/design-tokens/style-dictionary.ts` | `BlocksmithGraphV1` to `tokens.css` and `tokens.json` |
| `src/app/api/v1/lock/route.ts` | Lock as JSON or as a file download |
| `src/app/api/v1/scans/pull/route.ts` | Lock bundled into the pull payload |
| `packages/cli/src/pull.ts`, `packages/sdk/src/design-md.ts` | Writes `blocksmith.lock` into the customer repo root |
| `scripts/validate-ui.ts` | The PR gate: lock freshness plus off-token colors |
| `scripts/governance-gate.ts` | The local pre-commit off-token color gate |

**Routes**

| Path | What it does |
|------|--------------|
| `src/app/api/wiki/promote/route.ts` | Batch promote, optional conflict resolution, lock regen, awaited cloud sync, run log |
| `src/app/api/wiki/rollback/route.ts` | Single-block pointer rollback, lock regen, run log |
| `src/app/api/wiki/pin-lock/route.ts` | Write a lock from the current official graph when there is nothing to promote |
| `src/app/api/wiki/finalize/route.ts` | Markdown write plus re-ingest as `editedBy: "web"`, staging by default, `promote: true` escape hatch |
| `src/app/api/wiki/pipeline/route.ts`, `pipeline/diff/route.ts`, `releases/route.ts` | Pipeline and Releases read APIs |
| `src/app/api/design-system/route.ts` | Parsed system plus wiki theme IR. Note: not the block graph |
| `src/app/protocol/` | The seven-page public spec site |

**The protocol package**

| Path | What it owns |
|------|--------------|
| `packages/protocol/schemas/*.json` | The four normative JSON Schemas |
| `packages/protocol/src/hash.ts` | The mirrored constitutional hash implementation |
| `packages/protocol/src/validate.ts` | `validateGraph`, `validateLock`, `validateRegistryEntry`, `verifyLockAgainstGraph`, `lockFromGraph` |
| `packages/protocol/conformance/run.ts` | The public 20-check suite |
| `packages/protocol/conformance/drift.ts` | App versus package hash and schema drift gate, plus app-output conformance |
| `packages/protocol/fixtures/` | Canonical graph and lock with real hashes |
| `packages/protocol/compile-targets.v1.json` | The backend registry |
| `scripts/sync-protocol-schemas.mjs` | One-way schema copy, package to `public/schema/` |

**Scripts and gates**

```bash
npm run verify:ir-cicd        # closed loop: ingest, stage, promote, lock, enforce, rollback, compile
npm run protocol:conformance  # public suite + app/package drift gate
npm run protocol:sync-schemas # copy schemas package -> public/schema
npm run validate:ui           # CI gate: lock freshness + off-token colors in a PR diff
npm run governance:check      # local pre-commit off-token color gate
npm run compile:device        # device profile + tokens.h for a doc
npm run codegen:pulse         # build the @blocksmith/<product> package from the official graph
npm run ingest:storybook      # the external adapter
```

**Data to read with your own eyes**

```
.blocksmith/registry/upload_scan-acme-ui-kit.md/    14 block entries + manifest.json
.blocksmith/blocks/upload_scan-acme-ui-kit.md/      the StoredBlock mirror
.blocksmith/locks/upload_scan-acme-ui-kit.md.lock   currently stale by exactly one block
data/uploads/scan-acme-ui-kit.md                    the scan document
fixtures/vendor-ui/src/app/globals.css              where token:color:acme-accent begins
supabase/schema-registry.sql                        the durable side
```

**Source documents behind this chapter**

`docs/BLOCKS-V1-SPEC.md`, `docs/DESIGN-CICD.md`, `docs/RESEARCH-INFRA-DESIGN-IR-AND-CICD.md`, `docs/IR-CICD-IMPLEMENTATION.md`, `docs/PROTOCOL-GOVERNANCE.md`, `docs/PROJECT-PROTOCOL.md`, `docs/TEAM-NORTH-STAR.md`. Where those docs and the code disagree, the code wins and this chapter followed the code.
