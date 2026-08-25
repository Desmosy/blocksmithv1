/**
 * sections.ts — address any markdown section by a stable slug.
 *
 * Powers the universal "Edit this section" raw-markdown editor: every wiki page
 * maps to one `#`/`##`/… heading, and these helpers read/replace that heading's
 * body without disturbing the rest of the document. Heading matching is by
 * slugified text and is level-aware, so a nested `###` subsection never ends a
 * parent `##` section prematurely.
 */

export function sectionSlug(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface HeadingLine {
  index: number; // line index of the heading
  level: number; // number of leading '#'
  text: string;
  slug: string;
}

function headings(lines: string[]): HeadingLine[] {
  const out: HeadingLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+(.+?)\s*$/);
    if (m) {
      out.push({
        index: i,
        level: m[1].length,
        text: m[2],
        slug: sectionSlug(m[2]),
      });
    }
  }
  return out;
}

function locate(
  md: string,
  slug: string,
): { lines: string[]; heading: HeadingLine; bodyStart: number; bodyEnd: number } | null {
  const lines = md.split("\n");
  const hs = headings(lines);
  const idx = hs.findIndex((h) => h.slug === slug);
  if (idx === -1) return null;
  const heading = hs[idx];
  // Body ends at the next heading whose level is the same or shallower.
  let bodyEnd = lines.length;
  for (let j = idx + 1; j < hs.length; j++) {
    if (hs[j].level <= heading.level) {
      bodyEnd = hs[j].index;
      break;
    }
  }
  return { lines, heading, bodyStart: heading.index + 1, bodyEnd };
}

/** All H2/H3 sections — handy for building an "edit any section" index. */
export function listSections(md: string): { heading: string; slug: string; level: number }[] {
  return headings(md.split("\n")).map((h) => ({
    heading: h.text,
    slug: h.slug,
    level: h.level,
  }));
}

/** Body text (without the heading line) of the section identified by slug. */
export function getSectionBody(md: string, slug: string): string | null {
  const loc = locate(md, slug);
  if (!loc) return null;
  return loc.lines
    .slice(loc.bodyStart, loc.bodyEnd)
    .join("\n")
    .replace(/^\n+/, "")
    .replace(/\s+$/, "");
}

/**
 * Replace the body of one section, keeping its heading line intact. Returns the
 * new markdown, or null if the section was not found.
 */
export function replaceSectionBody(
  md: string,
  slug: string,
  body: string,
): string | null {
  const loc = locate(md, slug);
  if (!loc) return null;
  const before = loc.lines.slice(0, loc.bodyStart);
  const after = loc.lines.slice(loc.bodyEnd);
  // One blank line padding the new body so the heading and the next section
  // keep breathing room regardless of how the user trimmed their edit.
  const trimmed = body.replace(/^\n+/, "").replace(/\s+$/, "");
  const block = trimmed ? ["", trimmed, ""] : [""];
  return [...before, ...block, ...after].join("\n");
}
