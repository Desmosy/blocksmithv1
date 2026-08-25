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
import { loadDesignSystem } from "@/lib/clients/registry";
import {
  nearestToken,
  type NearestToken,
  type TokenColor,
} from "@/lib/governance/color-lint";
import {
  describeScaleViolation,
  findScaleViolations,
} from "@/lib/governance/scale-lint";

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
      "List the components in the active design system, with a one-line role for each. Use this to find the right existing component before proposing a new one.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    run: (_args, ctx) => {
      // Read the design system directly rather than the governed-block
      // registry: blocks only exist once a doc has been promoted, and the
      // agent surface must work on a freshly-opened doc too.
      const system = loadDesignSystem(resolveDocRef(ctx.doc));
      if (!system.components.length) {
        return "No components in this design system yet.";
      }
      return [
        `${system.components.length} components in ${system.name}:`,
        "",
        ...system.components.map((c) =>
          c.role ? `- **${c.title}** — ${c.role}` : `- **${c.title}**`,
        ),
      ].join("\n");
    },
  },

  {
    name: "check_governance",
    description:
      "Check UI code against the active design system: off-token colors, plus spacing, font sizes, and radii that are not on the system's scales. Returns each violation with its line number and the value to use instead. Call before showing generated UI to the user, and again after fixing.",
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
      const total = r.violations.length + scaleViolations.length;

      if (total === 0) {
        return (
          `PASS — no design system violations. Checked colors against ` +
          `${r.tokenCount} tokens, plus spacing, type size, and radius scales.`
        );
      }

      const rules = handleGetGovernanceRules({ doc: ctx.doc });
      const lines = [`REJECTED — ${total} violation(s) in ${system.name}.`, ""];

      for (const v of r.violations) {
        const near = nearestTokenMatch(v.hex, rules.palette);
        const fix = !near
          ? ""
          : near.close
            ? ` Use \`${near.name}\` (${tokenFix(near)}) instead.`
            : ` No token is close to this color — it doesn't belong to ${rules.systemName}.` +
              ` Call get_governance_rules and pick a token, or ask the user to add one.`;
        lines.push(`- Line ${v.line}: \`${v.hex}\` is not a design token.${fix}`);
      }

      for (const v of scaleViolations) {
        lines.push(`- Line ${v.line}: ${describeScaleViolation(v)}`);
      }

      lines.push("", "Fix these and call check_governance again.");
      return lines.join("\n");
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
