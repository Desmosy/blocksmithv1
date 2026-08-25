import { readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { resolveScanRoots } from "./workspace-config";

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  "out",
  "coverage",
  ".blocksmith",
  ".turbo",
  ".cache",
  ".storybook",
  "__tests__",
  "__mocks__",
  "__snapshots__",
  "e2e",
  ".playwright",
  ".cypress",
]);

/** Files that are noise for design-system extraction. */
const SKIP_FILE_RE =
  /\.(?:test|spec|stories|story)\.[tj]sx?$/i;

/** Safety valve — stop walking after this many files. */
const MAX_FILES = 5_000;

const UI_EXT = /\.(tsx|jsx|css|scss)$/i;
const CONFIG_NAMES = new Set([
  "tailwind.config.js",
  "tailwind.config.ts",
  "tailwind.config.mjs",
  "tailwind.config.cjs",
]);

/** @deprecated use resolveScanRoots(workspaceRoot, config) */
export function defaultScanRoots(workspaceRoot: string): string[] {
  return resolveScanRoots(workspaceRoot);
}

export function walkUiFiles(
  workspaceRoot: string,
  roots: string[],
  opts?: { maxFiles?: number },
): { relPath: string; absPath: string }[] {
  const limit = opts?.maxFiles ?? MAX_FILES;
  const out: { relPath: string; absPath: string }[] = [];
  const seen = new Set<string>();
  let capped = false;

  const visit = (absDir: string) => {
    if (capped) return;
    let entries: string[];
    try {
      entries = readdirSync(absDir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (capped) return;
      if (SKIP_DIRS.has(name)) continue;
      const abs = join(absDir, name);
      let st;
      try {
        st = statSync(abs);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        visit(abs);
        continue;
      }
      if (SKIP_FILE_RE.test(name)) continue;
      const rel = relative(workspaceRoot, abs);
      if (seen.has(rel)) continue;
      if (UI_EXT.test(name) || CONFIG_NAMES.has(name)) {
        seen.add(rel);
        out.push({ relPath: rel, absPath: abs });
        if (out.length >= limit) {
          capped = true;
          return;
        }
      }
    }
  };

  for (const root of roots) {
    visit(join(workspaceRoot, root));
  }

  // Root-level tailwind + globals
  const themeFiles = [
    "src/app/globals.css",
    "app/globals.css",
    "src/styles/globals.css",
    "styles/globals.css",
    "src/index.css",
    "src/App.css",
    "index.css",
    "App.css",
  ];
  for (const rel of themeFiles) {
    const abs = join(workspaceRoot, rel);
    try {
      if (statSync(abs).isFile()) {
        if (!seen.has(rel)) {
          seen.add(rel);
          out.push({ relPath: rel, absPath: abs });
        }
      }
    } catch {
      /* missing */
    }
  }

  for (const name of ["tailwind.config.ts", "tailwind.config.js", "tailwind.config.mjs"]) {
    const abs = join(workspaceRoot, name);
    try {
      if (statSync(abs).isFile()) {
        const rel = relative(workspaceRoot, abs);
        if (!seen.has(rel)) {
          seen.add(rel);
          out.push({ relPath: rel, absPath: abs });
        }
      }
    } catch {
      /* missing */
    }
  }

  return out.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

export function findDesignDocPaths(workspaceRoot: string): string[] {
  const names = ["DESIGN.md", "design.md", "DESIGN_SYSTEM.md", "docs/DESIGN.md"];
  const found: string[] = [];
  for (const name of names) {
    const abs = join(workspaceRoot, name);
    try {
      if (statSync(abs).isFile()) found.push(name);
    } catch {
      /* missing */
    }
  }
  return found;
}
