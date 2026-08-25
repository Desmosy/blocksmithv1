import { basename } from "path";
import { isPortfolioSectionFile } from "./portfolio-section";
import type { CatalogOverrides } from "./workspace-config";
import { pathMatchesList } from "./workspace-config";

/**
 * Scan → classify → wiki.
 * Raw file discovery is not enough; only designer-facing primitives and showcases
 * belong in the Component Library.
 */
export type CatalogCategory =
  | "design_primitive"
  | "token_showcase"
  | "design_pattern"
  | "rendering_infra"
  | "app_chrome"
  | "dev_tool"
  | "utility"
  | "page_shell"
  | "unknown";

export type CatalogDecision = {
  includeInWiki: boolean;
  category: CatalogCategory;
  /** One line a UI/UX designer would understand. */
  designerRole: string;
  reason: string;
};

const DESIGN_PRIMITIVE =
  /(Button|Input|Card|Modal|Badge|Avatar|Select|Checkbox|Switch|Tooltip|Dialog|Tag|Pill|CTA|Chip|Alert|Banner|Dropdown|Menu|Tab|Toggle|Radio|Textarea|Field)/i;

const TOKEN_SHOWCASE =
  /(Swatch|Specimen|TypeScale|SurfaceLevel|Spacing|Typography|ColorPalette)/i;

/** BlockSmith / Pretext rendering engine — never vendor design system. */
const RENDERING_PACKAGE = /(?:^|\/)packages\/pretext-components\//i;

