"use client";

import Link from "next/link";
import type { DesignSystem } from "@/lib/blocks/types";
import { hrefWithDoc } from "@/lib/wiki/doc-param";
import { PageHeader } from "./PageHeader";

export function ScanInventoryPage({
  system,
  docFileName,
  meta,
}: {
  system: DesignSystem;
  docFileName: string;
  meta?: { sourceLabel?: string };
}) {
  const inventory = system.scanInventory ?? [];
  const coverage = system.scanCoverage;

  return (
    <article>
      <PageHeader
        title="Codebase inventory"
        description={
          coverage
            ? `${coverage.reactFiles} React files across ${coverage.scannedPaths.join(", ")} — complete scan coverage. ${coverage.featuredComponents} featured in the Component Library.`
            : `${inventory.length} React files from workspace scan.`
        }
        status="finalized"
        updatedAt={system.updatedAt}
        source={meta?.sourceLabel}
      />

      {coverage ? (
        <dl className="mt-6 grid gap-3 sm:grid-cols-3">
          <Stat label="React files" value={String(coverage.reactFiles)} />
          <Stat label="Total UI files" value={String(coverage.totalFiles)} />
          <Stat
            label="Featured"
            value={`${coverage.featuredComponents} / ${coverage.reactFiles}`}
          />
        </dl>
      ) : null}

      <div className="mt-10 overflow-x-auto rounded-xl border border-[var(--wiki-border)]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-[var(--wiki-border)] bg-[var(--wiki-sidebar)]">
            <tr>
              <th className="px-4 py-3 font-semibold text-[var(--wiki-muted)]">File</th>
              <th className="px-4 py-3 font-semibold text-[var(--wiki-muted)]">Exports</th>
              <th className="px-4 py-3 font-semibold text-[var(--wiki-muted)]">Featured</th>
              <th className="px-4 py-3 font-semibold text-[var(--wiki-muted)]">Category</th>
            </tr>
          </thead>
          <tbody>
            {inventory.map((row) => {
              const component = system.components.find(
                (c) => c.scan?.sourceFile === row.filePath,
              );
              return (
                <tr
                  key={row.filePath}
                  className="border-b border-[var(--wiki-border)] last:border-0"
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-[var(--wiki-text)]">
                    {component ? (
                      <Link
                        href={hrefWithDoc(
                          `/wiki/components/${component.id}`,
                          docFileName,
                        )}
                        className="hover:text-[var(--wiki-accent)]"
                      >
                        {row.filePath}
                      </Link>
                    ) : (
                      row.filePath
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[var(--wiki-muted)]">
                    {row.exports.length ? row.exports.join(", ") : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {row.featured ? (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                        yes
                      </span>
                    ) : (
                      <span className="text-[var(--wiki-muted)]">no</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[var(--wiki-muted)]">
                    {row.category}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="wiki-surface-card p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--wiki-muted)]">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-semibold text-[var(--wiki-text)]">{value}</dd>
    </div>
  );
}
