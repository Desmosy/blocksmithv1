"use client";

import type { DesignSystem } from "@/lib/blocks/types";
import { PageHeader } from "./PageHeader";

function isColorValue(value: string): boolean {
  return /#([0-9a-fA-F]{3,8})\b/.test(value) || /^rgb/i.test(value);
}

export function ScanCssVarsPage({
  system,
  meta,
  cssVars,
}: {
  system: DesignSystem;
  meta?: { sourceLabel?: string };
  cssVars: { name: string; value: string; source: string }[];
}) {
  const groups = new Map<string, typeof cssVars>();
  for (const v of cssVars) {
    const prefix = v.name.match(/^--([^-]+)/)?.[1] ?? "other";
    const key = prefix.charAt(0).toUpperCase() + prefix.slice(1);
    const list = groups.get(key) ?? [];
    list.push(v);
    groups.set(key, list);
  }

  return (
    <article className="design-preview">
      <PageHeader
        title="CSS variables"
        description={`${cssVars.length} design tokens defined in your workspace — names designers and engineers share.`}
        status="finalized"
        updatedAt={system.updatedAt}
        source={meta?.sourceLabel}
      />

      <div className="mt-10 space-y-10">
        {[...groups.entries()].map(([group, vars]) => (
          <section key={group}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--wiki-muted)]">
              {group}
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {vars.map((v) => (
                <li
                  key={v.name}
                  className="flex items-start gap-3 rounded-xl border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] p-4"
                >
                  {isColorValue(v.value) ? (
                    <span
                      className="mt-0.5 h-10 w-10 shrink-0 rounded-lg border border-[var(--wiki-border)]"
                      style={{
                        backgroundColor: v.value.match(/#([0-9a-fA-F]{3,8})\b/)?.[0] ?? v.value,
                      }}
                    />
                  ) : (
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-[var(--wiki-border)] text-[10px] text-[var(--wiki-muted)]">
                      var
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-medium text-[var(--wiki-text)]">
                      {v.name}
                    </p>
                    <p className="mt-1 font-mono text-xs text-[var(--wiki-muted)]">{v.value}</p>
                    <p className="mt-2 truncate text-xs text-[var(--wiki-muted)]">{v.source}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  );
}
