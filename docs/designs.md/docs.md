# Docs — Style Reference
> Set like a manual. Built for the twentieth minute of reading, not the first ten seconds.

**Theme:** light

Docs is a system for reference material that people read under pressure: API references, developer guides, and technical handbooks that someone opens at 2am with a failing build. Every decision here is downstream of one constraint — a paragraph has to stay readable at length. So prose is set in a screen serif at a generous measure, interface chrome is set in a sans drawn for maximum letterform disambiguation, and everything a reader might copy is set in a monospace. The neutrals carry a deliberate violet cast, which keeps a page of dense text from looking like unstyled HTML without warming it into a magazine. A single petrol accent marks what is interactive or currently active. Shapes are nearly square and there is no elevation anywhere — separation comes from a hairline, from space, and from one inverted surface: the code block, which is the thing readers are actually scanning for.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Sheet | `#fbfafc` | `--color-sheet` | Primary page background — a violet-biased near-white, never pure #ffffff |
| Shelf | `#f3f2f7` | `--color-shelf` | Recessed surfaces: sidebar, table headers, inline-code fill, keyboard hints, hover |
| Rule | `#e3e1ea` | `--color-rule` | 1px hairlines: table rules, section dividers, input and pager borders |
| Muted | `#6b6779` | `--color-muted` | Metadata, placeholders, type annotations, rail entries at rest, anchor glyph |
| Ink Soft | `#4a4557` | `--color-ink-soft` | Secondary prose: lead paragraphs, table descriptions, sidebar items at rest |
| Ink | `#1c1826` | `--color-ink` | Body prose and headings — a violet-biased near-black, never #000000 |
| Petrol | `#0e6b73` | `--color-petrol` | The single accent: links, focus, active nav, current rail entry. Interactive only |
| Petrol Deep | `#0a5158` | `--color-petrol-deep` | Hover and pressed state for anything Petrol. Same hue, never a new one |
| Petrol Wash | `#e2f0f1` | `--color-petrol-wash` | Current sidebar item, focus ring, text selection, Note callout fill |
| Ochre | `#8a5a05` | `--color-ochre` | Caution severity: deprecations, footguns, behaviour that will change |
| Ochre Wash | `#f7edd9` | `--color-ochre-wash` | Fill behind Ochre text in callouts and badges |
| Crimson | `#a51f30` | `--color-crimson` | Danger severity: data loss, irreversible calls, removed APIs |
| Crimson Wash | `#fae7e8` | `--color-crimson-wash` | Fill behind Crimson text in callouts and badges |
| Slab | `#1a1722` | `--color-slab` | The one inverted surface: code blocks and the site footer |
| Slab Rule | `#2c2838` | `--color-slab-rule` | Dividers inside Slab: line-number gutter, filename bar, copy button fill |
| Slab Text | `#e8e6f0` | `--color-slab-text` | Base code text on Slab |
| Slab Muted | `#918ca3` | `--color-slab-muted` | Comments and line numbers on Slab |
| Slab Keyword | `#c3a6f2` | `--color-slab-keyword` | Syntax role one of three: keywords, operators, and types |
| Slab String | `#93d1ab` | `--color-slab-string` | Syntax role two of three: strings, numbers, and literals |

## Tokens — Typography

### Source Serif 4 — Body prose, lead paragraphs, callout text, and table descriptions – a text serif drawn for screen reading, with a large x-height and low-contrast serifs that hold at 17px; over a 70-character line it gives the eye more word-shape to work with than a grotesque does. · `--font-source-serif-4`
- **Substitute:** Source Serif 4
- **Weights:** 400, 600
- **Sizes:** 15px, 17px, 21px
- **Line height:** 1.55, 1.65
- **Letter spacing:** 0em

### Atkinson Hyperlegible — Headings and every piece of interface chrome: sidebar, rail, search, badges, table headers, pager – drawn by the Braille Institute to make letterforms unmistakable, so `1`/`l`/`I` and `0`/`O` never need a second look in a nav label or a version number, and its plain-spoken bold makes an h3 unmissable inside a wall of serif text. · `--font-atkinson-hyperlegible`
- **Substitute:** Atkinson Hyperlegible
- **Weights:** 400, 700
- **Sizes:** 12px, 13px, 15px, 19px, 26px, 32px, 40px
- **Line height:** 1.10, 1.30
- **Letter spacing:** -0.0200em

