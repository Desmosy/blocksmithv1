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
import { buildProposalDocument } from "@/lib/webmcp/render-proposal";
import type { DesignSystem } from "@/lib/blocks/types";

/** Strip JSX-isms so plain HTML renders. Not a compiler — a best effort. */
export function ProposalPreview({
  code,
  system,
}: {
  code: string;
  system: DesignSystem;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(160);

  const doc = useMemo(
    () => buildProposalDocument(code, system),
    [code, system],
  );

  // Size the frame to its content so a proposal is never clipped or floating in
  // empty space.
  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    const measure = () => {
      try {
        const h = frame.contentDocument?.body?.scrollHeight;
        // Size to the content. There was a 520px ceiling here, so anything
        // taller grew its own scrollbar inside the frame — a component you
        // could only see part of, which is the one thing a preview must not
        // do. The floor stays so an empty proposal is not a sliver.
        if (h) setHeight(Math.max(h + 8, 96));
      } catch {
        /* cross-origin is impossible here, but never let measuring throw */
      }
    };
    frame.addEventListener("load", measure);
    const t = setTimeout(measure, 120);

    // Keep following the content: a web font arriving or an image decoding
    // changes the height after load, and a frame measured once would be left
    // either clipped or padded with dead space.
    let observer: ResizeObserver | null = null;
    const attach = () => {
      const body = frame.contentDocument?.body;
      if (!body || typeof ResizeObserver === "undefined") return;
      observer?.disconnect();
      observer = new ResizeObserver(measure);
      observer.observe(body);
    };
    frame.addEventListener("load", attach);
    const t2 = setTimeout(attach, 140);

    return () => {
      frame.removeEventListener("load", measure);
      frame.removeEventListener("load", attach);
      observer?.disconnect();
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [doc]);

  return (
    <iframe
      ref={ref}
      title="Proposed component"
      /**
       * `allow-same-origin` without `allow-scripts`.
       *
       * The frame must stay script-free — a proposal is third-party output and
       * must never execute. But with a fully opaque sandbox the parent cannot
       * read `contentDocument`, so the height measurement below silently
       * returned null and the frame sat at its initial 160px, growing its own
       * scrollbar around anything taller.
       *
       * Granting same-origin alone restores measurement without granting
       * execution: with no `allow-scripts` there is no script in the frame to
       * take advantage of the shared origin.
       */
      sandbox="allow-same-origin"
      scrolling="no"
      srcDoc={doc}
      style={{ height }}
      className="w-full rounded-lg border border-[var(--wiki-border)] bg-white"
    />
  );
}
