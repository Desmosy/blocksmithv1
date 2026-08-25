/** Deterministic JSON: object keys sorted recursively, arrays preserved. */
export declare function canonicalJson(value: unknown): string;
export declare function sha256Hex(input: string): string;
/** Content hash of a block: id + type + canonical content. */
export declare function blockContentHash(id: string, type: string, content: unknown): string;
/**
 * Graph hash: order-independent digest over (id, version, contentHash).
 * The lock file stores this; CI compares it against the live registry.
 */
export declare function graphHash(entries: {
    id: string;
    version: number;
    contentHash: string;
}[]): string;
