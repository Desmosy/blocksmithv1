import {
  BlockSmith,
  updateDesignMd,
  updateWikiOverrides,
  writeDesignMd,
  writeLock,
} from "@blocksmith/sdk";
import { resolvePullWorkspace } from "./resolve-workspace.js";

export async function pullOverrides(
  client: BlockSmith,
  docRef: string,
  workspaceFlag?: string,
) {
  console.log(`Pulling design system from ${docRef}...`);
  const response = await client.scans.pull(docRef);
  const overrides = response.overrides;

  // A pull is worth doing whenever the server can hand us the full design
  // system — even with zero finalized overrides, the repo still gets every
  // token, component, and guideline. Only bail when there is nothing at all.
  if (!response.fullMarkdown && !response.finalizedCount) {
    console.log("Nothing to pull yet — scan a repo and open its wiki first.");
    return;
  }

  const { path: workspaceRoot, reason } = resolvePullWorkspace({
    explicit: workspaceFlag,
    suggestedFromScan: response.suggestedWorkspace,
  });

  console.log(`  Target:    ${workspaceRoot}`);
  console.log(`  (${reason})`);

  if (
    response.suggestedWorkspace &&
    !workspaceFlag &&
    response.suggestedWorkspace !== workspaceRoot
  ) {
    console.log(
      `  Tip: scan was created from ${response.suggestedWorkspace} — use --workspace if your repo lives elsewhere.`,
    );
  }

  // 1. Full DESIGN.md — the complete wiki export (tokens, all components,
  //    guidelines, agent guide) with promoted governance already merged.
  if (response.fullMarkdown) {
    writeDesignMd(workspaceRoot, response.fullMarkdown);
    const s = response.stats;
    const summary = s
      ? ` (${s.components} components, ${s.colors} colors, ${s.typography} type styles, ${s.surfaces} surfaces)`
      : "";
    console.log(`  ✓ DESIGN.md — full ${response.systemName ?? "design system"}${summary}`);
  } else {
    // Fallback for older servers: write per-component deltas only.
    for (const [id, data] of Object.entries(overrides)) {
      updateDesignMd(workspaceRoot, id, data);
    }
    console.log(`  ✓ DESIGN.md — ${response.finalizedCount} finalized rule(s) (delta mode)`);
  }

  // 2. Structured overrides sidecar — survives the next rescan/merge.
  updateWikiOverrides(workspaceRoot, overrides);
  console.log(
    `  ✓ .blocksmith/wiki-overrides.json — ${response.finalizedCount} finalized override(s)`,
  );

  // 3. blocksmith.lock — pinned block versions for CI and agents.
  if (response.lock) {
    writeLock(workspaceRoot, response.lock);
    console.log("  ✓ blocksmith.lock — pinned versions for CI & agents");
  } else {
    console.log("  · blocksmith.lock skipped — promote blocks in the Pipeline to pin versions");
  }

  console.log("Done. Your repo now mirrors the wiki's promoted design truth.");
}
