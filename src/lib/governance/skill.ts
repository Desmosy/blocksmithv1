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
import { graphicsKit } from "@/lib/graphics/kit";
import { motionSection } from "@/lib/governance/motion";
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
   * How pages are composed in this system.
   *
   * Tokens and components say what a page is made of; without composition an
   * agent falls back to the one landing-page template every model carries —
   * hero, logo marquee, three cards, demo — whatever the source site looks
   * like. The capture now records the source page's anatomy under "## Layout";
   * reprint it here with the rules that make it binding.
   */
  // No /m flag: with it, `$` matches the first line-end and the capture
  // stops after one line, silently dropping the page anatomy.
  // The measured dark palette rides along verbatim when the capture found
  // one — an agent asked for dark mode should use measured values, not
  // invert colours by guesswork.
  const darkSection = markdown
    .match(/\n### Dark mode[^\n]*\n([\s\S]*?)(?=\n#{2,3} |$)/)?.[1]
    ?.trim();
  if (darkSection) {
    out.push(
      "## Dark mode",
      "",
      "Measured under `prefers-color-scheme: dark` — use these values, never",
      "an inverted guess:",
      "",
      darkSection,
      "",
    );
  }

  const layoutSection = markdown.match(/\n## Layout\s*\n([\s\S]*?)(?=\n## |$)/)?.[1]?.trim();
  const sectionGap =
    layoutSection?.match(/separated by ~(\d+)px/)?.[1] ??
    (spacing.length ? String(spacing[spacing.length - 1].px) : null);
  out.push(
    "## Composing a page",
    "",
    ...(layoutSection
      ? [layoutSection, ""]
      : ["This system records no page anatomy of its own; the rules below still bind.", ""]),
    "Composition rules, all binding:",
    "",
    "- **Structure comes from the anatomy above and from the request — never from",
    "  a stock template.** \"Hero, logo marquee, three feature cards, interactive",
    "  demo\" on every page is the tell of an ungoverned build; when your draft",
    "  matches that shape, re-derive it from the anatomy before showing anyone.",
    ...(sectionGap
      ? [
          `- **Respect the section rhythm.** Consecutive sections are separated by`,
          `  ~${sectionGap}px of vertical space (padding or margin — pick one and keep it).`,
          "  No two sections may touch unless the anatomy shows bands running edge to edge.",
        ]
      : [
          "- **Respect a consistent section rhythm.** Pick one large spacing value for",
          "  the gap between sections and use it everywhere.",
        ]),
    "- **Alternate surfaces the way the anatomy does** — ground, tinted, inverted —",
    "  not on a fixed rotation and not never.",
    "- **Scale sections like the source.** A hero that is most of a viewport on the",
    "  source page is not a 300px strip; a footer is not a hero.",
    "- **A different page type has a different anatomy.** A dashboard, pricing page",
    "  or report keeps the rhythm and the surfaces, not the landing page's band list.",
    "",
  );

  /**
   * Patterns the capture never saw, pre-derived from the tokens.
   *
   * "The system does not define tabs" used to end the conversation — the agent
   * either refused the pattern or invented an off-system one. Absence of
   * evidence is not a prohibition: every core primitive below has one honest
   * derivation from tokens the system already has, so the agent can keep
   * building and note the piece as derived.
   */
  const componentProse = system.components.map((c) => `${c.title} ${c.role ?? ""}`).join(" ").toLowerCase();
  const hairlineColor =
    system.colors.find((c) => /hairline|border|separator|divider/i.test(c.role ?? ""))?.value ??
    system.colors.find((c) => /hairline|border/i.test(c.name))?.value ?? null;
  const hairline = hairlineColor ?? "the palette's lightest structural grey";
  const controlRadius = radii.find((r) => /control|button/i.test(r.element))?.px ?? radii[0]?.px ?? 6;
  const derivable: { key: RegExp; name: string; spec: string }[] = [
    { key: /\btabs?\b|segmented/, name: "Tabs", spec: `a row of text-weight triggers at the body size; the active one carries the ink and a 2px ink underline (or the pill fill, if this system's buttons are pills); inactive ones use the muted text colour; one hairline (${hairline}) under the full row.` },
    { key: /accordion|disclosure|collaps/, name: "Accordion", spec: `full-width rows separated by the hairline (${hairline}); a caption-size chevron rotates 180° on the fast duration; content expands over the entrance duration; no boxes around boxes.` },
    { key: /\binput\b|text field|form field|search field/, name: "Text input", spec: `the outline button's treatment as a field: ${controlRadius}px radius, hairline edge, control height, body-size text, placeholder in the muted colour; focus swaps the hairline for the ink (or accent) at the same width.` },
    { key: /select|dropdown|menu\b/, name: "Select / dropdown", spec: `the text input with a caption-size chevron; the open panel is the card surface with the card's edge treatment and one hairline between options.` },
    { key: /modal|dialog|sheet/, name: "Modal", spec: `the card treatment centred over a scrim of the ink at ~40% opacity; card radius, card padding doubled; entrance over the entrance duration; no new shadows — use the card's own edge.` },
    { key: /\btable\b|data grid/, name: "Data table", spec: `caption-size uppercase-or-muted headers, body-size cells, hairline rules between rows only (no vertical rules, no zebra unless the system has a tinted band).` },
    { key: /tooltip/, name: "Tooltip", spec: `an inverted chip: ink fill, ground text, caption size, the smallest radius, appearing over the fast duration.` },
    { key: /toast|notification|snackbar/, name: "Toast", spec: `the card treatment at its smallest, bottom corner, entering over the entrance duration; body-size message, one optional text-weight action.` },
    { key: /badge|\btag\b|chip|pill label/, name: "Badge", spec: `caption-size label in a hairline-edged pill (or the smallest radius), muted text on the ground; the accent version is reserved for state that matters.` },
    { key: /pagination|pager/, name: "Pagination", spec: `text-weight page numbers at the body size; the current page carries the ink and the active treatment tabs use; hairline separators only if the nav does.` },
  ];
  const missing = derivable.filter((d) => !d.key.test(componentProse));
  if (missing.length) {
    out.push(
      "## Patterns this system does not define — derived defaults",
      "",
      "The captured page never showed these. That is absence of evidence, not a",
      "prohibition: when a build needs one, use the derivation below, say in your",
      "summary that it is derived rather than observed, and keep building — do not",
      "refuse the pattern and do not invent an off-system one. When a derived",
      "pattern earns a permanent spec, propose it with `propose_design_change`.",
      "",
      ...missing.map((d) => `- **${d.name}** — ${d.spec}`),
      "",
    );
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

  // Movement before decoration: an agent that reads only this far should
  // already know the page it builds is expected to move.
  out.push(...motionSection(system, markdown));

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
    "### The decoration contract — violating any line means redraw, not adjust",
    "",
    "Decoration is quiet or it is wrong. Each rule is checkable at a glance:",
    "",
    "1. **Decoration never overlaps text or controls.** It lives behind everything",
    "   (`z-index: -1`, `pointer-events: none`) or in a region of its own — the",
    "   empty half of a hero, a card's media cell, a section corner. If removing",
    "   the graphic would reveal words, it is in the wrong place.",
    "2. **No clip-art.** No stars, sparkles, bolts, rockets, hearts, arrows-with-",
    "   swoosh or blob mascots, at any size or opacity. A single filled glyph",
    "   floated over a layout is the signature of a page nobody designed.",
    "2b. **No graph-paper grids.** Never rule a mesh of squares behind a diagram,",
    "   chart or card — it is the grid-notebook cliché of generated pages. A",
    "   chart gets at most one hairline baseline; a diagram gets clean ground.",
    "3. **Whisper contrast.** Decorative strokes and fills sit within two steps of",
    "   the surface they sit on (mix the ink toward the ground by 70–85%). Full",
    "   ink and accent appear only as punctuation dots a few pixels wide.",
    "4. **Scale is capped.** One decorative element covers at most a fifth of its",
    "   container — anything larger must be a full-bleed background at background",
    "   contrast with all content layered above it.",
    "5. **Geometry the system already speaks.** Dots, hairline circles and arcs,",
    "   straight rules, the system's own radii. Stroke width is the hairline.",
    "6. **Start from the kit below or a visual measured in this system.** Change",
    "   parameters — rotation, density, position, a colour for another token —",
    "   rather than drawing a new shape from nothing.",
    "7. **One graphic per section.** Empty space is part of the system; a page",
    "   that needs more decoration usually needs less.",
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

  // The kit, with this system's colours already in it. An agent that has the
  // working code reaches for it; one that has only advice reaches for a PNG.
  const kit = graphicsKit(system);
  out.push(
    "### Graphics kit — this system's colours, as code",
    "",
    "Decorative graphics are code, never image files. Raster images are for",
    "photography and screenshots only. Start from these; change a colour or a",
    "parameter rather than drawing something new.",
    "",
  );
  for (const s of kit.snippets) {
    out.push(
      `**${s.title}** — ${s.purpose}`,
      ...(s.install ? ["", "Install first: `" + s.install + "`"] : []),
      "",
      "```" + (s.language === "tsx" ? "tsx" : "html"),
      s.code,
      "```",
      "",
    );
  }

  out.push(
    "### Libraries to compose from",
    "",
    "Do not draw what a maintained library already does well. Reach for these,",
    "and pass this system's colours in — the rule is the same for every one:",
    "tokens go in as props, and no decorative element is an image file.",
    "",
    "- **@paper-design/shaders-react** — thirty tuned WebGL shaders (MeshGradient, GrainGradient, Dithering, Metaballs, Water…) that take `colors` as strings. The mesh above is built on it.",
    "- **shadcn/ui blocks** (ui.shadcn.com/blocks) — page-level sections; restyle through the CSS variables in Quick Start, not by editing markup.",
    "- **Magic UI** and **Aceternity UI** — animated backgrounds and effects as React components; every colour prop takes a token.",
    "- **react-bits** (reactbits.dev) — OGL/WebGL backgrounds such as Aurora, Silk and Iridescence, with colour props.",
    "- **three / @react-three/fiber** — when the graphic is genuinely 3D. Materials take the same hex values.",
    "",
    "A block from any of these is a starting point, not a finish: after placing it, run `check_governance` on the result like any other component.",
    "",
  );

  out.push(
    "## Before you finish",
    "",
    "1. Every colour appears in the Colours table.",
    "2. Every font size appears in the type scale.",
    "3. Every padding, margin and gap appears in the spacing scale.",
    "4. Every radius appears in the radii list.",
    "5. You used an existing component rather than inventing one.",
    "6. Decorative graphics are SVG, Canvas or shader code built from the tokens — not PNG, JPEG or generated images.",
    "7. No decorative element overlaps text or controls, and none is a clip-art glyph — re-read the decoration contract if either is close.",
    "8. The page's structure came from the anatomy and the request, not a stock template, and every section break carries the section rhythm.",
    "",
    "If this project is connected to BlockSmith, `check_governance` verifies all",
    "five mechanically. Run it before showing the user generated UI.",
    "",
  );

  return out.filter((line, i, all) => !(line === "" && all[i - 1] === "")).join("\n");
}
