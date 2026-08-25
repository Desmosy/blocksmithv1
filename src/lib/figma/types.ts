/**
 * Figma-fit wedge (idea 1): import Figma variables → design.md (Design IR), then
 * reconcile against the code scan as drift. The core transforms here are pure and
 * deterministic; the live Figma MCP / REST call is a thin adapter on top.
 *
 * Figma is the design source of truth; the repo is the code source of truth;
 * design.md is the neutral contract both sides reconcile against.
 */

/** A single Figma variable as surfaced by `get_variable_defs` (Dev Mode MCP). */
export type FigmaVariable = {
  /** Slash-pathed name, e.g. "Color/Text/Primary" or "Radius/Medium". */
  name: string;
  /** Resolved value: hex, rgb/rgba, or a number-like dimension. */
  value: string;
  /** Figma variable resolvedType, when available. */
  type?: "color" | "number" | "string" | "boolean";
};

/**
 * Accepted shapes for Figma variable defs. The MCP returns a flat
 * `{ name: value }` map; the REST API / other tooling may return an array.
 */
export type FigmaVariableDefs =
  | Record<string, string>
  | FigmaVariable[];

export type FigmaImportInput = {
  variables?: FigmaVariableDefs;
  /**
   * Raw `get_design_context` code — used to recover de-facto tokens when the
   * file has no Figma variables. Real variables win on name collision.
   */
  designContextCode?: string;
  /** Published component library (component sets + their variant/properties). */
  components?: import("./components").FigmaComponentInput;
  /** Figma file key (from the file URL) — used as the token source label. */
  fileKey?: string;
  /** Human file/library name — becomes the design system project name. */
  fileName?: string;
  /** Overrides the project name shown in the wiki. */
  projectName?: string;
};

export type FigmaImportSummary = {
  projectName: string;
  fileKey: string;
  cssVars: number;
  colors: number;
  dimensions: number;
  components: number;
  skipped: number;
};

export type ComponentDriftStatus = TokenDriftStatus;

export type ComponentDriftRow = {
  component: string;
  status: ComponentDriftStatus;
  /** Human-readable variant/prop differences (mismatch only). */
  differences: string[];
};

export type ComponentDriftReport = {
  rows: ComponentDriftRow[];
  matched: number;
  mismatched: number;
  figmaOnly: number;
  codeOnly: number;
  inSync: boolean;
};

export type TokenDriftStatus =
  | "match"
  | "mismatch"
  | "figma-only"
  | "code-only";

export type TokenDriftRow = {
  /** Normalized CSS variable name the two sides are matched on. */
  cssVar: string;
  status: TokenDriftStatus;
  figmaValue?: string;
  codeValue?: string;
  /** Where the code value was defined (scan source), when known. */
  codeSource?: string;
};

export type TokenDriftReport = {
  rows: TokenDriftRow[];
  matched: number;
  mismatched: number;
  figmaOnly: number;
  codeOnly: number;
  /** True when Figma and code fully agree on every shared token. */
  inSync: boolean;
};
