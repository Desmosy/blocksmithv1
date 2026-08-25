/**
 * Shared WebMCP tool registry — the single source of truth for the tools
 * BlockSmith exposes in-page via `document.modelContext`.
 *
 * The definitions here are transport-agnostic on purpose: the browser layer
 * (`useWebMcp`) reads name/description/schema/annotations to register tools,
 * and the server route (`/api/webmcp/invoke`) reads `run` to execute them.
 * Neither side owns a copy, so the two transports cannot drift apart.
 *
 * Chrome enforces character budgets on everything below. See
 * https://developer.chrome.com/docs/ai/webmcp/secure-tools
 */

import {
  handleCheckGovernance,
  handleGetGovernanceRules,
  handleValidateUiCode,
  resolveDocRef,
} from "@/mcp/handlers";
import {
  listDocSources,
  loadDesignSystem,
  readDocMarkdown,
} from "@/lib/clients/registry";
import {
  capabilitySurface,
  describeCapability,
  resolveCapability,
  summarizeCapability,
} from "@/lib/governance/capability";
import {
  nearestToken,
  type NearestToken,
  type TokenColor,
} from "@/lib/governance/color-lint";
import {
  describeScaleViolation,
  findScaleViolations,
} from "@/lib/governance/scale-lint";
import {
  describeRuleViolation,
  findRuleViolations,
} from "@/lib/governance/rule-lint";
import {
  describeTailwindViolation,
  findTailwindViolations,
} from "@/lib/governance/tailwind-lint";

/**
 * How many violations one result lists. Chosen so a full response stays inside
 * the 1500-char output budget with the longest rule text we emit.
 */
const MAX_VIOLATIONS_SHOWN = 8;

/** Chrome's published limits. Exported so tests can assert against them. */
export const WEBMCP_LIMITS = {
  toolName: 30,
  paramName: 30,
  paramDescription: 150,
  toolDescription: 500,
  output: 1500,
} as const;

/**
 * Hints the agent uses to decide how much to trust a result and whether an
 * action needs confirmation. `untrustedContentHint` is not decorative — it
 * marks results that carry third-party content the agent must treat as data
 * rather than instructions.
 */
export type ToolAnnotations = {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
};

export type JsonSchema = {
  type: "object";
  properties: Record<string, { type: string; description?: string; enum?: string[] }>;
  required?: string[];
};

export type ToolArgs = Record<string, unknown>;

export type WebMcpToolDef = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  annotations: ToolAnnotations;
  /**
   * Server-side implementation. Returns plain text — the browser wraps it in
   * the `{ content: [{ type: "text", text }] }` shape the spec expects.
   */
  run: (args: ToolArgs, ctx: ToolContext) => string | Promise<string>;
};

export type ToolContext = {
  /** Document the tools operate against; falls back to the server default. */
  doc?: string;
};

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

/**
 * Truncate to Chrome's output budget on a line boundary where possible, so a
 * clipped result still parses as the list or table it started as.
 */
export function clampOutput(text: string, limit = WEBMCP_LIMITS.output): string {
  if (text.length <= limit) return text;
  const notice = "\n…truncated. Open the page for the full result.";
  const room = limit - notice.length;
  const cut = text.slice(0, room);
  const lastBreak = cut.lastIndexOf("\n");
  return (lastBreak > room * 0.6 ? cut.slice(0, lastBreak) : cut) + notice;
}