### Source Code Pro — Anything a reader might type or copy: code blocks, inline code, endpoints, parameter names, types, file paths, flags, and keyboard hints – built to share metrics and vertical proportions with Source Serif 4, so inline code sits inside a sentence without jolting the line, and disambiguated by design where a literal has to be transcribed exactly. · `--font-source-code-pro`
- **Substitute:** Source Code Pro
- **Weights:** 400, 600
- **Sizes:** 12px, 13px, 14px, 15px
- **Line height:** 1.50, 1.70
- **Letter spacing:** 0em

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| micro | 12px | 16 | 0.6px | `--text-micro` |
| caption | 13px | 20 | 0.2px | `--text-caption` |
| code | 14px | 24 | 0px | `--text-code` |
| body-sm | 15px | 24 | 0px | `--text-body-sm` |
| body | 17px | 28 | 0px | `--text-body` |
| h4 | 19px | 26 | -0.1px | `--text-h4` |
| lead | 21px | 32 | -0.1px | `--text-lead` |
| h3 | 26px | 32 | -0.3px | `--text-h3` |
| h2 | 32px | 38 | -0.5px | `--text-h2` |
| h1 | 40px | 44 | -0.8px | `--text-h1` |

## Tokens — Spacing & Shapes

**Base unit:** 4px

**Density:** comfortable

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 3xs | 2px | `--space-3xs` |
| 2xs | 4px | `--space-2xs` |
| xs | 8px | `--space-xs` |
| sm | 12px | `--space-sm` |
| md | 16px | `--space-md` |
| lg | 20px | `--space-lg` |
| xl | 24px | `--space-xl` |
| 2xl | 32px | `--space-2xl` |
| 3xl | 40px | `--space-3xl` |
| 4xl | 56px | `--space-4xl` |
| 5xl | 72px | `--space-5xl` |
| 6xl | 96px | `--space-6xl` |

### Border Radius

| Element | Value |
|---------|-------|
| Inline code | 3px |
| Badge | 3px |
| Keyboard hint | 3px |
| Button | 4px |
| Input | 4px |
| Sidebar item | 4px |
| Pager block | 4px |
| Code block | 6px |
| Callout | 6px |
| Table | 6px |

### Layout

- **Prose measure:** 70ch
- **Content column:** 720px
- **Sidebar width:** 256px
- **On-this-page rail:** 216px
- **Shell width:** 1280px
- **Gutter:** 32px
- **Section rhythm:** 56px
- **Paragraph gap:** 20px
- **Code block max height:** 480px

## Components

### Page Heading
**Role:** The title of a documentation page and the one sentence that says what it covers.

