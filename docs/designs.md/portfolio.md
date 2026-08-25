# Portfolio — Style Reference
> Editorial restraint. The work is the color.

**Theme:** light

Portfolio is a system for personal sites where the work has to carry the page. It runs a cool, near-monochrome ground so that photographs, screenshots, and project imagery are the only saturated things on screen. Type does the hierarchy: a high-contrast serif for names and titles against a quiet grotesque for everything else, with a deliberately wide gap between body and display sizes so scanning is effortless. A single oxblood accent marks what is interactive and nothing else. Space is generous by default — the most common failure in a personal site is cramming, not sparseness.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Paper | `#fcfcfd` | `--color-paper` | Primary page background — a cool near-white, never pure #ffffff |
| Mist | `#f1f2f5` | `--color-mist` | Alternate section bands, image placeholders, hover surfaces |
| Rule | `#e2e4ea` | `--color-rule` | Hairline dividers, card borders, input borders |
| Quiet | `#9aa0ad` | `--color-quiet` | Metadata, timestamps, disabled text, caption labels |
| Slate | `#5c6373` | `--color-slate` | Secondary body text, project descriptions, nav links at rest |
| Ink | `#14161c` | `--color-ink` | Primary text, headings, names — a blue-biased near-black, never #000000 |
| Oxblood | `#8e2436` | `--color-oxblood` | The single accent: links, active nav, primary action. Nothing decorative |
| Oxblood Wash | `#f5e7e9` | `--color-oxblood-wash` | Selection highlight, active tag background, focus ring backing |
| Card | `#ffffff` | `--color-card` | Raised surfaces that need to separate from Paper |

## Tokens — Typography

### Instrument Serif — Names, page titles, and project headlines – a high-contrast editorial serif that gives a personal site presence without decoration. · `--font-instrument-serif`
- **Substitute:** Instrument Serif
- **Weights:** 400
- **Sizes:** 32px, 40px, 56px, 72px, 96px

### Public Sans — Body copy, navigation, buttons, and form labels – a neutral grotesque that recedes so the serif and the work carry the page. · `--font-public-sans`
- **Weights:** 400, 500, 600
- **Sizes:** 13px, 15px, 17px, 20px, 24px

### JetBrains Mono — Metadata, dates, role labels, and code – a monospace that signals precision and separates factual text from prose. · `--font-jetbrains-mono`
- **Weights:** 400, 500
- **Sizes:** 12px, 13px, 14px

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| meta | 12px | 16 | 0.6px | `--text-meta` |
| caption | 13px | 18 | 0.1px | `--text-caption` |
| body-sm | 15px | 24 | 0px | `--text-body-sm` |
| body | 17px | 28 | 0px | `--text-body` |
| body-lg | 20px | 32 | -0.1px | `--text-body-lg` |
| subheading | 24px | 32 | -0.2px | `--text-subheading` |
| heading | 32px | 38 | -0.4px | `--text-heading` |
| heading-lg | 56px | 60 | -1.2px | `--text-heading-lg` |
| display | 96px | 96 | -2.4px | `--text-display` |

## Tokens — Spacing & Shapes

**Base unit:** 8px

**Density:** spacious

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 2xs | 4px | `--space-2xs` |
| xs | 8px | `--space-xs` |
| sm | 12px | `--space-sm` |
| md | 16px | `--space-md` |
| lg | 24px | `--space-lg` |
| xl | 40px | `--space-xl` |
| 2xl | 64px | `--space-2xl` |
| 3xl | 96px | `--space-3xl` |
| 4xl | 160px | `--space-4xl` |

### Border Radius

| Element | Value |
|---------|-------|
| Button | 6px |
| Card | 10px |
| Input | 6px |
| Tag | 999px |
| Image | 4px |

### Layout

| Label | Value |
|-------|-------|
| Prose measure | 68ch |
| Content width | 720px |
| Wide width | 1120px |
| Gutter | 24px |
| Section rhythm | 160px |

## Components

### Nav Link
**Role:** Header navigation between sections and pages.

