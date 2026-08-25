import { basename } from "path";

/** Portfolio / marketing UI blocks: src/components/Hero.tsx (not full pages). */
export function isPortfolioSectionFile(relPath: string): boolean {
  if (!/^src\/components\/[^/]+\.tsx$/i.test(relPath)) return false;
  const base = basename(relPath).replace(/\.(tsx|jsx)$/i, "");
  if (/Page$/i.test(base)) return false;
  if (/Context$/i.test(base)) return false;
  if (/^(App|main)$/i.test(base)) return false;
  return true;
}
