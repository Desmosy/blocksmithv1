"use client";

import { useEffect, useId, useState } from "react";

/**
 * The form for a connector, opened from the connector's own row.
 *
 * The two things you can actually *do* on this page — scan a repository,
 * connect a Figma file — used to sit in blocks above a list that only reported
 * status, so you read about GitHub in one place and acted on it in another.
 * Putting the form inside the row it belongs to means the page has one order:
 * find the thing, open it, use it.
 *
 * Opens by itself when the URL names it, because the dashboard links straight
 * here — `/dashboard/connectors#codebase` should land on an open form, not on a
 * closed one the reader still has to find.
 */
export function ConnectorDisclosure({
  anchor,
  label,
  children,
}: {
  /** Matches the `#hash` the dashboard links with, and the row's id. */
  anchor: string;
  /** What the button offers to do, e.g. "Scan a repository". */
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    const openIfNamed = () => {
      if (window.location.hash === `#${anchor}`) setOpen(true);
    };
    openIfNamed();
    // A second click on the same dashboard link changes the hash without a
    // navigation, so listen rather than only checking on mount.
    window.addEventListener("hashchange", openIfNamed);
    return () => window.removeEventListener("hashchange", openIfNamed);
  }, [anchor]);

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="shrink-0 rounded-[var(--dash-radius)] border border-[var(--dash-border)] px-3 py-1.5 text-[13px] text-[var(--dash-foreground)] hover:bg-[var(--dash-muted)]"
      >
        {open ? "Close" : label}
        <span aria-hidden className="ml-1.5 opacity-60">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open ? (
        <div id={panelId} className="w-full basis-full pt-5">
          {children}
        </div>
      ) : null}
    </>
  );
}
