"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { measureText, type MeasureInput } from "../measure";
import type { TextSlot } from "../types";

export function PretextText({
  slot,
  maxWidth,
  as = "span",
  style: styleOverride,
  className,
}: {
  slot: TextSlot;
  maxWidth: number;
  as?: "span" | "p";
  style?: React.CSSProperties;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const width = slot.maxWidth ?? maxWidth;

  useLayoutEffect(() => {
    try {
      const input: MeasureInput = {
        text: slot.text,
        fontFamily: slot.fontFamily,
        fontSize: slot.fontSize,
        fontWeight: slot.fontWeight,
        lineHeight: slot.lineHeight,
        letterSpacing: slot.letterSpacing,
        maxWidth: width,
      };
      setHeight(measureText(input).height);
    } catch {
      setHeight(null);
    }
  }, [
    slot.text,
    slot.fontFamily,
    slot.fontSize,
    slot.fontWeight,
    slot.lineHeight,
    slot.letterSpacing,
    width,
  ]);

  const style: React.CSSProperties = {
    margin: 0,
    color: slot.color,
    fontFamily: `"${slot.fontFamily}", ui-sans-serif, sans-serif`,
    fontSize: slot.fontSize,
    fontWeight: slot.fontWeight,
    lineHeight: slot.lineHeight,
    letterSpacing: slot.letterSpacing,
    maxWidth: width,
    minHeight: height ?? undefined,
    ...styleOverride,
  };

  const Tag = as;
  return (
    <Tag ref={ref as React.RefObject<HTMLParagraphElement>} style={style} className={className}>
      {slot.text}
    </Tag>
  );
}
