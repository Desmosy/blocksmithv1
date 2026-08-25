import { readFileSync, statSync } from "fs";
import { join } from "path";
import type { ComponentDoc } from "@/lib/blocks/types";
import {
  isUploadDocRef,
  resolveUploadPath,
  uploadFileNameFromRef,
} from "@/lib/uploads/store";
import { getWorkspaceRootFromMarkdown } from "./parse";
import { resolveWorkspaceRoot } from "./workspace-root";

const MAX_LINES = 120;
const MAX_BYTES = 48_000;

export function readComponentSourceExcerpt(
  workspaceRoot: string,
  sourceFile: string,
): string | null {
  const abs = join(workspaceRoot, sourceFile);
  try {
    const st = statSync(abs);
    if (st.size > MAX_BYTES) {
      return readFileSync(abs, "utf-8")
        .split("\n")
        .slice(0, MAX_LINES)
        .join("\n")
        .concat("\n\n// … truncated (file too large for wiki excerpt)");
    }
    const lines = readFileSync(abs, "utf-8").split("\n");
    if (lines.length <= MAX_LINES) return lines.join("\n");
    return lines.slice(0, MAX_LINES).join("\n").concat("\n\n// … truncated");
  } catch {
    return null;
  }
}

export function readComponentSourceExcerptFromEnv(
  sourceFile: string,
  workspaceOverride?: string,
): string | null {
  try {
    const root = resolveWorkspaceRoot(workspaceOverride);
    return readComponentSourceExcerpt(root, sourceFile);
  } catch {
    return null;
  }
}

export function resolveComponentExcerptForDoc(
  docFileName: string,
  component: ComponentDoc,
): string | null {
  if (!component.scan?.sourceFile) return null;

  let root = process.env.BLOCKSMITH_WORKSPACE?.trim();
  if (isUploadDocRef(docFileName)) {
    try {
      const md = readFileSync(
        resolveUploadPath(uploadFileNameFromRef(docFileName)),
        "utf-8",
      );
      root = getWorkspaceRootFromMarkdown(md) ?? root;
    } catch {
      /* keep env root */
    }
  }

  if (!root) return null;
  try {
    return readComponentSourceExcerpt(root, component.scan.sourceFile);
  } catch {
    return null;
  }
}
