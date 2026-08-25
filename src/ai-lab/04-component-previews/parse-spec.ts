import type { ComponentDoc } from "@/lib/blocks/types";
import { extractHexes } from "@/lib/design-ir/color-utils";
import { classifyComponentKind, type ComponentPreviewKind } from "./classify";
import {
  type ComponentPreviewContext,
  componentCorpus,
} from "./context";

export type ComponentVariant = "filled" | "outline" | "ghost";

export type ComponentPreviewSpec = {
  kind: ComponentPreviewKind;
  variant: ComponentVariant;
  backgroundColor: string;
  color: string;
  borderColor: string;
  borderWidth: string;
  borderRadius: string;
  padding: string;
  fontSize: string;
  fontWeight: string;
  fontFamily: string;
  boxShadow: string;
  label: string;
  displaySize: string | null;
  previewBg: string;
};

function paletteSet(ctx: ComponentPreviewContext): Set<string> {
  return new Set(
    ctx.colors
      .filter((c) => c.value.startsWith("#"))
      .map((c) => c.value.toLowerCase()),
  );
}

function resolveHex(
  candidate: string | null | undefined,
  fallback: string,
  ctx: ComponentPreviewContext,
): string {
  if (!candidate) return fallback;
  const lower = candidate.toLowerCase();
  if (lower === "transparent") return "transparent";
  const palette = paletteSet(ctx);
  if (palette.has(lower)) return lower;
  if (lower.startsWith("#")) return lower;
  return fallback;
}

function pxFromText(text: string, labels: string[], fallback: string): string {
  for (const label of labels) {
    const re = new RegExp(`${label}[^\\d]*(\\d+(?:\\.\\d+)?)px`, "i");
    const m = text.match(re);
    if (m) return `${m[1]}px`;
  }
  if (text.includes("9999px") || text.includes("999px")) return "9999px";
  return fallback;
}

/** Keep preview radii sane — layout widths (1200px max-width) must not become border-radius. */
function clampRadiusForKind(
  value: string,
  kind: ComponentPreviewKind,
): string {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return "8px";

  if (kind === "nav" || kind === "strip" || kind === "tab") {
    return n > 24 ? "0px" : `${n}px`;
  }

  if (kind === "input" || kind === "button" || kind === "tag") {
    if (n >= 80 || /pill|capsule|fully\s+rounded/i.test(value)) return "9999px";
    return n > 48 ? "9999px" : `${n}px`;
  }

  if (kind === "card" || kind === "hero" || kind === "generic") {
    return n > 48 ? "16px" : `${n}px`;
  }

  return n > 48 ? "12px" : `${n}px`;
}

function parseRadiusFromText(
  text: string,
  kind: ComponentPreviewKind,
  ctx: ComponentPreviewContext,
): string {
  const explicit =
    text.match(/border-radius[:\s]+(\d+(?:\.\d+)?)\s*px/i)?.[1] ??
    text.match(/border-radius[:\s]+(\d+(?:\.\d+)?)(?:\s*;|\s|$)/i)?.[1];
  if (explicit) return clampRadiusForKind(`${explicit}px`, kind);

  const reverse = text.match(/(\d+(?:\.\d+)?)\s*px\s+radius/i)?.[1];
  if (reverse) return clampRadiusForKind(`${reverse}px`, kind);

  if (
    /pill|capsule|fully\s+rounded/i.test(text) &&
    (kind === "button" || kind === "tag" || kind === "input")
  ) {
    return "9999px";
  }

  const row = ctx.borderRadius.find((r) => {
    const el = r.element.toLowerCase();
    if (kind === "button" || kind === "tag") {
      return /button|cta|pill|tag|badge/.test(el);
    }
    if (kind === "card" || kind === "nav" || kind === "strip" || kind === "hero") {
      return /card|panel|nav|feature/.test(el);
    }
    if (kind === "input") return /input|field|search/.test(el);
    return false;
  });
  if (row?.value) return clampRadiusForKind(row.value, kind);

  if (kind === "button" || kind === "tag") return ctx.preview.buttonRadius;
  if (kind === "input" && /pill|search/i.test(text)) return "9999px";
  if (kind === "nav" || kind === "strip" || kind === "tab") return "0px";
  return ctx.preview.cardRadius;
}

function parseVariant(text: string): ComponentVariant {
  const lower = text.toLowerCase();
  if (/transparent background|ghost/.test(lower)) return "ghost";
  if (/outline|1px border|border #/.test(lower) && !/background\s*#/.test(lower)) {
    return "outline";
  }
  return "filled";
}

