/**
 * Capability negotiation — what this design system will and won't let an agent
 * build.
 *
 * A component list answers "what exists". It does not answer the question an
 * agent actually has, which is "can I use a tooltip here?". Left unanswered,
 * the agent invents one. This module answers it with the system's own position:
 * the component exists, or it's deprecated in favour of something else, or the
 * system deliberately doesn't do that and here's what it does instead.
 *
 * Declared in a design system's optional `## Capabilities` section:
 *
 *   | Pattern  | Status      | Use instead |
 *   |----------|-------------|-------------|
 *   | Tooltip  | unavailable | Inline Help |
 *   | Carousel | unavailable | —           |
 *   | Card     | deprecated  | Surface     |
 *
 * A system with no such section still negotiates — anything in `components` is
 * available and anything else is unknown, which is a weaker but honest answer.
 */

import type { DesignSystem } from "@/lib/blocks/types";

export type CapabilityStatus =
  /** The system has it. Use it. */
  | "available"
  /** The system has it and it is the canonical choice for this need. */
  | "preferred"
  /** Still present, but on the way out — there is a replacement. */
  | "deprecated"
  /** The system deliberately does not do this. */
  | "unavailable"
  /** Not in the system and not ruled out — the system has no position. */
  | "unknown";

export type Capability = {
  /** What the caller asked for, as they spelled it. */
  requested: string;
  status: CapabilityStatus;
  /** The system's own name for it, when it has one. */
  canonical: string | null;
  /** What to use in its place, for deprecated and unavailable. */
  useInstead: string | null;
  /** Why, when the system says so. */
  note: string | null;
};

/** One row of a system's declared capability table. */
type CapabilityRule = {
  pattern: string;
  status: CapabilityStatus;
  useInstead: string | null;
  note: string | null;
};

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Strip a trailing plural so "tooltips" matches "Tooltip". */
const singular = (s: string): string => s.replace(/s$/, "");

function statusFrom(raw: string): CapabilityStatus | null {
  const v = norm(raw);
  if (v.startsWith("avail")) return "available";
  if (v.startsWith("prefer")) return "preferred";
  if (v.startsWith("deprecat")) return "deprecated";
  if (v.startsWith("unavail") || v.startsWith("forbid") || v.startsWith("banned")) {
    return "unavailable";
  }
  return null;
}

/** Em-dash and friends are how "nothing" is written in these tables. */
function cellOrNull(cell: string): string | null {
  const v = cell.trim();
  if (!v || v === "—" || v === "-" || v === "–" || norm(v) === "none") return null;
  return v;
}

/**
 * Read the `## Capabilities` table out of a design system's markdown.
 * Returns an empty list when the section is absent, which is the common case.
 */
export function parseCapabilityRules(markdown: string): CapabilityRule[] {
  const section = markdown.match(
    /## Capabilities\s*\n([\s\S]*?)(?=\n## |$)/,
  )?.[1];
  if (!section) return [];

  const rules: CapabilityRule[] = [];
  for (const line of section.split("\n")) {
    const row = line.trim();
    if (!row.startsWith("|") || row.includes("---")) continue;

    const cells = row.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 2) continue;

    const pattern = cellOrNull(cells[0]);
    const status = statusFrom(cells[1] ?? "");
    // Skip the header row and anything whose status we don't recognise.
    if (!pattern || !status) continue;

    rules.push({
      pattern,
      status,
      useInstead: cellOrNull(cells[2] ?? ""),
      note: cellOrNull(cells[3] ?? ""),
    });
  }
  return rules;
}

/**
 * Match a request against a component title on whole words.
 *
 * Raw substring matching is too loose: a rule about "Tabs" matched
 * "Parameter Table", because `"parametertable".includes("tab")`. Comparing
 * word sets instead means "Tab" no longer collides with "Table", while
 * "Primary Button" still finds "Primary Action Button" and plurals still
 * resolve.
 */
function words(text: string): string[] {
  return text
    .split(/[^a-zA-Z0-9]+/)
    .map((w) => singular(w.toLowerCase()))
    .filter(Boolean);
}

