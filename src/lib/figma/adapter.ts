/**
 * Live Figma adapter — the thin seam between the Figma MCP / REST API and the
 * deterministic import core. Its job is to flatten the messy real-world payloads
 * Figma actually returns into the simple `FigmaImportInput` the rest of the
 * module expects.
 *
 * The literal MCP call (get_variable_defs, get_libraries, …) is a one-liner the
 * agent runs against a selected file; everything it returns is shaped here, and
 * every transform below is pure + unit-tested so live data behaves predictably.
 */
import type { FigmaImportInput } from "./types";
import type { FigmaComponentInput } from "./components";
import { normalizeHex, rgbToHex } from "./normalize";

/** Figma's native color value: 0–1 float channels. */
type FigmaRgba = { r: number; g: number; b: number; a?: number };

/** A variable alias reference — can't be resolved without the full graph. */
type FigmaAlias = { type: "VARIABLE_ALIAS"; id: string };

/** Anything get_variable_defs / the REST API can hand us for a single value. */
type RawFigmaValue =
  | string
  | number
  | boolean
  | FigmaRgba
  | FigmaAlias
  | null
  | undefined
  | { [k: string]: RawFigmaValue };

/** A nested-or-flat variable defs payload. */
export type RawFigmaVariableDefs =
  | Record<string, RawFigmaValue>
  | Array<{ name: string; value: RawFigmaValue; type?: string }>;

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function isRgba(v: unknown): v is FigmaRgba {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as FigmaRgba).r === "number" &&
    typeof (v as FigmaRgba).g === "number" &&
    typeof (v as FigmaRgba).b === "number"
  );
}

function isAlias(v: unknown): v is FigmaAlias {
  return (
    !!v &&
    typeof v === "object" &&
    (v as FigmaAlias).type === "VARIABLE_ALIAS"
  );
}

