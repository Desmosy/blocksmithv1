/**
 * Emit a design system as a skill file a coding agent can load.
 *
 * The Lab governs an agent that is *on the page*. Most UI gets written
 * somewhere else — an editor, a terminal, a code-gen tool — where no WebMCP
 * tool is reachable. A skill file is how the same rules travel: the agent
 * reads it once and writes compliant code before anything needs rejecting.
 *
 * This is the same content the tools serve, arranged for a model reading
 * top-to-bottom rather than calling a function. It is intentionally
 * prescriptive: an agent skims prose and follows rules, so every section
 * states what to do rather than describing what exists.
 */

import type { DesignSystem } from "@/lib/blocks/types";
import { capabilitySurface, summarizeCapability } from "./capability";

/** YAML-safe single-line string for frontmatter. */
function yamlValue(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return /[:#"'\[\]{}|>]/.test(flat) ? JSON.stringify(flat) : flat;
}

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** px number out of a scale row, tolerating a bare value. */
function px(raw: string | undefined): number | null {
  const n = Number(String(raw ?? "").replace(/px$/i, "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function buildSkill(system: DesignSystem, markdown: string): string {
  const name = slug(system.name) || "design-system";
  const colors = system.colors.filter((c) => c.value.startsWith("#"));
  const spacing = system.spacing
    .map((s) => ({ name: s.name, px: px(s.value), token: s.token }))
    .filter((s) => s.px !== null);
  const sizes = system.typeScale
    .map((t) => ({ role: t.role, px: px(t.size), token: t.token }))
    .filter((t) => t.px !== null);
  const radii = system.borderRadius
    .map((r) => ({ element: r.element, px: px(r.value) }))
    .filter((r) => r.px !== null);

  const { offered, ruledOut } = capabilitySurface(system, markdown);
  const live = offered.filter((c) => c.status !== "deprecated");
  const deprecated = offered.filter((c) => c.status === "deprecated");

  const out: string[] = [];

  out.push(
    "---",
    `name: ${name}`,
    `description: ${yamlValue(
      `Build UI in the ${system.name} design system. ` +
        `Use its ${colors.length} colour tokens, ${sizes.length}-step type scale and ` +
        `${spacing.length}-step spacing scale instead of arbitrary values. ` +
        `Applies whenever writing or changing components, styles or layout in this project.`,
    )}`,
    "user-invocable: false",
    "---",
    "",
    `# ${system.name}`,
    "",
    system.tagline ? `> ${system.tagline}` : "",
    "",
    system.overview?.trim() ? system.overview.trim() : "",
    "",
  );

  out.push(
    "## The one rule",
    "",
    "Every colour, size, space and radius you write must come from a table below.",
    "If the value you want is not in one, that is the answer: pick the nearest",
    "listed value, or ask the user. Do not add a value because it looks close.",
    "",
  );

  if (colors.length) {
    out.push(
      "## Colours",
      "",
      "| Token | Value | Use for |",
      "|-------|-------|---------|",
      ...colors.map(
        (c) => `| \`${c.cssVar || `--color-${slug(c.name)}`}\` | ${c.value} | ${c.role || c.name} |`,
      ),
      "",
      "Reference these as CSS variables where the project defines them, and as",
      "the literal hex only where it does not. Never write a colour that is not",
      "in this table — including `#000000` and `#ffffff` unless they appear above.",
      "",
    );
  }

  if (sizes.length) {
    out.push(
      "## Type scale",
      "",
      "| Role | Size | Token |",
      "|------|------|-------|",
      ...sizes.map((t) => `| ${t.role} | ${t.px}px | \`${t.token}\` |`),
      "",
      `Use these sizes only. Intermediate values flatten the hierarchy the scale exists to create.`,
      "",
    );
  }

  if (system.typography.length) {
    out.push(
      "## Typefaces",
      "",
      ...system.typography.map(
        (f) =>
          `- **${f.name}** — ${f.role || "no stated role"}${
            f.substitute && f.substitute !== f.name ? ` (substitute: ${f.substitute})` : ""
          }`,
      ),
      "",
      "Do not introduce another family. If a weight you want is not listed, use",
      "size or space for emphasis instead.",
      "",
    );
  }

  if (spacing.length) {
    out.push(
      "## Spacing",
      "",
      spacing.map((s) => `\`${s.token}\` ${s.px}px`).join(" · "),
      "",
      "Padding, margin and gap come from this scale. Off-scale values are what",
      "make a layout feel accidental, and they are the most common failure.",
      "",
    );
  }

  if (radii.length) {
    out.push(
      "## Radii",
      "",
      radii.map((r) => `${r.element} ${r.px}px`).join(" · "),
      "",
    );
  }

  if (live.length) {
    out.push(
      "## Components",
      "",
      "Reach for one of these before writing anything new.",
      "",
      ...live.map((c) => `- ${summarizeCapability(c)}`),
      "",
    );
  }

  if (deprecated.length) {
    out.push(
      "### Deprecated — do not use in new work",
      "",
      ...deprecated.map((c) => `- ${summarizeCapability(c)}`),
      "",
    );
  }

  // The half an agent cannot infer from anything else, and the reason a skill
  // file beats a screenshot of the design system.
  if (ruledOut.length) {
    out.push(
      "### Ruled out — do not build these",
      "",
      ...ruledOut.map((c) => `- ${summarizeCapability(c)}`),
      "",
      "These are decisions, not omissions. If the user asks for one, say it is",
      "not part of this system and offer the listed alternative.",
      "",
    );
  }

  if (system.dos.length) {
    out.push("## Do", "", ...system.dos.map((d) => `- ${d}`), "");
  }
  if (system.donts.length) {
    out.push("## Don't", "", ...system.donts.map((d) => `- ${d}`), "");
  }

  /**
   * How to build a graphic in this system.
   *
   * The rest of this file says what the system *is*. An agent asked for a
   * hero visual or an illustration has nothing to go on and reaches for a
   * stock gradient, which is the fastest way to make compliant tokens look
   * nothing like the brand. Capture already identifies a page's visuals —
   * gradient orbs, icons, imagery — so the system knows what kind of graphics
   * it has; this turns that into instructions.
   */
  const visuals = system.components.filter((c) =>
    /gradient|orb|image|icon|illustration|visual|panel/i.test(`${c.title} ${c.role}`),
  );
  const graphicTokens = system.colors.filter((c) =>
    /decorative|artwork/i.test(c.role || ""),
  );

  out.push(
    "## Building graphics",
    "",
    "Graphics follow the same system as the interface. Build them as code you",
    "can re-run with different parameters, not as one-off artwork:",
    "",
    "1. **Geometry first.** State the shapes and their relationships before",
    "   choosing how to draw them — a circle at 40% of the container, three",
    "   stops on a diagonal — so the graphic can be resized and re-coloured.",
    "2. **Then rendering.** Inline SVG for anything flat or iconographic, canvas",
    "   or WebGL only when there are more elements than the DOM should hold.",
    "3. **Colour from the tokens above.** A graphic that invents its own palette",
    "   is the one thing that will make everything else look wrong.",
    "4. **Expose the parameters.** Size, colours and density as props or CSS",
    "   variables, so the graphic is a component rather than a picture.",
    "",
  );

  if (graphicTokens.length) {
    out.push(
      "This system reserves colours for artwork that it does not use in UI",
      "chrome. Graphics are where they belong:",
      "",
      ...graphicTokens.map((c) => `- \`${c.value}\` — ${c.name}`),
      "",
    );
  }

  if (visuals.length) {
    out.push(
      "Visuals already in this system — match them rather than inventing a",
      "different style:",
      "",
      ...visuals.slice(0, 6).map((c) => `- **${c.title}** — ${c.role}`),
      "",
    );
  }

  out.push(
    "## Before you finish",
    "",
    "1. Every colour appears in the Colours table.",
    "2. Every font size appears in the type scale.",
    "3. Every padding, margin and gap appears in the spacing scale.",
    "4. Every radius appears in the radii list.",
    "5. You used an existing component rather than inventing one.",
    "",
    "If this project is connected to BlockSmith, `check_governance` verifies all",
    "five mechanically. Run it before showing the user generated UI.",
    "",
  );

  return out.filter((line, i, all) => !(line === "" && all[i - 1] === "")).join("\n");
}
