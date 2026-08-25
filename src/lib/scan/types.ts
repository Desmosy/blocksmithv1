export type ScannedColor = {
  token: string;
  hex: string;
  source: string;
};

export type ScannedCssVar = {
  name: string;
  value: string;
  source: string;
};

export type ScannedCssRule = {
  selector: string;
  declarations: string;
  source: string;
};

export type ScannedUtilityClass = {
  className: string;
  count: number;
  sources: string[];
};

export type ScannedComponentCatalog = {
  category: string;
  designerRole: string;
  reason: string;
};

/** Re-exported structural interface IR captured at scan time. */
export type { ComponentInterface, PropSpec } from "./component-interface";

export type ScannedComponent = {
  id: string;
  title: string;
  filePath: string;
  exports: string[];
  colorsUsed: string[];
  cssVarsUsed: string[];
  catalog: ScannedComponentCatalog;
  /** Structural props/variants IR — present when the source parsed cleanly. */
  interface?: import("./component-interface").ComponentInterface;
  /** Verbatim component source (capped) — enables faithful codegen of the body. */
  source?: string;
};

export type ExcludedScanCandidate = {
  filePath: string;
  title: string;
  catalog: ScannedComponentCatalog;
};

/** Every React file under scanned paths — full codebase coverage. */
export type ScannedInventoryFile = {
  filePath: string;
  title: string;
  exports: string[];
  featured: boolean;
  category: string;
};

export type ScanCoverage = {
  scannedPaths: string[];
  totalFiles: number;
  reactFiles: number;
  featuredComponents: number;
  cssVarCount: number;
  colorCount: number;
  cssRuleCount: number;
  utilityClassCount: number;
};

export type ScannedDesignDoc = {
  filePath: string;
  bytes: number;
};

export type WorkspaceScanResult = {
  workspaceRoot: string;
  /** From blocksmith.config.json — stable doc filename */
  workspaceId?: string;
  /** Set when workspaceId is from blocksmith.config.json (not package.json guess) */
  workspaceIdExplicit?: boolean;
  /** owner/repo when scanned via GitHub clone — disambiguates package.json names */
  githubRepo?: string;
  projectName: string;
  scannedAt: string;
  gitCommit: string | null;
  colors: ScannedColor[];
  cssVars: ScannedCssVar[];
  cssRules: ScannedCssRule[];
  utilityClasses: ScannedUtilityClass[];
  components: ScannedComponent[];
  excludedComponents: ExcludedScanCandidate[];
  inventory: ScannedInventoryFile[];
  coverage: ScanCoverage;
  designDocs: ScannedDesignDoc[];
  scannedFiles: number;
};
