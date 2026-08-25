/**
 * Canonical hashing for blocksmith.blocks.v1.
 *
 * Two graphs that mean the same thing must hash the same — regardless of key
 * order, whitespace, or which adapter produced them. This is the property the
 * lock file's staleness detection rests on (research doc §6.3).
 *
 * CONSTITUTIONAL: must stay byte-identical to packages/protocol/src/hash.ts.
 * The drift gate (npm run protocol:conformance) fails CI if they diverge.
 * Changing semantics here is a blocks.v2 spec bump with professor sign-off.
 */
import { createHash } from "crypto";

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

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
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
