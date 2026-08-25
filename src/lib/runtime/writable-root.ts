import "server-only";

import { tmpdir } from "os";
import { join } from "path";

export function isServerlessHosted(): boolean {
  return process.env.VERCEL === "1" || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
}

/** Writable `.blocksmith` root — local dev only; serverless skips disk audit (tiny /tmp). */
export function blocksmithWritableRoot(): string {
  if (isServerlessHosted()) {
    return join(tmpdir(), "blocksmith");
  }
  return join(process.cwd(), ".blocksmith");
}

/** Goal 1 on Vercel: wiki upload only — no scan-facts / curate cache on /tmp. */
export function skipLocalScanAudit(): boolean {
  return isServerlessHosted();
}

/** Skip writing scan snapshots into vendor fixture paths on hosted deploys. */
export function canWriteWorkspaceSnapshot(workspaceRoot: string): boolean {
  if (process.env.VERCEL !== "1" && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return true;
  }
  const fixtures = join(process.cwd(), "fixtures");
  return !workspaceRoot.startsWith(fixtures);
}
