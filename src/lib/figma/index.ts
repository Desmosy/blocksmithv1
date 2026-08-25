export {
  importFigmaVariables,
  figmaVariablesToTokens,
  type FigmaImportResult,
} from "./import";
export {
  computeTokenDrift,
  driftFigmaAgainstScan,
  codeVarsFromScanMarkdown,
  renderDriftMarkdown,
  valuesEqual,
} from "./drift";
export {
  normalizeFigmaVariables,
  figmaNameToCssVar,
  asColor,
  asDimension,
  normalizeHex,
  rgbToHex,
} from "./normalize";
export {
  normalizeFigmaComponents,
  figmaComponentsToScanned,
  figmaComponentInterface,
  type FigmaComponent,
  type FigmaComponentInput,
} from "./components";
export {
  computeComponentDrift,
  driftFigmaComponentsAgainstScan,
  codeComponentSurfacesFromMarkdown,
  figmaComponentSurface,
  renderComponentDriftMarkdown,
  type ComponentSurface,
} from "./component-drift";
export {
  assembleFigmaImport,
  flattenFigmaVariableDefs,
  adaptFigmaComponents,
  coerceFigmaValue,
  figmaRgbaToHex,
  figmaDesignContextToTokens,
  type RawFigmaVariableDefs,
  type RawFigmaComponents,
  type AssembleFigmaImportArgs,
} from "./adapter";
export {
  parseFigmaFileKey,
  extractFigmaFile,
  fetchFigmaFile,
  fetchFigmaFrameImages,
  type FigmaRestFile,
  type FigmaRestExtract,
  type FigmaAnnotation,
  type FigmaFrameSummary,
  type FigmaMeasurement,
} from "./rest";
export type {
  FigmaVariable,
  FigmaVariableDefs,
  FigmaImportInput,
  FigmaImportSummary,
  TokenDriftReport,
  TokenDriftRow,
  TokenDriftStatus,
  ComponentDriftReport,
  ComponentDriftRow,
  ComponentDriftStatus,
} from "./types";
