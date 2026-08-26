/**
 * `deprecated` is distinct from `stale`: stale means the source vanished,
 * deprecated means a human decided it should not be used in new work while it
 * still exists and still renders.
 */
export type BlockStatus =
  | "draft"
  | "finalized"
  | "stale"
  | "conflict"
  | "deprecated";

export type BlockType =
  | "page"
  | "token"
  | "component"
  | "guideline"
  | "agent-rule";

export interface BlockSource {
  file: string;
  line?: number;
}

export interface ColorToken {
  name: string;
  value: string;
  cssVar: string;
  role: string;
  group: string;
}

export interface TypographyFamily {
  name: string;
  cssVar: string;
  substitute: string;
  weights: string;
  sizes: string;
  lineHeight: string;
  letterSpacing: string;
  role: string;
}

export interface TypeScaleRow {
  role: string;
  size: string;
  lineHeight: string;
  letterSpacing: string;
  token: string;
}

export interface SpacingToken {
  name: string;
  value: string;
  token: string;
}

export interface ComponentScanMeta {
  sourceFile: string;
  exports: string[];
  cssVarsUsed: string[];
  colorsUsed: string[];
  /** Structural props/variants IR — enables faithful codegen (not div stubs). */
  interface?: import("@/lib/scan/component-interface").ComponentInterface;
  /** Verbatim component source (capped) — codegen re-emits the real body. */
  source?: string;
}

export interface ComponentDoc {
  id: string;
  title: string;
  role: string;
  description: string;
  /** Present for workspace-scan components — real paths/tokens from repo. */
  scan?: ComponentScanMeta;
}

export interface SurfaceRow {
  level: string;
  name: string;
  value: string;
  purpose: string;
}

export interface DesignSystem {
  id: string;
  name: string;
  tagline: string;
  theme: string;
  overview: string;
  sourcePath: string;
  updatedAt: string;
  contentHash?: string;
  colors: ColorToken[];
  typography: TypographyFamily[];
  typeScale: TypeScaleRow[];
  spacing: SpacingToken[];
  borderRadius: { element: string; value: string }[];
  layout: { label: string; value: string }[];
  components: ComponentDoc[];
  dos: string[];
  donts: string[];
  surfaces: SurfaceRow[];
  imagery: string;
  layoutNotes: string;
  agentGuide: string;
  similarBrands: { name: string; note: string }[];
  nav: NavSection[];
  /** Workspace scan: raw CSS variable definitions for the CSS Variables page. */
  scanCssVars?: { name: string; value: string; source: string }[];
  /** Workspace scan: class/element rules from CSS files. */
  scanCssRules?: { selector: string; declarations: string; source: string }[];
  /** Workspace scan: Tailwind / className utility tokens from TSX. */
  scanUtilityClasses?: { className: string; count: number; sources: string[] }[];
  /** Workspace scan: every React file under scanned paths. */
  scanInventory?: {
    filePath: string;
    title: string;
    exports: string[];
    featured: boolean;
    category: string;
  }[];
  scanCoverage?: {
    scannedPaths: string[];
    totalFiles: number;
    reactFiles: number;
    featuredComponents: number;
  };
  /** Absolute path where scan ran — used for pull + local rescan hints */
  scanWorkspaceRoot?: string;
}

export interface NavItem {
  id: string;
  label: string;
  href: string;
  children?: NavItem[];
  /** Preview docs grey-out release items (Pipeline/Releases) until connected. */
  locked?: boolean;
}

export interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

export interface Block {
  id: string;
  type: BlockType;
  title: string;
  source: BlockSource;
  updatedAt: string;
  contentHash: string;
  status: BlockStatus;
}
