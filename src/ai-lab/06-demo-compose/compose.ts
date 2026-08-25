import type { ComponentDoc, DesignSystem } from "@/lib/blocks/types";
import {
  classifyComponentKind,
  parseComponentPreviewSpec,
  previewLabel,
  type ComponentPreviewContext,
  type ComponentPreviewSpec,
} from "@/ai-lab/04-component-previews";

/**
 * Phase 2 — deterministic demo composition, curated archetypes.
 *
 * Each archetype assembles a real product surface from the doc's OWN tokens and
 * components. `selectParts` extracts the validated, reusable pieces once; each
 * archetype slots them into a different layout. Styling is faithful by
 * construction (no invented colors/components); copy is sample text. This is
 * the curated library a model will later choose from — proving composition
 * generalizes across layouts *before* any LLM drives it.
 */

export type ArchetypeId = "landing" | "dashboard";

export type ArchetypeMeta = {
  id: ArchetypeId;
  label: string;
  description: string;
};

export const ARCHETYPES: ArchetypeMeta[] = [
  { id: "landing", label: "Landing", description: "Marketing page — hero, features, CTA" },
  { id: "dashboard", label: "Dashboard", description: "App shell — sidebar, stats, data table" },
];

export type DemoCta = {
  id: string;
  label: string;
  spec: ComponentPreviewSpec;
} | null;

export type DemoFeature = { title: string; body: string };

export type LandingModel = {
  archetype: "landing";
  brandName: string;
  navLinks: string[];
  navCta: DemoCta;
  hero: {
    eyebrow: string | null;
    title: string;
    subtitle: string;
    primary: DemoCta;
    secondary: DemoCta;
  };
  features: { heading: string; items: DemoFeature[] };
  closing: { title: string; subtitle: string; action: DemoCta };
  footerNote: string;
  provenance: string[];
};

export type DashStat = { label: string; value: string; delta: string; positive: boolean };
export type DashRow = { cells: string[]; status: string };

export type DashboardModel = {
  archetype: "dashboard";
  brandName: string;
  navItems: { label: string; active: boolean }[];
  searchPlaceholder: string;
  topbarCta: DemoCta;
  primaryAction: DemoCta;
  stats: DashStat[];
  table: { title: string; columns: string[]; rows: DashRow[] };
  tagSpec: ComponentPreviewSpec | null;
  provenance: string[];
};

export type DemoModel = LandingModel | DashboardModel;

/** Back-compat alias. */
export type DemoPageModel = LandingModel;

// ── text helpers ────────────────────────────────────────────────────────────

function firstSentence(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const m = clean.match(/^(.+?[.!?])(\s|$)/);
  return (m?.[1] ?? clean).slice(0, 220);
}

function quotedPhrase(text: string): string | null {
  const m = text.match(/['"“]([^'"”]{2,40})['"”]/);
  return m?.[1]?.trim() ?? null;
}