function parseBackground(text: string, ctx: ComponentPreviewContext, kind: ComponentPreviewKind): string {
  const lower = text.toLowerCase();
  if (/background\s+transparent|transparent background/.test(lower)) return "transparent";

  const bgMatch = text.match(/background\s+(#[0-9a-fA-F]{3,8})/i);
  if (bgMatch) return resolveHex(bgMatch[1], ctx.preview.cardBackground, ctx);

  // "Filled with #ffba09" / "fill: #hex" — the doc's explicit fill color.
  const fillMatch = text.match(
    /(?:filled(?:\s+with|\s+in)?|fill)\s*:?\s*(#[0-9a-fA-F]{3,8})/i,
  );
  if (fillMatch) {
    return resolveHex(
      fillMatch[1],
      kind === "button" ? ctx.preview.accent : ctx.preview.cardBackground,
      ctx,
    );
  }

  if (kind === "button" && parseVariant(text) !== "filled") {
    return "transparent";
  }
  if (kind === "tag" || kind === "card") {
    const hexes = extractHexes(text);
    if (hexes[0]) return resolveHex(hexes[0], ctx.preview.cardBackground, ctx);
  }

  return kind === "button" ? resolveHex(null, ctx.preview.accent, ctx) : ctx.preview.cardBackground;
}

function parseForeground(text: string, ctx: ComponentPreviewContext): string {
  const patterns = [
    /(?:^|\s)text\s+(#[0-9a-fA-F]{3,8})/i,
    /(?:color|foreground)[^#\n]{0,24}(#[0-9a-fA-F]{3,8})/i,
    /white text/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return resolveHex(m[1], ctx.preview.text, ctx);
    if (m && /white/i.test(m[0])) return "#ffffff";
  }
  const hexes = extractHexes(text);
  if (hexes.length >= 2) return resolveHex(hexes[1], ctx.preview.text, ctx);
  return ctx.preview.text;
}

function parseBorder(text: string, ctx: ComponentPreviewContext): { color: string; width: string } {
  const lower = text.toLowerCase();
  const borderHex =
    text.match(/(?:border|outline)[^#\n]{0,30}(#[0-9a-fA-F]{3,8})/i)?.[1] ??
    text.match(/1px\s+(?:border\s+)?(#[0-9a-fA-F]{3,8})/i)?.[1];
  const width =
    /1px\s+border|border\s+1px|border:\s*1px|hairline/i.test(lower) ? "1px" : "0";
  return {
    color: resolveHex(borderHex ?? null, ctx.preview.border, ctx),
    width,
  };
}


function parsePadding(text: string, kind: ComponentPreviewKind): string {
  // CSS shorthand "padding 11px 24px" (vertical horizontal) — keep both values.
  const pair = text.match(/padding\s*(\d+)px\s+(\d+)px/i);
  if (pair) return `${pair[1]}px ${pair[2]}px`;

  const range = text.match(/padding\s*(\d+)(?:[–-](\d+))?px/i);
  if (range) {
    const hi = range[2] ?? range[1];
    return kind === "tag" ? `${range[1]}px ${hi}px` : `${range[1]}px ${hi}px`;
  }
  const quad = text.match(
    /padding\s*(\d+px)\s+(\d+px)(?:\s+(\d+px))?(?:\s+(\d+px))?/i,
  );
  if (quad) return [quad[1], quad[2], quad[3], quad[4]].filter(Boolean).join(" ");

  const tbLr = text.match(/(\d+)px\s+(?:top\/bottom|vertical)[^0-9]*(\d+)px\s+(?:left\/right|horizontal)/i);
  if (tbLr) return `${tbLr[1]}px ${tbLr[2]}px`;

  if (kind === "button") return "12px 24px";
  if (kind === "tag") return "4px 8px";
  if (kind === "card") return "24px";
  if (kind === "input") return "12px 20px";
  if (kind === "nav") return "8px 16px";
  return "12px 16px";
}

function parseFontSize(text: string, kind: ComponentPreviewKind): string {
  // Explicit type size wins: "text at 14px", "14px weight 700", "label 12px".
  const explicit =
    text.match(
      /(?:text|label|link|body|placeholder|type)\s+(?:at\s+)?(\d+(?:\.\d+)?)\s*px/i,
    )?.[1] ??
    text.match(/(\d+(?:\.\d+)?)\s*px\s+weight\s+\d{3}/i)?.[1] ??
    text.match(/\bat\s+(\d+(?:\.\d+)?)\s*px\b/i)?.[1];
  if (explicit) {
    const n = Number(explicit);
    if (n >= 10 && n <= 40) return `${explicit}px`;
  }

  const candidates: number[] = [];

  for (const m of text.matchAll(/font-size[:\s]+(\d+(?:\.\d+)?)\s*px/gi)) {
    candidates.push(Number(m[1]));
  }

  const placeholder = text.match(
    /placeholder[^0-9]{0,48}(\d+(?:\.\d+)?)\s*px/i,
  );
  if (placeholder) candidates.push(Number(placeholder[1]));

  for (const m of text.matchAll(
    /(?:weight\s+\d{3}[^0-9]{0,24}|heading[^0-9]{0,24}|links?\s+in[^0-9]{0,24})(\d+(?:\.\d+)?)\s*px/gi,
  )) {
    candidates.push(Number(m[1]));
  }

  for (const m of text.matchAll(
    /(\d+(?:\.\d+)?)\s*px[^.\n]{0,36}(?:weight\s+\d{3}|placeholder|font|text|label|link|heading)/gi,
  )) {
    candidates.push(Number(m[1]));
  }

  const body = text.match(/(?:dm sans|inter|sans)[^0-9]*(\d+(?:\.\d+)?)\s*px/i);
  if (body) candidates.push(Number(body[1]));

  const typo = candidates.filter((n) => n >= 10 && n <= 36);
  if (typo.length) return `${typo[0]}px`;

  if (kind === "tag") return "12px";
  if (kind === "button" || kind === "nav" || kind === "input") return "14px";
  if (kind === "card") return "16px";
  return "16px";
}

function parseDisplaySize(text: string): string | null {
  const m = text.match(/(\d+(?:\.\d+)?)px[^.\n]{0,40}(?:display|numeral|value|ultra|weight 700)/i);
  if (m) return `${m[1]}px`;
  const large = [...text.matchAll(/(\d+(?:\.\d+)?)px/g)]
    .map((x) => Number(x[1]))
    .filter((n) => n >= 32)
    .sort((a, b) => b - a)[0];
  return large ? `${large}px` : null;
}

function parseFontWeight(text: string, kind: ComponentPreviewKind): string {
  const m = text.match(/\bweight\s+(\d{3})\b/i) ?? text.match(/\b(700|600|500|400|300)\b/);
  if (m) return m[1];
  return kind === "button" || kind === "tag" || kind === "nav" ? "500" : "400";
}

function resolveFontFamily(text: string, ctx: ComponentPreviewContext): string {
  const lower = text.toLowerCase();
  for (const fam of ctx.typography) {
    const name = fam.name.toLowerCase();
    if (name && lower.includes(name)) {
      const key = fam.cssVar.startsWith("--") ? fam.cssVar : `--font-${fam.cssVar}`;
      return ctx.fontStacks[key] ?? `var(${key}, var(--wiki-font))`;
    }
  }
  if (/mono|monospace|geist mono/.test(lower)) {
    return "var(--font-geist-mono, monospace)";
  }
  if (/display|headline|ultra|compact|corp|neue/.test(lower)) {
    return "var(--wiki-display-font, var(--wiki-font))";
  }
  return "var(--wiki-font, Inter, sans-serif)";
}

function parseShadow(text: string, kind: ComponentPreviewKind): string {
  const m = text.match(/(?:box-shadow|drop shadow)[:\s]+([^.\n]+)/i);
  if (m) return m[1].trim().slice(0, 140);
  if (/no shadow|no box-shadow|flat/.test(text.toLowerCase())) return "none";
  return kind === "card" ? "none" : "none";
}

export function previewLabel(
  component: ComponentDoc,
  kind?: ComponentPreviewKind,
): string {
  const quoted = component.description.match(/'([^']+)'/);
  if (quoted) return quoted[1];

  if (
    kind === "input" ||
    /search\s*bar|text\s*input|input\s*field/i.test(component.title)
  ) {
    if (/search/i.test(component.title)) return "Search…";
    return "Sample text";
  }

  const title = component.title
    .replace(
      /^(citra|ghost|primary|secondary|outlined|navigation|nav)\s+/i,
      "",
    )
    .trim();
  if (/button/i.test(title)) return "Action";
  if (/tag|badge/i.test(title)) return "Label";
  if (/input/i.test(title)) return "Sample text";
  if (/card/i.test(title)) return component.title;
  return title || "Preview";
}

export function parseComponentPreviewSpec(
  component: ComponentDoc,
  ctx: ComponentPreviewContext,
): ComponentPreviewSpec {
  const text = componentCorpus(component);
  const kind = classifyComponentKind(component);
  const variant = parseVariant(text);
  const border = parseBorder(text, ctx);

  let backgroundColor = parseBackground(text, ctx, kind);
  let color = parseForeground(text, ctx);
  let borderWidth = border.width;

  if (kind === "button") {
    if (variant === "filled") {
      backgroundColor = parseBackground(text, ctx, kind);
      color = parseForeground(text, ctx);
      borderWidth = "0";
    } else {
      backgroundColor = "transparent";
      color = parseForeground(text, ctx);
      borderWidth = border.width === "0" ? "1px" : border.width;
    }
  }

  if (kind === "tag") {
    backgroundColor = parseBackground(text, ctx, kind);
    color = parseForeground(text, ctx);
    borderWidth = "0";
  }

  return {
    kind,
    variant,
    backgroundColor,
    color,
    borderColor: border.color,
    borderWidth,
    borderRadius: parseRadiusFromText(text, kind, ctx),
    padding: parsePadding(text, kind),
    fontSize: parseFontSize(text, kind),
    fontWeight: parseFontWeight(text, kind),
    fontFamily: resolveFontFamily(text, ctx),
    boxShadow: parseShadow(text, kind),
    label: previewLabel(component, kind),
    displaySize: kind === "card" ? parseDisplaySize(text) : null,
    previewBg: ctx.preview.pageBackground,
  };
}
