/**
 * Workspace analytics: accent contrast and capture coverage.
 *
 * Ink-on-ground is deliberately not measured — it sits at 17:1-21:1 for every
 * system, so it carries no signal.
 */

import { loadDesignSystem } from "@/lib/clients/registry";
import { listAccessibleDocSources } from "@/lib/cloud/doc-visibility";
import { contrastRatio, isHex } from "@/lib/design-ir/color-utils";

/** WCAG 2.1 thresholds for text against its background. */
export type ContrastBand = "AAA" | "AA" | "AA Large" | "Fails";

export type ContrastBucket = {
  band: ContrastBand;
  count: number;
  /** What passing this band actually permits. */
  meaning: string;
};

export type CoverageFacet = {
  label: string;
  present: number;
  total: number;
};

export type Analytics = {
  contrast: {
    buckets: ContrastBucket[];
    measured: number;
    /** Systems with no accent/ground pair to compare. */
    unmeasured: number;
  };
  coverage: CoverageFacet[];
  systems: number;
};

const BAND_MEANING: Record<ContrastBand, string> = {
  AAA: "any text size",
  AA: "body text",
  "AA Large": "18px+ or bold only",
  Fails: "not legible as text",
};

function band(ratio: number): ContrastBand {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA Large";
  return "Fails";
}

export async function getAnalytics(): Promise<Analytics> {
  let sources: { fileName: string }[] = [];
  try {
    sources = await listAccessibleDocSources();
  } catch {
    sources = [];
  }

  const counts: Record<ContrastBand, number> = {
    AAA: 0,
    AA: 0,
    "AA Large": 0,
    Fails: 0,
  };
  let measured = 0;
  let unmeasured = 0;

  let systems = 0;
  const facets = {
    Colours: 0,
    Typography: 0,
    Spacing: 0,
    Radius: 0,
    Components: 0,
  };

  for (const s of sources) {
    let sys;
    try {
      sys = loadDesignSystem(s.fileName);
    } catch {
      // A doc that will not parse is not counted rather than guessed at.
      continue;
    }
    systems += 1;

    if (sys.colors.length) facets.Colours += 1;
    if (sys.typography.length) facets.Typography += 1;
    if (sys.spacing.length) facets.Spacing += 1;
    if (sys.borderRadius.length) facets.Radius += 1;
    if (sys.components.length) facets.Components += 1;

    // Match on the css var rather than the display name: capture writes
    // `--color-accent`, but the human-facing name varies by system.
    const byVar = (fragment: string) =>
      sys.colors.find((c) => c.cssVar?.toLowerCase().includes(fragment));
    const ground = byVar("ground");
    const accent = byVar("accent");

    if (ground && accent && isHex(ground.value) && isHex(accent.value)) {
      counts[band(contrastRatio(accent.value, ground.value))] += 1;
      measured += 1;
    } else {
      unmeasured += 1;
    }
  }

  const order: ContrastBand[] = ["AAA", "AA", "AA Large", "Fails"];

  return {
    systems,
    contrast: {
      measured,
      unmeasured,
      buckets: order.map((b) => ({
        band: b,
        count: counts[b],
        meaning: BAND_MEANING[b],
      })),
    },
    coverage: Object.entries(facets).map(([label, present]) => ({
      label,
      present,
      total: systems,
    })),
  };
}