function cleanTitle(title: string): string {
  return title
    .replace(/\b(button|cta|filled|outlined|ghost|pill|primary|secondary)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function ctaLabel(component: ComponentDoc, fallback: string): string {
  return (
    quotedPhrase(`${component.role} ${component.description}`) ??
    (cleanTitle(component.title) || fallback)
  );
}

function isSecondary(c: ComponentDoc): boolean {
  return /secondary|ghost|outline|tertiary|low-commitment|alternative/i.test(
    `${c.title} ${c.role}`,
  );
}

// ── shared part selection (the validated envelope) ───────────────────────────

type SystemParts = {
  brandName: string;
  primary: DemoCta;
  secondary: DemoCta;
  cardDocs: ComponentDoc[];
  tagSpec: ComponentPreviewSpec | null;
  inputLabel: string;
  provenance: string[];
};

function selectParts(
  system: DesignSystem,
  ctx: ComponentPreviewContext,
): SystemParts {
  const provenance: string[] = [];
  const btns = system.components
    .filter((c) => classifyComponentKind(c) === "button")
    .map((c) => ({ component: c, spec: parseComponentPreviewSpec(c, ctx) }));

  const primaryBtn =
    btns.find(
      (b) =>
        !isSecondary(b.component) &&
        /primary|enterprise|submit|main|get started|sign up|demo/i.test(
          `${b.component.title} ${b.component.role}`,
        ),
    ) ??
    btns.find((b) => !isSecondary(b.component) && b.spec.variant === "filled") ??
    btns[0] ??
    null;

  const secondaryBtn =
    btns.find((b) => b !== primaryBtn && isSecondary(b.component)) ??
    btns.find((b) => b !== primaryBtn) ??
    null;

  const primary: DemoCta = primaryBtn
    ? {
        id: primaryBtn.component.id,
        label: ctaLabel(primaryBtn.component, "Get started"),
        spec: primaryBtn.spec,
      }
    : null;
  const secondary: DemoCta = secondaryBtn
    ? {
        id: secondaryBtn.component.id,
        label: ctaLabel(secondaryBtn.component, "Learn more"),
        spec: secondaryBtn.spec,
      }
    : null;

  provenance.push(
    primary
      ? `Primary CTA from "${primaryBtn!.component.title}"`
      : "No button component found — CTAs omitted",
  );

  const cardDocs = system.components.filter((c) => {
    const kind = classifyComponentKind(c);
    return kind === "card" || kind === "hero";
  });

  const tagDoc = system.components.find((c) => classifyComponentKind(c) === "tag");
  const tagSpec = tagDoc ? parseComponentPreviewSpec(tagDoc, ctx) : null;

  const inputDoc = system.components.find((c) => classifyComponentKind(c) === "input");
  const inputLabel = inputDoc ? previewLabel(inputDoc, "input") : "Search…";

  return {
    brandName: system.name,
    primary,
    secondary,
    cardDocs,
    tagSpec,
    inputLabel,
    provenance,
  };
}

// ── landing archetype ────────────────────────────────────────────────────────

export function composeLanding(
  system: DesignSystem,
  ctx: ComponentPreviewContext,
): LandingModel {
  const parts = selectParts(system, ctx);
  const provenance = [...parts.provenance];

  let items: DemoFeature[];
  if (parts.cardDocs.length >= 2) {
    items = parts.cardDocs.slice(0, 6).map((c) => ({
      title: cleanTitle(c.title) || c.title,
      body: firstSentence(c.role || c.description || ""),
    }));
    provenance.push(`${items.length} feature cards from card components`);
  } else if (system.dos.length >= 2) {
    items = system.dos.slice(0, 4).map((d, i) => ({
      title: `Principle ${i + 1}`,
      body: firstSentence(d),
    }));
    provenance.push(`Features from ${items.length} design guidelines`);
  } else {
    items = system.colors.slice(0, 4).map((c) => ({
      title: c.name,
      body: firstSentence(c.role || "Brand token"),
    }));
    provenance.push("Features synthesized from color tokens (no cards found)");
  }

  const tagline = system.tagline?.trim() ?? "";
  const eyebrow =
    tagline && tagline.length <= 70
      ? tagline
      : system.theme
        ? `${system.theme} theme`
        : null;
  const subtitle =
    (tagline && tagline.length > 70 ? tagline : firstSentence(system.overview)) ||
    `The ${system.name} design system, composed into a live product surface.`;

  return {
    archetype: "landing",
    brandName: parts.brandName,
    navLinks: ["Product", "Features", "Pricing", "Docs"],
    navCta: parts.secondary ?? parts.primary,
    hero: { eyebrow, title: system.name, subtitle, primary: parts.primary, secondary: parts.secondary },
    features: { heading: "Built from your design system", items },
    closing: {
      title: `Ready to build with ${system.name}?`,
      subtitle: "Every element on this page is composed from your tokens — no hand-styling.",
      action: parts.primary,
    },
    footerNote: `${system.name} · generated demo · ${system.components.length} components`,
    provenance,
  };
}

/** Back-compat: original landing entry point. */
export const composeDemoPage = composeLanding;

// ── dashboard archetype ──────────────────────────────────────────────────────

function withLabel(cta: DemoCta, label: string): DemoCta {
  return cta ? { ...cta, label } : null;
}

export function composeDashboard(
  system: DesignSystem,
  ctx: ComponentPreviewContext,
): DashboardModel {
  const parts = selectParts(system, ctx);
  const provenance = [...parts.provenance];

  const navItems = ["Overview", "Projects", "Reports", "Team", "Settings"].map(
    (label, i) => ({ label, active: i === 0 }),
  );

  // Stat cards: faithful card styling, sample metrics.
  const stats: DashStat[] = [
    { label: "Active projects", value: "128", delta: "+12%", positive: true },
    { label: "Completion", value: "94%", delta: "+3%", positive: true },
    { label: "Open tasks", value: "36", delta: "-8%", positive: true },
    { label: "Satisfaction", value: "4.8", delta: "+0.2", positive: true },
  ];

  const statuses = ["Active", "In review", "Done", "Active", "In review"];
  const owners = ["A. Rivera", "J. Chen", "M. Okafor", "S. Patel", "L. Nguyen"];
  const rows: DashRow[] = owners.map((owner, i) => ({
    cells: [`Project ${String.fromCharCode(65 + i)}`, owner, `Apr ${10 + i}`],
    status: statuses[i],
  }));

  provenance.push(
    "Sidebar, stats and table use sample data; cards, badges and buttons are styled from your components",
  );
  if (parts.tagSpec) provenance.push("Status badges styled from a tag component");

  return {
    archetype: "dashboard",
    brandName: parts.brandName,
    navItems,
    searchPlaceholder: parts.inputLabel,
    topbarCta: withLabel(parts.secondary ?? parts.primary, "Invite"),
    primaryAction: withLabel(parts.primary, "New"),
    stats,
    table: {
      title: "Recent activity",
      columns: ["Project", "Owner", "Updated", "Status"],
      rows,
    },
    tagSpec: parts.tagSpec,
    provenance,
  };
}

// ── registry ─────────────────────────────────────────────────────────────────

export function composeArchetype(
  id: ArchetypeId,
  system: DesignSystem,
  ctx: ComponentPreviewContext,
): DemoModel {
  return id === "dashboard"
    ? composeDashboard(system, ctx)
    : composeLanding(system, ctx);
}
