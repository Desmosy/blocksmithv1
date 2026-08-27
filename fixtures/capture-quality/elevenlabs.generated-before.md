# Free AI Voice Generator & Voice Agents Platform

> Captured from elevenlabs.io. Observed values, not a finished system.

This design system was read from https://elevenlabs.io/ as it renders. Colours are ranked by how much of the screen they actually cover, type and spacing by what the page applies, and the components below were measured from real elements — their fills, radii and padding are what you would find in the browser. Roles are inferred: the most-painted neutral is the ground, the darkest heavily-used colour is the ink, and the accent is the most-used colour saturated enough to be one. Nothing here records *why* any choice was made, because a rendered page does not say. Rename the tokens and add your own rules before treating this as governing.

---

## Colors

| Name | Value | CSS Variable | Role |
|------|-------|-------------|------|
| Ground | #fdfcfc | `--color-ground` | Primary page background |
| Ink | #000000 | `--color-ink` | Primary text |
| Accent | #052f70 | `--color-accent` | Interactive elements — links and primary actions |
| Neutral 1 | #ffffff | `--color-neutral-1` | Observed on the page 691 time(s) |
| Neutral 2 | #faf8f8 | `--color-neutral-2` | Observed on the page 9 time(s) |
| Neutral 3 | #f5f3f1 | `--color-neutral-3` | Observed on the page 2748 time(s) |
| Neutral 4 | #efefef | `--color-neutral-4` | Observed on the page 16 time(s) |
| Neutral 5 | #ebe8e4 | `--color-neutral-5` | Observed on the page 3 time(s) |
| Neutral 6 | #a59f97 | `--color-neutral-6` | Observed on the page 7 time(s) |
| Neutral 7 | #ff4704 | `--color-neutral-7` | Observed on the page 2 time(s) |

## Typography

### Inter

Primary typeface observed on the page. · `--font-inter`

**Weights:** 100, 300, 400, 500, 600, 700
**Sizes:** 8px, 9px, 10px, 11px, 11.2px, 12px, 14px, 18px, 22px

### Waldenburg

Secondary typeface observed on the page. · `--font-waldenburg`

**Weights:** 100, 300, 400, 500, 600, 700
**Sizes:** 8px, 9px, 10px, 11px, 11.2px, 12px, 14px, 18px, 22px

### Geist Mono

Third typeface observed on the page. · `--font-geist-mono`

**Weights:** 100, 300, 400, 500, 600, 700
**Sizes:** 8px, 9px, 10px, 11px, 11.2px, 12px, 14px, 18px, 22px

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|------------|----------------|-------|
| meta | 8px | 8 | 0px | `--text-meta` |
| caption | 9px | 9 | 0px | `--text-caption` |
| body-sm | 10px | 10 | 0px | `--text-body-sm` |
| body | 11px | 11 | 0px | `--text-body` |
| body-lg | 11.2px | 11 | 0px | `--text-body-lg` |
| subheading | 12px | 12 | 0px | `--text-subheading` |
| heading | 14px | 14 | 0px | `--text-heading` |
| heading-lg | 18px | 18 | 0px | `--text-heading-lg` |
| display | 22px | 22 | 0px | `--text-display` |

## Spacing

| Name | Value | Token |
|------|-------|-------|
| 2xs | 1px | `--space-2xs` |
| xs | 2px | `--space-xs` |
| sm | 4px | `--space-sm` |
| md | 5px | `--space-md` |
| lg | 6px | `--space-lg` |
| xl | 9.6px | `--space-xl` |
| 2xl | 10px | `--space-2xl` |
| 3xl | 13px | `--space-3xl` |
| 4xl | 100px | `--space-4xl` |

### Border Radius

| Element | Value |
|---------|-------|
| Element | Value |
| Small | 5px |
| Control | 6px |
| Card | 10px |
| Panel | 14px |
| Pill | 20px |

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 0 | Ground | #fdfcfc | The page itself |
| 1 | Neutral 1 | #ffffff | Cards and raised panels |
| 2 | Neutral 2 | #faf8f8 | Alternating bands and hover states |
| 3 | Neutral 3 | #f5f3f1 | Alternating bands and hover states |

