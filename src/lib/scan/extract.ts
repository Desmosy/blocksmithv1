import { readFileSync, statSync } from "fs";
import { basename, join } from "path";
import { execSync } from "child_process";
import { extractCssRules } from "./css-rules";
import { extractUtilityClassesFromTsx } from "./tailwind-classes";
import type {
  ScannedColor,
  ScannedComponent,
  ScannedCssRule,
  ScannedCssVar,
  ScannedUtilityClass,
  WorkspaceScanResult,
} from "./types";
import { applyCatalogOverrides, classifyComponentForWiki } from "./catalog";
import { extractComponentInterface } from "./component-interface";
import {
  catalogPathPatterns,
  loadCatalogOverrides,
  loadWorkspaceConfig,
  resolveScanRoots,
} from "./workspace-config";
import { isScannableDesignComponent } from "./component-filter";
import { findDesignDocPaths, walkUiFiles } from "./walk";
import { resolveWorkspaceRoot, workspaceProjectName } from "./workspace-root";

const HEX_RE = /#([0-9a-fA-F]{3,8})\b/g;
const CSS_VAR_DEF_RE = /(--[\w-]+)\s*:\s*([^;}\n]+)/g;
const CSS_VAR_USE_RE = /var\((--[\w-]+)\)/g;
const EXPORT_RE =
  /export\s+(?:default\s+)?(?:async\s+)?(?:function\s+(\w+)|const\s+(\w+)\s*=|class\s+(\w+))/g;

const MAX_FILE_BYTES = 512_000;
/** Skip carrying source for huge files — codegen falls back to IR synthesis. */
const COMPONENT_SOURCE_CAP = 8_000;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeHex(raw: string): string | null {
  let h = raw.replace("#", "").toLowerCase();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 8) h = h.slice(0, 6);
  return h.length === 6 ? `#${h}` : null;
}

function readText(absPath: string): string | null {
  try {
    const st = statSync(absPath);
    if (st.size > MAX_FILE_BYTES) return null;
    return readFileSync(absPath, "utf-8");
  } catch {
    return null;
  }
}

function extractHexFromText(
  text: string,
  source: string,
  into: Map<string, ScannedColor>,
): void {
  let m: RegExpExecArray | null;
  HEX_RE.lastIndex = 0;
  while ((m = HEX_RE.exec(text)) !== null) {
    const hex = normalizeHex(`#${m[1]}`);
    if (!hex) continue;
    const key = `${hex}::${source}`;
    if (!into.has(key)) {
      into.set(key, { token: hex, hex, source });
    }
  }
}

function extractCssVarDefs(
  text: string,
  source: string,
  into: Map<string, ScannedCssVar>,
): void {
  let m: RegExpExecArray | null;
  CSS_VAR_DEF_RE.lastIndex = 0;
  while ((m = CSS_VAR_DEF_RE.exec(text)) !== null) {
    const name = m[1].trim();
    const value = m[2].trim().replace(/\s+/g, " ");
    const key = `${name}::${source}`;
    if (!into.has(key)) {
      into.set(key, { name, value, source });
    }
    const hex = normalizeHex(value);
    if (hex) {
      /* also tracked as color via caller */
    }
  }
}

function extractExports(text: string): string[] {
  const names = new Set<string>();
  let m: RegExpExecArray | null;
  EXPORT_RE.lastIndex = 0;
  while ((m = EXPORT_RE.exec(text)) !== null) {
    const name = m[1] || m[2] || m[3];
    if (name) names.add(name);
  }
  // export default Hero; (common in Vite/React portfolios)
  const DEFAULT_ID_RE = /export\s+default\s+([A-Za-z_$][\w$]*)\s*;/g;
  DEFAULT_ID_RE.lastIndex = 0;
  while ((m = DEFAULT_ID_RE.exec(text)) !== null) {
    if (m[1]) names.add(m[1]);
  }
  return [...names];
}

function componentTitle(filePath: string, exports: string[]): string {
  if (exports.length === 1) return exports[0];
  const base = basename(filePath).replace(/\.(tsx|jsx)$/i, "");
  return base;
}

function gitHead(workspaceRoot: string): string | null {
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: workspaceRoot,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim() || null;
  } catch {
    return null;
  }
}

