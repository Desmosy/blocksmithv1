/**
 * @blocksmith/protocol — blocksmith.blocks.v1 Design IR interchange format.
 *
 * Any tool compiles INTO the block graph (ingest adapter); any consumer
 * compiles OUT (compile target). blocksmith.lock pins production in every
 * repo. This package is everything a third party needs to speak the
 * protocol without cloning BlockSmith.
 */
export { BLOCKS_SCHEMA, LOCK_SCHEMA, REGISTRY_SCHEMA, COMPILE_TARGETS_SCHEMA, type BlockStatus, type BlockType, type IngestSource, type EditOrigin, type BlockSource, type BlocksmithBlockV1, type BlocksmithGraphV1, type BlocksmithLockV1, type BlockVersionRecord, type BlockRegistryEntry, type RegistryManifestV1, type CompileTargetV1, type CompileTargetsManifestV1, } from "./types";
export { canonicalJson, sha256Hex, blockContentHash, graphHash } from "./hash";
export { validateGraph, validateLock, validateRegistryEntry, validateRegistryManifest, validateCompileTargets, verifyLockAgainstGraph, lockFromGraph, type ValidationError, type ValidationResult, type GraphValidationOptions, type LockVerifyResult, } from "./validate";