const RENDERING_SOURCE =
  /(?:TextSlot|ComponentSpec|measureText|PretextComponentView|PretextText|from\s+["']@chenglou\/pretext|from\s+["']@blocksmith\/pretext-components)/;

const DEV_TOOL_FILE =
  /(?:ComputedBoxModel|SpacingInspectables|InspectablePreview|ComponentLivePreview|ComponentSpecPreview|ComponentGallery|frames)\.tsx$/i;

const APP_CHROME_FILE =
  /(?:Shell|Provider|Context|Gate|Overlay|Nav|Sidebar|Toolbar|Switcher|Toast|Logo|Generating|Visualize|MarkdownBody|StatusBadge)\.tsx$/i;

const UTILITY_FILE = /(?:CopyButton|SyncedAtLabel)\.tsx$/i;

/** Paths that typically hold vendor design-system UI (not app pages). */
const VENDOR_DS_PATH =
  /(?:^|\/)(?:src\/)?(?:components\/ui|ui\/components|design-system|ds\/components|primitives|core\/components|lib\/ui|ui\/src)(?:\/|$)/i;

function inCatalogRoot(relPath: string, extraPatterns: RegExp[] = []): boolean {
  if (extraPatterns.some((re) => re.test(relPath))) return true;
  return VENDOR_DS_PATH.test(relPath);
}

/** Apply .blocksmith/catalog.json overrides after heuristic classify. */
export function applyCatalogOverrides(
  relPath: string,
  decision: CatalogDecision,
  overrides: CatalogOverrides,
): CatalogDecision | "skip" {
  if (overrides.exclude?.length && pathMatchesList(relPath, overrides.exclude)) {
    return "skip";
  }
  if (
    overrides.forceFeatured?.length &&
    pathMatchesList(relPath, overrides.forceFeatured)
  ) {
    const base = basename(relPath).replace(/\.(tsx|jsx)$/i, "");
    return classifyByCategory(
      "design_primitive",
      `Reusable UI primitive: ${base}.`,
      "forceFeatured in .blocksmith/catalog.json",
    );
  }
  if (
    overrides.forceInventoryOnly?.length &&
    pathMatchesList(relPath, overrides.forceInventoryOnly)
  ) {
    return { ...decision, includeInWiki: false };
  }
  return decision;
}

function isWikiVisualShowcase(relPath: string, base: string): boolean {
  if (!/\/visual\//i.test(relPath)) return false;
  if (DEV_TOOL_FILE.test(relPath)) return false;
  return DESIGN_PRIMITIVE.test(base) || TOKEN_SHOWCASE.test(base);
}

function isWikiRootPrimitive(relPath: string, base: string): boolean {
  if (!/^src\/components\/wiki\/[^/]+\.tsx$/i.test(relPath)) return false;
  if (APP_CHROME_FILE.test(relPath)) return false;
  return DESIGN_PRIMITIVE.test(base);
}

function isDemoPrimitive(relPath: string, base: string): boolean {
  if (!/\/pages\/demo\//i.test(relPath)) return false;
  if (/View\.tsx$/i.test(relPath)) return false;
  return DESIGN_PRIMITIVE.test(base);
}

function classifyByCategory(
  category: CatalogCategory,
  designerRole: string,
  reason: string,
): CatalogDecision {
  const includeInWiki =
    category === "design_primitive" ||
    category === "token_showcase" ||
    category === "design_pattern";
  return { includeInWiki, category, designerRole, reason };
}

/**
 * Decide whether a scanned TSX file belongs in the wiki Component Library.
 */
export function classifyComponentForWiki(
  relPath: string,
  exports: string[],
  sourceText: string,
  catalogPatterns: RegExp[] = [],
): CatalogDecision {
  const base = basename(relPath).replace(/\.(tsx|jsx)$/i, "");

  if (/Page$/i.test(base) || exports.some((e) => /Page$/i.test(e))) {
    return classifyByCategory(
      "page_shell",
      "Application page — not a reusable design primitive.",
      "Filename or export ends with Page.",
    );
  }

  if (RENDERING_PACKAGE.test(relPath)) {
    return classifyByCategory(
      "rendering_infra",
      "Internal preview/layout engine — not part of the product design system.",
      "Lives under packages/pretext-components (BlockSmith renderer).",
    );
  }

  if (RENDERING_SOURCE.test(sourceText)) {
    return classifyByCategory(
      "rendering_infra",
      "Low-level text/layout renderer — designers document buttons and cards, not measure utilities.",
      "Source imports or implements Pretext/measure rendering.",
    );
  }

  if (DEV_TOOL_FILE.test(relPath)) {
    return classifyByCategory(
      "dev_tool",
      "Developer inspection UI — not a shipped design component.",
      "Preview host or layout debug tool.",
    );
  }

  if (APP_CHROME_FILE.test(relPath)) {
    return classifyByCategory(
      "app_chrome",
      "Application shell or status UI — not a design-system primitive.",
      "Navigation, shell, or status chrome.",
    );
  }

  if (UTILITY_FILE.test(relPath)) {
    return classifyByCategory(
      "utility",
      "Small helper control — not worth a design-system doc page.",
      "Copy/sync utility component.",
    );
  }

  if (inCatalogRoot(relPath, catalogPatterns)) {
    const kind = TOKEN_SHOWCASE.test(base)
      ? "token_showcase"
      : "design_primitive";
    return classifyByCategory(
      kind,
      kind === "token_showcase"
        ? `Token documentation pattern for ${base}.`
        : `Reusable UI primitive: ${base}.`,
      "Under configured or default design-system component path.",
    );
  }

  if (isWikiVisualShowcase(relPath, base)) {
    const kind = TOKEN_SHOWCASE.test(base) ? "token_showcase" : "design_primitive";
    return classifyByCategory(
      kind,
      kind === "token_showcase"
        ? `Reference showcase for tokens (${base}).`
        : `Documented UI example (${base}).`,
      "Wiki visual showcase folder.",
    );
  }

  if (isWikiRootPrimitive(relPath, base)) {
    return classifyByCategory(
      "design_primitive",
      `Documented UI example (${base}).`,
      "Standalone wiki primitive preview.",
    );
  }

  if (isDemoPrimitive(relPath, base)) {
    return classifyByCategory(
      "design_primitive",
      `Demo instance of a UI primitive (${base}).`,
      "Demo folder primitive.",
    );
  }

  if (/\/packages\/[^/]+\/src\//i.test(relPath)) {
    // Check if the monorepo package looks like a design-system package
    if (inCatalogRoot(relPath, catalogPatterns)) {
      const kind = TOKEN_SHOWCASE.test(base) ? "token_showcase" : "design_primitive";
      return classifyByCategory(
        kind,
        kind === "token_showcase"
          ? `Token documentation pattern for ${base}.`
          : `Reusable UI primitive: ${base}.`,
        "Monorepo package under a design-system path.",
      );
    }
    if (DESIGN_PRIMITIVE.test(base) || exports.some((e) => DESIGN_PRIMITIVE.test(e))) {
      return classifyByCategory(
        "design_primitive",
        `Reusable UI primitive: ${base}.`,
        "Monorepo package with recognized component name.",
      );
    }
    return classifyByCategory(
      "rendering_infra",
      "Monorepo package — not auto-cataloged unless under a design-system path.",
      "Generic packages/ scan hit; set BLOCKSMITH_CATALOG_PATHS for vendor DS folders.",
    );
  }

  if (DESIGN_PRIMITIVE.test(base) || exports.some((e) => DESIGN_PRIMITIVE.test(e))) {
    return {
      includeInWiki: false,
      category: "design_primitive",
      designerRole: `Possible UI primitive (${base}) — not auto-published.`,
      reason:
        "Name matches a primitive pattern but file is outside BLOCKSMITH_CATALOG_PATHS / default ui/ paths.",
    };
  }

  if (TOKEN_SHOWCASE.test(base)) {
    return {
      includeInWiki: false,
      category: "token_showcase",
      designerRole: `Possible token showcase (${base}) — not auto-published.`,
      reason: "Token showcase name outside catalog roots.",
    };
  }

  if (isPortfolioSectionFile(relPath)) {
    return classifyByCategory(
      "design_pattern",
      `UI section: ${base} — layout, typography, and interaction patterns.`,
      "Portfolio component under src/components/.",
    );
  }

  return {
    includeInWiki: false,
    category: "unknown",
    designerRole: "Not classified as designer-facing.",
    reason: "No design-system path or recognized primitive/showcase name.",
  };
}

export function categoryLabel(category: CatalogCategory): string {
  switch (category) {
    case "design_primitive":
      return "Design primitive";
    case "token_showcase":
      return "Token showcase";
    case "design_pattern":
      return "Design pattern";
    case "rendering_infra":
      return "Rendering infra";
    case "app_chrome":
      return "App chrome";
    case "dev_tool":
      return "Dev tool";
    case "utility":
      return "Utility";
    case "page_shell":
      return "Page shell";
    default:
      return "Unknown";
  }
}