Atkinson Hyperlegible 40px weight 700, Ink (#1c1826), letter spacing -0.8px. The lead sentence sits 12px below in Source Serif 4 21px weight 400, Ink Soft (#4a4557). The pair is followed by 56px of space before the first section. No eyebrow, no category chip, no illustration, and never more than one sentence of lead — the second sentence belongs in Body Prose.

### Section Heading
**Role:** The h2, h3, and h4 that make a long page navigable.

An h2 is Atkinson Hyperlegible 32px weight 700 Ink (#1c1826), preceded by 56px of space, a 1px Rule (#e3e1ea) hairline, and 20px of clearance below that hairline, with 16px between it and the prose beneath. An h3 is 26px weight 700 with 40px above and 12px below and no hairline. An h4 is 19px weight 700 with 32px above and 8px below. Every level takes a stable id. No numbering, no all-caps, and no fourth level — a page that needs an h5 needs to be two pages.

### Anchor Link
**Role:** The permalink affordance on every heading, so a section can be cited rather than screenshotted.

A `#` in Source Code Pro 15px Muted (#6b6779), placed 32px to the left of the heading in the gutter. It is transparent at rest and becomes visible when the heading is hovered or the link takes keyboard focus, at which point it turns Petrol (#0e6b73) with a 2px Petrol Wash (#e2f0f1) focus ring. It is always present in the DOM and always tab-reachable — never rendered only on hover. Activating it copies the absolute URL.

### Body Prose
**Role:** The default paragraph. This system exists to make this component work at length.

Source Serif 4 17px weight 400, line height 28, Ink (#1c1826), held to the 70ch measure. 20px between paragraphs. Bold inside a sentence is weight 600 in the same face and colour — never a different family and never Petrol (#0e6b73). Lists indent 24px with 8px between items and use the same 17px setting. No justification, no first-line indent, no drop caps, and no paragraph longer than roughly six lines without a heading, list, or Code Block to break it.

### Text Link
**Role:** An inline link inside prose, in a table cell, or in a callout.

Petrol (#0e6b73) with a 1px underline at 2px offset, inheriting the size and weight of whatever it sits inside. On hover it moves to Petrol Deep (#0a5158) and the underline thickens to 2px; on focus it takes a 2px Petrol Wash (#e2f0f1) ring. An external link carries a 12px arrow glyph 4px after the text. Link text is the destination's own name — never "here", never "this page", and never a bare URL when a name exists.

### Inline Code
**Role:** A literal inside a sentence: a parameter, a flag, a path, a type, a value.

Source Code Pro 14px weight 400 on a Shelf (#f3f2f7) fill, 3px border-radius, 2px vertical and 4px horizontal padding, Ink (#1c1826), no border. The 14px setting against 17px prose is deliberate: the mono's x-height matches the serif's at that ratio, so the line box does not grow. Inside a Text Link it takes Petrol (#0e6b73) and keeps its fill. It is for literals only — never for emphasis and never for a product name.

### Code Block
**Role:** A complete, copyable example. The most-scanned element on any page in this system.

Slab (#1a1722) fill, 6px border-radius, 16px vertical and 20px horizontal padding, Source Code Pro 14px, line height 24, Slab Text (#e8e6f0). 24px above and below. Syntax uses exactly three roles: Slab Keyword (#c3a6f2), Slab String (#93d1ab), and Slab Muted (#918ca3) for comments — everything else stays Slab Text. An optional filename bar sits above the code in Source Code Pro 12px Slab Muted with a 1px Slab Rule (#2c2838) bottom border and 8px vertical padding. The copy button sits 12px from the top and right edges: Slab Rule fill, 4px border-radius, 4px vertical and 8px horizontal padding, Atkinson Hyperlegible 12px Slab Muted. Long lines scroll horizontally and never wrap; the block caps at 480px and scrolls vertically. It is never truncated behind a fade.

### Callout
**Role:** Severity inside prose. Three variants and no more: Note, Caution, Danger.

6px border-radius, 16px padding, 24px above and below, full width of the prose column. Note is Petrol Wash (#e2f0f1) with a 1px Petrol (#0e6b73) border; Caution is Ochre Wash (#f7edd9) with 1px Ochre (#8a5a05); Danger is Crimson Wash (#fae7e8) with 1px Crimson (#a51f30). The label is Atkinson Hyperlegible 12px weight 700, uppercase, 0.6px tracking, in the variant hue, 8px above the body. The body is Source Serif 4 17px Ink (#1c1826) at the same line height 28 as the surrounding prose, so a callout reads as part of the page rather than an interruption. No icon, no emoji, no left accent bar — the fill and the label carry the severity. A Code Block inside a Callout keeps its Slab (#1a1722) fill and drops to 12px padding. Callouts never nest.

### Parameter Table
**Role:** The reference core — parameters, fields, options, flags, response codes.

Full width of the prose column, 1px Rule (#e3e1ea) border, 6px border-radius, no zebra striping. The header row sits on Shelf (#f3f2f7) in Atkinson Hyperlegible 12px weight 700, uppercase, 0.6px tracking, Muted (#6b6779), with 8px vertical and 16px horizontal padding. Cells take 12px vertical and 16px horizontal padding above a 1px Rule bottom border. The name cell is Source Code Pro 14px weight 600 Ink (#1c1826); the type is Source Code Pro 13px Muted; requiredness is a Status Badge; the description is Source Serif 4 15px line height 24 Ink Soft (#4a4557). Everything is left-aligned, and the table scrolls horizontally rather than wrapping a signature onto two lines.

### Sidebar Nav Item
**Role:** One page in the left-hand navigation tree.

The sidebar sits on Shelf (#f3f2f7) at 256px wide. An item is Atkinson Hyperlegible 15px weight 400 Ink Soft (#4a4557), 4px border-radius, 8px vertical and 12px horizontal padding, with 2px between items. Hover fills Sheet (#fbfafc) and the text goes to Ink (#1c1826). The current page is a Petrol Wash (#e2f0f1) fill with Petrol (#0e6b73) text at weight 700 — no left accent bar, no size change. A group label above a set of items is Atkinson Hyperlegible 12px weight 700, uppercase, 0.6px tracking, Muted (#6b6779), with 24px above, 8px below, and 12px of horizontal padding so it aligns with the items. Nesting stops at two levels.

### On-This-Page Rail
**Role:** The right-hand outline of the current page, and the only navigation that moves as you read.

A 216px column listing h2 and h3 only. Entries are Atkinson Hyperlegible 13px weight 400 Muted (#6b6779) with 4px vertical padding; h3 entries indent 12px. The active entry is Petrol (#0e6b73) weight 700. A 1px Rule (#e3e1ea) left border runs the full height of the list, and the active entry's segment of it is 2px Petrol. The header reads "On this page" in Atkinson Hyperlegible 12px weight 700, uppercase, 0.6px tracking, Muted, 12px above the first entry. It sticks 32px from the top of the viewport. No fill, no border box, no shadow.

### Search Input
**Role:** The fastest path through a documentation site, and the first thing a returning reader touches.

Sheet (#fbfafc) fill, 1px Rule (#e3e1ea) border, 4px border-radius, 8px vertical and 12px horizontal padding, Atkinson Hyperlegible 15px Ink (#1c1826), placeholder in Muted (#6b6779). A 15px magnifier glyph in Muted sits 8px before the text, and a `/` hint sits at the right edge in Source Code Pro 12px Muted on a Shelf (#f3f2f7) fill with a 3px border-radius and 2px vertical, 4px horizontal padding. On focus the border becomes Petrol (#0e6b73) with a 2px Petrol Wash (#e2f0f1) ring and nothing moves. Results open in a panel on Sheet with a 1px Rule border, 6px border-radius, and 4px padding — no shadow; the hairline does the separating. Each result shows the page title in Atkinson Hyperlegible 15px weight 700 Ink (#1c1826) and the matching line beneath it in Source Serif 4 15px Muted (#6b6779).

### Status Badge
**Role:** The lifecycle of an API surface: stable, beta, deprecated, removed, required.

Source Code Pro 12px weight 600, uppercase, 3px border-radius — never a pill — with 2px vertical and 8px horizontal padding, so it sits inside a table cell without changing the row height. Stable is a Shelf (#f3f2f7) fill with Ink Soft (#4a4557) text. Beta is Petrol Wash (#e2f0f1) with Petrol (#0e6b73). Deprecated is Ochre Wash (#f7edd9) with Ochre (#8a5a05). Removed and Required are Crimson Wash (#fae7e8) with Crimson (#a51f30). Never a saturated fill behind small text, and never a plain Petrol fill — the accent means interactive, and a badge is not.

### Prev / Next Pager
**Role:** The two links that close a page and keep a guide readable front to back.

Two blocks side by side with 24px between them and 56px above, each with a 1px Rule (#e3e1ea) border, 4px border-radius, and 16px padding. The direction label is Atkinson Hyperlegible 12px weight 700, uppercase, 0.6px tracking, Muted (#6b6779); the destination title sits 4px below it in Atkinson Hyperlegible 19px weight 700 Petrol (#0e6b73). On hover the border darkens to Muted and nothing else changes — the block does not lift, scale, or gain a fill. Below 900px they stack with 12px between them, previous first.

## Capabilities

What this system will and won't build. Anything not listed here and not in Components is undecided — ask before adding it.

| Pattern | Status | Use instead | Note |
|---------|--------|-------------|------|
| Code Block | preferred | — | Every example is real, complete, and copyable — never an image of code |
| Callout | preferred | — | The only way this system raises severity inside prose |
| Accordion | unavailable | Section Heading | Collapsed prose cannot be found with Cmd-F or linked with an anchor |
| Tab Group | unavailable | Code Block | Three hidden panels are three pages nobody finds; stack the variants |
| Carousel | unavailable | Parameter Table | Reference material has to be scannable in one pass, not paged through |
| Modal | unavailable | Callout | Nothing in a reference is urgent enough to interrupt a reader mid-sentence |
| Marketing Hero Banner | unavailable | Page Heading | A docs page opens with its title and one sentence, not a pitch |
| Tooltip | unavailable | Parameter Table | Hover text is unreachable on touch and invisible to search; define it in the table |
| Chat Widget | unavailable | Search Input | A floating launcher covers the rail, the pager, and the last line of every page |

## Do's and Don'ts

### Do
- Hold body prose to the 70ch measure at 17px with a line height of 28. Every other decision in this system is downstream of that one — this is material read for twenty minutes, not scanned for five seconds.
- Set prose in Source Serif 4 and interface chrome in Atkinson Hyperlegible, so a reader can tell a paragraph from a control before reading either.
- Put every literal a reader might type or copy in Source Code Pro: endpoints, parameters, types, paths, flags, and values. Prose describes them; monospace carries them.
- Give every h2 and h3 a stable id and a visible Anchor Link. A section that cannot be linked to gets screenshotted instead.
- Reserve Petrol (#0e6b73) for what is interactive or currently active: links, focus, the current sidebar item, the current rail entry.
- Carry severity with the three Callout variants — Note, Caution, Danger — and nothing else. Bold prose is not a warning.
- Keep the 56px rhythm above every h2. It is exactly two body lines, which is what makes a page skimmed out of order still feel gridded.
- Ship examples complete. A snippet that drops the import line costs more of the reader's time than the four lines it saved.
- Left-align headings, prose, table cells, badges, and the rail. Nothing in a reference is centred.

### Don't
- Do not use gradients anywhere: page backgrounds, buttons, callout fills, badges, sidebar highlights, or a fade over the bottom of a long code sample.
- Do not put drop shadows on anything — not the sidebar, not the search results panel, not a code block, not a callout. Separation is the 1px Rule (#e3e1ea) hairline and space, never elevation.
- Do not use pure black (#000000) or pure white (#ffffff). The neutrals carry a deliberate violet cast, and a pure value beside them reads as an untokenised default rather than a choice.
- Do not introduce a font family beyond the three declared here, and do not substitute Inter or Space Grotesk for Atkinson Hyperlegible — the disambiguated letterforms are the reason it is in the system.
- Do not set body prose below 17px, and do not let a measure run past 70ch to fill a wide viewport. The empty space to the right of a paragraph is doing work.
- Do not use spacing values outside the scale. 6px, 10px, and 18px gaps are what make a reference page feel assembled rather than typeset.
- Do not apply a radius of 8px or more to anything. This system tops out at 6px on a code block, and a single rounded value across every surface erases the difference between a code well, a callout, and a table.
- Do not hide reference content behind a hover, a disclosure, or a tab. If it is in the docs it has to be findable with Cmd-F and addressable with an anchor.
- Do not colour code with more than three syntax roles — keyword, string, comment. A twelve-colour theme turns an example into decoration.
- Do not use emoji as callout icons, section markers, or status indicators. Severity is a Callout variant and lifecycle is a Status Badge.
- Do not use Petrol (#0e6b73) to indicate status, and do not put Ochre (#8a5a05) or Crimson (#a51f30) on anything clickable.
- Do not animate a sidebar item, a table row, or a pager block with lift, scale, or a colour fade. Change the border or the fill and leave the layout still.
- Do not centre body copy, table cells, or headings, and do not indent the first line of a paragraph.

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 0 | Shelf | `#f3f2f7` | Recessed regions: sidebar, table headers, inline-code fill, keyboard hints, hover |
| 1 | Sheet | `#fbfafc` | The page itself and every reading surface on it |
| 2 | Slab | `#1a1722` | The one inverted surface: code blocks and the site footer |

## Imagery

Documentation images are diagrams and screenshots, and both are subordinate to the sentence beside them. Diagrams are line drawings in Ink (#1c1826) on Sheet (#fbfafc) with Petrol (#0e6b73) marking the one path the paragraph is describing and Muted (#6b6779) for everything else — flat, no gradient fills, no drop shadows, and no 3D perspective on a box. Every diagram carries real text set in Atkinson Hyperlegible 13px, never rasterised labels, so it stays searchable and legible when scaled. Screenshots are cropped to the control under discussion rather than the whole window, presented at real pixel density inside a 1px Rule (#e3e1ea) border with a 4px radius, never in a tilted browser frame. A screenshot of code is never acceptable — that is a Code Block. Icons are single-weight line icons at 12px or 15px in the current text colour, and there is no illustration, no mascot, and no stock photography anywhere in this system.

## Layout

A three-column shell capped at 1280px with a 32px gutter: a 256px sidebar on Shelf (#f3f2f7), a fluid content column that caps at 720px, and a 216px On-This-Page Rail. Both side columns are sticky and scroll independently; the content column does not. Below 1120px the rail collapses into a disclosure directly under the Page Heading, and below 900px the sidebar moves behind a menu control in the header — the content column keeps its measure at every width and never stretches to fill. Prose, code blocks, callouts, and tables all share the content column's left edge so the page has one continuous rag; nothing is full-bleed except the Slab (#1a1722) footer. Vertical rhythm is 56px above every h2, 40px above every h3, 24px around every Code Block and Callout, and 20px between paragraphs.

## Agent Prompt Guide

When building or changing UI in this system:

- Read the colour table before writing any colour. If the value you want is not in it, pick the nearest role — do not add a token and do not reach for a Tailwind default.
- Ask what the colour means first. Interactive is Petrol (#0e6b73). Severity is Ochre (#8a5a05) or Crimson (#a51f30). Structure is a neutral. Code lives on Slab (#1a1722). There is no fifth category.
- Sizes come from the Type Scale and spacing from the Spacing Scale. Do not compute intermediate values, and do not default to `rounded-lg` — take the radius from the element's row in the Border Radius table, which never exceeds 6px.
- Most documentation pages are a Page Heading, Section Headings with Anchor Links, Body Prose, Code Blocks, one Parameter Table, and a Prev / Next Pager. Reach for those before writing anything new.
- The answer to "how do I make this stand out" is a Section Heading or a Callout, not a new hue, a shadow, or a larger radius.
- Prose is Source Serif 4, chrome is Atkinson Hyperlegible, literals are Source Code Pro. If you are unsure which a string is, ask whether the reader would ever type it.
- Every interactive element needs a visible focus state: a Petrol (#0e6b73) border with a 2px Petrol Wash (#e2f0f1) ring. Never remove an outline.
- Quick reference — text `#1c1826`, secondary text `#4a4557`, background `#fbfafc`, recessed `#f3f2f7`, border `#e3e1ea`, accent `#0e6b73`, code surface `#1a1722`.

## Similar Brands

- **PostgreSQL Manual** — Structure over styling: a reference that is navigable by its headings and readable in a plain browser after twenty years.
- **MDN Web Docs** — Parameter tables and severity callouts as the load-bearing components, with search treated as the primary navigation.
- **Django Documentation** — Long-form serif prose at a disciplined measure, where the guide and the reference share one visual language.
- **docs.rs and The Rust Book** — Anchorable signatures, stability badges, and code presented as the page's primary content rather than an aside.
- **O'Reilly print manuals** — Sans headings over a serif text face, a fixed measure, and no ornament that is not carrying information.
