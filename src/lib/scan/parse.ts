import type {
  ColorToken,
  ComponentDoc,
  DesignSystem,
  NavSection,
} from "@/lib/blocks/types";
import { parseHexColor } from "@/lib/parser/normalize";
import type { MarkdownSection } from "@/lib/parser/generic";
import { parseMarkdownFrontmatter } from "@/lib/markdown/frontmatter";
import {
  extractScanDocumentSections,
  flattenScanSections,
} from "./sections";
import { parseCssRulesTable } from "./css-rules";
import { parseUtilityClassesTable } from "./tailwind-classes";
import { mergeScanColorTokens } from "./workspace-colors";
import {
  designerBorderRadius,
  designerSpacing,
  designerSurfaces,
  parseCssVarTable,
} from "./tokens";

export function isWorkspaceScanMarkdown(md: string): boolean {
  return /^---[\s\S]*?blocksmith-source:\s*workspace-scan(?:-curated)?/m.test(md);
}

export function isCuratedWorkspaceScanMarkdown(md: string): boolean {
  return /^---[\s\S]*?blocksmith-source:\s*workspace-scan-curated/m.test(md);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseTokenTable(
  md: string,
  headingPattern: RegExp,
): ColorToken[] {
  const colors: ColorToken[] = [];
  const section = md.match(headingPattern);
  if (!section) return colors;

  for (const line of section[1].split("\n")) {
    if (!line.startsWith("|") || line.includes("---")) continue;
    const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length < 3 || /^token$/i.test(cells[0])) continue;
    const token = cells[0].replace(/`/g, "");
    const hex = parseHexColor(cells[1] ?? "");
    if (!hex) continue;
    colors.push({
      name: token,
      value: hex,
      cssVar: token.startsWith("--") ? token : `--color-${slugify(token)}`,
      role: cells[2]?.replace(/`/g, "") ?? "",
      group: "SCANNED",
    });
  }
  return colors;
}

function parseColorTable(md: string): ColorToken[] {
  const fromCss = parseTokenTable(
    md,
    /### [\d.]+\s*CSS variables[^\n]*\n([\s\S]*?)(?=\n### |\n## |\n---|$)/i,
  );
  const fromHex = parseTokenTable(
    md,
    /### [\d.]+\s*Colors[^\n]*\n([\s\S]*?)(?=\n### |\n## |\n---|$)/i,
  );
  const seen = new Set<string>();
  const merged: ColorToken[] = [];
  for (const c of [...fromCss, ...fromHex]) {
    const key = `${c.cssVar}:${c.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(c);
  }
  return merged;
}

function parseTableField(body: string, field: string): string | null {
  const re = new RegExp(`\\|\\s*${field}\\s*\\|\\s*([^|]+)\\|`, "i");
  const m = body.match(re);
  return m?.[1]?.trim() ?? null;
}

function parseListField(raw: string | null): string[] {
  if (!raw) return [];
  return [...raw.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
}

/** Recover the structural interface IR embedded as an HTML comment. */
function parseInterfaceComment(
  body: string,
): import("./component-interface").ComponentInterface | undefined {
  const m = body.match(/<!--\s*blocksmith:interface\s+(\{[\s\S]*?\})\s*-->/);
  if (!m) return undefined;
  try {
    return JSON.parse(m[1]);
  } catch {
    return undefined;
  }
}

/** Recover verbatim component source (base64) embedded as an HTML comment. */
function parseSourceComment(body: string): string | undefined {
  const m = body.match(/<!--\s*blocksmith:source\s+([A-Za-z0-9+/=]+)\s*-->/);
  if (!m) return undefined;
  try {
    return Buffer.from(m[1], "base64").toString("utf-8");
  } catch {
    return undefined;
  }
}

function parseComponents(md: string): ComponentDoc[] {
  const compSection = md.match(/## [\d.]+\. Component Library\n([\s\S]*?)(?=\n## |\n---|$)/);
  if (!compSection) return [];

  const docs: ComponentDoc[] = [];
  const parts = compSection[1].split(/\n(?=### )/);
  for (const part of parts) {
    if (!part.startsWith("### ")) continue;
    const lines = part.split("\n");
    const title = lines[0].replace(/^###\s+/, "").trim();
    const body = lines.slice(1).join("\n").trim();
    const roleMatch = body.match(/\*\*Role:\*\*\s*([^\n]+)/);
    const role = roleMatch?.[1]?.trim() ?? "";
    const notesMatch = body.match(
      /\*\*Designer notes:\*\*\s*\n+([\s\S]*?)(?=\n\| Field \||\n\*\*|$)/i,
    );
    const description = notesMatch?.[1]?.trim() ?? "";

    const sourceRaw = parseTableField(body, "Source");
    const sourceFile = sourceRaw?.replace(/`/g, "").trim() ?? "";
    const exports = parseListField(parseTableField(body, "Exports"));
    const cssVarsUsed = parseListField(parseTableField(body, "CSS variables"));
    const hexRaw = parseTableField(body, "Hex in file");
    const colorsUsed = hexRaw
      ? hexRaw.split(",").map((h) => h.trim()).filter((h) => /^#[0-9a-f]{3,8}$/i.test(h))
      : [];
    const componentInterface = parseInterfaceComment(body);
    const source = parseSourceComment(body);

    docs.push({
      id: slugify(title),
      title,
      role,
      description,
      scan: sourceFile
        ? {
            sourceFile,
            exports,
            cssVarsUsed,
            colorsUsed,
            interface: componentInterface,
            source,
          }
        : undefined,
    });
  }
  return docs;
}

