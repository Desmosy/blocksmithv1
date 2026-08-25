import matter from "gray-matter";

/** Parse YAML frontmatter and normalize scalar values for existing consumers. */
export function parseMarkdownFrontmatter(markdown: string): Record<string, string> {
  const data = matter(markdown).data;
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      value instanceof Date ? value.toISOString() : String(value ?? ""),
    ]),
  );
}
