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
| Neutrals named `Neutral 1…7` rather than Warm Taupe, Stone, Smoke, Ash | open — values are right, names are not |
| No Shadows, Elevation, Imagery, Layout, Similar Brands, Quick Start | open — some already extracted, none emitted |
| Cards, dividers, nav bars, logo grids, visuals never detected | open — the collector only accepts control-shaped elements |
| No rationale: *why* a choice was made | open — not a heuristic; needs a model over the extracted data |
