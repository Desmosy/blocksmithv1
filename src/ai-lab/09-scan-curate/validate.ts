import { isWorkspaceScanMarkdown } from "@/lib/scan/parse";

function normalizeHex(raw: string): string | null {
  const m = raw.match(/#([0-9a-fA-F]{3,8})\b/);
  if (!m) return null;
  let h = m[1].toLowerCase();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 8) h = h.slice(0, 6);
  return h.length === 6 ? `#${h}` : null;
}

export function extractHexSet(text: string): Set<string> {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  const re = /#([0-9a-fA-F]{3,8})\b/g;
  while ((m = re.exec(text)) !== null) {
    const hex = normalizeHex(`#${m[1]}`);
    if (hex) out.add(hex);
  }
  return out;
}

/** Curated markdown must not introduce colors absent from scan facts. */
export function assertHexSubset(factsText: string, curatedText: string): void {
  const allowed = extractHexSet(factsText);
  const used = extractHexSet(curatedText);
  const invented = [...used].filter((h) => !allowed.has(h));
  if (invented.length > 0) {
    throw new Error(
      `Curated doc invented hex not in scan facts: ${invented.slice(0, 5).join(", ")}`,
    );
  }
}

export function assertInventoryCoverage(
  factsMd: string,
  publishedMd: string,
): void {
  const paths =
    factsMd.match(/\| `([^`]+\.tsx)` \|/g)?.map((row) => {
      const m = row.match(/`([^`]+)`/);
      return m?.[1] ?? "";
    }).filter(Boolean) ?? [];
  if (!paths.length) return;
  const missing = paths.filter((p) => !publishedMd.includes(p));
  if (missing.length > 0) {
    throw new Error(
      `Published doc missing ${missing.length} inventory path(s), e.g. ${missing[0]}`,
    );
  }
}

export function assertCuratedScanShape(md: string): void {
  if (!isWorkspaceScanMarkdown(md)) {
    throw new Error("Curated output missing workspace-scan frontmatter.");
  }
  if (!/## [\d.]+\. Component Library/i.test(md)) {
    throw new Error("Curated output missing Component Library section.");
  }
  if (!/^### /m.test(md)) {
    throw new Error("Curated output has no component entries (### headings).");
  }
}
