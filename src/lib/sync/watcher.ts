/**
 * File watcher — watches design doc directories for changes.
 *
 * On change: clears registry cache for the affected doc, emits
 * `blocks.updated` on the sync bus so SSE pushes to connected wikis.
 *
 * Singleton — one watcher per process, survives hot reloads.
 */

import "server-only";

import { watch, type FSWatcher } from "chokidar";
import { existsSync } from "fs";
import { join, basename, relative } from "path";
import { syncBus } from "./events";
import { clearDesignSystemCache, loadDesignSystem } from "@/lib/clients/registry";
import { defaultScanRoots } from "@/lib/scan/walk";
import { resolveWorkspaceRoot } from "@/lib/scan/workspace-root";
import { scanAndPersist } from "@/lib/scan/run";

const DESIGNS_ROOT = join(process.cwd(), "docs/designs.md");
const UPLOADS_ROOT = join(process.cwd(), "data/uploads");

/** Debounce window — coalesce rapid saves */
const DEBOUNCE_MS = 300;
const WORKSPACE_SCAN_DEBOUNCE_MS = 2000;

interface WatcherState {
  watcher: FSWatcher | null;
  workspaceWatcher: FSWatcher | null;
  started: boolean;
  debounceTimers: Map<string, ReturnType<typeof setTimeout>>;
  workspaceScanTimer: ReturnType<typeof setTimeout> | null;
  watchedPaths: string[];
  lastEvent: { docRef: string; timestamp: string } | null;
}

const globalForWatcher = globalThis as unknown as {
  __blocksmithWatcher?: WatcherState;
};

function getState(): WatcherState {
  if (!globalForWatcher.__blocksmithWatcher) {
    globalForWatcher.__blocksmithWatcher = {
      watcher: null,
      workspaceWatcher: null,
      started: false,
      debounceTimers: new Map(),
      workspaceScanTimer: null,
      watchedPaths: [],
      lastEvent: null,
    };
  }
  return globalForWatcher.__blocksmithWatcher;
}

function docRefFromPath(filePath: string): string | null {
  // Only handle .md files
  if (!filePath.toLowerCase().endsWith(".md")) return null;

  const fileName = basename(filePath);
  if (fileName.toLowerCase() === "readme.md") return null;

  // Check if it's in uploads
  const relToUploads = safeRelative(UPLOADS_ROOT, filePath);
  if (relToUploads && !relToUploads.includes("/") && !relToUploads.includes("\\")) {
    return `upload:${fileName}`;
  }

  // Check if it's in designs.md/
  const relToDesigns = safeRelative(DESIGNS_ROOT, filePath);
  if (relToDesigns && !relToDesigns.includes("/") && !relToDesigns.includes("\\")) {
    return fileName;
  }

  return null;
}

function safeRelative(from: string, to: string): string | null {
  try {
    const rel = relative(from, to);
    if (rel.startsWith("..")) return null;
    return rel;
  } catch {
    return null;
  }
}

function handleFileChange(filePath: string) {
  const docRef = docRefFromPath(filePath);
  if (!docRef) return;

  const state = getState();
  const existing = state.debounceTimers.get(docRef);
  if (existing) clearTimeout(existing);

  state.debounceTimers.set(
    docRef,
    setTimeout(() => {
      state.debounceTimers.delete(docRef);

      clearDesignSystemCache();

      try {
        loadDesignSystem(docRef);
      } catch (err) {
        console.error("[sync] re-parse failed:", docRef, err);
      }

      const timestamp = new Date().toISOString();
      state.lastEvent = { docRef, timestamp };

      syncBus.emitSync({
        type: "blocks.updated",
        docRef,
        filePath,
        timestamp,
      });

      console.log(`[sync] ${docRef} updated → broadcasting to wiki clients`);
    }, DEBOUNCE_MS),
  );
}

/**
 * Start the file watcher. Safe to call multiple times — only starts once.
 */
export function startWatcher(): void {
  const state = getState();
  if (state.started) return;
  state.started = true;

  const paths = [DESIGNS_ROOT, UPLOADS_ROOT];
  state.watchedPaths = paths;

  console.log("[sync] Starting file watcher…");
  console.log(`[sync]   watching: ${paths.join(", ")}`);

  const watcher = watch(paths, {
    ignoreInitial: true,
    // Only .md files
    ignored: (path: string) => {
      if (path === DESIGNS_ROOT || path === UPLOADS_ROOT) return false;
      return !path.toLowerCase().endsWith(".md");
    },
    // Use polling as fallback for reliability on macOS
    usePolling: false,
    // Stabilize events — wait for writes to finish
    awaitWriteFinish: {
      stabilityThreshold: 200,
      pollInterval: 50,
    },
  });

  watcher.on("change", handleFileChange);
  watcher.on("add", handleFileChange);
  watcher.on("unlink", (filePath: string) => {
    const docRef = docRefFromPath(filePath);
    if (!docRef) return;
    clearDesignSystemCache();
    console.log(`[sync] ${docRef} deleted`);
  });

  watcher.on("ready", () => {
    console.log("[sync] File watcher ready");
  });

  watcher.on("error", (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sync] Watcher error:", msg);
  });

  state.watcher = watcher;

  startWorkspaceWatcher(state);
}

function startWorkspaceWatcher(state: WatcherState): void {
  if (process.env.BLOCKSMITH_SCAN_WATCH === "0") return;

  let workspaceRoot: string;
  try {
    workspaceRoot = resolveWorkspaceRoot();
  } catch {
    return;
  }

  const roots = defaultScanRoots(workspaceRoot)
    .map((r) => join(workspaceRoot, r))
    .filter((p) => existsSync(p));

  if (!roots.length) return;

  state.watchedPaths = [...state.watchedPaths, ...roots];

  const wsWatcher = watch(roots, {
    ignoreInitial: true,
    ignored: (path: string) => {
      if (roots.includes(path)) return false;
      return !/\.(tsx|jsx|css|scss)$/i.test(path);
    },
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 50 },
  });

  const scheduleRescan = () => {
    if (state.workspaceScanTimer) clearTimeout(state.workspaceScanTimer);
    state.workspaceScanTimer = setTimeout(async () => {
      state.workspaceScanTimer = null;
      try {
        const result = await scanAndPersist(workspaceRoot);
        clearDesignSystemCache();
        loadDesignSystem(result.docRef);
        const timestamp = new Date().toISOString();
        state.lastEvent = { docRef: result.docRef, timestamp };
        syncBus.emitSync({
          type: "blocks.updated",
          docRef: result.docRef,
          filePath: workspaceRoot,
          timestamp,
        });
        console.log(
          `[sync] workspace rescan → ${result.docRef} (${result.components} components, ${result.colors} colors)`,
        );
      } catch (err) {
        console.error("[sync] workspace rescan failed:", err);
      }
    }, WORKSPACE_SCAN_DEBOUNCE_MS);
  };

  wsWatcher.on("change", scheduleRescan);
  wsWatcher.on("add", scheduleRescan);
  wsWatcher.on("unlink", scheduleRescan);

  state.workspaceWatcher = wsWatcher;
  console.log(`[sync]   watching workspace: ${roots.join(", ")}`);
}

/** Get watcher status for the sync page */
export function getWatcherStatus(): {
  active: boolean;
  watchedPaths: string[];
  lastEvent: { docRef: string; timestamp: string } | null;
} {
  const state = getState();
  return {
    active: state.started,
    watchedPaths: state.watchedPaths,
    lastEvent: state.lastEvent,
  };
}
