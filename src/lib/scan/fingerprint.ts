import { createHash } from "crypto";
import type { WorkspaceScanResult } from "./types";

/** Stable hash of scan facts — excludes timestamps and prose overrides. */
export function scanResultFingerprint(result: WorkspaceScanResult): string {
  const payload = {
    workspaceRoot: result.workspaceRoot,
    inventory: result.inventory.map((f) => ({
      filePath: f.filePath,
      exports: f.exports,
      featured: f.featured,
      category: f.category,
    })),
    components: result.components.map((c) => ({
      id: c.id,
      filePath: c.filePath,
      exports: c.exports,
      cssVarsUsed: c.cssVarsUsed,
      colorsUsed: c.colorsUsed,
    })),
    cssVars: result.cssVars.map((v) => ({ name: v.name, value: v.value })),
    cssRules: result.cssRules.map((r) => ({
      selector: r.selector,
      declarations: r.declarations,
      source: r.source,
    })),
    utilityClasses: result.utilityClasses.map((u) => ({
      className: u.className,
      count: u.count,
    })),
    colors: result.colors.map((c) => ({ hex: c.hex, source: c.source })),
  };
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 16);
}
