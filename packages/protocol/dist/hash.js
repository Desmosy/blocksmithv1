/**
 * Canonical hashing — CONSTITUTIONAL. Byte-identical to the BlockSmith
 * reference implementation (src/lib/ir/hash.ts). Any change here is a
 * protocol major version (blocks.v2) and requires professor sign-off.
 *
 * Properties third parties can rely on:
 *  - canonicalJson: object keys sorted recursively, arrays order-preserved,
 *    `undefined` properties dropped — two graphs meaning the same thing
 *    serialize identically.
 *  - blockContentHash: `sha256:` + first 32 hex chars of
 *    sha256("<id> <type> <canonicalJson(content)>").
 *  - graphHash: order-independent — lines "<id>@<version>:<contentHash>"
 *    sorted, joined with "\n", then `sha256:` + first 32 hex chars.
 */
import { createHash } from "crypto";
/** Deterministic JSON: object keys sorted recursively, arrays preserved. */
export function canonicalJson(value) {
    return JSON.stringify(sortValue(value));
}
function sortValue(value) {
    if (Array.isArray(value))
        return value.map(sortValue);
    if (value && typeof value === "object") {
        const out = {};
        for (const key of Object.keys(value).sort()) {
            const v = value[key];
            if (v === undefined)
                continue;
            out[key] = sortValue(v);
        }
        return out;
    }
    return value;
}
export function sha256Hex(input) {
    return createHash("sha256").update(input).digest("hex");
}
/** Content hash of a block: id + type + canonical content. */
export function blockContentHash(id, type, content) {
    return `sha256:${sha256Hex(`${id} ${type} ${canonicalJson(content)}`).slice(0, 32)}`;
}
/**
 * Graph hash: order-independent digest over (id, version, contentHash).
 * The lock file stores this; CI compares it against the live registry.
 */
export function graphHash(entries) {
    const lines = entries
        .map((e) => `${e.id}@${e.version}:${e.contentHash}`)
        .sort()
        .join("\n");
    return `sha256:${sha256Hex(lines).slice(0, 32)}`;
}
