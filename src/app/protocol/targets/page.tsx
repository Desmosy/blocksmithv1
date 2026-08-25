import manifest from "../../../../packages/protocol/compile-targets.v1.json";
import { Callout, Code, H1, H2, P, Pre, Table } from "../ui";

export default function TargetsPage() {
  return (
    <article>
      <H1 kicker="Compile out">Compile targets</H1>
      <P>
        A target compiles the <strong>official graph</strong> into a runtime
        artifact: a wiki, an npm package, agent tool payloads, a device
        profile, a C header. Same block ids, same versions, same hashes —
        different emitter. The manifest below is machine-readable:{" "}
        <a className="underline" href="/schema/blocksmith.compile-targets.v1.json">
          compile-targets.v1 schema
        </a>.
      </P>

      <H2>Target registry</H2>
      <Table
        head={["Target", "Output", "Official only", "Status", "Reference"]}
        rows={manifest.targets.map((t) => [
          <Code key="id">{t.id}</Code>,
          t.output,
          t.officialOnly ? "✅ required" : "— (human preview)",
          t.status ?? "—",
          <Code key="ref">{t.reference ?? "—"}</Code>,
        ])}
      />

      <H2>Build a target in a weekend</H2>
      <P>The entire contract:</P>
      <Table
        head={["#", "Rule"]}
        rows={[
          ["1", <span key="1">Input: an official <Code>BlocksmithGraphV1</Code> — validate it first with <Code>{`validateGraph(g, { officialOnly: true, verifyHashes: true })`}</Code></span>],
          ["2", <span key="2">Output: your artifact + the graph&apos;s <Code>contentHash</Code> stamped inside it (traceability)</span>],
          ["3", <span key="3">Preserve block id + version on everything you emit — a color in your artifact must trace to <Code>token:color:accent@v3</Code></span>],
          ["4", "Never read drafts or conflicts. If you need preview semantics, you are building a wiki — different rules."],
          ["5", "Register in compile-targets.v1.json via PR."],
        ]}
      />
      <Pre title="40-line skeleton">{`import { validateGraph } from "@blocksmith/protocol";
import type { BlocksmithGraphV1 } from "@blocksmith/protocol";

export function compileMyTarget(graph: BlocksmithGraphV1): string {
  const v = validateGraph(graph, { officialOnly: true, verifyHashes: true });
  if (!v.ok) throw new Error(v.errors.map(e => e.message).join("; "));

  const lines = [\`/* graph \${graph.contentHash} */\`];
  for (const b of graph.blocks) {
    if (b.type !== "token") continue;
    lines.push(\`--\${b.id.split(":").pop()}: \${b.content.value}; /* \${b.id}@v\${b.version} */\`);
  }
  return lines.join("\\n");
}`}</Pre>
      <P>
        Worked examples to crib from: <Code>device-sim</Code> (~200 lines,
        includes a semantic-loss metric) and <Code>c-header</Code> (~100
        lines, every <Code>#define</Code> commented with{" "}
        <Code>block@version (hash)</Code>) in{" "}
        <Code>src/lib/ir/targets/</Code>.
      </P>

      <Callout>
        The next rung on the hardware ladder is <Code>lvgl</Code> (style packs
        for embedded UIs) — stubbed in the manifest and open for a weekend
        build. Automotive clusters, kiosks, and watches don&apos;t run React;
        they still deserve a design system with version semantics.
      </Callout>
    </article>
  );
}
