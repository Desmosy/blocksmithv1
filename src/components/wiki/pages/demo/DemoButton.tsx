"use client";

import { specInlineStyle } from "@/ai-lab/04-component-previews";
import type { DemoCta } from "@/ai-lab/06-demo-compose";

export function DemoButton({
  cta,
  large,
  small,
}: {
  cta: DemoCta;
  large?: boolean;
  small?: boolean;
}) {
  if (!cta) return null;
  const base = specInlineStyle(cta.spec);
  return (
    <button
      type="button"
      style={{
        ...base,
        cursor: "default",
        padding: large ? "14px 28px" : small ? "8px 14px" : base.padding,
        fontSize: large ? "15px" : small ? "13px" : base.fontSize,
      }}
    >
      {cta.label}
    </button>
  );
}
