"use client";

/**
 * The system's graphics, rendered from its own tokens — as code.
 *
 * Each snippet runs inside a sandboxed iframe, served by /api/graphics/frame
 * from the exact string the CodeBlock beneath it shows, so what a reader
 * copies is what they are looking at. The frame is loaded by URL rather than
 * srcdoc because a srcdoc document inherits this page's CSP, whose script
 * nonce the snippet cannot carry; served from its own route it gets its own
 * policy. Scripts are allowed (a shader needs them) and nothing else is: no
 * same-origin, no forms, no navigation. The frame cannot reach this page.
 */

import { useMemo } from "react";
import type { DesignSystem } from "@/lib/blocks/types";
import { graphicsKit } from "@/lib/graphics/kit";
import { CodeBlock } from "@/components/ui/code-block";

export function GraphicsKit({ system, docFileName }: { system: DesignSystem; docFileName?: string }) {
  const kit = useMemo(() => graphicsKit(system), [system]);
  const frameSrc = (id: string) =>
    `/api/graphics/frame?id=${encodeURIComponent(id)}${docFileName ? `&doc=${encodeURIComponent(docFileName)}` : ""}`;

  return (
    <section className="mt-10">
      <h2 className="text-lg font-medium text-[var(--wiki-text)]">Graphics kit</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--wiki-muted)]">
        Decorative graphics in this system are code, built from its tokens —
        never image files. Each one below is rendered from the snippet under it;
        copy the snippet and change a colour or a parameter to make the next one.
      </p>
      <p className="mt-1 text-[11px] text-[var(--wiki-muted)]">
        Palette in use: {kit.palette.accent} accent · {kit.palette.sparks.join(" · ")} · on {kit.palette.ground}
      </p>

      <div className="mt-6 space-y-10">
        {kit.snippets.map((s) => (
          <article key={s.id}>
            <h3 className="text-sm font-semibold text-[var(--wiki-text)]">{s.title}</h3>
            <p className="mt-1 text-xs text-[var(--wiki-muted)]">{s.purpose}</p>
            <iframe
              title={s.title}
              // Scripts only: a shader cannot run without them, and nothing
              // else in the sandbox is granted.
              sandbox="allow-scripts"
              src={frameSrc(s.id)}
              className="mt-3 h-[360px] w-full rounded-lg border border-[var(--wiki-border)]"
            />
            <div className="mt-3">
              <CodeBlock code={s.code} language="html" filename={`${s.id}.html`} scrollable maxHeight={320} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
