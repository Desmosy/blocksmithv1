import type { CSSProperties } from "react";
import { isHex, mixHex } from "@/lib/design-ir/color-utils";
import type { ComponentPreviewKind } from "./classify";
import type { ComponentPreviewSpec } from "./parse-spec";

/**
 * A single interaction state for a component preview. States are *derived*
 * deterministically from the base spec (the doc only describes a resting
 * style), so hover/active/focus/disabled stay on-palette by construction —
 * never invented colors. `opacity` is applied by the renderer wrapper.
 */
export type ComponentState = {
  name: string;
  spec: ComponentPreviewSpec;
  opacity?: number;
};

/** Darken toward black, keeping `keep` of the original (0.9 ≈ 10% darker). */
function darken(hex: string, keep: number): string {
  return isHex(hex) ? mixHex(hex, "#000000", keep) : hex;
}

/** Low-emphasis wash of `color` over the surface — for ghost/outline hovers. */
function softFill(color: string, surface: string): string {
  if (isHex(color) && isHex(surface)) return mixHex(color, surface, 0.12);
  return `color-mix(in srgb, ${color} 12%, transparent)`;
}

function focusRing(base: string): string {
  return `0 0 0 3px color-mix(in srgb, ${base} 45%, transparent)`;
}

/** Color that drives the focus ring — the accent for filled, else the label. */
function ringBase(spec: ComponentPreviewSpec): string {
  if (spec.kind === "button" && spec.variant === "filled") {
    return spec.backgroundColor;
  }
  return isHex(spec.color) ? spec.color : spec.borderColor;
}

export function deriveComponentStates(
  spec: ComponentPreviewSpec,
): ComponentState[] {
  const ring = focusRing(ringBase(spec));

  if (spec.kind === "button") {
    if (spec.variant === "filled") {
      return [
        { name: "Default", spec },
        {
          name: "Hover",
          spec: { ...spec, backgroundColor: darken(spec.backgroundColor, 0.9) },
        },
        {
          name: "Active",
          spec: { ...spec, backgroundColor: darken(spec.backgroundColor, 0.82) },
        },
        { name: "Focus", spec: { ...spec, boxShadow: ring } },
        { name: "Disabled", spec, opacity: 0.45 },
      ];
    }
    return [
      { name: "Default", spec },
      {
        name: "Hover",
        spec: { ...spec, backgroundColor: softFill(spec.color, spec.previewBg) },
      },
      { name: "Focus", spec: { ...spec, boxShadow: ring } },
      { name: "Disabled", spec, opacity: 0.45 },
    ];
  }

  if (spec.kind === "input") {
    const focusBorder = isHex(spec.color) ? ringBase(spec) : spec.borderColor;
    return [
      { name: "Default", spec },
      {
        name: "Focus",
        spec: {
          ...spec,
          borderColor: focusBorder,
          borderWidth: spec.borderWidth === "0" ? "1px" : spec.borderWidth,
          boxShadow: ring,
        },
      },
      { name: "Disabled", spec, opacity: 0.55 },
    ];
  }

  return [{ name: "Default", spec }];
}

/** True when interaction states are meaningful enough to show a matrix. */
export function hasInteractionStates(kind: ComponentPreviewKind): boolean {
  return kind === "button" || kind === "input";
}

/** Shared inline style for a spec — single source for renderer + playground. */
export function specInlineStyle(spec: ComponentPreviewSpec): CSSProperties {
  return {
    backgroundColor: spec.backgroundColor,
    color: spec.color,
    border:
      spec.borderWidth !== "0"
        ? `${spec.borderWidth} solid ${spec.borderColor}`
        : "none",
    borderRadius: spec.borderRadius,
    padding: spec.padding,
    fontSize: spec.fontSize,
    fontWeight: spec.fontWeight as CSSProperties["fontWeight"],
    fontFamily: spec.fontFamily,
    boxShadow: spec.boxShadow !== "none" ? spec.boxShadow : undefined,
  };
}

function camelToKebab(key: string): string {
  return key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/** Emit a copy-pasteable CSS rule for the resting spec. */
export function componentSpecToCss(
  spec: ComponentPreviewSpec,
  selector = ".component",
): string {
  const style = specInlineStyle(spec);
  const lines = Object.entries(style)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `  ${camelToKebab(k)}: ${v};`);
  return `${selector} {\n${lines.join("\n")}\n}`;
}
