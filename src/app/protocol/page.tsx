import { Callout, Code, H1, H2, P, Pre, Table } from "./ui";

export default function ProtocolOverview() {
  return (
    <article>
      <H1 kicker="Open interchange format">
        Design truth needs a protocol, not another tool
      </H1>
      <P>
        Design systems live in Figma files, component code, markdown, and AI
        agent prompts — four copies, four versions of the truth, drifting
        daily. <Code>blocksmith.blocks.v1</Code> is the neutral packet format
        they all meet in: any tool compiles <strong>in</strong>, any consumer
        compiles <strong>out</strong>, and a lockfile pins production in every
        repo so agents physically cannot hallucinate your design system.
      </P>
      <Callout>
        <strong>Figma is Ethernet. This is TCP/IP.</strong> We don&apos;t own
        the design tools or the runtimes — we define the packet in the middle
        so everything interoperates. BlockSmith (wiki, Pipeline, MCP, device
        targets) is the reference implementation that dogfoods the spec.
      </Callout>

      <H2>The stack</H2>
      <Pre>{`┌─────────────────────────────────────────────────────────────┐
│  COMPILE TARGETS (outputs)                                   │
│  wiki · pulse-react · mcp · device-sim · c-header · lvgl…   │
└───────────────────────────▲─────────────────────────────────┘
                            │ read the OFFICIAL graph only
┌───────────────────────────┴─────────────────────────────────┐
│  blocksmith.lock.v1        — repo pin (agent + CI truth)     │
└───────────────────────────▲─────────────────────────────────┘
                            │ generated on promote
┌───────────────────────────┴─────────────────────────────────┐
│  blocksmith.registry.v1    — append-only versions + pointer  │
└───────────────────────────▲─────────────────────────────────┘
                            │ ingest writes versions
┌───────────────────────────┴─────────────────────────────────┐
│  blocksmith.blocks.v1      — Design IR graph (the packet)    │
└───────────────────────────▲─────────────────────────────────┘
                            │ adapters compile in
┌───────────────────────────┴─────────────────────────────────┐
│  INGEST ADAPTERS (inputs)                                    │
│  scan · markdown · governance · storybook · figma · …       │
└─────────────────────────────────────────────────────────────┘`}</Pre>
      <P>
        One rule holds the whole stack together: <strong>adapters write
        blocks.v1 only; targets read the official graph only; the lock pins
        what agents see.</strong> Drafts are staging — humans preview them in
        the wiki, agents never do.
      </P>

      <H2>Why a lockfile for design</H2>
      <P>
        Code solved drift twenty years ago: build, release,{" "}
        <Code>package-lock.json</Code>, deploy, rollback. Design never got the
        same lifecycle — until agents started writing UI at scale and made
        drift catastrophic. <Code>blocksmith.lock</Code> gives every block an
        exact pinned version and content hash. CI fails PRs that violate it.
        MCP serves nothing that isn&apos;t pinned. A promote in the wiki is a
        release; a rollback moves a pointer and never erases history.
      </P>

      <H2>Start here</H2>
      <Table
        head={["You are…", "Read", "Then"]}
        rows={[
          [
            "Building an ingest adapter (Figma plugin, token tool)",
            <a key="a" className="underline" href="/protocol/adapters">Ingest adapters</a>,
            "Emit blocks.v1, run conformance",
          ],
          [
            "Building a compile target (new runtime, new platform)",
            <a key="t" className="underline" href="/protocol/targets">Compile targets</a>,
            "Read official graphs, register your target",
          ],
          [
            "Pinning agents / CI in your repo",
            <a key="l" className="underline" href="/protocol/lock.v1">lock.v1</a>,
            "Pull the lock, gate PRs on validate:ui",
          ],
          [
            "Evaluating the category",
            <a key="b" className="underline" href="/protocol/blocks.v1">blocks.v1</a>,
            "Skim the graph spec — it fits on one page",
          ],
        ]}
      />

      <H2>Install</H2>
      <Pre title="terminal">{`npm install @blocksmith/protocol
# types · validators · canonical hashing · schemas · conformance fixtures
# zero runtime dependencies — speak the protocol without cloning BlockSmith`}</Pre>
    </article>
  );
}
