import { Callout, Code, H1, H2, P, Pre, Table } from "../ui";

export default function ConformancePage() {
  return (
    <article>
      <H1 kicker="Prove it">Conformance</H1>
      <P>
        &quot;Speaks blocks.v1&quot; is a testable claim, not a vibe. The
        suite ships inside <Code>@blocksmith/protocol</Code>; fork the
        fixtures, point them at your emitter, and the exit code is your
        answer.
      </P>

      <H2>Run it</H2>
      <Pre title="terminal">{`# inside the BlockSmith repo (also runs the app↔package drift gate):
npm run protocol:conformance

# as a third party, in the package:
npm install @blocksmith/protocol
npx tsx node_modules/@blocksmith/protocol/conformance/run.ts`}</Pre>

      <H2>What it checks</H2>
      <Table
        head={["Category", "Fixtures", "Assertion"]}
        rows={[
          [
            <Code key="v">valid/</Code>,
            "minimal-graph · full-acme-graph · fresh-lock",
            "Validate clean, hashes recompute byte-for-byte, lock fresh against its graph",
          ],
          [
            <Code key="i">invalid/</Code>,
            "wrong-schema-field · draft-in-official-graph · bad-content-hash · lock-version-mismatch",
            "Each fails for the DOCUMENTED reason — not just any error",
          ],
          [
            <Code key="b">behavioral/</Code>,
            "golden-vectors.json",
            "blockContentHash + graphHash golden vectors reproduce exactly; graph hash is order-independent; key order never matters",
          ],
          [
            "registry rules",
            "(in-runner)",
            "Append-only versions enforced; official pointer must reference a recorded version",
          ],
        ]}
      />

      <H2>The drift gate (reference repo only)</H2>
      <P>
        BlockSmith&apos;s CI additionally proves the app and the published
        package never diverge: hash implementations compared on shared
        vectors, schema copies byte-identical, and live registry output
        validated against <Code>registry.v1</Code>. It runs on every PR
        touching <Code>packages/protocol/</Code>, <Code>src/lib/ir/</Code>, or{" "}
        <Code>public/schema/</Code> (<Code>.github/workflows/protocol-conformance.yml</Code>).
      </P>
      <Callout>
        This gate caught a real divergence on its very first run — a stray
        NUL-byte separator in the app&apos;s hash input. That is the entire
        argument for executable conformance: hash law is enforced by CI, not
        by code review vigilance.
      </Callout>

      <H2>Badge</H2>
      <P>
        Adapters and targets that pass may carry{" "}
        <strong>blocks.v1 conformant</strong> in their README and get a row in
        the <a className="underline" href="/protocol/adapters">adapter</a> /{" "}
        <a className="underline" href="/protocol/targets">target</a> registries.
      </P>
    </article>
  );
}
