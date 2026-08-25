# SaaS — Style Reference
> Green-biased greys. One cobalt for anything you can click.

**Theme:** light

SaaS is a system for products that have to work twice: a marketing page that has to sell, and a dashboard the same person uses every day afterwards. Both run on one set of tokens so the product does not feel like a different company from the site that sold it. The neutrals are deliberately green-biased — a page of pure greys next to real data reads as unfinished, and a faint green cast makes the ground recede behind numbers without warming it into paper. A single cobalt marks everything interactive and nothing else. Status is carried by a separate three-hue semantic set, so a badge never competes with a button for the same meaning. Spacing is compact by intent: this system assumes a table with forty rows in it, not a hero with one sentence.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Ground | `#f6f7f5` | `--color-ground` | Primary page background — a green-biased off-white, never pure #ffffff |
| Panel | `#ffffff` | `--color-panel` | The only pure white in the system: cards, tables, modals, and popovers lifting off Ground |
| Sunken | `#eceeea` | `--color-sunken` | Recessed surfaces: table headers, sidebar, code wells, hover fills, disabled controls |
| Hairline | `#dcdfd9` | `--color-hairline` | 1px borders, table rules, dividers, input borders at rest |
| Muted | `#7c847a` | `--color-muted` | Placeholders, disabled text, timestamps, units, column headers |
| Body | `#4a5148` | `--color-body` | Secondary text, table cells, descriptions, nav links at rest |
| Ink | `#141712` | `--color-ink` | Primary text, headings, key table cells — a green-biased near-black, never #000000 |
| Ink Panel | `#1e231c` | `--color-ink-panel` | Inverted bands only: footer, marketing hero, code blocks, tooltips |
| Cobalt | `#1f4bd8` | `--color-cobalt` | The single accent: links, primary action, focus, active nav, selected row. Interactive only |
| Cobalt Deep | `#1636a4` | `--color-cobalt-deep` | Hover and pressed state for anything filled with Cobalt. Same hue, never a new one |
| Cobalt Wash | `#e8edfc` | `--color-cobalt-wash` | Selected rows, active sidebar item, focus ring backing, informational alerts |
| Success | `#1c7a4a` | `--color-success` | Healthy state: passing checks, positive deltas, completed jobs |
| Success Wash | `#e2f2e8` | `--color-success-wash` | Fill behind Success text in badges and alerts |
| Warning | `#a76a08` | `--color-warning` | Degraded state: quota nearing, retries, expiring credentials |
| Warning Wash | `#f9edd8` | `--color-warning-wash` | Fill behind Warning text in badges and alerts |
| Danger | `#c2262d` | `--color-danger` | Failed state: errors, negative deltas, destructive confirmation |
| Danger Wash | `#fbe7e6` | `--color-danger-wash` | Fill behind Danger text in badges and alerts |

## Tokens — Typography

### Archivo — Marketing headlines and hero copy – a squared, high-x-height grotesque that holds a landing page without novelty or a second display face. · `--font-archivo`
- **Substitute:** Archivo
- **Weights:** 500, 600, 700
- **Sizes:** 32px, 48px, 80px
- **Line height:** 1.00, 1.10
- **Letter spacing:** -0.0250em

### Instrument Sans — All product UI: nav, buttons, tables, forms, labels, and body copy – narrower than an average grotesque with open apertures, so 13px table text stays readable in a column that a wider face would truncate. · `--font-instrument-sans`
- **Substitute:** Instrument Sans
- **Weights:** 400, 500, 600
- **Sizes:** 12px, 13px, 14px, 16px, 18px, 20px, 24px
- **Line height:** 1.40, 1.50
- **Letter spacing:** 0em

### IBM Plex Mono — Every number that sits in a column: metrics, IDs, timestamps, currency, code, and keyboard shortcuts – tabular by default, so digits align without per-column CSS, and visibly factual so data reads differently from prose. · `--font-ibm-plex-mono`
- **Substitute:** IBM Plex Mono
- **Weights:** 400, 500
- **Sizes:** 11px, 12px, 13px, 32px
- **Line height:** 1.20, 1.40
- **Letter spacing:** 0.0100em

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| micro | 11px | 14 | 0.4px | `--text-micro` |
| caption | 12px | 16 | 0.2px | `--text-caption` |
| body-sm | 13px | 20 | 0px | `--text-body-sm` |
| body | 14px | 20 | 0px | `--text-body` |
| body-lg | 16px | 24 | 0px | `--text-body-lg` |
| lead | 18px | 28 | -0.1px | `--text-lead` |
| subheading | 20px | 28 | -0.2px | `--text-subheading` |
| heading | 24px | 32 | -0.3px | `--text-heading` |
| heading-lg | 32px | 36 | -0.6px | `--text-heading-lg` |
| title | 48px | 52 | -1.2px | `--text-title` |
| display | 80px | 80 | -2px | `--text-display` |

