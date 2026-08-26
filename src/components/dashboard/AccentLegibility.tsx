/**
 * Accent contrast across the workspace. One measurement per system (its accent
 * against its ground), so each band's count is a number of systems.
 */

import type { Analytics, ContrastBand } from "@/lib/dashboard/analytics";

const BAND_CLASS: Record<ContrastBand, string> = {
  AAA: "bg-emerald-600",
  AA: "bg-emerald-400",
  "AA Large": "bg-amber-400",
  Fails: "bg-red-500",
};

export function AccentLegibility({ contrast }: { contrast: Analytics["contrast"] }) {
  const { buckets, measured, unmeasured } = contrast;

  if (!measured) {
    return (
      <section className="rounded-[var(--dash-radius)] border border-[var(--dash-border)] bg-[var(--dash-surface)] p-6">
        <h2 className="text-[15px] font-medium text-[var(--dash-foreground)]">
          Accent legibility
        </h2>
        <p className="mt-2 text-[14px] text-[var(--dash-muted-fg)]">
          Nothing to measure yet — capture or import a design system with an
          accent and a ground colour.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[var(--dash-radius)] border border-[var(--dash-border)] bg-[var(--dash-surface)] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-medium text-[var(--dash-foreground)]">
          Accent legibility
        </h2>
        <p className="text-[13px] text-[var(--dash-muted-fg)]">
          Each system&rsquo;s accent measured against its own ground, WCAG 2.1
        </p>
      </div>

      <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-[var(--dash-muted)]">
        {buckets.map((b) =>
          b.count ? (
            <div
              key={b.band}
              className={BAND_CLASS[b.band]}
              style={{ width: `${(b.count / measured) * 100}%` }}
              title={`${b.band}: ${b.count}`}
            />
          ) : null,
        )}
      </div>

      <ul className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {buckets.map((b) => (
          <li key={b.band} className="flex items-start gap-2">
            <span
              aria-hidden
              className={`mt-[7px] size-2 shrink-0 rounded-full ${BAND_CLASS[b.band]}`}
            />
            <div className="min-w-0">
              <p className="text-[14px] text-[var(--dash-foreground)]">
                <span className="font-medium tabular-nums">{b.count}</span>{" "}
                <span className="whitespace-nowrap">{b.band}</span>
              </p>
              <p className="text-[13px] text-[var(--dash-muted-fg)]">{b.meaning}</p>
            </div>
          </li>
        ))}
      </ul>

      {unmeasured ? (
        <p className="mt-4 border-t border-[var(--dash-border)] pt-3 text-[13px] text-[var(--dash-muted-fg)]">
          {unmeasured} {unmeasured === 1 ? "system defines" : "systems define"} no
          accent/ground pair, so {unmeasured === 1 ? "it is" : "they are"} not
          measured here.
        </p>
      ) : null}
    </section>
  );
}
