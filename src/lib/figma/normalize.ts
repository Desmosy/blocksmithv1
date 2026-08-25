import type { FigmaVariable, FigmaVariableDefs } from "./types";

/** Coerce either accepted Figma defs shape into a flat variable list. */
export function normalizeFigmaVariables(
  defs: FigmaVariableDefs,
): FigmaVariable[] {
  if (Array.isArray(defs)) {
    return defs
      .filter((v) => v && typeof v.name === "string")
      .map((v) => ({
        name: v.name.trim(),
        value: String(v.value ?? "").trim(),
        type: v.type,
      }));
  }
  return Object.entries(defs).map(([name, value]) => ({
    name: name.trim(),
    value: String(value ?? "").trim(),
  }));
}

/**
 * Convert a Figma variable name into a CSS custom property.
 * "Color/Text/Primary" → "--color-text-primary"; an existing "--foo" is kept.
 * Group names ("Color", "Radius", "Spacing") survive as prefixes, which is what
 * the scan token classifier keys off downstream.
 */
export function figmaNameToCssVar(name: string): string {
  const trimmed = name.trim();
  if (trimmed.startsWith("--")) return trimmed.toLowerCase();
  const slug = trimmed
    .replace(/[/.]+/g, "-")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2") // split camelCase boundaries
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `--${slug}`;
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function toHexByte(n: number): string {
  return clampByte(n).toString(16).padStart(2, "0");
}

/** rgb()/rgba() (0–255 or 0–1 floats) → #rrggbb. Returns null if unparseable. */
export function rgbToHex(value: string): string | null {
  const m = value.match(/rgba?\(([^)]+)\)/i);
  if (!m) return null;
  const parts = m[1].split(/[,\s/]+/).filter(Boolean).slice(0, 3);
  if (parts.length < 3) return null;
  const nums = parts.map((p) => {
    if (p.endsWith("%")) return (parseFloat(p) / 100) * 255;
    const n = parseFloat(p);
    return n <= 1 && !Number.isInteger(n) ? n * 255 : n;
  });
  if (nums.some((n) => Number.isNaN(n))) return null;
  return `#${nums.map(toHexByte).join("")}`;
}

/** Normalize a hex string to lowercase #rrggbb (expands shorthand, drops alpha). */
export function normalizeHex(value: string): string | null {
  const m = value.match(/#([0-9a-fA-F]{3,8})\b/);
  if (!m) return null;
  let h = m[1].toLowerCase();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 8 || h.length === 4) h = h.slice(0, h.length === 4 ? 3 : 6);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return h.length === 6 ? `#${h}` : null;
}

/** Resolve a Figma value to a hex color, or null if it isn't a color. */
export function asColor(v: FigmaVariable): string | null {
  if (v.type && v.type !== "color") return null;
  return normalizeHex(v.value) ?? rgbToHex(v.value);
}

/**
 * Resolve a Figma value to a CSS dimension string ("8px", "1.5rem"), or null.
 * Bare numbers are treated as pixels — the Figma convention for spacing/radius.
 */
export function asDimension(v: FigmaVariable): string | null {
  if (v.type === "color" || v.type === "boolean") return null;
  const raw = v.value.trim();
  if (/^-?\d+(\.\d+)?(px|rem|em|%|pt)$/i.test(raw)) return raw.toLowerCase();
  if (/^-?\d+(\.\d+)?$/.test(raw)) return `${parseFloat(raw)}px`;
  return null;
}