## Components

### Text Link

**Role:** Inline navigation

#ffffff fill, #000000 text, Inter at 16px weight 400, fully rounded, 0px 20px padding, height ~44px, shadow rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0. Used 9 times on the captured page.

### Text Link 2

**Role:** Inline navigation

Transparent fill, #000000 text, Inter at 17px weight 400, fully rounded, 0px 17px padding, height ~40px. Used 5 times on the captured page.

### Text Link 3

**Role:** Inline navigation

Transparent fill, #000000 text, Inter at 14px weight 500, 4px radius, 9px 6px padding, height ~28px. Used 5 times on the captured page.

### Secondary Pill Button

**Role:** A committing action that is not the primary

#000000 fill, #ffffff text, Inter at 16px weight 400, fully rounded, 0px 20px padding, height ~44px. Used 4 times on the captured page.

### Text Input Field

**Role:** Single-line entry in forms and search

#efefef fill, #000000 text, Inter at 17px weight 400, 0px radius, 0px 0px padding, height ~22px. Used 3 times on the captured page.

### Secondary Pill Button 2

**Role:** A committing action that is not the primary

#000000 fill, #ffffff text, Inter at 15px weight 400, fully rounded, 0px 16px padding, height ~40px. Used 2 times on the captured page.

### Text Link 4

**Role:** Inline navigation

Transparent fill, #000000 text, Inter at 17px weight 400, 14px radius, 0px 21px padding, height ~44px. Used 2 times on the captured page.

### Text Link 5

**Role:** Inline navigation

Transparent fill, #777169 text, Inter at 15px weight 400, fully rounded, 0px 16px padding, height ~40px. Used 2 times on the captured page.

### Text Link 6

**Role:** Inline navigation

Transparent fill, #000000 text, Inter at 15px weight 500, 12px radius, 0px 12px padding, height ~36px. Used 2 times on the captured page.

### Text Link 7

**Role:** Inline navigation

Transparent fill, #ffffff text, Inter at 14px weight 500, fully rounded, 10px 14px padding, height ~40px, shadow rgb(255, 255, 255) 0px 0px 0px 0px inset, rgba(255, 255, 255. Used 2 times on the captured page.

### Text Link 8

**Role:** Inline navigation

#faf8f8 fill, #000000 text, Inter at 17px weight 400, fully rounded, 0px 0px padding, height ~36px. Used 2 times on the captured page.

### Text Link 9

**Role:** Inline navigation

#ffffff fill, #000000 text, Inter at 17px weight 400, fully rounded, 0px 0px padding, height ~40px, shadow rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0. Used 2 times on the captured page.

## Guidelines

### Do

- Use the tokens above rather than the raw values — they were read from elevenlabs.io, and renaming them is how they become yours.
- Replace the observed role labels with what each colour is actually for in your product.
- Separate surfaces with the 1px hairline before reaching for elevation — it is what this page uses most.
- Use `cubic-bezier(.4,0,.2,1)` for motion. One easing across a product is what makes it feel like one product.

### Don't

- Do not treat this as a finished design system. It records what one page does, not what your team has decided.
- Do not add colours outside the palette without deciding what they are for first.
- Do not use type sizes outside the scale. Intermediate sizes flatten the hierarchy the scale exists to create.
- Do not use spacing outside the scale — off-scale gaps are what make a page feel accidental.

## Agent Guide

- This system was captured, not authored. If a value looks wrong, say so rather than building on it.
- Every colour, size, space and radius must come from a table above. If the value you want is not there, ask.
- There are no components defined yet, so do not claim one exists. Ask before introducing a new pattern.
- Elevation is listed in order of use. Reach for level 1; anything deeper needs a reason.

---

*Exported from BlockSmith wiki · 2026-08-27T20:05:32.428Z*
*Source: data/uploads/capture-free-ai-voice-generator-voice-agents-pla-7f5d41b1.md*