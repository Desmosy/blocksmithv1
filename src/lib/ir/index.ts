/**
 * Design IR + Design CI/CD — research infrastructure layer.
 * docs/RESEARCH-INFRA-DESIGN-IR-AND-CICD.md
 */
export {
  BLOCKS_SCHEMA,
  LOCK_SCHEMA,
  type BlocksmithBlockV1,
  type BlocksmithGraphV1,
  type BlocksmithLockV1,
  type BlockRegistryEntry,
  type BlockVersionRecord,
  type LockVerification,
  type RegistryManifest,
} from "./types";
export { blockContentHash, canonicalJson, graphHash, sha256Hex } from "./hash";
export {
  recordIngest,
  promoteBlock,
  rollbackBlock,
  resolveConflict,
  getOfficialBlocks,
  getOfficialGraph,
  getBlockHistory,
  getRegistryEntry,
  listRegistryEntries,
  officialGraphHash,
  readManifest,
  fingerprintGraph,
  type IngestReport,
  type PromoteResult,
} from "./registry";
export {
  buildLock,
  serializeLock,
  writeReferenceLock,
  readLock,
  referenceLockPath,
  verifyLock,
} from "./lock";
export {
  listGovernedBlocks,
  listExcludedBlocks,
  getLockStatus,
  getRegistrySummary,
  type GovernedBlock,
  type LockStatus,
} from "./enforce";
export {
  compileDeviceSim,
  deviceCompileLoss,
  DEVICE_FRAMES,
  type DeviceProfile,
  type DeviceFrame,
  type DeviceToken,
  type DeviceWidget,
} from "./targets/device-sim";
export { emitTokensHeader } from "./targets/c-header";
