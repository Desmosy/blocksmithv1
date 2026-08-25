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
  handleListComponents,
  handleValidateUiCode,
} from "@/mcp/handlers";

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
      const r = handleListComponents({ doc: ctx.doc });
      if (!r.components.length) return "No components in this design system yet.";
      return [
        `${r.components.length} components:`,
        "",
        ...r.components.map((c) =>
          c.summary ? `- **${c.title}** — ${c.summary}` : `- **${c.title}**`,
        ),
      ].join("\n");
    },
  },

  {
    name: "check_governance",
    description:
      "Check UI code against the active design system. Returns every off-token color with its line number and the token that should replace it. Call this before showing generated UI code to the user, and again after fixing, to confirm the code is compliant.",
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
      if (r.governed) {
        return `PASS — no design system violations. Checked against ${r.tokenCount} tokens.`;
      }

      const rules = handleGetGovernanceRules({ doc: ctx.doc });
      const lines = [
        `REJECTED — ${r.violations.length} violation(s) against ${r.tokenCount} tokens.`,
        "",
      ];
      for (const v of r.violations) {
        const near = nearestToken(v.hex, rules.palette);
        lines.push(
          `- Line ${v.line}: \`${v.hex}\` is not a design token.` +
            (near ? ` Use \`${near.name}\` (${near.value}) instead.` : ""),
        );
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

      const near = nearestToken(hex, rules.palette);
      const lines = [
        `\`${hex}\` is not defined in ${rules.systemName}.`,
        "",
        "Hard-coded colors drift from the system: they don't respond to theme changes and they can't be updated centrally.",
      ];
      if (near) {
        lines.push("", `Closest token: **${near.name}** (${near.value}). Use that instead.`);
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

/** Perceptual-ish nearest token, so the suggested fix is actually close. */
function nearestToken(
  hex: string,
  palette: { name: string; value: string }[],
): { name: string; value: string } | null {
  const target = toRgb(hex);
  if (!target || !palette.length) return null;

  let best: { name: string; value: string } | null = null;
  let bestDist = Infinity;
  for (const token of palette) {
    const rgb = toRgb(token.value);
    if (!rgb) continue;
    // Weighted euclidean — green carries the most perceived luminance.
    const d =
      2 * (rgb[0] - target[0]) ** 2 +
      4 * (rgb[1] - target[1]) ** 2 +
      3 * (rgb[2] - target[2]) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = token;
    }
  }
  return best;
}

function toRgb(hex: string): [number, number, number] | null {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}
