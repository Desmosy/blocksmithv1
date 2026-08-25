export { AI_LAB_STEPS } from "@/ai-lab/manifest";
export { isAiLabConfigured, getNvidiaProfile } from "@/ai-lab/shared/nvidia-profiles";
export { compileChromeWithAi } from "@/ai-lab/01-ai-chrome/compile-chrome";
export {
  ensureParserAssist,
  needsParserAssist,
  normalizeMarkdownWithAi,
  type ParserAssistResult,
} from "@/ai-lab/02-parser-assist";
export {
  visualizeStatusMessage,
  visualizeAiWarning,
  type VisualizeCompileMode,
} from "@/ai-lab/03-visualize-status/messages";
export {
  classifyComponentKind,
  parseComponentPreviewSpec,
  ComponentPreviewView,
  buildPreviewContextFromIR,
  type ComponentPreviewSpec,
  type ComponentPreviewKind,
} from "@/ai-lab/04-component-previews";
export {
  ensureFontResolve,
  fontResolveEnabled,
  resolveFontsWithAi,
  FONT_RESOLVE_REV,
  type FontResolveResult,
} from "@/ai-lab/05-font-resolve";
export type {
  FontResolution,
  FontResolutionMap,
} from "@/lib/fonts/font-resolve";
