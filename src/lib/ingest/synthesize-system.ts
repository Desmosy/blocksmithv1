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
 * Chroma is max(r,g,b) − min(r,g,b). Tuned against real sites: Stripe's
 * #32325d navy text sits at 43 and must not qualify, while its #533afd indigo
 * at 195 must.
 *
 * This was 100, which admitted every loud brand — Stripe at 195, Spotify's
 * green at 156 — and rejected the muted ones that are just as deliberate.
 * saucelabs.com is built on #abe082, chroma 94: it missed by six, so the whole
 * site was published with no accent at all, and an agent given that palette
 * cannot make anything stand out because nothing in the system does.
 *
 * 70 is the line between a colour a brand chose and a wash over a neutral. It
 * still keeps out Stripe's navy at 43, Sauce Labs' own pale olive at 65 and
 * its 53 background tint, while admitting the muted greens, sages and clays a
 * lot of current brands are actually built on.
 */
const ACCENT_MIN_CHROMA = 70;
/**
 * How much a colour must be used before it can be called the accent.
 *
 * Chroma alone is not enough. elevenlabs.io's most chromatic colour appears 8
 * times in 10,105 swatch hits — 0.12% — and was being published as
 * "Interactive elements: links and primary actions" on a site whose buttons
 * are black. Stripe's real indigo sits at 35 hits (0.55%) and Linear's at 112
 * (1.58%), so a floor between them keeps genuine accents and drops noise.
 *
 * Both bars must clear: the ratio handles pages of any size, the absolute
 * count stops a nearly-empty page promoting a single stray pixel.
 */
const ACCENT_MIN_SHARE = 0.0025;
const ACCENT_MIN_COUNT = 10;

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
/**
 * Warm, cool, or neutral — by which channel leads.
 *
 * A palette's character lives here. #f5f3f1 and #f1f3f5 are the same distance
 * from white and read completely differently: one is paper, the other is ice.
 * Naming both "Neutral 3" throws that away, and it is the part a designer
 * notices first.
 */
function temperature(hex: string): "warm" | "cool" | "neutral" {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  // Under a few units apart it is a true grey; naming it warm would be a lie.
  if (spread < 4) return "neutral";
  if (r >= b + 3) return "warm";
  if (b >= r + 3) return "cool";
  return "neutral";
}

/**
 * The hue family a colour belongs to.
 *
 * Not every leftover is a neutral. A page's brand orange can miss the accent
 * bar on usage and still be vividly orange, and running it through the grey
 * vocabulary named #ff4704 "Smoke" — worse than the numbering it replaced,
 * because it reads as considered and is wrong.
 */
function hueName(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return "Grey";
  const d = max - min;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = Math.round(h * 60);
  if (h < 0) h += 360;

  if (h < 15 || h >= 345) return "Red";
  if (h < 40) return "Orange";
  if (h < 65) return "Amber";
  if (h < 80) return "Yellow";
  if (h < 150) return "Green";
  if (h < 190) return "Teal";
  if (h < 210) return "Cyan";
  if (h < 250) return "Blue";
  if (h < 275) return "Indigo";
  if (h < 300) return "Violet";
  if (h < 330) return "Magenta";
  return "Pink";
}

/**
 * A name for a neutral, from how light it is and which way it leans.
 *
 * Bands are set from measured values rather than an even split, because
 * relative luminance bunches light colours together: a page's near-whites sit
 * at .97, .90 and .81 and are three distinct surfaces to a designer.
 *
 * Temperature only picks the word at the light end, where it is visible.
 * Below roughly a third brightness nobody calls a grey "warm" — #777169 is
 * Smoke and #44403b is Graphite whichever way they lean — so the last two
 * bands use one vocabulary and stop pretending to a distinction the eye
 * cannot make.
 */
function neutralName(hex: string): string {
  const l = luminance(hex);
  const band =
    l >= 0.93 ? 0 : l >= 0.85 ? 1 : l >= 0.7 ? 2 : l >= 0.3 ? 3 : l >= 0.1 ? 4 : 5;

  if (band >= 4) return band === 4 ? "Smoke" : "Graphite";

  const words: Record<"warm" | "cool" | "neutral", string[]> = {
    warm: ["Eggshell", "Linen", "Taupe", "Clay"],
    cool: ["Frost", "Mist", "Stone", "Slate"],
    neutral: ["Paper", "Chalk", "Silver", "Ash"],
  };
  return words[temperature(hex)][band];
}