export function getWorkspaceRootFromMarkdown(md: string): string | null {
  return parseMarkdownFrontmatter(md)["workspace-root"] ?? null;
}

const PRIMITIVE_PREVIEW =
  /(Button|Input|Card|Modal|Badge|Avatar|Select|Checkbox|Switch|Tooltip|Dialog|Tag|Pill|CTA|Preview|Swatch|Specimen)/i;

export function isScannedComponent(component: ComponentDoc): boolean {
  return !!component.scan?.sourceFile;
}

export function canPreviewScannedComponent(component: ComponentDoc): boolean {
  if (!component.scan) return true;
  const label = `${component.title} ${component.role}`;
  if (/Page$/i.test(component.title)) return false;
  if (/UI section:/i.test(component.role)) return true;
  return PRIMITIVE_PREVIEW.test(label);
}

function parseInventoryTable(md: string) {
  const section = md.match(/## [\d.]+\. Codebase inventory\n([\s\S]*?)$/i);
  if (!section) return [];

  const rows: DesignSystem["scanInventory"] = [];
  for (const line of section[1].split("\n")) {
    if (!line.startsWith("|") || line.includes("---") || /^\| File /.test(line)) {
      continue;
    }
    const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length < 4) continue;
    const filePath = cells[0].replace(/`/g, "");
    if (!/\.(tsx|jsx)$/i.test(filePath)) continue;
    const exports = [...cells[1].matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    const featured = /^yes$/i.test(cells[2]);
    rows.push({
      filePath,
      title: filePath.split("/").pop()?.replace(/\.(tsx|jsx)$/i, "") ?? filePath,
      exports,
      featured,
      category: cells[3],
    });
  }
  return rows;
}

function parseScanCoverage(meta: Record<string, string>): DesignSystem["scanCoverage"] {
  const reactFiles = parseInt(meta["inventory-tsx"] ?? "0", 10);
  const totalFiles = parseInt(meta["inventory-files"] ?? "0", 10);
  const featuredComponents = parseInt(meta["featured-components"] ?? "0", 10);
  const scannedPaths = meta["scan-paths"]?.split(",").map((p) => p.trim()).filter(Boolean) ?? [];
  if (!reactFiles && !totalFiles) return undefined;
  return { scannedPaths, totalFiles, reactFiles, featuredComponents };
}

export function parseWorkspaceScanMarkdown(
  md: string,
  sourcePath: string,
): DesignSystem & { mode: "workspace-scan"; sections: MarkdownSection[] } {
  const meta = parseMarkdownFrontmatter(md);
  const name = meta["project-name"] || "Workspace Scan";
  const scanCssVars = parseCssVarTable(md);
  const scanCssRules = parseCssRulesTable(md);
  const scanUtilityClasses = parseUtilityClassesTable(md);
  const colors = mergeScanColorTokens(scanCssVars, md);
  const components = parseComponents(md);
  const componentIds = new Set(components.map((c) => c.id));
  const sections = extractScanDocumentSections(md, componentIds);
  const surfaces = designerSurfaces(scanCssVars);
  const spacing = designerSpacing(scanCssVars);
  const borderRadius = designerBorderRadius(scanCssVars);

  const componentNav: NavSection["items"] = components.map((c) => ({
    id: c.id,
    label: c.title,
    href: `/wiki/components/${c.id}`,
  }));

  const foundationItems: NavSection["items"] = [
    { id: "color", label: "Color", href: "/wiki/foundation/color" },
    ...(scanCssVars.length
      ? [{ id: "css-vars", label: "CSS variables", href: "/wiki/foundation/css-vars" }]
      : []),
    ...(surfaces.length
      ? [{ id: "surfaces", label: "Surfaces", href: "/wiki/foundation/surfaces" }]
      : []),
    ...(spacing.length
      ? [{ id: "spacing", label: "Spacing & radius", href: "/wiki/foundation/spacing" }]
      : []),
    ...(scanCssRules.length || scanUtilityClasses.length
      ? [{ id: "styles", label: "Styles", href: "/wiki/foundation/styles" }]
      : []),
    { id: "source", label: "Source", href: "/wiki/source" },
  ];

  const nav: NavSection[] = [
    {
      id: "intro",
      label: "",
      items: [{ id: "introduction", label: "Introduction", href: "/wiki" }],
    },
    {
      id: "foundation",
      label: "Foundation",
      items: foundationItems,
    },
    {
      id: "components",
      label: "Components",
      items: [
        { id: "components-hub", label: "Featured", href: "/wiki/components" },
        ...componentNav,
      ],
    },
    {
      id: "codebase",
      label: "Codebase",
      items: [
        {
          id: "inventory",
          label: "Full inventory",
          href: "/wiki/inventory",
        },
      ],
    },
    {
      id: "sync",
      label: "Workflow",
      items: [
        { id: "pipeline", label: "Pipeline", href: "/wiki/pipeline" },
        { id: "governance", label: "Governance", href: "/wiki/governance" },
        { id: "releases", label: "Release log", href: "/wiki/releases" },
      ],
    },
    {
      id: "settings",
      label: "Settings",
      items: [
        { id: "sync", label: "Sync", href: "/wiki/sync" },
      ],
    },
  ];

  const overview =
    md.match(/^> (.+)$/m)?.[1] ??
    `Design system wiki built from ${name} workspace scan.`;

  return {
    mode: "workspace-scan",
    sections: flattenScanSections(sections),
    scanCssVars,
    scanCssRules,
    scanUtilityClasses,
    scanInventory: parseInventoryTable(md),
    scanCoverage: parseScanCoverage(meta),
    scanWorkspaceRoot: meta["workspace-root"] || undefined,
    id: slugify(name),
    name: `${name} — Workspace Scan`,
    tagline: "",
    theme: "light",
    overview,
    sourcePath,
    updatedAt: meta["scanned-at"] || new Date().toISOString(),
    colors,
    typography: [],
    typeScale: [],
    spacing,
    borderRadius,
    layout: [],
    components,
    dos: [],
    donts: [],
    surfaces,
    imagery: "",
    layoutNotes: "",
    agentGuide: meta["workspace-root"]
      ? `Scanned from \`${meta["workspace-root"]}\`. Re-run scan_workspace to refresh.`
      : "",
    similarBrands: [],
    nav,
  };
}
