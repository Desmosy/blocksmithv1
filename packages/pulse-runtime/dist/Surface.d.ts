import type { CSSProperties, ReactNode } from "react";
export type SurfaceProps = {
    level?: 0 | 1 | 2;
    /** CSS var for background, e.g. var(--acme-surface-1) */
    background?: string;
    children: ReactNode;
    style?: CSSProperties;
    className?: string;
};
export declare function Surface({ level, background, children, style, className, }: SurfaceProps): import("react").JSX.Element;
