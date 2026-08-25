/**
 * device-sim compile target — same graph, embedded surface.
 *
 * Proves the research claim of semantic portability (doc §5): block ids,
 * versions, token values, and governance constraints survive the trip to a
 * 240×240 watch face. We compile MEANING (accent color, min touch target,
 * max-one-CTA), not React syntax.
 *
 * Phase 1 of §5.7: browser simulator profile. Phase 2 (tokens.h) lives in
 * ./c-header.ts. Both read the same official graph the wiki and Pulse read.
 */
import type { BlocksmithGraphV1 } from "../types";

export interface DeviceFrame {
  id: string;
  label: string;
  width: number;
  height: number;
  shape: "round" | "square" | "landscape";
  /** Physical pixels per mm — drives touch-target math. */
  pxPerMm: number;
}

export const DEVICE_FRAMES: DeviceFrame[] = [
  { id: "watch-240", label: "Watch 240×240", width: 240, height: 240, shape: "round", pxPerMm: 7.5 },
  { id: "watch-396", label: "Watch 396×396", width: 396, height: 396, shape: "round", pxPerMm: 9.8 },
  { id: "hmi-480", label: "HMI 480×320", width: 480, height: 320, shape: "landscape", pxPerMm: 6.3 },
];

/** Minimum touch target — 9mm physical, per embedded HIG conventions. */
const MIN_TOUCH_MM = 9;

export interface DeviceToken {
  id: string;
  version: number;
  name: string;
  /** Resolved literal — devices have no CSS variable indirection. */
  value: string;
  /** 0xRRGGBB when the value is a color. */
  rgb?: number;
  kind: "color" | "spacing" | "surface" | "typography" | "other";
  contentHash: string;
}

export interface DeviceWidget {
  id: string;
  /** snake_case identifier safe for C / LVGL. */
  widget: string;
  version: number;
  title: string;
  role: string;
  cornerRadiusPx: number;
  minTouchPx: number;
  labelMaxLines: number;
  contentHash: string;
}

export interface DeviceConstraint {
  id: string;
  version: number;
  rule: string;
  severity: "enforce" | "advise";
}

export interface DeviceProfile {
  schema: "blocksmith.device-sim.v1";
  docRef: string;
  /** Graph hash — must match blocksmith.lock for the build to be trusted. */
  graphHash: string;
  frame: DeviceFrame;
  minTouchPx: number;
  tokens: DeviceToken[];
  widgets: DeviceWidget[];
  constraints: DeviceConstraint[];
  /** Semantic invariants every target must preserve (research Q9). */
  invariants: string[];
}

function tokenKind(id: string): DeviceToken["kind"] {
  if (id.startsWith("token:color:")) return "color";
  if (id.startsWith("token:spacing:")) return "spacing";
  if (id.startsWith("token:surface:")) return "surface";
  if (id.startsWith("token:typography:")) return "typography";
  return "other";
}

export function hexToRgbInt(hex: string): number | undefined {
  const m = hex.trim().match(/^#([0-9a-f]{6})$/i);
  if (!m) return undefined;
  return parseInt(m[1], 16);
}

function snake(id: string): string {
  return id
    .replace(/^component:/, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function parsePx(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const m = value.match(/([\d.]+)\s*px/);
  return m ? Math.round(Number(m[1])) : fallback;
}

/** Compile the official graph to a device profile for one frame. */
export function compileDeviceSim(
  graph: BlocksmithGraphV1,
  frameId: string = "watch-240",
): DeviceProfile {
  const frame =
    DEVICE_FRAMES.find((f) => f.id === frameId) ?? DEVICE_FRAMES[0];
  const minTouchPx = Math.ceil(MIN_TOUCH_MM * frame.pxPerMm);

  const tokens: DeviceToken[] = [];
  const widgets: DeviceWidget[] = [];
  const constraints: DeviceConstraint[] = [];

  for (const b of graph.blocks) {
    if (b.type === "token") {
      const value =
        (b.content.value as string | undefined) ??
        (b.content.cssVar as string | undefined) ??
        "";
      if (!value) continue;
      tokens.push({
        id: b.id,
        version: b.version,
        name: b.title,
        value,
        rgb: hexToRgbInt(value),
        kind: tokenKind(b.id),
        contentHash: b.contentHash,
      });
    } else if (b.type === "component") {
      widgets.push({
        id: b.id,
        widget: snake(b.id),
        version: b.version,
        title: b.title,
        role: (b.content.role as string | undefined) ?? "",
        cornerRadiusPx: parsePx(b.content.radius as string | undefined, 8),
        minTouchPx,
        labelMaxLines: 1,
        contentHash: b.contentHash,
      });
    } else if (b.type === "guideline" || b.type === "agent-rule") {
      const items = (b.content.items as string[] | undefined) ?? [];
      const text = (b.content.text as string | undefined) ?? "";
      const severity: DeviceConstraint["severity"] = b.id.includes("dont")
        ? "enforce"
        : "advise";
      for (const rule of items.length ? items : text ? [text.slice(0, 200)] : []) {
        constraints.push({ id: b.id, version: b.version, rule, severity });
      }
    }
  }

  return {
    schema: "blocksmith.device-sim.v1",
    docRef: graph.docRef,
    graphHash: graph.contentHash,
    frame,
    minTouchPx,
    tokens,
    widgets,
    constraints,
    invariants: [
      `every interactive widget ≥ ${minTouchPx}px (${MIN_TOUCH_MM}mm) touch target`,
      "color values resolved from locked token blocks — no invented hex",
      "block id + version + contentHash preserved verbatim from the graph",
      "governance don'ts compiled as enforce-level constraints",
    ],
  };
}

/** Measure semantic loss when compiling IR → device (research Q10). */
export function deviceCompileLoss(
  graph: BlocksmithGraphV1,
  profile: DeviceProfile,
): { carried: number; dropped: { id: string; reason: string }[] } {
  const carriedIds = new Set<string>([
    ...profile.tokens.map((t) => t.id),
    ...profile.widgets.map((w) => w.id),
    ...profile.constraints.map((c) => c.id),
  ]);
  const dropped: { id: string; reason: string }[] = [];
  for (const b of graph.blocks) {
    if (carriedIds.has(b.id)) continue;
    dropped.push({
      id: b.id,
      reason:
        b.type === "page"
          ? "prose page — no device equivalent"
          : "no compilable payload for this target",
    });
  }
  return { carried: carriedIds.size, dropped };
}
