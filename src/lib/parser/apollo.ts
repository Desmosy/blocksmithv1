import type {
  ColorToken,
  ComponentDoc,
  DesignSystem,
  NavSection,
  SpacingToken,
  SurfaceRow,
  TypeScaleRow,
  TypographyFamily,
} from "@/lib/blocks/types";
import { inferColorGroups } from "@/lib/design-tokens/resolve";
import {
  isTableHeaderRow,
  parseHexColor,
  stripCell,
} from "@/lib/parser/normalize";

const COLOR_GROUPS: Record<string, string[]> = {
  BRAND: ["apollo-gold", "accent-green", "violet-headline"],
  "FOREGROUND NEUTRALS": [
    "midnight-ink",
    "graphite",
    "charcoal-text",
    "faded-stone",
    "soft-stone",
  ],
  "BACKGROUND NEUTRALS": [
    "canvas",
    "subtle-gray",
    "ash-gray",
    "crisp-white",
  ],
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseTableRows(
  section: string,
  minCols: number,
): string[][] {
  const lines = section.split("\n");
  const rows: string[][] = [];
  for (const line of lines) {
    if (!line.startsWith("|") || line.includes("---")) continue;
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length >= minCols) rows.push(cells);
  }
  return rows;
}

function extractSection(md: string, heading: string): string {
  const regex = new RegExp(
    `## ${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`,
  );
  const match = md.match(regex);
  return match?.[1]?.trim() ?? "";
}

function extractSubsections(section: string): Map<string, string> {
  const map = new Map<string, string>();
  const parts = section.split(/\n### /);
  for (const part of parts) {
    if (!part.trim()) continue;
    const nl = part.indexOf("\n");
    const rawTitle = nl === -1 ? part.trim() : part.slice(0, nl).trim();
    const title = rawTitle.replace(/^#+\s*/, "");
    const body = nl === -1 ? "" : part.slice(nl + 1).trim();
    if (title) map.set(title, body);
  }
  return map;
}

function inferColorGroup(cssVar: string): string {
  const key = cssVar.replace("--color-", "");
  for (const [group, tokens] of Object.entries(COLOR_GROUPS)) {
    if (tokens.includes(key)) return group;
  }
  return "OTHER";
}

function parseColors(section: string): ColorToken[] {
  const rows = parseTableRows(section, 4).filter((cells) => !isTableHeaderRow(cells));
  return rows
    .map((cells) => {
      const hex = parseHexColor(cells[1] ?? "");
      if (!hex) return null;
      const cssVar = stripCell(cells[2] ?? "");
      return {
        name: stripCell(cells[0] ?? ""),
        value: hex,
        cssVar: cssVar.startsWith("--") ? cssVar : `--color-${cssVar}`,
        role: stripCell(cells[3] ?? ""),
        group: inferColorGroup(cssVar),
      };
    })
    .filter((t): t is ColorToken => t !== null);
}

function parseTypography(section: string): {
  families: TypographyFamily[];
  scale: TypeScaleRow[];
} {
  const families: TypographyFamily[] = [];
  const subs = extractSubsections(section);

  for (const [title, body] of subs) {
    if (title === "Type Scale") {
      continue;
    }

    const cssMatch = body.match(/·\s*`([^`]+)`/);
    const cssVar = cssMatch?.[1] ?? "";
    const get = (label: string) => {
      const m = body.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*([^\\n]+)`));
      return m?.[1]?.trim() ?? "";
    };

    families.push({
      name: title.split(" — ")[0]?.trim() ?? title,
      cssVar,
      substitute: get("Substitute"),
      weights: get("Weights"),
      sizes: get("Sizes"),
      lineHeight: get("Line height"),
      letterSpacing: get("Letter spacing"),
      role:
        title.includes(" — ")
          ? title.split(" — ").slice(1).join(" — ").trim()
          : get("Role") || body.split("\n")[0],
    });
  }

  const scaleSection = subs.get("Type Scale");
  const scale: TypeScaleRow[] = scaleSection
    ? parseTableRows(scaleSection, 5)
        .filter((c) => !isTableHeaderRow(c))
        .map((c) => ({
          role: c[0],
          size: c[1],
          lineHeight: c[2],
          letterSpacing: c[3],
          token: c[4]?.replace(/`/g, "") ?? "",
        }))
    : [];

  return { families, scale };
}

function parseSpacing(section: string): {
  spacing: SpacingToken[];
  borderRadius: { element: string; value: string }[];
  layout: { label: string; value: string }[];
} {
  const spacing: SpacingToken[] = [];
  const borderRadius: { element: string; value: string }[] = [];
  const layout: { label: string; value: string }[] = [];

  const scaleMatch = section.match(
    /### Spacing Scale\s*([\s\S]*?)(?=### |$)/,
  );
  if (scaleMatch) {
    parseTableRows(scaleMatch[1], 3)
      .filter((c) => !isTableHeaderRow(c))
      .forEach((c) => {
        spacing.push({
          name: stripCell(c[0] ?? ""),
          value: stripCell(c[1] ?? ""),
          token: stripCell(c[2] ?? "").replace(/`/g, ""),
        });
      });
  }

  const radiusMatch = section.match(
    /### Border Radius\s*([\s\S]*?)(?=### |$)/,
  );
  if (radiusMatch) {
    parseTableRows(radiusMatch[1], 2)
      .filter((c) => !isTableHeaderRow(c))
      .forEach((c) => {
        borderRadius.push({
          element: stripCell(c[0] ?? ""),
          value: stripCell(c[1] ?? ""),
        });
      });
  }

  const layoutMatch = section.match(/### Layout\s*([\s\S]*?)(?=## |$)/);
  if (layoutMatch) {
    const bullets = layoutMatch[1].match(/- \*\*([^*]+):\*\*\s*([^\n]+)/g);
    bullets?.forEach((b) => {
      const m = b.match(/- \*\*([^*]+):\*\*\s*(.+)/);
      if (m) layout.push({ label: m[1], value: m[2] });
    });
  }

  return { spacing, borderRadius, layout };
}

