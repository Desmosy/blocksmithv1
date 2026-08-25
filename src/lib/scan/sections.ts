import { extractWikiSections, type MarkdownSection } from "@/lib/parser/generic";

/**
 * Workspace-scan docs keep ### component headings in markdown for parsing,
 * but those must not become /wiki/doc/* pages (raw metadata tables).
 */
export function extractScanDocumentSections(
  md: string,
  componentIds: ReadonlySet<string>,
): MarkdownSection[] {
  const raw = extractWikiSections(md);

  return raw.map((section) => {
    if (/component library/i.test(section.title)) {
      const intro = section.content?.trim() ?? "";
      const guide =
        "_Use **Components (scanned)** in the sidebar — each opens a **live visual preview**, not a metadata table._";
      return {
        ...section,
        content: intro ? `${intro}\n\n${guide}` : guide,
        children: undefined,
      };
    }

    if (!section.children?.length) return section;

    return {
      ...section,
      children: section.children.filter((c) => !componentIds.has(c.id)),
    };
  });
}

export function flattenScanSections(sections: MarkdownSection[]): MarkdownSection[] {
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
