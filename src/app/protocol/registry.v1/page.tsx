import { Callout, Code, H1, H2, P, Pre, Table } from "../ui";

const EXAMPLE_ENTRY = `{
  "id": "component:primary-action-button",
  "official": 2,
  "versions": [
    {
      "version": 1, "status": "finalized",
      "title": "Primary Action Button", "type": "component",
      "content": { "role": "Primary CTA", "radius": "12px" },
      "contentHash": "sha256:…",
      "source": { "file": "src/components/Button.tsx", "ingest": "scan" },
      "updatedAt": "…", "createdAt": "…", "finalizedAt": "…", "editedBy": "ingest"
    },
    {
      "version": 2, "status": "finalized",
      "title": "Primary Action Button", "type": "component",
      "content": { "role": "Primary CTA", "radius": "14px" },
      "contentHash": "sha256:…",
      "source": { "file": "src/components/Button.tsx", "ingest": "scan" },
      "updatedAt": "…", "createdAt": "…", "finalizedAt": "…", "editedBy": "web"
    }
  ]
}`;

const EXAMPLE_MANIFEST = `{
  "schema": "blocksmith.registry.v1",
  "docRef": "upload:scan-acme-app.md",
  "systemId": "acme-design-system",
  "lastIngestAt": "2026-06-09T12:00:00.000Z",
  "officialGraphHash": "sha256:…",
  "blockCount": 40,
  "promotedCount": 38,
  "draftCount": 2,
  "staleCount": 0
}`;

export default function RegistrySpec() {
  return (
    <article>
      <H1 kicker="blocksmith.registry.v1">The registry — versions and the promote gate</H1>
      <P>
        The registry is the artifact store of Design CI/CD: per block id, an{" "}
        <strong>append-only</strong> list of version records plus one{" "}
        <Code>official</Code> pointer that defines production. Promote moves
        the pointer forward; rollback moves it back; history is never edited
        or deleted — npm-style.
      </P>

      <H2>Per-block entry</H2>
      <Pre title="BlockRegistryEntry">{EXAMPLE_ENTRY}</Pre>

      <H2>Per-doc manifest</H2>
      <Pre title="RegistryManifest">{EXAMPLE_MANIFEST}</Pre>

      <H2>Constitutional semantics</H2>
      <Table
        head={["Rule", "Spec text"]}
        rows={[
          ["Versions", "Append-only; strictly ascending; never delete or rewrite"],
          [<Code key="o">official</Code>, "Production pointer; the only lock-eligible version; must reference a recorded version"],
          ["Auto-promote", "token + component facts from scan ingest promote immediately — code is authoritative until re-scan"],
          ["Draft", "Governance edits (guideline, agent-rule, page) stage as draft until a human promotes"],
          [<Code key="s">stale</Code>, "Source vanished; block is flagged, last official version remains in the lock until a human decides"],
          [<Code key="c">conflict</Code>, "Cross-source disagreement (e.g. Figma hex ≠ scan hex); promote is blocked until a human resolves"],
          ["Partial ingest", "Adapters contributing alongside the primary scan (Storybook, Figma) must not stale blocks they don't own"],
        ]}
      />
      <Callout>
        These semantics are reviewed protocol law — implemented in the
        reference registry, exercised by <Code>verify:ir-cicd</Code> (29
        assertions), and validated structurally by{" "}
        <Code>validateRegistryEntry</Code> /{" "}
        <Code>validateRegistryManifest</Code>. Changes require professor +
        platform sign-off (see PROTOCOL-GOVERNANCE).
      </Callout>

      <H2>Lifecycle</H2>
      <Pre>{`INGEST → v(N+1) recorded ──┐
                            ├─ scan fact?      → auto-promote (official = N+1)
                            └─ governance?     → draft (staging)
PROMOTE (human gate)        → official = N+1; lock regenerated
ROLLBACK                    → official = previous finalized vK; lock regenerated
RE-SCAN (block missing)     → latest marked stale; lock pin survives`}</Pre>

      <H2>Downloads</H2>
      <P>
        <a className="underline" href="/schema/blocksmith.registry.v1.json">JSON Schema</a>{" "}
        (manifest + entry shapes) · validators in <Code>@blocksmith/protocol</Code>
      </P>
    </article>
  );
}