Public Sans 15px weight 500, Slate (#5c6373) at rest, Ink (#14161c) on hover. Active page uses Oxblood (#8e2436). No background, no border, no underline at rest — underline appears on hover at 1px with 3px offset.

### Primary Action Button
**Role:** The single most important action on a page — hire me, view work, download CV.

Oxblood (#8e2436) background, Paper (#fcfcfd) text, 6px border-radius, 12px vertical and 24px horizontal padding. Public Sans 15px weight 500. One per view. Darkens on hover; never changes hue.

### Secondary Action Button
**Role:** Supporting actions that sit beside a primary.

Transparent background, 1px Rule (#e2e4ea) border, Ink (#14161c) text, 6px border-radius, 12px vertical and 24px horizontal padding. Public Sans 15px weight 500. Border darkens to Quiet (#9aa0ad) on hover.

### Text Link
**Role:** Inline links inside prose.

Oxblood (#8e2436) text with a 1px underline at 3px offset. No weight change, no background. Underline thickens to 2px on hover.

### Project Card
**Role:** One piece of work in a grid or list.

Card (#ffffff) background, 1px Rule (#e2e4ea) border, 10px border-radius, 24px padding. Title in Instrument Serif 32px Ink. Description in Public Sans 15px Slate. Metadata row in JetBrains Mono 12px Quiet. Border darkens to Quiet on hover; the card does not lift or scale.

### Work Thumbnail
**Role:** Image or screenshot representing a project.

Mist (#f1f2f5) placeholder background, 4px border-radius, no border. Fills its container width, aspect ratio preserved. This is where color enters the page — never tint or overlay it.

### Section Heading
**Role:** Marks a major region — Work, About, Writing, Contact.

Instrument Serif 56px weight 400, Ink (#14161c), letter spacing -1.2px. Preceded by 160px of space and followed by 40px. No rule, no eyebrow, no number.

### Meta Label
**Role:** Dates, roles, client names, tags on a project.

JetBrains Mono 12px weight 400, Quiet (#9aa0ad), letter spacing 0.6px, uppercase. Used for facts only — never for prose or headings.

### Tag
**Role:** A skill, tool, or category marker.

Oxblood Wash (#f5e7e9) background, Oxblood (#8e2436) text, 999px border-radius, 4px vertical and 12px horizontal padding. JetBrains Mono 12px. Non-interactive unless it filters.

### Bio Block
**Role:** The introductory paragraph on a home or about page.

Public Sans 20px weight 400, Ink (#14161c), line height 32px, constrained to 68ch. Sits directly under the name with 40px of space. No card, no border, no background.

### Text Input Field
**Role:** Contact form fields.

Paper (#fcfcfd) background, 1px Rule (#e2e4ea) border, 6px border-radius, 12px vertical and 16px horizontal padding. Public Sans 17px Ink. Border becomes Oxblood (#8e2436) on focus with a 3px Oxblood Wash ring.

## Do's and Don'ts

### Do
- Let the work supply the color. Photographs, screenshots, and project imagery are the only saturated elements — the interface stays near-monochrome so they read as the subject.
- Use Oxblood (#8e2436) only for things that are interactive or currently active. An accent that appears decoratively stops signaling anything.
- Keep body prose at or under the 68ch measure. Long lines are the most common readability failure on personal sites.
- Separate facts from prose typographically: JetBrains Mono for dates, roles, and clients; Public Sans for sentences.
- Give sections the full 160px rhythm. Generous vertical space is what makes a small amount of work look intentional rather than sparse.
- Pick sizes from the type scale. The gap between body (17px) and heading-lg (56px) is deliberate — intermediate sizes flatten the hierarchy.
- Use Ink (#14161c) for primary text and Slate (#5c6373) for secondary. Two levels are enough; a third makes everything look disabled.

### Don't
- Do not use pure black (#000000) or pure white (#ffffff) as page colors. Ink and Paper are chosen to sit slightly off both — pure values read as unconsidered.
- Do not introduce a second accent hue. If something needs to stand out beside Oxblood, use weight, size, or space instead of a new color.
- Do not add drop shadows to cards or buttons. Separation comes from the Rule (#e2e4ea) hairline and from space, not elevation.
- Do not animate cards on hover with lift or scale transforms. Change the border color; leave the layout still.
- Do not set Instrument Serif below 32px. Its high contrast breaks down at small sizes — use Public Sans there.
- Do not centre body prose. Centre a name or a section heading if you like, but centred paragraphs are hard to scan.
- Do not use gradients anywhere, including on buttons and backgrounds.
- Do not use spacing values outside the scale. 13px and 17px gaps are what make a page feel accidental.
- Do not put Meta Label styling on anything that is a sentence. Uppercase monospace is for facts.

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 0 | Paper | `#fcfcfd` | The page itself |
| 1 | Mist | `#f1f2f5` | Alternating bands, image wells, hover states |
| 2 | Card | `#ffffff` | Project cards and any surface that must separate from Paper |

## Imagery

Photography and screenshots are presented at full container width with a 4px radius and no border, treatment, or overlay. Project images should be the highest-fidelity asset available — a crisp screenshot outperforms a stylized mockup. Avoid stock photography entirely; on a personal site it reads as filler. Where an image is unavailable, use a Mist (#f1f2f5) block at the correct aspect ratio rather than a placeholder graphic.

## Layout

Single column by default, constrained to 720px for prose and 1120px for work grids, centred in the viewport with a 24px gutter. Work grids run two columns above 900px and one column below. Sections are separated by 160px of vertical space, which does not compress on mobile below 96px. The header is a single row — name on the left, three or four nav links on the right — and does not stick to the viewport on scroll.

## Agent Prompt Guide

When building or changing UI in this system:

- Read the color table before writing any color. If a value you want is not in it, the answer is not to add it — pick the nearest role from the table or ask the user.
- Sizes come from the Type Scale table and spacing from the Spacing Scale. Do not compute intermediate values.
- Reach for an existing component before writing a new one. Most portfolio pages are Section Heading + Project Card + Meta Label + Text Link.
- The default answer to "should this be bigger, bolder, or more colorful" is more space.
- One Primary Action Button per view. If a second action is needed, it is a Secondary.
- Preserve the near-monochrome rule. If a design needs color, it needs an image.

## Similar Brands

Read as an editorial personal site rather than a product marketing page — closer to a printed portfolio or a well-set essay than to a SaaS landing page. Reference points: independent designer portfolios, magazine feature layouts, and university press book design.
