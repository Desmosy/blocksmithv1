/**
 * Component contracts — rules about composition rather than values.
 *
 * Every other linter here checks a value: is this colour a token, is this
 * padding on the scale. None of them can see that a card has two primary
 * actions, or that a card has been nested inside another card. Those are the
 * failures a design system exists to prevent and the ones no design linter on
 * the market catches, because they are properties of the *arrangement*.
 *
 * Declared in an optional `## Contracts` section:
 *
 *   | Contract | Component      | Detail       | Message |
 *   |----------|----------------|--------------|---------|
 *   | max      | Primary Button | 1            | A view has one primary action. |
 *   | no-nest  | Card           | —            | Cards do not nest. |
 *   | requires | Callout        | Meta Label   | Every callout is labelled. |
 *
 * Detection is a JSX tag scan, so it sees components used as elements —
 * `<PrimaryButton>` — which is how both generated and hand-written React
 * refers to them. It deliberately does not try to parse arbitrary markup: a
 * contract that fires on the wrong thing is worse than one that stays quiet.
 */

import type { DesignSystem } from "@/lib/blocks/types";

export type ContractKind = "max" | "no-nest" | "requires";

export type ContractRule = {
  kind: ContractKind;
  /** Component the rule is about, as the system spells it. */
  component: string;
  /** A count for `max`, a component name for `requires`, empty for `no-nest`. */
  detail: string;
  /** The system's own words, quoted back when the rule fires. */
  message: string;
};

export type ContractViolation = {
  kind: ContractKind;
  component: string;
  line: number;
  /** What was actually found — "3 used", "nested at depth 2". */
  found: string;
  message: string;
};

/** PascalCase identifier for a component title, matching codegen's naming. */
export function tagFor(title: string): string {
  return title
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join("");
}

function cellOrEmpty(cell: string): string {
  const v = cell.trim();
  return !v || v === "—" || v === "-" || v === "–" ? "" : v;
}

function kindFrom(raw: string): ContractKind | null {
  const v = raw.trim().toLowerCase().replace(/[^a-z]/g, "");
  if (v === "max" || v === "atmost" || v === "maxone") return "max";
  if (v === "nonest" || v === "nonesting") return "no-nest";
  if (v === "requires" || v === "require" || v === "needs") return "requires";
  return null;
}

/** Read the `## Contracts` table. Absent for most systems, which is fine. */
export function parseContracts(markdown: string): ContractRule[] {
  const section = markdown.match(/## Contracts\s*\n([\s\S]*?)(?=\n## |$)/)?.[1];
  if (!section) return [];

  const rules: ContractRule[] = [];
  for (const line of section.split("\n")) {
    const row = line.trim();
    if (!row.startsWith("|") || row.includes("---")) continue;

    const cells = row.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 3) continue;

    const kind = kindFrom(cells[0] ?? "");
    const component = cellOrEmpty(cells[1] ?? "");
    if (!kind || !component) continue;

    rules.push({
      kind,
      component,
      detail: cellOrEmpty(cells[2] ?? ""),
      message: cellOrEmpty(cells[3] ?? "") || `${component} violates a composition rule.`,
    });
  }
  return rules;
}

type TagUse = { tag: string; line: number; depth: number; selfClosing: boolean };

/**
 * Every JSX element in the source, with its nesting depth.
 *
 * A real parser would be more precise, but this only needs to be right about
 * well-formed component usage — and being conservative about anything else is
 * the point.
 */
function scanTags(code: string): TagUse[] {
  const uses: TagUse[] = [];
  const stack: string[] = [];
  const lines = code.split("\n");

  lines.forEach((text, i) => {
    // Match opening, self-closing and closing tags whose name is capitalised —
    // lowercase names are HTML elements, not components.
    const re = /<(\/?)([A-Z][A-Za-z0-9]*)\b([^>]*?)(\/?)>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const [, closing, tag, attrs, selfClose] = m;
      const isSelfClosing = selfClose === "/" || /\/\s*$/.test(attrs);

      if (closing === "/") {
        const idx = stack.lastIndexOf(tag);
        if (idx !== -1) stack.length = idx;
        continue;
      }
      uses.push({ tag, line: i + 1, depth: stack.length, selfClosing: isSelfClosing });
      if (!isSelfClosing) stack.push(tag);
    }
  });

  return uses;
}

export function findContractViolations(
  code: string,
  system: DesignSystem,
  markdown: string,
): ContractViolation[] {
  const rules = parseContracts(markdown);
  if (!rules.length) return [];

  const uses = scanTags(code);
  if (!uses.length) return [];

  const out: ContractViolation[] = [];

  for (const rule of rules) {
    // Resolve the rule's component to the tag codegen would emit, so a rule
    // written as "Primary Action Button" matches <PrimaryActionButton>.
    const tag = tagFor(rule.component);
    const matches = uses.filter((u) => u.tag === tag);

    if (rule.kind === "max") {
      const limit = Number(rule.detail || "1");
      if (!Number.isFinite(limit) || matches.length <= limit) continue;
      // Report on the one that broke the rule, not the first legal use.
      const offending = matches[limit];
      out.push({
        kind: "max",
        component: rule.component,
        line: offending.line,
        found: `${matches.length} used, ${limit} allowed`,
        message: rule.message,
      });
    }

    if (rule.kind === "no-nest") {
      // A use whose own tag is already on the stack above it.
      const nested = matches.find((u) =>
        matches.some((other) => other !== u && other.depth < u.depth && other.line <= u.line),
      );
      if (nested) {
        out.push({
          kind: "no-nest",
          component: rule.component,
          line: nested.line,
          found: "nested inside itself",
          message: rule.message,
        });
      }
    }

    if (rule.kind === "requires" && matches.length) {
      const requiredTag = tagFor(rule.detail);
      if (!requiredTag) continue;
      const hasRequired = uses.some((u) => u.tag === requiredTag);
      if (!hasRequired) {
        out.push({
          kind: "requires",
          component: rule.component,
          line: matches[0].line,
          found: `no ${rule.detail}`,
          message: rule.message,
        });
      }
    }
  }

  // Only report contracts about components this system actually defines —
  // a rule naming something that no longer exists should not fire.
  const known = new Set(system.components.map((c) => tagFor(c.title)));
  return out.filter((v) => known.has(tagFor(v.component))).sort((a, b) => a.line - b.line);
}

export function describeContractViolation(v: ContractViolation): string {
  return `**${v.component}** — ${v.found}. ${v.message}`;
}
