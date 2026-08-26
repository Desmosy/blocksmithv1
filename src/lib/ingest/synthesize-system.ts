/**
 * Turn what we read off a page into a design system a human can govern.
 *
 * Capture on its own is a report: here are the colours that site uses. That
 * dead-ends — you cannot build against a list. This synthesises the extracted
 * values into a Style Reference document, which is the format the parser, the
 * linters and codegen all already understand, so a captured site becomes a
 * first-class design system rather than a curiosity.
 *
 * Two things this is careful about:
 *
 *  - **It does not invent taste.** Roles are assigned from measurable facts
 *    (luminance, usage frequency), and the doc says plainly which parts are
 *    observed and which are a guess. Anything it cannot ground, it omits.
 *  - **It cannot see intent.** A captured system enters as a draft with no
 *    components and no capability table, because a page's CSS says nothing
 *    about which patterns a team has decided against.
 */

import type { Extracted } from "./extract-site";

/** WCAG relative luminance, for sorting a palette light-to-dark. */
function luminance(hex: string): number {
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = rgb.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Chroma as max-minus-min channel: how far a colour is from grey. */
function chroma(hex: string): number {
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return Math.max(...rgb) - Math.min(...rgb);
}

/**
 * Saturation floor for "this is a colour, not a tinted neutral".
 *
 * Tuned against real sites: Stripe's #32325d navy text sits at 43 and must not
 * qualify, while its #533afd indigo at 195 must.
 */
const ACCENT_MIN_CHROMA = 100;

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

type Named = { name: string; value: string; role: string };

/**
 * Assign roles from measurable properties rather than guessing at meaning.
 *
 * The lightest heavily-used colour is the ground, the darkest is ink, and the
 * most chromatic is the accent — those hold for the overwhelming majority of
 * sites. Everything else becomes a numbered neutral rather than being given a
 * role it may not have.
 */
function nameColors(colors: { value: string; count: number }[]): Named[] {
  const usable = colors.filter((c) => /^#[0-9a-f]{6}$/.test(c.value));
  if (!usable.length) return [];

  const byLuminance = [...usable].sort(
    (a, b) => luminance(b.value) - luminance(a.value),
  );

  // Ground is the light colour the page actually uses, not the lightest one it
  // mentions. monad.com paints #f6f3f1 across 98% of the screen and #ffffff
  // almost nowhere; picking by luminance alone called the wrong one the page.
  // Light *and* close to neutral. Lightness alone lets a saturated colour win:
  // linear.app paints a large yellow panel that is bright enough to pass a
  // luminance test, and calling it the page background is plainly wrong.
  const ground =
    [...usable]
      .filter((c) => luminance(c.value) > 0.7 && chroma(c.value) <= 30)
      .sort((a, b) => b.count - a.count)[0] ??
    [...usable].filter((c) => chroma(c.value) <= 30).sort((a, b) => b.count - a.count)[0] ??
    byLuminance[0];

  // Ink likewise: the dark colour carrying the text, not merely the darkest.
  const ink =
    [...usable]
      .filter(
        (c) => c.value !== ground.value && luminance(c.value) < 0.3 && chroma(c.value) <= 60,
      )
      .sort((a, b) => b.count - a.count)[0] ?? byLuminance[byLuminance.length - 1];

  // The accent is the colour the page *uses most*, among those saturated
  // enough to be a colour rather than a tinted neutral.
  //
  // Ranking by saturation instead picks decorative gradient stops, which are
  // always more saturated than a brand colour: on stripe.com that chose an
  // orange used 8 times over Stripe's indigo used 20. Usage separates the two
  // because a brand colour appears on every button and link, while a gradient
  // stop appears once.
  const accentCandidates = usable
    .filter((c) => c.value !== ground.value && c.value !== ink.value)
    .filter((c) => chroma(c.value) >= ACCENT_MIN_CHROMA)
    .filter((c) => contrast(c.value, ground.value) >= 3);

  const accent =
    [...accentCandidates].sort((a, b) => b.count - a.count)[0] ??
    // Nothing clearly chromatic: fall back to the most saturated thing there
    // is, rather than claiming the system has no accent at all.
    [...usable]
      .filter((c) => c.value !== ground.value && c.value !== ink.value)
      .filter((c) => chroma(c.value) > 40)
      .sort((a, b) => chroma(b.value) - chroma(a.value))
      .find((c) => contrast(c.value, ground.value) >= 3);

  const out: Named[] = [
    { name: "Ground", value: ground.value, role: "Primary page background" },
    { name: "Ink", value: ink.value, role: "Primary text" },
  ];
  if (accent) {
    out.push({
      name: "Accent",
      value: accent.value,
      role: "Interactive elements — links and primary actions",
    });
  }

  // Remaining colours become neutrals, ordered light to dark, capped so the
  // palette stays a palette rather than a dump of every value on the page.
  const claimed = new Set(out.map((c) => c.value));
  const rest = byLuminance
    .filter((c) => !claimed.has(c.value))
    .slice(0, 7);

  rest.forEach((c, i) => {
    out.push({
      name: `Neutral ${i + 1}`,
      value: c.value,
      role: `Observed on the page ${c.count} time(s)`,
    });
  });
  return out;
}

/** Ascending, de-duplicated, and capped — a scale, not a list of every value. */
function scale(values: number[], max: number): number[] {
  return [...new Set(values)]
    .filter((n) => n > 0)
    .sort((a, b) => a - b)
    .slice(0, max);
}

const SPACING_NAMES = ["2xs", "xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl"];
const TYPE_ROLES = [
  "meta",
  "caption",
  "body-sm",
  "body",
  "body-lg",
  "subheading",
  "heading",
  "heading-lg",
  "display",
];

export function synthesizeDesignSystem(found: Extracted): {
  markdown: string;
  title: string;
} {
  const host = (() => {
    try {
      return new URL(found.url).hostname.replace(/^www\./, "");
    } catch {
      return "captured";
    }
  })();

  const title = found.title?.split(/[|·—–-]/)[0].trim() || host;
  const colors = nameColors(found.colors);
  const spacing = scale(found.spacing, 9);
  const sizes = scale(found.fontSizes, 9);
  const radii = scale(found.radii, 5);

  const lines: string[] = [
    `# ${title} — Style Reference`,
    `> Captured from ${host}. Observed values, not a finished system.`,
    "",
    "**Theme:** light",
    "",
    `This design system was read from the CSS of ${found.url}. Colours, type` +
      ` sizes, spacing and radii below are what that page states. Roles were` +
      ` assigned from measurable properties — the lightest heavily-used colour` +
      ` is the ground, the darkest is ink, the most saturated is the accent —` +
      ` so they are a starting point rather than a decision. Nothing here` +
      ` describes composition, hierarchy, or the reasons behind any choice,` +
      ` because CSS does not record those. Rename the tokens, drop what you do` +
      ` not want, and add your own rules before treating this as governing.`,
    "",
  ];

  if (colors.length) {
    lines.push(
      "## Tokens — Colors",
      "",
      "| Name | Value | Token | Role |",
      "|------|-------|-------|------|",
      ...colors.map(
        (c) => `| ${c.name} | \`${c.value}\` | \`--color-${slug(c.name)}\` | ${c.role} |`,
      ),
      "",
    );
  }

  // The Type Scale is a subsection of Typography, so this header has to be
  // emitted whenever there are sizes — even with no families. A site whose
  // font-family is set through a variable parses as zero fonts, and skipping
  // the section took its whole type scale with it.
  if (found.fonts.length || sizes.length) {
    lines.push("## Tokens — Typography", "");
    found.fonts.slice(0, 3).forEach((font, i) => {
      const role =
        i === 0
          ? "Primary typeface observed on the page"
          : i === 1
            ? "Secondary typeface observed on the page"
            : "Third typeface observed on the page";
      lines.push(
        `### ${font.name} — ${role}. · \`--font-${slug(font.name)}\``,
        // The substitute is what a reader can actually load. Where the real
        // face has no free counterpart it repeats the name, which is honest:
        // the system says what it saw and what you can use instead.
        `- **Substitute:** ${font.substitute}`,
        `- **Weights:** ${(found.weights.length ? found.weights : [400, 500, 700]).join(", ")}`,
        `- **Sizes:** ${(sizes.length ? sizes : [16]).map((n) => `${n}px`).join(", ")}`,
        "",
      );
    });
  }

  if (sizes.length) {
    lines.push(
      "### Type Scale",
      "",
      "| Role | Size | Line Height | Letter Spacing | Token |",
      "|------|------|-------------|----------------|-------|",
      ...sizes.map((n, i) => {
        const role = TYPE_ROLES[i] ?? `size-${i + 1}`;
        // Use a line height and tracking the page actually states. Larger text
        // gets the tightest observed ratio, body text the roomiest — which is
        // how type scales behave — rather than one invented multiplier.
        const ratios = found.lineHeights
          .map((v) => (/^[\d.]+$/.test(v) ? Number(v) : null))
          .filter((v): v is number => v !== null && v >= 1 && v <= 2.2)
          .sort((a, b) => b - a);
        const ratio = ratios.length
          ? ratios[Math.min(Math.floor((i / Math.max(sizes.length - 1, 1)) * ratios.length), ratios.length - 1)]
          : 1.5;
        const tracking = n >= 32 ? (found.letterSpacings[0] ?? "0px") : "0px";
        return `| ${role} | ${n}px | ${Math.round(n * ratio)} | ${tracking} | \`--text-${role}\` |`;
      }),
      "",
    );
  }

  lines.push(
    "## Tokens — Spacing & Shapes",
    "",
    `**Base unit:** ${spacing[0] ?? 4}px`,
    "",
    "**Density:** comfortable",
    "",
  );

  if (spacing.length) {
    lines.push(
      "### Spacing Scale",
      "",
      "| Name | Value | Token |",
      "|------|-------|-------|",
      ...spacing.map(
        (n, i) => `| ${SPACING_NAMES[i] ?? `s${i}`} | ${n}px | \`--space-${SPACING_NAMES[i] ?? `s${i}`}\` |`,
      ),
      "",
    );
  }

  if (radii.length) {
    lines.push(
      "### Border Radius",
      "",
      "| Element | Value |",
      "|---------|-------|",
      ...radii.map((n, i) => `| ${["Small", "Control", "Card", "Panel", "Pill"][i] ?? `Radius ${i + 1}`} | ${n}px |`),
      "",
    );
  }

  if (found.borderWidths.length) {
    lines.push(
      "### Border Widths",
      "",
      found.borderWidths.map((n) => `${n}px`).join(" · "),
      "",
      "The hairline is the first value — it is what most of the interface uses",
      "to separate one surface from another.",
      "",
    );
  }

  if (found.shadows.length) {
    lines.push(
      "### Elevation",
      "",
      "Observed shadows, most used first. Level 1 is the one the interface",
      "reaches for; anything deeper is reserved for something that floats.",
      "",
      ...found.shadows.map((sh, i) => `${i + 1}. \`${sh}\``),
      "",
    );
  }

  const layoutRows: string[] = [];
  if (found.containers.length) {
    layoutRows.push(`| Content width | ${found.containers[found.containers.length - 1]}px |`);
    layoutRows.push(`| Narrow width | ${found.containers[0]}px |`);
  }
  if (found.breakpoints.length) {
    found.breakpoints.forEach((bp, i) => {
      const name = ["Small", "Medium", "Large", "X-Large", "2X-Large", "3X-Large"][i] ?? `Breakpoint ${i + 1}`;
      layoutRows.push(`| ${name} breakpoint | ${bp}px |`);
    });
  }
  if (spacing.length) {
    layoutRows.push(`| Base spacing unit | ${spacing[0]}px |`);
  }
  if (layoutRows.length) {
    lines.push("### Layout", "", "| Label | Value |", "|-------|-------|", ...layoutRows, "");
  }

  // Components, read off the rendered page. Absent when no browser was
  // available — a system with no components is honest; inventing them is not.
  if (found.components.length) {
    lines.push("## Components", "");
    for (const c of found.components) {
      lines.push(
        `### ${c.name}`,
        `**Role:** ${c.role}`,
        "",
        `${c.spec}${c.count > 1 ? ` Used ${c.count} times on the captured page.` : ""}`,
        "",
      );
    }
  }

  // Surfaces: the light end of the palette, ordered. These are the planes a
  // page is built from, and naming them is most of what "surface" means.
  const surfaceCandidates = colors
    .filter((c) => luminance(c.value) > 0.55)
    .slice(0, 4);
  if (surfaceCandidates.length) {
    lines.push(
      "## Surfaces",
      "",
      "| Level | Name | Value | Purpose |",
      "|-------|------|-------|---------|",
      ...surfaceCandidates.map((c, i) => {
        const purpose =
          i === 0
            ? "The page itself"
            : i === 1
              ? "Cards and raised panels"
              : "Alternating bands and hover states";
        return `| ${i} | ${c.name} | \`${c.value}\` | ${purpose} |`;
      }),
      "",
    );
  }

  // Imagery: for some brands the gradient *is* the visual language, so it
  // belongs here rather than being discarded as decoration.
  const imagery: string[] = [];
  if (found.gradients.length) {
    imagery.push(
      `${host} uses gradients as part of its visual language. Observed:`,
      "",
      ...found.gradients.map((g) => `- \`${g}\``),
      "",
      "These were read from the page. Whether they belong in your system is a",
      "decision — a gradient carried over without its context usually reads as",
      "borrowed rather than owned.",
    );
  } else {
    imagery.push(
      `No gradients were found on ${host}; its imagery is flat colour and`,
      "photography. Nothing else about image treatment is recorded in CSS, so",
      "this section is yours to write.",
    );
  }
  lines.push("## Imagery", "", ...imagery, "");

  // Layout prose, from the breakpoints and containers actually declared.
  const layoutProse: string[] = [];
  if (found.containers.length) {
    layoutProse.push(
      `Content is constrained to ${found.containers[found.containers.length - 1]}px at its widest,` +
        ` with a narrower ${found.containers[0]}px measure for denser passages.`,
    );
  }
  if (found.breakpoints.length) {
    layoutProse.push(
      `The page responds at ${found.breakpoints.map((b) => `${b}px`).join(", ")}.` +
        ` The first is where the layout stops being a single column.`,
    );
  }
  if (found.easings.length || found.durations.length) {
    const parts: string[] = [];
    if (found.durations.length) parts.push(`durations of ${found.durations.join(", ")}`);
    if (found.easings.length) parts.push(`easing \`${found.easings[0]}\``);
    layoutProse.push(`Motion is consistent: ${parts.join(", ")}.`);
  }
  if (layoutProse.length) lines.push("## Layout", "", layoutProse.join(" "), "");

  // No Components and no Capabilities section on purpose: a page's CSS says
  // nothing about which components a team maintains or which patterns they
  // have ruled out, and inventing either would make the system look decided
  // when it is not.
  const dos: string[] = [
    `Use the tokens above rather than the raw values — they were read from ${host}, and renaming them is how they become yours.`,
    "Replace the observed role labels with what each colour is actually for in your product.",
  ];
  if (found.borderWidths.length) {
    dos.push(
      `Separate surfaces with the ${found.borderWidths[0]}px hairline before reaching for elevation — it is what this page uses most.`,
    );
  }
  if (found.easings.length) {
    dos.push(
      `Use \`${found.easings[0]}\` for motion. One easing across a product is what makes it feel like one product.`,
    );
  }

  const donts: string[] = [
    "Do not treat this as a finished design system. It records what one page does, not what your team has decided.",
    "Do not add colours outside the palette without deciding what they are for first.",
  ];
  if (sizes.length) {
    donts.push(
      `Do not use type sizes outside the scale. Intermediate sizes flatten the hierarchy the scale exists to create.`,
    );
  }
  if (spacing.length) {
    donts.push(
      `Do not use spacing outside the scale — off-scale gaps are what make a page feel accidental.`,
    );
  }

  lines.push(
    "## Do's and Don'ts",
    "",
    "### Do",
    ...dos.map((d) => `- ${d}`),
    "",
    "### Don't",
    ...donts.map((d) => `- ${d}`),
    "",
    "## Agent Prompt Guide",
    "",
    "- This system was captured, not authored. If a value looks wrong, say so rather than building on it.",
    "- Every colour, size, space and radius must come from a table above. If the value you want is not there, ask.",
    "- There are no components defined yet, so do not claim one exists. Ask before introducing a new pattern.",
    found.shadows.length
      ? "- Elevation is listed in order of use. Reach for level 1; anything deeper needs a reason."
      : "- No shadows were observed. Separate surfaces with borders and space.",
    "",
    "## Similar Brands",
    "",
    `Read as ${host} reads. The palette, type scale and spacing above are that`,
    "site's; the composition and voice are not recorded in CSS and remain yours.",
    "",
  );

  return { markdown: lines.join("\n"), title };
}