/**
 * A role from where the colour was painted, not from its position in a list.
 *
 * The census tags each colour with what used it most — a card fill, body
 * text, an SVG mark, a border. "Observed on the page 40 time(s)" told an
 * agent nothing; "Body and secondary text" is a decision it can follow.
 */
function inferredRole(
  c: { value: string; count: number; src?: string },
): string | null {
  const l = luminance(c.value);
  switch (c.src) {
    case "border":
      return "Hairline borders and separators";
    case "svg":
      return l < 0.35 ? "Logo and icon fills" : "Illustration and artwork fills";
    case "text":
      return l < 0.35
        ? "Body and secondary text"
        : l < 0.7
          ? "Muted text and captions"
          : "Text on dark fills";
    case "fill":
      return l > 0.9
        ? "Raised surfaces and cards"
        : l > 0.7
          ? "Tinted bands and hover fills"
          : l < 0.25
            ? "Dark fills and inverted panels"
            : "Mid-tone fills";
    default:
      return null;
  }
}

function nameColors(colors: { value: string; count: number; src?: string }[]): Named[] {
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
  const mostUsed = Math.max(1, ...usable.map((c) => c.count));
  const usedEnough = (c: { count: number }) =>
    c.count >= ACCENT_MIN_COUNT && c.count / mostUsed >= ACCENT_MIN_SHARE;

  /**
   * An accent has to be visible against the page and able to carry a label.
   *
   * This asked for 3:1 against the ground, which is the rule for text *on* the
   * ground — and an accent is usually a fill with a label on top of it. On a
   * near-white page a bright brand colour scores about 1.7 and was thrown out
   * every time: green, lime, cyan, yellow, most of what modern brands actually
   * use. saucelabs.com came back with nine neutrals and no accent at all, and
   * an agent given that palette cannot build anything that stands out, because
   * nothing in the system does.
   *
   * So: distinct enough from the ground to read as a colour, and legible with
   * either dark or light text on it. A bright green passes on ink; a deep
   * indigo passes on white; a near-ground tint passes on neither.
   */
  const carriesText = (hex: string) =>
    contrast(hex, ink.value) >= 3 || contrast(hex, "#ffffff") >= 3;

  const accentCandidates = usable
    .filter((c) => c.value !== ground.value && c.value !== ink.value)
    .filter((c) => chroma(c.value) >= ACCENT_MIN_CHROMA)
    .filter((c) => contrast(c.value, ground.value) >= 1.2 && carriesText(c.value))
    .filter(usedEnough);

  // No fallback to "most saturated thing there is". A page can genuinely have
  // no accent — a monochrome system carries interaction on its ink — and
  // saying so is more useful than nominating the most colourful stray pixel
  // and telling an agent to build links out of it.
  const accent = [...accentCandidates].sort((a, b) => b.count - a.count)[0];

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

  /**
   * The rest of the palette, capped so it stays a palette rather than a dump.
   *
   * This took the seven lightest, which is the same mistake the type scale
   * made: sort on one axis, keep the head, lose everything at the other end.
   * A page's second brand colour — a dark green, a deep red — sat below seven
   * off-whites and never appeared. Colours that are plainly colours are kept
   * first, by how much the page uses them; the neutrals then fill what is left,
   * spread from light to dark rather than taken from the top.
   */
  const claimed = new Set(out.map((c) => c.value));
  const remaining = byLuminance.filter((c) => !claimed.has(c.value));
  const REST_MAX = 7;

  const chromatics = remaining
    .filter((c) => chroma(c.value) >= ACCENT_MIN_CHROMA)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  const chromaticSet = new Set(chromatics.map((c) => c.value));

  let neutrals = remaining.filter((c) => !chromaticSet.has(c.value));
  const neutralSlots = Math.max(0, REST_MAX - chromatics.length);
  // When there are more neutrals than slots, the ones seen a couple of times
  // are measurement noise — a 2-use grey must not take a slot from the
  // hairline or the text colour. Structural colours (borders, text) stay
  // regardless of count; a border colour never covers area, so its count is
  // honest and small.
  if (neutrals.length > neutralSlots) {
    const substantial = neutrals.filter(
      (c) => c.count >= 3 || c.src === "border" || c.src === "text",
    );
    if (substantial.length >= Math.min(neutralSlots, 3)) neutrals = substantial;
  }
  const spread: typeof neutrals = [];
  if (neutrals.length <= neutralSlots) {
    spread.push(...neutrals);
  } else if (neutralSlots > 0) {
    // Structural colours first: the hairline and the text greys are tokens a
    // page cannot be rebuilt without, and an even spread across the luminance
    // ramp was happy to skip them for a decorative near-white.
    for (const c of neutrals) {
      if ((c.src === "border" || c.src === "text") && spread.length < neutralSlots) spread.push(c);
    }
    const rest = neutrals.filter((c) => !spread.includes(c));
    const slots = neutralSlots - spread.length;
    const step = (rest.length - 1) / Math.max(1, slots - 1);
    for (let i = 0; i < slots; i += 1) {
      const pick = rest[Math.round(i * step)];
      if (pick && !spread.includes(pick)) spread.push(pick);
    }
  }

  // Back into light-to-dark order so the table still reads as a ramp.
  const rest = [...chromatics, ...spread].sort(
    (a, b) => luminance(b.value) - luminance(a.value),
  );

  // Name each neutral for what it is. Two colours can legitimately land on the
  // same word — a page often carries several near-whites — so a repeat is
  // numbered rather than renamed, which keeps the first one's name stable.
  const usedNames = new Map<string, number>();
  rest.forEach((c) => {
    // A colour that is plainly a colour gets a colour's name and a role that
    // says where it belongs. These are the ones a page uses in artwork and
    // illustration — they missed the accent bar on usage, which is the
    // evidence that they are not carrying interaction.
    const chromatic = chroma(c.value) >= ACCENT_MIN_CHROMA;
    const base = chromatic ? hueName(c.value) : neutralName(c.value);
    const seen = usedNames.get(base) ?? 0;
    usedNames.set(base, seen + 1);
    out.push({
      name: seen ? `${base} ${seen + 1}` : base,
      value: c.value,
      role: chromatic
        ? `Decorative — seen ${c.count} time(s), in artwork rather than UI chrome`
        : inferredRole(c) ?? `Observed on the page ${c.count} time(s)`,
    });
  });
  return out;
}

