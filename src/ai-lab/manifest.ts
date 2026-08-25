/**
 * AI Lab build manifest — update status as each step ships.
 */
export const AI_LAB_STEPS = [
  { id: "shared", folder: "shared", status: "done" as const, label: "NVIDIA + chat utilities" },
  { id: "01-ai-chrome", folder: "01-ai-chrome", status: "done" as const, label: "AI chrome compiler (Nemotron)" },
  { id: "02-parser-assist", folder: "02-parser-assist", status: "done" as const, label: "Parser assist (GPT-OSS)" },
  { id: "03-visualize-status", folder: "03-visualize-status", status: "done" as const, label: "Visualize status UX" },
  { id: "04-component-previews", folder: "04-component-previews", status: "done" as const, label: "Component preview renderers" },
  { id: "05-font-resolve", folder: "05-font-resolve", status: "done" as const, label: "Font resolve (GPT-OSS → Google Fonts)" },
] as const;

export type AiLabStepStatus = "done" | "in_progress" | "planned";
