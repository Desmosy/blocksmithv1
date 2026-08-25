import { Callout, Code, H1, H2, P, Pre, Table } from "../ui";

export default function AdaptersPage() {
  return (
    <article>
      <H1 kicker="Compile in">Ingest adapters</H1>
      <P>
        An adapter compiles a source format <strong>into</strong>{" "}
        <Code>blocks.v1</Code>. That is its entire job. It never writes the
        wiki, never builds packages, never talks to agents — the graph is the
        only door into the system, which is what keeps every source honest.
      </P>

      <H2>Adapter registry</H2>
      <Table
        head={["Adapter", "Input", "Status", "Owner"]}
        rows={[
          [<Code key="1">scan</Code>, "Repo workspace (components, CSS vars, exports)", "✅ Reference", "BlockSmith"],
          [<Code key="2">markdown</Code>, "Paste / upload .md", "✅ Reference", "BlockSmith"],
          [<Code key="3">governance</Code>, "Wiki finalize (rules, roles, do/don't)", "✅ Reference", "BlockSmith"],
          [<Code key="4">storybook</Code>, "storybook-static (index.json / stories.json)", "✅ Reference", "BlockSmith"],
          [<Code key="5">figma</Code>, "Figma export JSON", "⬜ Open", "—"],
          [<Code key="6">tokens-studio</Code>, "Tokens Studio JSON", "⬜ Open", "—"],
          [<Code key="7">agent-template</Code>, "CLAUDE.md / AGENTS.md chunks", "⬜ Research", "—"],
        ]}
      />

      <H2>The adapter contract</H2>
      <Table
        head={["#", "Every adapter MUST"]}
        rows={[
          ["1", <span key="1">Output a <Code>BlocksmithGraphV1</Code> (standalone) or blocks for <Code>recordIngest()</Code> (registry mode)</span>],
          ["2", <span key="2">Compute <Code>contentHash</Code> with the canonical algorithm — golden vectors must reproduce</span>],
          ["3", <span key="3">Pass <Code>protocol:conformance</Code> for its output (incl. <Code>verifyHashes</Code>)</span>],
          ["4", "Never write wiki or Pulse directly — blocks.v1 is the only door"],
          ["5", <span key="5">Ingest as <strong>partial</strong> when contributing alongside a primary scan — never stale blocks it doesn&apos;t own</span>],
          ["6", <span key="6">Surface disagreement as <Code>conflict</Code> — same id, different source, different content; a human resolves in the wiki</span>],
        ]}
      />

      <H2>Reference: the Storybook adapter</H2>
      <Pre title="terminal">{`# from a static Storybook build (storybook build)
npm run ingest:storybook -- ./storybook-static --doc upload:my-app.md
#   components: 2 · graph sha256:…
#   registry → upload:my-app.md: 1 created, 0 bumped, 1 conflicts
#   ⚠ conflicts (resolve in wiki Pipeline): component:button

# or emit a standalone graph, no registry:
npm run ingest:storybook -- ./storybook-static --graph-only --out graph.json`}</Pre>
      <P>
        The interesting line is the conflict: the repo scan already owns{" "}
        <Code>component:button</Code> with different content, so the Storybook
        version lands as a red card in the Pipeline staging lane —{" "}
        <strong>both truths preserved, a human picks</strong>. Source:{" "}
        <Code>src/lib/ingest/storybook.ts</Code> (~150 lines — that&apos;s the
        weekend-project bar for an adapter).
      </P>

      <Callout>
        Listing requirement: an adapter gets a row in this registry when its
        output passes the conformance suite and its conflict behavior is
        demonstrated. Open a PR with your adapter + fixtures.
      </Callout>
    </article>
  );
}