/** Ascending, de-duplicated, and capped — a scale, not a list of every value. */
/**
 * A scale is a range, not a prefix.
 *
 * This sorted ascending and kept the first `max` values — the *smallest* nine
 * of them. Every display size a page had was deleted: a site with 12 through
 * 72px was published as a system topping out at 32, and the same happened to
 * spacing, so its section rhythm went with it. An agent handed that builds a
 * settings screen and cannot do otherwise; there is no large type in the
 * system to build a hero from.
 *
 * Sub-8px values are dropped first. They are measurement artefacts — 6.79px is
 * a computed line box, not a decision anybody made — and they were consuming
 * the slots the display sizes needed.
 *
 * When there are still more values than fit, the ends are kept and the middle
 * is thinned evenly, so the scale keeps its span.
 */
function scale(values: number[], max: number, floor = 8): number[] {
  const clean = [...new Set(values.map((n) => Math.round(n * 10) / 10))]
    .filter((n) => n >= floor)
    .sort((a, b) => a - b);
  if (clean.length <= max) return clean;

  const kept = [clean[0]];
  // Evenly spaced picks across the interior, then the largest value last.
  const step = (clean.length - 1) / (max - 1);
  for (let i = 1; i < max - 1; i += 1) {
    const v = clean[Math.round(i * step)];
    if (v !== undefined && v !== kept[kept.length - 1]) kept.push(v);
  }
  const largest = clean[clean.length - 1];
  if (largest !== kept[kept.length - 1]) kept.push(largest);
  return kept;
}

const SPACING_NAMES = ["2xs", "xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl"];

/**
 * A role from the size itself, not from its position in the list.
 *
 * Positional names meant a page whose smallest measured size was 14px called
 * it "meta" and its 56px hero "body" — and an agent asked for body text set
 * it at 56px. 16px is body wherever it falls in the list.
 */
function typeRoleFor(n: number): string {
  if (n <= 12) return "meta";
  if (n <= 13.5) return "caption";
  if (n <= 15) return "body-sm";
  if (n <= 18) return "body";
  if (n <= 22) return "body-lg";
  if (n <= 30) return "subheading";
  if (n <= 42) return "heading";
  if (n <= 58) return "heading-lg";
  return "display";
}

function typeRoles(sizes: number[]): string[] {
  const used = new Map<string, number>();
  return sizes.map((n) => {
    const base = typeRoleFor(n);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    return seen ? `${base}-${seen + 1}` : base;
  });
}

