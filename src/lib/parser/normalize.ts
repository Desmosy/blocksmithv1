/** Strip markdown backticks and whitespace from table cells */
export function stripCell(value: string): string {
  return value.replace(/`/g, "").trim();
}

export function parseHexColor(raw: string): string | null {
  const v = stripCell(raw);
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return v;
  return null;
}

export function isTableHeaderRow(cells: string[]): boolean {
  const first = stripCell(cells[0] ?? "").toLowerCase();
  return (
    first === "name" ||
    first === "role" ||
    first === "level" ||
    first === "value" ||
    first === "token" ||
    // The radius and layout tables head their first column with these; the
    // wiki export was re-emitting "| Element | Value |" as a data row.
    first === "element" ||
    first === "label" ||
    first === "property"
  );
}
