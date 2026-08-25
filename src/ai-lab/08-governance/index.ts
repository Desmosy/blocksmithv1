// Pure exports only — safe for client bundles. The filesystem-backed history
// store lives in ./store and must be imported directly from server code.
export {
  scoreFidelity,
  type FidelityReport,
  type FidelityCheck,
  type FidelityStatus,
} from "./fidelity";
export {
  buildSystemSnapshot,
  diffSnapshots,
  type SystemSnapshot,
  type SystemDiff,
  type ComponentSig,
  type ColorChange,
  type ComponentFieldChange,
} from "./snapshot";
