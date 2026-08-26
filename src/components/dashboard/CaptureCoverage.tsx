/** Which facets capture and import recovered, across every system. */

import type { Analytics } from "@/lib/dashboard/analytics";

export function CaptureCoverage({ coverage }: { coverage: Analytics["coverage"] }) {
  const total = coverage[0]?.total ?? 0;

  if (!total) {
    return (
      <section className="rounded-[var(--dash-radius)] border border-[var(--dash-border)] bg-[var(--dash-surface)] p-6">
        <h2 className="text-[15px] font-medium text-[var(--dash-foreground)]">
          Capture coverage
        </h2>
        <p className="mt-2 text-[14px] text-[var(--dash-muted-fg)]">
          No design systems yet.
        </p>
      </section>
    );
  }

  const rows = coverage.slice().sort((a, b) => b.present - a.present);

  return (
    <section className="rounded-[var(--dash-radius)] border border-[var(--dash-border)] bg-[var(--dash-surface)] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-medium text-[var(--dash-foreground)]">
          Capture coverage
        </h2>
        <p className="text-[13px] text-[var(--dash-muted-fg)]">
          Systems where each facet was recovered, of {total}
        </p>
      </div>

      <ul className="mt-4 space-y-3">
        {rows.map((row) => {
          const pct = Math.round((row.present / row.total) * 100);
          return (
            <li key={row.label}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[14px] text-[var(--dash-foreground)]">
                  {row.label}
                </span>
                <span className="text-[13px] tabular-nums text-[var(--dash-muted-fg)]">
                  {row.present} / {row.total}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--dash-muted)]">
                <div
                  className={pct >= 75 ? "h-full bg-emerald-500" : pct >= 40 ? "h-full bg-amber-400" : "h-full bg-red-500"}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
