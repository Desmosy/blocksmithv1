export {
  DESIGN_IR_VERSION,
  designIRSchema,
  type DesignIR,
  type DesignIRTokens,
} from "@/lib/design-ir/schema";
export {
  compileDesignIR,
  compileWikiChrome,
} from "@/lib/design-ir/compile";
export { flattenIRToCssProperties } from "@/lib/design-ir/flatten";
export { ensureDesignIR, ensureDesignIRWithFonts } from "@/lib/design-ir/ensure";
export { loadDesignIR, persistDesignIR } from "@/lib/design-ir/store";
