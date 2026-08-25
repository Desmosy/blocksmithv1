import { jsx as _jsx } from "react/jsx-runtime";
const VARIANT_STYLE = {
    body: {
        color: "var(--pulse-text, var(--acme-text, #1a1a1a))",
        fontSize: "1rem",
        lineHeight: 1.5,
    },
    muted: {
        color: "var(--pulse-text-muted, var(--acme-text-muted, #6b6b6b))",
        fontSize: "0.875rem",
        lineHeight: 1.5,
    },
    heading: {
        color: "var(--pulse-text, var(--acme-text, #1a1a1a))",
        fontSize: "1.5rem",
        fontWeight: 600,
        lineHeight: 1.25,
    },
};
export function Text({ variant = "body", children, style, className, as: Tag = variant === "heading" ? "h2" : "p", }) {
    return (_jsx(Tag, { className: className, style: { ...VARIANT_STYLE[variant], ...style }, children: children }));
}
