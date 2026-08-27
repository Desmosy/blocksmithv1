# Capture quality — the bar to clear

`elevenlabs.hand-written.md` is what a person produced for elevenlabs.io after
spending real time on it. `elevenlabs.generated-before.md` is what capture
produced for the same page. Keeping both means the gap is measurable rather
than remembered.

What the comparison showed, and what came of it:

| Gap | Status |
|---|---|
| 9 of 12 components were `Text Link 2…9` — one link measured at nine sizes | fixed: components merge by what they are, not by exact pixels |
| The black primary button was labelled `Secondary Pill Button` | fixed: a page with no saturated fill treats dark as primary |
| Accent published as `#052f70`, used 8 times in 10,105 | fixed: an accent must be used enough to be one; elevenlabs is monochrome |
| Neutrals named `Neutral 1…7` rather than Warm Taupe, Stone, Smoke, Ash | fixed: named from lightness and warmth; chromatic leftovers named by hue and marked decorative |
| No Quick Start (tokens as CSS) | fixed: `:root` and Tailwind `@theme` blocks emitted |
| Cards, dividers, nav bars, logo grids, visuals never detected | fixed: broad taxonomy, composition patterns (nav bar, logo grid, card grid, tab group, footer), hairline census with alpha compositing, hover states |
| No rationale: *why* a choice was made | open — not a heuristic; needs a model over the extracted data |

## Measuring it

`npm run verify:capture` renders elevenlabs.io and scores the result against
the twelve components in the hand-written file. It reports hits out of twelve.
At the time of writing: **12/12**. Pass a URL to see what capture produces for
any other site; only elevenlabs has a hand-written answer to score against.

What the score cannot see: the prose rationale in the hand-written file —
*why* the pill is the signature, *why* the card sits flat. That is judgement,
not measurement, and it needs a model over the extracted data.
