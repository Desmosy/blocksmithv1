import { createHash } from "crypto";
import { scanResultFingerprint } from "./fingerprint";
import { categoryLabel, type CatalogCategory } from "./catalog";
import { buildInventoryMarkdown } from "./inventory";
import { readWikiOverrides } from "./overrides";
import type { WorkspaceScanResult } from "./types";

function filenameSuffix(result: WorkspaceScanResult): string {
  if (result.githubRepo) {
    return result.githubRepo
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32);
  }
  return createHash("sha256")
    .update(result.workspaceRoot)
    .digest("hex")
    .slice(0, 8);
}

function stableDocFileName(result: WorkspaceScanResult): string {
  const slug = (result.workspaceId || result.projectName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  const base = slug || "workspace";

  if (result.workspaceId && result.workspaceIdExplicit) {
    return `scan-${base}.md`;
  }
  if (result.workspaceId) {
    return `scan-${base}-${filenameSuffix(result)}.md`;
  }
  return `scan-${base}-${filenameSuffix(result)}.md`;
}

export function injectScanFactsHash(markdown: string, factsHash: string): string {
  if (!markdown.startsWith("---\n")) return markdown;
  const end = markdown.indexOf("\n---\n", 4);
  if (end < 0) return markdown;
  const fm = markdown.slice(4, end);
  const body = markdown.slice(end + 5);
  const nextFm = fm.includes("scan-facts-hash:")
    ? fm.replace(/scan-facts-hash:\s*\S+/, `scan-facts-hash: ${factsHash}`)
    : `${fm}\nscan-facts-hash: ${factsHash}`;
  return `---\n${nextFm}\n---\n${body}`;
}

export function workspaceScanToMarkdown(result: WorkspaceScanResult): {
  markdown: string;
  fileName: string;
  factsHash: string;
} {
  const lines: string[] = [
    "---",
    "blocksmith-source: workspace-scan",
    `workspace-root: ${result.workspaceRoot}`,
    `project-name: ${result.projectName}`,
    ...(result.workspaceId ? [`workspace-id: ${result.workspaceId}`] : []),
    ...(result.githubRepo ? [`github-repo: ${result.githubRepo}`] : []),
    `scanned-at: ${result.scannedAt}`,
    ...(result.gitCommit ? [`git-commit: ${result.gitCommit}`] : []),
    `scan-paths: ${result.coverage.scannedPaths.join(", ")}`,
    `inventory-tsx: ${result.coverage.reactFiles}`,
    `inventory-files: ${result.coverage.totalFiles}`,
    `featured-components: ${result.coverage.featuredComponents}`,
    "---",
    "",
    `# ${result.projectName} — Workspace Scan`,
    `> Auto-generated from repository files. Pipeline: **scan → classify → wiki** (designer-facing components only). Re-run \`scan_workspace\` or \`npm run scan\` to refresh.`,
    "",
    "## Scan metadata",
    "",
    `- **Workspace:** \`${result.workspaceRoot}\``,
    `- **Scanned:** ${result.scannedAt}`,
    `- **Scan paths:** ${result.coverage.scannedPaths.map((p) => `\`${p}\``).join(", ")}`,
    `- **Files read:** ${result.coverage.totalFiles} (${result.coverage.reactFiles} React, ${result.coverage.cssVarCount} CSS vars, ${result.coverage.cssRuleCount} CSS rules, ${result.coverage.utilityClassCount} utility classes, ${result.coverage.colorCount} hex entries)`,
    `- **Featured components:** ${result.coverage.featuredComponents} of ${result.coverage.reactFiles} React files`,
    `- **Codebase inventory:** complete — see section below for every React file`,
    ...(result.gitCommit ? [`- **Git commit:** \`${result.gitCommit}\``] : []),
    "",
  ];

  if (result.designDocs.length) {
    lines.push("## 1. Existing design documents", "");
    for (const d of result.designDocs) {
      lines.push(`- \`${d.filePath}\` (${d.bytes} bytes) — present in workspace; not merged automatically.`);
    }
    lines.push("");
  }

  const tokenSection = result.designDocs.length ? "2" : "1";
  lines.push(`## ${tokenSection}. Design Tokens`, "");

  if (result.cssVars.length) {
    lines.push(`### ${tokenSection}.1 CSS variables`, "");
    lines.push("| Token | Value | Source |", "|-------|-------|--------|");
    for (const v of result.cssVars) {
      lines.push(`| \`${v.name}\` | ${v.value} | \`${v.source}\` |`);
    }
    lines.push("");
  }

  if (result.colors.length) {
    const byHex = new Map<string, { hex: string; sources: string[] }>();
    for (const c of result.colors) {
      const row = byHex.get(c.hex) ?? { hex: c.hex, sources: [] };
      if (!row.sources.includes(c.source)) row.sources.push(c.source);
      byHex.set(c.hex, row);
    }
    lines.push(`### ${tokenSection}.2 Colors (hex found in workspace)`, "");
    lines.push("| Hex | Occurrences | Sources |", "|-----|-------------|---------|");
    for (const row of [...byHex.values()].sort((a, b) => a.hex.localeCompare(b.hex))) {
      const src =
        row.sources.length <= 2
          ? row.sources.map((s) => `\`${s}\``).join(", ")
          : `${row.sources.length} files`;
      lines.push(`| ${row.hex} | ${row.sources.length} | ${src} |`);
    }
    lines.push("");
  }

  if (!result.cssVars.length && !result.colors.length) {
    lines.push("_No CSS variables or hex colors found in scanned paths._", "");
  }

  if (result.utilityClasses.length) {
    lines.push(`### ${tokenSection}.3 Utility classes (Tailwind / className)`, "");
    lines.push(
      "_Most-used `className` tokens from React files — typography, spacing, layout._",
      "",
    );
    lines.push("| Class | Uses | Sources |", "|-------|------|---------|");
    for (const u of result.utilityClasses.slice(0, 120)) {
      const src =
        u.sources.length <= 2
          ? u.sources.map((s) => `\`${s}\``).join(", ")
          : `${u.sources.length} files`;
      lines.push(`| \`${u.className}\` | ${u.count} | ${src} |`);
    }
    if (result.utilityClasses.length > 120) {
      lines.push(`| … | … | _${result.utilityClasses.length - 120} more classes_ |`);
    }
    lines.push("");
  }

  if (result.cssRules.length) {
    const cssSub = result.utilityClasses.length ? "4" : "3";
    lines.push(`### ${tokenSection}.${cssSub} CSS classes & styles`, "");
    lines.push(
      "_Class and element rules from `.css` / `.scss` — buttons, typography, layout._",
      "",
    );
    lines.push("| Selector | Styles | Source |", "|----------|--------|--------|");
    for (const r of result.cssRules.slice(0, 200)) {
      const sel = r.selector.replace(/\|/g, "\\|");
      const decl = r.declarations.replace(/\|/g, "\\|");
      lines.push(`| \`${sel}\` | \`${decl}\` | \`${r.source}\` |`);
    }
    if (result.cssRules.length > 200) {
      lines.push(`| … | … | _${result.cssRules.length - 200} more rules_ |`);
    }
    lines.push("");
  }

  const compSection = result.designDocs.length ? "3" : "2";
  lines.push(`## ${compSection}. Component Library`, "");

  if (!result.components.length) {
    lines.push(
      "_No designer-facing components classified for the wiki. Portfolio repos auto-feature `src/components/*.tsx`; design systems use `src/components/ui` or `catalogPaths` in `blocksmith.config.json`._",
      "",
    );
  } else {
    lines.push(
      `_**${result.components.length}** component(s) included after catalog classification. ${result.excludedComponents.length} file(s) scanned but excluded (rendering infra, app chrome, utilities)._`,
      "",
    );
    const overrides = readWikiOverrides(result.workspaceRoot);
    for (const c of result.components) {
      const ov = overrides.components[c.id];
      const role = ov?.role?.trim() || c.catalog.designerRole;
      lines.push(`### ${c.title}`, "");
      lines.push(`**Role:** ${role}`);
      if (ov?.description?.trim()) {
        lines.push("");
        lines.push("**Designer notes:**");
        lines.push("");
        lines.push(ov.description.trim());
      }
      lines.push("");
      lines.push("| Field | Value |", "|-------|-------|");
      lines.push(`| Category | ${categoryLabel(c.catalog.category as CatalogCategory)} |`);
      lines.push(`| Source | \`${c.filePath}\` |`);
      if (c.exports.length) {
        lines.push(`| Exports | ${c.exports.map((e) => `\`${e}\``).join(", ")} |`);
      }
      if (c.cssVarsUsed.length) {
        lines.push(
          `| CSS variables | ${c.cssVarsUsed.slice(0, 12).map((v) => `\`${v}\``).join(", ")}${c.cssVarsUsed.length > 12 ? ", …" : ""} |`,
        );
      }
      if (c.colorsUsed.length) {
        lines.push(
          `| Hex in file | ${c.colorsUsed.slice(0, 8).join(", ")}${c.colorsUsed.length > 8 ? ", …" : ""} |`,
        );
      }
      if (c.interface) {
        const props = c.interface.props
          .map(
            (p) =>
              `\`${p.name}${p.optional ? "?" : ""}: ${p.type}\`${p.variants ? ` (${p.variants.join(" · ")})` : ""}`,
          )
          .join(", ");
        if (props) lines.push(`| Props | ${props} |`);
        // Full structural IR for faithful codegen — invisible in rendered wiki.
        lines.push("");
        lines.push(
          `<!-- blocksmith:interface ${JSON.stringify(c.interface)} -->`,
        );
      }
      if (c.source) {
        // Verbatim source, base64 to survive markdown — codegen re-emits it.
        const b64 = Buffer.from(c.source, "utf-8").toString("base64");
        lines.push(`<!-- blocksmith:source ${b64} -->`);
      }
      lines.push("");
    }
  }

  if (result.excludedComponents.length) {
    const notesSection = result.designDocs.length ? "4" : "3";
    lines.push(`## ${notesSection}. Catalog exclusions`, "");
    lines.push(
      "_These files were scanned but intentionally omitted from the Component Library — they are not useful pages for UI/UX designers._",
      "",
    );
    lines.push("| Component | Category | Reason |", "|-----------|----------|--------|");
    for (const x of result.excludedComponents.slice(0, 40)) {
      const cat = categoryLabel(x.catalog.category as CatalogCategory);
      const reason = x.catalog.reason.replace(/\|/g, "\\|");
      lines.push(`| \`${x.title}\` | ${cat} | ${reason} |`);
    }
    if (result.excludedComponents.length > 40) {
      lines.push(`| … | … | _${result.excludedComponents.length - 40} more excluded_ |`);
    }
    lines.push("");
  }

  let sectionNum = result.designDocs.length ? 2 : 1; // design tokens
  sectionNum += 1; // component library
  if (result.excludedComponents.length) sectionNum += 1;
  sectionNum += 1;
  lines.push(buildInventoryMarkdown(result.inventory, sectionNum));

  const markdown = lines.join("\n");
  const factsHash = scanResultFingerprint(result);

  return {
    markdown: injectScanFactsHash(markdown, factsHash),
    fileName: stableDocFileName(result),
    factsHash,
  };
}
