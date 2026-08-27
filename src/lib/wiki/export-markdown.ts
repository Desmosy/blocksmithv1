import type { DesignSystem } from "@/lib/blocks/types";

export type ComponentGovernance = Record<
  string,
  { role?: string; description?: string }
>;

/**
 * Render a complete design-system markdown document from a loaded system —
 * the same content humans see in the wiki (tokens, every component, surfaces,
 * guidelines, agent guide), not a per-component delta.
 *
 * `governance` overlays human-finalized component prose (role/description) so
 * `blocksmith pull` writes the promoted truth, not the raw scan.
 */
export function generateDesignSystemMarkdown(
  system: DesignSystem,
  governance?: ComponentGovernance,
): string {
  const lines: string[] = [];

  lines.push(`# ${system.name}`);
  if (system.tagline) lines.push(`\n> ${system.tagline}`);
  if (system.overview) lines.push(`\n${system.overview}`);
  lines.push(`\n---\n`);

  if (system.colors.length > 0) {
    lines.push(`## Colors\n`);
    lines.push(`| Name | Value | CSS Variable | Role |`);
    lines.push(`|------|-------|-------------|------|`);
    for (const c of system.colors) {
      lines.push(`| ${c.name} | ${c.value} | \`${c.cssVar}\` | ${c.role} |`);
    }
    lines.push("");
  }

  if (system.typography.length > 0) {
    lines.push(`## Typography\n`);
    for (const t of system.typography) {
      lines.push(`### ${t.name}`);
      if (t.role) lines.push(`\n${t.role}`);
      if (t.weights) lines.push(`\n**Weights:** ${t.weights}`);
      if (t.sizes) lines.push(`**Sizes:** ${t.sizes}`);
      if (t.lineHeight) lines.push(`**Line height:** ${t.lineHeight}`);
      lines.push("");
    }
  }

  if (system.typeScale.length > 0) {
    lines.push(`### Type Scale\n`);
    lines.push(`| Role | Size | Line Height | Letter Spacing | Token |`);
    lines.push(`|------|------|------------|----------------|-------|`);
    for (const t of system.typeScale) {
      lines.push(
        `| ${t.role} | ${t.size} | ${t.lineHeight} | ${t.letterSpacing} | \`${t.token}\` |`,
      );
    }
    lines.push("");
  }

  if (system.spacing.length > 0) {
    lines.push(`## Spacing\n`);
    lines.push(`| Name | Value | Token |`);
    lines.push(`|------|-------|-------|`);
    for (const s of system.spacing) {
      lines.push(`| ${s.name} | ${s.value} | \`${s.token}\` |`);
    }
    lines.push("");
  }

  if (system.borderRadius.length > 0) {
    lines.push(`### Border Radius\n`);
    lines.push(`| Element | Value |`);
    lines.push(`|---------|-------|`);
    for (const r of system.borderRadius) {
      lines.push(`| ${r.element} | ${r.value} |`);
    }
    lines.push("");
  }

  if (system.surfaces.length > 0) {
    lines.push(`## Surfaces\n`);
    lines.push(`| Level | Name | Value | Purpose |`);
    lines.push(`|-------|------|-------|---------|`);
    for (const s of system.surfaces) {
      lines.push(`| ${s.level} | ${s.name} | ${s.value} | ${s.purpose} |`);
    }
    lines.push("");
  }

  if (system.components.length > 0) {
    lines.push(`## Components\n`);
    for (const c of system.components) {
      const gov = governance?.[c.id];
      const role = gov?.role?.trim() || c.role;
      const description = gov?.description?.trim() || c.description;
      lines.push(`### ${c.title}`);
      if (role) lines.push(`\n**Role:** ${role}`);
      if (description) lines.push(`\n${description}`);
      lines.push("");
    }
  }

  if (system.dos.length > 0 || system.donts.length > 0) {
    lines.push(`## Guidelines\n`);
    if (system.dos.length > 0) {
      lines.push(`### Do\n`);
      for (const d of system.dos) lines.push(`- ${d}`);
      lines.push("");
    }
    if (system.donts.length > 0) {
      lines.push(`### Don't\n`);
      for (const d of system.donts) lines.push(`- ${d}`);
      lines.push("");
    }
  }

  if (system.similarBrands?.length) {
    lines.push(`## Similar Brands\n`);
    for (const b of system.similarBrands) lines.push(`- **${b.name}** — ${b.note}`);
    lines.push("");
  }

  if (system.agentGuide) {
    lines.push(`## Agent Guide\n`);
    lines.push(system.agentGuide);
    lines.push("");
  }

  lines.push(`---`);
  lines.push(`\n*Exported from BlockSmith wiki · ${new Date().toISOString()}*`);
  lines.push(`*Source: ${system.sourcePath}*`);

  return lines.join("\n");
}
