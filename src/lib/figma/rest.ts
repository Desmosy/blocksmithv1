/**
 * Figma REST adapter — powers the BlockSmith UI "paste a Figma link" connector.
 *
 * The web app can't use the Figma MCP (that's agent-side), so the connector calls
 * the Figma REST API with the user's personal access token. Figma's *variables*
 * REST endpoint is Enterprise-only, so this reads the file document and recovers
 * tokens from **color styles, text styles, and raw fills** — plus component sets
 * (with their variant properties) — which works on any plan.
 *
 * `extractFigmaFile` is pure + unit-tested; `fetchFigmaFile` is the thin network
 * seam. Output feeds the identical import pipeline as the MCP path.
 */
import type { FigmaComponentInput } from "./components";
import { figmaRgbaToHex } from "./adapter";
import type { GetFileResponse } from "@figma/rest-api-spec";

type FigmaColor = { r: number; g: number; b: number; a?: number };
type FigmaPaint = { type: string; visible?: boolean; color?: FigmaColor };

type FigmaNode = {
  id: string;
  name?: string;
  type: string;
  fills?: FigmaPaint[];
  /** role → styleId (e.g. { fill: "1:2", text: "3:4" }). */
  styles?: Record<string, string>;
  /** TEXT nodes carry resolved type info. */
  style?: { fontSize?: number };
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  annotations?: Array<{
    label?: string;
    labelMarkdown?: string;
    categoryId?: string;
    properties?: Array<{ type?: string }>;
  }>;
  measurements?: Array<{
    id: string;
    start: { nodeId: string; side: "TOP" | "RIGHT" | "BOTTOM" | "LEFT" };
    end: { nodeId: string; side: "TOP" | "RIGHT" | "BOTTOM" | "LEFT" };
    offset: { type: "INNER"; relative: number } | { type: "OUTER"; fixed: number };
    freeText?: string;
  }>;
  componentPropertyDefinitions?: Record<
    string,
    { type?: string; variantOptions?: string[] }
  >;
  children?: FigmaNode[];
};

type FigmaStyleMeta = { name: string; styleType: string };

export type FigmaRestFile = {
  name?: string;
  document?: FigmaNode;
  styles?: Record<string, FigmaStyleMeta>;
};

// Compile-time contract check against Figma's official REST specification.
type _OfficialFileFields = Pick<GetFileResponse, "name" | "document" | "styles">;

export type FigmaRestExtract = {
  variables: Record<string, string>;
  components: FigmaComponentInput;
  annotations: FigmaAnnotation[];
  frames: FigmaFrameSummary[];
  measurements: FigmaMeasurement[];
  /** What the file actually offered — surfaced to the UI for honest feedback. */
  stats: {
    namedColorStyles: number;
    textStyles: number;
    rawFills: number;
    componentSets: number;
  };
};

export type FigmaAnnotation = {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  label: string;
  categoryId?: string;
  pinnedProperties: string[];
};

export type FigmaFrameSummary = {
  nodeId: string;
  name: string;
  width?: number;
  height?: number;
};

export type FigmaMeasurement = {
  id: string;
  canvasId: string;
  startNodeId: string;
  startSide: string;
  endNodeId: string;
  endSide: string;
  offsetType: "INNER" | "OUTER";
  value: number;
  text?: string;
};

/** Parse a Figma file key from a share URL, design URL, or a bare key. */
export function parseFigmaFileKey(input: string): string | null {
  const s = input.trim();
  const m = s.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9]{10,}$/.test(s)) return s;
  return null;
}

