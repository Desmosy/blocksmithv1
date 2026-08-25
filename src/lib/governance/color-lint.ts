/**
 * Shared color governance — used by both the commit/CI gate and the live MCP
 * `validate_ui_code` tool so coding-time and push-time enforcement apply the
 * exact same rule: a color must be a defined token. Node-safe, no deps.
 */

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const IGNORE = new Set(["transparent", "currentcolor", "inherit", "none"]);

/** Lowercase 6-digit hex (expand shorthand, drop alpha), or null if not hex. */
export function normalizeHex(hex: string): string | null {
  let h = hex.replace("#", "").toLowerCase();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 8) h = h.slice(0, 6);
  return h.length === 6 ? `#${h}` : null;
}

export function paletteFromColors(colors: { value: string }[]): Set<string> {
  return new Set(
    colors.map((c) => normalizeHex(c.value)).filter((v): v is string => !!v),
  );
}

/** Off-token raw hex literals in a single line. */
export function scanLine(line: string, palette: Set<string>): string[] {
  const matches = line.match(HEX_RE);
  if (!matches) return [];
  const out: string[] = [];
  for (const raw of matches) {
    if (IGNORE.has(raw.toLowerCase())) continue;
    const hex = normalizeHex(raw);
    if (hex && !palette.has(hex)) out.push(raw);
  }
  return out;
}

export type OffToken = { hex: string; line: number; snippet: string };

/** Every off-token color in a block of code, with line numbers. */
export function findOffTokenColors(text: string, palette: Set<string>): OffToken[] {
  const out: OffToken[] = [];
  text.split("\n").forEach((line, i) => {
    for (const hex of scanLine(line, palette)) {
      out.push({ hex, line: i + 1, snippet: line.trim().slice(0, 100) });
    }
  });
  return out;
}

function rgb(hex: string): [number, number, number] | null {
  const h = normalizeHex(hex);
  if (!h) return null;
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
}

export type TokenColor = { name: string; value: string; cssVar?: string };
export type NearestToken = {
  name: string;
  hex: string;
  cssVar?: string;
  distance: number;
};

/**
 * Closest defined token to an off-token hex (squared RGB distance — cheap and
 * good enough to point an agent at the intended token). Powers prescriptive
 * Tier-3 fix suggestions.
 */
export function nearestToken(
  hex: string,
  colors: TokenColor[],
): NearestToken | null {
  const target = rgb(hex);
  if (!target) return null;
  let best: NearestToken | null = null;
  for (const c of colors) {
    const cand = rgb(c.value);
    if (!cand) continue;
    const d =
      (target[0] - cand[0]) ** 2 +
      (target[1] - cand[1]) ** 2 +
      (target[2] - cand[2]) ** 2;
    if (!best || d < best.distance) {
      best = {
        name: c.name,
        hex: normalizeHex(c.value) ?? c.value,
        cssVar: c.cssVar,
        distance: d,
      };
    }
  }
  return best;
}
