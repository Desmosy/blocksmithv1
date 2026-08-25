import type { ComponentInterface } from "@/lib/scan/types";
import type { FigmaComponent } from "./components";
import { figmaComponentInterface } from "./components";
import type { ComponentDriftReport, ComponentDriftRow } from "./types";

/** The comparable surface of a component: its name, variants, and scalar props. */
export type ComponentSurface = {
  name: string;
  /** Variant property name → options. */
  variants: Record<string, string[]>;
  /** Non-variant prop names (booleans, text, slots). */
  props: string[];
};

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function surfaceFromInterface(
  name: string,
  iface: ComponentInterface,
): ComponentSurface {
  const variants: Record<string, string[]> = {};
  const props: string[] = [];
  for (const p of iface.props) {
    if (p.variants && p.variants.length) {
      variants[p.name.toLowerCase()] = p.variants;
    } else {
      props.push(p.name.toLowerCase());
    }
  }
  return { name, variants, props };
}

/** Figma component → comparable surface. */
export function figmaComponentSurface(c: FigmaComponent): ComponentSurface {
  return surfaceFromInterface(c.name, figmaComponentInterface(c));
}

/**
 * Extract code-side component surfaces from a workspace-scan markdown. Reads the
 * embedded `<!-- blocksmith:interface {json} -->` IR the scan writes per
 * component, so variant-level comparison works without re-parsing source.
 */
export function codeComponentSurfacesFromMarkdown(
  md: string,
): ComponentSurface[] {
  const section = md.match(
    /## [\d.]+\.?\s*Component Library\n([\s\S]*?)(?=\n## |\n---|$)/i,
  );
  if (!section) return [];

  const out: ComponentSurface[] = [];
  const parts = section[1].split(/\n(?=### )/);
  for (const part of parts) {
    if (!part.startsWith("### ")) continue;
    const title = part.slice(4, part.indexOf("\n") === -1 ? undefined : part.indexOf("\n")).trim();
    if (!title) continue;
    const ifaceMatch = part.match(
      /<!--\s*blocksmith:interface\s+(\{[\s\S]*?\})\s*-->/,
    );
    if (ifaceMatch) {
      try {
        const iface = JSON.parse(ifaceMatch[1]) as ComponentInterface;
        out.push(surfaceFromInterface(title, iface));
        continue;
      } catch {
        /* fall through to presence-only */
      }
    }
    out.push({ name: title, variants: {}, props: [] });
  }
  return out;
}

function diffComponent(
  figma: ComponentSurface,
  code: ComponentSurface,
): string[] {
  const diffs: string[] = [];
  const fVariantNames = Object.keys(figma.variants);

  for (const v of fVariantNames) {
    if (!(v in code.variants)) {
      diffs.push(`variant \`${v}\` (Figma: ${figma.variants[v].join(", ")}) is missing in code`);
      continue;
    }
    const fOpts = new Set(figma.variants[v]);
    const cOpts = new Set(code.variants[v]);
    const figmaOnly = [...fOpts].filter((o) => !cOpts.has(o));
    const codeOnly = [...cOpts].filter((o) => !fOpts.has(o));
    if (figmaOnly.length) {
      diffs.push(`\`${v}\`: ${figmaOnly.map((o) => `\`${o}\``).join(", ")} in Figma, not in code`);
    }
    if (codeOnly.length) {
      diffs.push(`\`${v}\`: ${codeOnly.map((o) => `\`${o}\``).join(", ")} in code, not in Figma`);
    }
  }
  for (const v of Object.keys(code.variants)) {
    if (!(v in figma.variants)) {
      diffs.push(`variant \`${v}\` exists in code but not in Figma`);
    }
  }

  const fProps = new Set(figma.props);
  const cProps = new Set(code.props);
  const fPropOnly = [...fProps].filter((p) => !cProps.has(p));
  const cPropOnly = [...cProps].filter((p) => !fProps.has(p));
  if (fPropOnly.length) {
    diffs.push(`prop(s) ${fPropOnly.map((p) => `\`${p}\``).join(", ")} in Figma, not in code`);
  }
  if (cPropOnly.length) {
    diffs.push(`prop(s) ${cPropOnly.map((p) => `\`${p}\``).join(", ")} in code, not in Figma`);
  }
  return diffs;
}

/**
 * Reconcile the Figma component library against the code components — the wedge's
 * component-level payoff: "this Figma component has a `size=lg` variant your code
 * doesn't", plus Figma-only and code-only components.
 */
export function computeComponentDrift(
  figma: ComponentSurface[],
  code: ComponentSurface[],
): ComponentDriftReport {
  const codeBySlug = new Map(code.map((c) => [slug(c.name), c]));
  const figmaSlugs = new Set(figma.map((c) => slug(c.name)));
  const rows: ComponentDriftRow[] = [];
  let matched = 0;
  let mismatched = 0;
  let figmaOnly = 0;
  let codeOnly = 0;

  for (const fc of figma) {
    const cc = codeBySlug.get(slug(fc.name));
    if (!cc) {
      figmaOnly += 1;
      rows.push({ component: fc.name, status: "figma-only", differences: [] });
      continue;
    }
    const differences = diffComponent(fc, cc);
    if (differences.length) {
      mismatched += 1;
      rows.push({ component: fc.name, status: "mismatch", differences });
    } else {
      matched += 1;
      rows.push({ component: fc.name, status: "match", differences: [] });
    }
  }

  for (const cc of code) {
    if (figmaSlugs.has(slug(cc.name))) continue;
    codeOnly += 1;
    rows.push({ component: cc.name, status: "code-only", differences: [] });
  }

  return {
    rows,
    matched,
    mismatched,
    figmaOnly,
    codeOnly,
    inSync: mismatched === 0 && figmaOnly === 0 && codeOnly === 0,
  };
}

/** Drift a Figma component library directly against a code scan markdown. */
export function driftFigmaComponentsAgainstScan(
  figmaComponents: FigmaComponent[],
  scanMarkdown: string,
): ComponentDriftReport {
  return computeComponentDrift(
    figmaComponents.map(figmaComponentSurface),
    codeComponentSurfacesFromMarkdown(scanMarkdown),
  );
}

const STATUS_LABEL: Record<ComponentDriftRow["status"], string> = {
  match: "✓ in sync",
  mismatch: "✗ differs",
  "figma-only": "→ Figma only",
  "code-only": "← code only",
};

/** Render the component drift report as a markdown section. */
export function renderComponentDriftMarkdown(
  report: ComponentDriftReport,
): string {
  const lines: string[] = [
    "## Figma ↔ code component drift",
    "",
    `> ${report.inSync ? "**In sync** — the Figma component library matches the code components." : `**${report.mismatched}** differ · **${report.figmaOnly}** Figma-only · **${report.codeOnly}** code-only · **${report.matched}** in sync.`}`,
    "",
  ];
  const order: ComponentDriftRow["status"][] = [
    "mismatch",
    "figma-only",
    "code-only",
    "match",
  ];
  const sorted = [...report.rows].sort(
    (a, b) => order.indexOf(a.status) - order.indexOf(b.status),
  );
  for (const r of sorted) {
    lines.push(`- **${r.component}** — ${STATUS_LABEL[r.status]}`);
    for (const d of r.differences) lines.push(`  - ${d}`);
  }
  return lines.join("\n");
}
