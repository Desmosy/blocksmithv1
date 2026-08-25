/**
 * modify.ts — Markdown section modifier for Web ↔ IDE writeback.
 *
 * Provides functions to parse, modify, and serialize markdown design files
 * in-place based on block modifications.
 */

import { replaceSectionBody } from "./sections";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Strip surrounding backticks/whitespace from a markdown table cell. */
function normCell(cell: string): string {
  return cell.replace(/`/g, "").trim();
}

/** Wrap a value in backticks unless it already is. */
function wrapTick(value: string): string {
  const v = value.trim();
  if (!v) return v;
  return v.startsWith("`") ? v : `\`${v.replace(/`/g, "")}\``;
}

/** Split a markdown table row "| a | b |" into trimmed cells [a, b]. */
function rowCells(line: string): string[] {
  return line
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim());
}

/**
 * Edit a single table row inside a `## <heading>` section.
 *
 * Walks the document line by line, only touching rows once inside the section
 * whose heading text passes `matchHeading`. `matchRow` selects the row by its
 * cells; `buildCells` returns the replacement cells. Returns the new markdown,
 * or null if the section or row was not found (caller throws).
 */
function editTableRowInSection(
  md: string,
  matchHeading: (headingText: string) => boolean,
  matchRow: (cells: string[]) => boolean,
  buildCells: (cells: string[]) => string[],
): string | null {
  const lines = md.split("\n");
  let inSection = false;
  let sawSection = false;
  let edited = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s/.test(line)) {
      const headingText = line.replace(/^##\s+/, "").trim();
      inSection = matchHeading(headingText);
      if (inSection) sawSection = true;
      continue;
    }
    if (!inSection) continue;
    if (!line.trim().startsWith("|") || line.includes("---")) continue;
    const cells = rowCells(line);
    if (!matchRow(cells)) continue;
    lines[i] = `| ${buildCells(cells).join(" | ")} |`;
    edited = true;
    break;
  }

  if (!sawSection || !edited) return null;
  return lines.join("\n");
}

/**
 * Modifies a specific section of a markdown file and returns the updated markdown.
 * Throws an error if the target section/block cannot be found.
 *
 * Supported blockIds:
 *   - 'agent-guide'
 *   - 'guidelines'
 *   - 'component:<slug>'
 *   - 'token:color:<slug>'        { name, value, role? }
 *   - 'token:typography:<slug>'   { name, substitute, weights, sizes, lineHeight, letterSpacing, role }
 *   - 'token:spacing:<slug>'      { name, value }
 *   - 'page:introduction'         { name?, tagline?, overview? }
 */