/** Figma 0–1 RGBA → #rrggbb (alpha dropped — tokens are opaque). */
export function figmaRgbaToHex(c: FigmaRgba): string {
  const ch = (n: number) =>
    clampByte(n * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${ch(c.r)}${ch(c.g)}${ch(c.b)}`;
}

/** Coerce one raw Figma value to the string our token core understands, or null. */
export function coerceFigmaValue(v: RawFigmaValue): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return null; // boolean tokens aren't colors/dims
  if (isRgba(v)) return figmaRgbaToHex(v);
  if (isAlias(v)) return null; // unresolved alias — skip rather than guess
  return null;
}

/**
 * Flatten any get_variable_defs shape into a flat `{ name: stringValue }` map:
 * handles flat maps, arrays, nested-by-collection objects, RGBA-object colors,
 * numeric values, and skips unresolved aliases. Nested groups are joined with
 * `/` so the downstream name→cssVar conversion keeps the group prefix.
 */
export function flattenFigmaVariableDefs(
  raw: RawFigmaVariableDefs,
): Record<string, string> {
  const out: Record<string, string> = {};

  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (!entry || typeof entry.name !== "string") continue;
      const val = coerceFigmaValue(entry.value);
      if (val != null) out[entry.name.trim()] = val;
    }
    return out;
  }

  const walk = (obj: Record<string, RawFigmaValue>, prefix: string) => {
    for (const [key, value] of Object.entries(obj)) {
      const name = prefix ? `${prefix}/${key}` : key;
      // A plain nested object (not RGBA, not alias) is a collection/group.
      if (
        value &&
        typeof value === "object" &&
        !isRgba(value) &&
        !isAlias(value) &&
        !Array.isArray(value)
      ) {
        walk(value as Record<string, RawFigmaValue>, name);
        continue;
      }
      const val = coerceFigmaValue(value);
      if (val != null) out[name] = val;
    }
  };
  walk(raw, "");
  return out;
}

/** Raw component-ish payloads Figma tooling returns (kept permissive). */
export type RawFigmaComponents =
  | FigmaComponentInput
  | Array<Record<string, unknown>>;

/**
 * Shape a component listing into FigmaComponentInput. Already-compatible shapes
 * (raw `componentPropertyDefinitions`, or pre-normalized) pass straight through;
 * code-connect-style `{ name }`-only entries become presence-only components.
 */
export function adaptFigmaComponents(
  raw: RawFigmaComponents | undefined,
): FigmaComponentInput | undefined {
  if (!raw || !Array.isArray(raw) || raw.length === 0) return undefined;
  // normalizeFigmaComponents already tolerates the documented shapes; this is a
  // passthrough seam so the live call site has one obvious place to hook.
  return raw as FigmaComponentInput;
}

// ─── Design-context extraction (the "works on any file" path) ────────────────
//
// Most real Figma files — especially community kits and older systems — DON'T
// use Figma variables. get_variable_defs returns {} for them. But the design
// still encodes de-facto tokens (colors, radii, type sizes) in its layers, which
// get_design_context surfaces as React+Tailwind code. This extractor recovers
// those tokens automatically, so a file works whether or not it has variables.

const NAMED_COLORS: Record<string, string> = {
  white: "#ffffff",
  black: "#000000",
};

function toHex(raw: string): string | null {
  const v = raw.trim();
  if (NAMED_COLORS[v]) return NAMED_COLORS[v];
  return normalizeHex(v) ?? rgbToHex(v);
}

/** Roles we bucket colors into, in priority order for single-assignment. */
const COLOR_ROLE_PATTERNS: Array<{ role: string; re: RegExp }> = [
  { role: "Text", re: /\btext-(?:\[([^\]]+)\]|(white|black))\b/g },
  { role: "Background", re: /\bbg-(?:\[([^\]]+)\]|(white|black))\b/g },
  { role: "Border", re: /\bborder-\[([^\]]+)\]/g },
  { role: "Accent", re: /\b(?:from|to|via|fill|stroke)-\[([^\]]+)\]/g },
];
const ROLE_ORDER = ["Text", "Background", "Border", "Accent"];

/**
 * Extract de-facto design tokens from get_design_context output (React+Tailwind
 * code). Returns a `{ name: value }` map in the same shape get_variable_defs
 * produces, so it flows through the identical import pipeline.
 */
export function figmaDesignContextToTokens(
  code: string,
): Record<string, string> {
  // 1. Colors by role.
  const roleCounts = new Map<string, Map<string, number>>();
  for (const { role, re } of COLOR_ROLE_PATTERNS) {
    const counts = roleCounts.get(role) ?? new Map<string, number>();
    for (const m of code.matchAll(re)) {
      const hex = toHex(m[1] ?? m[2] ?? "");
      if (hex) counts.set(hex, (counts.get(hex) ?? 0) + 1);
    }
    roleCounts.set(role, counts);
  }
  // Any hex/rgba not captured above → Accent (shadows, gradients, masks).
  const assignedAnywhere = new Set<string>();
  for (const counts of roleCounts.values())
    for (const hex of counts.keys()) assignedAnywhere.add(hex);
  const accent = roleCounts.get("Accent") ?? new Map<string, number>();
  for (const m of code.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g)) {
    const hex = toHex(m[0]);
    if (hex && !assignedAnywhere.has(hex)) {
      accent.set(hex, (accent.get(hex) ?? 0) + 1);
    }
  }
  roleCounts.set("Accent", accent);

  // Assign each unique hex to a single role: highest count, ties by priority.
  const bestRole = new Map<string, { role: string; count: number }>();
  for (const role of ROLE_ORDER) {
    for (const [hex, count] of roleCounts.get(role) ?? []) {
      const cur = bestRole.get(hex);
      if (!cur || count > cur.count) bestRole.set(hex, { role, count });
    }
  }

  const out: Record<string, string> = {};
  for (const role of ROLE_ORDER) {
    const hexes = [...bestRole.entries()]
      .filter(([, v]) => v.role === role)
      .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
      .map(([hex]) => hex);
    hexes.forEach((hex, i) => {
      out[`Color/${role}/${i + 1}`] = hex;
    });
  }

  // 2. Border radii.
  const radii = new Set<string>();
  for (const m of code.matchAll(/\brounded-\[([\d.]+)px\]/g)) radii.add(m[1]);
  if (/\brounded-full\b/.test(code)) radii.add("9999");
  for (const v of [...radii].sort((a, b) => parseFloat(a) - parseFloat(b))) {
    out[`Radius/${v}`] = `${v}px`;
  }

  // 3. Type scale (font sizes).
  const sizes = new Set<string>();
  for (const m of code.matchAll(/\btext-\[([\d.]+)px\]/g)) sizes.add(m[1]);
  for (const v of [...sizes].sort((a, b) => parseFloat(a) - parseFloat(b))) {
    out[`Font Size/${v}`] = `${v}px`;
  }

  return out;
}

export type AssembleFigmaImportArgs = {
  /** Raw output of the Figma MCP `get_variable_defs` (any shape). */
  variableDefs?: RawFigmaVariableDefs;
  /**
   * Raw output of `get_design_context` (React+Tailwind code). Used to recover
   * de-facto tokens when the file has no Figma variables. Real variables win
   * over inferred ones on name collisions.
   */
  designContextCode?: string;
  /** Optional component listing (get_libraries / component metadata). */
  components?: RawFigmaComponents;
  fileKey?: string;
  fileName?: string;
  projectName?: string;
};

/**
 * Assemble the canonical FigmaImportInput from raw Figma MCP output. This is the
 * single function a live call site needs after pulling data from Figma:
 *
 *   const variableDefs = await mcp.get_variable_defs({ fileKey });
 *   const input = assembleFigmaImport({ variableDefs, fileKey, fileName });
 *   await importFigmaVariables(input);   // or POST /api/figma/import
 */
export function assembleFigmaImport(
  args: AssembleFigmaImportArgs,
): FigmaImportInput {
  const inferred = args.designContextCode
    ? figmaDesignContextToTokens(args.designContextCode)
    : {};
  const fromVars = args.variableDefs
    ? flattenFigmaVariableDefs(args.variableDefs)
    : {};
  // Real variables override inferred tokens on name collision.
  const variables = { ...inferred, ...fromVars };
  return {
    variables,
    components: adaptFigmaComponents(args.components),
    fileKey: args.fileKey,
    fileName: args.fileName,
    projectName: args.projectName,
  };
}
