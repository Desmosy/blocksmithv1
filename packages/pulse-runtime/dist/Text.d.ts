import type { CSSProperties, ReactNode } from "react";
export type TextVariant = "body" | "muted" | "heading";
export type TextProps = {
    variant?: TextVariant;
    children: ReactNode;
    style?: CSSProperties;
    className?: string;
    as?: "p" | "span" | "h1" | "h2" | "h3";
};
export declare function Text({ variant, children, style, className, as: Tag, }: TextProps): import("react").JSX.Element;