export function modifyMarkdownBlock(
  md: string,
  blockId: string,
  updatedData: any,
): string {
  if (blockId === "agent-guide") {
    const regex = /(##\s*Agent\s+(?:Prompt\s+)?Guide\s*\n)([\s\S]*?)(?=\n##\s*|$)/i;
    const match = md.match(regex);
    if (!match) {
      throw new Error("Agent Guide section not found in design document");
    }
    const text = typeof updatedData.text === "string" ? updatedData.text : "";
    return md.replace(regex, `$1${text.trim()}\n\n`);
  }

  if (blockId === "guidelines") {
    const regex = /(##\s*(?:Do's and Don'ts|Guidelines)\s*\n)([\s\S]*?)(?=\n##\s*|$)/i;
    const match = md.match(regex);
    if (!match) {
      throw new Error("Guidelines section not found in design document");
    }
    const { dos = [], donts = [] } = updatedData as {
      dos?: string[];
      donts?: string[];
    };
    const dosText = dos.map((d) => `- ${d.trim()}`).join("\n");
    const dontsText = donts.map((d) => `- ${d.trim()}`).join("\n");
    const newSectionContent = `\n### Do\n${dosText}\n\n### Don't\n${dontsText}\n\n`;
    return md.replace(regex, `$1${newSectionContent}`);
  }

  // Universal escape hatch: replace a whole section's raw markdown body. Powers
  // the "Edit this section" editor on every page. blockId is `section:<slug>`
  // where slug is the slugified heading text (see sections.ts).
  if (blockId.startsWith("section:")) {
    const slug = blockId.slice("section:".length);
    const markdown =
      typeof updatedData.markdown === "string" ? updatedData.markdown : "";
    const out = replaceSectionBody(md, slug, markdown);
    if (out == null) {
      throw new Error(`Section '${slug}' not found in design document`);
    }
    return out;
  }

  if (blockId.startsWith("token:color:")) {
    const slug = blockId.slice("token:color:".length);
    // extract.ts slug drops a leading "color-" — accept both forms.
    const candidates = [`--color-${slug}`, `--${slug}`];
    const name = typeof updatedData.name === "string" ? updatedData.name : null;
    const value =
      typeof updatedData.value === "string" ? updatedData.value : null;
    const role = typeof updatedData.role === "string" ? updatedData.role : null;

    const out = editTableRowInSection(
      md,
      (h) => /^Tokens\s*[—-]\s*Colors/i.test(h),
      (cells) => candidates.includes(normCell(cells[2] ?? "")),
      (cells) => [
        (name ?? cells[0] ?? "").trim(),
        wrapTick(value ?? normCell(cells[1] ?? "")),
        cells[2] ?? "", // keep the token (CSS var) cell — it is the identity
        (role ?? cells[3] ?? "").trim(),
      ],
    );
    if (!out) {
      throw new Error(
        `Color token '${slug}' not found in Tokens — Colors section`,
      );
    }
    return out;
  }

  if (blockId.startsWith("token:spacing:")) {
    const slug = blockId.slice("token:spacing:".length);
    const candidates = [`--${slug}`, slug];
    const name = typeof updatedData.name === "string" ? updatedData.name : null;
    const value =
      typeof updatedData.value === "string" ? updatedData.value : null;

    const out = editTableRowInSection(
      md,
      (h) => /^Tokens\s*[—-]\s*Spacing/i.test(h),
      (cells) => candidates.includes(normCell(cells[2] ?? "")),
      (cells) => [
        (name ?? cells[0] ?? "").trim(),
        (value ?? cells[1] ?? "").trim(),
        cells[2] ?? "", // keep the token cell
      ],
    );
    if (!out) {
      throw new Error(
        `Spacing token '${slug}' not found in Tokens — Spacing & Shapes section`,
      );
    }
    return out;
  }

  if (blockId.startsWith("token:typography:")) {
    const slug = blockId.slice("token:typography:".length);
    const sectionRegex =
      /(##\s*Tokens\s*[—-]\s*Typography\s*\n)([\s\S]*?)(?=\n## |$)/i;
    const match = md.match(sectionRegex);
    if (!match) {
      throw new Error("Typography section not found in design document");
    }

    // Prepend "\n" so the very first "### " subsection also splits out (the
    // section regex may have eaten the blank line before it).
    const fullText = "\n" + match[2];
    const parts = fullText.split(/\n### /);
    let found = false;

    const newParts = parts.map((part, index) => {
      if (index === 0) return part; // preamble before first ###
      const nl = part.indexOf("\n");
      const heading = (nl === -1 ? part : part.slice(0, nl)).trim();
      const namePart = heading.split(" — ")[0]?.trim() ?? heading;
      // "Type Scale" and other non-font subsections slugify to themselves and
      // never collide with a real font slug, so they pass through untouched.
      if (slugify(namePart) !== slug) return part;

      found = true;
      const cssMatch = heading.match(/·\s*`([^`]+)`/);
      const cssVar =
        typeof updatedData.cssVar === "string" && updatedData.cssVar
          ? updatedData.cssVar
          : (cssMatch?.[1] ?? "");
      const name =
        typeof updatedData.name === "string" && updatedData.name
          ? updatedData.name
          : namePart;
      // The Apollo heading carries the CSS var as a "· `--font-x`" tail, which
      // the parser folds into `role`. Strip any such tail so we re-append the
      // var exactly once and never double it.
      const role = (
        typeof updatedData.role === "string" ? updatedData.role : ""
      )
        .replace(/\s*·\s*`[^`]+`\s*$/, "")
        .trim();
      const field = (key: string, fallback = "") =>
        typeof updatedData[key] === "string" ? updatedData[key] : fallback;

      const newHeading = `${name}${role ? ` — ${role}` : ""}${
        cssVar ? ` · \`${cssVar}\`` : ""
      }`;
      const bullets = [
        `- **Substitute:** ${field("substitute")}`,
        `- **Weights:** ${field("weights")}`,
        `- **Sizes:** ${field("sizes")}`,
        `- **Line height:** ${field("lineHeight")}`,
        `- **Letter spacing:** ${field("letterSpacing")}`,
        `- **Role:** ${role}`,
      ];
      return `${newHeading}\n${bullets.join("\n")}\n`;
    });

    if (!found) {
      throw new Error(
        `Typography token '${slug}' not found in Tokens — Typography section`,
      );
    }
    return md.replace(
      sectionRegex,
      `$1${newParts.join("\n### ").slice(1)}`,
    );
  }

  if (blockId === "page:introduction") {
    let out = md;
    const { name, tagline, overview } = updatedData as {
      name?: string;
      tagline?: string;
      overview?: string;
    };

    if (typeof name === "string" && name.trim()) {
      // Preserve a " — <suffix>" on the H1 (e.g. "Apollo — Style Reference"),
      // since the parser derives system.name from the part before " — ".
      out = out.replace(/^#\s+(.+)$/m, (_full, title: string) => {
        const suffix = title.includes(" — ")
          ? ` — ${title.split(" — ").slice(1).join(" — ")}`
          : "";
        return `# ${name.trim()}${suffix}`;
      });
    }

    if (typeof tagline === "string") {
      if (/^>\s+.+$/m.test(out)) {
        out = out.replace(/^>\s+.+$/m, `> ${tagline.trim()}`);
      } else if (tagline.trim()) {
        // No blockquote yet — insert one right after the H1.
        out = out.replace(/^(#\s+.+)$/m, `$1\n> ${tagline.trim()}`);
      }
    }

    if (typeof overview === "string") {
      // Overview is the prose between the header block and "## Tokens" (or the
      // first ## section). Replace that paragraph region, keeping title/tagline/
      // theme lines intact.
      const tokensIdx = out.search(/\n##\s/);
      const head = tokensIdx >= 0 ? out.slice(0, tokensIdx) : out;
      const rest = tokensIdx >= 0 ? out.slice(tokensIdx) : "";
      const headLines = head.split("\n");
      const kept: string[] = [];
      for (const line of headLines) {
        if (
          /^#\s/.test(line) ||
          /^>\s/.test(line) ||
          /^\*\*Theme:\*\*/i.test(line) ||
          line.trim() === ""
        ) {
          kept.push(line);
        }
        // drop existing overview prose lines
      }
      // Trim trailing blank lines, then append the new overview paragraph.
      while (kept.length && kept[kept.length - 1].trim() === "") kept.pop();
      const newHead =
        kept.join("\n") +
        (overview.trim() ? `\n\n${overview.trim()}\n` : "\n");
      out = newHead + (rest ? `\n${rest.replace(/^\n+/, "")}` : "");
    }

    if (out === md) {
      throw new Error("Introduction fields not found in design document");
    }
    return out;
  }

  if (blockId.startsWith("component:")) {
    const targetSlug = blockId.replace(/^component:/, "");
    const workspaceScan = /blocksmith-source:\s*workspace-scan/i.test(md);
    // (?=\n## [^#]) — do not stop at ### component headings
    const compSectionRegex = workspaceScan
      ? /(##\s*[\d.]+\.\s*Component Library\s*\n)([\s\S]*?)(?=\n## [^#]|$)/i
      : /(##\s*Components\s*\n)([\s\S]*?)(?=\n## [^#]|$)/i;
    const match = md.match(compSectionRegex);
    if (!match) {
      throw new Error("Components section not found in design document");
    }

    const group2 = match[2];
    const fullCompText = "\n" + group2;
    const parts = fullCompText.split(/\n###\s+/);
    let found = false;

    const newParts = parts.map((part, index) => {
      if (index === 0) {
        // Intro text before any H3
        return part;
      }
      const nlIndex = part.indexOf("\n");
      const title = nlIndex === -1 ? part.trim() : part.slice(0, nlIndex).trim();
      const body = nlIndex === -1 ? "" : part.slice(nlIndex + 1);

      const componentSlug = slugify(title);
      if (componentSlug === targetSlug) {
        found = true;
        const role = typeof updatedData.role === "string" ? updatedData.role : "";
        const description =
          typeof updatedData.description === "string"
            ? updatedData.description
            : "";
        const roleText = `**Role:** ${role.trim()}`;
        const descText = description.trim();

        if (workspaceScan) {
          const tableStart = body.search(/\n\| Field \|/);
          const tableBlock = tableStart >= 0 ? body.slice(tableStart) : "";
          const notesBlock = descText
            ? `\n\n**Designer notes:**\n\n${descText}\n`
            : "\n";
          const newBody = `\n${roleText}${notesBlock}${tableBlock}`;
          return `${title}\n${newBody}`;
        }

        const newBody = `\n${roleText}\n\n${descText}\n`;
        return `${title}\n${newBody}`;
      }
      return part;
    });

    if (!found) {
      throw new Error(
        `Component with id '${targetSlug}' not found in Components section`,
      );
    }

    const newComponentsContent = newParts.join("\n### ").slice(1);
    return md.replace(compSectionRegex, `$1${newComponentsContent}`);
  }

  throw new Error(`Unsupported blockId: ${blockId}`);
}
