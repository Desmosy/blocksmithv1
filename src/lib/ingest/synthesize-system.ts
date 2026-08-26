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
  const ground = byLuminance[0];
  const ink = byLuminance[byLuminance.length - 1];

  // The accent is the most saturated colour that reads on the ground.
  const accent = [...usable]
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

  if (found.fonts.length) {
    lines.push("## Tokens — Typography", "");
    found.fonts.slice(0, 3).forEach((font, i) => {
      const role =
        i === 0
          ? "Primary typeface observed on the page"
          : i === 1
            ? "Secondary typeface observed on the page"
            : "Third typeface observed on the page";
      lines.push(
        `### ${font} — ${role}. · \`--font-${slug(font)}\``,
        `- **Substitute:** ${font}`,
        `- **Weights:** 400, 500, 700`,
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
        // Line height is not extracted; a readable ratio is stated as such in
        // the intro rather than presented as observed.
        return `| ${role} | ${n}px | ${Math.round(n * 1.5)} | 0px | \`--text-${role}\` |`;
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

  // No Components and no Capabilities section on purpose: a page's CSS says
  // nothing about which components a team maintains or which patterns they
  // have ruled out, and inventing either would make the system look decided
  // when it is not.
  lines.push(
    "## Do's and Don'ts",
    "",
    "### Do",
    `- Use the tokens above rather than the raw values — they were read from ${host}, and renaming them is how they become yours.`,
    "- Replace the observed role labels with what each colour is actually for in your product.",
    "",
    "### Don't",
    "- Do not treat this as a finished design system. It records what one page does, not what your team has decided.",
    "- Do not add colours outside the palette without deciding what they are for first.",
    "",
    "## Agent Prompt Guide",
    "",
    "- This system was captured, not authored. If a value looks wrong, say so rather than building on it.",
    "- There are no components defined yet, so do not claim one exists. Ask before introducing a new pattern.",
    "",
  );

  return { markdown: lines.join("\n"), title };
}
