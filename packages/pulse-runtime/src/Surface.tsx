import type { CSSProperties, ReactNode } from "react";

export type SurfaceProps = {
  level?: 0 | 1 | 2;
  /** CSS var for background, e.g. var(--acme-surface-1) */
  background?: string;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
};

const DEFAULT_LEVEL_BG: Record<0 | 1 | 2, string> = {
  0: "var(--pulse-surface-0, var(--acme-surface-1, #faf8f6))",
  1: "var(--pulse-surface-1, var(--acme-surface-2, #efeae4))",
  2: "var(--pulse-surface-2, var(--acme-accent-muted, #f4a99a))",
};

export function Surface({
  level = 1,
  background,
  children,
  style,
  className,
}: SurfaceProps) {
  return (
    <div
      className={className}
      style={{
        background: background ?? DEFAULT_LEVEL_BG[level],
        padding: "var(--pulse-space-md, var(--acme-space-4, 16px))",
        borderRadius: "var(--pulse-radius-md, var(--acme-radius-md, 8px))",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
