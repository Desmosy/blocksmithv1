import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
};

/** App chrome — inventoried but not featured in the design-system wiki. */
export function AppShell({ children }: AppShellProps) {
  return (
    <div style={{ backgroundColor: "var(--acme-surface-1)", minHeight: "100vh" }}>
      <header
        style={{
          padding: "var(--acme-space-4)",
          borderBottom: "1px solid var(--acme-surface-2)",
          color: "var(--acme-text-muted)",
        }}
      >
        Acme
      </header>
      <main>{children}</main>
    </div>
  );
}