export function scanWorkspace(overrideRoot?: string): WorkspaceScanResult {
  const workspaceRoot = resolveWorkspaceRoot(overrideRoot);
  const workspaceConfig = loadWorkspaceConfig(workspaceRoot);
  const catalogOverrides = loadCatalogOverrides(workspaceRoot);
  const catalogPatterns = catalogPathPatterns(workspaceConfig);
  const roots = resolveScanRoots(workspaceRoot, workspaceConfig);
  const files = walkUiFiles(workspaceRoot, roots);

  const colorMap = new Map<string, ScannedColor>();
  const cssVarMap = new Map<string, ScannedCssVar>();
  const cssRules: ScannedCssRule[] = [];
  const utilityClassMap = new Map<string, ScannedUtilityClass>();
  const components: ScannedComponent[] = [];
  const excludedComponents: WorkspaceScanResult["excludedComponents"] = [];
  const inventory: WorkspaceScanResult["inventory"] = [];

  for (const { relPath, absPath } of files) {
    const text = readText(absPath);
    if (!text) continue;

    extractHexFromText(text, relPath, colorMap);
    extractCssVarDefs(text, relPath, cssVarMap);

    if (/\.(css|scss)$/i.test(relPath)) {
      for (const rule of extractCssRules(text, relPath)) {
        cssRules.push(rule);
      }
    }

    for (const v of cssVarMap.values()) {
      if (v.source !== relPath) continue;
      const hex = normalizeHex(v.value);
      if (hex) {
        const key = `${hex}::${relPath}::${v.name}`;
        if (!colorMap.has(key)) {
          colorMap.set(key, { token: v.name, hex, source: `${relPath} (${v.name})` });
        }
      }
    }

    if (/\.(tsx|jsx)$/i.test(relPath)) {
      extractUtilityClassesFromTsx(text, relPath, utilityClassMap);

      const exports = extractExports(text);
      const title = componentTitle(relPath, exports);
      let decision = classifyComponentForWiki(
        relPath,
        exports,
        text,
        catalogPatterns,
      );
      const overridden = applyCatalogOverrides(relPath, decision, catalogOverrides);
      if (overridden === "skip") continue;
      decision = overridden;

      const colorsUsed = new Set<string>();
      const cssVarsUsed = new Set<string>();

      let hm: RegExpExecArray | null;
      HEX_RE.lastIndex = 0;
      while ((hm = HEX_RE.exec(text)) !== null) {
        const hex = normalizeHex(`#${hm[1]}`);
        if (hex) colorsUsed.add(hex);
      }
      let vm: RegExpExecArray | null;
      CSS_VAR_USE_RE.lastIndex = 0;
      while ((vm = CSS_VAR_USE_RE.exec(text)) !== null) {
        cssVarsUsed.add(vm[1]);
      }

      const catalog = {
        category: decision.category,
        designerRole: decision.designerRole,
        reason: decision.reason,
      };

      const featured =
        isScannableDesignComponent(relPath, exports) && decision.includeInWiki;

      inventory.push({
        filePath: relPath,
        title,
        exports,
        featured,
        category: decision.category,
      });

      if (!isScannableDesignComponent(relPath, exports)) continue;

      if (!decision.includeInWiki) {
        excludedComponents.push({ filePath: relPath, title, catalog });
        continue;
      }

      const componentInterface =
        extractComponentInterface(text, relPath, title) ?? undefined;
      // Carry verbatim source for faithful codegen; cap to keep scan docs lean.
      const source = text.length <= COMPONENT_SOURCE_CAP ? text : undefined;

      components.push({
        id: slugify(title),
        title,
        filePath: relPath,
        exports,
        colorsUsed: [...colorsUsed].sort(),
        cssVarsUsed: [...cssVarsUsed].sort(),
        catalog,
        interface: componentInterface,
        source,
      });
    }
  }

  const designDocs = findDesignDocPaths(workspaceRoot).map((filePath) => {
    const st = statSync(join(workspaceRoot, filePath));
    return { filePath, bytes: st.size };
  });

  return {
    workspaceRoot,
    workspaceId: workspaceConfig.workspaceId,
    workspaceIdExplicit: workspaceConfig.workspaceIdExplicit,
    projectName: workspaceProjectName(workspaceRoot),
    scannedAt: new Date().toISOString(),
    gitCommit: gitHead(workspaceRoot),
    colors: [...colorMap.values()].sort((a, b) => a.hex.localeCompare(b.hex)),
    cssVars: [...cssVarMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    cssRules: cssRules.sort((a, b) =>
      a.source === b.source
        ? a.selector.localeCompare(b.selector)
        : a.source.localeCompare(b.source),
    ),
    utilityClasses: [...utilityClassMap.values()].sort(
      (a, b) => b.count - a.count || a.className.localeCompare(b.className),
    ),
    components: components.sort((a, b) => a.title.localeCompare(b.title)),
    excludedComponents: excludedComponents.sort((a, b) =>
      a.title.localeCompare(b.title),
    ),
    inventory: inventory.sort((a, b) => a.filePath.localeCompare(b.filePath)),
    coverage: {
      scannedPaths: roots,
      totalFiles: files.length,
      reactFiles: inventory.length,
      featuredComponents: components.length,
      cssVarCount: cssVarMap.size,
      colorCount: colorMap.size,
      cssRuleCount: cssRules.length,
      utilityClassCount: utilityClassMap.size,
    },
    designDocs,
    scannedFiles: files.length,
  };
}
