"use client";

import { useEffect, useRef } from "react";

/**
 * A draggable bookmarklet.
 *
 * React refuses `javascript:` hrefs in JSX, correctly — for anything but a
 * bookmarklet they are an injection. Here the href *is* the product, so it is
 * set on the DOM node directly, after mount, from a string built on this page.
 */
export function BookmarkletLink({ code, label }: { code: string; label: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    ref.current?.setAttribute("href", code);
  }, [code]);
  return (
    <a
      ref={ref}
      draggable
      onClick={(e) => e.preventDefault()}
      title="Drag me to your bookmarks bar"
      className="inline-block cursor-grab rounded-md border border-[#d97757] bg-[#d97757]/10 px-3 py-1.5 text-[13px] font-semibold text-[#f0b59e] hover:bg-[#d97757]/20 active:cursor-grabbing"
    >
      {label}
    </a>
  );
}
