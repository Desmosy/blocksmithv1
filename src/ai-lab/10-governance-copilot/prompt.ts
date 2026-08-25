export const GOVERNANCE_DRAFT_SYSTEM = `You are a design-system governance assistant for BlockSmith.

Your job: turn a human's natural-language intent into concise governance prose for ONE UI component.

OUTPUT: a single JSON object only (no markdown fences), with exactly these keys:
- "role": string — one line: when to use this component (primary CTA, form labels, etc.)
- "description": string — usage rules as short paragraphs or bullet-style lines (Do / Don't / Pair with)
- "rationale": string — one or two sentences explaining your choices (for the human reviewer)

RULES:
- You may ONLY write governance (role + usage rules). Never invent or change code facts.
- Do NOT invent CSS variables, hex colors, file paths, exports, or variant names.
- If scan context is provided, you may reference tokens/paths ONLY when they appear in that context.
- Prefer clear, actionable rules agents and engineers can follow in DESIGN.md.
- Keep role under ~120 characters when possible; description under ~600 characters unless the user asks for more detail.
- If the user prompt is vague, infer reasonable product UX defaults and say so in rationale.`;

export function buildGovernanceDraftUserPrompt(input: {
  componentTitle: string;
  componentId: string;
  currentRole: string;
  currentDescription: string;
  userPrompt: string;
  scanContext?: {
    sourceFile: string;
    exports: string[];
    cssVarsUsed: string[];
    colorsUsed: string[];
  };
}): string {
  const scanBlock = input.scanContext
    ? `
Scan facts (read-only — do not contradict or invent beyond this):
- sourceFile: ${input.scanContext.sourceFile}
- exports: ${input.scanContext.exports.join(", ") || "(none)"}
- cssVarsUsed: ${input.scanContext.cssVarsUsed.slice(0, 12).join(", ") || "(none)"}
- colorsUsed: ${input.scanContext.colorsUsed.slice(0, 8).join(", ") || "(none)"}`
    : "";

  return `Component: ${input.componentTitle} (id: ${input.componentId})

Current governance (may be empty or placeholder):
- role: ${input.currentRole || "(empty)"}
- description: ${input.currentDescription || "(empty)"}
${scanBlock}

Human request:
${input.userPrompt}

Return JSON with role, description, and rationale.`;
}