## Tokens — Spacing & Shapes

**Base unit:** 4px

**Density:** compact

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 2xs | 4px | `--space-2xs` |
| xs | 8px | `--space-xs` |
| sm | 12px | `--space-sm` |
| md | 16px | `--space-md` |
| lg | 20px | `--space-lg` |
| xl | 24px | `--space-xl` |
| 2xl | 32px | `--space-2xl` |
| 3xl | 40px | `--space-3xl` |
| 4xl | 48px | `--space-4xl` |
| 5xl | 64px | `--space-5xl` |
| 6xl | 96px | `--space-6xl` |

### Border Radius

| Element | Value |
|---------|-------|
| Checkbox | 4px |
| Button | 6px |
| Input | 6px |
| Card | 8px |
| Floating panel | 12px |
| Badge | 999px |

### Layout

- **Content width:** 1200px
- **Prose measure:** 72ch
- **Sidebar width:** 240px
- **Gutter:** 24px
- **Card padding:** 20px
- **Table row height:** 48px
- **Element gap:** 8px
- **Section gap:** 96px

## Components

### Top Nav Bar
**Role:** The header on both the marketing site and the signed-in product.

Panel (#ffffff) background, 1px Hairline (#dcdfd9) bottom border, 64px tall, 24px horizontal padding, no shadow. Links in Instrument Sans 14px weight 500, Body (#4a5148) at rest and Ink (#141712) on hover, with 24px between them. The active link is Ink with a 2px Cobalt (#1f4bd8) underline sitting on the bottom border. The bar does not change color or gain a shadow on scroll.

### Primary Button
**Role:** The one committing action in a view or a dialog — start trial, save, run, confirm.

Cobalt (#1f4bd8) background, Panel (#ffffff) text, 6px border-radius, 8px vertical and 16px horizontal padding, Instrument Sans 14px weight 500. Hover fills Cobalt Deep (#1636a4); the hue never changes and the button never gains a gradient or a shadow. Destructive confirmation is the same button filled with Danger (#c2262d).

### Secondary Button
**Role:** Supporting actions beside a primary — cancel, export, add filter.

Panel (#ffffff) background, 1px Hairline (#dcdfd9) border, Ink (#141712) text, 6px border-radius, 8px vertical and 16px horizontal padding, Instrument Sans 14px weight 500. On hover the border darkens to Muted (#7c847a) and the fill moves to Sunken (#eceeea).

### Ghost Button
**Role:** Low-weight controls that live inside dense chrome: table row actions, toolbar toggles, dismiss.

Transparent background, no border, Body (#4a5148) text, 6px border-radius, 8px vertical and 12px horizontal padding, Instrument Sans 14px weight 500. Hover fills Sunken (#eceeea) and the text goes to Ink (#141712). Never sits alone as the only action in a view — a Ghost Button is always beside something heavier.

### Sidebar Item
**Role:** One destination in the product's left navigation.

Transparent at rest, Body (#4a5148) text, Instrument Sans 13px weight 500, 6px border-radius, 8px vertical and 12px horizontal padding, 4px between items. A 16px icon inherits the current text color. Hover fills Sunken (#eceeea). The selected item is a Cobalt Wash (#e8edfc) fill with Cobalt (#1f4bd8) text — no left accent bar, no bold weight, no size change.

### Metric Card
**Role:** One number with its label and its change, on a dashboard.

Panel (#ffffff) background, 1px Hairline (#dcdfd9) border, 8px border-radius, 20px padding, no shadow. Label in Instrument Sans 13px weight 500 Muted (#7c847a). Value in IBM Plex Mono 32px weight 500 Ink (#141712) with tabular figures. Change in IBM Plex Mono 12px, Success (#1c7a4a) when up and Danger (#c2262d) when down. 8px between label, value, and change. Cards sit in a grid with a 16px gap and never carry a colored top bar.

### Text Input Field
**Role:** Single-line entry in forms, filters, and search.

Panel (#ffffff) background, 1px Hairline (#dcdfd9) border, 6px border-radius, 8px vertical and 12px horizontal padding, Instrument Sans 14px Ink (#141712). Placeholder in Muted (#7c847a). On focus the border becomes Cobalt (#1f4bd8) with a 2px Cobalt Wash (#e8edfc) ring and nothing moves. In error the border is Danger (#c2262d) with the message below it in 12px Danger, 4px away. The label sits above in Instrument Sans 13px weight 500 Ink, 4px away, left-aligned.

### Select Menu
**Role:** Single-choice dropdown for filters, form fields, and row actions.

The trigger matches Text Input Field exactly: Panel (#ffffff) background, 1px Hairline (#dcdfd9) border, 6px border-radius, 8px vertical and 12px horizontal padding, Instrument Sans 14px, with a 16px chevron in Muted (#7c847a). The open panel is Panel with a 1px Hairline border, 12px border-radius, 4px padding, and a shadow — one of the three places a shadow is allowed. Options are Instrument Sans 13px with 6px border-radius and 8px vertical, 12px horizontal padding; hover fills Sunken (#eceeea) and the current value is Cobalt Wash (#e8edfc) with Cobalt (#1f4bd8) text.

### Data Table Row
**Role:** One record in a dense table — the densest thing this system has to render well.

48px row height, 12px vertical and 16px horizontal cell padding, 1px Hairline (#dcdfd9) bottom border. Cells in Instrument Sans 13px Body (#4a5148); the identifying first cell is Ink (#141712) weight 500. Numeric, ID, and timestamp columns use IBM Plex Mono 13px and align right. Hover fills Sunken (#eceeea); a selected row is Cobalt Wash (#e8edfc). The header row sits on Sunken with Instrument Sans 11px weight 600 Muted (#7c847a), uppercase, 0.4px tracking. No zebra striping — the hairline is the separator.

### Status Badge
**Role:** The machine state of a record: active, pending, failed, archived.

999px border-radius, 4px vertical and 8px horizontal padding, IBM Plex Mono 11px weight 500, uppercase. Success Wash (#e2f2e8) fill with Success (#1c7a4a) text; Warning Wash (#f9edd8) with Warning (#a76a08); Danger Wash (#fbe7e6) with Danger (#c2262d); Sunken (#eceeea) with Body (#4a5148) for neutral, draft, and archived. Never Cobalt (#1f4bd8) — the accent means interactive, not stateful — and never a saturated fill behind small text.

### Inline Alert
**Role:** A page- or section-level message: a failed sync, a quota warning, a finished import.

Full width of its container, 8px border-radius, 16px padding, 12px between the icon and the text, no shadow — an alert is in the flow, not above it. Background is the semantic wash with a 1px border in the matching hue: Danger Wash (#fbe7e6) with Danger (#c2262d), Warning Wash (#f9edd8) with Warning (#a76a08), Success Wash (#e2f2e8) with Success (#1c7a4a), and Cobalt Wash (#e8edfc) with Cobalt (#1f4bd8) for informational. Title in Instrument Sans 14px weight 600 Ink (#141712), body in 13px Body (#4a5148), 4px apart. The icon is 16px in the semantic hue. Dismiss is a Ghost Button.

### Tooltip
**Role:** A short label for an icon-only control or a truncated cell.

Ink Panel (#1e231c) background, Ground (#f6f7f5) text, 6px border-radius, 4px vertical and 8px horizontal padding, Instrument Sans 12px, and a shadow. One line, no title, no link, no button. It appears after a delay on hover or on keyboard focus, and it never carries information the user needs in order to finish the task.

### Empty State
**Role:** What a table, list, or chart shows before there is any data in it.

Sunken (#eceeea) background, 8px border-radius, 48px vertical and 24px horizontal padding, centered — the only centered block in the system. Headline in Instrument Sans 16px weight 600 Ink (#141712). One sentence below in Instrument Sans 13px Body (#4a5148), 8px away, constrained to 48ch. A single Primary Button 24px below that. No illustration, no icon over 24px, and no border.

## Do's and Don'ts

### Do
- Reserve Cobalt (#1f4bd8) for things the user can act on: links, the primary action, focus, active nav, and the selected row. Every other meaning belongs to a semantic hue.
- Carry state in the semantic set — Success (#1c7a4a), Warning (#a76a08), Danger (#c2262d) — and always pair each with its wash rather than putting small text on a saturated fill.
- Set every number that appears in a column in IBM Plex Mono, at 11px, 12px, 13px, or 32px. Tabular figures are why the columns line up.
- Get density from row height, not from shrinking type: a Data Table Row is 48px tall with 13px text, never 12px text in a shorter row.
- Vary the radius by what the element is — 6px on controls, 8px on cards, 12px on floating panels, 999px on badges, 4px on checkboxes.
- Use Archivo only at 32px and above and only on marketing surfaces. Product chrome is Instrument Sans at every size.
- Show interaction with fill and border changes, keeping the box and its position fixed, so a grid of forty rows never reflows under the cursor.
- Reach for Ink Panel (#1e231c) when a band needs to invert — footer, marketing hero, code block, tooltip — and leave every other surface light.
- Left-align table cells, form labels, and body copy. Right-align numeric columns.

### Don't
- Do not use gradients anywhere: backgrounds, buttons, badges, chart fills, or borders. Every fill is one flat token.
- Do not use pure black (#000000) or a pure grey such as #808080. The neutrals are green-biased on purpose, and a pure grey beside them reads as a mistake rather than a choice.
- Do not add drop shadows to cards, tables, buttons, inputs, or nav. Only the three floating overlays may carry one: the Select Menu panel, the Tooltip, and a modal.
- Do not use Cobalt (#1f4bd8) to communicate status, and do not use Success, Warning, or Danger on anything clickable.
- Do not put a colored accent bar on the left or top edge of a card, sidebar item, or alert. Selection is a Cobalt Wash (#e8edfc) fill.
- Do not set any interface text below 11px, and do not set data table copy below 13px.
- Do not use spacing values outside the scale. 10px, 14px, and 18px gaps are what make a dense product look accidental.
- Do not apply a single radius to everything. One rounded value across buttons, cards, badges, and inputs flattens the hierarchy the shapes are meant to carry.
- Do not animate rows or cards with lift, scale, or a shadow on hover — change the background to Sunken (#eceeea) instead.
- Do not use emoji as icons, status markers, or section labels; status is a Status Badge and nothing else.
- Do not centre body copy, table cells, or form fields. The Empty State is the only centred block.
- Do not substitute Inter or Space Grotesk for Instrument Sans; the narrower width is what keeps 13px columns from truncating.

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 0 | Sunken | `#eceeea` | Recessed regions: sidebar, table headers, empty states, hover fills |
| 1 | Ground | `#f6f7f5` | The page itself, on both the marketing site and the product |
| 2 | Panel | `#ffffff` | Cards, tables, and forms that must separate from Ground |
| 3 | Ink Panel | `#1e231c` | Inverted bands and the floating overlays that need to read as above the page |

## Imagery

Product screenshots are the primary image in this system, presented at real pixel density inside a Panel (#ffffff) frame with a 1px Hairline (#dcdfd9) border and an 8px radius — never in a tilted browser mockup, never with a gradient behind them, never blurred at the edges. Crop to the part of the UI the sentence beside it is about rather than showing the whole app. Icons are single-weight line icons at 16px in product chrome and 24px in an Empty State, drawn in the current text color, never multicolor and never emoji. Charts inherit the semantic set: Cobalt (#1f4bd8) for the series under discussion, Muted (#7c847a) for comparison series, and Success or Danger only when the chart is literally about good and bad. Avoid stock photography of people at laptops entirely.

## Layout

The marketing site is a single 1200px column with a 24px gutter and 96px between sections; content is left-aligned within it, and full-bleed bands are reserved for Ink Panel (#1e231c) footers and heroes. The product is a fixed 240px sidebar beside a fluid content region that also caps at 1200px, with the Top Nav Bar spanning both at 64px tall. Dashboards run a 12-column grid with a 16px gap; a Metric Card row is four cards above 1200px, two below 900px, and one below 600px. Tables are full-width inside their Panel and scroll horizontally rather than wrapping cells. Forms are single-column with labels above fields — two-column forms are only correct for genuinely paired values such as first and last name.

## Agent Prompt Guide

When building or changing UI in this system:

- Read the color table before writing any color. If the value you want is not in it, pick the nearest role — do not add a token, and do not reach for a Tailwind default.
- Ask what the color means before choosing it. Interactive is Cobalt (#1f4bd8). State is Success, Warning, or Danger. Structure is a neutral. There is no fourth category.
- Sizes come from the Type Scale and spacing from the Spacing Scale. Do not compute intermediate values, and do not use `rounded-lg` as a default — pick the radius the element's row in the Border Radius table gives it.
- Build tables out of Data Table Row, Status Badge, and Ghost Button before writing anything new. Most product screens are a Top Nav Bar, a Sidebar Item list, Metric Cards, and one table.
- The default answer to "how do I make this stand out" is weight or position, not a new hue and not a shadow.
- One Primary Button per view region. A second committing action is a Secondary Button.
- Every interactive element needs a visible focus state: a Cobalt (#1f4bd8) border with a 2px Cobalt Wash (#e8edfc) ring. Do not remove outlines.
- Quick reference — text `#141712`, secondary text `#4a5148`, background `#f6f7f5`, surface `#ffffff`, border `#dcdfd9`, accent `#1f4bd8`.

## Similar Brands

- **Linear** — Dense product chrome, restrained neutrals, and one accent that only ever marks interaction.
- **Stripe** — A marketing site and a dashboard that share one token set, with numbers set in a monospace so data reads as data.
- **Vercel** — Flat surfaces, hairline separation instead of elevation, and a strict separation between neutral structure and semantic state.
- **PlanetScale** — Data-first layouts where the table is the hero and status is a compact pill rather than colored typography.
- **Sentry** — Semantic color used strictly for severity, kept clearly apart from the brand accent so an error never looks like a link.
