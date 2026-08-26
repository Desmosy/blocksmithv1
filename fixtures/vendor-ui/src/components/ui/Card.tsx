import type { ReactNode } from "react";

type CardProps = {
  title: string;
  children: ReactNode;
};

export function Card({ title, children }: CardProps) {
  return (
    <section
      style={{
        backgroundColor: "var(--acme-surface-1)",
        border: "1px solid var(--acme-surface-2)",
        borderRadius: "var(--acme-radius-md)",
        padding: "var(--acme-space-4)",
        color: "var(--acme-text)",
      }}
    >
      <h2 style={{ margin: 0, marginBottom: 12, fontSize: 18 }}>{title}</h2>
      {children}
    </section>
  );
}
