export interface BoxModelMetrics {
  contentWidth: number;
  contentHeight: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  borderTop: number;
  borderRight: number;
  borderBottom: number;
  borderLeft: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
}

export interface ComputedSnapshot {
  box: BoxModelMetrics;
  fontSize: string;
  lineHeight: string;
  letterSpacing: string;
  fontWeight: string;
  fontFamily: string;
  color: string;
  backgroundColor: string;
  borderRadius: string;
  boxShadow: string;
  borderColor: string;
}

export function parsePx(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
}

export function readBoxModel(el: HTMLElement): BoxModelMetrics {
  const cs = getComputedStyle(el);
  const paddingTop = parsePx(cs.paddingTop);
  const paddingRight = parsePx(cs.paddingRight);
  const paddingBottom = parsePx(cs.paddingBottom);
  const paddingLeft = parsePx(cs.paddingLeft);
  const borderTop = parsePx(cs.borderTopWidth);
  const borderRight = parsePx(cs.borderRightWidth);
  const borderBottom = parsePx(cs.borderBottomWidth);
  const borderLeft = parsePx(cs.borderLeftWidth);

  const contentWidth = Math.max(
    0,
    Math.round(el.clientWidth - paddingLeft - paddingRight),
  );
  const contentHeight = Math.max(
    0,
    Math.round(el.clientHeight - paddingTop - paddingBottom),
  );

  return {
    contentWidth,
    contentHeight,
    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft,
    borderTop,
    borderRight,
    borderBottom,
    borderLeft,
    marginTop: parsePx(cs.marginTop),
    marginRight: parsePx(cs.marginRight),
    marginBottom: parsePx(cs.marginBottom),
    marginLeft: parsePx(cs.marginLeft),
  };
}

export function readComputedSnapshot(el: HTMLElement): ComputedSnapshot {
  const cs = getComputedStyle(el);
  return {
    box: readBoxModel(el),
    fontSize: cs.fontSize,
    lineHeight: cs.lineHeight,
    letterSpacing: cs.letterSpacing,
    fontWeight: cs.fontWeight,
    fontFamily: shortenFontFamily(cs.fontFamily),
    color: cs.color,
    backgroundColor: cs.backgroundColor,
    borderRadius: cs.borderRadius,
    boxShadow: cs.boxShadow === "none" ? "none" : cs.boxShadow,
    borderColor: cs.borderBottomColor,
  };
}

function shortenFontFamily(family: string): string {
  const first = family.split(",")[0]?.trim().replace(/^["']|["']$/g, "");
  return first || family;
}

export function formatPx(n: number): string {
  return Number.isInteger(n) ? `${n}` : `${n}`;
}