export function synthesizeDesignSystem(found: Extracted): {
  markdown: string;
  title: string;
  /** What was measured, for the judgement pass to reason over. */
  facts: import("./rationale").CaptureFacts;
} {
  const host = (() => {
    try {
      return new URL(found.url).hostname.replace(/^www\./, "");
    } catch {
      return "captured";
    }
  })();

  // A page's <title> is often a sentence ("Enterprise AI: Private, Secure,
  // Customizable"), not a name. Prefer the short segment that names the host;
  // otherwise the host itself, which is at least the brand.
  const brand = host.replace(/^www\./, "").split(".")[0];
  const segments = (found.title ?? "").split(/[|·—–:]/).map((s) => s.trim()).filter(Boolean);
  const named = segments.find((s) => s.split(/\s+/).length <= 3 && s.toLowerCase().includes(brand.toLowerCase()));
  const short = segments.find((s) => s.split(/\s+/).length <= 3);
  const title = named ?? short ?? (brand ? brand[0].toUpperCase() + brand.slice(1) : host);
  const colors = nameColors(found.colors);

  /**
   * The site's own names for the values we captured.
   *
   * A page that says `var(--color-primary)` has already named its accent;
   * publishing our invented "Accent" while discarding theirs loses the most
   * durable fact a capture can carry. Where a resolved custom property lands
   * on a captured value, the doc says both names.
   */
  const varsByHex = new Map<string, string[]>();
  const varsByPx = new Map<number, string[]>();
  for (const v of found.siteVars) {
    if (v.hex) {
      const arr = varsByHex.get(v.hex) ?? [];
      if (arr.length < 4) arr.push(v.name);
      varsByHex.set(v.hex, arr);
    }
    const px = v.value.match(/^(\d+(?:\.\d+)?)px$/);
    if (px) {
      const n = Math.round(Number(px[1]));
      const arr = varsByPx.get(n) ?? [];
      if (arr.length < 4) arr.push(v.name);
      varsByPx.set(n, arr);
    }
  }
  /** The canonical-looking name: the shortest one that maps to the value. */
  const siteNameFor = (hex: string): string | null => {
    const names = varsByHex.get(hex.toLowerCase());
    if (!names?.length) return null;
    return [...names].sort((a, b) => a.length - b.length)[0];
  };
  const siteNameForPx = (n: number): string | null => {
    const names = varsByPx.get(n);
    if (!names?.length) return null;
    return [...names].sort((a, b) => a.length - b.length)[0];
  };

  /**
   * Chart series colours, from the system itself.
   *
   * Charts are where a generated page most easily goes off-system: an agent
   * reaches for a chart library and gets its default rainbow. The ladder
   * below is the palette re-ordered for data — darkest first, because in a
   * designed chart importance is carried by darkness, not by hue — so a
   * dashboard drawn from these tokens looks like the site it came from.
   */
  const chartLadder = (() => {
    const out: string[] = [];
    const pool = colors
      .filter((c) => c.name !== "Ground" && c.name !== "Accent")
      .filter((c) => luminance(c.value) <= 0.82)
      .sort((a, b) => luminance(a.value) - luminance(b.value));
    for (const c of pool) {
      if (!out.includes(c.value)) out.push(c.value);
      if (out.length >= 6) break;
    }
    return out;
  })();
  const accentColor = colors.find((c) => c.name === "Accent")?.value;
  // Floors differ by what the values are. 6.79px is not a type size, but 4px
  // is a real spacing step and 2px is a real radius.
  const spacing = scale(found.spacing, 9, 2);
  // Sizes from the census where there is one: what the page set its text in,
  // with one-off oddities dropped — except at the top, where a display size
  // used once on the hero is the most deliberate value on the page.
  const sampleShareBySize = new Map<number, number>();
  for (const s of found.typeSamples) {
    sampleShareBySize.set(s.size, (sampleShareBySize.get(s.size) ?? 0) + s.share);
  }
  const sizeCandidates = found.typeSamples.length
    ? [...sampleShareBySize.entries()]
        .filter(([n, share]) => share >= 0.004 || n >= 28)
        .map(([n]) => n)
    : found.fontSizes;
  const sizes = scale(sizeCandidates, 9, 8);
  const radii = scale(found.radii, 5, 1);

  /** The heaviest-used sample at a given size — its line height and tracking. */
  const dominantAt = (n: number) =>
    found.typeSamples
      .filter((s) => Math.abs(s.size - n) <= 0.5)
      .sort((a, b) => b.share - a.share)[0];
  /** Census rows for one family, for per-face weights and sizes. */
  const samplesFor = (name: string) =>
    found.typeSamples.filter((s) => s.family.toLowerCase() === name.toLowerCase());

  const lines: string[] = [
    `# ${title} — Style Reference`,
    `> Captured from ${host}. Observed values, not a finished system.`,
    "",
    "**Theme:** light",
    "",
    // Say it before anything else: a capture of a bot-served page is not a
    // capture of the brand, and every table below inherits that doubt.
    ...(found.degraded
      ? [
          `> ⚠️ **Treat this capture with suspicion:** ${found.degraded}.`,
          "> Try a different page on the same site, or capture a screenshot",
          "> with the browser extension to read what you actually see.",
          "",
        ]
      : []),
    found.readFrom === "rendered"
      ? `This design system was read from ${found.url} as it renders. Colours are` +
        ` ranked by how much of the screen they actually cover, type and spacing` +
        ` by what the page applies, and the components below were measured from` +
        ` real elements — their fills, radii and padding are what you would find` +
        ` in the browser. Roles are inferred: the most-painted neutral is the` +
        ` ground, the darkest heavily-used colour is the ink, and the accent is` +
        ` the most-used colour saturated enough to be one. Nothing here records` +
        ` *why* any choice was made, because a rendered page does not say.` +
        ` Rename the tokens and add your own rules before treating this as` +
        ` governing.`
      : `This design system was read from the CSS of ${found.url}, without` +
        ` rendering it. Colours, type sizes, spacing and radii are what the` +
        ` stylesheet mentions — not necessarily what the page paints — and there` +
        ` are no components, because those can only be measured from real` +
        ` elements. Treat this as the thinner of the two captures: useful as a` +
        ` starting point, and worth re-capturing somewhere with a browser.`,
    "",
  ];

  if (colors.length) {
    lines.push(
      "## Tokens — Colors",
      "",
      "| Name | Value | Token | Role |",
      "|------|-------|-------|------|",
      ...colors.map((c) => {
        const own = siteNameFor(c.value);
        const role = own ? `${c.role} · the site names it \`${own}\`` : c.role;
        return `| ${c.name} | \`${c.value}\` | \`--color-${slug(c.name)}\` | ${role} |`;
      }),
      "",
    );

    /**
     * Dark mode, as the OS would request it.
     *
     * When emulating prefers-color-scheme: dark changed the site's own
     * custom properties, the diff IS the dark palette — measured, not
     * inferred. Rows pair each captured colour with what its site token
     * becomes in the dark; the two-column body ground/ink lead because they
     * are what a dark build reaches for first.
     */
    if (found.darkMode) {
      const darkByName = new Map(found.darkMode.vars.map((v) => [v.name, v.hex] as const));
      const rows: string[] = [];
      if (found.darkMode.bodyBg) {
        rows.push(`| Page ground | \`${colors.find((c) => c.name === "Ground")?.value ?? "—"}\` | \`${found.darkMode.bodyBg}\` |`);
      }
      if (found.darkMode.bodyFg) {
        rows.push(`| Body text | \`${colors.find((c) => c.name === "Ink")?.value ?? "—"}\` | \`${found.darkMode.bodyFg}\` |`);
      }
      for (const c of colors) {
        const own = siteNameFor(c.value);
        if (!own) continue;
        const dark = darkByName.get(own);
        if (!dark || dark === c.value) continue;
        rows.push(`| ${c.name} (\`${own}\`) | \`${c.value}\` | \`${dark}\` |`);
        if (rows.length >= 12) break;
      }
      if (rows.length >= 2) {
        lines.push(
          "### Dark mode — measured under `prefers-color-scheme: dark`",
          "",
          "The site themes through its custom properties; these values were",
          "resolved with the dark scheme emulated, not guessed.",
          "",
          "| Token | Light | Dark |",
          "|-------|-------|------|",
          ...rows,
          "",
        );
      }
    }
  }

  // The Type Scale is a subsection of Typography, so this header has to be
  // emitted whenever there are sizes — even with no families. A site whose
  // font-family is set through a variable parses as zero fonts, and skipping
  // the section took its whole type scale with it.
  if (found.fonts.length || sizes.length) {
    lines.push("## Tokens — Typography", "");
    found.fonts.slice(0, 3).forEach((font, i) => {
      const mono = /mono|code/i.test(font.name);
      const role = mono
        ? "Monospace face for labels, code and metadata"
        : i === 0
          ? "Primary typeface observed on the page"
          : i === 1
            ? "Secondary typeface observed on the page"
            : "Third typeface observed on the page";
      // Weights and sizes for *this* face, from the census. The stylesheet
      // route declared every weight a variable font supports — nine of them —
      // for every family on the page, which is a fabrication an agent then
      // builds with.
      const own = samplesFor(font.name);
      const ownWeights = [...new Set(own.map((s) => s.weight))].sort((a, b) => a - b).slice(0, 6);
      const ownSizes = [...new Set(own.map((s) => s.size))]
        .filter((n) => n >= 8)
        .sort((a, b) => a - b)
        .slice(0, 10);
      const weights = ownWeights.length
        ? ownWeights
        : found.weights.length
          ? found.weights
          : [400, 500, 700];
      const faceSizes = ownSizes.length ? ownSizes : sizes.length ? sizes : [16];
      lines.push(
        `### ${font.name} — ${role}. · \`--font-${slug(font.name)}\``,
        // The substitute is what a reader can actually load. Where the real
        // face has no free counterpart it repeats the name, which is honest:
        // the system says what it saw and what you can use instead.
        `- **Substitute:** ${font.substitute}`,
        `- **Weights:** ${weights.join(", ")}`,
        `- **Sizes:** ${faceSizes.map((n) => `${n}px`).join(", ")}`,
        "",
      );
    });
  }

  const roleNames = typeRoles(sizes);
  if (sizes.length) {
    lines.push(
      "### Type Scale",
      "",
      "| Role | Size | Line Height | Letter Spacing | Token |",
      "|------|------|-------------|----------------|-------|",
      ...sizes.map((n, i) => {
        const role = roleNames[i];
        // Measured, where the page was rendered: the line height and tracking
        // of the text most set at this size. A 64px hero at line-height 1 and
        // -3.8px tracking is the system's whole voice; a distribution guess
        // gave every size 1.5 and one tracking value, and pages built from
        // that read nothing like the site.
        const sample = dominantAt(n);
        if (sample && sample.lineHeight >= 0.8 && sample.lineHeight <= 2.5) {
          return `| ${role} | ${n}px | ${sample.lineHeight} | ${sample.letterSpacing} | \`--text-${role}\` |`;
        }
        const ratios = found.lineHeights
          .map((v) => (/^[\d.]+$/.test(v) ? Number(v) : null))
          .filter((v): v is number => v !== null && v >= 1 && v <= 2.2)
          .sort((a, b) => b - a);
        const ratio = ratios.length
          ? ratios[Math.min(Math.floor((i / Math.max(sizes.length - 1, 1)) * ratios.length), ratios.length - 1)]
          : 1.5;
        const tracking = n >= 32 ? (found.letterSpacings[0] ?? "0px") : "0px";
        return `| ${role} | ${n}px | ${ratio} | ${tracking} | \`--text-${role}\` |`;
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
    const owned = spacing
      .map((n) => ({ n, own: siteNameForPx(n) }))
      .filter((s): s is { n: number; own: string } => s.own !== null);
    if (owned.length >= 2) {
      lines.push(
        `The site's own names for these steps: ${owned.map((s) => `\`${s.own}\` = ${s.n}px`).join(" · ")}.`,
        "",
      );
    }
  }

  if (radii.length) {
    // "Pill" is a shape, not a position: only a radius that actually renders
    // as one gets the name. Calling the largest of five small radii "Pill"
    // told agents a 16px corner was a fully-rounded button.
    const radiusName = (n: number, i: number) =>
      n >= 999 ? "Pill" : ["Small", "Control", "Card", "Panel", "Large"][i] ?? `Radius ${i + 1}`;
    lines.push(
      "### Border Radius",
      "",
      "| Element | Value |",
      "|---------|-------|",
      ...radii.map((n, i) => `| ${radiusName(n, i)} | ${n}px |`),
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
  // A colour has to actually cover something to be a plane — a grey seen
  // twice is not "alternating bands", and publishing it as one taught agents
  // to build zebra-striped pages out of measurement noise.
  const countOf = new Map(found.colors.map((c) => [c.value, c.count] as const));
  const srcOf = new Map(found.colors.map((c) => [c.value, c.src] as const));
  const topFill = Math.max(1, ...found.colors.map((c) => c.count));
  const surfaceCandidates = colors
    .filter((c) => luminance(c.value) > 0.55)
    .filter(
      (c) =>
        c.name === "Ground" ||
        ((countOf.get(c.value) ?? 0) >= topFill * 0.01 &&
          (srcOf.get(c.value) ?? "fill") === "fill"),
    )
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
              : "Tinted bands and hover states";
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
  // Measured on elements, not declared in a stylesheet: how alive the page
  // actually is, and by which mechanism — so a generated page moves the same
  // way instead of arriving inert.
  if (found.motionCensus && (found.motionCensus.animated || found.motionCensus.transitions || found.motionCensus.staged)) {
    const m = found.motionCensus;
    const bits: string[] = [];
    if (m.animated) bits.push(`${m.animated} element(s) run CSS animations`);
    if (m.transitions) bits.push(`${m.transitions} transition transform or opacity`);
    if (m.staged) bits.push(`${m.staged} sit staged at opacity 0 awaiting a scroll entrance`);
    layoutProse.push(
      `Motion is real on this page: ${bits.join(", ")}. Pages built in this system should arrive the same way — content reveals on scroll, and interactive states transition.`,
    );
  }
  if (found.responsive) {
    const r = found.responsive;
    const desktopMax = found.typeSamples.length ? Math.max(...found.typeSamples.map((s) => s.size)) : null;
    const respBits: string[] = [
      r.cleanAt390
        ? "the page reflows with no horizontal overflow"
        : "the page overflows horizontally — treat that as the source's bug, not a pattern",
    ];
    if (r.displayPxAt390 && desktopMax && r.displayPxAt390 < desktopMax) {
      respBits.push(`display type steps down from ${desktopMax}px to ~${r.displayPxAt390}px`);
    }
    if (r.navCollapsed === true) respBits.push("the nav collapses to a menu control");
    else if (r.navCollapsed === false) respBits.push("the nav keeps its links visible");
    layoutProse.push(`Verified at a 390px viewport: ${respBits.join("; ")}.`);
  }
  if (layoutProse.length || found.anatomy) {
    lines.push("## Layout", "");
    if (layoutProse.length) lines.push(layoutProse.join(" "), "");
    /**
     * The composition, band by band. Tokens say what a page is made of;
     * this says how the source page is *built* — which is what stops every
     * generated landing page collapsing into the same stock template.
     */
    if (found.anatomy) {
      const a = found.anatomy;
      lines.push(
        `### Page anatomy — measured from ${host}`,
        "",
        `The captured page is ~${a.pageVh} viewports tall, composed as:`,
        "",
        ...a.bands.map((b, i) => {
          const surface =
            b.surface === "ground" ? "on the page ground" : b.surface === "dark" ? "inverted (dark surface)" : "on a tinted band";
          return `${i + 1}. **${b.role}** — ~${b.vh}vh, ${surface}; holds ${b.contents}.`;
        }),
        "",
        a.sectionGapPx !== null
          ? `Consecutive bands are separated by ~${a.sectionGapPx}px. Composition changes` +
            ` from band to band — height, surface, and layout all vary; that variation` +
            ` is the design, not an accident to normalise away.`
          : "Composition changes from band to band; that variation is the design.",
        "",
      );
    }
  }

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

  dos.push(
    "Build decorative graphics — orbs, gradients, ambient motion — as SVG, Canvas or shader code from the tokens above, so they re-theme and resize with the system.",
    "Icons are inline SVG on a 24px grid that inherit `currentColor`, sized 16–24px beside text. Use one icon family per page, from a free set: Lucide, Heroicons, Tabler, Feather or Iconsax need no credit.",
  );
  if (chartLadder.length >= 2) {
    dos.push(
      `Draw charts as inline SVG from the chart tokens, every label in the system's own typeface. Multi-series charts take \`--chart-1\` through \`--chart-${chartLadder.length}\` in order of importance — the most important series is the darkest. A single-series chart — a progress ring, one line, one bar — ${accentColor ? "takes `--chart-accent`, the colour the system uses for what matters" : "takes the ink"}. At most one hairline baseline per chart; never a graph-paper grid.`,
    );
  }
  const donts: string[] = [
    "Do not treat this as a finished design system. It records what one page does, not what your team has decided.",
    "Do not add colours outside the palette without deciding what they are for first.",
  ];
  donts.push(
    "Do not ship decorative artwork as PNG, JPEG or a generated image; raster files are for photography and screenshots only.",
    "Do not draw clip-art glyphs — stars, sparkles, bolts, blobs — and never let decoration overlap text or controls. Decoration sits behind or beside content, in hairline geometry at whisper contrast.",
    "Do not use an asset that requires attribution without its credit. A CC BY icon or illustration (for example Noun Project's free tier) must carry a visible \"<name> by <creator> — CC BY\" line in the page footer; if you will not write the credit, use a free set instead.",
  );
  if (chartLadder.length >= 2) {
    donts.push(
      "Do not use a chart library's default theme or palette; a chart that ignores the tokens is off-system even when the rest of the page is not.",
      "Do not present invented numbers as measurements. A demo chart says it is illustrative, keeps honest units and axes, and carries a source line whenever the data is real.",
      "Do not draw graph-paper grids — a mesh of ruled squares behind a chart, diagram or card. No SVG in this system carries one; a single hairline baseline is the most a chart gets.",
    );
  }
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
    found.components.length
      ? `- ${found.components.length} components were measured from the page and are listed above. Compose from those before introducing a new pattern.`
      : "- There are no components defined yet, so do not claim one exists. Ask before introducing a new pattern.",
    found.shadows.length
      ? "- Elevation is listed in order of use. Reach for level 1; anything deeper needs a reason."
      : "- No shadows were observed. Separate surfaces with borders and space.",
    ...(chartLadder.length >= 2
      ? [
          "- Charts are components of this system, not add-ons: multi-series charts walk the `--chart-*` ladder darkest-first; a single-series chart (progress ring, one line) takes `--chart-accent` when the system has one. Labels in the system's faces, at most one hairline baseline, no graph-paper grid. Say when data is illustrative.",
        ]
      : []),
    "",
    "## Similar Brands",
    "",
    `Read as ${host} reads. The palette, type scale and spacing above are that`,
    "site's; the composition and voice are not recorded in CSS and remain yours.",
    "",
  );

  /**
   * The tokens as something you can paste.
   *
   * Everything above is a table for a person to read. This is the same values
   * in a form a stylesheet accepts, so the step between "here is the system"
   * and "my project uses it" is a copy rather than an afternoon of transcribing
   * hexes — which is where a captured system usually dies.
   */
  const varLines: string[] = [];
  varLines.push("  /* Colours — trailing comments are the site's own names */");
  for (const c of colors) {
    const own = siteNameFor(c.value);
    varLines.push(`  --color-${slug(c.name)}: ${c.value};${own ? ` /* site: ${own} */` : ""}`);
  }
  if (chartLadder.length >= 2) {
    varLines.push("", "  /* Chart series — assign by importance; darkest carries the headline series */");
    chartLadder.forEach((v, i) => varLines.push(`  --chart-${i + 1}: ${v};`));
    if (accentColor) varLines.push(`  --chart-accent: ${accentColor};`);
  }
  if (found.fonts.length) {
    varLines.push("", "  /* Typefaces */");
    // The substitute is the fallback: a reader without the licensed face still
    // gets the right shape rather than the browser default. It is dropped when
    // it merely repeats the name, and the generic at the end has to match the
    // face — a mono falling back to sans-serif is a worse stack than none.
    for (const f of found.fonts.slice(0, 3)) {
      const generic = /mono/i.test(f.name)
        ? "monospace"
        : /serif/i.test(f.name) && !/sans/i.test(f.name)
          ? "serif"
          : "sans-serif";
      const stack = [`"${f.name}"`];
      if (f.substitute && f.substitute.toLowerCase() !== f.name.toLowerCase()) {
        stack.push(`"${f.substitute}"`);
      }
      stack.push(generic);
      varLines.push(`  --font-${slug(f.name)}: ${stack.join(", ")};`);
    }
  }
  if (spacing.length) {
    varLines.push("", "  /* Spacing */");
    spacing.forEach((n, i) => varLines.push(`  --space-${SPACING_NAMES[i] ?? `s${i}`}: ${n}px;`));
  }
  if (radii.length) {
    varLines.push("", "  /* Radii */");
    radii.forEach((n, i) =>
      varLines.push(`  --radius-${n >= 999 ? "pill" : (["sm", "control", "card", "panel", "lg"][i] ?? `r${i + 1}`)}: ${n}px;`),
    );
  }

  const block = varLines.join("\n");
  lines.push(
    "## Quick Start",
    "",
    "### CSS Custom Properties",
    "",
    "```css",
    ":root {",
    block,
    "}",
    "```",
    "",
    "### Tailwind v4",
    "",
    "Tailwind v4 reads the same custom properties, so the block is identical —",
    "`@theme` registers them as utilities (`bg-color-ground`, `p-space-md`).",
    "",
    "```css",
    "@theme {",
    block,
    "}",
    "```",
    "",
  );

  return {
    markdown: lines.join("\n"),
    title,
    facts: {
      title,
      host,
      colors: colors.map((c) => ({ name: c.name, value: c.value, role: c.role })),
      typefaces: found.fonts.slice(0, 3).map((f) => ({ name: f.name, substitute: f.substitute })),
      spacing,
      radii,
      components: found.components.map((c) => ({ name: c.name, role: c.role, spec: c.spec, count: c.count })),
    },
  };
}
