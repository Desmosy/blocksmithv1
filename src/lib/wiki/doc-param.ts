/** Allowed query key for selecting a design markdown file */
export const DOC_QUERY_KEY = "doc";

export function docQuery(fileName: string): string {
  return `${DOC_QUERY_KEY}=${encodeURIComponent(fileName)}`;
}

export function hrefWithDoc(path: string, fileName: string): string {
  const base = path.startsWith("/") ? path : `/${path}`;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}${docQuery(fileName)}`;
}

export function resolveDocParam(
  value: string | string[] | undefined | null,
): string | null {
  if (!value) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw?.trim()) return null;
  return decodeURIComponent(raw.trim());
}
