/**
 * blocksmith.blocks.v1 protocol types — self-contained, zero dependencies.
 *
 * These mirror the published JSON Schemas in ../schemas/ exactly. The
 * BlockSmith app keeps an identical copy in src/lib/ir/types.ts; the
 * conformance suite's drift gate fails CI if the two ever diverge in
 * behavior (see conformance/drift.ts).
 */
export const BLOCKS_SCHEMA = "blocksmith.blocks.v1";
export const LOCK_SCHEMA = "blocksmith.lock.v1";
export const REGISTRY_SCHEMA = "blocksmith.registry.v1";
export const COMPILE_TARGETS_SCHEMA = "blocksmith.compile-targets.v1";
