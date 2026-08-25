/**
 * doc-lifecycle — is this wiki a *preview* of a document, or *connected* to a repo?
 *
 * Step 1 honesty rule: pasted / uploaded / bundled-sample docs are PREVIEW — they
 * render the wiki for browsing, but Pipeline, promote, and lock stay off because
 * nothing is wired to a real codebase. Only a GitHub / workspace scan turns the
 * release machinery on (CONNECTED). `pinned` (lock verified in the customer's
 * repo) is a later step and currently collapses to `connected`.
 *
 *   How the doc was created            lifecycle
 *   ──────────────────────────────────────────────
 *   Paste / upload (scanMode "import") preview
 *   Bundled sample (apollo.md, …)      preview
 *   GitHub / workspace scan            connected
 *   Lock verified in customer repo     pinned   (Step 2–3)
 */
export type DocLifecycle = "preview" | "connected" | "pinned";

/** Scan kinds that produce a real, connected design system (see ScanRequest). */
const CONNECTED_SCAN_MODES = new Set([
  "github",
  "workspace",
  "clientScan",
  "fixture",
]);

export interface DocLifecycleInput {
  /** Parsed system mode — "workspace-scan" is the local signal of a real scan. */
  mode?: string | null;
  /** Document record scan_mode ("import" | "github" | "workspace" | …). */
  scanMode?: string | null;
  /** Step 2+: the reference lock has been verified inside the customer repo. */
  hasVerifiedLock?: boolean;
}

export function getDocLifecycle(input: DocLifecycleInput): DocLifecycle {
  const connected =
    input.mode === "workspace-scan" ||
    (input.scanMode != null && CONNECTED_SCAN_MODES.has(input.scanMode));

  if (!connected) return "preview";
  // `pinned` is reserved for Step 2–3 (verified lock); collapse to connected now.
  return input.hasVerifiedLock ? "pinned" : "connected";
}

/** True when the doc is preview-only and release machinery must stay off. */
export function isPreviewDoc(input: DocLifecycleInput): boolean {
  return getDocLifecycle(input) === "preview";
}
