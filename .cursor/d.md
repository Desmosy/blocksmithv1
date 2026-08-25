# Company X — UI/UX Design Wiki
> **Version:** 3.2.0 | **Last Updated:** June 2026 | **Owner:** Design Systems Team  
> **Status:** Living Document — all design decisions are versioned and tracked in Figma + GitHub

---

## Table of Contents

1. [Introduction & Philosophy](#1-introduction--philosophy)
2. [Design Principles](#2-design-principles)
3. [Visual Identity System](#3-visual-identity-system)
   - 3.1 [Color System](#31-color-system)
   - 3.2 [Typography](#32-typography)
   - 3.3 [Iconography](#33-iconography)
   - 3.4 [Spacing & Grid](#34-spacing--grid)
   - 3.5 [Elevation & Shadows](#35-elevation--shadows)
4. [Component Library](#4-component-library)
   - 4.1 [Foundations](#41-foundations)
   - 4.2 [Buttons & CTAs](#42-buttons--ctas)
   - 4.3 [Forms & Inputs](#43-forms--inputs)
   - 4.4 [Navigation Patterns](#44-navigation-patterns)
   - 4.5 [Cards & Containers](#45-cards--containers)
   - 4.6 [Modals & Overlays](#46-modals--overlays)
   - 4.7 [Tables & Data Grids](#47-tables--data-grids)
   - 4.8 [Feedback Components](#48-feedback-components)
   - 4.9 [Empty States](#49-empty-states)
5. [Interaction & Motion Design](#5-interaction--motion-design)
   - 5.1 [Animation Principles](#51-animation-principles)
   - 5.2 [Easing & Timing](#52-easing--timing)
   - 5.3 [Transition Patterns](#53-transition-patterns)
   - 5.4 [Microinteractions](#54-microinteractions)
6. [Layout & Composition](#6-layout--composition)
   - 6.1 [Responsive Grid System](#61-responsive-grid-system)
   - 6.2 [Page Layouts](#62-page-layouts)
   - 6.3 [Content Hierarchy](#63-content-hierarchy)
7. [User Flows & Navigation Architecture](#7-user-flows--navigation-architecture)
   - 7.1 [Information Architecture](#71-information-architecture)
   - 7.2 [Core User Journeys](#72-core-user-journeys)
   - 7.3 [Onboarding Flow](#73-onboarding-flow)
   - 7.4 [Error & Edge Case Flows](#74-error--edge-case-flows)
8. [Accessibility (a11y)](#8-accessibility-a11y)
   - 8.1 [WCAG Compliance Standards](#81-wcag-compliance-standards)
   - 8.2 [Color Contrast Requirements](#82-color-contrast-requirements)
   - 8.3 [Keyboard Navigation](#83-keyboard-navigation)
   - 8.4 [Screen Reader Guidelines](#84-screen-reader-guidelines)
   - 8.5 [Motion & Vestibular Sensitivity](#85-motion--vestibular-sensitivity)
9. [Responsive & Mobile Design](#9-responsive--mobile-design)
   - 9.1 [Breakpoints](#91-breakpoints)
   - 9.2 [Mobile-First Principles](#92-mobile-first-principles)
   - 9.3 [Touch Target Standards](#93-touch-target-standards)
   - 9.4 [Native App Considerations](#94-native-app-considerations)
10. [Content & Writing Guidelines (UX Copy)](#10-content--writing-guidelines-ux-copy)
    - 10.1 [Voice & Tone](#101-voice--tone)
    - 10.2 [Microcopy Patterns](#102-microcopy-patterns)
    - 10.3 [Error Messages](#103-error-messages)
    - 10.4 [Empty State Copy](#104-empty-state-copy)
    - 10.5 [Button & CTA Labels](#105-button--cta-labels)
11. [Design Tokens](#11-design-tokens)
    - 11.1 [Token Architecture](#111-token-architecture)
    - 11.2 [Semantic Token Reference](#112-semantic-token-reference)
    - 11.3 [Dark Mode Tokens](#113-dark-mode-tokens)
12. [Theming & Dark Mode](#12-theming--dark-mode)
13. [Design-to-Dev Handoff Process](#13-design-to-dev-handoff-process)
    - 13.1 [Figma File Structure](#131-figma-file-structure)
    - 13.2 [Annotation Standards](#132-annotation-standards)
    - 13.3 [Redline Specs](#133-redline-specs)
    - 13.4 [Developer Handoff Checklist](#134-developer-handoff-checklist)
14. [Research & Testing Framework](#14-research--testing-framework)
    - 14.1 [Usability Testing Protocol](#141-usability-testing-protocol)
    - 14.2 [Heuristic Evaluation](#142-heuristic-evaluation)
    - 14.3 [A/B Testing Guidelines](#143-ab-testing-guidelines)
    - 14.4 [Metrics & Success Criteria](#144-metrics--success-criteria)
15. [Design Process & Workflow](#15-design-process--workflow)
    - 15.1 [Double Diamond Process](#151-double-diamond-process)
    - 15.2 [Design Sprint Structure](#152-design-sprint-structure)
    - 15.3 [Critique & Review Process](#153-critique--review-process)
    - 15.4 [Design Debt Management](#154-design-debt-management)
16. [Platform-Specific Guidelines](#16-platform-specific-guidelines)
    - 16.1 [Web Application](#161-web-application)
    - 16.2 [iOS](#162-ios)
    - 16.3 [Android](#163-android)
    - 16.4 [Email Templates](#164-email-templates)
17. [Anti-Patterns & What Not To Do](#17-anti-patterns--what-not-to-do)
18. [Changelog & Version History](#18-changelog--version-history)
19. [Contributing to This Wiki](#19-contributing-to-this-wiki)
20. [Glossary](#20-glossary)

---

## 1. Introduction & Philosophy

### What Is This Document?

This wiki is the **single source of truth** for how Company X looks, feels, and behaves. It is written, maintained, and enforced by the Design Systems team with contributions from every product designer, frontend engineer, and researcher at Company X.

This document governs:
- Every pixel of every interface we ship
- The language we use when communicating with users
- The logic and rationale behind every design decision
- The process by which new patterns are proposed, reviewed, and adopted

If you are a designer, this is your bible. If you are an engineer, this is the contract. If you are a PM, this is the why behind every screen.

### Why a Design System?

Company X ships across multiple surfaces — web, iOS, Android, email, and third-party embeds. Without a shared language, we fragment. Without documentation, we repeat ourselves. Without enforcement, we drift.

A design system solves three classes of problems:

**1. Speed.** Designers don't re-invent buttons. Engineers don't re-implement modals. Teams ship faster because the work of establishing standards has already been done.

**2. Consistency.** Every screen across every platform feels like it came from the same mind, the same hand. Users develop trust when interfaces behave predictably.

**3. Quality at scale.** Standards don't lower over time — they compound. Each component built to spec makes the next one easier. Each decision documented makes the system more resilient.

### Audience

| Role | How to Use This Document |
|------|--------------------------|
| Product Designers | Primary audience. Consult before starting any new screen or component. |
| Frontend Engineers | Token reference, component specs, accessibility requirements, handoff process. |
| Product Managers | Design principles, user flow documentation, research protocols. |
| Brand / Marketing | Visual identity, typography, color system. |
| QA Engineers | Interaction specs, accessibility standards, edge case documentation. |
| New Hires | Start here. Then go to Figma. Then ask questions. |

---

## 2. Design Principles

These are not aspirational posters. These are decision-making filters. When you are stuck between two design choices, these principles resolve the conflict.

---

### Principle 1: Clarity Over Cleverness

Every interface decision must first answer: **does this make the user faster?** An elegant animation that costs 200ms of perceived wait time is a bad trade. A clever metaphor that requires explanation is a failed metaphor.

**In practice:**
- Labels before icons, always, unless the icon has 100% universal recognition (hamburger menu, search glass)
- Avoid progressive disclosure when users need the information immediately
- Never sacrifice scannability for visual sophistication
- When in doubt between compact and clear, choose clear

**Counter-example to avoid:**
Using icon-only toolbars to save horizontal space. Saves 80px. Costs user confidence.

---

### Principle 2: Feedback is Non-Negotiable

Every action must produce a reaction the user can perceive within **100ms**. Every process longer than 1 second must communicate progress. Every completed action must be confirmed. Every failure must be explained.

**In practice:**
- Button click → immediate visual state change (active state within 1 frame)
- Form submission → loading indicator within 100ms
- Success → clear confirmation that persists for at least 3 seconds
- Errors → visible, specific, and actionable

**The Feedback Stack:**
```
User action
  → Immediate visual acknowledgment (0–100ms)
    → Process indication if async (100ms–2s)
      → Outcome confirmation (success/failure)
        → Next action suggestion
```

---

### Principle 3: Reduce Cognitive Load

Users have a finite budget of attention. Every unnecessary element spends some of it. We earn trust by being sparing with their attention budget.

**In practice:**
- Maximum 7 items in any navigation menu (Miller's Law)
- Chunk related information visually — use proximity, not lines
- One primary action per screen/modal/card
- Surface defaults that are correct for 80% of users

---

### Principle 4: Respect Context

The same task in a different context — a different device, a different time, a different emotional state — requires a different design response. A dashboard on mobile has different affordances than on desktop. An error during checkout is more critical than an error in settings.

**In practice:**
- Design for the distracted user, not the ideal user
- Prioritize contextually important information (e.g., on mobile, collapse secondary navigation)
- Understand where in their emotional arc users encounter each screen

---

### Principle 5: Accessible First, Not Accessible Later

Accessibility is not a feature we add at the end of a sprint. It is a constraint we design within from the beginning. Accessible design is better design for everyone.

**In practice:**
- Every component ships with keyboard navigation
- Every image has alt text
- Color is never the sole carrier of meaning
- Type scales to 200% without breaking layout

---

### Principle 6: Trust Through Consistency

Users predict what will happen based on what has happened before. When we break patterns without a compelling reason, we break trust. Every deviation from established patterns must be intentional and documented.

**In practice:**
- If a pattern exists in the design system, use it. Don't create a one-off.
- If a pattern is insufficient, propose a new one through the proper process (see Section 15.3)
- Document deviations in the Figma file and this wiki

---

## 3. Visual Identity System

### 3.1 Color System

Company X's color system is built on three tiers: **Primitive Colors**, **Semantic Colors**, and **Component Colors**. Never reference primitive colors directly in components — always use semantic tokens.

---

#### Primitive Color Palette

These are the raw values. Never use these in UI code directly.

**Blue Family (Primary Brand)**
| Token | Hex | Usage |
|-------|-----|-------|
| `blue-50` | `#EFF6FF` | Lightest tint |
| `blue-100` | `#DBEAFE` | Hover backgrounds |
| `blue-200` | `#BFDBFE` | Active backgrounds |
| `blue-300` | `#93C5FD` | Disabled states |
| `blue-400` | `#60A5FA` | Supporting accent |
| `blue-500` | `#3B82F6` | Primary mid |
| `blue-600` | `#2563EB` | **Primary brand — most buttons, links** |
| `blue-700` | `#1D4ED8` | Pressed states |
| `blue-800` | `#1E40AF` | Deep emphasis |
| `blue-900` | `#1E3A8A` | Darkest — text on light |

**Neutral Family (UI Chrome)**
| Token | Hex | Usage |
|-------|-----|-------|
| `neutral-0` | `#FFFFFF` | White |
| `neutral-50` | `#F9FAFB` | Page backgrounds |
| `neutral-100` | `#F3F4F6` | Card backgrounds |
| `neutral-200` | `#E5E7EB` | Borders, dividers |
| `neutral-300` | `#D1D5DB` | Disabled borders |
| `neutral-400` | `#9CA3AF` | Placeholder text |
| `neutral-500` | `#6B7280` | Secondary text |
| `neutral-600` | `#4B5563` | Body text |
| `neutral-700` | `#374151` | Emphasis text |
| `neutral-800` | `#1F2937` | Headings |
| `neutral-900` | `#111827` | Highest contrast text |
| `neutral-950` | `#030712` | Near-black |

**Green Family (Success)**
| Token | Hex |
|-------|-----|
| `green-50` | `#F0FDF4` |
| `green-100` | `#DCFCE7` |
| `green-500` | `#22C55E` |
| `green-600` | `#16A34A` |
| `green-700` | `#15803D` |

**Red Family (Destructive / Error)**
| Token | Hex |
|-------|-----|
| `red-50` | `#FEF2F2` |
| `red-100` | `#FEE2E2` |
| `red-500` | `#EF4444` |
| `red-600` | `#DC2626` |
| `red-700` | `#B91C1C` |

**Yellow / Amber Family (Warning)**
| Token | Hex |
|-------|-----|
| `amber-50` | `#FFFBEB` |
| `amber-100` | `#FEF3C7` |
| `amber-400` | `#FBBF24` |
| `amber-500` | `#F59E0B` |
| `amber-600` | `#D97706` |

---

#### Semantic Color Tokens

These are the tokens you actually use. They map to primitives and swap in dark mode.

| Semantic Token | Light Value | Dark Value | Usage |
|----------------|-------------|------------|-------|
| `color-bg-primary` | `neutral-0` | `neutral-950` | Main page background |
| `color-bg-secondary` | `neutral-50` | `neutral-900` | Secondary surfaces |
| `color-bg-tertiary` | `neutral-100` | `neutral-800` | Cards, panels |
| `color-bg-accent` | `blue-600` | `blue-500` | Primary CTAs, highlights |
| `color-bg-success` | `green-50` | `green-950` | Success banners |
| `color-bg-error` | `red-50` | `red-950` | Error banners |
| `color-bg-warning` | `amber-50` | `amber-950` | Warning banners |
| `color-text-primary` | `neutral-900` | `neutral-50` | Body copy, labels |
| `color-text-secondary` | `neutral-500` | `neutral-400` | Supporting copy, hints |
| `color-text-disabled` | `neutral-300` | `neutral-600` | Disabled labels |
| `color-text-inverse` | `neutral-0` | `neutral-950` | Text on dark/brand backgrounds |
| `color-text-accent` | `blue-600` | `blue-400` | Links, interactive labels |
| `color-border-default` | `neutral-200` | `neutral-700` | Standard borders |
| `color-border-strong` | `neutral-400` | `neutral-500` | Emphasis borders |
| `color-border-focus` | `blue-500` | `blue-400` | Focus rings |

---

#### Color Usage Rules

1. **Never use color alone to convey meaning.** Always pair with an icon, label, or pattern. This is a WCAG requirement and a design principle.

2. **Primary actions use `blue-600`** (or `color-bg-accent`). One primary action per context. Do not create secondary primary buttons.

3. **Destructive actions use `red-600`.** They must be in a confirmation dialog before execution. No exceptions.

4. **Success green and error red are feedback colors.** They should not appear in navigation, headers, or decorative contexts.

5. **Brand blue is not for decoration.** If something is blue, it means "this is interactive" or "this is important feedback." Do not decorate illustrations, headers, or non-interactive elements with brand blue.

6. **Gradients are off-limits in product UI.** Gradients belong in marketing, not in the product. In product, we use solid fills. This rule exists because gradients lose contrast predictability.

---

### 3.2 Typography

Company X uses a two-family system: a **display family** for headlines and callouts, and a **body family** for everything else.

**Display Font:** `Satoshi`  
**Body Font:** `Inter`  
**Monospace Font:** `JetBrains Mono` (code snippets, terminal-like UI)

---

#### Type Scale

All font sizes follow a modular scale of 1.25 (Major Third). Sizes are defined in `rem` units.

| Token | Size | Line Height | Weight | Usage |
|-------|------|-------------|--------|-------|
| `text-xs` | 12px / 0.75rem | 1.5 (18px) | 400/500 | Captions, legal text, metadata |
| `text-sm` | 14px / 0.875rem | 1.5 (21px) | 400/500 | Secondary labels, helper text |
| `text-base` | 16px / 1rem | 1.5 (24px) | 400 | Body copy (default) |
| `text-lg` | 18px / 1.125rem | 1.555 (28px) | 400/500 | Lead paragraph, card descriptions |
| `text-xl` | 20px / 1.25rem | 1.4 (28px) | 600 | Section labels, strong secondary |
| `text-2xl` | 24px / 1.5rem | 1.333 (32px) | 600/700 | H4 equivalent |
| `text-3xl` | 30px / 1.875rem | 1.2 (36px) | 700 | H3 equivalent |
| `text-4xl` | 36px / 2.25rem | 1.111 (40px) | 700 | H2 equivalent |
| `text-5xl` | 48px / 3rem | 1.0 (48px) | 800 | H1 equivalent, hero headlines |
| `text-6xl` | 60px / 3.75rem | 1.0 (60px) | 800 | Marketing hero only |
| `text-7xl` | 72px / 4.5rem | 0.9 (64px) | 800 | Splash screens only |

---

#### Heading Hierarchy

```
H1  — text-5xl, Satoshi, weight-800, neutral-900
H2  — text-4xl, Satoshi, weight-700, neutral-900
H3  — text-3xl, Satoshi, weight-700, neutral-800
H4  — text-2xl, Inter, weight-600, neutral-800
H5  — text-xl, Inter, weight-600, neutral-700
H6  — text-lg, Inter, weight-500, neutral-600 (uppercase + letter-spacing-wide)
```

**Rules:**
- Never skip heading levels (H1 → H3 is invalid)
- One H1 per page/view, full stop
- Headings must be semantic HTML (not `<div>` styled as heading)
- Do not bold body text as a substitute for semantic headings

---

#### Body Text Rules

- **Line length:** 60–80 characters per line for reading comfort. Use `max-width: 65ch` on body containers.
- **Minimum body size:** `text-base` (16px). Never use `text-sm` for long-form reading.
- **Paragraph spacing:** `spacing-4` (16px) between paragraphs, or `margin-bottom: 1em` in prose contexts.
- **Font weight for emphasis:** Use `font-medium` (500) or `font-semibold` (600). Never `font-bold` (700) in body copy unless it is a callout or label.

---

#### Letter Spacing

| Context | Token | Value |
|---------|-------|-------|
| Body text | `tracking-normal` | 0em |
| Subheadings, labels | `tracking-tight` | -0.01em |
| Display headings | `tracking-tighter` | -0.02em |
| Caps labels, badge text | `tracking-wide` | +0.05em |
| Metadata / all-caps UI | `tracking-widest` | +0.1em |

---

#### Typography Anti-Patterns

- Do not use more than 3 font sizes on a single screen
- Do not mix Satoshi and Inter within the same sentence
- Do not italic body copy. Italics are reserved for technical terms, quotations, and languages that require it
- Do not use `text-xs` for anything a user must read to complete a task
- Do not justify body text. Left-aligned only.

---

### 3.3 Iconography

Company X uses **Phosphor Icons** as the primary icon library.

**Why Phosphor:**
- Multiple weights (thin, light, regular, bold, fill, duotone) map to our UI weight system
- Consistent 24px baseline grid
- Open source with a commercial-friendly license
- Active maintenance with good coverage of product-specific needs

---

#### Icon Sizing System

| Size Token | Pixel Value | Context |
|------------|-------------|---------|
| `icon-xs` | 12px | Inline with `text-xs`, status dots |
| `icon-sm` | 16px | Inline with `text-sm`, compact UIs |
| `icon-md` | 20px | Default — inline with `text-base` and `text-lg` |
| `icon-lg` | 24px | Standalone icons, navigation items |
| `icon-xl` | 32px | Feature icons in cards, empty states |
| `icon-2xl` | 48px | Illustration-level empty states, onboarding |

---

#### Icon Weight Usage

| Context | Phosphor Weight |
|---------|----------------|
| Navigation, toolbars | Regular |
| Buttons | Regular or Bold |
| Filled/active states | Fill |
| Decorative / illustration | Duotone |
| Data-dense tables | Light |

---

#### Icon Rules

1. **Pair icons with text labels** in all navigation, buttons, and actions unless: (a) the icon is universally recognized (close, search, back), AND (b) the icon has a tooltip.
2. **Never use icons without meaning.** Decorative icons must be `aria-hidden="true"`.
3. **Maintain consistent weight across a view.** Do not mix Regular and Bold icons in the same toolbar.
4. **Do not resize icons to non-standard sizes.** Stick to the size token system.
5. **Custom icons** must be drawn on the same 24px grid as Phosphor, reviewed by a senior designer, and submitted to the icon library with semantic naming.

---

### 3.4 Spacing & Grid

Company X uses an **8-point grid system**. Every spacing value is a multiple of 4px (half-step allowed at 4px for tight component internals).

#### Spacing Scale

| Token | Value | Use |
|-------|-------|-----|
| `spacing-0` | 0px | Reset |
| `spacing-0.5` | 2px | Hairline gaps, icon-to-text gap in tags |
| `spacing-1` | 4px | Component internals (icon padding, badge padding) |
| `spacing-1.5` | 6px | Tight component padding |
| `spacing-2` | 8px | Default inner padding, tight list gaps |
| `spacing-3` | 12px | Form field inner padding |
| `spacing-4` | 16px | Standard component padding, list item gap |
| `spacing-5` | 20px | Medium component padding |
| `spacing-6` | 24px | Section-level inner padding |
| `spacing-8` | 32px | Card padding, major section gaps |
| `spacing-10` | 40px | Between sections |
| `spacing-12` | 48px | Page-level section gaps |
| `spacing-16` | 64px | Large section separation |
| `spacing-20` | 80px | Page section padding (landing pages) |
| `spacing-24` | 96px | Major layout breakpoints |

---

#### Grid System

**Web (Desktop):**
- 12-column grid
- Column width: fluid
- Gutter: 24px
- Margin: 64px (max container width: 1280px)

**Web (Tablet):**
- 8-column grid
- Gutter: 20px
- Margin: 40px

**Mobile Web / iOS / Android:**
- 4-column grid
- Gutter: 16px
- Margin: 16px

**Dashboard / Dense UIs:**
- 24-column grid (for widget-based layouts)
- Gutter: 16px
- Margin: 24px

---

#### Spacing Principles

1. **Related things are close. Unrelated things are far.** The Gestalt principle of proximity is the primary tool for communicating structure. Do not use lines or boxes to separate things when whitespace does the job better.

2. **Internal spacing < External spacing.** The padding inside a card is always less than the margin between two cards. This creates visual containment.

3. **Be consistent within a component.** If a card has 24px padding on the left, it has 24px padding on all sides. Do not mix horizontal and vertical padding without intention.

4. **Avoid orphans at small sizes.** Test spacing at every breakpoint to ensure it doesn't collapse to zero or create awkward gaps.

---

### 3.5 Elevation & Shadows

Company X uses a 5-level elevation system to communicate z-axis hierarchy. Elevation communicates "this is above everything else."

| Level | Token | CSS Shadow | Usage |
|-------|-------|------------|-------|
| 0 | `elevation-flat` | none | Flat elements, cards on colored backgrounds |
| 1 | `elevation-sm` | `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)` | Cards, default panels |
| 2 | `elevation-md` | `0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06)` | Dropdowns, hovered cards |
| 3 | `elevation-lg` | `0 10px 15px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.05)` | Modals, dialogs, popovers |
| 4 | `elevation-xl` | `0 20px 25px rgba(0,0,0,0.1), 0 10px 10px rgba(0,0,0,0.04)` | Command palettes, full-screen overlays |

**Shadow Rules:**
- Shadows go downward. Never use top-only shadows.
- In dark mode, replace shadows with `border: 1px solid neutral-700` at elevation 1–2. Deep shadows don't read well on dark backgrounds.
- Never animate shadow values directly — they are expensive. Instead, use opacity or transform animations.
- Don't use shadows decoratively on elements that are not elevated.

---

## 4. Component Library

### 4.1 Foundations

All components are built on the following foundational properties. They are not components themselves but are properties that every component inherits.

**Border Radius Scale:**

| Token | Value | Usage |
|-------|-------|-------|
| `radius-none` | 0px | Intentionally sharp: table cells, code blocks |
| `radius-sm` | 4px | Tight elements: tags, chips, small inputs |
| `radius-md` | 8px | Default: buttons, inputs, cards |
| `radius-lg` | 12px | Large cards, panels, modals |
| `radius-xl` | 16px | Feature cards, hero panels |
| `radius-2xl` | 24px | Marketing tiles, illustrations |
| `radius-full` | 9999px | Pills, avatars, toggles |

**Focus States:**

Every interactive element must have a visible focus state that satisfies WCAG 2.1 AA.

Standard focus ring:
```css
outline: 2px solid var(--color-border-focus);  /* blue-500 */
outline-offset: 2px;
```

Use `focus-visible` (not `focus`) to only show rings for keyboard users.

---

### 4.2 Buttons & CTAs

Buttons are the most frequently used interactive component. Get them wrong and everything downstream suffers.

#### Button Variants

**Primary Button** — One per context. The most important action.
```
Background: color-bg-accent (blue-600)
Text: color-text-inverse (white)
Padding: spacing-2.5 (10px) vertical, spacing-5 (20px) horizontal
Border radius: radius-md (8px)
Font: text-sm, font-semibold
```

**Secondary Button** — Supporting actions that are still important.
```
Background: transparent
Border: 1.5px solid color-border-strong
Text: color-text-primary
Padding: spacing-2.5 (10px) vertical, spacing-5 (20px) horizontal
Border radius: radius-md (8px)
Font: text-sm, font-semibold
```

**Ghost Button** — Low-emphasis actions, often in dense UIs.
```
Background: transparent (hover: color-bg-secondary)
Border: none
Text: color-text-accent
Padding: spacing-2 (8px) vertical, spacing-3 (12px) horizontal
Border radius: radius-md (8px)
Font: text-sm, font-medium
```

**Destructive Button** — Irreversible actions only. Always with confirmation.
```
Background: red-600
Text: white
[All other properties same as Primary]
```

**Icon Button** — Icon-only. Must have tooltip + aria-label.
```
Size: 32px (sm), 40px (md), 48px (lg)
Background: transparent (hover: color-bg-secondary)
Border: none / 1px solid color-border-default (variant)
Border radius: radius-md or radius-full
```

---

#### Button States

Every button variant must implement all 5 states:

| State | Visual Treatment |
|-------|-----------------|
| Default | As specified above |
| Hover | 8% darker background (or border visible for ghost) |
| Active / Pressed | 16% darker, scale(0.98) |
| Focused | Default + focus ring |
| Disabled | 40% opacity, cursor-not-allowed, no hover effects |
| Loading | Replace label with spinner + "Loading..." for screen readers |

**Loading State Implementation:**
```html
<button disabled aria-label="Saving…">
  <span aria-hidden="true"><Spinner /></span>
  <span class="sr-only">Saving…</span>
</button>
```

---

#### Button Sizing

| Size | Height | Padding H | Font Size | Use Case |
|------|--------|-----------|-----------|----------|
| `btn-xs` | 28px | 10px | text-xs | Dense tables, compact toolbars |
| `btn-sm` | 32px | 12px | text-sm | Secondary actions, sidebars |
| `btn-md` | 40px | 20px | text-sm | Default — most contexts |
| `btn-lg` | 48px | 24px | text-base | Primary CTAs, hero sections |
| `btn-xl` | 56px | 32px | text-lg | Marketing, onboarding |

---

#### Button Anti-Patterns

- **Do not use multiple primary buttons in one context.** If you have two primaries, you have zero primaries.
- **Do not use disabled buttons to block navigation without explanation.** Show a tooltip or inline error explaining why it's disabled.
- **Do not use button text as navigation labels** ("Go to Dashboard" → link, not button).
- **Do not change button width on state change** (e.g., expanding on hover). Width should be stable.
- **No icon-only buttons without tooltips.** No exceptions.

---

### 4.3 Forms & Inputs

Forms are where the most critical user mistakes happen. Every form element must be designed for error prevention first, data entry second.

#### Input Field Anatomy

```
[Label Text]                               [Optional / Required indicator]
[Input field — with placeholder text                                      ]
[Helper text or error message]
```

**Label:** Always above the field. Never inside the field (placeholder is not a label). Never to the left.

**Placeholder:** Supplementary hint, not a label. Content should demonstrate format, not repeat the label. ("e.g., john@email.com" not "Email address")

**Helper Text:** Default state. Provides context before the user starts. ("Your username will be publicly visible")

**Error Message:** Replaces helper text on validation failure. Red, with an error icon. Specific and actionable.

**Required / Optional Indicator:** Mark the minority. If most fields are required, mark optional fields "Optional". If most are optional, mark required fields with an asterisk (with a legend).

---

#### Input States

| State | Visual |
|-------|--------|
| Default | `border: 1px solid color-border-default` |
| Hover | `border-color: color-border-strong` |
| Focused | `border-color: color-border-focus (blue)` + focus ring |
| Filled | Same as default (do not change visual weight of filled inputs) |
| Error | `border-color: red-500` + error icon on right |
| Success | `border-color: green-500` + check icon on right (use sparingly) |
| Disabled | `background: neutral-100`, `color: neutral-400`, cursor-not-allowed |
| Read-only | `background: neutral-50`, no border change, no hover effect |

---

#### Input Sizes

| Size | Height | Font | Padding H | Use |
|------|--------|------|-----------|-----|
| `input-sm` | 32px | text-sm | 10px | Dense data forms, filter fields |
| `input-md` | 40px | text-base | 14px | Default |
| `input-lg` | 48px | text-lg | 16px | Prominent single-field forms |

---

#### Textarea

- Min height: 80px (3 lines)
- Resize: `resize: vertical` — never `resize: none`
- Character count: show when there's a max. Format: `"142 / 500"`. Turn red at 90% capacity.

---

#### Select & Dropdowns

- Never use native `<select>` for product UI. Use a custom dropdown component.
- Show a search field for lists > 10 items
- Virtual-scroll for lists > 50 items
- Group options visually when multiple categories exist
- Mark the currently selected item with a checkmark, not just highlight

---

#### Checkbox, Radio, Toggle

**Checkbox:** Square, 16px, border-radius: 4px. Indeterminate state supported. Group related checkboxes with a header label.

**Radio:** Circular, 16px. Always in a group (radio buttons are never used alone — use checkbox for single toggle). Never pre-select a destructive or high-commitment radio option.

**Toggle:** For immediate on/off state changes. Must show current state as text ("On" / "Off" or label change). Use `role="switch"` and `aria-checked`. Height: 24px, width: 44px. Transition: 150ms ease.

---

#### Form Validation Rules

1. **Validate on blur (leaving field), not on every keystroke.** Keystroke validation is aggressive and interrupts the user.
2. **Exception:** Format validation (e.g., credit card formatting) can give immediate positive feedback on keystrokes. Error validation waits for blur.
3. **Validate the whole form on submit** even if individual fields were already validated.
4. **Move focus to the first error** on failed submission.
5. **Do not clear fields on error.** Never. The user typed that. Keep it.
6. **Inline validation > modal validation** > page reload validation (avoid this entirely).

---

### 4.4 Navigation Patterns

#### Primary Navigation (Web)

**Sidebar Navigation** (default for dashboards and product UIs):
- Width: 240px (collapsed: 60px icon-only)
- Background: `color-bg-secondary`
- Active item: `color-bg-accent` at 10% opacity + `color-text-accent` + left border 2px solid
- Hover state: `color-bg-tertiary`
- Groups: Collapsible sections with chevron. Default: all expanded.
- Footer items: Settings, Help, User profile (separate from main nav items)

**Top Navigation** (for marketing sites, simple apps):
- Height: 64px
- Sticky by default
- Background: white with `elevation-sm` on scroll
- Max logo width: 120px
- CTA button in top-right corner (Primary or Secondary variant)

---

#### Breadcrumbs

Use breadcrumbs when:
- Navigation depth is > 2 levels
- Users frequently navigate between levels
- The current page title doesn't fully convey location

Breadcrumb separator: `/` (forward slash) — not `>`, not `→`

Truncation: If breadcrumb exceeds 3 levels deep, collapse middle levels behind an ellipsis popover.

---

#### Tabs

- Use tabs to switch between views of the same object/context.
- Do not use tabs for navigation between different sections of an app.
- Tab count: 2–6. More than 6 tabs → consider a different navigation pattern.
- Scrollable tabs for overflow on mobile.
- Active tab: underline 2px `color-bg-accent` + `color-text-accent`
- Never use tabs inside tabs (nested tabs).

---

#### Pagination vs. Infinite Scroll

**Use pagination when:**
- Users need to jump to a specific page
- Users compare items across pages
- Content is clearly indexed and discrete

**Use infinite scroll when:**
- Content is feed-like (social, notifications, activity logs)
- Users are browsing/exploring, not seeking a specific item

**Hybrid "Load More" button** is acceptable for medium-length lists where neither pattern is clearly superior.

---

### 4.5 Cards & Containers

Cards are surfaces. They group related information and suggest it belongs together. Use them deliberately.

#### Card Variants

**Default Card:**
```
background: color-bg-tertiary
border: 1px solid color-border-default
border-radius: radius-lg (12px)
padding: spacing-6 (24px)
elevation: elevation-sm (hover: elevation-md)
```

**Flat Card (on colored background):**
```
Same as default but elevation-flat, border: 1px solid color-border-default
```

**Interactive Card (clickable):**
```
cursor: pointer
hover: elevation-md, translate(0, -1px)
active: elevation-sm, translate(0, 0)
transition: 200ms ease
```

**Feature Card (marketing/onboarding):**
```
padding: spacing-8 (32px)
border-radius: radius-xl (16px)
May include gradient header area (marketing only)
```

---

#### Card Anatomy

```
[Optional header area — icon or image]
[Title — text-xl, font-semibold]
[Description — text-base, neutral-500]
[Content area]
[Footer — actions, metadata]
```

Rules:
- Do not put primary actions inside cards unless the card itself is the unit of interaction (e.g., a task card with "Complete" button)
- Card titles should be concise (3–7 words)
- Do not mix card sizes within the same grid unless there is a clear visual hierarchy reason

---

### 4.6 Modals & Overlays

Modals interrupt the user's flow. Use them sparingly. Every modal you add should be justified.

#### When to Use a Modal

**Use modals for:**
- Confirmation of destructive or irreversible actions
- Form completion that requires focus (not embedded in page flow)
- Media preview (images, videos)
- Short tasks that would otherwise require a new page

**Do not use modals for:**
- Error messages (use inline or toast)
- Complex multi-step flows with heavy data entry (use a full page or drawer instead)
- Information display with no user action required (use a tooltip or drawer)

---

#### Modal Sizes

| Size | Width | Use |
|------|-------|-----|
| `modal-sm` | 400px | Confirmations, simple one-field forms |
| `modal-md` | 560px | Standard forms, short content |
| `modal-lg` | 720px | Complex forms, media preview |
| `modal-xl` | 960px | Broad content review, multi-step flows |
| `modal-fullscreen` | 100vw × 100vh | Complex tools, code editors, canvas |

---

#### Modal Behavior

- **Opening:** fade in + scale from 0.95 to 1.0, 200ms ease-out
- **Closing:** fade out + scale from 1.0 to 0.97, 150ms ease-in
- **Backdrop:** `rgba(0,0,0,0.4)`, fade in 200ms
- **Close triggers:** Escape key, backdrop click, explicit close button. Never remove any of these.
- **Focus trap:** Focus must be locked inside the modal while it's open.
- **Focus return:** When a modal closes, focus returns to the element that opened it.
- **Scroll:** Body scroll must be locked when a modal is open.
- **Stack depth:** Never stack modals. A modal triggered from a modal is a UX failure. Redesign the flow.

---

#### Drawers / Side Panels

Drawers are preferable to modals for:
- Flows that require more horizontal space
- Review/edit workflows where the user references underlying content
- Settings and configuration panels

| Size | Width |
|------|-------|
| `drawer-sm` | 320px |
| `drawer-md` | 480px |
| `drawer-lg` | 640px |
| `drawer-xl` | 800px |

Drawer animation: slide in from right (or left for language-specific directionality), 250ms ease-out.

---

### 4.7 Tables & Data Grids

Tables are for comparing structured data across rows. They are not for layout.

#### Table Anatomy

```
[Toolbar: title, search, filters, bulk actions, export]
[Header row: sortable column labels]
[Data rows]
[Pagination or infinite scroll]
```

---

#### Column Types

| Type | Alignment | Notes |
|------|-----------|-------|
| Text | Left | Default |
| Number | Right | Align numbers right so decimal points stack |
| Currency | Right | Include currency symbol, 2 decimal places |
| Date | Left or Right | Use relative dates for < 7 days ("3 days ago"), absolute for older |
| Status | Center | Use badge component |
| Boolean | Center | Checkmark / dash |
| Action | Right | Always last column |

---

#### Table States

- **Loading:** Show skeleton rows (4–8 rows of pulsing gray bars), not a spinner
- **Empty:** Full empty state component (see 4.9) — not just blank rows
- **Error:** Inline error message with retry action
- **Row hover:** `color-bg-secondary` background
- **Row selected:** `blue-50` background + left border 2px `blue-500`

---

#### Sorting

- Clickable column headers
- Sort indicator: up/down chevron icon, `icon-sm`, appears on hover, prominent when active
- Default unsorted: no indicator (or neutral double-chevron)
- Multi-sort: supported, indicated with numbered sort priority badge

---

#### Density Options

Offer a density control for power users:

| Density | Row Height | Padding V |
|---------|-----------|-----------|
| Compact | 36px | 8px |
| Default | 48px | 12px |
| Comfortable | 60px | 16px |

---

### 4.8 Feedback Components

#### Toast Notifications

Toasts are ephemeral, non-blocking feedback. They confirm that something happened.

**Positioning:** Bottom-right for desktop. Bottom-center for mobile.

**Duration:**
- Info / Success: 4 seconds auto-dismiss
- Warning: 6 seconds auto-dismiss (or persistent with explicit dismiss)
- Error: Persistent (must be explicitly dismissed — errors don't go away by themselves)

**Types:**

| Type | Icon | Color |
|------|------|-------|
| Success | CheckCircle (fill) | green-600 |
| Error | XCircle (fill) | red-600 |
| Warning | WarningCircle (fill) | amber-500 |
| Info | Info (fill) | blue-600 |

**Stacking:** Max 3 toasts visible simultaneously. Oldest toast moves up as new ones arrive. Queue additional toasts.

**Content:** One concise sentence. Optional action link (e.g., "View details" or "Undo"). Never more than 2 lines of text in a toast.

---

#### Banners & Alerts

Banners are persistent, page-level feedback. They convey system status or critical information.

- Full-width, top of content area (below sticky navigation)
- Dismissible with X button (except critical system alerts)
- Icon + bold title + supporting body copy
- Can include action button (secondary variant)

---

#### Progress Indicators

**Linear Progress Bar:**
- Height: 4px (standard), 8px (prominent)
- Show label above with percentage or step description
- Use for file uploads, multi-step processes

**Circular Spinner:**
- Sizes: 16px (inline), 24px (component-level), 40px (page-level)
- Only use for indeterminate processes
- Do not use for processes > 10 seconds — use linear progress with estimate instead

**Skeleton Screens:**
- Preferred over spinners for initial content load
- Match the rough shape of the content being loaded
- Use a subtle shimmer animation
- Do not show skeletons for < 300ms loads (use optimistic UI instead)

---

### 4.9 Empty States

Empty states are screens with no content. They are opportunities, not voids.

#### Empty State Types

1. **First-use empty state:** User has never created any data. Educate and motivate.
2. **User-cleared empty state:** User deleted everything. Acknowledge and offer re-creation.
3. **Search/filter empty state:** No results match. Explain why and offer next steps.
4. **Error empty state:** Something broke. Be honest, explain, and offer a path forward.

---

#### Empty State Anatomy

```
[Illustration or icon — icon-2xl or SVG]
[Title — text-2xl, font-semibold]
[Description — text-base, neutral-500, max 2 sentences]
[Primary CTA — what they should do next]
[Optional secondary link — "Learn more" or "View documentation"]
```

**Illustration guidelines:**
- Use the empty state illustration set from the design library
- Illustrations should be relevant (a "no projects" empty state shouldn't show a broken robot)
- Keep illustrations light and approachable
- Never use stock photos in empty states

**Copy guidelines (see also Section 10.4):**
- Title: Say what's missing ("No projects yet")
- Description: Brief context + value ("Create a project to organize your work and collaborate with your team")
- CTA: Action-oriented ("Create your first project")

---

## 5. Interaction & Motion Design

### 5.1 Animation Principles

Motion at Company X serves function. We do not animate for spectacle. Every animation must:

1. **Orient** — help the user understand where they are in space (page transitions, modals)
2. **Inform** — communicate state change (loading, success, error)
3. **Delight** — make interactions feel real and satisfying (but only after function is served)

We follow the **functional animation hierarchy:**
```
Orientation > Information > Delight
```

When in conflict, orientation and information always win. A slower, richer animation that distracts from user task is always worse than a simple, fast one that informs.

---

### 5.2 Easing & Timing

**Easing Curves:**

| Token | Curve | Use |
|-------|-------|-----|
| `ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | Default — elements moving within the screen |
| `ease-decelerate` | `cubic-bezier(0.0, 0, 0.2, 1)` | Elements entering screen (modals, drawers) |
| `ease-accelerate` | `cubic-bezier(0.4, 0, 1, 1)` | Elements leaving screen |
| `ease-sharp` | `cubic-bezier(0.4, 0, 0.6, 1)` | Temporary / quick state changes |

**Duration Scale:**

| Token | Duration | Use |
|-------|----------|-----|
| `duration-75` | 75ms | Icon swaps, hover effects |
| `duration-100` | 100ms | Button presses, color transitions |
| `duration-150` | 150ms | Dropdown open/close, tooltip appear |
| `duration-200` | 200ms | Modal/drawer enter, card expand |
| `duration-300` | 300ms | Page transitions, complex component entry |
| `duration-500` | 500ms | Onboarding, guided tours |

**Rule of Thumb:** UI feedback animations should finish before the user's eye tracking catches up. For most interactions, this is under 200ms. Long animations (300ms+) are reserved for spatial orientation events.

---

### 5.3 Transition Patterns

**Page Transitions:**
- Default: fade (opacity 0→1, 200ms ease-decelerate)
- Drill-down navigation: slide left (new page), slide right (back)
- Modal-like pages: scale up from 0.97 + fade

**Component Transitions:**
- Open: combine fade + scale or fade + translate
- Close: reverse of open, slightly faster
- State change (e.g., icon swap): cross-fade at 100ms

**List Reordering:**
- Items animate to new position with 200ms `ease-standard`
- Dragged item: `elevation-xl`, slight scale-up (1.02)

---

### 5.4 Microinteractions

Microinteractions are the small moments that make an interface feel alive. They are not decoration — they confirm actions and provide feedback.

**Examples in the Company X design system:**

| Interaction | Microinteraction |
|-------------|-----------------|
| Like / Favorite | Heart icon fills, springs with scale 1.3 → 1.0 (150ms) |
| Toggle on | Thumb slides, background fades to green (150ms) |
| Form submit | Button scales to 0.98 on press, shows spinner on submit |
| Successful save | Checkmark animates in, label changes to "Saved" for 2s |
| Drag start | Card lifts (elevation-xl), cursor changes to `grabbing` |
| Delete confirm | Red shake animation (2-cycle, 200ms total) on item |
| Copy to clipboard | Icon swaps from Copy to Check for 2s |
| Notification bell | Bell rings (rotate ±15deg, 2 cycles, 300ms) on new notification |

**Microinteraction rules:**
- Never loop animations. Microinteractions fire once per trigger.
- Keep microinteraction duration under 300ms
- Always respect `prefers-reduced-motion`

---

## 6. Layout & Composition

### 6.1 Responsive Grid System

(See detailed grid specs in Section 3.4)

Container max-widths:

| Breakpoint | Max Width |
|------------|-----------|
| Mobile | 100% (16px margins) |
| Tablet | 768px effective |
| Desktop | 1024px effective |
| Wide Desktop | 1280px effective |
| Ultra-wide | 1440px effective (centered, with large side margins) |

Never design for resolutions wider than 1440px. Content should not stretch beyond readable line lengths at ultra-wide.

---

### 6.2 Page Layouts

**Dashboard Layout:**
```
[Top Nav — 64px fixed]
[Sidebar — 240px fixed] [Main Content Area — fluid]
```

**Single-column Content Layout (docs, articles):**
```
[Top Nav — 64px]
[Content — max-width: 720px, centered]
```

**Two-column Layout (form + preview, settings):**
```
[Left Panel — 380px fixed or 35%] [Right Panel — fluid]
```

**Three-column Layout (email client, messaging):**
```
[Nav — 64px] [List — 320px] [Detail — fluid]
```

---

### 6.3 Content Hierarchy

Visual hierarchy tells users what to look at first. Use these tools in order:

1. **Size** — large = important
2. **Weight** — bold = important
3. **Color** — brand color = interactive or important
4. **Position** — top-left = most important (for LTR layouts)
5. **Whitespace** — isolated = important
6. **Motion** — moving = attention-grabbing (use sparingly)

Never use all six signals on the same element. The hierarchy collapses when everything is emphasized.

---

## 7. User Flows & Navigation Architecture

### 7.1 Information Architecture

Company X's product information architecture follows a three-tier model:

**Tier 1 — Global Navigation (always accessible):**
- Home / Dashboard
- [Core Feature 1]
- [Core Feature 2]
- [Core Feature 3]
- Notifications
- Settings
- Profile

**Tier 2 — Feature Navigation (contextual to active section):**
- Tabs, sidebar sub-navigation, or breadcrumbs depending on content depth

**Tier 3 — Object-level Navigation (within a specific record):**
- Tabs within an object (e.g., Overview, Activity, Settings within a Project)

**Cardinal rule:** A user should never need more than 3 clicks to reach any primary feature from any other primary feature.

---

### 7.2 Core User Journeys

Every critical user journey is mapped in Figma with the following documentation:

- **Entry point(s)** — where does this journey start?
- **Success state** — what does completion look like?
- **Decision points** — where does the user make a choice?
- **Error states** — what can go wrong, and how do we recover?
- **Exit points** — how does the user leave, and where do they go?

The five core journeys are documented in the Figma "User Flows" file:
1. Signup & Onboarding
2. Core Value Delivery (first meaningful action)
3. Collaboration / Sharing
4. Settings & Preferences
5. Upgrade / Billing Flow

---

### 7.3 Onboarding Flow

First impressions are disproportionately important. Onboarding determines whether new users discover value before they churn.

**Onboarding principles:**
1. **Value before account completion.** Don't gate the product behind a full profile. Let users experience value immediately.
2. **Progressive disclosure of setup.** Surface the minimum required information first (email + password or OAuth). Collect additional info contextually as users encounter features that need it.
3. **Celebrate the first key action.** The moment a user completes their first meaningful action (first project created, first item imported, first collaborator invited) — make it memorable.
4. **Make skipping explicit.** Users who want to skip setup steps must be able to. An optional step with no skip affordance feels mandatory and creates friction.

**Onboarding checklist component:**
- Show progress (e.g., "3/5 steps completed")
- Celebrate completed steps with a visual indicator
- Allow dismissal when at least 1 step is complete
- Link directly to the relevant feature from each checklist item

---

### 7.4 Error & Edge Case Flows

Every user journey has a corresponding error flow. Error flows are not afterthoughts — they are documented with the same rigor as the happy path.

**Common error scenarios that must have designed flows:**
- Network timeout during form submission
- Session expiration mid-task
- Permission denied (access to a resource the user doesn't have rights to)
- Empty search results
- File upload failure
- Payment failure during upgrade flow
- Invalid link / 404 (deep link shared to deleted content)
- Browser incompatibility

**For each error flow, define:**
- What the user sees
- What options they have
- Whether their work was preserved
- What happens to the system state

---

## 8. Accessibility (a11y)

Accessibility is not a separate track from design. It is a dimension of design quality. An inaccessible product is an incomplete product.

### 8.1 WCAG Compliance Standards

Company X targets **WCAG 2.1 Level AA** compliance as the minimum bar across all products.

We target Level AAA for the following criteria where feasible:
- Color contrast for normal text (7:1 instead of 4.5:1)
- No keyboard trap
- Sign language (not currently in scope, but tracked)

---

### 8.2 Color Contrast Requirements

| Text Type | Minimum Contrast (AA) | Target Contrast (AAA) |
|-----------|----------------------|----------------------|
| Normal text (< 18px) | 4.5:1 | 7:1 |
| Large text (≥ 18px or ≥ 14px bold) | 3:1 | 4.5:1 |
| UI components & graphics | 3:1 | — |
| Decorative elements | No requirement | — |

**Check contrast at every step of component design.** Use the Figma A11y plugin or the WebAIM Contrast Checker. Log contrast ratios in the component spec.

**High-risk areas:**
- Text on `neutral-400` or lighter — always fails for normal text
- Blue-on-white (`blue-400` and lighter) — often insufficient
- White text on `amber-400` — fails
- Gray on gray (`neutral-300` on `neutral-200`) — always fails

---

### 8.3 Keyboard Navigation

All interactive elements must be reachable and operable via keyboard.

**Focus order:**
- Logical, top-left to bottom-right
- Never use `tabindex > 1` (only `tabindex="0"` and `tabindex="-1"`)
- Custom widgets (date pickers, carousels) must follow ARIA patterns from the ARIA Authoring Practices Guide

**Standard keyboard patterns:**

| Action | Key |
|--------|-----|
| Navigate between items | Tab / Shift+Tab |
| Activate button / link | Enter or Space |
| Close modal / popover | Escape |
| Navigate list / menu | Arrow keys |
| Select checkbox | Space |
| Select radio | Space or arrow keys |

---

### 8.4 Screen Reader Guidelines

**Semantic HTML first.** Use `<button>`, `<a>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<label>`, `<input>` correctly before reaching for ARIA. ARIA is a supplement, not a replacement.

**Required ARIA attributes:**

| Component | Required ARIA |
|-----------|---------------|
| Icon button | `aria-label="..."` |
| Toggle / switch | `role="switch"`, `aria-checked` |
| Modal | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` |
| Alert / toast | `role="alert"` or `aria-live="polite"` |
| Progress | `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax` |
| Loading | `aria-busy="true"` on the region being updated |
| Tabs | `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected` |

**Test with real screen readers:**
- macOS + VoiceOver
- Windows + NVDA + Firefox
- iOS + VoiceOver
- Android + TalkBack

Screen reader testing is part of the QA checklist for every component.

---

### 8.5 Motion & Vestibular Sensitivity

Some users experience nausea, dizziness, or disorientation from on-screen motion. We respect the `prefers-reduced-motion` media query.

**Implementation:**
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**What this means for animations:**
- All entrance/exit animations collapse to instant
- Microinteractions collapse to instant state changes
- Skeleton screens may still use a slower, gentler pulse (not a fast shimmer)
- Auto-playing video backgrounds must be paused under reduced motion

---

## 9. Responsive & Mobile Design

### 9.1 Breakpoints

| Token | Min Width | Target Device |
|-------|-----------|---------------|
| `screen-xs` | 0px | Small phones (SE, older Android) |
| `screen-sm` | 480px | Standard phones |
| `screen-md` | 768px | Tablets, large phones landscape |
| `screen-lg` | 1024px | Tablets landscape, small desktops |
| `screen-xl` | 1280px | Standard desktop |
| `screen-2xl` | 1440px | Large desktop, MacBook 14"+ |
| `screen-3xl` | 1920px | Ultra-wide, external monitors |

Design at these resolutions in Figma:
- 375px (iPhone SE / standard mobile)
- 768px (iPad portrait)
- 1280px (standard desktop)
- 1440px (large desktop)

---

### 9.2 Mobile-First Principles

1. **Start with mobile layout.** The mobile layout is the constraint. Desktop is the enhancement.
2. **Remove before hiding.** Don't hide mobile content behind `display: none`. If something doesn't make the cut for mobile, reconsider whether it belongs on desktop either.
3. **Thumb zone aware.** Primary actions belong in the bottom half of the screen on mobile (below the fold in terms of reach, not content). Navigation should be reachable with the thumb.
4. **Content precedes chrome.** Mobile screens are small. Navigation and headers should not eat more than 80px.

---

### 9.3 Touch Target Standards

**Minimum touch target size: 44×44px.** This is Apple's guideline and Google's recommendation. It is our standard.

- Actual visible element can be smaller, but the invisible touch area must be at least 44×44px
- Implement using `padding` or `min-height`/`min-width` on the hit area
- Spacing between adjacent touch targets: minimum 8px

---

### 9.4 Native App Considerations

When designing for iOS and Android specifically, follow platform conventions for:

**iOS:**
- Bottom navigation (tab bar) for top-level navigation
- Swipe back gesture support (right edge swipe)
- Dynamic Type support (user font size scaling)
- Safe area insets respected on all screens

**Android:**
- Bottom navigation bar or Navigation Drawer
- Back button / gesture support
- Material Design system icons alongside Phosphor for platform-native moments
- Edge-to-edge display with proper inset handling

Deviating from platform conventions must be justified by user research showing that users are better served by the deviation.

---

## 10. Content & Writing Guidelines (UX Copy)

UX copy is part of the design. A perfectly designed form with a confusing label fails. A great error message saves a user who a great layout would have lost.

### 10.1 Voice & Tone

**Company X's voice is:**
- **Clear** — we use plain language. Not "Initiate the onboarding sequence." Just "Get started."
- **Direct** — we tell users what to do, not what the system will do. "Delete this project" not "This project will be deleted."
- **Warm** — we are not cold or robotic, but we are not over-enthusiastic either. No "Amazing! Your account is ready! 🎉🎉🎉"
- **Honest** — we don't oversell. If a feature has limitations, we say so. If something went wrong, we say what.

**Tone adapts to context:**

| Context | Tone |
|---------|------|
| Onboarding, first use | Encouraging, slightly warmer |
| Normal product use | Neutral, efficient |
| Errors | Apologetic but calm. No drama, no exclamation marks. |
| Destructive actions | Serious, precise |
| Empty states | Helpful, motivating |
| Success | Brief celebration, then move on |

---

### 10.2 Microcopy Patterns

**Labels:** Nouns or short noun phrases. Title case only for navigation labels. Sentence case for everything else.

| Context | Case | Example |
|---------|------|---------|
| Navigation | Title Case | "Project Settings" |
| Buttons | Sentence case | "Create project" |
| Input labels | Sentence case | "Project name" |
| Error messages | Sentence case | "This field is required" |
| Toast messages | Sentence case | "Changes saved successfully" |
| Page titles | Title Case | "All Projects" |

**Placeholder text:** Lowercase, format hints, no periods. "e.g., Product Roadmap 2026"

---

### 10.3 Error Messages

The anatomy of a good error message:
1. **What happened** (in plain language, not system error codes)
2. **Why it happened** (if knowable)
3. **What the user can do** (specific action)

**Bad:** "Error 422: Unprocessable Entity"  
**Bad:** "Something went wrong. Please try again."  
**Good:** "We couldn't save your changes. Check your internet connection and try again."

**For form validation errors:**
- Tell the user what the constraint is, not just that they failed
- Bad: "Invalid email"
- Good: "Enter a valid email address (like name@company.com)"

---

### 10.4 Empty State Copy

| Element | Formula | Example |
|---------|---------|---------|
| Title | "[No X] yet" | "No projects yet" |
| Description | "[Feature benefit statement]" | "Create a project to keep your work organized and collaborate with your team." |
| CTA | "Create [your/a] [X]" | "Create your first project" |
| After user-cleared | "Your [X] is empty" | "Your inbox is empty" |

---

### 10.5 Button & CTA Labels

**Use verb + noun for primary CTAs.** "Create project" not "Create", not "Continue", not "Submit."

Exceptions:
- "Save" and "Cancel" are standard enough to stand alone
- Single-button confirmation dialogs can use "Done" or "Got it"
- Destructive confirmations must use the specific action: "Delete project" not "Yes, delete" not "OK"

**Pairs:**
- Save / Cancel (not Save / Discard)
- Create / Cancel (not Create / Never mind)
- Delete [noun] / Cancel (not Delete / No)
- Confirm / Cancel (only if no better specific verb exists)

---

## 11. Design Tokens

### 11.1 Token Architecture

Company X uses a three-tier token system:

```
Primitive Tokens
  → Semantic Tokens
    → Component Tokens
```

- **Primitive tokens** are raw values (hex codes, px values, named font weights). They never appear in components.
- **Semantic tokens** give meaning to primitives. `color-text-primary: neutral-900`. These are what you use in component styles.
- **Component tokens** are overrides for specific components. `button-primary-bg: color-bg-accent`. These exist for components that need to deviate from semantic defaults in a controlled way.

Tokens are defined in the `design-tokens` repository and exported to:
- CSS variables (web)
- Swift variables (iOS)
- Kotlin/XML values (Android)
- Figma Variables (design)

---

### 11.2 Semantic Token Reference

Full token reference is maintained in the `design-tokens` repository. The most frequently used:

```
/* Backgrounds */
--color-bg-primary
--color-bg-secondary
--color-bg-tertiary
--color-bg-accent
--color-bg-success
--color-bg-error
--color-bg-warning

/* Text */
--color-text-primary
--color-text-secondary
--color-text-disabled
--color-text-inverse
--color-text-accent
--color-text-success
--color-text-error

/* Borders */
--color-border-default
--color-border-strong
--color-border-focus
--color-border-error

/* Spacing */
--spacing-1 through --spacing-24

/* Typography */
--font-size-xs through --font-size-7xl
--font-weight-normal: 400
--font-weight-medium: 500
--font-weight-semibold: 600
--font-weight-bold: 700
--font-weight-extrabold: 800

/* Radii */
--radius-sm through --radius-full

/* Shadows */
--elevation-flat through --elevation-xl
```

---

### 11.3 Dark Mode Tokens

All semantic tokens have dark mode equivalents. The swap happens at the `:root[data-theme="dark"]` level. No component-level dark mode CSS is needed or permitted.

Dark mode is not an inversion of light mode. It is a separately designed set of values that share the same semantic meaning.

Key dark mode decisions:
- Surfaces don't go fully black. `neutral-950` as main background, `neutral-900` for elevated surfaces.
- Use borders more liberally in dark mode to define edges (shadows don't work as well on dark).
- Reduce saturation of accent colors slightly (e.g., `blue-500` instead of `blue-600`).
- Never use pure white text on dark backgrounds. Use `neutral-50` or `neutral-100`.

---

## 12. Theming & Dark Mode

**Dark mode must be a first-class, fully designed experience.** It is not toggled on at 10pm and forgotten.

**System preference respected:** Default to `prefers-color-scheme` detection. Allow manual override in user settings with persistence.

**Theming architecture:**
- Themes are defined as token sets in Figma Variables
- CSS variables are swapped at the root level via `data-theme` attribute
- No theme-specific class overrides on individual components
- Third-party embeds must respect the host theme

**Testing dark mode:** Every new screen must be reviewed in both light and dark mode before shipping. Dark mode screenshots are included in design reviews.

---

## 13. Design-to-Dev Handoff Process

### 13.1 Figma File Structure

All product design files follow this structure:

```
[Product Name] — Design File
  ├── 🔒 _Library (do not edit)
  │   ├── Color Styles
  │   ├── Text Styles
  │   └── Component Library
  ├── 📋 Flows
  │   ├── [Flow Name] (e.g., Onboarding)
  │   │   ├── 00 - Flow Overview
  │   │   ├── 01 - Screen Name
  │   │   └── ...
  ├── 🔬 Explorations
  │   └── (working space — not reviewed)
  ├── ✅ Ready for Dev
  │   └── (specs reviewed and approved)
  └── 📦 Archive
      └── (shipped or deprecated)
```

---

### 13.2 Annotation Standards

All frames in "Ready for Dev" must be annotated with:
- Component names (matching development component names exactly)
- Spacing values (using spacing tokens, not raw px values)
- State variants (with separate annotated frames for each state)
- Responsive behavior notes
- Animation specs (timing, easing, trigger)
- Accessibility notes (ARIA roles, keyboard behavior, focus order)

Annotations are done with the **Figma Tokens + Annotations** plugin. Raw redline annotations are not sufficient.

---

### 13.3 Redline Specs

For custom components not in the library, provide:
- All dimensions in tokens (spacing-4, not 16px)
- Border radius in tokens
- Color values in semantic token names, not hex
- Typography in token names (text-sm, font-semibold), not raw values
- All interactive states documented

---

### 13.4 Developer Handoff Checklist

Before marking a design "Ready for Dev":

- [ ] All components use library components (no detached instances)
- [ ] All spacing uses tokens (no raw pixel values in padding/margin)
- [ ] All colors use semantic tokens
- [ ] All variants and states designed (default, hover, active, disabled, loading, error)
- [ ] Mobile and desktop frames both present
- [ ] Dark mode version present
- [ ] Empty states designed
- [ ] Error states designed
- [ ] Loading states designed
- [ ] Accessibility annotations present
- [ ] Animation specs documented (if non-trivial)
- [ ] Edge cases documented (long text, overflow, many items, zero items)
- [ ] Design review completed and approved by senior designer
- [ ] Stakeholder sign-off received
- [ ] Figma prototype linked (for flows requiring motion context)

---

## 14. Research & Testing Framework

### 14.1 Usability Testing Protocol

**When to run usability tests:**
- Before finalizing any new flow (formative testing)
- Before shipping any major redesign (summative testing)
- When analytics show unexpected drop-off in a funnel
- When qualitative feedback suggests confusion

**Standard test setup:**
- 5 participants for qualitative insights (Nielsen's law: 5 users reveal 85% of usability issues)
- 8–10 participants for quantitative benchmarking (task success rate, time-on-task)
- Moderated sessions: 45–60 minutes
- Unmoderated sessions: 15–20 minutes

**Task design rules:**
- Frame tasks as user goals, not as interface instructions ("You need to share this project with a colleague" not "Click the Share button")
- Include a realistic scenario that sets context
- Avoid leading language

---

### 14.2 Heuristic Evaluation

All major flows are evaluated against Nielsen's 10 Usability Heuristics before user testing:

1. Visibility of system status
2. Match between system and the real world
3. User control and freedom
4. Consistency and standards
5. Error prevention
6. Recognition rather than recall
7. Flexibility and efficiency of use
8. Aesthetic and minimalist design
9. Help users recognize, diagnose, and recover from errors
10. Help and documentation

Rating scale: 0 (not a problem) → 4 (usability catastrophe). Issues rated 3+ must be addressed before launch.

---

### 14.3 A/B Testing Guidelines

**When to A/B test:**
- When we have a hypothesis about improving a measurable metric
- When two designs have strong advocates and no clear winner from research
- When the change is significant enough to risk regression

**When NOT to A/B test:**
- To avoid making a design decision ("let the data decide" is not a strategy)
- When the sample size is too small to reach significance
- For accessibility improvements (never A/B test between accessible and inaccessible designs)

**Minimum requirements:**
- Hypothesis documented before test begins
- Primary metric defined
- Guardrail metrics defined (what can't get worse)
- Minimum sample size calculated (use power analysis)
- Test duration: minimum 2 weeks to capture weekly cycles

---

### 14.4 Metrics & Success Criteria

**Usability metrics tracked per major flow:**

| Metric | Definition | Target |
|--------|------------|--------|
| Task Completion Rate | % of users who complete the task | > 80% for core flows |
| Time on Task | Median time to complete | Established baseline, trending down |
| Error Rate | % of tasks with at least one error | < 20% for new flows |
| Satisfaction (SUS) | System Usability Scale score | > 68 (industry average) |
| Drop-off Rate | % who abandon mid-flow | Establish baseline per flow |

**Product metrics connected to design decisions:**
- Activation rate (first key action within X days)
- Feature adoption rate
- Support ticket volume for specific flows
- NPS / CSAT

---

## 15. Design Process & Workflow

### 15.1 Double Diamond Process

Company X's design process follows an adapted Double Diamond:

```
DISCOVER        DEFINE          DEVELOP         DELIVER
────────────    ─────────       ─────────────   ──────────
User research → Problem         Ideation →      Spec →
Competitor      framing →       Prototyping →   Handoff →
analysis        Success         Usability       Build →
Analytics       metrics         testing         QA →
                                                Ship
```

**Key principle:** The first diamond (Discover + Define) is divergent then convergent. Do not jump to solutions before the problem is defined. This is where the most expensive design mistakes are prevented.

---

### 15.2 Design Sprint Structure

For major new features, Company X runs **4-day design sprints** (adapted from Google Ventures):

| Day | Activity |
|-----|----------|
| Monday | Understand — Map the problem, interview stakeholders, set a target |
| Tuesday | Sketch — Crazy 8s, solution sketches, decision storyboard |
| Wednesday | Prototype — High-fidelity prototype of the winning concept |
| Thursday | Test — 5 user interviews with the prototype |

Sprint outputs:
- Tested prototype
- Research synthesis (what worked, what didn't)
- Go/No-Go recommendation
- Next steps for full design work if proceeding

---

### 15.3 Critique & Review Process

**Weekly Design Critique (Friday, 1 hour):**
- Any designer can present work
- Work is presented as problems + approaches, not polished solutions
- Feedback is framed as questions and observations, not directives
- Critique is focused on the work, not the person

**Design Review (before handoff):**
- Presented to: senior designer, PM lead, engineering lead
- Required outputs: Flow coverage, component inventory, edge cases, accessibility review
- Gating criteria: must pass handoff checklist before entering sprint

**Requesting a new component:**
When a design need isn't met by the existing library:
1. Check if a close variant exists that could be extended
2. Post a Figma link in `#design-systems` with the use case
3. Design Systems team reviews within 3 business days
4. If approved: added to library with full documentation
5. If declined: alternative approach provided

---

### 15.4 Design Debt Management

Design debt is tracked in the **Design Debt Register** (Notion). Every known deviation from the design system or documented UX issue is logged with:
- Description of the debt
- Business impact rating (Low / Medium / High)
- Effort to fix (story points estimate)
- Owner
- Target resolution sprint

Design debt is reviewed in the monthly design systems sync. High-impact debt items are escalated to the product roadmap.

---

## 16. Platform-Specific Guidelines

### 16.1 Web Application

- HTML semantic structure is mandatory (not optional)
- CSS-in-JS or CSS modules — no global CSS styles except for resets
- All interactive states must be tested in Chrome, Firefox, Safari, and Edge
- Support browsers with > 1% global market share (currently: no IE support)
- Performance budget: Core Web Vitals targets — LCP < 2.5s, FID < 100ms, CLS < 0.1

---

### 16.2 iOS

- Follow Apple's Human Interface Guidelines (HIG) for native conventions
- Support iOS 16 and later
- Support Dynamic Type and larger accessibility sizes
- Respect the Safe Area on all iPhone models (notch, Dynamic Island, home indicator)
- Use SF Symbols for platform-native icons (alongside Phosphor for product-specific icons)
- Haptic feedback for key interactions (selection, impact, notification types)
- All screens must support both light and dark mode

---

### 16.3 Android

- Follow Material Design 3 guidelines for platform conventions
- Support Android 10 (API 29) and later
- Support edge-to-edge display
- Use Material Icons + Phosphor for product icons
- Adaptive icons for launcher icon
- Support foldable screens — test on Pixel Fold emulator

---

### 16.4 Email Templates

Email is a distinct design surface with strict constraints.

**Technical constraints:**
- No CSS Grid — use tables for layout
- No web fonts — fall back to system fonts: `Arial, Helvetica, sans-serif`
- No JavaScript
- Images must have fallback alt text
- Maximum width: 600px
- All inline CSS (no `<style>` blocks — they are stripped by many clients)

**Design constraints:**
- Single-column for mobile-first rendering
- CTA buttons must be at least 44px tall with padding-based hit areas (not image buttons)
- Preheader text: 50–100 characters
- Subject line: < 50 characters
- Dark mode: test in Gmail Dark Mode, Apple Mail Dark Mode

**Testing matrix:**
- Gmail (Web, iOS, Android)
- Apple Mail (iOS, macOS)
- Outlook 2019, Outlook on the Web
- Samsung Mail

Use Litmus or Email on Acid for cross-client testing.

---

## 17. Anti-Patterns & What Not To Do

This section documents explicitly bad practices that have been observed in Company X's product and must not be repeated.

---

**Anti-Pattern 1: Multiple Primary Buttons**
Placing two blue primary buttons next to each other destroys hierarchy and confuses users. If two actions are equally important, one of them needs to be a secondary button.

---

**Anti-Pattern 2: Disabled Buttons Without Explanation**
A greyed-out button with no tooltip or context is a user trap. Always explain why a button is disabled via a tooltip or adjacent inline message.

---

**Anti-Pattern 3: Confirmation Modals with Vague CTAs**
"Are you sure? [Yes] [No]" is lazy and dangerous. The destructive CTA must name the action ("Delete Project"). "Yes" does not communicate the weight of the action.

---

**Anti-Pattern 4: Abusing Toasts for Errors**
Errors that require user action should not be toasts. Toasts are ephemeral. Errors that require attention must persist until the user addresses them.

---

**Anti-Pattern 5: Infinite Scroll Without Position Recovery**
If a user scrolls far down an infinite list and navigates away, they must be able to return to their position. No infinite scroll list should reset on back-navigation.

---

**Anti-Pattern 6: Form Labels Inside Inputs (Placeholder as Label)**
Placeholder text disappears on input. Users cannot recall what a field asked for when it's filled. Always use persistent labels above inputs.

---

**Anti-Pattern 7: Hover-Only Information**
If information is only accessible on hover, mobile users cannot access it. Every piece of information that affects decision-making must be accessible without hover.

---

**Anti-Pattern 8: Decorative Color With Meaning**
Using a red badge decoratively (for a count, not an error) trains users to ignore red. Color meanings must be consistent across the product.

---

**Anti-Pattern 9: Modals On Top Of Modals**
Two-level modal stacks mean the flow needs to be redesigned. Open a drawer, use a step within the same modal, or navigate to a new page.

---

**Anti-Pattern 10: Tables For Presentation**
Using `<table>` for layout instead of tabular data is a semantic and accessibility violation. Use CSS Grid or Flexbox for layouts.

---

**Anti-Pattern 11: Auto-Playing Video or Audio**
Nothing violates user trust faster than a page that starts making noise. All media is user-initiated. No exceptions.

---

**Anti-Pattern 12: Dark Patterns**
Company X does not design patterns that manipulate users against their interests. This includes:
- Pre-ticked opt-in checkboxes
- Subscription cancellation flows designed to frustrate
- "Confirm-shaming" (e.g., "No thanks, I don't want to save money")
- Hiding unsubscribe options
- Fake urgency ("Only 2 left!" when it isn't true)

Any designer asked to implement a dark pattern should escalate to the Design Lead and Product Director.

---

## 18. Changelog & Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 3.2.0 | June 2026 | Design Systems Team | Added dark mode token reference, updated anti-patterns section, revised onboarding principles, added email constraints |
| 3.1.0 | March 2026 | Design Systems Team | Revised type scale to Satoshi/Inter system, updated icon library to Phosphor, added motion design section |
| 3.0.0 | January 2026 | Design Systems Team | Major revision: new token architecture, dark mode first-class, accessibility overhaul |
| 2.4.0 | September 2025 | UX Lead | Added user flow documentation, onboarding flow standards |
| 2.3.0 | June 2025 | Design Systems Team | Component library expansion: data tables, empty states, skeleton screens |
| 2.2.0 | March 2025 | UX Researcher | Research framework section, usability testing protocols |
| 2.1.0 | December 2024 | Senior Designer | Anti-patterns section, writing guidelines expansion |
| 2.0.0 | September 2024 | Design Lead | System redesign: spacing tokens, 8-point grid, shadow system |
| 1.0.0 | January 2024 | Founding Designer | Initial documentation |

---

## 19. Contributing to This Wiki

This document belongs to every designer and engineer at Company X. If you see something missing, incorrect, or outdated — fix it.

**How to propose a change:**
1. Create a branch in the `design-wiki` GitHub repository
2. Make your change
3. Open a PR with:
   - What you changed
   - Why you changed it
   - Any Figma/Jira references
4. Tag `@design-systems-team` for review
5. Two approvals required (at least one from Design Systems team)
6. Merge on Friday (to avoid mid-week disruption)

**What requires Design Systems team sign-off:**
- New components or component variants
- Changes to the color or typography system
- Changes to token names (these have downstream engineering impact)
- Changes to the accessibility standards

**What can be self-merged with one review:**
- Copy corrections, typo fixes
- Additions to the anti-patterns section
- New examples for existing patterns
- Updating component status (e.g., deprecations)

---

## 20. Glossary

| Term | Definition |
|------|------------|
| **A11y** | Abbreviation for "Accessibility" (a + 11 letters + y) |
| **ARIA** | Accessible Rich Internet Applications — a set of HTML attributes that define ways to make web content more accessible to people with disabilities |
| **Atomic Design** | A methodology for creating design systems, organizing components into atoms, molecules, organisms, templates, and pages |
| **Component Token** | A design token scoped to a specific component, overriding semantic token defaults |
| **Design Debt** | The accumulation of design inconsistencies, outdated patterns, or deviations from the design system that require future remediation |
| **Design Token** | A named, platform-agnostic value for a design decision (color, spacing, typography) that can be consumed by design tools and code |
| **Double Diamond** | A design process model with four phases: Discover, Define, Develop, Deliver |
| **Elevation** | The z-axis position of a surface in the visual hierarchy, typically communicated via shadow |
| **Empty State** | A screen state when no content or data exists to display |
| **Focus Trap** | A pattern that confines keyboard focus to a specific region (e.g., a modal), preventing users from accidentally navigating outside it |
| **Gesture** | A touch interaction pattern (swipe, pinch, tap, drag) on a touchscreen device |
| **Happy Path** | The most common, error-free user journey through a feature |
| **HIG** | Apple's Human Interface Guidelines — Apple's design documentation for iOS, macOS, and other platforms |
| **IA** | Information Architecture — the structural design of shared information environments |
| **Microinteraction** | A small, single-task interaction or animation that provides feedback to the user |
| **Modular Scale** | A sequence of numbers that relate to one another in a meaningful way, used for typography sizing |
| **NPS** | Net Promoter Score — a metric for user satisfaction: "How likely are you to recommend this to a friend?" |
| **Primitive Token** | A raw design value (e.g., `#2563EB`) with no semantic meaning attached |
| **Progressive Disclosure** | An interaction pattern that sequences information and actions across several screens to reduce clutter |
| **Rem** | Root em — a CSS unit relative to the root element's font size (typically 16px) |
| **Safe Area** | The portion of an iOS device screen that is not obscured by the notch, Dynamic Island, or home indicator |
| **Semantic Token** | A design token with a name that describes its purpose rather than its value (e.g., `color-text-primary`) |
| **Skeleton Screen** | A placeholder loading state that mimics the rough shape of content, used instead of spinners |
| **SUS** | System Usability Scale — a 10-question survey used to evaluate the usability of an interface |
| **Touch Target** | The interactive area of a UI element on a touchscreen — must be at least 44×44px |
| **Toast** | A small, ephemeral notification that appears briefly and then dismisses itself |
| **Token** | See Design Token |
| **WCAG** | Web Content Accessibility Guidelines — the international standard for web accessibility, published by the W3C |
| **Z-index** | A CSS property that controls the stacking order of elements on the screen |

---

*This wiki is a living document. The version in this file is authoritative. When in doubt, check the repository for the latest version.*

*Questions? Ping `#design-systems` in Slack or open a GitHub Discussion.*

---

**© Company X Design Systems Team — Internal Use Only**