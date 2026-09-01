import type { DesignSystem } from "@/lib/blocks/types";

/**
 * What a system says about movement.
 *
 * Agents produce static pages because nothing ever tells them not to. Every
 * other part of a design system is written down — colour, spacing, type — and
 * motion is the one dimension left to the model's imagination, so it defaults
 * to none. A page built entirely from tokens can still be lifeless, and that is
 * a governance failure the linters cannot see.
 *
 * Capture already measures transition durations and easings off the live page
 * when the site declares them, and `synthesizeDesignSystem` writes them into
 * the document's prose. They are read back out here rather than being carried
 * on `DesignSystem`, because they are observations about a page, not tokens a
 * team has agreed on — and a measured `cubic-bezier` is a much better default
 * than one this file invents.
 */

export type MotionTokens = {
  durations: string[];
  easing: string;
  /** True when these came off the captured page rather than from defaults. */
  measured: boolean;
};

/** Web-standard defaults, used only when the document records nothing. */
const DEFAULT_DURATIONS = ["150ms", "250ms", "400ms"];
const DEFAULT_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

export function motionTokens(markdown: string): MotionTokens {
  // `Motion is consistent: durations of 150ms, 300ms, easing `cubic-bezier(…)`.`
  const durationLine = markdown.match(/durations? of ([^.\n]+)/i)?.[1] ?? "";
  const durations = [...durationLine.matchAll(/(\d+(?:\.\d+)?m?s)/g)]
    .map((m) => m[1])
    .slice(0, 4);
  const easing =
    markdown.match(/(cubic-bezier\([^)]{1,40}\))/i)?.[1] ??
    markdown.match(/easing[^`\n]*`([^`]+)`/i)?.[1] ??
    "";

  const measured = durations.length > 0 || easing.length > 0;
  return {
    durations: durations.length ? durations : DEFAULT_DURATIONS,
    easing: easing || DEFAULT_EASING,
    measured,
  };
}

/** One line for the in-page rules, which are capped at 1500 characters. */
export function motionOneLiner(markdown: string): string {
  const { durations, easing, measured } = motionTokens(markdown);
  return (
    `Motion: ${durations.slice(0, 3).join(" / ")}, ${easing}` +
    `${measured ? "" : " (defaults — this system records none)"}. ` +
    `Animate entrances on scroll with CSS animation-timeline, transition interactive ` +
    `states, and always honour prefers-reduced-motion.`
  );
}

/**
 * The full section for the skill file.
 *
 * Split deliberately by where the code will run. A proposal previewed on the
 * governance page renders without scripts — that is a security boundary, not an
 * oversight — so anything an agent wants a reviewer to *see* has to be CSS or
 * SVG. Libraries belong in the repository, where the code is real. Telling an
 * agent to reach for GSAP in a preview it cannot execute produces a page that
 * looks broken and a developer who thinks the tool is broken.
 */
export function motionSection(system: DesignSystem, markdown: string): string[] {
  const { durations, easing, measured } = motionTokens(markdown);
  const [fast, base, slow] = [
    durations[0] ?? DEFAULT_DURATIONS[0],
    durations[1] ?? durations[0] ?? DEFAULT_DURATIONS[1],
    durations[2] ?? durations[durations.length - 1] ?? DEFAULT_DURATIONS[2],
  ];

  return [
    "## Motion",
    "",
    measured
      ? `These are the durations and easing this page actually uses. Match them —` +
        ` one easing across a product is most of what makes it feel like one product.`
      : `${system.name} records no motion of its own, so these are web defaults.` +
        ` Use them consistently rather than picking a new number each time.`,
    "",
    `| Role | Value |`,
    `|------|-------|`,
    `| Interactive state — hover, focus, press | \`${fast}\` |`,
    `| Entrance, reveal, expand | \`${base}\` |`,
    `| Large or full-page movement | \`${slow}\` |`,
    `| Easing, everywhere | \`${easing}\` |`,
    "",
    "**A page built entirely from the right tokens can still be dead.** Movement is",
    "part of the system, not decoration added afterwards. Every page you build",
    "should have at least: interactive states that transition, and content that",
    "arrives rather than simply being there.",
    "",
    "### In a preview, or anywhere scripts do not run",
    "",
    "Governance previews render your markup with **no JavaScript** — that is a",
    "security boundary, since your output is third-party code to the page showing",
    "it. Inline SVG, CSS animation and CSS transitions all work. Canvas, WebGL and",
    "any library do not. So make the motion a reviewer sees CSS-driven:",
    "",
    "```css",
    "/* Scroll-driven reveal — real scroll linkage, no JavaScript at all. */",
    "@keyframes rise {",
    "  from { opacity: 0; transform: translateY(16px); }",
    "  to   { opacity: 1; transform: none; }",
    "}",
    ".reveal {",
    "  animation: rise linear both;",
    "  animation-timeline: view();",
    `  animation-range: entry 0% cover 30%;`,
    "}",
    "",
    "/* Interactive states carry the system's own timing. */",
    ".button {",
    `  transition: background-color ${fast} ${easing},`,
    `              transform ${fast} ${easing};`,
    "}",
    ".button:hover { transform: translateY(-1px); }",
    "",
    "/* Non-negotiable. Someone reading this has told their OS motion hurts. */",
    "@media (prefers-reduced-motion: reduce) {",
    "  *, *::before, *::after {",
    "    animation-duration: 0.01ms !important;",
    "    animation-iteration-count: 1 !important;",
    "    transition-duration: 0.01ms !important;",
    "    scroll-behavior: auto !important;",
    "  }",
    "}",
    "```",
    "",
    "`animation-timeline: view()` is the CSS answer to what people historically",
    "reached for GSAP ScrollTrigger to do. It is scroll-linked, it runs off the",
    "main thread, and it needs no library. Prefer it.",
    "",
    "The **Open full page** link beside a proposal runs your code for real, in a",
    "sandbox — so motion written with a library does play there, even though the",
    "small inline preview stays still. Build for both: CSS motion so the review",
    "card is alive, libraries where they earn their weight.",
    "",
    "### In a real project, where scripts do run",
    "",
    "Once the code is in a repository rather than a preview, use a library — but",
    "keep the durations and easing above, or the product stops feeling like one",
    "product.",
    "",
    "| Reach for | When |",
    "|-----------|------|",
    "| **CSS transitions / scroll-driven animations** | The default. Interactive states, reveals, parallax. No dependency, no main-thread cost |",
    "| **Framer Motion** (`motion/react`) | React components that enter and leave, shared-layout transitions, drag. Best when motion belongs to a component's state |",
    "| **GSAP** + ScrollTrigger | A sequence: several things moving in a deliberate order, pinned sections, timelines you need to scrub |",
    "| **Lenis** | Smooth scrolling as a page-wide feel. Pairs with either of the above; do not also hand-animate scroll position |",
    "",
    "```tsx",
    "// Framer Motion, using this system's timing rather than its defaults.",
    "import { motion } from \"motion/react\";",
    "",
    "<motion.section",
    "  initial={{ opacity: 0, y: 16 }}",
    "  whileInView={{ opacity: 1, y: 0 }}",
    "  viewport={{ once: true, margin: \"-15%\" }}",
    `  transition={{ duration: ${(parseFloat(base) || 250) / (base.endsWith("ms") ? 1000 : 1)}, ease: [0.4, 0, 0.2, 1] }}`,
    ">",
    "  …",
    "</motion.section>",
    "```",
    "",
    "### Rules",
    "",
    "- **Motion explains, it does not decorate.** If it does not help someone",
    "  understand what changed or what is now in front of them, remove it.",
    "- **One thing moves at a time.** Several elements animating on the same",
    "  trigger reads as a slideshow, not a product.",
    "- **Entrances happen once.** Content that re-animates every time it scrolls",
    "  back into view is the fastest way to make a page feel cheap.",
    "- **Never animate an unbounded loop** behind text someone is reading.",
    "- **Always ship the reduced-motion block.** It is four lines.",
    "",
  ];
}
