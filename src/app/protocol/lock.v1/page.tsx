import { Callout, Code, H1, H2, P, Pre, Table } from "../ui";

const EXAMPLE_LOCK = `{
  "schema": "blocksmith.lock.v1",
  "docRef": "upload:scan-acme-mobile-app.md",
  "systemId": "acme-mobile-app",
  "contentHash": "sha256:afffd0184ad0a9a1d184f247916216c1",
  "generatedAt": "2026-06-04T12:00:00.000Z",
  "blocks": {
    "agent-rule:cta-density":   { "version": 2, "contentHash": "sha256:f230b745…" },
    "component:button-primary": { "version": 4, "contentHash": "sha256:d9d425a1…" },
    "token:color:accent":       { "version": 1, "contentHash": "sha256:a40ae6c9…" }
  },
  "package": { "name": "@blocksmith/acme-mobile-app" }
}`;

export default function LockSpec() {
  return (
    <article>
      <H1 kicker="blocksmith.lock.v1">The lock — package-lock.json for design</H1>
      <P>
        Lives in the consumer repository next to <Code>DESIGN.md</Code>. Pins
        every promoted block to an exact <Code>version</Code> +{" "}
        <Code>contentHash</Code>. Agents resolve against the lock, never
        &quot;latest markdown&quot;. CI fails when the lock drifts from the
        promoted graph.
      </P>
      <Pre title="blocksmith.lock">{EXAMPLE_LOCK}</Pre>

      <H2>Staleness — the core mechanic</H2>
      <P>
        <Code>contentHash</Code> is the official graph hash at lock time.
        Any promote or rollback after that changes the graph hash, so{" "}
        <Code>verifyLockAgainstGraph(lock, graph)</Code> reports{" "}
        <Code>stale: true</Code> — your repo is pinned to yesterday&apos;s
        truth and needs a re-pull. Field-level drift (a pin whose version no
        longer matches the official pointer) is reported per block.
      </P>
      <Pre title="@blocksmith/protocol">{`import { verifyLockAgainstGraph, validateLock } from "@blocksmith/protocol";

validateLock(lock);                            // shape check
const { ok, stale, errors } = verifyLockAgainstGraph(lock, officialGraph);
// stale → re-pull; errors list per-block version/hash drift`}</Pre>

      <H2>Pull flow (reference implementation)</H2>
      <Table
        head={["Step", "What happens"]}
        rows={[
          ["1 · Human promotes in wiki Pipeline", "Official pointer advances; reference lock regenerated server-side"],
          [<span key="2">2 · <Code>blocksmith pull --doc …</Code></span>, "CLI writes blocksmith.lock into the repo (also available: GET /api/v1/lock?format=file)"],
          ["3 · Agents (MCP) read pinned versions", "Every tool response is stamped “pinned vN (sha256:…)”; drafts are never served"],
          [<span key="4">4 · CI gate <Code>validate:ui</Code></span>, "PR fails on stale/missing lock or off-token values in the diff"],
          ["5 · Rollback", "Pointer moves back; lock regenerates; the rollback itself is an audited run"],
        ]}
      />

      <Callout>
        Determinism guarantee: the same official graph always serializes to
        the same lock body (sorted block ids, canonical hashes) — locks diff
        cleanly in code review, and two machines never disagree about what
        production means.
      </Callout>

      <H2>Downloads</H2>
      <P>
        <a className="underline" href="/schema/blocksmith.lock.v1.json">JSON Schema</a> · fixture:{" "}
        <Code>@blocksmith/protocol/fixtures/acme-minimal.lock.v1.json</Code>
      </P>
    </article>
  );
}
