"use client";

/**
 * ProposalPreview — renders what the agent proposed, in the system's own tokens.
 *
 * A designer judging this should be looking at a component, not at markup. The
 * markup is rendered inside a sandboxed iframe with the design system's CSS
 * variables injected, so what appears is what the tokens actually produce.
 *
 * The sandbox is load-bearing: this is third-party output. `allow-scripts` is
 * deliberately absent, so nothing in a proposal can run, reach this page, or
 * navigate anywhere.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { DesignSystem } from "@/lib/blocks/types";

/** Strip JSX-isms so plain HTML renders. Not a compiler — a best effort. */
function toRenderableHtml(code: string): string {
  return code
    .replace(/className=/g, "class=")
    // style={{ a: 1, b: "x" }} → style="a: 1; b: x"
    .replace(/style=\{\{([\s\S]*?)\}\}/g, (_m, body: string) => {
      const decls = String(body)
        .split(",")
        .map((pair) => {
          const [rawKey, ...rest] = pair.split(":");
          const key = rawKey?.trim().replace(/["']/g, "");
          const value = rest.join(":").trim().replace(/["']/g, "");
          if (!key || !value) return "";
          const prop = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
          const needsPx = /^\d+(\.\d+)?$/.test(value) &&
            !/^(flex|order|z-index|opacity|line-height|font-weight)$/.test(prop);
          return `${prop}: ${value}${needsPx ? "px" : ""}`;
        })
        .filter(Boolean);
      return `style="${decls.join("; ")}"`;
    })
    // Drop an export/function wrapper and a bare `return (`.
    .replace(/^[\s\S]*?return\s*\(/, "")
    .replace(/\);?\s*\}?\s*$/, "")
    .trim();
}

function tokenCss(system: DesignSystem): string {
  const lines: string[] = [];
  for (const c of system.colors) {
    if (c.cssVar?.startsWith("--")) lines.push(`${c.cssVar}: ${c.value};`);
  }
  for (const s of system.spacing) {
    if (s.token?.startsWith("--")) lines.push(`${s.token}: ${s.value};`);
  }
  for (const t of system.typeScale) {
    if (t.token?.startsWith("--")) lines.push(`${t.token}: ${t.size};`);
  }
  return `:root { ${lines.join(" ")} }`;
}

export function ProposalPreview({
  code,
  system,
}: {
  code: string;
  system: DesignSystem;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(160);

  const doc = useMemo(() => {
    const body = toRenderableHtml(code);
    const ground =
      system.colors.find((c) => /background|canvas|page|ground|paper|sheet/i.test(c.role || ""))
        ?.value ?? "#ffffff";
    const ink =
      system.colors.find((c) => /primary text|body|ink/i.test(c.role || ""))?.value ??
      "#111111";
    const family = system.typography[1]?.name ?? system.typography[0]?.name ?? "sans-serif";

    return `<!doctype html><html><head><meta charset="utf-8">
<style>
  ${tokenCss(system)}
  html,body { margin:0; padding:24px; background:${ground}; color:${ink};
    font-family:"${family}", ui-sans-serif, system-ui, sans-serif; }
  * { box-sizing:border-box; }
</style></head><body>${body}</body></html>`;
  }, [code, system]);

  // Size the frame to its content so a proposal is never clipped or floating in
  // empty space.
  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    const measure = () => {
      try {
        const h = frame.contentDocument?.body?.scrollHeight;
        if (h) setHeight(Math.min(Math.max(h + 8, 96), 520));
      } catch {
        /* cross-origin is impossible here, but never let measuring throw */
      }
    };
    frame.addEventListener("load", measure);
    const t = setTimeout(measure, 120);
    return () => {
      frame.removeEventListener("load", measure);
      clearTimeout(t);
    };
  }, [doc]);

  return (
    <iframe
      ref={ref}
      title="Proposed component"
      // No allow-scripts: a proposal is third-party output and must not run.
      sandbox=""
      srcDoc={doc}
      style={{ height }}
      className="w-full rounded-lg border border-[var(--wiki-border)] bg-white"
    />
  );
}