function parseComponents(section: string): ComponentDoc[] {
  const subs = extractSubsections(section);
  const docs: ComponentDoc[] = [];
  for (const [title, body] of subs) {
    const roleMatch = body.match(/\*\*Role:\*\*\s*([^\n]+)/);
    const role = roleMatch?.[1]?.trim() ?? "";
    const desc = body.replace(/\*\*Role:\*\*\s*[^\n]+\n?/, "").trim();
    docs.push({
      id: slugify(title),
      title,
      role,
      description: desc,
    });
  }
  return docs;
}

function parseGuidelines(section: string): { dos: string[]; donts: string[] } {
  const dos: string[] = [];
  const donts: string[] = [];
  const doBlock = section.match(/### Do\s*([\s\S]*?)(?=### Don't|$)/i);
  const dontBlock = section.match(/### Don't\s*([\s\S]*?)(?=## |$)/i);

  doBlock?.[1]
    .split("\n")
    .filter((l) => l.startsWith("- "))
    .forEach((l) => dos.push(l.slice(2).trim()));

  dontBlock?.[1]
    .split("\n")
    .filter((l) => l.startsWith("- "))
    .forEach((l) => donts.push(l.slice(2).trim()));

  return { dos, donts };
}

function parseSurfaces(section: string): SurfaceRow[] {
  return parseTableRows(section, 4)
    .filter((c) => !isTableHeaderRow(c))
    .map((c) => {
      const hex = parseHexColor(c[2] ?? "");
      if (!hex) return null;
      return {
        level: stripCell(c[0] ?? ""),
        name: stripCell(c[1] ?? ""),
        value: hex,
        purpose: stripCell(c[3] ?? ""),
      };
    })
    .filter((s): s is SurfaceRow => s !== null);
}

function parseSimilarBrands(section: string): { name: string; note: string }[] {
  const items: { name: string; note: string }[] = [];
  const lines = section.split("\n").filter((l) => l.startsWith("- **"));
  for (const line of lines) {
    const m = line.match(/- \*\*([^*]+)\*\*\s*—\s*(.+)/);
    if (m) items.push({ name: m[1], note: m[2] });
  }
  return items;
}

function buildNav(components: ComponentDoc[]): NavSection[] {
  const componentItems = components.map((c) => ({
    id: c.id,
    label: c.title,
    href: `/wiki/components/${c.id}`,
  }));

  return [
    {
      id: "intro",
      label: "",
      items: [
        { id: "introduction", label: "Introduction", href: "/wiki" },
      ],
    },
    {
      id: "preview",
      label: "Preview",
      items: [
        { id: "demo", label: "Generated demo", href: "/wiki/demo" },
        {
          id: "playground",
          label: "Component Playground",
          href: "/wiki/playground",
        },
      ],
    },
    {
      id: "foundation",
      label: "Foundation",
      items: [
        { id: "layout", label: "Layout", href: "/wiki/foundation/layout" },
        {
          id: "typography",
          label: "Typography",
          href: "/wiki/foundation/typography",
        },
        {
          id: "color",
          label: "Color",
          href: "/wiki/foundation/color",
          children: [
            { id: "palette", label: "Palette", href: "/wiki/foundation/color" },
            {
              id: "color-guidelines",
              label: "Guidelines",
              href: "/wiki/guidelines",
            },
          ],
        },
        { id: "imagery", label: "Imagery", href: "/wiki/foundation/imagery" },
        {
          id: "surfaces",
          label: "Surfaces",
          href: "/wiki/foundation/surfaces",
        },
        { id: "spacing", label: "Spacing", href: "/wiki/foundation/spacing" },
        { id: "source", label: "Source", href: "/wiki/source" },
      ],
    },
    {
      id: "components",
      label: "Components",
      items: componentItems,
    },
    {
      id: "guidelines",
      label: "Workflow",
      items: [
        { id: "pipeline", label: "Pipeline", href: "/wiki/pipeline" },
        { id: "governance", label: "Governance", href: "/wiki/governance" },
        { id: "releases", label: "Release log", href: "/wiki/releases" },
        { id: "guidelines", label: "Guidelines", href: "/wiki/guidelines" },
        {
          id: "agent",
          label: "Agent guide",
          href: "/wiki/foundation/agent-guide",
        },
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
}

export function parseApolloMarkdown(
  md: string,
  sourcePath: string,
): DesignSystem {
  const titleMatch = md.match(/^# (.+)$/m);
  const taglineMatch = md.match(/^> (.+)$/m);
  const themeMatch = md.match(/\*\*Theme:\*\*\s*(\w+)/);

  const overviewEnd = md.indexOf("## Tokens");
  const overviewBlock = md.slice(0, overviewEnd > 0 ? overviewEnd : md.length);
  const overview = overviewBlock
    .replace(/^#.+$/m, "")
    .replace(/^>.+$/m, "")
    .replace(/\*\*Theme:\*\*.+$/m, "")
    .trim();

  const colors = parseColors(extractSection(md, "Tokens — Colors"));
  const typoSection = extractSection(md, "Tokens — Typography");
  const { families, scale } = parseTypography(typoSection);
  const spacingSection = extractSection(md, "Tokens — Spacing & Shapes");
  const { spacing, borderRadius, layout } = parseSpacing(spacingSection);
  const components = parseComponents(extractSection(md, "Components"));
  const { dos, donts } = parseGuidelines(
    extractSection(md, "Do's and Don'ts"),
  );
  const surfaces = parseSurfaces(extractSection(md, "Surfaces"));
  const imagery = extractSection(md, "Imagery");
  const layoutNotes = extractSection(md, "Layout");
  const agentGuide = extractSection(md, "Agent Prompt Guide");
  const similarBrands = parseSimilarBrands(extractSection(md, "Similar Brands"));

  const name = titleMatch?.[1]?.replace(/ — .+$/, "") ?? "Design System";
  const id = slugify(name);

  return {
    id,
    name,
    tagline: taglineMatch?.[1] ?? "",
    theme: themeMatch?.[1] ?? "light",
    overview,
    sourcePath,
    updatedAt: new Date().toISOString(),
    colors,
    typography: families,
    typeScale: scale,
    spacing,
    borderRadius,
    layout,
    components,
    dos,
    donts,
    surfaces,
    imagery,
    layoutNotes,
    agentGuide,
    similarBrands,
    nav: buildNav(components),
  };
}

export function groupColorsByCategory(
  colors: ColorToken[],
): Map<string, ColorToken[]> {
  return inferColorGroups(colors);
}
