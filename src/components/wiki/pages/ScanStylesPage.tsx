"use client";

import type { DesignSystem } from "@/lib/blocks/types";
import { PageHeader } from "./PageHeader";

export function ScanStylesPage({
  system,
  meta,
  rules,
  utilityClasses = [],
}: {
  system: DesignSystem;
  meta?: { sourceLabel?: string };
  rules: { selector: string; declarations: string; source: string }[];
  utilityClasses?: { className: string; count: number; sources: string[] }[];
}) {
  const bySource = new Map<string, typeof rules>();
  for (const r of rules) {
    const list = bySource.get(r.source) ?? [];
    list.push(r);
    bySource.set(r.source, list);
  }

  const total = rules.length + utilityClasses.length;

  return (
    <article className="design-preview">
      <PageHeader
        title="Styles"
        description={`${total} style entries — CSS rules from stylesheets and utility classes from React className strings.`}
        status="finalized"
        updatedAt={system.updatedAt}
        source={meta?.sourceLabel}
      />

      {utilityClasses.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--wiki-muted)]">
            Utility classes (Tailwind / className)
          </h2>
          <p className="mt-2 text-xs text-[var(--wiki-muted)]">
            Most-used tokens across scanned files — spacing, type, color, layout.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {utilityClasses.slice(0, 80).map((u) => (
              <li
                key={u.className}
                className="rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] px-2.5 py-1 font-mono text-xs text-[var(--wiki-text)]"
                title={`${u.count} uses — ${u.sources.slice(0, 2).join(", ")}`}
              >
                {u.className}
                <span className="ml-1.5 text-[var(--wiki-muted)]">×{u.count}</span>
              </li>
            ))}
          </ul>
          {utilityClasses.length > 80 ? (
            <p className="mt-3 text-xs text-[var(--wiki-muted)]">
              +{utilityClasses.length - 80} more classes in scan markdown.
            </p>
          ) : null}
        </section>
      ) : null}

      {rules.length > 0 ? (
        <div className="mt-10 space-y-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--wiki-muted)]">
            CSS rules
          </h2>
          {[...bySource.entries()].map(([source, sourceRules]) => (
            <section key={source}>
              <h3 className="font-mono text-sm font-semibold text-[var(--wiki-text)]">
                {source}
              </h3>
              <ul className="mt-4 space-y-3">
                {sourceRules.map((r) => (
                  <li
                    key={`${r.source}::${r.selector}`}
                    className="rounded-xl border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] p-4"
                  >
                    <p className="font-mono text-sm font-medium text-[var(--wiki-text)]">
                      {r.selector}
                    </p>
                    <p className="mt-2 font-mono text-xs leading-relaxed text-[var(--wiki-muted)]">
                      {r.declarations}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}

      {!rules.length && !utilityClasses.length ? (
        <p className="mt-10 text-sm text-[var(--wiki-muted)]">
          No stylesheet rules or className utilities found. Re-scan after adding CSS or
          Tailwind classes in your components.
        </p>
      ) : null}
    </article>
  );
}
