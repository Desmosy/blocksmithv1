import type {
  ComponentInterface,
  PropSpec,
  ScannedComponent,
} from "@/lib/scan/types";

/**
 * Figma component-library ingestion. A Figma published component (or component
 * set) carries variant properties and component properties — the same surface a
 * code component exposes as props. We normalize both into the scan's
 * ScannedComponent IR so the wiki Component Library renders them and drift can
 * compare "this Figma component has a `size=lg` variant your code doesn't."
 */

/** Normalized Figma component — the shape the rest of the module works with. */
export type FigmaComponent = {
  name: string;
  description?: string;
  /** Figma component/componentSet key, if known. */
  key?: string;
  /** Variant property name → its options, e.g. { Size: ["sm","md","lg"] }. */
  variants: Record<string, string[]>;
  /** Boolean component properties (toggles). */
  booleanProps: string[];
  /** Text component properties. */
  textProps: string[];
  /** Instance-swap component properties (slots). */
  instanceProps: string[];
};

/** Figma's raw `componentPropertyDefinitions` entry (from the REST API / plugin). */
type RawPropertyDef = {
  type?: string;
  defaultValue?: unknown;
  variantOptions?: string[];
};

/** Flexible input: either a pre-normalized FigmaComponent or Figma's raw shape. */
export type FigmaComponentInput = Array<
  | FigmaComponent
  | {
      name: string;
      description?: string;
      key?: string;
      /** Figma's componentPropertyDefinitions map. */
      componentPropertyDefinitions?: Record<string, RawPropertyDef>;
      /** Alternative pre-split forms. */
      variantProperties?: Record<string, string[]>;
      properties?: Record<string, string>;
    }
>;

function isNormalized(c: unknown): c is FigmaComponent {
  return (
    !!c &&
    typeof c === "object" &&
    "variants" in c &&
    typeof (c as FigmaComponent).variants === "object"
  );
}

/** Coerce any accepted component input into the normalized FigmaComponent shape. */
export function normalizeFigmaComponents(
  input: FigmaComponentInput,
): FigmaComponent[] {
  const out: FigmaComponent[] = [];
  for (const c of input) {
    if (!c || typeof c.name !== "string" || !c.name.trim()) continue;
    if (isNormalized(c)) {
      out.push({
        name: c.name.trim(),
        description: c.description,
        key: c.key,
        variants: c.variants ?? {},
        booleanProps: c.booleanProps ?? [],
        textProps: c.textProps ?? [],
        instanceProps: c.instanceProps ?? [],
      });
      continue;
    }

    const variants: Record<string, string[]> = { ...(c.variantProperties ?? {}) };
    const booleanProps: string[] = [];
    const textProps: string[] = [];
    const instanceProps: string[] = [];

    const defs = c.componentPropertyDefinitions ?? {};
    for (const [rawName, def] of Object.entries(defs)) {
      // Figma suffixes non-variant property names with "#<id>" — strip it.
      const name = rawName.replace(/#\d+(:\d+)?$/, "").trim();
      const type = (def.type ?? "").toUpperCase();
      if (type === "VARIANT") {
        variants[name] = def.variantOptions ?? [];
      } else if (type === "BOOLEAN") {
        booleanProps.push(name);
      } else if (type === "TEXT") {
        textProps.push(name);
      } else if (type === "INSTANCE_SWAP") {
        instanceProps.push(name);
      }
    }

    // Pre-split `properties` map (name → "boolean"|"text"|"instance").
    for (const [name, kind] of Object.entries(c.properties ?? {})) {
      const k = String(kind).toLowerCase();
      if (k.startsWith("bool")) booleanProps.push(name);
      else if (k.startsWith("text") || k === "string") textProps.push(name);
      else if (k.startsWith("instance")) instanceProps.push(name);
    }

    out.push({
      name: c.name.trim(),
      description: c.description,
      key: c.key,
      variants,
      booleanProps,
      textProps,
      instanceProps,
    });
  }
  return out;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function propName(name: string): string {
  // "Has Icon" → "hasIcon"; keep already-camel/single-word names intact.
  const parts = name.trim().split(/[\s_-]+/);
  return parts
    .map((p, i) => (i === 0 ? p.charAt(0).toLowerCase() + p.slice(1) : p.charAt(0).toUpperCase() + p.slice(1)))
    .join("");
}

/** Build the structural interface IR for a Figma component (variants → props). */
export function figmaComponentInterface(c: FigmaComponent): ComponentInterface {
  const props: PropSpec[] = [];

  for (const [vName, options] of Object.entries(c.variants)) {
    props.push({
      name: propName(vName),
      type: options.map((o) => `"${o}"`).join(" | ") || "string",
      optional: true,
      variants: options,
    });
  }
  for (const b of c.booleanProps) {
    props.push({ name: propName(b), type: "boolean", optional: true });
  }
  for (const t of c.textProps) {
    props.push({ name: propName(t), type: "string", optional: true });
  }
  for (const i of c.instanceProps) {
    props.push({ name: propName(i), type: "ReactNode", optional: true });
  }

  return {
    name: c.name.replace(/[^A-Za-z0-9]/g, ""),
    props: props.sort((a, b) => a.name.localeCompare(b.name)),
    extendsTypes: [],
    hasChildren: c.instanceProps.length > 0,
    propsTypeName: `${c.name.replace(/[^A-Za-z0-9]/g, "")}Props`,
  };
}

/** Map normalized Figma components into the scan's ScannedComponent IR. */
export function figmaComponentsToScanned(
  comps: FigmaComponent[],
  sourceLabel: string,
): ScannedComponent[] {
  const seen = new Set<string>();
  const out: ScannedComponent[] = [];
  for (const c of comps) {
    const id = slugify(c.name);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const variantCount = Object.keys(c.variants).length;
    const role =
      c.description?.trim() ||
      (variantCount
        ? `Figma component · ${variantCount} variant propert${variantCount === 1 ? "y" : "ies"}`
        : "Figma component");
    out.push({
      id,
      title: c.name,
      filePath: `${sourceLabel}/${c.key || id}`,
      exports: [c.name.replace(/[^A-Za-z0-9]/g, "")],
      colorsUsed: [],
      cssVarsUsed: [],
      catalog: {
        category: "design_primitive",
        designerRole: role,
        reason: "",
      },
      interface: figmaComponentInterface(c),
    });
  }
  return out;
}
