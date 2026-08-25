import type { BlocksmithGraphV1, BlocksmithLockV1 } from "./types";
export interface ValidationError {
    path: string;
    message: string;
}
export interface ValidationResult {
    ok: boolean;
    errors: ValidationError[];
}
export interface GraphValidationOptions {
    /**
     * Enforce the official-graph rule: no draft or conflict blocks. Use when
     * validating what a compile target or agent is about to consume.
     */
    officialOnly?: boolean;
    /** Recompute every contentHash + the graph hash and compare. */
    verifyHashes?: boolean;
}
export declare function validateGraph(input: unknown, options?: GraphValidationOptions): ValidationResult;
export declare function validateLock(input: unknown): ValidationResult;
export declare function validateRegistryEntry(input: unknown): ValidationResult;
export declare function validateRegistryManifest(input: unknown): ValidationResult;
export declare function validateCompileTargets(input: unknown): ValidationResult;
export interface LockVerifyResult extends ValidationResult {
    stale: boolean;
}
/**
 * Verify a lock against the graph it claims to pin — the staleness check
 * every consumer should run before trusting pinned versions.
 */
export declare function verifyLockAgainstGraph(lock: BlocksmithLockV1, graph: BlocksmithGraphV1): LockVerifyResult;
/** Convenience: build a valid lock from an official graph. */
export declare function lockFromGraph(graph: BlocksmithGraphV1, options?: {
    packageName?: string;
}): BlocksmithLockV1;
