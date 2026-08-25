/**
 * Investor demo seed (PROJECT-PIPELINE.md "Investor demo mode").
 *
 * Deterministic, re-runnable state for /demo/investor:
 *   · production blocks (auto-promoted scan facts)
 *   · a STALE lock (a token re-scan promoted after the lock was pinned)
 *   · 3 drafts waiting in Staging
 *   · 1 conflict (Figma vs scan accent)
 *
 * Each re-seed bumps fresh draft/conflict versions (append-only history),
 * so the demo always opens with something to promote — no local setup.
 */
import type { StoredBlock } from "@/lib/blocks/content";
import { recordIngest, promoteBlock } from "./registry";
import { writeReferenceLock } from "./lock";
import { appendRun } from "./pipeline-runs";

export const INVESTOR_DEMO_DOC = "demo:investor.md";
const SYSTEM = "acme-mobile-app-demo";

function mk(p: Partial<StoredBlock> & { id: string; title: string }): StoredBlock {
  return {
    type: "token",
    source: { file: "src/styles/tokens.css", ingest: "scan" },
    updatedAt: new Date().toISOString(),
    contentHash: "",
    status: "finalized",
    docRef: INVESTOR_DEMO_DOC,
    content: {},
    ...p,
  } as StoredBlock;
}

export interface DemoSeedResult {
  docRef: string;
  staged: number;
  conflicts: number;
  lockStale: boolean;
}

export function seedInvestorDemo(): DemoSeedResult {
  const nonce = Date.now().toString(36).slice(-5);

  // 1 · Production base — what a scan of acme/mobile-app found (stable).
  const base: StoredBlock[] = [
    mk({
      id: "token:color:accent",
      title: "Accent",
      content: { value: "#d97757", cssVar: "--color-accent", summary: "Primary CTA color" },
    }),
    mk({
      id: "token:color:surface",
      title: "Surface",
      content: { value: "#101014", cssVar: "--color-surface", summary: "App background" },
    }),
    mk({
      id: "token:spacing:space-4",
      title: "Space 4",
      content: { value: "16px", cssVar: "--space-4" },
    }),
    mk({
      id: "component:button-primary",
      type: "component",
      title: "Primary Button",
      source: { file: "src/components/Button.tsx", ingest: "scan" },
      content: { role: "Primary call to action", radius: "12px", description: "Filled pill button reading --color-accent." },
    }),
    mk({
      id: "component:nav-bar",
      type: "component",
      title: "Nav Bar",
      source: { file: "src/components/NavBar.tsx", ingest: "scan" },
      content: { role: "Top-level navigation", radius: "0px" },
    }),
  ];
  recordIngest(INVESTOR_DEMO_DOC, SYSTEM, base);
  // Promote any leftover drafts from a previous demo run so staging resets.
  for (const b of base) promoteBlock(INVESTOR_DEMO_DOC, b.id, SYSTEM);

  // 2 · Pin the lock — agents/CI now resolve this graph.
  writeReferenceLock(INVESTOR_DEMO_DOC);

  // 3 · Re-scan bumps a token AFTER the lock → lock goes stale (on purpose).
  const rescan = recordIngest(INVESTOR_DEMO_DOC, SYSTEM, [
    ...base.filter((b) => b.id !== "token:spacing:space-4"),
    mk({
      id: "token:spacing:space-4",
      title: "Space 4",
      content: { value: "16px", cssVar: "--space-4", summary: `rescan-${nonce}` },
    }),
  ]);
  appendRun({
    docRef: INVESTOR_DEMO_DOC,
    actor: "ingest",
    action: "ingest",
    summary: `Scan: ${rescan.created.length} new · ${rescan.bumped.length} updated · ${rescan.staled.length} stale`,
    blocks: rescan.bumped.map((id) => ({ id, version: rescan.versions[id] })),
  });

  // 4 · Three governance drafts land in Staging (agents cannot see them).
  recordIngest(INVESTOR_DEMO_DOC, SYSTEM, [
    ...base,
    mk({
      id: "agent-rule:cta-density",
      type: "agent-rule",
      title: "CTA density",
      status: "draft",
      source: { file: "DESIGN.md", ingest: "governance" },
      content: {
        text: `Max one primary CTA per view. Secondary actions use the ghost button. (rev ${nonce})`,
      },
    }),
    mk({
      id: "guideline:voice-tone",
      type: "guideline",
      title: "Voice & tone",
      status: "draft",
      source: { file: "DESIGN.md", ingest: "governance" },
      content: {
        items: [
          "Confident, never pushy",
          "Sentence case everywhere",
          `Error copy offers a next step (rev ${nonce})`,
        ],
      },
    }),
    mk({
      id: "agent-rule:spacing-rhythm",
      type: "agent-rule",
      title: "Spacing rhythm",
      status: "draft",
      source: { file: "DESIGN.md", ingest: "governance" },
      content: {
        text: `All vertical gaps are multiples of --space-4. No magic 13px. (rev ${nonce})`,
      },
    }),
    // 5 · Figma disagrees with shipped code → conflict card.
    mk({
      id: "token:color:accent-figma",
      title: "Accent (Figma)",
      status: "conflict",
      source: { file: "figma:acme-design-kit", ingest: "figma" },
      content: {
        value: "#e0815f",
        cssVar: "--color-accent",
        summary: `Figma accent diverges from shipped code (sync ${nonce})`,
      },
    }),
  ]);

  appendRun({
    docRef: INVESTOR_DEMO_DOC,
    actor: "demo",
    action: "demo-seed",
    summary: "Investor demo seeded: 3 drafts staged, 1 conflict, lock stale",
    blocks: [],
  });

  return { docRef: INVESTOR_DEMO_DOC, staged: 3, conflicts: 1, lockStale: true };
}
