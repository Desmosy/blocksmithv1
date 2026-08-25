"use client";

import { specInlineStyle } from "@/ai-lab/04-component-previews";
import type { DashboardModel, DashRow } from "@/ai-lab/06-demo-compose";
import { DemoButton } from "./DemoButton";

function StatusBadge({ status, model }: { status: string; model: DashboardModel }) {
  const base = model.tagSpec
    ? specInlineStyle(model.tagSpec)
    : {
        backgroundColor: "color-mix(in srgb, var(--wiki-accent) 16%, transparent)",
        color: "var(--wiki-accent)",
        borderRadius: "9999px",
        padding: "3px 10px",
        fontSize: "12px",
        fontWeight: 600,
      };
  return (
    <span style={{ ...base, display: "inline-block", whiteSpace: "nowrap" }}>
      {status}
    </span>
  );
}

export function DashboardView({ model }: { model: DashboardModel }) {
  return (
    <div className="flex min-h-[520px]">
      {/* Sidebar */}
      <aside
        className="hidden w-52 shrink-0 flex-col p-4 sm:flex"
        style={{
          backgroundColor: "var(--wiki-sidebar)",
          borderRight: "1px solid var(--wiki-border)",
        }}
      >
        <span
          className="mb-6 px-2 text-base font-bold"
          style={{ fontFamily: "var(--wiki-display-font)" }}
        >
          {model.brandName}
        </span>
        <nav className="space-y-1">
          {model.navItems.map((item) => (
            <div
              key={item.label}
              className="rounded-md px-3 py-2 text-sm"
              style={
                item.active
                  ? { backgroundColor: "var(--wiki-active)", color: "var(--wiki-text)", fontWeight: 600 }
                  : { color: "var(--wiki-muted)" }
              }
            >
              {item.label}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="min-w-0 flex-1">
        {/* Topbar */}
        <header
          className="flex items-center justify-between gap-4 px-6 py-4"
          style={{ borderBottom: "1px solid var(--wiki-border)" }}
        >
          <input
            type="text"
            readOnly
            placeholder={model.searchPlaceholder}
            className="w-full max-w-xs text-sm"
            style={{
              backgroundColor: "var(--wiki-bg)",
              border: "1px solid var(--wiki-border)",
              borderRadius: "var(--wiki-radius)",
              padding: "8px 14px",
              color: "var(--wiki-text)",
              outline: "none",
            }}
          />
          <div className="flex items-center gap-3">
            <DemoButton cta={model.topbarCta} small />
            <DemoButton cta={model.primaryAction} small />
          </div>
        </header>

        <div className="p-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {model.stats.map((s) => (
              <div
                key={s.label}
                className="p-4"
                style={{
                  backgroundColor: "var(--wiki-sidebar)",
                  border: "var(--wiki-card-border, 1px solid var(--wiki-border))",
                  borderRadius: "var(--wiki-radius-card)",
                  boxShadow: "var(--wiki-card-shadow, none)",
                }}
              >
                <p className="text-xs" style={{ color: "var(--wiki-muted)" }}>
                  {s.label}
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span
                    className="text-2xl font-bold"
                    style={{ fontFamily: "var(--wiki-display-font)" }}
                  >
                    {s.value}
                  </span>
                  <span
                    className="text-xs font-semibold"
                    style={{ color: s.positive ? "var(--wiki-accent)" : "var(--wiki-muted)" }}
                  >
                    {s.delta}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Data table */}
          <div
            className="mt-6 overflow-hidden"
            style={{
              border: "1px solid var(--wiki-border)",
              borderRadius: "var(--wiki-radius-card)",
            }}
          >
            <div
              className="px-5 py-3 text-sm font-semibold"
              style={{ backgroundColor: "var(--wiki-sidebar)", borderBottom: "1px solid var(--wiki-border)" }}
            >
              {model.table.title}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: "var(--wiki-muted)" }}>
                  {model.table.columns.map((col) => (
                    <th key={col} className="px-5 py-2 text-left text-xs font-medium uppercase tracking-wide">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {model.table.rows.map((row: DashRow, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--wiki-border)" }}>
                    {row.cells.map((cell, j) => (
                      <td key={j} className="px-5 py-3">
                        {cell}
                      </td>
                    ))}
                    <td className="px-5 py-3">
                      <StatusBadge status={row.status} model={model} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
