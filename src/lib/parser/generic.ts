import type { DesignSystem, NavItem, NavSection } from "@/lib/blocks/types";
import { extractWikiTokens } from "@/lib/parser/wiki-tokens";

function slugify(text: string): string {
  const stripped = stripSectionNumber(text);
  return stripped
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function stripSectionNumber(title: string): string {
  return title.replace(/^\d+(?:\.\d+)?\.?\s*/, "").trim();
}

function isTableOfContents(title: string): boolean {
  return /table of contents/i.test(title);
}

/**
 * Multi-chapter design wikis (20+ sections, numbered headings, TOC).
 * These must NOT be squashed into Apollo format by parser-assist.
 */
export function isComprehensiveWikiMarkdown(md: string): boolean {
  const h2 = md.match(/^## /gm) ?? [];
  const numbered = (md.match(/^## \d+\./gm) ?? []).length;
  const hasToc = /## Table of Contents/i.test(md);
  return (
    (numbered >= 6 && h2.length >= 8) ||
    (hasToc && h2.length >= 10) ||
    (h2.length >= 15 && md.length > 12_000)
  );
}

export interface MarkdownSection {
  id: string;
  title: string;
  level: number;
  content: string;
  children?: MarkdownSection[];
}

export function parseGenericMarkdown(
  md: string,
  sourcePath: string,
  fileName: string,
): DesignSystem & { mode: "generic"; sections: MarkdownSection[] } {
  const titleMatch = md.match(/^# (.+)$/m);
  const taglineMatch = md.match(/^> (.+)$/m);
  const isWiki = isComprehensiveWikiMarkdown(md);

  const sections = isWiki ? extractWikiSections(md) : extractSections(md);

  const name = titleMatch?.[1]?.trim() ?? fileName.replace(/\.md$/i, "");
  const tokens = isWiki ? extractWikiTokens(md) : null;

  const navItems: NavItem[] = sections.map((s) => ({
    id: s.id,
    label: s.title,
    href: `/wiki/doc/${s.id}`,
    children: s.children?.map((c) => ({
      id: c.id,
      label: c.title,
      href: `/wiki/doc/${c.id}`,
    })),
  }));

  const nav: NavSection[] = [
    {
      id: "intro",
      label: "",
      items: [
        { id: "introduction", label: "Introduction", href: "/wiki" },
        { id: "source", label: "Source", href: "/wiki/source" },
      ],
    },
    {
      id: "sections",
      label: isWiki ? "Wiki" : "Document",
      items: navItems,
    },
  ];

  const flatSections = flattenSections(sections);

  return {
    mode: "generic",
    sections: flatSections,
    id: slugify(fileName),
    name,
    tagline: taglineMatch?.[1] ?? "",
    theme: "light",
    overview: extractOverview(md),
    sourcePath,
    updatedAt: new Date().toISOString(),
    colors: tokens?.colors ?? [],
    typography: tokens?.typography ?? [],
    typeScale: tokens?.typeScale ?? [],
    spacing: tokens?.spacing ?? [],
    borderRadius: tokens?.borderRadius ?? [],
    layout: [],
    components: [],
    dos: [],
    donts: [],
    surfaces: [],
    imagery: "",
    layoutNotes: "",
    agentGuide: "",
    similarBrands: [],
    nav,
  };
}

function extractOverview(md: string): string {
  const firstSection = md.search(/\n##+ /);
  const head = firstSection >= 0 ? md.slice(0, firstSection) : md;
  return head
    .replace(/^#.+$/m, "")
    .replace(/^>.+$/m, "")
    .trim();
}

function extractSections(md: string): MarkdownSection[] {
  if (isComprehensiveWikiMarkdown(md)) {
    return extractWikiSections(md);
  }
  if (/\n## /m.test(md)) {
    return parseH2Sections(md);
  }
  if (/\n### /m.test(md)) {
    return parseH3OnlySections(md);
  }
  if (md.trim().length > 80) {
    return [
      {
        id: "content",
        title: "Content",
        level: 2,
        content: md.trim(),
      },
    ];
  }
  return [];
}

export function extractWikiSections(md: string): MarkdownSection[] {
  return parseH2Sections(md, { wiki: true });
}

function parseH2Sections(
  md: string,
  options?: { wiki?: boolean },
): MarkdownSection[] {
  const sections: MarkdownSection[] = [];
  const parts = md.split(/\n(?=## )/);

  for (const part of parts) {
    if (!part.startsWith("## ")) continue;
    const lines = part.split("\n");
    const rawTitle = lines[0].replace(/^##\s+/, "").trim();
    if (options?.wiki && isTableOfContents(rawTitle)) continue;

    const title = options?.wiki ? stripSectionNumber(rawTitle) : rawTitle;
    const body = lines.slice(1).join("\n").trim();
    const { intro, children } = splitH3Children(body, options?.wiki);

    sections.push({
      id: slugify(rawTitle),
      title,
      level: 2,
      content: intro || (children.length === 0 ? body : ""),
      children: children.length > 0 ? children : undefined,
    });
  }

  return sections;
}

function splitH3Children(
  body: string,
  wiki?: boolean,
): {
  intro: string;
  children: MarkdownSection[];
} {
  if (!/\n### /m.test(body)) {
    return { intro: body, children: [] };
  }

  const parts = body.split(/\n(?=### )/);
  const intro = parts[0]?.trim() ?? "";
  const children: MarkdownSection[] = [];

  for (const part of parts) {
    if (!part.startsWith("### ")) continue;
    const lines = part.split("\n");
    const rawTitle = lines[0].replace(/^###\s+/, "").trim();
    const title = wiki ? stripSectionNumber(rawTitle) : rawTitle;
    const content = lines.slice(1).join("\n").trim();
    children.push({
      id: slugify(rawTitle),
      title,
      level: 3,
      content,
    });
  }

  return { intro, children };
}

function parseH3OnlySections(md: string): MarkdownSection[] {
  const sections: MarkdownSection[] = [];
  const parts = md.split(/\n(?=### )/);

  for (const part of parts) {
    if (!part.startsWith("### ")) continue;
    const lines = part.split("\n");
    const title = lines[0].replace(/^###\s+/, "").trim();
    const content = lines.slice(1).join("\n").trim();
    sections.push({
      id: slugify(title),
      title,
      level: 3,
      content,
    });
  }

  return sections;
}

function flattenSections(sections: MarkdownSection[]): MarkdownSection[] {
  const flat: MarkdownSection[] = [];
  for (const s of sections) {
    flat.push({
      id: s.id,
      title: s.title,
      level: s.level,
      content: s.content,
    });
    if (s.children) {
      for (const c of s.children) {
        flat.push(c);
      }
    }
  }
  return flat;
}

/** Apollo-style structured design doc */
export function isApolloStructuredMarkdown(md: string): boolean {
  return (
    /## Tokens — Colors/i.test(md) ||
    (/## Components/i.test(md) && /\| Name \| Value \| Token \|/i.test(md))
  );
}
