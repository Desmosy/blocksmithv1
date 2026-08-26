import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary";
};

export function Button({ children, variant = "primary", ...rest }: ButtonProps) {
  const bg =
    variant === "primary" ? "var(--acme-accent)" : "var(--acme-surface-2)";
  const color = variant === "primary" ? "#ffffff" : "var(--acme-text)";

  return (
    <button
      type="button"
      style={{
        backgroundColor: bg,
        color,
        borderRadius: "var(--acme-radius-md)",
        padding: "var(--acme-space-4)",
        border: "none",
        fontWeight: 600,
        cursor: "pointer",
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