function walk(node: FigmaNode, visit: (n: FigmaNode) => void): void {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

/**
 * Recover design tokens + component sets from a Figma REST file document.
 * Pure and deterministic — the network fetch is separate.
 */
export function extractFigmaFile(file: FigmaRestFile): FigmaRestExtract {
  const styles = file.styles ?? {};
  const fillStyleHex = new Map<string, string>();
  const textStyleSize = new Map<string, number>();
  const rawFills = new Map<string, number>();
  const componentSets: Array<{
    name: string;
    componentPropertyDefinitions: Record<
      string,
      { type?: string; variantOptions?: string[] }
    >;
  }> = [];
  const seenSets = new Set<string>();
  const annotations: FigmaAnnotation[] = [];
  const frames: FigmaFrameSummary[] = [];
  const measurements: FigmaMeasurement[] = [];

  if (file.document) {
    walk(file.document, (n) => {
      for (const measurement of n.measurements ?? []) {
        measurements.push({
          id: measurement.id,
          canvasId: n.id,
          startNodeId: measurement.start.nodeId,
          startSide: measurement.start.side,
          endNodeId: measurement.end.nodeId,
          endSide: measurement.end.side,
          offsetType: measurement.offset.type,
          value: measurement.offset.type === "INNER" ? measurement.offset.relative : measurement.offset.fixed,
          text: measurement.freeText,
        });
      }
      if ((n.type === "FRAME" || n.type === "SECTION" || n.type === "COMPONENT" || n.type === "COMPONENT_SET") && frames.length < 24) {
        frames.push({
          nodeId: n.id,
          name: n.name || n.id,
          width: n.absoluteBoundingBox?.width,
          height: n.absoluteBoundingBox?.height,
        });
      }
      for (const annotation of n.annotations ?? []) {
        const label = annotation.labelMarkdown || annotation.label || "";
        if (!label.trim()) continue;
        annotations.push({
          nodeId: n.id,
          nodeName: n.name || n.id,
          nodeType: n.type,
          label: label.trim(),
          categoryId: annotation.categoryId,
          pinnedProperties: (annotation.properties ?? []).map((p) => p.type || "unknown"),
        });
      }
      const solid = n.fills?.find(
        (f) => f.type === "SOLID" && f.visible !== false && f.color,
      );
      if (solid?.color) {
        const hex = figmaRgbaToHex(solid.color);
        rawFills.set(hex, (rawFills.get(hex) ?? 0) + 1);
        const fillStyleId = n.styles?.fill;
        if (fillStyleId && !fillStyleHex.has(fillStyleId)) {
          fillStyleHex.set(fillStyleId, hex);
        }
      }
      const textStyleId = n.styles?.text;
      if (textStyleId && n.style?.fontSize && !textStyleSize.has(textStyleId)) {
        textStyleSize.set(textStyleId, n.style.fontSize);
      }
      if (n.type === "COMPONENT_SET" && n.name && !seenSets.has(n.name)) {
        seenSets.add(n.name);
        componentSets.push({
          name: n.name,
          componentPropertyDefinitions: n.componentPropertyDefinitions ?? {},
        });
      }
    });
  }

  const variables: Record<string, string> = {};
  let namedColorStyles = 0;
  let textStyles = 0;

  // 1. Named color + text styles (the design system's intended tokens).
  for (const [id, meta] of Object.entries(styles)) {
    if (meta.styleType === "FILL" && fillStyleHex.has(id)) {
      variables[`Color/${meta.name}`] = fillStyleHex.get(id)!;
      namedColorStyles += 1;
    } else if (meta.styleType === "TEXT" && textStyleSize.has(id)) {
      variables[`Font Size/${meta.name}`] = `${textStyleSize.get(id)}px`;
      textStyles += 1;
    }
  }

  // 2. Fallback: no named color styles → most-used raw fills become tokens,
  //    so a file without a formal style setup still yields a palette.
  if (namedColorStyles === 0 && rawFills.size) {
    [...rawFills.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 24)
      .forEach(([hex], i) => {
        variables[`Color/${i + 1}`] = hex;
      });
  }

  return {
    variables,
    components: componentSets as FigmaComponentInput,
    annotations,
    frames,
    measurements,
    stats: {
      namedColorStyles,
      textStyles,
      rawFills: rawFills.size,
      componentSets: componentSets.length,
    },
  };
}

/** Render representative Figma nodes and download them as vision-ready data URLs. */
export async function fetchFigmaFrameImages(
  fileKey: string,
  token: string,
  frames: FigmaFrameSummary[],
  limit = 4,
): Promise<Array<{ nodeId: string; name: string; image: string }>> {
  const selected = frames
    .filter((f) => (f.width ?? 0) >= 160 && (f.height ?? 0) >= 120)
    .sort((a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0))
    .slice(0, limit);
  if (!selected.length) return [];
  const params = new URLSearchParams({ ids: selected.map((f) => f.nodeId).join(","), format: "jpg", scale: "1.5" });
  const response = await fetch(`https://api.figma.com/v1/images/${encodeURIComponent(fileKey)}?${params}`, {
    headers: { "X-Figma-Token": token },
  });
  if (!response.ok) throw new Error(`Figma frame render failed (${response.status}).`);
  const payload = (await response.json()) as { images?: Record<string, string | null> };
  const output: Array<{ nodeId: string; name: string; image: string }> = [];
  for (const frame of selected) {
    const url = payload.images?.[frame.nodeId];
    if (!url) continue;
    const imageResponse = await fetch(url);
    if (!imageResponse.ok) continue;
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) continue;
    const bytes = Buffer.from(await imageResponse.arrayBuffer());
    if (bytes.length > 4_500_000) continue;
    output.push({ nodeId: frame.nodeId, name: frame.name, image: `data:${contentType};base64,${bytes.toString("base64")}` });
  }
  return output;
}

/** Fetch a Figma file document via REST. Throws a user-friendly error on failure. */
export async function fetchFigmaFile(
  fileKey: string,
  token: string,
): Promise<FigmaRestFile> {
  const res = await fetch(
    `https://api.figma.com/v1/files/${encodeURIComponent(fileKey)}`,
    { headers: { "X-Figma-Token": token } },
  );
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error(
        "Figma rejected the token (403). Use a personal access token with file_content read scope, and make sure it can access this file.",
      );
    }
    if (res.status === 404) {
      throw new Error(
        "Figma file not found (404). Check the URL and that the file is shared with your token's account.",
      );
    }
    if (res.status === 429) {
      throw new Error("Figma rate limit hit (429). Wait a moment and retry.");
    }
    throw new Error(`Figma API error ${res.status}.`);
  }
  const file = (await res.json()) as _OfficialFileFields;
  return file as unknown as FigmaRestFile;
}
