/**
 * edit-policy — may a human edit / promote this doc from the wiki?
 *
 * Honesty rule (Step 1, see doc-lifecycle): the wiki must never show a fake
 * "promoted to production" on a doc that has no repo behind it.
 *
 *   lifecycle    doc kind            canEdit  canPromote   notes
 *   ─────────────────────────────────────────────────────────────────────────
 *   connected    GitHub / scan        yes       yes        full finalize+promote+pull
 *   pinned       verified lock         yes       yes        same as connected
 *   preview      upload:* (Option B)   yes       no         saves to preview document
 *   preview      bundled sample        no        no         read-only; connect a repo
 *
 * Client-safe: no fs / server-only imports. The upload check is a plain prefix
 * test so this can run in edit forms in the browser.
 */
import type { DocLifecycle } from "./doc-lifecycle";

export interface EditPolicy {
  /** May the user enter edit mode and save to staging on this doc? */
  canEdit: boolean;
  /** May staged changes be promoted to production (real Pipeline)? */
  canPromote: boolean;
  /** Human-readable reason shown when an action is blocked. */
  reason?: string;
}

const UPLOAD_DOC_PREFIX = "upload:";

function isUploadRef(fileName: string): boolean {
  return fileName.startsWith(UPLOAD_DOC_PREFIX) || fileName.startsWith("scan-");
}

export function canEditDoc(
  lifecycle: DocLifecycle,
  fileName: string,
): EditPolicy {
  if (lifecycle === "connected" || lifecycle === "pinned") {
    return { canEdit: true, canPromote: true };
  }

  // preview — Option B: uploaded docs can save to their preview document, but
  // never promote (no repo). Bundled samples (apollo.md, …) stay read-only.
  if (isUploadRef(fileName)) {
    return {
      canEdit: true,
      canPromote: false,
      reason:
        "Saved to your preview document. Connect a repo to promote to production and share with engineering.",
    };
  }

  return {
    canEdit: false,
    canPromote: false,
    reason:
      "This is a read-only sample. Connect a repo and scan to save changes to your team's pipeline.",
  };
}
