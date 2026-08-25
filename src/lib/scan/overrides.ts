import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

export const OVERRIDES_DIR = ".blocksmith";
export const OVERRIDES_FILE = "wiki-overrides.json";

export type ComponentOverride = {
  role?: string;
  description?: string;
  updatedAt?: string;
};

export type WikiOverrides = {
  version: 1;
  components: Record<string, ComponentOverride>;
};

function overridesPath(workspaceRoot: string): string {
  return join(workspaceRoot, OVERRIDES_DIR, OVERRIDES_FILE);
}

export function readWikiOverrides(workspaceRoot: string): WikiOverrides {
  const path = overridesPath(workspaceRoot);
  if (!existsSync(path)) {
    return { version: 1, components: {} };
  }
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8")) as WikiOverrides;
    if (raw?.version === 1 && raw.components) return raw;
  } catch {
    /* corrupt file — treat as empty */
  }
  return { version: 1, components: {} };
}

export function writeWikiOverrides(
  workspaceRoot: string,
  overrides: WikiOverrides,
): string {
  const dir = join(workspaceRoot, OVERRIDES_DIR);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, OVERRIDES_FILE);
  writeFileSync(path, `${JSON.stringify(overrides, null, 2)}\n`, "utf-8");
  return path;
}

import { updateDesignMd } from "./design-md";

export function setComponentOverride(
  workspaceRoot: string,
  componentId: string,
  data: { role: string; description: string },
): string {
  const overrides = readWikiOverrides(workspaceRoot);
  overrides.components[componentId] = {
    role: data.role,
    description: data.description,
    updatedAt: new Date().toISOString(),
  };
  const path = writeWikiOverrides(workspaceRoot, overrides);
  
  // Also write to DESIGN.md as promised in docs
  updateDesignMd(workspaceRoot, componentId, data);
  
  return path;
}
