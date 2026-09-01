/**
 * The tools that exist only in the wiki page.
 *
 * Their implementations live in `WikiAgentTools` because they touch page
 * state — what is on screen, what the reader is looking at. Their descriptors
 * live here, as plain data, so the discovery manifest, the tool panel and the
 * verification script all read the same names, descriptions and schemas that
 * the page registers. `verify:webmcp` compares this file against the registry.
 */

import type { JsonSchema, ToolAnnotations } from "./registry";

export type PageToolDescriptor = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  annotations: ToolAnnotations;
};

export const PAGE_TOOLS: readonly PageToolDescriptor[] = [
  {
    name: "propose_component",
    description:
      "Put a component or full page in front of the user on the page they are reading, rendered in this design system's own tokens, and get back the governance verdict. Use this instead of only printing code in chat — the user should see the thing, not the markup. Earlier proposals are kept: each new one becomes a version the user can revisit, view as code, or download from the full-page view, so propose freely rather than editing one blob in place.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "The component markup to show." },
        intent: {
          type: "string",
          description: 'One line on what you built, e.g. "pricing card".',
        },
      },
      required: ["code"],
    },
    // Puts something on the user's screen, so it is not a read.
    annotations: { readOnlyHint: false },
  },
  {
    name: "propose_design_change",
    description:
      "Propose a change to the design system itself — add or edit a colour token, add a do/don't rule, revise a component's guidance. The change is staged for the human to approve; you cannot apply it. Use this when the user wants the system changed, not code written against it.",
    inputSchema: {
      type: "object",
      properties: {
        blockId: {
          type: "string",
          description:
            'What to change: "guidelines", "token:color:<name>", "component:<id>", "agent-guide".',
        },
        summary: {
          type: "string",
          description: 'One line a human will read, e.g. "Add a warning colour".',
        },
        updatedData: {
          type: "string",
          description:
            "JSON for that block. guidelines takes {dos:[],donts:[]}; a colour takes {name,value,role}.",
        },
        rationale: {
          type: "string",
          description: "Why this is the right change, in one or two sentences.",
        },
        create: {
          type: "string",
          description: 'Pass "true" when this adds a block that does not exist yet, such as a new colour token.',
        },
      },
      required: ["blockId", "summary", "updatedData"],
    },
    // Stages something for a human. It cannot reach the design system.
    annotations: { readOnlyHint: false },
  },
  {
    name: "get_current_context",
    description:
      "See what the user is looking at right now: which design system is open in their browser and which page of it. Call this first so your answer applies to their actual screen rather than a guess.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
  },
];

export const PAGE_TOOLS_BY_NAME = new Map(PAGE_TOOLS.map((t) => [t.name, t]));

export function pageTool(name: string): PageToolDescriptor {
  const tool = PAGE_TOOLS_BY_NAME.get(name);
  if (!tool) throw new Error(`No page tool named "${name}".`);
  return tool;
}
