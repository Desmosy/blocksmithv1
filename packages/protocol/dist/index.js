/**
 * @blocksmith/protocol — blocksmith.blocks.v1 Design IR interchange format.
 *
 * Any tool compiles INTO the block graph (ingest adapter); any consumer
 * compiles OUT (compile target). blocksmith.lock pins production in every
 * repo. This package is everything a third party needs to speak the
 * protocol without cloning BlockSmith.
 */
export { BLOCKS_SCHEMA, LOCK_SCHEMA, REGISTRY_SCHEMA, COMPILE_TARGETS_SCHEMA, } from "./types";
export { canonicalJson, sha256Hex, blockContentHash, graphHash } from "./hash";
export { validateGraph, validateLock, validateRegistryEntry, validateRegistryManifest, validateCompileTargets, verifyLockAgainstGraph, lockFromGraph, } from "./validate";