function matchesComponent(request: string, title: string): boolean {
  const a = words(request);
  const b = words(title);
  if (!a.length || !b.length) return false;

  if (a.join(" ") === b.join(" ")) return true;

  // Either side may be the more specific name, so a subset match in either
  // direction counts — but every word has to be present.
  const setA = new Set(a);
  const setB = new Set(b);
  return a.every((w) => setB.has(w)) || b.every((w) => setA.has(w));
}

/**
 * The system's position on one requested pattern.
 *
 * Declared rules win over component presence: a system that ships `Card` but
 * declares it deprecated must say deprecated, or the agent keeps using it.
 */
export function resolveCapability(
  request: string,
  system: DesignSystem,
  markdown: string,
): Capability {
  const requested = request.trim();
  const rules = parseCapabilityRules(markdown);

  const rule = rules.find((r) => matchesComponent(requested, r.pattern));
  if (rule) {
    const owned = system.components.find((c) =>
      matchesComponent(rule.pattern, c.title),
    );
    return {
      requested,
      status: rule.status,
      canonical: owned?.title ?? null,
      useInstead: rule.useInstead,
      note: rule.note,
    };
  }

  const owned = system.components.find((c) => matchesComponent(requested, c.title));
  if (owned) {
    return {
      requested,
      status: "available",
      canonical: owned.title,
      useInstead: null,
      note: owned.role || null,
    };
  }

  return {
    requested,
    status: "unknown",
    canonical: null,
    useInstead: null,
    note: null,
  };
}

/**
 * Every component the system offers, annotated with its status, plus the
 * patterns it has explicitly ruled out. The second half is the part an agent
 * cannot get any other way.
 */
export function capabilitySurface(
  system: DesignSystem,
  markdown: string,
): { offered: Capability[]; ruledOut: Capability[] } {
  const rules = parseCapabilityRules(markdown);
  const ruleFor = (title: string) =>
    rules.find((r) => matchesComponent(r.pattern, title));

  const offered: Capability[] = system.components.map((c) => {
    const rule = ruleFor(c.title);
    return {
      requested: c.title,
      status: rule?.status ?? "available",
      canonical: c.title,
      useInstead: rule?.useInstead ?? null,
      note: rule?.note ?? c.role ?? null,
    };
  });

  // Rules naming something the system does not ship — the "we don't do
  // carousels, use a Grid" answers. Deprecated rules land here too when the
  // component is already gone, so a position is never silently dropped just
  // because the thing it rules on no longer exists.
  const ruledOut: Capability[] = rules
    .filter((r) => r.status === "unavailable" || r.status === "deprecated")
    .filter((r) => !system.components.some((c) => matchesComponent(r.pattern, c.title)))
    .map((r) => ({
      requested: r.pattern,
      status: r.status,
      canonical: null,
      useInstead: r.useInstead,
      note: r.note,
    }));

  return { offered, ruledOut };
}

/**
 * Terse rendering for lists, where `describeCapability`'s full sentence
 * repeated twenty times would blow the tool output budget.
 */
export function summarizeCapability(c: Capability): string {
  const name = c.canonical ?? c.requested;
  switch (c.status) {
    case "preferred":
      return `${name} (preferred)`;
    case "deprecated":
      return c.useInstead ? `${name} → ${c.useInstead}` : `${name} (deprecated)`;
    case "unavailable":
      return c.useInstead ? `${c.requested} → use ${c.useInstead}` : c.requested;
    default:
      return name;
  }
}

/** One-line rendering an agent can act on. */
export function describeCapability(c: Capability): string {
  switch (c.status) {
    case "available":
      return `**${c.canonical ?? c.requested}** — available.${c.note ? ` ${c.note}` : ""}`;
    case "preferred":
      return `**${c.canonical ?? c.requested}** — preferred for this need.${c.note ? ` ${c.note}` : ""}`;
    case "deprecated":
      return (
        `**${c.canonical ?? c.requested}** — deprecated.` +
        (c.useInstead ? ` Use **${c.useInstead}** instead.` : " Do not use it in new work.")
      );
    case "unavailable":
      return (
        `**${c.requested}** — not part of this design system.` +
        (c.useInstead ? ` Use **${c.useInstead}** instead.` : " Do not add one.")
      );
    default:
      return (
        `**${c.requested}** — not in this design system, and it takes no ` +
        `position on it. Ask the user before introducing one.`
      );
  }
}
