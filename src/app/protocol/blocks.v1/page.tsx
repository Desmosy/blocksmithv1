import { Callout, Code, H1, H2, P, Pre, Table } from "../ui";

const EXAMPLE_BLOCK = `{
  "id": "token:color:accent",
  "type": "token",
  "title": "Accent",
  "version": 1,
  "status": "finalized",
  "source": { "file": "src/styles/tokens.css", "line": 14, "ingest": "scan" },
  "content": {
    "value": "#d97757",
    "cssVar": "--color-accent",
    "summary": "Primary CTA color"
  },
  "updatedAt": "2026-06-04T12:00:00.000Z",
  "finalizedAt": "2026-06-04T12:00:00.000Z",
  "editedBy": "ingest",
  "contentHash": "sha256:a40ae6c94ffbaeff0ee94d459043a971"
}`;

const EXAMPLE_GRAPH = `{
  "schema": "blocksmith.blocks.v1",
  "docRef": "upload:scan-acme-mobile-app.md",
  "systemId": "acme-mobile-app",
  "contentHash": "sha256:afffd0184ad0a9a1d184f247916216c1",
  "blocks": [ /* BlocksmithBlockV1[] */ ]
}`;

export default function BlocksSpec() {
  return (
    <article>
      <H1 kicker="blocksmith.blocks.v1">The block graph — the packet on the wire</H1>
      <P>
        A <strong>block</strong> is one addressable unit of design truth: a
        token, a component, a guideline, an agent rule, or a prose page. A{" "}
        <strong>graph</strong> is the set of blocks for one product. That is
        the entire surface area of the format — everything else (versions,
        locks, promotion) layers on top.
      </P>

      <H2>Block</H2>
      <Pre title="BlocksmithBlockV1">{EXAMPLE_BLOCK}</Pre>
      <Table
        head={["Field", "Rule"]}
        rows={[
          [<Code key="1">id</Code>, <span key="b">Stable, lowercase, ^[a-z0-9][a-z0-9:_-]*$ — convention: type:category:name (e.g. token:color:accent, component:button-primary)</span>],
          [<Code key="2">type</Code>, "component · token · guideline · agent-rule · page"],
          [<Code key="3">version</Code>, "Integer ≥ 1, monotonic per id. New content = new version. Never reused."],
          [<Code key="4">status</Code>, "draft (staging, never served to agents) · finalized (promoted) · stale (source vanished) · conflict (sources disagree)"],
          [<Code key="5">source</Code>, "Where this truth came from: file, optional line, optional ingest adapter name"],
          [<Code key="6">content</Code>, "Type-specific payload. Tokens: value/cssVar. Components: role/radius/description. Rules: text. Guidelines: items[]"],
          [<Code key="7">contentHash</Code>, <span key="h">sha256: + first 32 hex of sha256(&quot;id type canonicalJson(content)&quot;) — see hashing below</span>],
        ]}
      />

      <H2>Graph</H2>
      <Pre title="BlocksmithGraphV1">{EXAMPLE_GRAPH}</Pre>
      <P>
        <Code>contentHash</Code> at graph level is{" "}
        <strong>order-independent</strong>: lines{" "}
        <Code>{"<id>@<version>:<contentHash>"}</Code> sorted, joined with{" "}
        <Code>\n</Code>, sha256, first 32 hex. Two emitters producing the same
        blocks in any order produce the same hash — that property is what
        makes lock staleness detection possible.
      </P>

      <H2>Canonical hashing (constitutional)</H2>
      <Pre title="@blocksmith/protocol">{`import { blockContentHash, graphHash, canonicalJson } from "@blocksmith/protocol";

// canonicalJson: object keys sorted recursively, arrays order-preserved,
// undefined dropped. {a:1,b:2} and {b:2,a:1} hash identically.
blockContentHash("token:color:accent", "token", { value: "#d97757" });
// → "sha256:…32 hex…"`}</Pre>
      <Callout>
        Hash semantics are <strong>law</strong>. Changing them is a{" "}
        <Code>blocks.v2</Code> spec bump with migration notes — never a
        refactor. The conformance suite carries golden vectors; if your
        implementation can&apos;t reproduce them byte-for-byte, it does not
        speak blocks.v1.
      </Callout>

      <H2>The official-graph rule</H2>
      <P>
        A graph served to agents, CI, packages, or devices must contain{" "}
        <strong>only promoted versions</strong> — no <Code>draft</Code>, no{" "}
        <Code>conflict</Code>. Validators enforce this with{" "}
        <Code>{`validateGraph(g, { officialOnly: true })`}</Code>. Staging
        graphs (wiki previews) may carry anything.
      </P>

      <H2>Downloads</H2>
      <P>
        <a className="underline" href="/schema/blocksmith.blocks.v1.json">JSON Schema</a> ·{" "}
        <a className="underline" href="/protocol/conformance">conformance fixtures</a> — the example
        above is a real fixture; recompute its hashes and compare.
      </P>
    </article>
  );
}