export const WEBMCP_TOOLS: WebMcpToolDef[] = [
  {
    name: "get_governance_rules",
    description:
      "Get the active design system's rules: token palette, do's, don'ts, and component count. Call this before writing or changing any UI code so the result matches the system instead of guessing at values.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    run: (_args, ctx) => {
      const r = handleGetGovernanceRules({ doc: ctx.doc });
      const lines = [
        `# ${r.systemName}`,
        `${r.componentCount} components · ${r.palette.length} color tokens`,
        "",
        "## Tokens",
        ...r.palette.map((p) => `- ${p.name}: ${p.value}`),
      ];
      if (r.dos.length) lines.push("", "## Do", ...r.dos.map((d) => `- ${d}`));
      if (r.donts.length) lines.push("", "## Don't", ...r.donts.map((d) => `- ${d}`));
      return lines.join("\n");
    },
  },

  {
    name: "list_components",
    description:
      "List what this design system offers, what is deprecated, and what it has deliberately ruled out. Call this before proposing any component so you build with what exists instead of inventing something the system does not have.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    run: (_args, ctx) => {
      // Read the design system directly rather than the governed-block
      // registry: blocks only exist once a doc has been promoted, and the
      // agent surface must work on a freshly-opened doc too.
      const docRef = resolveDocRef(ctx.doc);
      const system = loadDesignSystem(docRef);
      if (!system.components.length) {
        return "No components in this design system yet.";
      }

      const { offered, ruledOut } = capabilitySurface(
        system,
        readDocMarkdown(docRef),
      );
      const live = offered.filter((c) => c.status !== "deprecated");
      const gone = offered.filter((c) => c.status === "deprecated");

      // Terse on purpose: the full sentence form repeated for every component
      // would spend most of the 1500-char budget on boilerplate. Roles are
      // trimmed for the same reason — get_component_docs carries the detail.
      const lines = [`${live.length} components in ${system.name}:`, ""];
      lines.push(
        ...live.map((c) => {
          const role = c.note ? ` — ${c.note.split(/(?<=\.)\s|—/)[0].trim()}` : "";
          return `- ${summarizeCapability(c)}${role}`;
        }),
      );

      if (gone.length) {
        lines.push("", "Deprecated:", ...gone.map((c) => `- ${summarizeCapability(c)}`));
      }
      // The half an agent cannot infer from the page: what was ruled out.
      if (ruledOut.length) {
        lines.push(
          "",
          "Ruled out — do not build these:",
          ...ruledOut.map((c) => `- ${summarizeCapability(c)}`),
        );
      }
      return lines.join("\n");
    },
  },

  {
    name: "check_capability",
    description:
      "Ask whether this design system allows a given UI pattern before you build it. Answers available, preferred, deprecated, or ruled out — with what to use instead. Call this whenever you are about to reach for a pattern you have not confirmed exists, rather than inventing one.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: 'The pattern you want to use, e.g. "Tooltip" or "Modal".',
        },
      },
      required: ["pattern"],
    },
    annotations: { readOnlyHint: true },
    run: (args, ctx) => {
      const pattern = str(args.pattern);
      if (!pattern) return "Pass the pattern you want to use as `pattern`.";

      const docRef = resolveDocRef(ctx.doc);
      const system = loadDesignSystem(docRef);
      const cap = resolveCapability(pattern, system, readDocMarkdown(docRef));

      const lines = [describeCapability(cap)];
      if (cap.status === "unknown") {
        lines.push(
          "",
          `Call list_components to see what ${system.name} does offer.`,
        );
      }
      return lines.join("\n");
    },
  },

  {
    name: "list_presets",
    description:
      "List the design systems available to build against. Use this when the user has no system of their own, or wants to switch which one governs their work.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    run: (_args, ctx) => {
      const sources = listDocSources();
      if (!sources.length) return "No design systems are installed.";

      const active = resolveDocRef(ctx.doc);
      const lines = ["Design systems available:", ""];
      for (const s of sources) {
        let summary = "";
        try {
          const sys = loadDesignSystem(s.fileName);
          const tagline = (sys.tagline || sys.name).replace(/[.\s]+$/, "");
          summary = ` — ${tagline}. ${sys.components.length} components, ${sys.colors.length} tokens`;
        } catch {
          // A doc that fails to parse still belongs in the list; the user
          // needs to see it exists rather than wonder where it went.
          summary = " — could not be read";
        }
        const mark = s.fileName === active ? " **(active)**" : "";
        lines.push(`- \`${s.fileName}\`${mark}${summary}`);
      }
      return lines.join("\n");
    },
  },

  {
    name: "check_governance",
    description:
      "Check UI code against the active design system: off-token colors, off-scale spacing, font sizes and radii, banned patterns like gradients or shadows, and Tailwind classes that resolve to non-token values. Returns each violation with its line and the value to use instead. Call before showing generated UI to the user, and again after fixing.",
    inputSchema: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "The component source to check.",
        },
      },
      required: ["code"],
    },
    annotations: { readOnlyHint: true },
    run: (args, ctx) => {
      const code = str(args.code);
      if (!code) return "No code supplied. Pass the component source as `code`.";

      const r = handleValidateUiCode({ doc: ctx.doc, code });
      const system = loadDesignSystem(resolveDocRef(ctx.doc));
      const scaleViolations = findScaleViolations(code, system);
      const ruleViolations = findRuleViolations(code, system);
      const twViolations = findTailwindViolations(code, system);
      const total =
        r.violations.length +
        scaleViolations.length +
        ruleViolations.length +
        twViolations.length;

      if (total === 0) {
        return (
          `PASS — no design system violations. Checked colors against ` +
          `${r.tokenCount} tokens, plus spacing, type size, radius, and ` +
          `${system.name}'s stated rules.`
        );
      }

      const rules = handleGetGovernanceRules({ doc: ctx.doc });

      // Several linters can legitimately flag the same token on the same line
      // — `to-black` is both a banned pure color and an off-palette Tailwind
      // class. Report each (line, subject) once: duplicates burn the output
      // budget and push genuine violations into the "and N more" remainder.
      const seen = new Set<string>();
      const detail: string[] = [];
      const add = (line: number, subject: string, text: string) => {
        const key = `${line}|${subject.toLowerCase()}`;
        if (seen.has(key)) return;
        seen.add(key);
        detail.push(`- Line ${line}: ${text}`);
      };

      for (const v of r.violations) {
        const near = nearestTokenMatch(v.hex, rules.palette);
        const fix = !near
          ? ""
          : near.close
            ? ` Use \`${near.name}\` (${tokenFix(near)}) instead.`
            : ` No token is close to this color — it doesn't belong to ${rules.systemName}.` +
              ` Call get_governance_rules and pick a token, or ask the user to add one.`;
        add(v.line, v.hex, `\`${v.hex}\` is not a design token.${fix}`);
      }

      for (const v of scaleViolations) {
        add(v.line, `${v.property}:${v.value}`, describeScaleViolation(v));
      }

      // Rule violations quote the design system's own words back, so the
      // rejection teaches the rule rather than just reporting a failure.
      for (const v of ruleViolations) {
        add(v.line, v.matched, describeRuleViolation(v));
      }

      // Tailwind utilities resolve to px before being judged, so a class and
      // an inline style that mean the same thing get the same verdict.
      for (const v of twViolations) {
        add(v.line, v.utility, describeTailwindViolation(v));
      }

      // Cap deliberately rather than letting clampOutput cut a line in half.
      // A truncated fix instruction is worse than a stated remainder: the
      // agent fixes this batch, re-checks, and gets the rest.
      const shown = detail.slice(0, MAX_VIOLATIONS_SHOWN);
      const hidden = detail.length - shown.length;

      return [
        `REJECTED — ${detail.length} violation(s) in ${system.name}.`,
        "",
        ...shown,
        ...(hidden > 0
          ? ["", `…and ${hidden} more. Fix these first, then re-check.`]
          : ["", "Fix these and call check_governance again."]),
      ].join("\n");
    },
  },

  {
    name: "explain_violation",
    description:
      "Explain why a specific color value violates the design system and which token to use instead. Use this when the user asks why a change was rejected.",
    inputSchema: {
      type: "object",
      properties: {
        hex: {
          type: "string",
          description: 'The rejected color, e.g. "#3b82f6".',
        },
      },
      required: ["hex"],
    },
    annotations: { readOnlyHint: true },
    run: (args, ctx) => {
      const hex = str(args.hex)?.toLowerCase();
      if (!hex) return "Pass the rejected color as `hex`.";

      const rules = handleGetGovernanceRules({ doc: ctx.doc });
      const exact = rules.palette.find((p) => p.value === hex);
      if (exact) {
        return `\`${hex}\` is a valid token — it is **${exact.name}** in ${rules.systemName}.`;
      }

      const near = nearestTokenMatch(hex, rules.palette);
      const lines = [
        `\`${hex}\` is not defined in ${rules.systemName}.`,
        "",
        "Hard-coded colors drift from the system: they don't respond to theme changes and they can't be updated centrally.",
      ];
      if (near?.close) {
        lines.push("", `Closest token: **${near.name}** — use \`${tokenFix(near)}\`.`);
      } else if (near) {
        lines.push(
          "",
          `Nothing in ${rules.systemName} is close to this color — the nearest is **${near.name}** (${near.hex}), which is a different hue. Adding a new color is a design decision for the user, not a substitution to make silently.`,
        );
      }
      if (rules.donts.length) {
        lines.push("", "Relevant rules:", ...rules.donts.slice(0, 3).map((d) => `- ${d}`));
      }
      return lines.join("\n");
    },
  },

  {
    name: "check_component",
    description:
      "Check proposed colors against one named component's governance, returning its do's, don'ts, and any deviations. Use this when changing a specific component rather than checking a whole file.",
    inputSchema: {
      type: "object",
      properties: {
        component: {
          type: "string",
          description: 'Component name, e.g. "Button".',
        },
        colors: {
          type: "string",
          description: 'Comma-separated hex colors to check, e.g. "#fff,#1a1a1a".',
        },
      },
      required: ["component"],
    },
    annotations: { readOnlyHint: true },
    run: (args, ctx) => {
      const component = str(args.component);
      if (!component) return "Pass a component name as `component`.";

      const proposedColors = (str(args.colors) ?? "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      const r = handleCheckGovernance({ doc: ctx.doc, component, proposedColors });
      if (r.error) {
        return `${r.error} Call list_components to see what exists.`;
      }

      const lines = [
        `# ${r.component?.title ?? component}`,
        r.governed ? "PASS — no deviations." : `REJECTED — ${r.violations.length} deviation(s).`,
      ];
      if (r.violations.length) lines.push("", ...r.violations.map((v) => `- ${v}`));
      if (r.dos.length) lines.push("", "## Do", ...r.dos.slice(0, 5).map((d) => `- ${d}`));
      if (r.donts.length) lines.push("", "## Don't", ...r.donts.slice(0, 5).map((d) => `- ${d}`));
      return lines.join("\n");
    },
  },
];

