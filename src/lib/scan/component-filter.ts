import { basename } from "path";
import { isPortfolioSectionFile } from "./portfolio-section";

/**
 * Decide whether a TSX file is a design-system component worth cataloging.
 * Excludes wiki pages, app shells, providers, and BlockSmith-style infra.
 */
const EXCLUDE_PATH = [
  /\/wiki\/pages\//i,
  /\/app\/wiki\//i,
  /\/app\/api\//i,
  /\/app\/studio\//i,
  /\/studio\//i,
  /\/share\//i,
  /\/home\//i,
  /\/hooks\//i,
  /\/mcp\//i,
  /\/ai-lab\//i,
  /\/lib\/parser\//i,
  /\/lib\/blocks\//i,
  /\/lib\/sync\//i,
  /\/lib\/scan\//i,
  /\/lib\/design-ir\//i,
  /\/lib\/clients\//i,
  /\/lib\/activity\//i,
  /\/lib\/governance\//i,
];

/** Directories that usually contain catalog-worthy UI (not app pages). */
const INCLUDE_PATH = [/\/ui\//i, /\/visual\//i, /\/pages\/demo\//i];

/** Filename stems for design primitives (no trailing word boundary — matches ButtonPreview). */
const PRIMITIVE =
  /(Button|Input|Card|Modal|Badge|Avatar|Select|Checkbox|Switch|Tooltip|Dialog|Tag|Pill|CTA|Preview|Chip|Alert|Banner|Dropdown|Menu|Tab|Toggle|Radio|Textarea|Field|Swatch|Specimen)/i;

const EXCLUDE_FILE =
  /(?:Page|Layout|Shell|Provider|Context|Gate|Overlay|Styles|Nav|Sidebar|Toolbar|Switcher|Toast|Logo|FontFaces|ChromeStyles|ThemeStyles|MarkdownBody|Gallery|LivePreview|SpecPreview|InspectablePreview|ComputedBoxModel|SpacingInspectables|Generating|Visualize)\.tsx$/i;

const PACKAGE_EXCLUDE = /(?:ComponentGallery|frames)\.tsx$/i;

/** Preview hosts and devtools inside otherwise-included visual/ folders. */
const VISUAL_INFRA =
  /(?:ComponentLivePreview|ComponentSpecPreview|InspectablePreview|ComputedBoxModel|SpacingInspectables)\.tsx$/i;

/** Top-level wiki/*.tsx files that are app chrome, not design primitives. */
const WIKI_ROOT_INFRA =
  /(?:Badge|Visualize|Logo|Nav|Sync|Status|Generating|Overlay|Loading|Markdown)/i;

function hasPrimitiveSignal(relPath: string, exports: string[]): boolean {
  const base = basename(relPath).replace(/\.(tsx|jsx)$/i, "");
  if (PRIMITIVE.test(base)) return true;
  return exports.some((e) => PRIMITIVE.test(e));
}

function isExcludedPath(relPath: string): boolean {
  if (/\/pages\/demo\//i.test(relPath)) return false;
  if (/\/pages\//i.test(relPath)) return true;
  return EXCLUDE_PATH.some((re) => re.test(relPath));
}

export function isScannableDesignComponent(
  relPath: string,
  exports: string[],
): boolean {
  if (isExcludedPath(relPath)) return false;
  if (EXCLUDE_FILE.test(relPath)) return false;
  if (PACKAGE_EXCLUDE.test(relPath)) return false;

  const base = basename(relPath).replace(/\.(tsx|jsx)$/i, "");
  if (/Page$/i.test(base)) return false;
  if (exports.some((e) => /Page$/i.test(e))) return false;

  if (INCLUDE_PATH.some((re) => re.test(relPath))) {
    if (VISUAL_INFRA.test(relPath)) return false;
    if (/\/pages\/demo\//i.test(relPath) && /View\.tsx$/i.test(relPath)) return false;
    return true;
  }

  if (/^src\/components\/wiki\/[^/]+\.tsx$/i.test(relPath)) {
    if (WIKI_ROOT_INFRA.test(base)) return false;
    return hasPrimitiveSignal(relPath, exports);
  }

  // Monorepo packages: candidate only — catalog.ts decides wiki inclusion.
  if (/packages\/[^/]+\/src\//i.test(relPath)) return true;

  if (isPortfolioSectionFile(relPath)) return true;

  return hasPrimitiveSignal(relPath, exports) || INCLUDE_PATH.some((re) => re.test(relPath));
}