export const WEBMCP_TOOLS_BY_NAME = new Map(WEBMCP_TOOLS.map((t) => [t.name, t]));

/**
 * Nearest token, plus a judgement about whether it's actually a substitute.
 *
 * `nearestToken` from the governance engine returns a raw squared distance and
 * leaves the verdict to the caller. For an agent the verdict is the whole
 * point: suggesting a grey as the "fix" for a blue is worse than saying no
 * close token exists, because an agent told to use the grey will use it. When
 * nothing is near, adding a color is a design decision for the human.
 */
export type TokenMatch = NearestToken & { close: boolean };

/**
 * Ceiling for "same color, slightly off" — about 24 levels of drift per
 * channel. A near-neighbour grey scores in the single digits; an off-system
 * blue scores in the tens of thousands and is correctly reported as unmatched.
 */
const CLOSE_ENOUGH = 3 * 24 ** 2;

function nearestTokenMatch(hex: string, colors: TokenColor[]): TokenMatch | null {
  const best = nearestToken(hex, colors);
  return best ? { ...best, close: best.distance <= CLOSE_ENOUGH } : null;
}

/** How to write the fix: a CSS variable beats a raw hex wherever one exists. */
function tokenFix(match: NearestToken): string {
  return match.cssVar ? `var(${match.cssVar})` : match.hex;
}
